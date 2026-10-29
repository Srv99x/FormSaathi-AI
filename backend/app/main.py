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
    application.add_middleware(CORSMiddleware,
                               allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                                              "http://localhost:8000", "http://127.0.0.1:8000",
                                              "null"],
                               allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
                               allow_headers=["*"])

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

    application.include_router(router)
    return application


app = create_app()
