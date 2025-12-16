# Design Document: Custom Model Input and Updated Gemini Models

## Overview

This feature adds the ability for users to manually input custom AI model names while maintaining the existing predefined model dropdown. It also updates the Gemini model list to include the latest Gemini 2.5 and 3.0 models. The design follows a progressive disclosure pattern where users can choose between curated models or enter their own, providing flexibility for power users while maintaining simplicity for typical users.

## Architecture

### Component Structure

```
Frontend (React)
├── Settings.jsx (Modified)
│   ├── Model Selector Component (New)
│   │   ├── Predefined Dropdown
│   │   └── Custom Input Toggle
│   └── Provider Documentation Links (New)
│
Backend (FastAPI)
├── settings.py (Modified)
│   ├── AVAILABLE_MODELS (Updated)
│   └── Model validation (Relaxed)
└── question_generator.py (No changes needed)
```

### Data Flow

1. **Model Selection Flow:**
   - User selects provider (Anthropic/OpenAI/Gemini)
   - UI displays predefined models for that provider
   - User either selects from dropdown OR toggles custom input
   - Custom input shows format examples and documentation link
   - Model name saved to database (no validation)

2. **Model Loading Flow:**
   - Frontend fetches `/api/settings/ai-config`
   - Backend returns stored model name (custom or predefined)
   - Frontend checks if model exists in predefined list
   - If not found, displays as custom model with input field populated

## Components and Interfaces

### Frontend Changes

#### 1. Model Selector Component (New)

```jsx
<ModelSelector
  provider={selectedProvider}
  selectedModel={currentModel}
  availableModels={modelsForProvider}
  onModelChange={handleModelChange}
  isCustom={isCustomModel}
  onToggleCustom={handleToggleCustom}
/>
```

**Props:**
- `provider`: string - Current AI provider
- `selectedModel`: string - Currently selected/entered model
- `availableModels`: AIModel[] - Filtered predefined models
- `onModelChange`: (model: string) => void
- `isCustom`: boolean - Whether custom input is active
- `onToggleCustom`: () => void

**State:**
- `isCustomMode`: boolean - Toggle between dropdown and custom input
- `customModelValue`: string - User-entered custom model name
- `showFormatHelp`: boolean - Display format examples

#### 2. Settings.jsx Modifications

**New State:**
```javascript
const [isCustomModel, setIsCustomModel] = useState(false)
const [customModelInput, setCustomModelInput] = useState('')
```

**Model Detection Logic:**
```javascript
const isModelPredefined = (modelId) => {
  return availableModels.some(m => m.id === modelId)
}

useEffect(() => {
  if (config.model && !isModelPredefined(config.model)) {
    setIsCustomModel(true)
    setCustomModelInput(config.model)
  }
}, [config.model, availableModels])
```

### Backend Changes

#### 1. Updated AVAILABLE_MODELS (settings.py)

**Remove outdated Gemini models:**
- `gemini-2.0-flash-exp`
- `gemini-exp-1206`
- `gemini-2.0-flash-thinking-exp-01-21`
- `gemini-1.5-pro-002`
- `gemini-1.5-flash-002`
- `gemini-1.5-flash-8b`

**Add new Gemini models:**

```python
# Gemini 3.0 Series
AIModel(
    id="gemini-3-pro-preview",
    name="Gemini 3 Pro Preview",
    provider="gemini",
    context_window=1048576,
    input_price=0.00,  # Preview pricing TBD
    output_price=0.00,
    description="Most intelligent model with multimodal understanding and agentic capabilities"
),

# Gemini 2.5 Series
AIModel(
    id="gemini-2.5-flash",
    name="Gemini 2.5 Flash",
    provider="gemini",
    context_window=1048576,
    input_price=0.00,  # Pricing TBD
    output_price=0.00,
    description="Fast and intelligent, best for price-performance with thinking capabilities"
),
AIModel(
    id="gemini-2.5-flash-lite",
    name="Gemini 2.5 Flash-Lite",
    provider="gemini",
    context_window=1048576,
    input_price=0.00,  # Pricing TBD
    output_price=0.00,
    description="Fastest flash model optimized for cost-efficiency and high throughput"
),
AIModel(
    id="gemini-2.5-pro",
    name="Gemini 2.5 Pro",
    provider="gemini",
    context_window=1048576,
    input_price=0.00,  # Pricing TBD
    output_price=0.00,
    description="Advanced thinking model for complex reasoning in code, math, and STEM"
),
```

#### 2. Relaxed Model Validation

**Current validation (to be removed):**
```python
# No validation against AVAILABLE_MODELS list
```

