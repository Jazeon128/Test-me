# Implementation Plan

- [x] 1. Update backend Gemini model list





  - Update AVAILABLE_MODELS in backend/app/api/settings.py
  - Add Gemini 3 Pro Preview (gemini-3-pro-preview)
  - Add Gemini 2.5 Flash (gemini-2.5-flash)
  - Add Gemini 2.5 Flash-Lite (gemini-2.5-flash-lite)
  - Add Gemini 2.5 Pro (gemini-2.5-pro)
  - Remove outdated Gemini 1.5 and 2.0 models
  - Update last_updated comment to current date
  - Update model metadata (context windows, pricing, descriptions)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 1.1 Write unit tests for updated model list


  - Test that new Gemini models are present in AVAILABLE_MODELS
  - Test that old Gemini models are removed
  - Test model metadata is correct
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Remove backend model validation





  - Remove any validation logic that checks model names against AVAILABLE_MODELS
  - Ensure Settings API accepts any non-empty string as model name
  - Update set_ai_config endpoint to accept custom models
  - Ensure exact model string is stored in database
  - _Requirements: 4.1, 4.2_

- [x] 2.1 Write property test for API model acceptance


  - **Property 5: API accepts any non-empty model string**
  - **Validates: Requirements 4.1**

- [x] 2.2 Write property test for model persistence


  - **Property 3: Custom model persistence round-trip**
  - **Validates: Requirements 1.4, 1.5, 4.2**


- [x] 3. Add custom model detection to backend




  - Add is_custom_model field to AIConfigResponse
  - Implement detection logic to check if model is in AVAILABLE_MODELS
  - Update get_ai_config endpoint to include is_custom_model flag
  - _Requirements: 4.3_

- [x] 3.1 Write unit tests for custom model detection


  - Test detection returns true for custom models
  - Test detection returns false for predefined models
  - Test edge cases (empty string, None, etc.)
  - _Requirements: 4.3_

- [x] 3.2 Write property test for custom model retrieval


  - **Property 6: API returns stored custom models**
  - **Validates: Requirements 4.3**

- [x] 4. Update backend documentation





  - Update backend/docs/AI_MODELS_API_REFERENCE.md with new Gemini models
  - Add documentation for custom model support
  - Add examples of using custom models
  - Update model table with latest information
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Create ModelSelector component (Frontend)





  - Create new component in frontend/src/components/ModelSelector.jsx
  - Implement toggle between predefined dropdown and custom input
  - Add state management for custom mode
  - Implement model selection handler
  - Add TypeScript interfaces if using TypeScript
  - _Requirements: 1.1, 1.2_

- [x] 5.1 Write unit tests for ModelSelector component


  - Test component renders with predefined models
  - Test toggle switches to custom input mode
  - Test custom input field appears when toggled
  - Test model selection callbacks work
  - _Requirements: 1.1, 1.2_

- [x] 5.2 Write property test for custom toggle behavior


  - **Property 1: Custom model toggle displays input field**
  - **Validates: Requirements 1.2**


- [x] 6. Add custom model input validation (Frontend)




  - Implement non-empty string validation for custom input
  - Add inline error messages for empty input
  - Prevent save when custom input is empty
  - Add visual feedback for validation state
  - _Requirements: 1.3_

- [x] 6.1 Write property test for input acceptance


  - **Property 2: Non-empty strings accepted as model names**
  - **Validates: Requirements 1.3, 4.1**


- [x] 7. Add format examples and documentation links (Frontend)




  - Create format example component showing provider-specific examples
  - Add examples for Anthropic (claude-3-5-sonnet-20241022)
  - Add examples for OpenAI (gpt-4o, gpt-4-turbo)
  - Add examples for Gemini (gemini-2.5-flash, gemini-3-pro-preview)
  - Add documentation links for each provider
  - Display examples when custom mode is active
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7.1 Write unit tests for format examples


  - Test correct examples shown for each provider
  - Test documentation links are correct
  - Test examples only show in custom mode
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_


- [x] 8. Add warning and confirmation messages (Frontend)




  - Add warning message for custom models (not validated)
  - Add confirmation message after successful save
  - Style warnings appropriately (subtle, not alarming)
  - Ensure messages are accessible
  - _Requirements: 3.3, 3.4_

- [x] 8.1 Write unit tests for messages


  - Test warning appears for custom models
  - Test confirmation appears after save
  - Test messages have correct content
  - _Requirements: 3.3, 3.4_

- [x] 9. Integrate ModelSelector into Settings page





  - Replace existing model dropdown with ModelSelector component
  - Add state management for custom/predefined mode
  - Implement detection of custom models on load
  - Handle switching between custom and predefined modes
  - Update save handler to work with custom models
  - _Requirements: 1.1, 1.2, 1.5_

- [x] 9.1 Write integration tests for Settings page


  - Test full flow: select provider → custom model → save → reload
  - Test switching from predefined to custom
  - Test switching from custom to predefined
  - Test loading existing custom model
  - _Requirements: 1.1, 1.2, 1.5_


- [x] 10. Add model metadata tooltips (Frontend)




  - Implement hover tooltips for predefined models
  - Display context window, pricing, and description
  - Ensure tooltips are accessible
  - Style tooltips consistently with app design
  - _Requirements: 3.2_

- [x] 10.1 Write property test for metadata display


  - **Property 4: Model metadata display on hover**
  - **Validates: Requirements 3.2**


- [x] 11. Verify AI service uses exact model name




  - Review backend/app/services/ai/question_generator.py
  - Ensure model name is passed exactly as stored to provider SDKs
  - No normalization or modification of model names
  - _Requirements: 4.4_

- [x] 11.1 Write property test for AI service model usage


  - **Property 7: AI service uses exact model name**
  - **Validates: Requirements 4.4**

- [x] 12. Update pricing in metrics utility





  - Update backend/app/utils/metrics.py with new Gemini model pricing
  - Add pricing for gemini-3-pro-preview
  - Add pricing for gemini-2.5-flash
  - Add pricing for gemini-2.5-flash-lite
  - Add pricing for gemini-2.5-pro
  - Remove pricing for deprecated models
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 12.1 Write unit tests for pricing updates


  - Test new models have correct pricing
  - Test old models are removed
  - _Requirements: 2.1, 2.2, 2.3, 2.4_


- [x] 13. Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Manual testing and verification





  - Test custom model input with all three providers
  - Verify new Gemini models appear in dropdown
  - Verify old Gemini models are removed
  - Test saving and loading custom models
  - Test switching between custom and predefined
  - Verify format examples and documentation links
  - Test warning and confirmation messages
  - Verify tooltips display correct information
  - Test across different browsers
  - Verify accessibility with keyboard navigation
  - _Requirements: All_
