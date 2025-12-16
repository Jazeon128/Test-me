/**
 * API Key Validator
 * Validates API key formats for different providers
 */

/**
 * Validate OpenAI API key format
 * OpenAI keys start with 'sk-' followed by alphanumeric characters
 * @param {string} key - API key to validate
 * @returns {boolean} True if valid
 */
function validateOpenAIKey(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // OpenAI keys start with 'sk-' or 'sk-proj-' and are followed by alphanumeric characters
  // Modern format: sk-proj-[48 chars] or legacy format: sk-[48 chars]
  const openAIPattern = /^sk-(proj-)?[a-zA-Z0-9]{20,}$/;
  return openAIPattern.test(key);
}

/**
 * Validate Anthropic API key format
 * Anthropic keys start with 'sk-ant-' followed by alphanumeric characters
 * @param {string} key - API key to validate
 * @returns {boolean} True if valid
 */
function validateAnthropicKey(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Anthropic keys start with 'sk-ant-' followed by alphanumeric characters and hyphens
  const anthropicPattern = /^sk-ant-[a-zA-Z0-9\-]{20,}$/;
  return anthropicPattern.test(key);
}

/**
 * Validate Google API key format
 * Google API keys are typically 39 characters of alphanumeric and special characters
 * @param {string} key - API key to validate
 * @returns {boolean} True if valid
 */
function validateGoogleKey(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Google API keys are typically 39 characters, alphanumeric with hyphens and underscores
  // Format: AIza[35 chars]
  const googlePattern = /^AIza[a-zA-Z0-9_\-]{35}$/;
  return googlePattern.test(key);
}

/**
 * Validate API key for a specific provider
 * @param {string} provider - Provider name (openai, anthropic, google)
 * @param {string} key - API key to validate
 * @returns {object} Validation result with success and error message
 */
function validateApiKey(provider, key) {
  if (!key || typeof key !== 'string' || key.trim() === '') {
    return {
      valid: false,
      error: 'API key cannot be empty'
    };
  }

  const trimmedKey = key.trim();
  let isValid = false;
  let errorMessage = '';

  switch (provider.toLowerCase()) {
    case 'openai':
      isValid = validateOpenAIKey(trimmedKey);
      errorMessage = isValid ? '' : 'Invalid OpenAI API key format. Key should start with "sk-" or "sk-proj-"';
      break;
    
    case 'anthropic':
      isValid = validateAnthropicKey(trimmedKey);
      errorMessage = isValid ? '' : 'Invalid Anthropic API key format. Key should start with "sk-ant-"';
      break;
    
    case 'google':
      isValid = validateGoogleKey(trimmedKey);
      errorMessage = isValid ? '' : 'Invalid Google API key format. Key should start with "AIza"';
      break;
    
    default:
      return {
        valid: false,
        error: `Unknown provider: ${provider}`
      };
  }

  return {
    valid: isValid,
    error: errorMessage
  };
}

module.exports = {
  validateOpenAIKey,
  validateAnthropicKey,
  validateGoogleKey,
  validateApiKey
};
