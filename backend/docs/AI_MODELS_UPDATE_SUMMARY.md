# AI Models Update Summary

**Last Updated:** 2024-12-05

## What Was Updated

### 1. Updated Model List (`backend/app/api/settings.py`)

#### New Anthropic Models
- **Claude 3.5 Haiku** (`claude-3-5-haiku-20241022`) - $0.80/$4.00 per MTok
  - Faster than previous Haiku with improved intelligence

#### Updated OpenAI Models
- **GPT-4o** - Price corrected to $2.50/$10.00 per MTok (was $5.00/$15.00)
- **GPT-4 Turbo** - Added to list

#### New Gemini Models
- **Gemini 2.0 Flash Experimental** (`gemini-2.0-flash-exp`) - FREE during preview
  - Latest experimental model, multimodal, extremely fast
  - 1M context window

- **Gemini Experimental 1206** (`gemini-exp-1206`) - FREE during preview
  - Enhanced reasoning experimental model
  - 2M context window

- **Gemini 2.0 Flash Thinking** (`gemini-2.0-flash-thinking-exp-01-21`) - FREE during preview
  - Experimental model with extended thinking/reasoning
  - 32K context window

- **Gemini 1.5 Pro (002)** (`gemini-1.5-pro-002`) - $1.25/$5.00 per MTok
  - Stable production model
  - Massive 2M context window

- **Gemini 1.5 Flash (002)** (`gemini-1.5-flash-002`) - $0.075/$0.30 per MTok
  - Fast and cost-effective production model
  - 1M context window

- **Gemini 1.5 Flash-8B** (`gemini-1.5-flash-8b`) - $0.0375/$0.15 per MTok
  - Smallest, fastest, most cost-effective model
  - 1M context window

### 2. New API Endpoints

#### `POST /api/settings/ai-config/models/refresh`
Manually trigger a model list refresh. Returns:
- Current model count
- Models by provider
- Instructions for updating
- Documentation links

**Example Response:**
```json
{
  "success": true,
  "message": "Model list refresh instructions provided",
  "current_models_count": 13,
  "last_updated": "2024-12-05",
  "models_by_provider": {
    "anthropic": 3,
    "openai": 3,
    "gemini": 6
  },
  "instructions": {
    "step_1": "Check provider documentation for latest models",
    "step_2": "Update AVAILABLE_MODELS in backend/app/api/settings.py",
    "step_3": "Update last_updated comment",
    "step_4": "Restart backend server",
    "documentation_links": {
      "anthropic": "https://www.anthropic.com/api",
      "openai": "https://openai.com/api/pricing/",
      "gemini": "https://ai.google.dev/pricing"
    }
  }
}
```

#### `GET /api/settings/ai-config/models/info`
Get detailed information about the current models list:
- Last update date
- Total model count
- Models grouped by provider
- Full model details

### 3. Updated Pricing (`backend/app/utils/metrics.py`)

All pricing information has been updated to reflect current rates as of 2024-12-05:

**Anthropic:**
- Claude 3.5 Sonnet: $3/$15 per MTok
- Claude 3.5 Haiku: $0.80/$4 per MTok (NEW)
- Claude 3 Haiku: $0.25/$1.25 per MTok

**OpenAI:**
- GPT-4o: $2.50/$10 per MTok (corrected)
- GPT-4o Mini: $0.15/$0.60 per MTok
- GPT-4 Turbo: $10/$30 per MTok

**Gemini:**
- Experimental models: FREE during preview
- Gemini 1.5 Pro (002): $1.25/$5 per MTok
- Gemini 1.5 Flash (002): $0.075/$0.30 per MTok
- Gemini 1.5 Flash-8B: $0.0375/$0.15 per MTok

## How to Use

### Testing the New Models

1. **Start your backend:**
   ```bash
   cd backend
   python main.py
   ```

2. **Check available models:**
   ```bash
   curl http://localhost:8000/api/settings/ai-config/models
   ```

3. **Get model info:**
   ```bash
   curl http://localhost:8000/api/settings/ai-config/models/info
   ```

4. **Trigger refresh (returns instructions):**
   ```bash
   curl -X POST http://localhost:8000/api/settings/ai-config/models/refresh
   ```

### Using New Models

Update your `.env` file to use a new model:

```bash
# Use Gemini 2.0 Flash (free!)
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
AI_MODEL=gemini-2.0-flash-exp

# Or use Claude 3.5 Haiku (faster, cheaper)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_key_here
AI_MODEL=claude-3-5-haiku-20241022
```

## Future Updates

To update models in the future:

1. Check provider documentation:
   - Anthropic: https://www.anthropic.com/api
   - OpenAI: https://openai.com/api/pricing/
   - Google Gemini: https://ai.google.dev/pricing

2. Update `AVAILABLE_MODELS` in `backend/app/api/settings.py`

3. Update pricing in `backend/app/utils/metrics.py`

4. Update the `last_updated` comment

5. Restart the backend server

6. Test with `GET /api/settings/ai-config/models`

## Benefits

### Cost Savings
- **Gemini experimental models are FREE** during preview
- **Gemini 1.5 Flash-8B** is 50% cheaper than regular Flash
- **Claude 3.5 Haiku** is 3x cheaper than Sonnet for simpler tasks

### Performance
- **Gemini 2.0 Flash** is extremely fast with multimodal support
- **Claude 3.5 Haiku** is faster than previous generation
- **Larger context windows** (up to 2M tokens for Gemini)

### Flexibility
- More model choices for different use cases
- Easy switching between models via environment variables
- Manual refresh endpoint for checking updates

## Notes

- Experimental Gemini models may have rate limits
- Free models during preview may transition to paid in the future
- Always check provider documentation for the latest pricing
- Context window sizes vary significantly between models
- Consider cost vs. quality tradeoffs for your use case

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Models endpoint returns all 13 models
- [ ] Models are grouped correctly by provider
- [ ] Pricing is calculated correctly for new models
- [ ] Can select new models in settings UI
- [ ] Question generation works with new models
- [ ] Cost tracking works with new pricing

## Questions?

If you encounter issues:
1. Check backend logs for errors
2. Verify API keys are configured correctly
3. Ensure model IDs match exactly (case-sensitive)
4. Check provider documentation for model availability
5. Test with the `/api/settings/ai-config/test` endpoint
