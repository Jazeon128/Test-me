"""
Structured logging configuration using structlog

This module provides a centralized logging configuration for the application,
ensuring all logs are structured, consistent, and easily parseable.
"""

import logging
import sys
import structlog
from typing import Any, Optional


def configure_logging(log_level: str = "INFO") -> None:
    """
    Configure structured logging for the application

    Args:
        log_level: The logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper()),
    )

    # Configure structlog
    structlog.configure(
        processors=[
            # Add log level to event dict
            structlog.stdlib.add_log_level,
            # Add timestamp
            structlog.processors.TimeStamper(fmt="iso"),
            # Add stack info for exceptions
            structlog.processors.StackInfoRenderer(),
            # Format exceptions
            structlog.processors.format_exc_info,
            # Decode unicode
            structlog.processors.UnicodeDecoder(),
            # Render as JSON for production, console for development
            structlog.processors.JSONRenderer()
            if log_level.upper() != "DEBUG"
            else structlog.dev.ConsoleRenderer(),  # type: ignore[list-item]
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: Optional[str] = None) -> structlog.BoundLogger:
    """
    Get a structured logger instance

    Args:
        name: Optional logger name (typically __name__ of the module)

    Returns:
        A configured structlog logger
    """
    if name:
        return structlog.get_logger(name)  # type: ignore[no-any-return]
    return structlog.get_logger()  # type: ignore[no-any-return]


def bind_context(**kwargs: Any) -> None:
    """
    Bind context variables to the current logger

    This adds persistent context that will be included in all subsequent log entries

    Args:
        **kwargs: Key-value pairs to add to logging context
    """
    structlog.contextvars.bind_contextvars(**kwargs)


def unbind_context(*keys: str) -> None:
    """
    Remove context variables from the current logger

    Args:
        *keys: Keys to remove from logging context
    """
    structlog.contextvars.unbind_contextvars(*keys)


def clear_context() -> None:
    """Clear all context variables from the current logger"""
    structlog.contextvars.clear_contextvars()


class LoggerAdapter:
    """
    Adapter to provide a consistent logging interface

    This allows gradual migration from standard logging to structlog
    """

    def __init__(self, logger: structlog.BoundLogger):
        self.logger = logger

    def debug(self, message: str, **kwargs: Any) -> None:
        """Log a debug message"""
        self.logger.debug(message, **kwargs)

    def info(self, message: str, **kwargs: Any) -> None:
        """Log an info message"""
        self.logger.info(message, **kwargs)

    def warning(self, message: str, **kwargs: Any) -> None:
        """Log a warning message"""
        self.logger.warning(message, **kwargs)

    def error(self, message: str, **kwargs: Any) -> None:
        """Log an error message"""
        self.logger.error(message, **kwargs)

    def critical(self, message: str, **kwargs: Any) -> None:
        """Log a critical message"""
        self.logger.critical(message, **kwargs)

    def exception(self, message: str, **kwargs: Any) -> None:
        """Log an exception with stack trace"""
        self.logger.exception(message, **kwargs)
