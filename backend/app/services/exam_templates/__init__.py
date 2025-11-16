"""Exam template service for generating professional certification-style questions"""

from .template_manager import ExamTemplateManager
from .gcp_ace_archetypes import GCP_ACE_ARCHETYPES, AWS_SAA_ARCHETYPES

__all__ = [
    "ExamTemplateManager",
    "GCP_ACE_ARCHETYPES",
    "AWS_SAA_ARCHETYPES",
]
