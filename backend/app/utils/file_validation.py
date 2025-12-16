"""
File upload validation utilities.

Provides validation for file types, sizes, and content.
"""

from typing import List, Optional
from fastapi import UploadFile
from ..config import settings
from ..exceptions import FileUploadError


# Allowed file extensions and their MIME types
ALLOWED_FILE_TYPES = {
    ".pdf": ["application/pdf"],
    ".html": ["text/html"],
    ".htm": ["text/html"],
    ".md": ["text/markdown", "text/plain"],
    ".docx": [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ],
    ".pptx": [
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ],
    ".youtube": ["text/plain"],  # YouTube URLs stored as text
}


def get_allowed_extensions() -> List[str]:
    """Get list of allowed file extensions."""
    return list(ALLOWED_FILE_TYPES.keys())


def validate_file_type(filename: str) -> str:
    """
    Validate that the file type is allowed.
    
    Args:
        filename: Name of the file to validate
        
    Returns:
        File extension if valid
        
    Raises:
        FileUploadError: If file type is not allowed
    """
    import os
    
    file_ext = os.path.splitext(filename)[1].lower()
    
    if file_ext not in ALLOWED_FILE_TYPES:
        allowed = ", ".join(get_allowed_extensions())
        raise FileUploadError(
            message=f"File type '{file_ext}' is not supported. Allowed types: {allowed}",
            filename=filename,
            details={
                "file_extension": file_ext,
                "allowed_extensions": get_allowed_extensions()
            }
        )
    
    return file_ext


def validate_file_size(file_size: int, filename: str) -> None:
    """
    Validate that the file size is within limits.
    
    Args:
        file_size: Size of the file in bytes
        filename: Name of the file
        
    Raises:
        FileUploadError: If file size exceeds maximum
    """
    if file_size > settings.MAX_UPLOAD_SIZE:
        max_size_mb = settings.MAX_UPLOAD_SIZE / (1024 * 1024)
        actual_size_mb = file_size / (1024 * 1024)
        raise FileUploadError(
            message=f"File size ({actual_size_mb:.2f} MB) exceeds maximum allowed size ({max_size_mb:.2f} MB)",
            filename=filename,
            details={
                "file_size_bytes": file_size,
                "max_size_bytes": settings.MAX_UPLOAD_SIZE,
                "file_size_mb": round(actual_size_mb, 2),
                "max_size_mb": round(max_size_mb, 2)
            }
        )


def validate_file_content(content: bytes, filename: str) -> None:
    """
    Validate file content (basic checks).
    
    Args:
        content: File content as bytes
        filename: Name of the file
        
    Raises:
        FileUploadError: If file content is invalid
    """
    if len(content) == 0:
        raise FileUploadError(
            message="File is empty",
            filename=filename,
            details={"file_size_bytes": 0}
        )


async def validate_upload_file(file: UploadFile) -> bytes:
    """
    Validate an uploaded file comprehensively.
    
    Performs validation on:
    - File type (extension)
    - File size
    - File content
    
    Args:
        file: The uploaded file
        
    Returns:
        File content as bytes
        
    Raises:
        FileUploadError: If any validation fails
    """
    # Check if filename exists
    if not file.filename:
        raise FileUploadError(
            message="No filename provided",
            filename="unknown",
            details={"error": "filename_missing"}
        )
    
    # Validate file type
    validate_file_type(file.filename)
    
    # Read file content
    content = await file.read()
    
    # Validate file size
    validate_file_size(len(content), file.filename)
    
    # Validate content
    validate_file_content(content, file.filename)
    
    return content
