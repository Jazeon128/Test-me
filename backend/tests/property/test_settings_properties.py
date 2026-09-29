"""
Property-based tests for settings API
"""
import pytest
from hypothesis import given, strategies as st, settings, HealthCheck


# Strategies for generating test data
@st.composite
def non_empty_string_strategy(draw):
    """Generate non-empty strings (already trimmed to match API behavior)"""
    # Generate strings and trim them to match what the API will store
    text = draw(
        st.text(min_size=1, max_size=200, alphabet=st.characters(blacklist_categories=("Cc", "Cs")))
    )
    trimmed = text.strip()
    # Ensure we have a non-empty string after trimming
    if not trimmed:
        return "a"  # Fallback to a simple non-empty string
    return trimmed


@st.composite
def model_name_strategy(draw):
    """Generate realistic model name strings"""
    # Generate strings that look like model names
    provider_prefixes = ["gpt-", "claude-", "gemini-", "llama-", "mistral-"]
    prefix = draw(st.sampled_from(provider_prefixes))
    version = draw(
        st.text(
            min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=("Ll", "Nd", "Pd"))
        )
    )
    return prefix + version


@st.composite
def ai_config_strategy(draw):
    """Generate valid AI configuration data"""
    provider = draw(st.sampled_from(["anthropic", "openai", "gemini"]))

    # Generate appropriate API key format for provider
    if provider == "anthropic":
        api_key = "sk-ant-" + draw(
            st.text(
                min_size=20,
                max_size=100,
                alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
            )
        )
    elif provider == "openai":
        api_key = "sk-" + draw(
            st.text(
                min_size=20,
                max_size=100,
                alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
            )
        )
    else:  # gemini
        api_key = "AIza" + draw(
            st.text(
                min_size=20,
                max_size=100,
                alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
            )
        )

    # Generate any non-empty model name
    model = draw(non_empty_string_strategy())

    return {"provider": provider, "api_key": api_key, "model": model}


