"""
Unit tests for metrics pricing updates

These tests verify that the new Gemini models have correct pricing
and that deprecated models have been removed.
"""

import pytest
from app.utils.metrics import estimate_cost


class TestGeminiPricingUpdates:
    """Test suite for Gemini model pricing updates"""

    def test_gemini_3_pro_preview_pricing(self):
        """Test that gemini-3-pro-preview has correct pricing (free during preview)"""
        cost = estimate_cost("gemini", "gemini-3-pro-preview", 1_000_000, 1_000_000)
        assert cost == 0.0, "Gemini 3 Pro Preview should be free during preview"

    def test_gemini_2_5_flash_pricing(self):
        """Test that gemini-2.5-flash has correct pricing (free during preview)"""
        cost = estimate_cost("gemini", "gemini-2.5-flash", 1_000_000, 1_000_000)
        assert cost == 0.0, "Gemini 2.5 Flash should be free during preview"

    def test_gemini_2_5_flash_lite_pricing(self):
        """Test that gemini-2.5-flash-lite has correct pricing (free during preview)"""
        cost = estimate_cost("gemini", "gemini-2.5-flash-lite", 1_000_000, 1_000_000)
        assert cost == 0.0, "Gemini 2.5 Flash-Lite should be free during preview"

    def test_gemini_2_5_pro_pricing(self):
        """Test that gemini-2.5-pro has correct pricing (free during preview)"""
        cost = estimate_cost("gemini", "gemini-2.5-pro", 1_000_000, 1_000_000)
        assert cost == 0.0, "Gemini 2.5 Pro should be free during preview"


class TestDeprecatedModelsRemoved:
    """Test suite to verify deprecated models are removed"""

    def test_gemini_2_0_flash_exp_removed(self):
        """Test that gemini-2.0-flash-exp uses fallback pricing (not in pricing dict)"""
        # Deprecated models should fall back to default pricing
        cost = estimate_cost("gemini", "gemini-2.0-flash-exp", 1_000_000, 1_000_000)
        # Default fallback is 1.0 input + 3.0 output = 4.0 per million tokens
        assert cost == 4.0, "Deprecated model should use fallback pricing"

    def test_gemini_exp_1206_removed(self):
        """Test that gemini-exp-1206 uses fallback pricing (not in pricing dict)"""
        cost = estimate_cost("gemini", "gemini-exp-1206", 1_000_000, 1_000_000)
        assert cost == 4.0, "Deprecated model should use fallback pricing"

    def test_gemini_2_0_flash_thinking_exp_removed(self):
        """Test that gemini-2.0-flash-thinking-exp-01-21 uses fallback pricing"""
        cost = estimate_cost("gemini", "gemini-2.0-flash-thinking-exp-01-21", 1_000_000, 1_000_000)
        assert cost == 4.0, "Deprecated model should use fallback pricing"

    def test_gemini_1_5_pro_002_removed(self):
        """Test that gemini-1.5-pro-002 uses fallback pricing (not in pricing dict)"""
        cost = estimate_cost("gemini", "gemini-1.5-pro-002", 1_000_000, 1_000_000)
        assert cost == 4.0, "Deprecated model should use fallback pricing"

    def test_gemini_1_5_flash_002_removed(self):
        """Test that gemini-1.5-flash-002 uses fallback pricing (not in pricing dict)"""
        cost = estimate_cost("gemini", "gemini-1.5-flash-002", 1_000_000, 1_000_000)
        assert cost == 4.0, "Deprecated model should use fallback pricing"

    def test_gemini_1_5_flash_8b_removed(self):
        """Test that gemini-1.5-flash-8b uses fallback pricing (not in pricing dict)"""
        cost = estimate_cost("gemini", "gemini-1.5-flash-8b", 1_000_000, 1_000_000)
        assert cost == 4.0, "Deprecated model should use fallback pricing"

    def test_gemini_1_5_pro_removed(self):
        """Test that gemini-1.5-pro uses fallback pricing (not in pricing dict)"""
        cost = estimate_cost("gemini", "gemini-1.5-pro", 1_000_000, 1_000_000)
        assert cost == 4.0, "Deprecated model should use fallback pricing"

    def test_gemini_1_5_flash_removed(self):
        """Test that gemini-1.5-flash uses fallback pricing (not in pricing dict)"""
        cost = estimate_cost("gemini", "gemini-1.5-flash", 1_000_000, 1_000_000)
        assert cost == 4.0, "Deprecated model should use fallback pricing"


class TestExistingModelsPricing:
    """Test suite to verify existing models still have correct pricing"""

    def test_claude_3_5_sonnet_pricing(self):
        """Test that Claude 3.5 Sonnet pricing is correct"""
        cost = estimate_cost("anthropic", "claude-3-5-sonnet-20241022", 1_000_000, 1_000_000)
        expected = 3.0 + 15.0  # $3 input + $15 output per MTok
        assert cost == expected, f"Claude 3.5 Sonnet should cost ${expected} per MTok"

    def test_gpt_4o_pricing(self):
        """Test that GPT-4o pricing is correct"""
        cost = estimate_cost("openai", "gpt-4o", 1_000_000, 1_000_000)
        expected = 2.5 + 10.0  # $2.5 input + $10 output per MTok
        assert cost == expected, f"GPT-4o should cost ${expected} per MTok"


class TestCostCalculation:
    """Test suite for cost calculation logic"""

    def test_zero_tokens_zero_cost(self):
        """Test that zero tokens result in zero cost"""
        cost = estimate_cost("gemini", "gemini-2.5-flash", 0, 0)
        assert cost == 0.0, "Zero tokens should result in zero cost"

    def test_cost_scales_with_tokens(self):
        """Test that cost scales linearly with token count"""
        # Use a model with non-zero pricing
        cost_1m = estimate_cost("anthropic", "claude-3-5-sonnet-20241022", 1_000_000, 1_000_000)
        cost_2m = estimate_cost("anthropic", "claude-3-5-sonnet-20241022", 2_000_000, 2_000_000)

        assert (
            abs(cost_2m - (cost_1m * 2)) < 0.000001
        ), "Cost should scale linearly with token count"

    def test_input_and_output_tokens_separate(self):
        """Test that input and output tokens are priced separately"""
        # Use Claude 3.5 Sonnet: $3 input, $15 output
        cost_input_only = estimate_cost("anthropic", "claude-3-5-sonnet-20241022", 1_000_000, 0)
        cost_output_only = estimate_cost("anthropic", "claude-3-5-sonnet-20241022", 0, 1_000_000)
        cost_both = estimate_cost("anthropic", "claude-3-5-sonnet-20241022", 1_000_000, 1_000_000)

        assert cost_input_only == 3.0, "Input only should cost $3"
        assert cost_output_only == 15.0, "Output only should cost $15"
        assert cost_both == 18.0, "Both should cost $18"

    def test_unknown_model_uses_fallback(self):
        """Test that unknown models use fallback pricing"""
        cost = estimate_cost("gemini", "unknown-model-xyz", 1_000_000, 1_000_000)
        expected = 1.0 + 3.0  # Default fallback: $1 input + $3 output
        assert cost == expected, f"Unknown model should use fallback pricing of ${expected}"

    def test_unknown_provider_uses_fallback(self):
        """Test that unknown providers use fallback pricing"""
        cost = estimate_cost("unknown-provider", "some-model", 1_000_000, 1_000_000)
        expected = 1.0 + 3.0  # Default fallback
        assert cost == expected, f"Unknown provider should use fallback pricing of ${expected}"
