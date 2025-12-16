# AI Models API Reference

Quick reference for the AI models management endpoints.

## Endpoints

### 1. Get Available Models
**GET** `/api/settings/ai-config/models`

Returns the list of all predefined AI models. Note: Custom models are not included in this list.

**Response:**
```json
[
  {
    "id": "gemini-3-pro-preview",
    "name": "Gemini 3 Pro Preview",
    "provider": "gemini",
    "context_window": 1048576,
    "input_price": 0.0,
    "output_price": 0.0,
    "description": "Most intelligent model with multimodal understanding and agentic capabilities"
  },
  ...
]
```

**Example:**
```bash
curl http://localhost:8000/api/settings/ai-config/models
```

---

### 2. Get Models Info
**GET** `/api/settings/ai-config/models/info`

Returns metadata about the predefined models list including last update date and counts. Custom models are not included in these counts.

**Response:**
```json
{
  "last_updated": "2025-12-05",
  "total_models": 10,
  "models_by_provider": {
    "anthropic": [...],
    "openai": [...],
    "gemini": [...]
  },
  "provider_counts": {
    "anthropic": 3,
    "openai": 3,
    "gemini": 4
  }
}
```

**Example:**
```bash
curl http://localhost:8000/api/settings/ai-config/models/info
```

---

### 3. Refresh Models (Manual Trigger)
**POST** `/api/settings/ai-config/models/refresh`

Triggers a manual refresh check and returns instructions for updating models. Note: You can also use custom model input to immediately use new models without updating the predefined list.

**Response:**
```json
{
  "success": true,
  "message": "Model list refresh instructions provided. Alternatively, use custom model input for immediate access to new models.",
  "current_models_count": 10,
  "last_updated": "2025-12-05",
  "models_by_provider": {
    "anthropic": 3,
    "openai": 3,
    "gemini": 4
  },
  "instructions": {
    "step_1": "Option A: Use custom model input feature (immediate, no code changes)",
    "step_2": "Option B: Update AVAILABLE_MODELS in backend/app/api/settings.py (for permanent addition)",
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

**Example:**
```bash
curl -X POST http://localhost:8000/api/settings/ai-config/models/refresh
```

---

### 4. Get AI Configuration
**GET** `/api/settings/ai-config`

Returns the current AI configuration including whether a custom model is being used.

**Response:**
```json
{
  "provider": "anthropic",
  "model": "claude-3-opus-20240229",
  "api_key_configured": true,
  "api_key_preview": "sk-ant-...xyz",
  "is_custom_model": true
}
```

**Fields:**
- `provider`: The AI provider (anthropic, openai, or gemini)
- `model`: The model identifier (predefined or custom)
- `api_key_configured`: Whether an API key is set
- `api_key_preview`: Masked preview of the API key
- `is_custom_model`: `true` if the model is not in the predefined list, `false` otherwise

**Example:**
```bash
curl http://localhost:8000/api/settings/ai-config
```

---

### 5. Set AI Configuration
**POST** `/api/settings/ai-config`

Sets the AI configuration. Accepts any non-empty string as the model name (custom or predefined).

**Request:**
```json
{
  "provider": "anthropic",
  "model": "claude-3-opus-20240229",
  "api_key": "sk-ant-..."
}
```

**Response:**
```json
{
  "provider": "anthropic",
  "model": "claude-3-opus-20240229",
  "api_key_configured": true,
  "api_key_preview": "sk-ant-...xyz",
  "is_custom_model": true
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/settings/ai-config \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-opus-20240229",
    "api_key": "your-api-key"
  }'
