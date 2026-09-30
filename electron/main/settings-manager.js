const Store = require('electron-store');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { validateApiKey } = require('./api-key-validator');

const LEGACY_KEY = 'flashlearn-default-encryption-key-32';
// undefined means unattempted. null means the machine ID is unavailable.
let machineEncryptionKey;

/**
 * SettingsManager handles application settings with secure storage for API keys
 */
class SettingsManager {
  constructor(options = {}) {
    const explicitKey = options.encryptionKey !== undefined;
    let cwd = options.cwd;
    if (!explicitKey) {
      const userData = cwd && path.isAbsolute(cwd)
        ? cwd
        : require('electron').app.getPath('userData');
      cwd = cwd ? path.resolve(userData, cwd) : userData;
    }
    const encryptionKey = explicitKey ? options.encryptionKey : this._generateEncryptionKey(cwd);
    const openStore = storeOptions => explicitKey
      ? new Store(storeOptions)
      : this._openStore(storeOptions);

    this.store = openStore({
      name: options.name || 'settings',
      cwd,
      encryptionKey,
      clearInvalidConfig: false,
      defaults: this._getDefaultSettings()
    });

    // Separate store for encrypted API keys
    this.secureStore = openStore({
      name: options.secureName || 'secure-settings',
      cwd,
      encryptionKey,
      clearInvalidConfig: false
    });
  }

  /**
   * Generate a machine-specific encryption key
   * @private
   */
  _generateEncryptionKey(cwd) {
    if (machineEncryptionKey === undefined) {
      const { machineIdSync } = require('node-machine-id');
      try {
        machineEncryptionKey = crypto.createHash('sha256')
          .update('test-me-settings:' + machineIdSync(true)).digest('hex').slice(0, 32);
      } catch (error) {
        machineEncryptionKey = null;
      }
    }
    if (machineEncryptionKey !== null) return machineEncryptionKey;

    const keyPath = path.join(cwd, 'settings-key');
    fs.mkdirSync(cwd, { recursive: true });
    try {
      fs.writeFileSync(keyPath, crypto.randomBytes(16).toString('hex'), { flag: 'wx', mode: 0o600 });
    } catch (writeError) {
      if (writeError.code !== 'EEXIST') throw writeError;
    }
    return fs.readFileSync(keyPath, 'utf8');
  }

  /** Open an encrypted store without discarding data when its key changes. */
  _openStore(options) {
    const filePath = path.resolve(options.cwd, `${options.name}.json`);
    try {
      return new Store(options);
    } catch (error) {
      // Conf leaves the file untouched and throws SyntaxError on failed decryption.
      // Filesystem failures must not be treated as unreadable encrypted data.
      if (error.name !== 'SyntaxError' || !fs.existsSync(filePath)) throw error;
    }

    let entries;
    try {
      entries = new Store({ ...options, encryptionKey: LEGACY_KEY, defaults: undefined }).store;
    } catch (error) {
      if (error.name !== 'SyntaxError') throw error;
      fs.renameSync(filePath, `${filePath}.unreadable-${Date.now()}`);
      console.warn(`Could not decrypt settings store ${options.name}. Preserved the unreadable file and started empty.`);
      return new Store(options);
    }

    // Finish writing with the new key before replacing the readable legacy file.
    const temporaryName = `${options.name}.migration-${crypto.randomBytes(16).toString('hex')}`;
    const temporaryPath = path.resolve(options.cwd, `${temporaryName}.json`);
    try {
      const migrated = new Store({ ...options, name: temporaryName });
      migrated.store = { ...options.defaults, ...entries };
      fs.renameSync(temporaryPath, filePath);
    } finally {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
    return new Store(options);
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