**New approach:**
- Accept any non-empty string as model name
- Store exactly as provided
- Let AI provider SDK handle validation at runtime

#### 3. API Response Enhancement

**Enhanced AIConfigResponse:**
```python
class AIConfigResponse(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key_configured: bool = False
    api_key_preview: Optional[str] = None
    is_custom_model: bool = False  # New field
```

**Detection logic:**
```python
def is_custom_model(model_id: str) -> bool:
    return model_id not in [m.id for m in AVAILABLE_MODELS]
```

## Data Models

### Frontend TypeScript Interfaces

```typescript
interface AIModel {
  id: string
  name: string
  provider: 'anthropic' | 'openai' | 'gemini'
  context_window: number
  input_price: number
  output_price: number
  description?: string
}

interface ModelSelectorProps {
  provider: string
  selectedModel: string
  availableModels: AIModel[]
  onModelChange: (model: string) => void
  isCustom: boolean
  onToggleCustom: () => void
}

interface FormatExample {
  provider: string
  examples: string[]
  documentationUrl: string
}
```

### Backend Models (No changes to existing)

The existing `AIConfigRequest` and `AIConfigResponse` models remain compatible. The `model` field already accepts any string.

## 
Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Custom model toggle displays input field

*For any* UI state where the user toggles to custom model mode, the rendered component should contain a text input field for model entry.
**Validates: Requirements 1.2**

### Property 2: Non-empty strings accepted as model names

*For any* non-empty string, when submitted as a custom model name, the system should accept it without validation errors.
**Validates: Requirements 1.3, 4.1**

### Property 3: Custom model persistence round-trip

*For any* custom model name, after saving to the database and retrieving the configuration, the returned model name should match the original exactly.
**Validates: Requirements 1.4, 1.5, 4.2**

### Property 4: Model metadata display on hover

*For any* predefined model in the dropdown, when a hover event is simulated, the DOM should contain elements displaying context window, pricing, and description.
**Validates: Requirements 3.2**

### Property 5: API accepts any non-empty model string

*For any* non-empty string sent to the Settings API as a model name, the API should return a success response without validating against the predefined model list.
**Validates: Requirements 4.1**

### Property 6: API returns stored custom models

*For any* model name stored in the database (custom or predefined), when the Settings API returns configuration, it should include that model name.
**Validates: Requirements 4.3**

### Property 7: AI service uses exact model name

*For any* model name stored in configuration, when the AI service initializes, it should pass that exact model name to the provider SDK without modification.
**Validates: Requirements 4.4**

## Error Handling

### Frontend Error Scenarios

1. **Empty Custom Model Input**
   - Validation: Prevent save if custom input is empty
   - User feedback: Display inline error "Model name cannot be empty"
   - Recovery: Keep form in edit mode

2. **API Connection Failure**
   - Detection: Catch network errors on save
   - User feedback: Toast notification "Failed to save settings. Please try again."
   - Recovery: Retain form state, allow retry

3. **Invalid Provider Selection**
   - Validation: Ensure provider is selected before model
   - User feedback: Disable model selector until provider chosen
   - Recovery: Auto-enable when provider selected

### Backend Error Scenarios

1. **Missing Model Name in Request**
   - Detection: Check if model field is None or empty
   - Response: 400 Bad Request with message "Model name is required"
   - Logging: Log validation failure

2. **Database Write Failure**
   - Detection: Catch SQLAlchemy exceptions
   - Response: 500 Internal Server Error
   - Logging: Log full exception with stack trace
   - Recovery: Transaction rollback

3. **Invalid Provider at Runtime**
   - Detection: AI service initialization fails
   - Response: Return error in test endpoint
   - User feedback: "Failed to connect to {provider}"
   - Recovery: Allow user to change configuration

## Testing Strategy

### Unit Testing

**Frontend Unit Tests:**
1. ModelSelector component renders correctly
2. Toggle between dropdown and custom input works
3. Custom input validation (non-empty)
4. Format examples display for each provider
5. Documentation links are correct

**Backend Unit Tests:**
1. AVAILABLE_MODELS contains new Gemini models
2. AVAILABLE_MODELS does not contain deprecated models
3. Settings API accepts custom model names
4. Settings API stores and retrieves exact strings
5. is_custom_model detection logic

### Property-Based Testing

**Framework:** 
- Frontend: fast-check (JavaScript/TypeScript)
- Backend: Hypothesis (Python)

**Configuration:**
- Minimum 100 iterations per property test
- Use appropriate generators for strings, model names, etc.

**Property Tests:**