```

---

## Current Models (as of 2025-12-05)

### Anthropic (3 models)
| Model | ID | Price (Input/Output per MTok) | Context |
|-------|----|-----------------------------|---------|
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` | $3.00 / $15.00 | 200K |
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` | $0.80 / $4.00 | 200K |
| Claude 3 Haiku | `claude-3-haiku-20240307` | $0.25 / $1.25 | 200K |

### OpenAI (3 models)
| Model | ID | Price (Input/Output per MTok) | Context |
|-------|----|-----------------------------|---------|
| GPT-4o | `gpt-4o` | $2.50 / $10.00 | 128K |
| GPT-4o Mini | `gpt-4o-mini` | $0.15 / $0.60 | 128K |
| GPT-4 Turbo | `gpt-4-turbo` | $10.00 / $30.00 | 128K |

### Google Gemini (4 models)
| Model | ID | Price (Input/Output per MTok) | Context | Description |
|-------|----|-----------------------------|---------|-------------|
| Gemini 3 Pro Preview | `gemini-3-pro-preview` | TBD | 1M | Most intelligent model with multimodal understanding and agentic capabilities |
| Gemini 2.5 Pro | `gemini-2.5-pro` | TBD | 1M | Advanced thinking model for complex reasoning in code, math, and STEM |
| Gemini 2.5 Flash | `gemini-2.5-flash` | TBD | 1M | Fast and intelligent, best for price-performance with thinking capabilities |
| Gemini 2.5 Flash-Lite | `gemini-2.5-flash-lite` | TBD | 1M | Fastest flash model optimized for cost-efficiency and high throughput |

**Note:** Gemini 1.5 and 2.0 experimental models have been deprecated and removed from the predefined list. You can still use them via custom model input if needed.

---

## Custom Model Support

The Test Me application now supports custom AI model names, allowing you to use newly released models that aren't yet in the predefined list. This feature provides flexibility for power users while maintaining simplicity for typical users.

### How Custom Models Work

1. **No Validation:** The backend accepts any non-empty string as a model name without validating against the predefined list
2. **Exact Storage:** Model names are stored exactly as provided (case-sensitive, no normalization)
3. **Direct Pass-through:** The exact model name is passed to the provider SDK without modification
4. **Provider Validation:** The AI provider (Anthropic, OpenAI, or Gemini) validates the model at runtime

### Using Custom Models

#### Via API

**Set a custom model:**
```bash
curl -X POST http://localhost:8000/api/settings/ai-config \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-opus-20240229",
    "api_key": "your-api-key"
  }'
```

**Response:**
```json
{
  "provider": "anthropic",
  "model": "claude-3-opus-20240229",
  "api_key_configured": true,
  "api_key_preview": "sk-ant-...xyz",
  "is_custom_model": true
}
```

The `is_custom_model` field indicates whether the model is custom (not in predefined list).

#### Via Frontend

1. Navigate to Settings page
2. Select your AI provider
3. Toggle "Custom Model" option
4. Enter the exact model name (e.g., `claude-3-opus-20240229`)
5. Save settings

The UI will display format examples and documentation links for your selected provider.

### Custom Model Examples

#### Anthropic Models
```bash
# Claude 3 Opus (not in predefined list)
curl -X POST http://localhost:8000/api/settings/ai-config \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-opus-20240229"
  }'

# Future Claude models
curl -X POST http://localhost:8000/api/settings/ai-config \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "model": "claude-4-sonnet-20250101"
  }'
```

**Format:** `claude-{version}-{variant}-{date}`
**Documentation:** https://www.anthropic.com/api

#### OpenAI Models
```bash
# GPT-4 (original)
curl -X POST http://localhost:8000/api/settings/ai-config \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4"
  }'

# Future GPT models
curl -X POST http://localhost:8000/api/settings/ai-config \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-5-preview"
  }'
```

**Format:** `gpt-{version}[-{variant}]`
**Documentation:** https://openai.com/api/pricing/

#### Google Gemini Models
```bash
# Deprecated Gemini 1.5 models (still functional)
curl -X POST http://localhost:8000/api/settings/ai-config \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "model": "gemini-1.5-pro-002"
  }'

# Experimental models
curl -X POST http://localhost:8000/api/settings/ai-config \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "model": "gemini-2.0-flash-exp"
  }'

