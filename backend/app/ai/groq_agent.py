import asyncio
import json
import re
from typing import Any
import httpx

from app.ai.config import ai_config
from app.models.contracts import Candidate, ExtractionResponse, Issue
from app.services.ai_adapter import apply_field_mapping
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

        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=ai_config.TIMEOUT_SECONDS) as client:
                    response = await client.post(url, headers=headers, json=payload)
            except httpx.TimeoutException:
                if attempt == 2:
                    raise APIError(504, "EXTRACTION_TIMEOUT", "AI extraction timed out. Please try again.", retryable=True)
                await asyncio.sleep(1.0)
                continue
            except httpx.RequestError as exc:
                if attempt == 2:
                    raise APIError(502, "EXTRACTION_NETWORK_ERROR", f"Failed to contact AI provider: {str(exc)}", retryable=True)
                await asyncio.sleep(1.0)
                continue

            if response.status_code == 429 and attempt < 2:
                # Rate limit hit, wait briefly and retry
                await asyncio.sleep(2.5)
                continue

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
2. CRITICAL FORM LANGUAGE RULE:
   The voice audio conversation may be in Hindi or English, but the FORM IS IN ENGLISH.
   Therefore, ALL extracted form field values MUST BE WRITTEN IN STANDARD ENGLISH (Latin alphabet):
   - For 'full_name', 'city', 'institution', 'guardian_name', 'support_reason': Transliterate or translate any Indic / Devanagari script into standard Title Cased English text (e.g., 'राहुल शर्मा' -> 'Rahul Sharma', 'गुवाहाटी' -> 'Guwahati', 'कॉटन कॉलेज' -> 'Cotton College').
   - For enum fields ('programme', 'state', 'assistance_type', 'preferred_language'):
     * If user mentions an exact or equivalent allowed option (e.g. 'BCA', 'Computer Science', 'Physics', 'English', 'Assam', 'books', 'transport', 'fees'): Map to the exact enum string with "uncertain": false.
     * If user mentions an unlisted/unavailable option (e.g. for 'programme': 'Mechanical Engineering', 'B.Com', 'MBBS', 'Civil'; or for 'state': 'Delhi', 'Punjab'; or for 'preferred_language': 'Bengali', 'Tamil'): DO NOT silently force it to 'Other'! Output "uncertain": true, "ambiguity_reason": "UNLISTED_OPTION", and include an issue with type "UNLISTED_OPTION".
     * If user agrees or asks for 'Other' / 'Others' / 'दूसरा' / 'हाँ' / 'Yes': Map to 'Other' with "uncertain": false.
   - For enum fields ('state', 'assistance_type', 'preferred_language'): Match case-insensitively and output the EXACT allowed English enum choice string (e.g. 'Assam', 'books', 'transport', 'fees', 'English', 'Hindi').
   - For dates ('date_of_birth'): Convert spoken dates in Hindi or English (e.g. '15 अगस्त 2004' or '3 April 2005') into strict ISO 'YYYY-MM-DD' ('2004-08-15', '2005-04-03').
   - For 'mobile': 10 ASCII digits starting with 6-9.
   - For 'year_of_study': Output as strict integer (1, 2, 3, 4, or 5).