@pytest.mark.property
class TestSettingsAPIProperties:
    """
    Property-based tests for Settings API
    """

    @given(config_data=ai_config_strategy())
    @settings(
        max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_api_accepts_any_non_empty_model_string(self, config_data, client, db_session):
        """
        Feature: custom-model-input, Property 5: API accepts any non-empty model string

        For any non-empty string sent to the Settings API as a model name,
        the API should return a success response without validating against
        the predefined model list.

        Validates: Requirements 4.1
        """
        # Submit configuration with custom model name
        response = client.post("/api/settings/ai-config", json=config_data)

        # Property: API should accept any non-empty model string
        assert (
            response.status_code == 200
        ), f"API rejected model '{config_data['model']}': {response.json()}"

        result = response.json()
        assert result["success"] is True
        assert result["model"] == config_data["model"]
        assert result["provider"] == config_data["provider"]

    @given(config_data=ai_config_strategy())
    @settings(
        max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_custom_model_persistence_round_trip(self, config_data, client, db_session):
        """
        Feature: custom-model-input, Property 3: Custom model persistence round-trip

        For any custom model name, after saving to the database and retrieving
        the configuration, the returned model name should match the original exactly.

        Validates: Requirements 1.4, 1.5, 4.2
        """
        # Save configuration with custom model
        save_response = client.post("/api/settings/ai-config", json=config_data)
        assert save_response.status_code == 200

        # Retrieve configuration
        get_response = client.get("/api/settings/ai-config")
        assert get_response.status_code == 200

        retrieved_config = get_response.json()

        # Property: Retrieved model name should match exactly what was saved
        assert (
            retrieved_config["model"] == config_data["model"]
        ), f"Model name mismatch: saved '{config_data['model']}', retrieved '{retrieved_config['model']}'"

        # Property: Provider should also match
        assert retrieved_config["provider"] == config_data["provider"]

        # Property: API key should be configured
        assert retrieved_config["api_key_configured"] is True

    @given(
        model_name=non_empty_string_strategy(),
        provider=st.sampled_from(["anthropic", "openai", "gemini"]),
    )
    @settings(
        max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_model_name_stored_exactly_as_provided(self, model_name, provider, client, db_session):
        """
        Property: Model names should be stored exactly as provided, with no normalization

        For any model name string, the system should store it exactly as provided,
        preserving case, whitespace (except leading/trailing), and special characters.
        """
        # Generate appropriate API key for provider
        if provider == "anthropic":
            api_key = "sk-ant-test123456789012345678901234567890"
        elif provider == "openai":
            api_key = "sk-test123456789012345678901234567890"
        else:  # gemini
            api_key = "AIzatest123456789012345678901234567890"

        config_data = {"provider": provider, "api_key": api_key, "model": model_name}

        # Save configuration
        save_response = client.post("/api/settings/ai-config", json=config_data)
        assert save_response.status_code == 200

        # Retrieve and verify exact match
        get_response = client.get("/api/settings/ai-config")
        assert get_response.status_code == 200

        retrieved_config = get_response.json()

        # Property: Model name should be stored exactly as provided (trimmed)
        expected_model = model_name.strip()
        assert (
            retrieved_config["model"] == expected_model
        ), f"Model name not stored exactly: expected '{expected_model}', got '{retrieved_config['model']}'"

    @given(configs=st.lists(ai_config_strategy(), min_size=2, max_size=5))
    @settings(
        max_examples=30, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_multiple_model_updates_preserve_latest(self, configs, client, db_session):
        """
        Property: Multiple configuration updates should preserve the latest model

        For any sequence of configuration updates, the system should always
        return the most recently saved model name.
        """
        last_config = None

        for config_data in configs:
            # Save configuration
            response = client.post("/api/settings/ai-config", json=config_data)
            assert response.status_code == 200
            last_config = config_data

        # Retrieve configuration
        get_response = client.get("/api/settings/ai-config")
        assert get_response.status_code == 200

        retrieved_config = get_response.json()

        # Property: Should return the last saved configuration
        assert retrieved_config["model"] == last_config["model"]
        assert retrieved_config["provider"] == last_config["provider"]

    @given(
        model_name=st.text(
            min_size=1, max_size=500, alphabet=st.characters(blacklist_categories=("Cc", "Cs"))
        )
    )
    @settings(
        max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_api_accepts_arbitrary_model_strings(self, model_name, client, db_session):
        """
        Property: API should accept any non-empty string as a model name

        This tests that the API truly accepts ANY non-empty string, including
        strings with special characters, unicode, numbers, etc.
        """
        # Skip empty or whitespace-only strings
        if not model_name.strip():
            return

        # Use a valid provider and API key
        config_data = {
            "provider": "openai",
            "api_key": "sk-test123456789012345678901234567890",
            "model": model_name,
        }

        # Submit configuration
        response = client.post("/api/settings/ai-config", json=config_data)

        # Property: Should accept any non-empty string
        assert (
            response.status_code == 200
        ), f"API rejected model name: {model_name[:50]}... Status: {response.status_code}"

        result = response.json()
        assert result["success"] is True

    @given(config_data=ai_config_strategy())
    @settings(
        max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_api_returns_stored_custom_models(self, config_data, client, db_session):
        """
        Feature: custom-model-input, Property 6: API returns stored custom models

        For any model name stored in the database (custom or predefined),
        when the Settings API returns configuration, it should include that
        model name.

        Validates: Requirements 4.3
        """
        # Save configuration with any model name
        save_response = client.post("/api/settings/ai-config", json=config_data)
        assert save_response.status_code == 200

        # Retrieve configuration
        get_response = client.get("/api/settings/ai-config")
        assert get_response.status_code == 200

        retrieved_config = get_response.json()

        # Property: API should return the stored model name
        assert (
            retrieved_config["model"] == config_data["model"]
        ), f"API did not return stored model: expected '{config_data['model']}', got '{retrieved_config['model']}'"

        # Property: API should include is_custom_model flag
        assert (
            "is_custom_model" in retrieved_config
        ), "API response should include is_custom_model flag"

        # Property: is_custom_model should be correctly set based on whether model is in AVAILABLE_MODELS
        from app.api.settings import AVAILABLE_MODELS

        predefined_model_ids = [m.id for m in AVAILABLE_MODELS]
        expected_is_custom = config_data["model"] not in predefined_model_ids

        assert (
            retrieved_config["is_custom_model"] == expected_is_custom
        ), f"is_custom_model flag incorrect: expected {expected_is_custom}, got {retrieved_config['is_custom_model']}"
