import json
import re
from typing import Any
import httpx

from app.ai.config import ai_config
from app.models.contracts import Candidate, ExtractionResponse, Issue
from app.services.errors import APIError


class GroqAgent:
    """Agent using Groq (Llama 3.3) for entity extraction and conversational voice guidance."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or ai_config.GROQ_API_KEY
        self.model = model or ai_config.GROQ_MODEL
        self.base_url = ai_config.GROQ_BASE_URL.rstrip("/")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def _call_llm(self, messages: list[dict], temperature: float = 0.1, json_mode: bool = True) -> str:
        if not self.is_configured:
            raise APIError(503, "EXTRACTION_UNAVAILABLE", "Groq API key not configured on backend. Set GROQ_API_KEY in environment.")

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "response_format": {"type": "json_object"} if json_mode else None,
        }

        try:
            async with httpx.AsyncClient(timeout=ai_config.TIMEOUT_SECONDS) as client:
                response = await client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException:
            raise APIError(504, "EXTRACTION_TIMEOUT", "AI extraction timed out. Please try again.", retryable=True)
        except httpx.RequestError as exc:
            raise APIError(502, "EXTRACTION_NETWORK_ERROR", f"Failed to contact AI provider: {str(exc)}", retryable=True)

        if response.status_code in (401, 403):
            raise APIError(503, "EXTRACTION_AUTH_ERROR", "AI provider authentication failed. Check GROQ_API_KEY.")
        if response.status_code != 200:
            raise APIError(502, "EXTRACTION_UPSTREAM_ERROR", f"AI provider returned error ({response.status_code}): {response.text}")

        data = response.json()
        return data["choices"][0]["message"]["content"]

    async def extract_entities(self, transcript: str, language_code: str, form_schema: dict, current_values: dict | None = None) -> ExtractionResponse:
        """
        Extracts structured field values from transcript into Candidate objects conforming to CONTRACT.md.
        """
        properties = form_schema.get("properties", {})
        allowed_fields = list(properties.keys())
        required_fields = form_schema.get("required", [])

        system_prompt = f"""You are FormSaathi AI's structured entity extractor for digital government and college forms.
Target Form: {form_schema.get('title', 'Registration Form')} ({form_schema.get('$id', '')})
Allowed Fields and Constraints:
{json.dumps(properties, indent=2)}

Required Fields: {json.dumps(required_fields)}
Current Form Values: {json.dumps(current_values or {})}
Input Language: {language_code}

