"""
Custom exception classes for the Test Me application.

These exceptions provide structured error handling with appropriate HTTP status codes
and detailed error messages for different failure scenarios.
"""

from typing import Optional, Dict, Any


class TestMeException(Exception):
    """Base exception for all Test Me application errors"""
    
    def __init__(
        self,
        message: str,
        code: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(TestMeException):
    """Raised when input validation fails"""
    
    def __init__(self, message: str, field: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        error_details = details or {}
        if field:
            error_details["field"] = field
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=400,
            details=error_details
        )


class FileUploadError(TestMeException):
    """Raised when file upload validation fails"""
    
    def __init__(self, message: str, filename: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        error_details = details or {}
        if filename:
            error_details["filename"] = filename
        super().__init__(
            message=message,
            code="FILE_UPLOAD_ERROR",
            status_code=400,
            details=error_details
        )


class ResourceNotFoundError(TestMeException):
    """Raised when a requested resource is not found"""
    
    def __init__(self, resource_type: str, resource_id: Any, details: Optional[Dict[str, Any]] = None):
        error_details = details or {}
        error_details["resource_type"] = resource_type
        error_details["resource_id"] = str(resource_id)
        super().__init__(
            message=f"{resource_type} with id {resource_id} not found",
            code="RESOURCE_NOT_FOUND",
            status_code=404,
            details=error_details
        )


class AIServiceError(TestMeException):
    """Raised when AI service operations fail"""
    
    def __init__(self, message: str, provider: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        error_details = details or {}
        if provider:
            error_details["provider"] = provider
        super().__init__(
            message=message,
            code="AI_SERVICE_ERROR",
            status_code=502,
            details=error_details
        )


class DatabaseError(TestMeException):
    """Raised when database operations fail"""
    
    def __init__(self, message: str, operation: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        error_details = details or {}
        if operation:
            error_details["operation"] = operation
        super().__init__(
            message=message,
            code="DATABASE_ERROR",
            status_code=500,
            details=error_details
        )


class ParsingError(TestMeException):
    """Raised when document parsing fails"""
    
    def __init__(self, message: str, file_type: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        error_details = details or {}
        if file_type:
            error_details["file_type"] = file_type
        super().__init__(
            message=message,
            code="PARSING_ERROR",
            status_code=422,
            details=error_details
        )


class QuestionGenerationError(TestMeException):
    """Raised when question generation fails"""
    
    def __init__(
        self,
        message: str,
        document_id: Optional[int] = None,
        section: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        error_details = details or {}
        if document_id:
            error_details["document_id"] = document_id
        if section:
            error_details["section"] = section
        super().__init__(
            message=message,
            code="QUESTION_GENERATION_ERROR",
            status_code=500,
            details=error_details
        )
