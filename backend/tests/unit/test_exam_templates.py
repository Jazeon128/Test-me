"""Unit tests for exam template system"""
import pytest

from app.services.exam_templates.template_manager import ExamTemplateManager
from app.services.exam_templates.prompt_builder import ExamPromptBuilder, get_available_archetypes


@pytest.mark.unit
class TestExamTemplateManager:
    """Tests for ExamTemplateManager"""

    def test_initialization(self):
        """Test manager initializes with correct builders"""
        manager = ExamTemplateManager()
        assert "gcp_ace" in manager.builders
        assert "aws_saa" in manager.builders
        assert isinstance(manager.builders["gcp_ace"], ExamPromptBuilder)

    def test_get_cert_types(self):
        """Test retrieving available certification types"""
        manager = ExamTemplateManager()
        cert_types = manager.get_cert_types()

        assert len(cert_types) >= 2
        assert any(ct["id"] == "gcp_ace" for ct in cert_types)
        assert any(ct["id"] == "aws_saa" for ct in cert_types)

        # Check structure
        for ct in cert_types:
            assert "id" in ct
            assert "name" in ct
            assert "full_name" in ct

    def test_get_archetypes_gcp(self):
        """Test retrieving GCP ACE archetypes"""
        manager = ExamTemplateManager()
        archetypes = manager.get_archetypes("gcp_ace")

        assert isinstance(archetypes, dict)
        assert len(archetypes) > 0

        # Check archetype structure
        for arch_id, arch_config in archetypes.items():
            assert "name" in arch_config
            assert "description" in arch_config

    def test_get_archetypes_aws(self):
        """Test retrieving AWS SAA archetypes"""
        manager = ExamTemplateManager()
        archetypes = manager.get_archetypes("aws_saa")

        assert isinstance(archetypes, dict)
        assert len(archetypes) > 0

    def test_validate_config_valid(self):
        """Test validating a valid configuration"""
        manager = ExamTemplateManager()
        archetypes = manager.get_archetypes("gcp_ace")
        first_archetype = list(archetypes.keys())[0]

        config = {
            "cert_type": "gcp_ace",
            "archetype": first_archetype,
            "topics": ["IAM", "Storage"],
            "distractor_strategy": "mixed"
        }

        is_valid, error = manager.validate_config(config)
        assert is_valid is True
        assert error is None

    def test_validate_config_missing_cert_type(self):
        """Test validation fails when cert_type is missing"""
        manager = ExamTemplateManager()
        config = {"archetype": "some_archetype"}

        is_valid, error = manager.validate_config(config)
        assert is_valid is False
        assert "cert_type is required" in error

    def test_validate_config_invalid_cert_type(self):
        """Test validation fails for invalid cert_type"""
        manager = ExamTemplateManager()
        config = {
            "cert_type": "invalid_cert",
            "archetype": "some_archetype"
        }

        is_valid, error = manager.validate_config(config)
        assert is_valid is False
        assert "Invalid cert_type" in error

    def test_validate_config_missing_archetype(self):
        """Test validation fails when archetype is missing"""
        manager = ExamTemplateManager()
        config = {"cert_type": "gcp_ace"}

        is_valid, error = manager.validate_config(config)
        assert is_valid is False
        assert "archetype is required" in error

    def test_validate_config_invalid_archetype(self):
        """Test validation fails for invalid archetype"""
        manager = ExamTemplateManager()
        config = {
            "cert_type": "gcp_ace",
            "archetype": "nonexistent_archetype"
        }

        is_valid, error = manager.validate_config(config)
        assert is_valid is False
        assert "Invalid archetype" in error

    def test_validate_config_topics_not_list(self):
        """Test validation fails when topics is not a list"""
        manager = ExamTemplateManager()
        archetypes = manager.get_archetypes("gcp_ace")
        first_archetype = list(archetypes.keys())[0]

        config = {
            "cert_type": "gcp_ace",
            "archetype": first_archetype,
            "topics": "not a list"
        }

        is_valid, error = manager.validate_config(config)
        assert is_valid is False
        assert "topics must be a list" in error

    def test_validate_config_topics_non_string_items(self):
        """Test validation fails when topics contains non-strings"""
        manager = ExamTemplateManager()
        archetypes = manager.get_archetypes("gcp_ace")
        first_archetype = list(archetypes.keys())[0]

        config = {
            "cert_type": "gcp_ace",
            "archetype": first_archetype,
            "topics": ["IAM", 123, "Storage"]
        }

        is_valid, error = manager.validate_config(config)
        assert is_valid is False
        assert "all topics must be strings" in error

    def test_validate_config_invalid_distractor_strategy(self):
        """Test validation fails for invalid distractor strategy"""
        manager = ExamTemplateManager()
        archetypes = manager.get_archetypes("gcp_ace")
        first_archetype = list(archetypes.keys())[0]

        config = {
            "cert_type": "gcp_ace",
            "archetype": first_archetype,
            "distractor_strategy": "invalid_strategy"
        }

        is_valid, error = manager.validate_config(config)
        assert is_valid is False
        assert "distractor_strategy must be one of" in error

    def test_build_exam_prompt_success(self):
        """Test building exam prompt with valid config"""
        manager = ExamTemplateManager()
        archetypes = manager.get_archetypes("gcp_ace")
        first_archetype = list(archetypes.keys())[0]

        config = {
            "cert_type": "gcp_ace",
            "archetype": first_archetype,
            "topics": ["Cloud Storage"],
            "constraints": "most cost-effective",
            "distractor_strategy": "mixed"
        }

        source_text = "Cloud Storage is an object storage service..."
        prompt = manager.build_exam_prompt(source_text, config)

        assert isinstance(prompt, str)
        assert len(prompt) > 100
        assert source_text in prompt
        assert "Cloud Storage" in prompt
        assert "most cost-effective" in prompt

    def test_build_exam_prompt_missing_archetype(self):
        """Test building prompt fails without archetype"""
        manager = ExamTemplateManager()
        config = {"cert_type": "gcp_ace"}

        with pytest.raises(ValueError, match="Archetype is required"):
            manager.build_exam_prompt("test text", config)

    def test_build_exam_prompt_invalid_cert_type(self):
        """Test building prompt fails with invalid cert_type"""
        manager = ExamTemplateManager()
        config = {
            "cert_type": "invalid_cert",
            "archetype": "some_archetype"
        }

        with pytest.raises(ValueError, match="Unknown certification type"):
            manager.build_exam_prompt("test text", config)

    def test_get_example_config_default(self):
        """Test getting default example configuration"""
        manager = ExamTemplateManager()
        example = manager.get_example_config()

        assert "cert_type" in example
        assert "archetype" in example
        assert "topics" in example
        assert "constraints" in example
        assert "distractor_strategy" in example
        assert example["cert_type"] == "gcp_ace"

    def test_get_example_config_specific_archetype(self):
        """Test getting example config for specific archetype"""
        manager = ExamTemplateManager()
        archetypes = manager.get_archetypes("gcp_ace")
        archetype_id = list(archetypes.keys())[0]

        example = manager.get_example_config("gcp_ace", archetype_id)

        assert example["cert_type"] == "gcp_ace"
        assert example["archetype"] == archetype_id
        assert isinstance(example["topics"], list)

    def test_get_example_config_aws(self):
        """Test getting AWS example configuration"""
        manager = ExamTemplateManager()
        example = manager.get_example_config("aws_saa")

        assert example["cert_type"] == "aws_saa"


