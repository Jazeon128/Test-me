/**
 * Property-Based Tests for Auto-Updater - Update Reminder
 * Feature: standalone-desktop-app, Property 24: Update reminder
 * Validates: Requirements 5.5
 * 
 * Property 24: Update reminder
 * For any declined update, the application should display a reminder on the next startup.
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

describe('Property 24: Update reminder', () => {
  let mockSettingsManager;
  let mockLogger;
  let mockMainWindow;
  let autoUpdater;
  let eventHandlers;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get the mocked autoUpdater
    const { autoUpdater: mockedAutoUpdater } = require('electron-updater');
    autoUpdater = mockedAutoUpdater;
    
    // Track event handlers
    eventHandlers = {};
    autoUpdater.on = jest.fn((event, handler) => {
      eventHandlers[event] = handler;
    });
    
    // Create mock settings manager
    mockSettingsManager = {
      get: jest.fn((key, defaultValue) => {
        if (key === 'autoUpdate') return true;
        if (key === 'updateChannel') return 'stable';
        if (key === 'declinedUpdateVersion') return null;
        if (key === 'declinedUpdateTimestamp') return 0;
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

    // Create mock main window
    mockMainWindow = {
      webContents: {
        send: jest.fn(),
      },
      isDestroyed: jest.fn(() => false),
    };
  });

  /**
   * Property: For any declined update, the version and timestamp should be stored
   */
  test('should store declined update version and timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.constantFrom('0.2.0', '1.0.0', '2.5.3', '3.0.0'),
        }),
        async (config) => {
          // Setup
          const { dialog } = require('electron');
          dialog.showMessageBoxSync.mockReturnValue(1); // User clicks "Later"

          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
          manager.setMainWindow(mockMainWindow);

          // Simulate update available event
          const updateAvailableHandler = eventHandlers['update-available'];

          // Act: Trigger update available and user declines
          updateAvailableHandler({
            version: config.version,
            releaseDate: new Date().toISOString(),
            releaseNotes: 'Test release notes',
          });

          // Assert: Version and timestamp should be stored
          expect(mockSettingsManager.set).toHaveBeenCalledWith(
            'declinedUpdateVersion',
            config.version
          );
          expect(mockSettingsManager.set).toHaveBeenCalledWith(
            'declinedUpdateTimestamp',
            expect.any(Number)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any declined update within 24 hours, reminder should not be shown
   */
  test('should not show reminder for recently declined updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.constantFrom('0.2.0', '1.0.0', '2.5.3'),
          hoursSinceDeclined: fc.integer({ min: 0, max: 23 }), // Less than 24 hours
        }),
        async (config) => {
          // Setup
          const declinedTimestamp = Date.now() - (config.hoursSinceDeclined * 60 * 60 * 1000);
          mockSettingsManager.get = jest.fn((key, defaultValue) => {
            if (key === 'declinedUpdateVersion') return config.version;
            if (key === 'declinedUpdateTimestamp') return declinedTimestamp;
            if (key === 'autoUpdate') return true;
            return defaultValue;
          });

          const { dialog } = require('electron');
          dialog.showMessageBoxSync.mockClear();

          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
          manager.setMainWindow(mockMainWindow);

          // Simulate update available event with same version
          const updateAvailableHandler = eventHandlers['update-available'];

          // Act: Trigger update available
          updateAvailableHandler({
            version: config.version,
            releaseDate: new Date().toISOString(),
            releaseNotes: 'Test release notes',
          });

          // Assert: Dialog should not be shown (no reminder yet)
          expect(dialog.showMessageBoxSync).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any declined update after 24+ hours, reminder should be shown
   */
  test('should show reminder for declined updates after 24 hours', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.constantFrom('0.2.0', '1.0.0', '2.5.3'),
          hoursSinceDeclined: fc.integer({ min: 24, max: 168 }), // 24 hours to 1 week
        }),
        async (config) => {
          // Setup
          const declinedTimestamp = Date.now() - (config.hoursSinceDeclined * 60 * 60 * 1000);
          mockSettingsManager.get = jest.fn((key, defaultValue) => {
            if (key === 'declinedUpdateVersion') return config.version;
            if (key === 'declinedUpdateTimestamp') return declinedTimestamp;
            if (key === 'autoUpdate') return true;
            return defaultValue;
          });

          const { dialog } = require('electron');
          dialog.showMessageBoxSync.mockClear();

          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
          manager.setMainWindow(mockMainWindow);

          // Simulate update available event with same version
          const updateAvailableHandler = eventHandlers['update-available'];

          // Act: Trigger update available
          updateAvailableHandler({
            version: config.version,
            releaseDate: new Date().toISOString(),
            releaseNotes: 'Test release notes',
          });

          // Assert: Dialog should be shown (reminder after 24 hours)
          expect(dialog.showMessageBoxSync).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any new version (different from declined), reminder should always be shown
   */
  test('should always show reminder for new versions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          declinedVersion: fc.constantFrom('0.2.0', '1.0.0'),
          newVersion: fc.constantFrom('0.3.0', '1.1.0', '2.0.0'),
          hoursSinceDeclined: fc.integer({ min: 0, max: 23 }), // Even if less than 24 hours
        }),
        async (config) => {
          // Ensure versions are different
          fc.pre(config.declinedVersion !== config.newVersion);

          // Setup
          const declinedTimestamp = Date.now() - (config.hoursSinceDeclined * 60 * 60 * 1000);
          mockSettingsManager.get = jest.fn((key, defaultValue) => {
            if (key === 'declinedUpdateVersion') return config.declinedVersion;
            if (key === 'declinedUpdateTimestamp') return declinedTimestamp;
            if (key === 'autoUpdate') return true;
            return defaultValue;
          });

          const { dialog } = require('electron');
          dialog.showMessageBoxSync.mockClear();

          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
          manager.setMainWindow(mockMainWindow);

          // Simulate update available event with new version
          const updateAvailableHandler = eventHandlers['update-available'];

          // Act: Trigger update available with different version
          updateAvailableHandler({
            version: config.newVersion,
            releaseDate: new Date().toISOString(),
            releaseNotes: 'Test release notes',
          });

          // Assert: Dialog should be shown (new version always shows)
          expect(dialog.showMessageBoxSync).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any declined update, declining again should update the timestamp
   */
  test('should update timestamp when declining same update again', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.constantFrom('0.2.0', '1.0.0'),
          firstDeclineHoursAgo: fc.integer({ min: 24, max: 48 }),
        }),
        async (config) => {
          // Setup - first decline was 24+ hours ago
          const firstDeclineTimestamp = Date.now() - (config.firstDeclineHoursAgo * 60 * 60 * 1000);
          mockSettingsManager.get = jest.fn((key, defaultValue) => {
            if (key === 'declinedUpdateVersion') return config.version;
            if (key === 'declinedUpdateTimestamp') return firstDeclineTimestamp;
            if (key === 'autoUpdate') return true;
            return defaultValue;
          });

          const { dialog } = require('electron');
          dialog.showMessageBoxSync.mockReturnValue(1); // User clicks "Later" again

          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
          manager.setMainWindow(mockMainWindow);

          // Simulate update available event
          const updateAvailableHandler = eventHandlers['update-available'];

          // Act: Trigger update available and user declines again
          updateAvailableHandler({
            version: config.version,
            releaseDate: new Date().toISOString(),
            releaseNotes: 'Test release notes',
          });

          // Assert: Timestamp should be updated (new decline)
          expect(mockSettingsManager.set).toHaveBeenCalledWith(
            'declinedUpdateTimestamp',
            expect.any(Number)
          );
          
          // The new timestamp should be more recent than the first decline
          const newTimestamp = mockSettingsManager.set.mock.calls.find(
            call => call[0] === 'declinedUpdateTimestamp'
          )[1];
          expect(newTimestamp).toBeGreaterThan(firstDeclineTimestamp);
        }
      ),
      { numRuns: 100 }
    );
  });
});