# Future Gemini models
curl -X POST http://localhost:8000/api/settings/ai-config \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "model": "gemini-4-ultra"
  }'
```

**Format:** `gemini-{version}-{variant}[-{suffix}]`
**Documentation:** https://ai.google.dev/pricing

### Custom Model Best Practices

1. **Verify Model Name:** Check the provider's documentation for the exact model identifier
2. **Case Sensitivity:** Model names are case-sensitive (e.g., `gpt-4o` ≠ `GPT-4o`)
3. **Test First:** Use the test endpoint to verify the model works before generating questions
4. **Monitor Costs:** Custom models may have different pricing than predefined models
5. **Check Availability:** Some models may be region-specific or require special access

### Checking Custom Model Status

**Get current configuration:**
```bash
curl http://localhost:8000/api/settings/ai-config
```

**Response with custom model:**
```json
{
  "provider": "anthropic",
  "model": "claude-3-opus-20240229",
  "api_key_configured": true,
  "api_key_preview": "sk-ant-...xyz",
  "is_custom_model": true
}
```

**Response with predefined model:**
```json
{
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "api_key_configured": true,
  "api_key_preview": "sk-ant-...xyz",
  "is_custom_model": false
}
```

### Error Handling

If a custom model name is invalid, the error will occur when:
- Testing the AI configuration (via test endpoint)
- Generating questions (during actual usage)

**Example error response:**
```json
{
  "detail": "Invalid model 'invalid-model-name' for provider 'anthropic'"
}
```

The backend does not validate custom models at save time, allowing you to configure models that may not be immediately available.

### Python Example with Custom Models

```python
import requests

# Configure custom model
config = {
    "provider": "anthropic",
    "model": "claude-3-opus-20240229",  # Custom model
    "api_key": "your-api-key"
}

response = requests.post(
    'http://localhost:8000/api/settings/ai-config',
    json=config
)

result = response.json()
print(f"Model configured: {result['model']}")
print(f"Is custom: {result['is_custom_model']}")

# Test the custom model
test_response = requests.post(
    'http://localhost:8000/api/settings/ai-config/test',
    json=config
)

if test_response.status_code == 200:
    print("Custom model is working!")
else:
    print(f"Error: {test_response.json()['detail']}")
```

### JavaScript Example with Custom Models

```javascript
// Configure custom model
const config = {
  provider: 'openai',
  model: 'gpt-4',  // Custom model
  api_key: 'your-api-key'
};

const response = await fetch('http://localhost:8000/api/settings/ai-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(config)
});

const result = await response.json();
console.log(`Model configured: ${result.model}`);
console.log(`Is custom: ${result.is_custom_model}`);

// Test the custom model
const testResponse = await fetch('http://localhost:8000/api/settings/ai-config/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(config)
});

if (testResponse.ok) {
  console.log('Custom model is working!');
} else {
  const error = await testResponse.json();
  console.error(`Error: ${error.detail}`);
}
```

---

## Usage Examples

### Python
```python
import requests

# Get all models
response = requests.get('http://localhost:8000/api/settings/ai-config/models')
models = response.json()

# Filter by provider
gemini_models = [m for m in models if m['provider'] == 'gemini']
print(f"Found {len(gemini_models)} Gemini models")

# Get free models
free_models = [m for m in models if m['input_price'] == 0]
print(f"Free models: {[m['name'] for m in free_models]}")

# Get models info
info = requests.get('http://localhost:8000/api/settings/ai-config/models/info').json()
print(f"Last updated: {info['last_updated']}")
print(f"Total models: {info['total_models']}")

# Trigger refresh
refresh = requests.post('http://localhost:8000/api/settings/ai-config/models/refresh').json()
print(refresh['instructions'])
```

### JavaScript/TypeScript
```javascript
// Get all models
const response = await fetch('http://localhost:8000/api/settings/ai-config/models');
const models = await response.json();