3. Provide exact substring evidence from the transcript in 'evidence_text'.
4. Return a valid JSON object matching this schema:
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

        t_low = transcript.lower().strip()
        candidates: list[Candidate] = []
        issues: list[Issue] = []

        for c in parsed.get("candidates", []):
            fid = c.get("field_id")
            if fid not in allowed_fields:
                continue
            val = c.get("value")
            uncertain = bool(c.get("uncertain", False))
            ambiguity = c.get("ambiguity_reason")

            if fid == "year_of_study" and val is not None:
                try:
                    val = int(val)
                except (ValueError, TypeError):
                    pass
            elif fid in properties and "enum" in properties[fid] and val is not None:
                spec_enums = [str(x) for x in properties[fid]["enum"] if x is not None]
                val_lower = str(val).lower().strip()
                has_other = any("other" in x.lower() for x in spec_enums)
                other_canonical = next((x for x in spec_enums if "other" in x.lower()), None)

                # Check if user explicitly asked or affirmed 'Other'
                is_other_affirm = (
                    "other" in val_lower or
                    "दूसरा" in val_lower or
                    (val_lower in ["yes", "haan", "sure", "okay", "हाँ", "ठीक है"] and has_other)
                )

                if is_other_affirm and other_canonical:
                    val = other_canonical
                    uncertain = False
                    ambiguity = None
                elif fid == "programme":
                    if "bca" in val_lower or "computer" in val_lower:
                        val = "BCA"
                        uncertain = False
                    elif "physics" in val_lower:
                        val = "BSc Physics"
                        uncertain = False
                    elif "english" in val_lower:
                        val = "BA English"
                        uncertain = False
                    elif val_lower in [x.lower() for x in spec_enums]:
                        val = next(x for x in spec_enums if x.lower() == val_lower)
                        uncertain = False
                    else:
                        # User stated an unlisted programme (e.g. Mechanical Engineering, BCom, etc.)
                        uncertain = True
                        ambiguity = f"UNLISTED_OPTION: '{val}' is not in dropdown list."
                        issues.append(Issue(
                            field_id=fid,
                            type="UNLISTED_OPTION",
                            message=f"'{val}' is not available in dropdown options",
                            candidates=spec_enums,
                        ))
                else:
                    matched = next((x for x in spec_enums if x.lower() == val_lower), None)
                    if matched:
                        val = matched
                        uncertain = False
                    else:
                        uncertain = True
                        ambiguity = f"UNLISTED_OPTION: '{val}' is not in dropdown list."
                        issues.append(Issue(
                            field_id=fid,
                            type="UNLISTED_OPTION",
                            message=f"'{val}' is not available in dropdown options",
                            candidates=spec_enums,
                        ))

            candidates.append(Candidate(
                field_id=fid,
                value=val,
                evidence_text=str(c.get("evidence_text", "")),
                uncertain=uncertain,
                ambiguity_reason=ambiguity,
            ))

        for issue in parsed.get("issues", []):
            if not any(i.field_id == issue.get("field_id") and i.type == issue.get("type") for i in issues):
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
        form_id: str | None = None,
        manual_fields: set[str] | None = None,
    ) -> dict:
        """
        Interactive conversational voice agent turn:
        - Extracts any new field candidates from transcript (if provided).
        - Computes missing required and unfilled optional fields.
        - Verifies name spelling before filling.
        - Recommends optional fields once required are done, respecting user's choice to decline.
        - Handles commands or unrecognized user speech gracefully.
        """
        properties = form_schema.get("properties", {})
        required_fields = form_schema.get("required", [])

        # Step 1: Extract candidates if transcript is present
        candidates: list[Candidate] = []
        issues: list[Issue] = []
        if transcript and transcript.strip():
            extraction = await self.extract_entities(transcript, language_code, form_schema, current_values)
            effective_form_id = form_id or form_schema.get("$id")
            if effective_form_id:
                mapped = apply_field_mapping(
                    form_id=effective_form_id,
                    transcript=transcript,
                    extraction=extraction,
                    manual_fields=manual_fields,
                )
                candidates = mapped.candidates
                issues = mapped.issues
            else:
                candidates = extraction.candidates
                issues = list(extraction.issues)

        # Step 2: Merge proposed values into a simulated view
        merged_values = dict(current_values or {})
        for c in candidates:
            if not c.uncertain and c.value is not None:
                merged_values[c.field_id] = c.value

        # Step 3: Identify missing fields
        missing_required = [f for f in required_fields if f not in merged_values or merged_values[f] in (None, "", "unknown")]
        missing_optional = [f for f in properties if f not in required_fields and (f not in merged_values or merged_values[f] in (None, "", "unknown"))]

        # Step 4: Check if user declines optional fields or wants to stop
        user_declined_optional = False
        if transcript and len(missing_required) == 0:
            t_low = transcript.lower().strip()
            decline_phrases = ["no", "nah", "no thanks", "nahi", "नहीं", "नहीं चाहिए", "skip", "bas", "done", "submit", "that is all", "that's all", "nothing"]
            if any(p in t_low for p in decline_phrases):
                user_declined_optional = True

        all_required_done = (len(missing_required) == 0)
        is_complete = all_required_done and (user_declined_optional or len(missing_optional) == 0)

        # Step 5: Check if full_name candidate was extracted this turn
        name_candidate = next((c for c in candidates if c.field_id == "full_name" and c.value and not c.uncertain), None)
        name_val = str(name_candidate.value).strip() if name_candidate else ""
        name_spelling = " ".join("-".join(word.upper()) for word in name_val.split()) if name_val else ""

        if name_val:
            name_rule = f"""NAME CONFIRMATION RULE:
User's name was extracted as '{name_val}' with English spelling '{name_spelling}'.
You MUST spell out the English letters so the user can verify the spelling:
- In Hindi: "मैंने आपका नाम {name_val} सुना है, जिसकी स्पेलिंग {name_spelling} है। क्या यह सही है? कृपया अपनी जन्मतिथि भी बताइए।"
- In English: "I heard your name as {name_val}, spelled {name_spelling}. Is this spelling correct? Please also share your date of birth."
"""
        else:
            name_rule = ""

        # Step 5b: Check for unlisted dropdown options requested by user
        unlisted_options = []
        for c in candidates:
            if c.uncertain and "UNLISTED_OPTION" in str(c.ambiguity_reason):
                spec = properties.get(c.field_id, {})
                allowed_opts = [str(x) for x in spec.get("enum", []) if x is not None]
                has_other = any("other" in opt.lower() for opt in allowed_opts)
                other_name = next((opt for opt in allowed_opts if "other" in opt.lower()), "Other")
                non_other_opts = [opt for opt in allowed_opts if "other" not in opt.lower()]
                unlisted_options.append({
                    "field_id": c.field_id,
                    "field_label": spec.get("title", c.field_id),
                    "user_choice": c.value,
                    "allowed_options": allowed_opts,
                    "non_other_options": non_other_opts,
                    "has_other": has_other,
                    "other_name": other_name
                })

        unlisted_rule = ""
        if unlisted_options:
            is_complete = False  # cannot finalize while an unlisted choice is pending
            for item in unlisted_options:
                fid = item["field_id"]
                label = item["field_label"]
                choice = item["user_choice"]
                has_other = item["has_other"]
                non_other = item["non_other_options"]
                other_name = item["other_name"]
                all_opts = item["allowed_options"]

                # Read out with small pauses: e.g. "BSc Physics, ... BCA, ... BA English"
                pause_opts = ", ... ".join(non_other)
                pause_all = ", ... ".join(all_opts)

                if has_other:
                    unlisted_rule += f"""
DROPDOWN UNLISTED OPTION FOR '{label}' (Field: '{fid}'):
The user requested '{choice}', which is NOT in the dropdown list!
However, this dropdown DOES have an '{other_name}' option.
You MUST reply with a polite explanation and pause after each option:
- In English: "Sorry, '{choice}' is not available in the dropdown options. However, you can select '{other_name}', or choose from: {pause_opts}. Would you like me to select '{other_name}' for you?"
- In Hindi: "माफ़ कीजिएगा, '{choice}' विकल्प सूची में उपलब्ध नहीं है। लेकिन आप '{other_name}' विकल्प चुन सकते हैं, या फिर: {pause_opts} में से चुन सकते हैं। क्या मैं आपके लिए '{other_name}' चुन लूँ?"
Do not advance to other fields until this choice is clarified.
"""
                else:
                    unlisted_rule += f"""
DROPDOWN UNLISTED OPTION FOR '{label}' (Field: '{fid}'):
The user requested '{choice}', which is NOT in the dropdown list, and there is NO 'Other' option.
You MUST read out all available choices with small pauses:
- In English: "Sorry, '{choice}' is not available. You have to choose from: {pause_all}. Which one would you prefer?"
- In Hindi: "माफ़ कीजिएगा, यह विकल्प उपलब्ध नहीं है। आपको इनमें से ही चुनना होगा: {pause_all}। आप कौन सा चुनना चाहेंगे?"
Do not advance to other fields until the user selects one.
"""

        query_options_rule = ""
        t_low_query = (transcript or "").lower()
        if any(w in t_low_query for w in ["what option", "which option", "what course", "which course", "what programme", "which programme", "available course", "available programme", "विकल्प", "कौन से कोर्स", "कौन सा प्रोग्राम"]):
            for f_id in ["programme", "state", "assistance_type"]:
                if f_id in properties and "enum" in properties[f_id]:
                    opts = [str(x) for x in properties[f_id]["enum"] if x is not None]
                    opts_p = ", ... ".join(opts)
                    query_options_rule += f"\nIf user asks what options are available for {properties[f_id].get('title', f_id)}: Read them out with small pauses: {opts_p}."

        # Step 6: Generate conversational assistant response
        system_prompt = f"""You are FormSaathi AI, a warm, polite, and helpful multilingual voice assistant helping users fill their digital forms.
Spoken Voice Conversation Language: {language_code} (Speak in natural Hindi if hi-IN, or simple friendly English if en-IN).
Target Form: {form_schema.get('title')}
Required Fields Remaining: {json.dumps(missing_required)}
Optional Fields Remaining: {json.dumps(missing_optional)}
Currently Filled Values: {json.dumps(merged_values)}
Newly Extracted Candidates This Turn: {json.dumps([c.model_dump() for c in candidates])}
User Declined Optional Fields: {user_declined_optional}
Is Form Ready to Submit: {is_complete}

GUIDELINES:
1. Speak in a concise, conversational tone (1-2 sentences maximum, suitable for Text-to-Speech).
2. {name_rule}
3. {unlisted_rule}
4. {query_options_rule}
5. COMMAND / UNCLEAR HANDLING:
   If user says an unrecognized command or unclear statement unrelated to the form, politely say:
   - In Hindi: "माफ़ कीजिए, मैं समझ नहीं पाया। कृपया अपने फॉर्म के विवरण बताएं।"
   - In English: "Sorry, I didn't understand that. Could you please share your form details?"
6. REQUIRED vs OPTIONAL FLOW:
   - If required fields are still missing: Ask for remaining unfilled required fields in logical order (name & DOB -> mobile & city/state -> programme & institution -> study year / assistance type).
   - If ALL required fields are filled, but optional fields remain ({missing_optional}):
     Politely recommend filling them, but mention they can say 'No':
     * In Hindi: "आपके सभी ज़रूरी विवरण दर्ज हो चुके हैं! क्या आप अपना {', '.join(missing_optional)} भी जोड़ना चाहेंगे? (यदि नहीं, तो 'नहीं' कहें)"
     * In English: "All required fields are filled! Would you also like to provide your {', '.join(missing_optional)}? (If not, just say 'No thanks')"
   - If user says 'No' / declines optional, or all fields are filled:
     Celebrate and inform them to review and confirm!
     * In Hindi: "बहुत बढ़िया! आपका फॉर्म पूरा हो चुका है। कृपया नीचे 'Review & Confirm' पर क्लिक करें।"
     * In English: "Great! Your form is ready. Please click 'Review & Confirm' below."
7. Return JSON: {{"message": "Spoken assistant reply in target language", "is_complete": boolean}}"""

        user_content = f"User said: \"{transcript or '(User just opened the voice assistant)'}\""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        raw = await self._call_llm(messages, temperature=0.2, json_mode=True)
        try:
            dialog_data = json.loads(raw)
        except Exception:
            if language_code == "hi-IN":
                dialog_data = {"message": "नमस्ते! कृपया अपने शेष विवरण बताएं।", "is_complete": is_complete}
            else:
                dialog_data = {"message": "Hello! Please share your remaining form details.", "is_complete": is_complete}

        return {
            "candidates": [c.model_dump() for c in candidates],
            "issues": [i.model_dump() for i in issues],
            "updated_values": merged_values,
            "missing_required": missing_required,
            "missing_optional": missing_optional,
            "assistant_message": dialog_data.get("message", ""),
            "name_candidate": name_val if name_val else None,
            "name_spelling": name_spelling if name_spelling else None,
            "is_complete": is_complete or bool(dialog_data.get("is_complete", False)),
        }
