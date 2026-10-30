import asyncio
import httpx
import pytest
from app.ai.groq_agent import GroqAgent
from app.services.errors import APIError

EMPTY_FORM = {"properties": {"full_name": {"type": "string"}}, "required": ["full_name"]}


def test_groq_primary_success(monkeypatch):
    """Case 1: Primary model succeeds on first attempt."""
    agent = GroqAgent(api_key="test_key", model="openai/gpt-oss-120b", fallback_model="openai/gpt-oss-20b")
    call_log = []

    async def mock_post(client, url, headers=None, json=None):
        call_log.append(json.get("model"))
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"candidates": [{"field_id": "full_name", "value": "Rahul Sen", "evidence_text": "Rahul Sen"}], "issues": []}'}}]},
            request=httpx.Request("POST", url)
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    resp = asyncio.run(agent.extract_entities("My name is Rahul Sen", "en-IN", EMPTY_FORM))
    assert len(call_log) == 1
    assert call_log[0] == "openai/gpt-oss-120b"
    assert len(resp.candidates) == 1
    assert resp.candidates[0].value == "Rahul Sen"


def test_groq_primary_unavailable_fallback_success(monkeypatch):
    """Case 2 & 3: Primary model unavailable (400 decommissioned), fallback model succeeds."""
    agent = GroqAgent(api_key="test_key", model="openai/gpt-oss-120b", fallback_model="openai/gpt-oss-20b")
    call_log = []

    async def mock_post(client, url, headers=None, json=None):
        requested_model = json.get("model")
        call_log.append(requested_model)
        if requested_model == "openai/gpt-oss-120b":
            return httpx.Response(
                400,
                text='{"error": {"message": "Model openai/gpt-oss-120b is decommissioned.", "code": "model_decommissioned"}}',
                request=httpx.Request("POST", url)
            )
        elif requested_model == "openai/gpt-oss-20b":
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": '{"candidates": [{"field_id": "full_name", "value": "Pooja Das", "evidence_text": "Pooja Das"}], "issues": []}'}}]},
                request=httpx.Request("POST", url)
            )
        return httpx.Response(500, text="Unexpected", request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    resp = asyncio.run(agent.extract_entities("My name is Pooja Das", "en-IN", EMPTY_FORM))
    assert call_log == ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
    assert len(resp.candidates) == 1
    assert resp.candidates[0].value == "Pooja Das"


def test_groq_both_models_unavailable(monkeypatch):
    """Case 4: Both primary and fallback models fail with 400 model errors."""
    agent = GroqAgent(api_key="test_key", model="openai/gpt-oss-120b", fallback_model="openai/gpt-oss-20b")
    call_log = []

    async def mock_post(client, url, headers=None, json=None):
        requested_model = json.get("model")
        call_log.append(requested_model)
        return httpx.Response(
            400,
            text=f'{{"error": {{"message": "Model {requested_model} unavailable.", "code": "model_decommissioned"}}}}',
            request=httpx.Request("POST", url)
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    with pytest.raises(APIError) as exc_info:
        asyncio.run(agent.extract_entities("Testing both down", "en-IN", EMPTY_FORM))
    assert exc_info.value.status == 502
    assert exc_info.value.code == "EXTRACTION_UPSTREAM_ERROR"
    assert call_log == ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]


def test_groq_rate_limits(monkeypatch):
    """Case 5: Groq returns 429 rate limit across retries -> raises 429 EXTRACTION_RATE_LIMIT."""
    agent = GroqAgent(api_key="test_key", model="openai/gpt-oss-120b", fallback_model="openai/gpt-oss-20b")
    call_count = 0

    async def mock_post(client, url, headers=None, json=None):
        nonlocal call_count
        call_count += 1
        return httpx.Response(
            429,
            text='{"error": {"message": "Rate limit reached for requests per minute (RPM).", "type": "tokens"}}',
            request=httpx.Request("POST", url)
        )

    async def mock_sleep(secs):
        pass  # Fast tests without real waiting

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr(asyncio, "sleep", mock_sleep)

    with pytest.raises(APIError) as exc_info:
        asyncio.run(agent.extract_entities("Testing rate limit", "en-IN", EMPTY_FORM))
    assert exc_info.value.status == 429
    assert exc_info.value.code == "EXTRACTION_RATE_LIMIT"
    assert call_count >= 2


def test_groq_authentication_failure(monkeypatch):
    """Case 6: Groq returns 401 unauthorized -> raises 503 EXTRACTION_AUTH_ERROR."""
    agent = GroqAgent(api_key="invalid_key", model="openai/gpt-oss-120b", fallback_model="openai/gpt-oss-20b")

    async def mock_post(client, url, headers=None, json=None):
        return httpx.Response(
            401,
            text='{"error": {"message": "Invalid API Key provided.", "type": "invalid_request_error"}}',
            request=httpx.Request("POST", url)
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    with pytest.raises(APIError) as exc_info:
        asyncio.run(agent.extract_entities("Testing 401 auth", "en-IN", EMPTY_FORM))
    assert exc_info.value.status == 503
    assert exc_info.value.code == "EXTRACTION_AUTH_ERROR"


def test_groq_upstream_outage_500(monkeypatch):
    """Case 7a: Groq returns 500 server error -> raises 502 EXTRACTION_UPSTREAM_ERROR."""
    agent = GroqAgent(api_key="test_key", model="openai/gpt-oss-120b", fallback_model="openai/gpt-oss-20b")

    async def mock_post(client, url, headers=None, json=None):
        return httpx.Response(
            500,
            text='{"error": {"message": "Internal Server Error"}}',
            request=httpx.Request("POST", url)
        )

    async def mock_sleep(secs):
        pass

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr(asyncio, "sleep", mock_sleep)

    with pytest.raises(APIError) as exc_info:
        asyncio.run(agent.extract_entities("Testing 500 server outage", "en-IN", EMPTY_FORM))
    assert exc_info.value.status == 502
    assert exc_info.value.code == "EXTRACTION_UPSTREAM_ERROR"


def test_groq_upstream_timeout(monkeypatch):
    """Case 7b: Network timeout contacting Groq -> raises 504 EXTRACTION_TIMEOUT."""
    agent = GroqAgent(api_key="test_key", model="openai/gpt-oss-120b", fallback_model="openai/gpt-oss-20b")

    async def mock_post(client, url, headers=None, json=None):
        raise httpx.TimeoutException("Connection timed out after 20s")

    async def mock_sleep(secs):
        pass

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr(asyncio, "sleep", mock_sleep)

    with pytest.raises(APIError) as exc_info:
        asyncio.run(agent.extract_entities("Testing timeout", "en-IN", EMPTY_FORM))
    assert exc_info.value.status == 504
    assert exc_info.value.code == "EXTRACTION_TIMEOUT"

