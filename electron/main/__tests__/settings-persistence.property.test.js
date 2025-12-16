/**
 * Property-Based Tests for Settings Persistence
 * Feature: standalone-desktop-app, Property 4: Settings persistence round-trip
 * Validates: Requirements 3.5
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');
const SettingsManager = require('../settings-manager');

describe('Settings Persistence Properties', () => {
  let tempDir;

  beforeEach(() => {
    // Create a temporary directory for test settings
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
  });

  afterEach(() => {
    // Remove temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Property 4: Settings persistence round-trip', () => {
    test('settings should persist across SettingsManager instances', () => {
      fc.assert(
        fc.property(
          fc.record({
            apiProvider: fc.constantFrom('openai', 'anthropic', 'google'),
            theme: fc.constantFrom('light', 'dark', 'system'),
            autoUpdate: fc.boolean(),
            minimizeToTray: fc.boolean(),
            firstRun: fc.boolean()
          }),
          (settings) => {
            const settingsName = `test-settings-${Date.now()}`;
            const encryptionKey = 'test-encryption-key-32-chars!';

            // Create first instance and set settings
            const manager1 = new SettingsManager({
              name: settingsName,
              secureName: `secure-${settingsName}`,
              encryptionKey
            });

            manager1.set('apiProvider', settings.apiProvider);
            manager1.set('theme', settings.theme);
            manager1.set('autoUpdate', settings.autoUpdate);
            manager1.set('minimizeToTray', settings.minimizeToTray);
            manager1.set('firstRun', settings.firstRun);

            // Create second instance with same name (simulating app restart)
            const manager2 = new SettingsManager({
              name: settingsName,
              secureName: `secure-${settingsName}`,
              encryptionKey
            });

            // Verify all settings persisted
            expect(manager2.get('apiProvider')).toBe(settings.apiProvider);
            expect(manager2.get('theme')).toBe(settings.theme);
            expect(manager2.get('autoUpdate')).toBe(settings.autoUpdate);
            expect(manager2.get('minimizeToTray')).toBe(settings.minimizeToTray);
            expect(manager2.get('firstRun')).toBe(settings.firstRun);

            // Cleanup
            manager1.reset();
            manager2.reset();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('API keys should persist across SettingsManager instances', () => {
      fc.assert(
        fc.property(
          fc.record({
            openai: fc.option(
              fc.tuple(
                fc.constant('sk-'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 20, maxLength: 48 })
              ).map(([prefix, suffix]) => prefix + suffix),
              { nil: null }
            ),
            anthropic: fc.option(
              fc.tuple(
                fc.constant('sk-ant-'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')), { minLength: 20, maxLength: 48 })
              ).map(([prefix, suffix]) => prefix + suffix),
              { nil: null }
            ),
            google: fc.option(
              fc.tuple(
                fc.constant('AIza'),
                fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')), { minLength: 35, maxLength: 35 })
              ).map(([prefix, suffix]) => prefix + suffix),
              { nil: null }
            )
          }),
          (apiKeys) => {
            const settingsName = `test-settings-${Date.now()}`;
            const encryptionKey = 'test-encryption-key-32-chars!';

            // Create first instance and set API keys
            const manager1 = new SettingsManager({
              name: settingsName,
              secureName: `secure-${settingsName}`,
              encryptionKey
            });

            if (apiKeys.openai) {
              manager1.setApiKey('openai', apiKeys.openai);
            }
            if (apiKeys.anthropic) {
              manager1.setApiKey('anthropic', apiKeys.anthropic);
            }
            if (apiKeys.google) {
              manager1.setApiKey('google', apiKeys.google);
            }

            // Create second instance with same name (simulating app restart)
            const manager2 = new SettingsManager({
              name: settingsName,
              secureName: `secure-${settingsName}`,
              encryptionKey
            });

            // Verify all API keys persisted
            const retrievedKeys = manager2.getApiKeys();
            // Note: getApiKeys returns undefined for unset keys, not null
            expect(retrievedKeys.openai).toBe(apiKeys.openai || undefined);
            expect(retrievedKeys.anthropic).toBe(apiKeys.anthropic || undefined);
            expect(retrievedKeys.google).toBe(apiKeys.google || undefined);

            // Cleanup
            manager1.reset();
            manager2.reset();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('mixed settings and API keys should persist together', () => {
      fc.assert(
        fc.property(
          fc.record({
            settings: fc.record({
              apiProvider: fc.constantFrom('openai', 'anthropic', 'google'),
              theme: fc.constantFrom('light', 'dark', 'system'),
              autoUpdate: fc.boolean(),
              minimizeToTray: fc.boolean()
            }),
            apiKey: fc.oneof(
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
            )
          }),
          (data) => {
            const settingsName = `test-settings-${Date.now()}`;
            const encryptionKey = 'test-encryption-key-32-chars!';

            // Create first instance and set both settings and API key
            const manager1 = new SettingsManager({
              name: settingsName,
              secureName: `secure-${settingsName}`,
              encryptionKey
            });

            manager1.set('apiProvider', data.settings.apiProvider);
            manager1.set('theme', data.settings.theme);
            manager1.set('autoUpdate', data.settings.autoUpdate);
            manager1.set('minimizeToTray', data.settings.minimizeToTray);

            const [provider, key] = data.apiKey;
            manager1.setApiKey(provider, key);

            // Create second instance (simulating app restart)
            const manager2 = new SettingsManager({
              name: settingsName,
              secureName: `secure-${settingsName}`,
              encryptionKey
            });

            // Verify settings persisted
            expect(manager2.get('apiProvider')).toBe(data.settings.apiProvider);
            expect(manager2.get('theme')).toBe(data.settings.theme);
            expect(manager2.get('autoUpdate')).toBe(data.settings.autoUpdate);
            expect(manager2.get('minimizeToTray')).toBe(data.settings.minimizeToTray);

            // Verify API key persisted
            expect(manager2.getSecure(`apiKeys.${provider}`)).toBe(key);

            // Cleanup
            manager1.reset();
            manager2.reset();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('default settings should be available on first access', () => {
      fc.assert(
        fc.property(
          fc.constant(null), // No input needed
          () => {
            const settingsName = `test-settings-${Date.now()}`;
            const encryptionKey = 'test-encryption-key-32-chars!';

            const manager = new SettingsManager({
              name: settingsName,
              secureName: `secure-${settingsName}`,
              encryptionKey
            });

            // Default settings should be available
            expect(manager.get('apiProvider')).toBe('openai');
            expect(manager.get('theme')).toBe('system');
            expect(manager.get('autoUpdate')).toBe(true);
            expect(manager.get('minimizeToTray')).toBe(true);
            expect(manager.get('firstRun')).toBe(true);

            // Cleanup
            manager.reset();
          }
        ),
        { numRuns: 10 }
      );
    });

    test('updating a setting should not affect other settings', () => {
      fc.assert(
        fc.property(
          fc.record({
            initial: fc.record({
              apiProvider: fc.constantFrom('openai', 'anthropic', 'google'),
              theme: fc.constantFrom('light', 'dark', 'system'),
              autoUpdate: fc.boolean()
            }),
            update: fc.record({
              key: fc.constantFrom('apiProvider', 'theme', 'autoUpdate'),
              value: fc.oneof(
                fc.constantFrom('openai', 'anthropic', 'google'),
                fc.constantFrom('light', 'dark', 'system'),
                fc.boolean()
              )
            })
          }),
          (data) => {
            const settingsName = `test-settings-${Date.now()}`;
            const encryptionKey = 'test-encryption-key-32-chars!';

            const manager = new SettingsManager({
              name: settingsName,
              secureName: `secure-${settingsName}`,
              encryptionKey
            });

            // Set initial settings
            manager.set('apiProvider', data.initial.apiProvider);
            manager.set('theme', data.initial.theme);
            manager.set('autoUpdate', data.initial.autoUpdate);

            // Update one setting
            manager.set(data.update.key, data.update.value);

            // Verify the updated setting changed
            expect(manager.get(data.update.key)).toBe(data.update.value);

            // Verify other settings remained unchanged
            const otherKeys = ['apiProvider', 'theme', 'autoUpdate'].filter(k => k !== data.update.key);
            for (const key of otherKeys) {
              expect(manager.get(key)).toBe(data.initial[key]);
            }

            // Cleanup
            manager.reset();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('reset should clear all settings and restore defaults', () => {
      fc.assert(
        fc.property(
          fc.record({
            apiProvider: fc.constantFrom('openai', 'anthropic', 'google'),
            theme: fc.constantFrom('light', 'dark', 'system'),
            autoUpdate: fc.boolean(),
            apiKey: fc.tuple(
              fc.constant('sk-'),
              fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 20, maxLength: 48 })
            ).map(([prefix, suffix]) => prefix + suffix)
          }),
          (data) => {
            const settingsName = `test-settings-${Date.now()}`;
            const encryptionKey = 'test-encryption-key-32-chars!';

            const manager = new SettingsManager({
              name: settingsName,
              secureName: `secure-${settingsName}`,
              encryptionKey
            });

            // Set custom settings and API key
            manager.set('apiProvider', data.apiProvider);
            manager.set('theme', data.theme);
            manager.set('autoUpdate', data.autoUpdate);
            manager.setApiKey('openai', data.apiKey);

            // Reset
            manager.reset();

            // Verify defaults are restored
            expect(manager.get('apiProvider')).toBe('openai');
            expect(manager.get('theme')).toBe('system');
            expect(manager.get('autoUpdate')).toBe(true);

            // Verify API key is cleared
            expect(manager.getSecure('apiKeys.openai')).toBeUndefined();

            // Cleanup
            manager.reset();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
