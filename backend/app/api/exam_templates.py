"""API endpoints for exam question templates"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict

from ..services.exam_templates import ExamTemplateManager

router = APIRouter()
template_manager = ExamTemplateManager()


class ExamTemplateConfig(BaseModel):
    """Exam template configuration"""
    cert_type: str = "gcp_ace"
    archetype: str
    topics: Optional[List[str]] = None
    constraints: Optional[str] = None
    distractor_strategy: str = "mixed"


class TemplatePreviewRequest(BaseModel):
    """Request for template preview"""
    config: ExamTemplateConfig
    sample_text: str = "Sample text for preview"


@router.get("/cert-types")
async def get_cert_types():
    """Get available certification types"""
    return {
        "cert_types": template_manager.get_cert_types()
    }


@router.get("/archetypes")
async def get_archetypes(cert_type: str = "gcp_ace"):
    """
    Get available question archetypes for a certification type

    Args:
        cert_type: Certification type ("gcp_ace" or "aws_saa")

    Returns:
        Dictionary of available archetypes with descriptions
    """
    try:
        archetypes = template_manager.get_archetypes(cert_type)
        return {
            "cert_type": cert_type,
            "archetypes": archetypes
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/archetypes/{archetype}")
async def get_archetype_details(archetype: str, cert_type: str = "gcp_ace"):
    """
    Get detailed information about a specific archetype

    Args:
        archetype: Archetype identifier
        cert_type: Certification type

    Returns:
        Detailed archetype configuration
    """
    archetypes = template_manager.get_archetypes(cert_type)

    if archetype not in archetypes:
        raise HTTPException(
            status_code=404,
            detail=f"Archetype '{archetype}' not found for cert_type '{cert_type}'"
        )

    return {
        "archetype": archetype,
        "cert_type": cert_type,
        "config": archetypes[archetype]
    }


@router.post("/validate")
async def validate_config(config: ExamTemplateConfig):
    """
    Validate an exam template configuration

    Args:
        config: Template configuration to validate

    Returns:
        Validation result
    """
    is_valid, error_message = template_manager.validate_config(config.dict())

    if not is_valid:
        return {
            "valid": False,
            "error": error_message
        }

    return {
        "valid": True,
        "config": config.dict()
    }


@router.post("/preview")
async def preview_template(request: TemplatePreviewRequest):
    """
    Preview the generated prompt structure without creating questions

    Args:
        request: Template configuration and sample text

    Returns:
        Preview of the prompt that will be used
    """
    # Validate configuration
    is_valid, error_message = template_manager.validate_config(request.config.dict())

    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)

    try:
        # Build the prompt
        prompt = template_manager.build_exam_prompt(
            source_text=request.sample_text,
            config=request.config.dict()
        )

        return {
            "config": request.config.dict(),
            "prompt_preview": prompt[:500] + "..." if len(prompt) > 500 else prompt,
            "full_prompt_length": len(prompt),
            "message": "This is the prompt that will be sent to the AI to generate questions"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build prompt: {str(e)}")


@router.get("/example-config")
async def get_example_config(cert_type: str = "gcp_ace", archetype: Optional[str] = None):
    """
    Get an example configuration for testing

    Args:
        cert_type: Certification type
        archetype: Optional specific archetype

    Returns:
        Example configuration
    """
    try:
        if archetype:
            example = template_manager.get_example_config(cert_type, archetype)
        else:
            example = template_manager.get_example_config(cert_type)

        return {
            "example_config": example,
            "usage": "Use this configuration as a template for generating exam questions"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/distractor-strategies")
async def get_distractor_strategies():
    """
    Get available distractor strategies

    Returns:
        List of distractor strategy options
    """
    return {
        "strategies": [
            {
                "id": "mixed",
                "name": "Mixed (Recommended)",
                "description": "Combination of plausible, conceptually close, and clearly wrong distractors"
            },
            {
                "id": "plausible",
                "name": "Plausible",
                "description": "All wrong answers are technically valid but fail the constraint"
            },
            {
                "id": "conceptual",
                "name": "Conceptually Close",
                "description": "Wrong answers use similar services or commands with subtle differences"
            }
        ]
    }
