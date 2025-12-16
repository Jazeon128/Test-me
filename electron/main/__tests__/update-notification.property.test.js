/**
 * Property-Based Tests for Auto-Updater - Update Notification
 * Feature: standalone-desktop-app, Property 23: Update notification
 * Validates: Requirements 5.2
 * 
 * Property 23: Update notification
 * For any available update, the application should display an update notification to the user.
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

describe('Property 23: Update notification', () => {
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
   * Property: For any available update, a notification should be sent to the renderer
   */
  test('should send notification to renderer when update is available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.constantFrom('0.2.0', '1.0.0', '2.5.3', '3.0.0'),
          releaseDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          releaseNotes: fc.constantFrom(
            'Bug fixes and improvements',
            'New features added',
            'Performance enhancements',
            'Security updates'
          ),
        }),
        async (updateInfo) => {
          // Setup
          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
          manager.setMainWindow(mockMainWindow);

          // Simulate update available event
          const updateAvailableHandler = eventHandlers['update-available'];
          expect(updateAvailableHandler).toBeDefined();

          // Act: Trigger update available
          updateAvailableHandler({
            version: updateInfo.version,
            releaseDate: updateInfo.releaseDate.toISOString(),
            releaseNotes: updateInfo.releaseNotes,
          });

          // Assert: Notification should be sent to renderer
          expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
            'update:available',
            expect.objectContaining({
              version: updateInfo.version,
              releaseDate: updateInfo.releaseDate.toISOString(),
              releaseNotes: updateInfo.releaseNotes,
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any available update, a native dialog should be shown
   */
  test('should show native dialog when update is available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.constantFrom('0.2.0', '1.0.0', '2.5.3'),
        }),
        async (updateInfo) => {
          // Setup
          const { dialog } = require('electron');
          dialog.showMessageBoxSync.mockClear();

          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
          manager.setMainWindow(mockMainWindow);

          // Simulate update available event
          const updateAvailableHandler = eventHandlers['update-available'];

          // Act: Trigger update available
          updateAvailableHandler({
            version: updateInfo.version,
            releaseDate: new Date().toISOString(),
            releaseNotes: 'Test release notes',
          });

          // Assert: Native dialog should be shown
          expect(dialog.showMessageBoxSync).toHaveBeenCalled();
          const dialogCall = dialog.showMessageBoxSync.mock.calls[0];
          expect(dialogCall[1]).toMatchObject({
            type: 'info',
            title: 'Update Available',
            message: expect.stringContaining(updateInfo.version),
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any declined update, the version should be tracked
   */
  test('should track declined updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.constantFrom('0.2.0', '1.0.0', '2.5.3'),
        }),
        async (updateInfo) => {
          // Setup
          const { dialog } = require('electron');
          dialog.showMessageBoxSync.mockReturnValue(1); // User clicks "Later"

          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
          manager.setMainWindow(mockMainWindow);

          // Simulate update available event
          const updateAvailableHandler = eventHandlers['update-available'];

          // Act: Trigger update available and user declines
          updateAvailableHandler({
            version: updateInfo.version,
            releaseDate: new Date().toISOString(),
            releaseNotes: 'Test release notes',
          });

          // Assert: Declined version should be tracked
          expect(mockSettingsManager.set).toHaveBeenCalledWith(
            'declinedUpdateVersion',
            updateInfo.version
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
   * Property: For any accepted update, download should be initiated
   */
  test('should initiate download when user accepts update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.constantFrom('0.2.0', '1.0.0', '2.5.3'),
        }),
        async (updateInfo) => {
          // Setup
          const { dialog } = require('electron');
          dialog.showMessageBoxSync.mockReturnValue(0); // User clicks "Download Now"
          autoUpdater.downloadUpdate.mockClear();

          const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
          manager.setMainWindow(mockMainWindow);

          // Simulate update available event
          const updateAvailableHandler = eventHandlers['update-available'];

          // Act: Trigger update available and user accepts
          updateAvailableHandler({
            version: updateInfo.version,
            releaseDate: new Date().toISOString(),
            releaseNotes: 'Test release notes',
          });

          // Wait for async operations
          await new Promise(resolve => setTimeout(resolve, 10));

          // Assert: Download should be initiated
          expect(autoUpdater.downloadUpdate).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any previously declined update, notification should be skipped
   * unless enough time has passed
   */
  test('should skip notification for recently declined updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.constantFrom('0.2.0', '1.0.0'),
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

          // Assert: Dialog should not be shown (notification skipped)
          expect(dialog.showMessageBoxSync).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any previously declined update after 24+ hours,
   * notification should be shown again
   */
  test('should show notification for declined updates after 24 hours', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.constantFrom('0.2.0', '1.0.0'),
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
});
