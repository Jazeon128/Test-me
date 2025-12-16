"""Unit tests for AI model list in settings"""
import pytest
from app.api.settings import AVAILABLE_MODELS


class TestGeminiModelList:
    """Test that Gemini model list is updated correctly"""

    def test_new_gemini_models_present(self):
        """Test that new Gemini models are present in AVAILABLE_MODELS"""
        gemini_models = [m for m in AVAILABLE_MODELS if m.provider == "gemini"]
        gemini_model_ids = [m.id for m in gemini_models]

        # Check for new Gemini 3.0 model
        assert "gemini-3-pro-preview" in gemini_model_ids, "Gemini 3 Pro Preview should be in model list"

        # Check for new Gemini 2.5 models
        assert "gemini-2.5-flash" in gemini_model_ids, "Gemini 2.5 Flash should be in model list"
        assert "gemini-2.5-flash-lite" in gemini_model_ids, "Gemini 2.5 Flash-Lite should be in model list"
        assert "gemini-2.5-pro" in gemini_model_ids, "Gemini 2.5 Pro should be in model list"

    def test_old_gemini_models_removed(self):
        """Test that old Gemini models are removed from AVAILABLE_MODELS"""
        gemini_models = [m for m in AVAILABLE_MODELS if m.provider == "gemini"]
        gemini_model_ids = [m.id for m in gemini_models]

        # Check that old models are removed
        assert "gemini-2.0-flash-exp" not in gemini_model_ids, "Gemini 2.0 Flash Exp should be removed"
        assert "gemini-exp-1206" not in gemini_model_ids, "Gemini Experimental 1206 should be removed"
        assert "gemini-2.0-flash-thinking-exp-01-21" not in gemini_model_ids, "Gemini 2.0 Flash Thinking should be removed"
        assert "gemini-1.5-pro-002" not in gemini_model_ids, "Gemini 1.5 Pro should be removed"
        assert "gemini-1.5-flash-002" not in gemini_model_ids, "Gemini 1.5 Flash should be removed"
        assert "gemini-1.5-flash-8b" not in gemini_model_ids, "Gemini 1.5 Flash-8B should be removed"

    def test_gemini_model_metadata_correct(self):
        """Test that Gemini model metadata is correct"""
        gemini_models = {m.id: m for m in AVAILABLE_MODELS if m.provider == "gemini"}

        # Test Gemini 3 Pro Preview metadata
        if "gemini-3-pro-preview" in gemini_models:
            model = gemini_models["gemini-3-pro-preview"]
            assert model.name == "Gemini 3 Pro Preview"
            assert model.provider == "gemini"
            assert model.context_window == 1048576
            assert model.input_price == 0.00
            assert model.output_price == 0.00
            assert "multimodal" in model.description.lower() or "agentic" in model.description.lower()

        # Test Gemini 2.5 Flash metadata
        if "gemini-2.5-flash" in gemini_models:
            model = gemini_models["gemini-2.5-flash"]
            assert model.name == "Gemini 2.5 Flash"
            assert model.provider == "gemini"
            assert model.context_window == 1048576
            assert model.input_price == 0.00
            assert model.output_price == 0.00
            assert "fast" in model.description.lower() or "thinking" in model.description.lower()

        # Test Gemini 2.5 Flash-Lite metadata
        if "gemini-2.5-flash-lite" in gemini_models:
            model = gemini_models["gemini-2.5-flash-lite"]
            assert model.name == "Gemini 2.5 Flash-Lite"
            assert model.provider == "gemini"
            assert model.context_window == 1048576
            assert model.input_price == 0.00
            assert model.output_price == 0.00
            assert "fast" in model.description.lower() or "cost" in model.description.lower()

        # Test Gemini 2.5 Pro metadata
        if "gemini-2.5-pro" in gemini_models:
            model = gemini_models["gemini-2.5-pro"]
            assert model.name == "Gemini 2.5 Pro"
            assert model.provider == "gemini"
            assert model.context_window == 1048576
            assert model.input_price == 0.00
            assert model.output_price == 0.00
            assert "thinking" in model.description.lower() or "reasoning" in model.description.lower()


class TestModelListStructure:
    """Test overall model list structure"""

    def test_all_models_have_required_fields(self):
        """Test that all models have required fields"""
        for model in AVAILABLE_MODELS:
            assert model.id, f"Model {model.name} missing id"
            assert model.name, f"Model {model.id} missing name"
            assert model.provider in ["anthropic", "openai", "gemini"], f"Model {model.id} has invalid provider"
            assert model.context_window > 0, f"Model {model.id} has invalid context_window"
            assert model.input_price >= 0, f"Model {model.id} has negative input_price"
            assert model.output_price >= 0, f"Model {model.id} has negative output_price"

    def test_model_ids_are_unique(self):
        """Test that all model IDs are unique"""
        model_ids = [m.id for m in AVAILABLE_MODELS]
        assert len(model_ids) == len(set(model_ids)), "Model IDs should be unique"

    def test_all_providers_represented(self):
        """Test that all three providers have models"""
        providers = {m.provider for m in AVAILABLE_MODELS}
        assert "anthropic" in providers, "Anthropic models should be present"
        assert "openai" in providers, "OpenAI models should be present"
        assert "gemini" in providers, "Gemini models should be present"

    def test_gemini_has_correct_count(self):
        """Test that Gemini has exactly 4 models (the new ones)"""
        gemini_models = [m for m in AVAILABLE_MODELS if m.provider == "gemini"]
        assert len(gemini_models) == 4, f"Expected 4 Gemini models, found {len(gemini_models)}"


