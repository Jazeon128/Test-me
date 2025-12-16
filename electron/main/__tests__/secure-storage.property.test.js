/**
 * Property-Based Tests for Secure Storage
 * Feature: standalone-desktop-app, Property 12: API key secure storage
 * Validates: Requirements 4.3
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');
const SettingsManager = require('../settings-manager');

describe('Secure Storage Properties', () => {
  let tempDir;
  let settingsManager;

  beforeEach(() => {
    // Create a temporary directory for test settings
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
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

  describe('Property 12: API key secure storage', () => {
    test('stored API keys should not be readable as plain text in the file', () => {
      fc.assert(
        fc.property(
          // Generate provider and matching API key together
          fc.oneof(
            fc.tuple(
              fc.constant('openai'),
              fc.oneof(
                fc.tuple(
                  fc.constant('sk-'),
                  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 20, maxLength: 48 })
                ).map(([prefix, suffix]) => prefix + suffix),
                fc.tuple(
                  fc.constant('sk-proj-'),
                  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 20, maxLength: 48 })
                ).map(([prefix, suffix]) => prefix + suffix)
              )
            ),
            fc.tuple(
              fc.constant('anthropic'),
              fc.tuple(
                fc.constant('sk-ant-'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')), { minLength: 20, maxLength: 48 })
              ).map(([prefix, suffix]) => prefix + suffix)
            ),
            fc.tuple(
              fc.constant('google'),
              fc.tuple(
                fc.constant('AIza'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')), { minLength: 35, maxLength: 35 })
              ).map(([prefix, suffix]) => prefix + suffix)
            )
          ),
          ([provider, apiKey]) => {
            // Create settings manager with temp directory
            settingsManager = new SettingsManager({
              name: `test-settings-${Date.now()}`,
              secureName: `test-secure-${Date.now()}`,
              encryptionKey: 'test-encryption-key-32-chars!'
            });

            // Store the API key
            settingsManager.setApiKey(provider, apiKey);

            // Get the secure settings file path
            const secureFilePath = settingsManager.getSecurePath();

            // Read the file contents
            const fileContents = fs.readFileSync(secureFilePath, 'utf8');

            // The API key should NOT appear in plain text in the file
            expect(fileContents).not.toContain(apiKey);

            // The file should contain some encrypted data (not empty)
            expect(fileContents.length).toBeGreaterThan(0);

            // Verify we can still retrieve the key correctly
            const retrievedKey = settingsManager.getSecure(`apiKeys.${provider}`);
            expect(retrievedKey).toBe(apiKey);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('API keys should be encrypted differently even with same value', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constant('sk-'),
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 20, maxLength: 48 })
          ).map(([prefix, suffix]) => prefix + suffix),
          (apiKey) => {
            // Create two separate settings managers
            const manager1 = new SettingsManager({
              name: `test-settings-1-${Date.now()}`,
              secureName: `test-secure-1-${Date.now()}`,
              encryptionKey: 'test-encryption-key-32-chars!'
            });

            const manager2 = new SettingsManager({
              name: `test-settings-2-${Date.now()}`,
              secureName: `test-secure-2-${Date.now()}`,
              encryptionKey: 'different-encryption-key-32!!'
            });

            // Store the same API key in both
            manager1.setApiKey('openai', apiKey);
            manager2.setApiKey('openai', apiKey);

            // Read both file contents
            const file1Contents = fs.readFileSync(manager1.getSecurePath(), 'utf8');
            const file2Contents = fs.readFileSync(manager2.getSecurePath(), 'utf8');

            // The encrypted contents should be different (different encryption keys)
            expect(file1Contents).not.toBe(file2Contents);

            // Both should still retrieve the correct key
            expect(manager1.getSecure('apiKeys.openai')).toBe(apiKey);
            expect(manager2.getSecure('apiKeys.openai')).toBe(apiKey);

            // Cleanup
            manager1.reset();
            manager2.reset();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('deleting API keys should remove them from storage', () => {
      fc.assert(
        fc.property(
          // Generate provider and matching API key together
          fc.oneof(
            fc.tuple(
              fc.constant('openai'),
              fc.tuple(
                fc.constant('sk-'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 20, maxLength: 48 })
              ).map(([prefix, suffix]) => prefix + suffix)
            ),
            fc.tuple(
              fc.constant('anthropic'),
              fc.tuple(
                fc.constant('sk-ant-'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')), { minLength: 20, maxLength: 48 })
              ).map(([prefix, suffix]) => prefix + suffix)
            ),
            fc.tuple(
              fc.constant('google'),
              fc.tuple(
                fc.constant('AIza'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')), { minLength: 35, maxLength: 35 })
              ).map(([prefix, suffix]) => prefix + suffix)
            )
          ),
          ([provider, apiKey]) => {
            settingsManager = new SettingsManager({
              name: `test-settings-${Date.now()}`,
              secureName: `test-secure-${Date.now()}`,
              encryptionKey: 'test-encryption-key-32-chars!'
            });

            // Store the API key
            settingsManager.setApiKey(provider, apiKey);

            // Verify it's stored
            expect(settingsManager.getSecure(`apiKeys.${provider}`)).toBe(apiKey);

            // Delete the key
            settingsManager.deleteSecure(`apiKeys.${provider}`);

            // Verify it's gone
            expect(settingsManager.getSecure(`apiKeys.${provider}`)).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('setting empty or null API key should delete it', () => {
      fc.assert(
        fc.property(
          // Generate provider and matching API key together
          fc.oneof(
            fc.tuple(
              fc.constant('openai'),
              fc.tuple(
                fc.constant('sk-'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 20, maxLength: 48 })
              ).map(([prefix, suffix]) => prefix + suffix)
            ),
            fc.tuple(
              fc.constant('anthropic'),
              fc.tuple(
                fc.constant('sk-ant-'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')), { minLength: 20, maxLength: 48 })
              ).map(([prefix, suffix]) => prefix + suffix)
            ),
            fc.tuple(
              fc.constant('google'),
              fc.tuple(
                fc.constant('AIza'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')), { minLength: 35, maxLength: 35 })
              ).map(([prefix, suffix]) => prefix + suffix)
            )
          ),
          ([provider, apiKey]) => {
            settingsManager = new SettingsManager({
              name: `test-settings-${Date.now()}`,
              secureName: `test-secure-${Date.now()}`,
              encryptionKey: 'test-encryption-key-32-chars!'
            });

            // Store the API key
            settingsManager.setApiKey(provider, apiKey);

            // Verify it's stored
            expect(settingsManager.getSecure(`apiKeys.${provider}`)).toBe(apiKey);

            // Set to empty/null using setSecure (bypassing validation)
            settingsManager.setSecure(`apiKeys.${provider}`, null);

            // Verify it's gone
            expect(settingsManager.getSecure(`apiKeys.${provider}`)).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple API keys can be stored independently', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constant('sk-'),
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 20, maxLength: 48 })
          ).map(([prefix, suffix]) => prefix + suffix),
          fc.tuple(
            fc.constant('sk-ant-'),
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')), { minLength: 20, maxLength: 48 })
          ).map(([prefix, suffix]) => prefix + suffix),
          fc.tuple(
            fc.constant('AIza'),
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')), { minLength: 35, maxLength: 35 })
          ).map(([prefix, suffix]) => prefix + suffix),
          (openaiKey, anthropicKey, googleKey) => {
            settingsManager = new SettingsManager({
              name: `test-settings-${Date.now()}`,
              secureName: `test-secure-${Date.now()}`,
              encryptionKey: 'test-encryption-key-32-chars!'
            });

            // Store all three keys
            settingsManager.setApiKey('openai', openaiKey);
            settingsManager.setApiKey('anthropic', anthropicKey);
            settingsManager.setApiKey('google', googleKey);

            // Verify all are stored correctly
            expect(settingsManager.getSecure('apiKeys.openai')).toBe(openaiKey);
            expect(settingsManager.getSecure('apiKeys.anthropic')).toBe(anthropicKey);
            expect(settingsManager.getSecure('apiKeys.google')).toBe(googleKey);

            // Verify getApiKeys returns all
            const allKeys = settingsManager.getApiKeys();
            expect(allKeys.openai).toBe(openaiKey);
            expect(allKeys.anthropic).toBe(anthropicKey);
            expect(allKeys.google).toBe(googleKey);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
