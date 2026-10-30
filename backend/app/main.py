import os
import secrets
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.ai import ai_service
from app.api.routes import router
from app.services.errors import APIError
from app.services.session_service import SessionStore


def error_response(status, code, message, field_id=None, retryable=False):
    return JSONResponse(status_code=status, content={"error": {
        "code": code, "message": message, "retryable": retryable,
        "field_id": field_id, "request_id": secrets.token_urlsafe(12)}})


def create_app(store: SessionStore | None = None) -> FastAPI:
    application = FastAPI(title="FormSaathi AI", version="0.1.0")
    application.state.sessions = store if store is not None else SessionStore()

    # Dynamic CORS origin handling for Render (backend) and Vercel (frontend)
    cors_env = os.environ.get("CORS_ORIGINS", "")
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "null",
    ]
    allow_creds = True
    if cors_env:
        if cors_env.strip() == "*":
            allowed_origins = ["*"]
            allow_creds = False
        else:
            for origin in cors_env.split(","):
                cleaned = origin.strip()
                if cleaned and cleaned not in allowed_origins:
                    allowed_origins.append(cleaned)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"https://.*\.vercel\.app" if allowed_origins != ["*"] else None,
        allow_credentials=allow_creds,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @application.exception_handler(APIError)
    async def api_error(request: Request, exc: APIError):
        return error_response(exc.status, exc.code, exc.message, exc.field_id, exc.retryable)

    @application.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exc: RequestValidationError):
        # Pydantic errors can contain submitted PII. Return safe static copy only.
        return error_response(422, "INVALID_REQUEST", "Request does not match the API contract. Check field names, types and required keys.")

    @application.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return error_response(exc.status_code, "HTTP_ERROR", "The requested operation is not available.")

    @application.get("/", include_in_schema=False)
    async def root():
        return {
            "name": "FormSaathi AI API",
            "status": "online",
            "docs": "/docs",
            "health": "/api/health"
        }

    @application.get("/health", include_in_schema=False)
    async def health_root():
        return {"status": "ok", **ai_service.status()}

    application.include_router(router)
    return application


app = create_app()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