class TestCustomModelDetection:
    """Test custom model detection logic"""

    def test_detection_returns_true_for_custom_models(self, client, db_session):
        """Test detection returns true for custom models"""
        # Save a custom model that's not in AVAILABLE_MODELS
        custom_model = "my-custom-model-v1"
        config_data = {
            "provider": "openai",
            "api_key": "sk-test123456789012345678901234567890",
            "model": custom_model
        }
        
        # Save configuration
        save_response = client.post("/api/settings/ai-config", json=config_data)
        assert save_response.status_code == 200
        
        # Get configuration and check is_custom_model flag
        get_response = client.get("/api/settings/ai-config")
        assert get_response.status_code == 200
        
        result = get_response.json()
        assert result["is_custom_model"] is True, "Custom model should be detected as custom"
        assert result["model"] == custom_model

    def test_detection_returns_false_for_predefined_models(self, client, db_session):
        """Test detection returns false for predefined models"""
        # Use a predefined model from AVAILABLE_MODELS
        predefined_model = "gpt-4o"  # This is in AVAILABLE_MODELS
        config_data = {
            "provider": "openai",
            "api_key": "sk-test123456789012345678901234567890",
            "model": predefined_model
        }
        
        # Save configuration
        save_response = client.post("/api/settings/ai-config", json=config_data)
        assert save_response.status_code == 200
        
        # Get configuration and check is_custom_model flag
        get_response = client.get("/api/settings/ai-config")
        assert get_response.status_code == 200
        
        result = get_response.json()
        assert result["is_custom_model"] is False, "Predefined model should not be detected as custom"
        assert result["model"] == predefined_model

    def test_detection_with_empty_string(self, client, db_session):
        """Test edge case: empty string model"""
        # Try to save with empty model
        config_data = {
            "provider": "openai",
            "api_key": "sk-test123456789012345678901234567890",
            "model": ""
        }
        
        # Empty string is falsy, so it won't be validated or stored
        # The API should succeed but not store the model
        save_response = client.post("/api/settings/ai-config", json=config_data)
        assert save_response.status_code == 200
        
        # Get configuration and verify model is None (not stored)
        get_response = client.get("/api/settings/ai-config")
        assert get_response.status_code == 200
        
        result = get_response.json()
        # Empty string should not be stored, so model should be None
        assert result["model"] is None
        assert result["is_custom_model"] is False

    def test_detection_with_whitespace_only(self, client, db_session):
        """Test edge case: whitespace-only model"""
        # Try to save with whitespace-only model (should be rejected)
        config_data = {
            "provider": "openai",
            "api_key": "sk-test123456789012345678901234567890",
            "model": "   "
        }
        
        # This should be rejected by validation
        save_response = client.post("/api/settings/ai-config", json=config_data)
        assert save_response.status_code == 400, "Whitespace-only model should be rejected"

    def test_detection_with_none_model(self, client, db_session):
        """Test edge case: None model"""
        # Save configuration without model field
        config_data = {
            "provider": "openai",
            "api_key": "sk-test123456789012345678901234567890"
            # No model field
        }
        
        # Save configuration
        save_response = client.post("/api/settings/ai-config", json=config_data)
        assert save_response.status_code == 200
        
        # Get configuration and check is_custom_model flag
        get_response = client.get("/api/settings/ai-config")
        assert get_response.status_code == 200
        
        result = get_response.json()
        # When model is None, is_custom_model should be False
        assert result["is_custom_model"] is False, "None model should not be detected as custom"
        assert result["model"] is None

    def test_detection_with_all_predefined_models(self, client, db_session):
        """Test that all predefined models are correctly identified as non-custom"""
        for model in AVAILABLE_MODELS:
            # Generate appropriate API key for provider
            if model.provider == "anthropic":
                api_key = "sk-ant-test123456789012345678901234567890"
            elif model.provider == "openai":
                api_key = "sk-test123456789012345678901234567890"
            else:  # gemini
                api_key = "AIzatest123456789012345678901234567890"
            
            config_data = {
                "provider": model.provider,
                "api_key": api_key,
                "model": model.id
            }
            
            # Save configuration
            save_response = client.post("/api/settings/ai-config", json=config_data)
            assert save_response.status_code == 200
            
            # Get configuration and verify it's not detected as custom
            get_response = client.get("/api/settings/ai-config")
            assert get_response.status_code == 200
            
            result = get_response.json()
            assert result["is_custom_model"] is False, \
                f"Predefined model {model.id} should not be detected as custom"
            assert result["model"] == model.id
