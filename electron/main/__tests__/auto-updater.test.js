/**
 * Unit Tests for Auto-Updater Manager
 * Tests update check logic, notification display, and reminder logic
 * Requirements: 5.1, 5.2, 5.5
 */

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

describe('AutoUpdaterManager', () => {
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

  describe('Initialization', () => {
    test('should configure auto-updater on initialization', () => {
      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);

      expect(autoUpdater.autoDownload).toBe(false);
      expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
      expect(autoUpdater.channel).toBe('stable');
      expect(autoUpdater.logger).toBe(mockLogger);
    });

    test('should register event handlers on initialization', () => {
      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);

      expect(autoUpdater.on).toHaveBeenCalledWith('checking-for-update', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('update-not-available', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('download-progress', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should set main window reference', () => {
      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      // Trigger an event to verify window is set
      const updateAvailableHandler = eventHandlers['update-available'];
      updateAvailableHandler({
        version: '1.0.0',
        releaseDate: new Date().toISOString(),
        releaseNotes: 'Test',
      });

      expect(mockMainWindow.webContents.send).toHaveBeenCalled();
    });
  });

  describe('Update Check Logic', () => {
    test('should check for updates when auto-update is enabled', async () => {
      autoUpdater.checkForUpdates.mockResolvedValue({
        updateInfo: { version: '1.0.0' },
      });

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      await manager.checkForUpdates();

      expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Starting update check', expect.any(Object));
    });

    test('should not check for updates when auto-update is disabled', async () => {
      mockSettingsManager.get = jest.fn((key, defaultValue) => {
        if (key === 'autoUpdate') return false;
        return defaultValue;
      });

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      const result = await manager.checkForUpdates();

      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Auto-update is disabled', expect.any(Object));
    });

    test('should return true when update is available', async () => {
      autoUpdater.currentVersion = { version: '0.1.0' };
      autoUpdater.checkForUpdates.mockResolvedValue({
        updateInfo: { version: '1.0.0' },
      });

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      const result = await manager.checkForUpdates();

      expect(result).toBe(true);
    });

    test('should return false when no update is available', async () => {
      autoUpdater.currentVersion = { version: '1.0.0' };
      autoUpdater.checkForUpdates.mockResolvedValue({
        updateInfo: { version: '1.0.0' },
      });

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      const result = await manager.checkForUpdates();

      expect(result).toBe(false);
    });

    test('should handle errors during update check', async () => {
      autoUpdater.checkForUpdates.mockRejectedValue(new Error('Network error'));

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      const result = await manager.checkForUpdates();

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to check for updates',
        expect.any(Error)
      );
    });
  });

  describe('Notification Display', () => {
    test('should send notification to renderer when update is available', () => {
      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const updateAvailableHandler = eventHandlers['update-available'];
      updateAvailableHandler({
        version: '1.0.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'New features',
      });

      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'update:available',
        expect.objectContaining({
          version: '1.0.0',
          releaseDate: '2024-01-01',
          releaseNotes: 'New features',
        })
      );
    });

    test('should show native dialog when update is available', () => {
      const { dialog } = require('electron');
      
      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const updateAvailableHandler = eventHandlers['update-available'];
      updateAvailableHandler({
        version: '1.0.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'New features',
      });

      expect(dialog.showMessageBoxSync).toHaveBeenCalled();
      const dialogCall = dialog.showMessageBoxSync.mock.calls[0];
      expect(dialogCall[1]).toMatchObject({
        type: 'info',
        title: 'Update Available',
        message: expect.stringContaining('1.0.0'),
      });
    });

    test('should initiate download when user accepts update', () => {
      const { dialog } = require('electron');
      dialog.showMessageBoxSync.mockReturnValue(0); // User clicks "Download Now"

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const updateAvailableHandler = eventHandlers['update-available'];
      updateAvailableHandler({
        version: '1.0.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'New features',
      });

      // downloadUpdate is called asynchronously, so we need to wait
      return new Promise(resolve => {
        setTimeout(() => {
          expect(autoUpdater.downloadUpdate).toHaveBeenCalled();
          resolve();
        }, 10);
      });
    });

    test('should track declined update when user clicks Later', () => {
      const { dialog } = require('electron');
      dialog.showMessageBoxSync.mockReturnValue(1); // User clicks "Later"

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const updateAvailableHandler = eventHandlers['update-available'];
      updateAvailableHandler({
        version: '1.0.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'New features',
      });

      expect(mockSettingsManager.set).toHaveBeenCalledWith('declinedUpdateVersion', '1.0.0');
      expect(mockSettingsManager.set).toHaveBeenCalledWith(
        'declinedUpdateTimestamp',
        expect.any(Number)
      );
    });
  });

  describe('Reminder Logic', () => {
    test('should not show notification for recently declined update', () => {
      const { dialog } = require('electron');
      dialog.showMessageBoxSync.mockClear();

      // Setup: Update was declined 1 hour ago
      const oneHourAgo = Date.now() - (1 * 60 * 60 * 1000);
      mockSettingsManager.get = jest.fn((key, defaultValue) => {
        if (key === 'declinedUpdateVersion') return '1.0.0';
        if (key === 'declinedUpdateTimestamp') return oneHourAgo;
        if (key === 'autoUpdate') return true;
        return defaultValue;
      });

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const updateAvailableHandler = eventHandlers['update-available'];
      updateAvailableHandler({
        version: '1.0.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'New features',
      });

      expect(dialog.showMessageBoxSync).not.toHaveBeenCalled();
    });

    test('should show notification for declined update after 24 hours', () => {
      const { dialog } = require('electron');
      dialog.showMessageBoxSync.mockClear();

      // Setup: Update was declined 25 hours ago
      const twentyFiveHoursAgo = Date.now() - (25 * 60 * 60 * 1000);
      mockSettingsManager.get = jest.fn((key, defaultValue) => {
        if (key === 'declinedUpdateVersion') return '1.0.0';
        if (key === 'declinedUpdateTimestamp') return twentyFiveHoursAgo;
        if (key === 'autoUpdate') return true;
        return defaultValue;
      });

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const updateAvailableHandler = eventHandlers['update-available'];
      updateAvailableHandler({
        version: '1.0.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'New features',
      });

      expect(dialog.showMessageBoxSync).toHaveBeenCalled();
    });

    test('should always show notification for new version', () => {
      const { dialog } = require('electron');
      dialog.showMessageBoxSync.mockClear();

      // Setup: Different version was declined 1 hour ago
      const oneHourAgo = Date.now() - (1 * 60 * 60 * 1000);
      mockSettingsManager.get = jest.fn((key, defaultValue) => {
        if (key === 'declinedUpdateVersion') return '0.9.0';
        if (key === 'declinedUpdateTimestamp') return oneHourAgo;
        if (key === 'autoUpdate') return true;
        return defaultValue;
      });

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const updateAvailableHandler = eventHandlers['update-available'];
      updateAvailableHandler({
        version: '1.0.0', // Different version
        releaseDate: '2024-01-01',
        releaseNotes: 'New features',
      });

      expect(dialog.showMessageBoxSync).toHaveBeenCalled();
    });
  });

  describe('Download and Install', () => {
    beforeEach(() => {
      // Reset download mock for each test
      autoUpdater.downloadUpdate.mockReset();
    });

    test('should download update', async () => {
      autoUpdater.downloadUpdate.mockResolvedValue();

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      await manager.downloadUpdate();

      expect(autoUpdater.downloadUpdate).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Starting update download', expect.any(Object));
    });

    test('should handle download errors', async () => {
      const downloadError = new Error('Download failed');
      autoUpdater.downloadUpdate.mockRejectedValue(downloadError);

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);

      await expect(manager.downloadUpdate()).rejects.toThrow('Download failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to download update',
        expect.any(Error)
      );
    });

    test('should send download progress to renderer', () => {
      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const downloadProgressHandler = eventHandlers['download-progress'];
      downloadProgressHandler({
        percent: 50,
        transferred: 5000000,
        total: 10000000,
      });

      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'update:download-progress',
        expect.objectContaining({
          percent: 50,
          transferred: 5000000,
          total: 10000000,
        })
      );
    });

    test('should notify renderer when update is downloaded', () => {
      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const updateDownloadedHandler = eventHandlers['update-downloaded'];
      updateDownloadedHandler({
        version: '1.0.0',
      });

      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'update:downloaded',
        expect.objectContaining({
          version: '1.0.0',
        })
      );
    });

    test('should quit and install when user accepts', () => {
      const { dialog } = require('electron');
      dialog.showMessageBoxSync.mockReturnValue(0); // User clicks "Restart Now"

      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const updateDownloadedHandler = eventHandlers['update-downloaded'];
      updateDownloadedHandler({
        version: '1.0.0',
      });

      expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle update errors', () => {
      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const errorHandler = eventHandlers['error'];
      errorHandler(new Error('Update failed'));

      expect(mockLogger.error).toHaveBeenCalledWith('Update error', expect.any(Error));
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'update:error',
        expect.objectContaining({
          message: 'Update failed',
        })
      );
    });
  });

  describe('Status', () => {
    test('should return current status', () => {
      // Reset autoUpdater version for this test
      autoUpdater.currentVersion = { version: '0.1.0' };
      
      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);

      const status = manager.getStatus();

      expect(status).toMatchObject({
        updateAvailable: false,
        updateInfo: null,
        downloadProgress: 0,
        currentVersion: '0.1.0',
      });
    });

    test('should update status when update is available', () => {
      const manager = new AutoUpdaterManager(mockSettingsManager, mockLogger);
      manager.setMainWindow(mockMainWindow);

      const updateAvailableHandler = eventHandlers['update-available'];
      updateAvailableHandler({
        version: '1.0.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'New features',
      });

      const status = manager.getStatus();

      expect(status.updateAvailable).toBe(true);
      expect(status.updateInfo).toMatchObject({
        version: '1.0.0',
      });
    });
  });
});
