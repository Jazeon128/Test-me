"""
Request/Response logging middleware

This middleware logs all HTTP requests and responses with structured logging,
including request IDs, timing information, and error context.
"""

import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from ..utils.logging import get_logger, bind_context, clear_context

logger = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all HTTP requests and responses

    Adds a unique request_id to each request and logs:
    - Request method, path, and headers
    - Response status code and duration
    - Any errors that occur during request processing
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())

        # Bind request context for all logs in this request
        bind_context(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_host=request.client.host if request.client else None,
        )

        # Log request start
        start_time = time.time()
        logger.info(
            "request_started",
            query_params=dict(request.query_params) if request.query_params else None,
            user_agent=request.headers.get("user-agent"),
        )

        # Process request
        try:
            response = await call_next(request)

            # Calculate duration
            duration_ms = round((time.time() - start_time) * 1000, 2)

            # Log successful response
            logger.info(
                "request_completed", status_code=response.status_code, duration_ms=duration_ms
            )

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            return response  # type: ignore[no-any-return]

        except Exception as e:
            # Calculate duration
            duration_ms = round((time.time() - start_time) * 1000, 2)

            # Log error
            logger.error(
                "request_failed",
                error_type=type(e).__name__,
                error_message=str(e),
                duration_ms=duration_ms,
                exc_info=True,
            )

            # Re-raise to let FastAPI handle it
            raise

        finally:
            # Clear context after request
            clear_context()
