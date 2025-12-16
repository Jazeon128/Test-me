"""
Error handling middleware for the Test Me application.

Provides centralized error handling, logging, and structured error responses.
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
import traceback
import uuid
from typing import Union, Optional

from ..exceptions import TestMeException
from ..utils.logging import get_logger

logger = get_logger(__name__)


def format_error_response(
    code: str,
    message: str,
    details: Optional[dict] = None,
    request_id: Optional[str] = None
) -> dict:  # type: ignore[type-arg]  # noqa
    """
    Format error response in a consistent structure.
    
    Args:
        code: Error code identifier
        message: Human-readable error message
        details: Additional error details
        request_id: Request tracking ID
        
    Returns:
        Formatted error response dictionary
    """
    error_response = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    
    if details:
        error_response["error"]["details"] = details  # type: ignore[assignment]
    
    if request_id:
        error_response["error"]["request_id"] = request_id
    
    return error_response


async def testme_exception_handler(request: Request, exc: TestMeException) -> JSONResponse:
    """
    Handle custom Test Me exceptions.
    
    Args:
        request: The incoming request
        exc: The Test Me exception
        
    Returns:
        JSON response with error details
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    
    logger.error(
        "application_error",
        error_code=exc.code,
        error_message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
        request_id=request_id,
        path=request.url.path,
        method=request.method
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=format_error_response(
            code=exc.code,
            message=exc.message,
            details=exc.details,
            request_id=request_id
        )
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    Handle standard HTTP exceptions.
    
    Args:
        request: The incoming request
        exc: The HTTP exception
        
    Returns:
        JSON response with error details
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    
    logger.warning(
        "http_error",
        status_code=exc.status_code,
        detail=exc.detail,
        request_id=request_id,
        path=request.url.path,
        method=request.method
    )
    
    # Map status codes to error codes
    code_mapping = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        422: "UNPROCESSABLE_ENTITY",
        429: "TOO_MANY_REQUESTS",
        500: "INTERNAL_SERVER_ERROR",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
    }
    
    error_code = code_mapping.get(exc.status_code, "HTTP_ERROR")
    
    return JSONResponse(
        status_code=exc.status_code,
        content=format_error_response(
            code=error_code,
            message=str(exc.detail),
            request_id=request_id
        )
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle request validation errors.
    
    Args:
        request: The incoming request
        exc: The validation error
        
    Returns:
        JSON response with validation error details
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    
    # Extract validation errors
    validation_errors = []
    for error in exc.errors():
        validation_errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    logger.warning(
        "validation_error",
        errors=validation_errors,
        request_id=request_id,
        path=request.url.path,
        method=request.method
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=format_error_response(
            code="VALIDATION_ERROR",
            message="Request validation failed",
            details={"validation_errors": validation_errors},
            request_id=request_id
        )
    )


async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """
    Handle database errors.
    
    Args:
        request: The incoming request
        exc: The database exception
        
    Returns:
        JSON response with error details
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    
    # Determine error type
    if isinstance(exc, IntegrityError):
        error_code = "DATABASE_INTEGRITY_ERROR"
        message = "Database integrity constraint violated"
        status_code = status.HTTP_409_CONFLICT
    else:
        error_code = "DATABASE_ERROR"
        message = "Database operation failed"
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    
    logger.error(
        "database_error",
        error_type=type(exc).__name__,
        error_message=str(exc),
        request_id=request_id,
        path=request.url.path,
        method=request.method,
        stack_trace=traceback.format_exc(),
        exc_info=True
    )
    
    return JSONResponse(
        status_code=status_code,
        content=format_error_response(
            code=error_code,
            message=message,
            request_id=request_id
        )
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle unexpected exceptions.
    
    Args:
        request: The incoming request
        exc: The exception
        
    Returns:
        JSON response with error details
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    
    logger.error(
        "unexpected_error",
        error_type=type(exc).__name__,
        error_message=str(exc),
        request_id=request_id,
        path=request.url.path,
        method=request.method,
        stack_trace=traceback.format_exc(),
        exc_info=True
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=format_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred",
            request_id=request_id
        )
    )
