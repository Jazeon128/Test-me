"""Manage exam question templates and configurations"""

from typing import Dict, List, Optional
from .prompt_builder import ExamPromptBuilder, get_available_archetypes
from .gcp_ace_archetypes import GCP_ACE_ARCHETYPES, AWS_SAA_ARCHETYPES


class ExamTemplateManager:
    """Manages exam question templates and builds prompts"""

    def __init__(self):
        self.builders = {
            "gcp_ace": ExamPromptBuilder("gcp_ace"),
            "aws_saa": ExamPromptBuilder("aws_saa"),
        }

    def build_exam_prompt(
        self,
        source_text: str,
        config: Dict
    ) -> str:
        """
        Build a complete exam question prompt from configuration

        Args:
            source_text: Source material to generate questions from
            config: Template configuration containing:
                - cert_type: "gcp_ace" or "aws_saa"
                - archetype: Archetype identifier
                - topics: Optional list of topics
                - constraints: Optional constraint string
                - distractor_strategy: Optional distractor strategy

        Returns:
            Complete prompt string

        Raises:
            ValueError: If configuration is invalid
        """
        cert_type = config.get("cert_type", "gcp_ace")
        archetype = config.get("archetype")

        if not archetype:
            raise ValueError("Archetype is required in config")

        if cert_type not in self.builders:
            raise ValueError(f"Unknown certification type: {cert_type}")

        builder = self.builders[cert_type]

        return builder.build_prompt(
            source_text=source_text,
            archetype=archetype,
            topics=config.get("topics"),
            constraints=config.get("constraints"),
            distractor_strategy=config.get("distractor_strategy", "mixed")
        )

    def get_archetypes(self, cert_type: str = "gcp_ace") -> Dict[str, Dict]:
        """
        Get available archetypes for a certification type

        Args:
            cert_type: Certification type ("gcp_ace" or "aws_saa")

        Returns:
            Dictionary of archetype configurations
        """
        return get_available_archetypes(cert_type)

    def get_cert_types(self) -> List[Dict[str, str]]:
        """
        Get available certification types

        Returns:
            List of certification type info
        """
        return [
            {
                "id": "gcp_ace",
                "name": "Google Cloud ACE",
                "full_name": "Google Cloud Certified Associate Cloud Engineer"
            },
            {
                "id": "aws_saa",
                "name": "AWS SAA",
                "full_name": "AWS Certified Solutions Architect - Associate"
            }
        ]

    def validate_config(self, config: Dict) -> tuple[bool, Optional[str]]:
        """
        Validate exam template configuration

        Args:
            config: Template configuration to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        cert_type = config.get("cert_type")
        archetype = config.get("archetype")

        # Check certification type
        if not cert_type:
            return False, "cert_type is required"

        if cert_type not in self.builders:
            return False, f"Invalid cert_type: {cert_type}. Must be one of: {', '.join(self.builders.keys())}"

        # Check archetype
        if not archetype:
            return False, "archetype is required"

        available_archetypes = self.get_archetypes(cert_type)
        if archetype not in available_archetypes:
            return False, f"Invalid archetype: {archetype}. Available: {', '.join(available_archetypes.keys())}"

        # Validate topics if provided
        topics = config.get("topics")
        if topics is not None:
            if not isinstance(topics, list):
                return False, "topics must be a list"
            if not all(isinstance(t, str) for t in topics):
                return False, "all topics must be strings"

        # Validate distractor_strategy if provided
        distractor_strategy = config.get("distractor_strategy")
        if distractor_strategy and distractor_strategy not in ["mixed", "plausible", "conceptual"]:
            return False, "distractor_strategy must be one of: mixed, plausible, conceptual"

        return True, None

    def get_example_config(self, cert_type: str = "gcp_ace", archetype: str = "iam_least_privilege") -> Dict:
        """
        Get an example configuration

        Args:
            cert_type: Certification type
            archetype: Archetype to use

        Returns:
            Example configuration dictionary
        """
        archetypes_config = self.get_archetypes(cert_type)

        if archetype not in archetypes_config:
            # Return first available archetype as fallback
            archetype = list(archetypes_config.keys())[0]

        arch_config = archetypes_config[archetype]

        return {
            "cert_type": cert_type,
            "archetype": archetype,
            "topics": arch_config.get("common_services", [])[:3],
            "constraints": arch_config.get("example_constraints", ["most secure"])[0],
            "distractor_strategy": "mixed"
        }
