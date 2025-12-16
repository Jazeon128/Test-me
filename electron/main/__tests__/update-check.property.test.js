/**
 * Property-Based Tests for Auto-Updater - Update Check
 * Feature: standalone-desktop-app, Property 22: Update check on startup
 * Validates: Requirements 5.1
 * 
 * Property 22: Update check on startup
 * For any application launch, an update check request should be made to the release server.
 */

const fc = require('fast-check');
const AutoUpdaterManager = require('../auto-updater');

// Mock electron-updater
jest.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    channel: 'stable',
    logger: null,
    currentVersion: { version: '0.1.0' },
    on: jest.fn(),
    checkForUpdates: jest.fn(),
    downloadUpdate: jest.fn(),
    quitAndInstall: jest.fn(),
  },
}));

// Mock electron dialog
jest.mock('electron', () => ({
  dialog: {
    showMessageBoxSync: jest.fn(() => 1), // Default to "Later"
  },
}));

describe('Property 22: Update check on startup', () => {
  let mockSettingsManager;
  let mockLogger;
  let autoUpdater;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get the mocked autoUpdater
    const { autoUpdater: mockedAutoUpdater } = require('electron-updater');
    autoUpdater = mockedAutoUpdater;
    
    // Create mock settings manager
    mockSettingsManager = {
      get: jest.fn((key, defaultValue) => {
        if (key === 'autoUpdate') return true;
        if (key === 'updateChannel') return 'stable';
        return defaultValue;
      }),
      set: jest.fn(),
    };

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
  });

  /**
   * Property: For any application launch with auto-update enabled,
   * checkForUpdates should trigger a call to the update server
   */
  test('should check for updates when auto-update is enabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          autoUpdateEnabled: fc.constant(true),
          updateChannel: fc.constantFrom('stable', 'beta', 'alpha'),
          hasUpdate: fc.boolean(),
          currentVersion: fc.constantFrom('0.1.0', '1.0.0', '2.5.3'),
          newVersion: fc.constantFrom('0.2.0', '1.1.0', '3.0.0'),
        }),
        async (config) => {
          // Setup
          mockSettingsManager.get = jest.fn((key, defaultValue) => {
            if (key === 'autoUpdate') return config.autoUpdateEnabled;
            if (key === 'updateChannel') return config.updateChannel;
            return defaultValue;
          });

          autoUpdater.currentVersion = { version: config.currentVersion };
          autoUpdater.checkForUpdates = jest.fn().mockResolvedValue({
            updateInfo: {
              version: config.hasUpdate ? config.newVersion : config.currentVersion,
            },
          });

          // Create auto-updater manager
          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);

          // Act: Check for updates
          await manager.checkForUpdates();

          // Assert: checkForUpdates should have been called
          expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
          expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any application launch with auto-update disabled,
   * checkForUpdates should not trigger a call to the update server
   */
  test('should not check for updates when auto-update is disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          autoUpdateEnabled: fc.constant(false),
          updateChannel: fc.constantFrom('stable', 'beta', 'alpha'),
        }),
        async (config) => {
          // Setup
          mockSettingsManager.get = jest.fn((key, defaultValue) => {
            if (key === 'autoUpdate') return config.autoUpdateEnabled;
            if (key === 'updateChannel') return config.updateChannel;
            return defaultValue;
          });

          autoUpdater.checkForUpdates = jest.fn();

          // Create auto-updater manager
          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);

          // Act: Check for updates
          const result = await manager.checkForUpdates();

          // Assert: checkForUpdates should not have been called
          expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any update check that completes successfully,
   * the result should indicate whether an update is available
   */
  test('should correctly report update availability', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          currentVersion: fc.constantFrom('0.1.0', '1.0.0', '2.5.3'),
          serverVersion: fc.constantFrom('0.2.0', '1.1.0', '3.0.0', '0.1.0', '1.0.0'),
        }),
        async (config) => {
          // Setup
          mockSettingsManager.get = jest.fn((key, defaultValue) => {
            if (key === 'autoUpdate') return true;
            return defaultValue;
          });

          autoUpdater.currentVersion = { version: config.currentVersion };
          autoUpdater.checkForUpdates = jest.fn().mockResolvedValue({
            updateInfo: {
              version: config.serverVersion,
            },
          });

          // Create auto-updater manager
          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);

          // Act: Check for updates
          const hasUpdate = await manager.checkForUpdates();

          // Assert: Result should match whether versions differ
          const expectedHasUpdate = config.currentVersion !== config.serverVersion;
          expect(hasUpdate).toBe(expectedHasUpdate);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any update check that fails,
   * the error should be logged and false should be returned
   */
  test('should handle update check errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorMessage: fc.constantFrom(
            'Network error',
            'Server unavailable',
            'Invalid response',
            'Timeout'
          ),
        }),
        async (config) => {
          // Setup
          mockSettingsManager.get = jest.fn((key, defaultValue) => {
            if (key === 'autoUpdate') return true;
            return defaultValue;
          });

          autoUpdater.checkForUpdates = jest.fn().mockRejectedValue(
            new Error(config.errorMessage)
          );

          // Create auto-updater manager
          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);

          // Act: Check for updates
          const result = await manager.checkForUpdates();

          // Assert: Should return false and log error
          expect(result).toBe(false);
          expect(mockLogger.error).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