1. **Custom Model Input Acceptance (Frontend)**
   - Generate: Random non-empty strings
   - Test: All are accepted as valid custom model names
   - Tag: **Feature: custom-model-input, Property 2: Non-empty strings accepted as model names**

2. **Model Persistence Round-Trip (Backend)**
   - Generate: Random model name strings
   - Test: Save to DB, retrieve, verify exact match
   - Tag: **Feature: custom-model-input, Property 3: Custom model persistence round-trip**

3. **API Model Acceptance (Backend)**
   - Generate: Random non-empty strings
   - Test: POST to /api/settings/ai-config, verify success response
   - Tag: **Feature: custom-model-input, Property 5: API accepts any non-empty model string**

4. **Custom Model Retrieval (Backend)**
   - Generate: Random model names (custom and predefined)
   - Test: Store model, GET /api/settings/ai-config, verify model in response
   - Tag: **Feature: custom-model-input, Property 6: API returns stored custom models**

5. **AI Service Model Usage (Backend)**
   - Generate: Random model names
   - Test: Mock AI provider, verify exact model name passed to SDK
   - Tag: **Feature: custom-model-input, Property 7: AI service uses exact model name**

### Integration Testing

1. **End-to-End Custom Model Flow**
   - Select provider → Toggle custom → Enter model → Save → Reload → Verify
   - Test with all three providers

2. **Predefined to Custom Transition**
   - Select predefined model → Save → Switch to custom → Verify state

3. **Custom to Predefined Transition**
   - Enter custom model → Save → Switch to predefined → Verify state

4. **Model List Update Verification**
   - Verify new Gemini models appear in dropdown
   - Verify old models are removed
   - Verify model metadata is correct

### Manual Testing Checklist

- [ ] Visual distinction between predefined and custom models is clear
- [ ] Hover tooltips display correct information
- [ ] Warning messages appear for custom models
- [ ] Confirmation messages appear after save
- [ ] Documentation links open correct pages
- [ ] Format examples are helpful and accurate
- [ ] UI is responsive and accessible
- [ ] Works across different browsers

## Implementation Notes

### Frontend Considerations

1. **State Management**
   - Use local state for custom/predefined toggle
   - Sync with saved configuration on load
   - Clear custom input when switching to predefined

2. **UX Patterns**
   - Use radio buttons or toggle for mode selection
   - Show format examples inline, not in tooltip
   - Provide "Learn more" link to provider docs
   - Use subtle warning styling (not alarming)

3. **Accessibility**
   - Ensure keyboard navigation works
   - Add ARIA labels for screen readers
   - Maintain focus management on toggle

### Backend Considerations

1. **Backward Compatibility**
   - Existing configurations continue to work
   - No migration needed for database
   - API responses remain compatible

2. **Model Name Handling**
   - Store as-is, no normalization
   - Trim whitespace on input
   - Case-sensitive storage and comparison

3. **Documentation Updates**
   - Update AI_MODELS_API_REFERENCE.md
   - Update last_updated date
   - Add custom model usage examples

### Security Considerations

1. **Input Sanitization**
   - Model names are not executed, only passed to APIs
   - No SQL injection risk (using ORM)
   - No XSS risk (React escapes by default)

2. **API Key Protection**
   - Custom models don't affect key storage
   - Keys remain encrypted/protected as before

3. **Rate Limiting**
   - Custom models subject to same rate limits
   - No additional abuse vectors introduced

## Migration Strategy

### Phase 1: Backend Updates
1. Update AVAILABLE_MODELS list
2. Remove model validation logic
3. Add is_custom_model detection
4. Update documentation
5. Deploy backend

### Phase 2: Frontend Updates
1. Implement ModelSelector component
2. Add custom input toggle
3. Add format examples and links
4. Update Settings page
5. Deploy frontend

### Phase 3: Verification
1. Test with existing configurations
2. Test custom model input
3. Verify new Gemini models appear
4. Monitor error logs

### Rollback Plan

If issues arise:
1. Frontend: Revert to previous version (no data impact)
2. Backend: Restore previous AVAILABLE_MODELS list
3. Database: No changes needed (backward compatible)

## Future Enhancements

1. **Model Validation API**
   - Optional: Ping provider API to validate model exists
   - Show warning if model not found
   - Cache validation results

2. **Model History**
   - Track previously used custom models
   - Suggest from history
   - Quick-select from recent

3. **Community Model Sharing**
   - Allow users to share working custom models
   - Crowdsourced model database
   - Upvote/downvote models

4. **Auto-Update Model List**
   - Periodic fetch from provider APIs
   - Notify users of new models
   - One-click update

5. **Model Performance Tracking**
   - Track success rates per model
   - Show performance metrics
   - Recommend best models for use case
