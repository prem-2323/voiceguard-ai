import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


def _error_response(
    *,
    status_code: int,
    message: str,
    code: str,
    details: Any = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "data": None,
            "error": {"code": code, "details": details},
        },
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        del request
        message = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return _error_response(
            status_code=exc.status_code,
            message=message,
            code=f"HTTP_{exc.status_code}",
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        del request
        details = [
            {"location": error.get("loc", []), "message": error.get("msg", "Invalid value")}
            for error in exc.errors()
        ]
        return _error_response(
            status_code=422,
            message="Request validation failed",
            code="VALIDATION_ERROR",
            details=details,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "Unhandled API error for %s",
            request.url.path,
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        return _error_response(
            status_code=500,
            message="An unexpected server error occurred",
            code="INTERNAL_SERVER_ERROR",
        )