RULES:
1. ONLY extract fields that are explicitly mentioned in the user's transcript. DO NOT invent or infer unmentioned details.
2. For dates (date_of_birth), convert to strict ISO YYYY-MM-DD format if valid. If ambiguous (e.g. 04/05/2002), set uncertain=true and specify ambiguity_reason.
3. For mobile, extract 10-digit Indian numbers starting with 6-9.
4. For enum fields (state, programme, assistance_type, preferred_language), map case-insensitively ONLY to the allowed enum choices in the schema. If a match is unsure, set uncertain=true.
5. If the user is in year 1-5 of study, study year must be an integer.
6. Provide exact substring evidence from the transcript in 'evidence_text'.
7. Return a valid JSON object matching this schema:
{{
  "candidates": [
    {{
      "field_id": "field_name",
      "value": "extracted_value_or_int_or_null",
      "evidence_text": "exact snippet from transcript",
      "uncertain": false,
      "ambiguity_reason": null
    }}
  ],
  "issues": [
    {{
      "field_id": "field_name_or_null",
      "type": "warning_or_unclear",
      "message": "explanation"
    }}
  ]
}}"""

        user_prompt = f"Transcript to extract:\n\"\"\"{transcript}\"\"\""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        raw_json = await self._call_llm(messages, temperature=0.0, json_mode=True)
        try:
            parsed = json.loads(raw_json)
        except json.JSONDecodeError:
            # Fallback regex extraction of JSON object
            match = re.search(r"\{.*\}", raw_json, re.DOTALL)
            if match:
                parsed = json.loads(match.group(0))
            else:
                return ExtractionResponse(candidates=[], issues=[Issue(field_id=None, type="PARSE_ERROR", message="Failed to parse model response")])

        candidates: list[Candidate] = []
        for c in parsed.get("candidates", []):
            fid = c.get("field_id")
            if fid not in allowed_fields:
                continue
            candidates.append(Candidate(
                field_id=fid,
                value=c.get("value"),
                evidence_text=str(c.get("evidence_text", "")),
                uncertain=bool(c.get("uncertain", False)),
                ambiguity_reason=c.get("ambiguity_reason"),
            ))

        issues: list[Issue] = []
        for issue in parsed.get("issues", []):
            issues.append(Issue(
                field_id=issue.get("field_id"),
                type=str(issue.get("type", "NOTICE")),
                message=str(issue.get("message", "")),
                candidates=issue.get("candidates"),
            ))

        return ExtractionResponse(candidates=candidates, issues=issues)

    async def dialog_turn(
        self,
        form_schema: dict,
        current_values: dict,
        transcript: str | None,
        language_code: str = "en-IN",
    ) -> dict:
        """
        Interactive conversational voice agent turn:
        - Extracts any new field candidates from transcript (if provided).
        - Computes missing required and unfilled optional fields.
        - Crafts a natural, friendly conversational reply asking for next missing info in Hindi or English.
        """
        properties = form_schema.get("properties", {})
        required_fields = form_schema.get("required", [])

        # Step 1: Extract candidates if transcript is present
        candidates: list[Candidate] = []
        if transcript and transcript.strip():
            extraction = await self.extract_entities(transcript, language_code, form_schema, current_values)
            candidates = extraction.candidates

        # Step 2: Merge proposed values into a simulated view
        merged_values = dict(current_values or {})
        for c in candidates:
            if not c.uncertain and c.value is not None:
                merged_values[c.field_id] = c.value

        # Step 3: Identify missing fields
        missing_required = [f for f in required_fields if f not in merged_values or merged_values[f] in (None, "", "unknown")]
        missing_optional = [f for f in properties if f not in required_fields and (f not in merged_values or merged_values[f] in (None, "", "unknown"))]

        # Step 4: Generate conversational assistant response
        system_prompt = f"""You are FormSaathi AI, a warm, polite, and helpful multilingual voice assistant helping users with limited digital literacy fill their digital forms.
Language: {language_code} (Respond in Hindi if hi-IN, or simple friendly English if en-IN).
Target Form: {form_schema.get('title')}
Required Fields Remaining: {json.dumps(missing_required)}
Optional Fields Remaining: {json.dumps(missing_optional)}
Currently Filled Values: {json.dumps(merged_values)}

Guidelines:
1. Speak in a concise, conversational tone (1-2 sentences maximum, since this will be read out via Text-to-Speech).
2. If this is the start and fields are already filled, acknowledge what is done and ask for the most important missing fields.
3. If user just answered, acknowledge politely what was filled, and ask for the next 1-2 missing required fields.
4. When all required fields are filled, celebrate and tell the user they can review and submit!
5. Return JSON: {{"message": "Spoken assistant reply in target language", "is_complete": boolean}}"""

        user_content = f"User said: \"{transcript or '(User just opened the voice assistant)'}\""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        raw = await self._call_llm(messages, temperature=0.3, json_mode=True)
        try:
            dialog_data = json.loads(raw)
        except Exception:
            if language_code == "hi-IN":
                dialog_data = {"message": "नमस्ते! कृपया अपने शेष विवरण बताएं।", "is_complete": len(missing_required) == 0}
            else:
                dialog_data = {"message": "Hello! Please share your remaining form details.", "is_complete": len(missing_required) == 0}

        return {
            "candidates": [c.model_dump() for c in candidates],
            "updated_values": merged_values,
            "missing_required": missing_required,
            "missing_optional": missing_optional,
            "assistant_message": dialog_data.get("message", ""),
            "is_complete": len(missing_required) == 0,
        }
