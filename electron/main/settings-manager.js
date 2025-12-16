const Store = require('electron-store');
const crypto = require('crypto');
const { validateApiKey } = require('./api-key-validator');

/**
 * SettingsManager handles application settings with secure storage for API keys
 */
class SettingsManager {
  constructor(options = {}) {
    // Initialize electron-store with encryption for sensitive data
    this.store = new Store({
      name: options.name || 'settings',
      encryptionKey: options.encryptionKey || this._generateEncryptionKey(),
      defaults: this._getDefaultSettings()
    });

    // Separate store for encrypted API keys
    this.secureStore = new Store({
      name: options.secureName || 'secure-settings',
      encryptionKey: options.encryptionKey || this._generateEncryptionKey()
    });
  }

  /**
   * Generate a machine-specific encryption key
   * @private
   */
  _generateEncryptionKey() {
    const { machineId } = require('node-machine-id');
    try {
      const id = machineId.machineIdSync();
      return crypto.createHash('sha256').update(id).digest('hex').substring(0, 32);
    } catch (error) {
      // Fallback to a static key if machine ID is unavailable
      console.warn('Could not generate machine-specific key, using fallback');
      return 'flashlearn-default-encryption-key-32';
    }
  }

  /**
   * Get default settings
   * @private
   */
  _getDefaultSettings() {
    return {
      apiProvider: 'openai',
      theme: 'system',
      autoUpdate: true,
      minimizeToTray: true,
      firstRun: true
    };
  }

  /**
   * Get a setting value
   * @param {string} key - Setting key
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {*} Setting value
   */
  get(key, defaultValue = undefined) {
    return this.store.get(key, defaultValue);
  }

  /**
   * Set a setting value
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   */
  set(key, value) {
    this.store.set(key, value);
  }

  /**
   * Get all settings
   * @returns {object} All settings
   */
  getAll() {
    return this.store.store;
  }

  /**
   * Get a secure value (for API keys)
   * @param {string} key - Secure setting key
   * @returns {string|undefined} Decrypted value
   */
  getSecure(key) {
    return this.secureStore.get(key);
  }

  /**
   * Set a secure value (for API keys)
   * @param {string} key - Secure setting key
   * @param {string} value - Value to encrypt and store
   */
  setSecure(key, value) {
    if (!value) {
      this.secureStore.delete(key);
      return;
    }
    this.secureStore.set(key, value);
  }

  /**
   * Get all API keys
   * @returns {object} Object with API keys
   */
  getApiKeys() {
    return {
      openai: this.getSecure('apiKeys.openai'),
      anthropic: this.getSecure('apiKeys.anthropic'),
      google: this.getSecure('apiKeys.google')
    };
  }

  /**
   * Set API key for a provider
   * @param {string} provider - Provider name (openai, anthropic, google)
   * @param {string} key - API key
   * @throws {Error} If API key format is invalid
   */
  setApiKey(provider, key) {
    // Validate the API key format
    const validation = validateApiKey(provider, key);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    this.setSecure(`apiKeys.${provider}`, key);
  }

  /**
   * Check if any API keys are configured
   * @returns {boolean} True if at least one API key is configured
   */
  hasApiKeys() {
    const keys = this.getApiKeys();
    return !!(keys.openai || keys.anthropic || keys.google);
  }

  /**
   * Delete a setting
   * @param {string} key - Setting key to delete
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Delete a secure setting
   * @param {string} key - Secure setting key to delete
   */
  deleteSecure(key) {
    this.secureStore.delete(key);
  }

  /**
   * Reset all settings to defaults
   */
  reset() {
    this.store.clear();
    this.secureStore.clear();
  }

  /**
   * Get the path to the settings file
   * @returns {string} Settings file path
   */
  getPath() {
    return this.store.path;
  }

  /**
   * Get the path to the secure settings file
   * @returns {string} Secure settings file path
   */
  getSecurePath() {
    return this.secureStore.path;
  }
}

module.exports = SettingsManager;