// Filter by provider
const geminiModels = models.filter(m => m.provider === 'gemini');
console.log(`Found ${geminiModels.length} Gemini models`);

// Get free models
const freeModels = models.filter(m => m.input_price === 0);
console.log('Free models:', freeModels.map(m => m.name));

// Get models info
const info = await fetch('http://localhost:8000/api/settings/ai-config/models/info');
const infoData = await info.json();
console.log(`Last updated: ${infoData.last_updated}`);

// Trigger refresh
const refresh = await fetch('http://localhost:8000/api/settings/ai-config/models/refresh', {
  method: 'POST'
});
const refreshData = await refresh.json();
console.log(refreshData.instructions);
```

### cURL
```bash
# Get all models (pretty print with jq)
curl -s http://localhost:8000/api/settings/ai-config/models | jq '.'

# Get only Gemini models
curl -s http://localhost:8000/api/settings/ai-config/models | jq '.[] | select(.provider == "gemini")'

# Get free models
curl -s http://localhost:8000/api/settings/ai-config/models | jq '.[] | select(.input_price == 0)'

# Get models count by provider
curl -s http://localhost:8000/api/settings/ai-config/models/info | jq '.provider_counts'

# Trigger refresh and get instructions
curl -s -X POST http://localhost:8000/api/settings/ai-config/models/refresh | jq '.instructions'
```

---

## Integration with Frontend

The frontend already fetches models dynamically from the `/api/settings/ai-config/models` endpoint in `frontend/src/pages/Settings.jsx`:

```javascript
const loadModels = async () => {
  try {
    const response = await axios.get('/api/settings/ai-config/models')
    setAvailableModels(response.data)
  } catch (error) {
    console.error('Failed to load models:', error)
  }
}
```

No frontend changes are needed - it will automatically pick up the new models!

---

## Updating Predefined Models

When new models are released, you have two options:

### Option 1: Use Custom Model Input (Immediate)

Simply enter the new model name via the custom model input feature. No code changes required!

1. Navigate to Settings
2. Select provider
3. Toggle "Custom Model"
4. Enter the new model name
5. Save and test

### Option 2: Add to Predefined List (For Permanent Addition)

To add a model to the predefined list (with metadata, tooltips, etc.):

1. **Check provider documentation:**
   - Anthropic: https://www.anthropic.com/api
   - OpenAI: https://openai.com/api/pricing/
   - Google Gemini: https://ai.google.dev/pricing

2. **Update `AVAILABLE_MODELS` in `backend/app/api/settings.py`:**
   ```python
   AIModel(
       id="new-model-id",
       name="New Model Name",
       provider="provider",
       context_window=100000,
       input_price=1.0,
       output_price=2.0,
       description="Model description"
   )
   ```

3. **Update pricing in `backend/app/utils/metrics.py`:**
   ```python
   'provider': {
       'new-model-id': {'input': 1.0, 'output': 2.0},
   }
   ```

4. **Update the last_updated comment**

5. **Update this documentation file**

6. **Restart the backend server**

7. **Verify with:**
   ```bash
   curl http://localhost:8000/api/settings/ai-config/models/info
   ```

---

## Notes

- Model IDs are case-sensitive (applies to both predefined and custom models)
- Prices are per 1 million tokens (MTok)
- Context windows are in tokens
- Free models (price = 0) may have rate limits
- Experimental models may be deprecated without notice
- Always check provider documentation for latest information
- **Custom models:** The backend accepts any non-empty string as a model name
- **Custom model validation:** Validation happens at runtime by the AI provider, not at save time
- **Custom model pricing:** Custom models may have different pricing than shown in the predefined list
- **Deprecated models:** Old models can still be used via custom model input even after removal from predefined list

---

## See Also

- [AI Models Update Summary](./AI_MODELS_UPDATE_SUMMARY.md) - Detailed update notes
- [API Usage Guide](./API_USAGE_GUIDE.md) - General API documentation
- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Configuration guide
