/**
 * Unit Tests for SettingsManager
 * Tests get/set operations, encryption/decryption, and validation logic
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
// Keep real encrypted stores inside each test's temporary directory.
let mockSettingsDirectory;
jest.mock('electron-store', () => {
  const Store = jest.requireActual('electron-store');
  return class extends Store {
    constructor(options) {
      super({ ...options, cwd: mockSettingsDirectory });
    }
  };
});
const SettingsManager = require('../settings-manager');

describe('SettingsManager', () => {
  let tempDir;
  let settingsManager;

  beforeEach(() => {
    // Create a temporary directory for test settings
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
    mockSettingsDirectory = tempDir;
  });

  afterEach(() => {
    // Clean up
    if (settingsManager) {
      try {
        settingsManager.reset();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Remove temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('get/set operations', () => {
    test('should set and get a setting value', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      settingsManager.set('testKey', 'testValue');
      expect(settingsManager.get('testKey')).toBe('testValue');
    });

    test('should return default value when key does not exist', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      expect(settingsManager.get('nonexistent', 'default')).toBe('default');
    });

    test('should return undefined when key does not exist and no default provided', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      expect(settingsManager.get('nonexistent')).toBeUndefined();
    });

    test('should get all settings', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      settingsManager.set('key1', 'value1');
      settingsManager.set('key2', 'value2');

      const allSettings = settingsManager.getAll();
      expect(allSettings.key1).toBe('value1');
      expect(allSettings.key2).toBe('value2');
    });

    test('should delete a setting', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      settingsManager.set('testKey', 'testValue');
      expect(settingsManager.get('testKey')).toBe('testValue');

      settingsManager.delete('testKey');
      expect(settingsManager.get('testKey')).toBeUndefined();
    });

    test('should handle different data types', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      settingsManager.set('string', 'value');
      settingsManager.set('number', 42);
      settingsManager.set('boolean', true);
      settingsManager.set('object', { nested: 'value' });
      settingsManager.set('array', [1, 2, 3]);

      expect(settingsManager.get('string')).toBe('value');
      expect(settingsManager.get('number')).toBe(42);
      expect(settingsManager.get('boolean')).toBe(true);
      expect(settingsManager.get('object')).toEqual({ nested: 'value' });
      expect(settingsManager.get('array')).toEqual([1, 2, 3]);
    });
  });

  describe('encryption/decryption', () => {
    test('should encrypt and decrypt secure values', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      const secretValue = 'my-secret-api-key';
      settingsManager.setSecure('apiKey', secretValue);

      const retrieved = settingsManager.getSecure('apiKey');
      expect(retrieved).toBe(secretValue);
    });

    test('should not store secure values in plain text', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      const secretValue = 'my-secret-api-key';
      settingsManager.setSecure('apiKey', secretValue);

      const secureFilePath = settingsManager.getSecurePath();
      const fileContents = fs.readFileSync(secureFilePath, 'utf8');

      expect(fileContents).not.toContain(secretValue);
    });

    test('should delete secure value when set to null', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      settingsManager.setSecure('apiKey', 'secret');
      expect(settingsManager.getSecure('apiKey')).toBe('secret');

      settingsManager.setSecure('apiKey', null);
      expect(settingsManager.getSecure('apiKey')).toBeUndefined();
    });

    test('should delete secure value when set to empty string', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      settingsManager.setSecure('apiKey', 'secret');
      expect(settingsManager.getSecure('apiKey')).toBe('secret');

      settingsManager.setSecure('apiKey', '');
      expect(settingsManager.getSecure('apiKey')).toBeUndefined();
    });

    test('should delete secure value using deleteSecure', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      settingsManager.setSecure('apiKey', 'secret');
      expect(settingsManager.getSecure('apiKey')).toBe('secret');

      settingsManager.deleteSecure('apiKey');
      expect(settingsManager.getSecure('apiKey')).toBeUndefined();
    });
  });

  describe('validation logic', () => {
    test('should validate and set valid OpenAI API key', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      const validKey = 'sk-abcdefghijklmnopqrstuvwxyz1234567890';
      expect(() => {
        settingsManager.setApiKey('openai', validKey);
      }).not.toThrow();

      expect(settingsManager.getSecure('apiKeys.openai')).toBe(validKey);
    });

    test('should validate and set valid Anthropic API key', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      const validKey = 'sk-ant-abcdefghijklmnopqrstuvwxyz1234567890';
      expect(() => {
        settingsManager.setApiKey('anthropic', validKey);
      }).not.toThrow();

      expect(settingsManager.getSecure('apiKeys.anthropic')).toBe(validKey);
    });

    test('should validate and set valid Google API key', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      // Google keys are AIza + exactly 35 characters = 39 total
      const validKey = 'AIzaabcdefghijklmnopqrstuvwxyz123456789';
      expect(() => {
        settingsManager.setApiKey('google', validKey);
      }).not.toThrow();

      expect(settingsManager.getSecure('apiKeys.google')).toBe(validKey);
    });

    test('should reject invalid OpenAI API key', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      expect(() => {
        settingsManager.setApiKey('openai', 'invalid-key');
      }).toThrow('Invalid OpenAI API key format');
    });

    test('should reject invalid Anthropic API key', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      expect(() => {
        settingsManager.setApiKey('anthropic', 'invalid-key');
      }).toThrow('Invalid Anthropic API key format');
    });

    test('should reject invalid Google API key', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      expect(() => {
        settingsManager.setApiKey('google', 'invalid-key');
      }).toThrow('Invalid Google API key format');
    });

    test('should reject empty API key', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      expect(() => {
        settingsManager.setApiKey('openai', '');
      }).toThrow('API key cannot be empty');
    });
  });

  describe('API key management', () => {
    test('should get all API keys', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      const openaiKey = 'sk-abcdefghijklmnopqrstuvwxyz1234567890';
      const anthropicKey = 'sk-ant-abcdefghijklmnopqrstuvwxyz1234567890';
      // Google keys are AIza + exactly 35 characters = 39 total
      const googleKey = 'AIzaabcdefghijklmnopqrstuvwxyz123456789';

      settingsManager.setApiKey('openai', openaiKey);
      settingsManager.setApiKey('anthropic', anthropicKey);
      settingsManager.setApiKey('google', googleKey);

      const allKeys = settingsManager.getApiKeys();
      expect(allKeys.openai).toBe(openaiKey);
      expect(allKeys.anthropic).toBe(anthropicKey);
      expect(allKeys.google).toBe(googleKey);
    });

    test('should check if API keys are configured', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      expect(settingsManager.hasApiKeys()).toBe(false);

      settingsManager.setApiKey('openai', 'sk-abcdefghijklmnopqrstuvwxyz1234567890');
      expect(settingsManager.hasApiKeys()).toBe(true);
    });

    test('should return false for hasApiKeys when all keys are deleted', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      settingsManager.setApiKey('openai', 'sk-abcdefghijklmnopqrstuvwxyz1234567890');
      expect(settingsManager.hasApiKeys()).toBe(true);

      settingsManager.deleteSecure('apiKeys.openai');
      expect(settingsManager.hasApiKeys()).toBe(false);
    });
  });

  describe('default settings', () => {
    test('should have correct default settings', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      expect(settingsManager.get('apiProvider')).toBe('openai');
      expect(settingsManager.get('theme')).toBe('system');
      expect(settingsManager.get('autoUpdate')).toBe(true);
      expect(settingsManager.get('minimizeToTray')).toBe(true);
      expect(settingsManager.get('firstRun')).toBe(true);
    });
  });

  describe('reset functionality', () => {
    test('should reset all settings to defaults', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      // Set custom values
      settingsManager.set('apiProvider', 'anthropic');
      settingsManager.set('theme', 'dark');
      settingsManager.set('autoUpdate', false);
      settingsManager.setApiKey('openai', 'sk-abcdefghijklmnopqrstuvwxyz1234567890');

      // Reset
      settingsManager.reset();

      // Verify defaults are restored
      expect(settingsManager.get('apiProvider')).toBe('openai');
      expect(settingsManager.get('theme')).toBe('system');
      expect(settingsManager.get('autoUpdate')).toBe(true);

      // Verify API keys are cleared
      expect(settingsManager.getSecure('apiKeys.openai')).toBeUndefined();
    });
  });

  describe('file paths', () => {
    test('should return settings file path', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      const path = settingsManager.getPath();
      expect(path).toBeTruthy();
      expect(typeof path).toBe('string');
    });

    test('should return secure settings file path', () => {
      settingsManager = new SettingsManager({
        name: `test-settings-${Date.now()}`,
        secureName: `test-secure-${Date.now()}`,
        encryptionKey: 'test-encryption-key-32-chars!'
      });

      const path = settingsManager.getSecurePath();
      expect(path).toBeTruthy();
      expect(typeof path).toBe('string');
    });
  });
});
