# Requirements Document

## Introduction

This feature enables users to manually input custom AI model names in addition to selecting from a predefined list. This addresses the rapid evolution of AI models where new models are released frequently, and the application's hardcoded model list may become outdated. Additionally, this feature will update the existing Gemini model list to include the latest Gemini 2.5 and 3.0 models.

## Glossary

- **AI Model**: A specific version of an AI language model provided by a vendor (Anthropic, OpenAI, or Google Gemini)
- **Model Selector**: The UI component that allows users to choose or input an AI model
- **Custom Model**: A model name manually entered by the user that is not in the predefined list
- **System**: The Test Me application backend and frontend
- **Settings API**: The backend API endpoint that manages AI configuration

## Requirements

### Requirement 1

**User Story:** As a user, I want to manually enter a custom AI model name, so that I can use newly released models that aren't yet in the predefined list.

#### Acceptance Criteria

1. WHEN a user views the model selector THEN the System SHALL display both a dropdown of predefined models and an option to enter a custom model name
2. WHEN a user selects "Custom Model" option THEN the System SHALL display a text input field for manual model entry
3. WHEN a user enters a custom model name THEN the System SHALL accept any non-empty string as a valid model identifier
4. WHEN a user saves a custom model name THEN the System SHALL store the custom model name in the database
5. WHEN a user returns to settings with a saved custom model THEN the System SHALL display the custom model name in the input field

### Requirement 2

**User Story:** As a user, I want the application to include the latest Gemini models, so that I can use Google's newest and most capable AI models.

#### Acceptance Criteria

1. WHEN a user views the Gemini model list THEN the System SHALL include Gemini 3 Pro Preview (gemini-3-pro-preview)
2. WHEN a user views the Gemini model list THEN the System SHALL include Gemini 2.5 Flash (gemini-2.5-flash)
3. WHEN a user views the Gemini model list THEN the System SHALL include Gemini 2.5 Flash-Lite (gemini-2.5-flash-lite)
4. WHEN a user views the Gemini model list THEN the System SHALL include Gemini 2.5 Pro (gemini-2.5-pro)
5. WHEN a user views the Gemini model list THEN the System SHALL mark outdated models (Gemini 1.5 and 2.0) as deprecated or remove them

### Requirement 3

**User Story:** As a user, I want clear visual feedback about which models are official and which are custom, so that I understand the source and support level of my selected model.

#### Acceptance Criteria

1. WHEN a user views the model selector THEN the System SHALL visually distinguish between predefined models and custom model input
2. WHEN a user hovers over a predefined model THEN the System SHALL display model metadata including context window, pricing, and description
3. WHEN a user enters a custom model THEN the System SHALL display a warning that custom models are not validated
4. WHEN a user saves a custom model THEN the System SHALL display a confirmation message indicating the custom model was saved

### Requirement 4

**User Story:** As a developer, I want the backend to accept and store any model name, so that the system remains flexible as AI providers release new models.

#### Acceptance Criteria

1. WHEN the Settings API receives a model name THEN the System SHALL accept any non-empty string without validation against the predefined list
2. WHEN the Settings API stores a model name THEN the System SHALL persist the exact model string provided by the user
3. WHEN the Settings API returns configuration THEN the System SHALL include the stored model name regardless of whether it exists in the predefined list
4. WHEN the AI service initializes THEN the System SHALL use the stored model name exactly as provided for API calls

### Requirement 5

**User Story:** As a user, I want helpful suggestions when entering custom models, so that I can correctly format model names for different providers.

#### Acceptance Criteria

1. WHEN a user selects custom model input THEN the System SHALL display example model name formats for the selected provider
2. WHEN a user enters a custom model for Anthropic THEN the System SHALL show examples like "claude-3-5-sonnet-20241022"
3. WHEN a user enters a custom model for OpenAI THEN the System SHALL show examples like "gpt-4o" or "gpt-4-turbo"
4. WHEN a user enters a custom model for Gemini THEN the System SHALL show examples like "gemini-2.5-flash" or "gemini-3-pro-preview"
5. WHEN a user enters a custom model THEN the System SHALL provide a link to the provider's model documentation