@pytest.mark.unit
class TestExamPromptBuilder:
    """Tests for ExamPromptBuilder"""

    def test_initialization_gcp(self):
        """Test initializing builder for GCP"""
        builder = ExamPromptBuilder("gcp_ace")
        assert "Google Cloud" in builder.cert_name
        assert len(builder.archetypes) > 0

    def test_initialization_aws(self):
        """Test initializing builder for AWS"""
        builder = ExamPromptBuilder("aws_saa")
        assert "AWS" in builder.cert_name
        assert len(builder.archetypes) > 0

    def test_initialization_invalid_cert_type(self):
        """Test initialization fails with invalid cert type"""
        with pytest.raises(ValueError, match="Unknown certification type"):
            ExamPromptBuilder("invalid_cert")

    def test_build_prompt_with_archetype(self):
        """Test building prompt with specific archetype"""
        builder = ExamPromptBuilder("gcp_ace")
        archetype = list(builder.archetypes.keys())[0]

        prompt = builder.build_prompt(
            source_text="Sample text about cloud storage",
            archetype=archetype,
            topics=["Cloud Storage", "IAM"],
            constraints="most secure",
            distractor_strategy="mixed"
        )

        assert isinstance(prompt, str)
        assert len(prompt) > 500
        assert "Sample text about cloud storage" in prompt
        assert "Cloud Storage" in prompt
        assert "IAM" in prompt
        assert "most secure" in prompt
        assert "JSON" in prompt  # Should include output format

    def test_build_prompt_invalid_archetype(self):
        """Test building prompt with invalid archetype raises error"""
        builder = ExamPromptBuilder("gcp_ace")

        with pytest.raises(ValueError, match="Unknown archetype"):
            builder.build_prompt(
                source_text="test",
                archetype="nonexistent_archetype"
            )

    def test_build_prompt_generic_no_archetype(self):
        """Test building generic prompt without archetype"""
        builder = ExamPromptBuilder("gcp_ace")

        prompt = builder.build_prompt(
            source_text="Cloud computing fundamentals",
            archetype=None
        )

        assert isinstance(prompt, str)
        assert "Cloud computing fundamentals" in prompt
        assert "Google Cloud" in builder.cert_name

    def test_build_prompt_with_topics_only(self):
        """Test building prompt with just topics"""
        builder = ExamPromptBuilder("gcp_ace")

        prompt = builder.build_prompt(
            source_text="test material",
            archetype=None,
            topics=["Compute Engine", "Cloud Functions"]
        )

        assert "Compute Engine" in prompt
        assert "Cloud Functions" in prompt

    def test_build_prompt_with_constraints_only(self):
        """Test building prompt with just constraints"""
        builder = ExamPromptBuilder("gcp_ace")

        prompt = builder.build_prompt(
            source_text="test material",
            archetype=None,
            constraints="highest availability"
        )

        assert "highest availability" in prompt

    def test_build_prompt_distractor_strategies(self):
        """Test all distractor strategies"""
        builder = ExamPromptBuilder("gcp_ace")
        archetype = list(builder.archetypes.keys())[0]

        for strategy in ["mixed", "plausible", "conceptual"]:
            prompt = builder.build_prompt(
                source_text="test",
                archetype=archetype,
                distractor_strategy=strategy
            )
            assert isinstance(prompt, str)
            assert len(prompt) > 100

    def test_format_list(self):
        """Test list formatting helper"""
        builder = ExamPromptBuilder("gcp_ace")
        items = ["Item 1", "Item 2", "Item 3"]

        result = builder._format_list(items)
        assert "- Item 1" in result
        assert "- Item 2" in result
        assert "- Item 3" in result

    def test_format_topics_with_user_topics(self):
        """Test topic formatting with user-specified topics"""
        builder = ExamPromptBuilder("gcp_ace")
        archetype = list(builder.archetypes.keys())[0]
        arch_config = builder.archetypes[archetype]

        result = builder._format_topics(
            user_topics=["Custom Topic 1", "Custom Topic 2"],
            common_services=arch_config.get("common_services", [])
        )

        assert "Custom Topic 1" in result
        assert "Custom Topic 2" in result

    def test_format_topics_default_services(self):
        """Test topic formatting with default services"""
        builder = ExamPromptBuilder("gcp_ace")
        archetype = list(builder.archetypes.keys())[0]
        arch_config = builder.archetypes[archetype]

        result = builder._format_topics(
            user_topics=None,
            common_services=arch_config.get("common_services", [])
        )

        assert "Focus on these common services" in result

    def test_format_constraints_with_user_constraint(self):
        """Test constraint formatting with user constraint"""
        builder = ExamPromptBuilder("gcp_ace")

        result = builder._format_constraints(
            user_constraint="least expensive",
            example_constraints=["most secure", "highest availability"]
        )

        assert "least expensive" in result
        assert "CRITICAL" in result

    def test_format_constraints_examples_only(self):
        """Test constraint formatting with examples only"""
        builder = ExamPromptBuilder("gcp_ace")

        result = builder._format_constraints(
            user_constraint=None,
            example_constraints=["most secure", "highest availability"]
        )

        assert "Include one of these constraint types" in result

    def test_format_distractor_strategy_plausible(self):
        """Test distractor strategy formatting for plausible"""
        builder = ExamPromptBuilder("gcp_ace")

        result = builder._format_distractor_strategy(
            strategy="plausible",
            distractor_focus=["Similar services", "Wrong syntax"]
        )

        assert "highly plausible" in result

    def test_format_distractor_strategy_conceptual(self):
        """Test distractor strategy formatting for conceptual"""
        builder = ExamPromptBuilder("gcp_ace")

        result = builder._format_distractor_strategy(
            strategy="conceptual",
            distractor_focus=["Similar services"]
        )

        assert "conceptually similar" in result

    def test_format_distractor_strategy_mixed(self):
        """Test distractor strategy formatting for mixed"""
        builder = ExamPromptBuilder("gcp_ace")

        result = builder._format_distractor_strategy(
            strategy="mixed",
            distractor_focus=["Various types"]
        )

        assert "mix of distractor types" in result


@pytest.mark.unit
class TestArchetypeRetrieval:
    """Tests for archetype retrieval functions"""

    def test_get_available_archetypes_gcp(self):
        """Test getting GCP archetypes"""
        archetypes = get_available_archetypes("gcp_ace")
        assert isinstance(archetypes, dict)
        assert len(archetypes) > 0

    def test_get_available_archetypes_aws(self):
        """Test getting AWS archetypes"""
        archetypes = get_available_archetypes("aws_saa")
        assert isinstance(archetypes, dict)
        assert len(archetypes) > 0

    def test_get_available_archetypes_invalid(self):
        """Test getting archetypes for invalid cert type"""
        archetypes = get_available_archetypes("invalid")
        assert archetypes == {}
