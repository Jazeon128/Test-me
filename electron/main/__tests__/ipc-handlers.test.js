/**
 * Unit Tests for IPC Handlers
 * Tests each IPC channel, error handling, and response formats
 * Requirements 9.1, 9.2: Native dialogs and application info access
 */

const { ipcMain, dialog, app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { setupIpcHandlers, removeIpcHandlers } = require('../ipc-handlers');

// Mock electron modules
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
  },
  app: {
    getVersion: jest.fn(() => '1.0.0'),
    getName: jest.fn(() => 'FlashLearn'),
    getPath: jest.fn((name) => {
      if (name === 'userData') return '/mock/user/data';
      if (name === 'appData') return '/mock/app/data';
      if (name === 'temp') return '/mock/temp';
      if (name === 'logs') return '/mock/logs';
      return '/mock/path';
    }),
    quit: jest.fn(),
  },
}));

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    copyFile: jest.fn(),
  },
}));

describe('IPC Handlers', () => {
  let mockMainWindow;
  let mockBackendManager;
  let mockSettingsManager;
  let ipcHandlers;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock objects
    mockMainWindow = {
      isMinimized: jest.fn(() => false),
      restore: jest.fn(),
      show: jest.fn(),
      focus: jest.fn(),
      hide: jest.fn(),
    };

    mockBackendManager = {
      isRunning: jest.fn(() => true),
      getPort: jest.fn(() => 8000),
      getCrashStats: jest.fn(() => ({
        crashCount: 0,
        lastCrashTime: null,
        autoRestartEnabled: true,
      })),
    };

    mockSettingsManager = {
      hasApiKeys: jest.fn(() => true),
      get: jest.fn((key) => {
        const defaults = {
          apiProvider: 'openai',
          theme: 'system',
          autoUpdate: true,
        };
        return defaults[key];
      }),
      getAll: jest.fn(() => ({
        apiProvider: 'openai',
        theme: 'system',
        autoUpdate: true,
      })),
      getApiKeys: jest.fn(() => ({
        openai: 'sk-test',
        anthropic: null,
        google: null,
      })),
      set: jest.fn(),
      setApiKey: jest.fn(),
    };

    // Capture IPC handlers
    ipcHandlers = {};
    ipcMain.handle.mockImplementation((channel, handler) => {
      ipcHandlers[channel] = handler;
    });

    // Set up IPC handlers
    setupIpcHandlers({
      mainWindow: mockMainWindow,
      backendManager: mockBackendManager,
      settingsManager: mockSettingsManager,
    });
  });

  afterEach(() => {
    removeIpcHandlers();
  });

  describe('setupIpcHandlers', () => {
    test('should register all IPC handlers', () => {
      const expectedChannels = [
        'open-file-dialog',
        'open-settings',
        'get-logs',
        'get-app-info',
        'quit-app',
        'get-backend-port',
        'get-settings',
        'set-setting',
        'set-api-key',
        'export-logs',
      ];

      expectedChannels.forEach(channel => {
        expect(ipcMain.handle).toHaveBeenCalledWith(
          channel,
          expect.any(Function)
        );
      });
    });
  });

  describe('open-file-dialog handler', () => {
    test('should return selected file paths on success', async () => {
      const mockFilePaths = ['/path/to/file1.pdf', '/path/to/file2.docx'];
      dialog.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: mockFilePaths,
      });

      const result = await ipcHandlers['open-file-dialog']();

      expect(result.success).toBe(true);
      expect(result.data.canceled).toBe(false);
      expect(result.data.filePaths).toEqual(mockFilePaths);
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(
        mockMainWindow,
        expect.objectContaining({
          properties: ['openFile', 'multiSelections'],
          filters: expect.any(Array),
        })
      );
    });

    test('should handle canceled dialog', async () => {
      dialog.showOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const result = await ipcHandlers['open-file-dialog']();

      expect(result.success).toBe(true);
      expect(result.data.canceled).toBe(true);
      expect(result.data.filePaths).toEqual([]);
    });

    test('should handle errors', async () => {
      const errorMessage = 'Dialog error';
      dialog.showOpenDialog.mockRejectedValue(new Error(errorMessage));

      const result = await ipcHandlers['open-file-dialog']();

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('open-settings handler', () => {
    test('should return success', async () => {
      const result = await ipcHandlers['open-settings']();

      expect(result.success).toBe(true);
      expect(result.data.opened).toBe(true);
    });
  });

  describe('get-logs handler', () => {
    test('should return logs when file exists', async () => {
      const mockLogs = 'Log line 1\nLog line 2\nLog line 3';
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(mockLogs);

      const result = await ipcHandlers['get-logs']();

      expect(result.success).toBe(true);
      expect(result.data.logs).toHaveLength(3);
      expect(result.data.logPath).toBeTruthy();
    });

    test('should handle missing log file', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));

      const result = await ipcHandlers['get-logs']();

      expect(result.success).toBe(true);
      expect(result.data.logs).toEqual([]);
      expect(result.data.message).toBe('No logs available yet');
    });

    test('should parse JSON log entries', async () => {
      const mockLogs = JSON.stringify({ level: 'info', message: 'Test log' });
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(mockLogs);

      const result = await ipcHandlers['get-logs']();

      expect(result.success).toBe(true);
      expect(result.data.logs[0]).toEqual({ level: 'info', message: 'Test log' });
    });

    test('should handle non-JSON log entries', async () => {
      const mockLogs = 'Plain text log entry';
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(mockLogs);

      const result = await ipcHandlers['get-logs']();

      expect(result.success).toBe(true);
      expect(result.data.logs[0]).toEqual({
        message: 'Plain text log entry',
        timestamp: null,
      });
    });

    test('should handle read errors', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockRejectedValue(new Error('Read error'));

      const result = await ipcHandlers['get-logs']();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read error');
    });
  });

  describe('get-app-info handler', () => {
    test('should return complete app info', async () => {
      const result = await ipcHandlers['get-app-info']();

      expect(result.success).toBe(true);
      expect(result.data.version).toBe('1.0.0');
      expect(result.data.name).toBe('FlashLearn');
      expect(result.data.platform).toBeTruthy();
      expect(result.data.os).toBeTruthy();
      expect(result.data.paths).toBeTruthy();
    });

    test('should include backend info when available', async () => {
      const result = await ipcHandlers['get-app-info']();

      expect(result.success).toBe(true);
      expect(result.data.backend).toBeTruthy();
      expect(result.data.backend.running).toBe(true);
      expect(result.data.backend.port).toBe(8000);
      expect(result.data.backend.crashStats).toBeTruthy();
    });

    test('should include settings info when available', async () => {
      const result = await ipcHandlers['get-app-info']();

      expect(result.success).toBe(true);
      expect(result.data.settings).toBeTruthy();
      expect(result.data.settings.hasApiKeys).toBe(true);
      expect(result.data.settings.apiProvider).toBe('openai');
    });

    test('should handle missing backend manager', async () => {
      // Re-setup without backend manager
      removeIpcHandlers();
      jest.clearAllMocks();
      ipcHandlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        ipcHandlers[channel] = handler;
      });

      setupIpcHandlers({
        mainWindow: mockMainWindow,
        backendManager: null,
        settingsManager: mockSettingsManager,
      });

      const result = await ipcHandlers['get-app-info']();

      expect(result.success).toBe(true);
      expect(result.data.backend).toBeUndefined();
    });
  });

  describe('quit-app handler', () => {
    test('should quit the application', async () => {
      const result = await ipcHandlers['quit-app']();

      expect(result.success).toBe(true);
      expect(result.data.quitting).toBe(true);
      expect(app.quit).toHaveBeenCalled();
    });

    test('should set global isQuitting flag', async () => {
      global.isQuitting = false;

      await ipcHandlers['quit-app']();

      expect(global.isQuitting).toBe(true);
    });
  });

  describe('get-backend-port handler', () => {
    test('should return backend port and base URL', async () => {
      const result = await ipcHandlers['get-backend-port']();

      expect(result.success).toBe(true);
      expect(result.data.port).toBe(8000);
      expect(result.data.baseUrl).toBe('http://127.0.0.1:8000');
    });

    test('should handle missing backend manager', async () => {
      // Re-setup without backend manager
      removeIpcHandlers();
      jest.clearAllMocks();
      ipcHandlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        ipcHandlers[channel] = handler;
      });

      setupIpcHandlers({
        mainWindow: mockMainWindow,
        backendManager: null,
        settingsManager: mockSettingsManager,
      });

      const result = await ipcHandlers['get-backend-port']();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Backend manager not initialized');
    });

    test('should handle backend not running', async () => {
      mockBackendManager.getPort.mockReturnValue(null);

      const result = await ipcHandlers['get-backend-port']();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Backend not running');
    });
  });

  describe('get-settings handler', () => {
    test('should return all settings', async () => {
      const result = await ipcHandlers['get-settings']();

      expect(result.success).toBe(true);
      expect(result.data.settings).toBeTruthy();
      expect(result.data.hasApiKeys).toBe(true);
      expect(result.data.apiProvider).toBe('openai');
    });

    test('should return API keys configured status', async () => {
      const result = await ipcHandlers['get-settings']();

      expect(result.success).toBe(true);
      expect(result.data.apiKeysConfigured).toBeTruthy();
      expect(result.data.apiKeysConfigured.openai).toBe(true);
      expect(result.data.apiKeysConfigured.anthropic).toBe(false);
      expect(result.data.apiKeysConfigured.google).toBe(false);
    });

    test('should not expose actual API keys', async () => {
      const result = await ipcHandlers['get-settings']();

      expect(result.success).toBe(true);
      expect(result.data.apiKeys).toBeUndefined();
    });

    test('should handle missing settings manager', async () => {
      // Re-setup without settings manager
      removeIpcHandlers();
      jest.clearAllMocks();
      ipcHandlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        ipcHandlers[channel] = handler;
      });

      setupIpcHandlers({
        mainWindow: mockMainWindow,
        backendManager: mockBackendManager,
        settingsManager: null,
      });

      const result = await ipcHandlers['get-settings']();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Settings manager not initialized');
    });
  });

  describe('set-setting handler', () => {
    test('should set a setting value', async () => {
      const result = await ipcHandlers['set-setting'](null, {
        key: 'theme',
        value: 'dark',
      });

      expect(result.success).toBe(true);
      expect(result.data.key).toBe('theme');
      expect(result.data.value).toBe('dark');
      expect(mockSettingsManager.set).toHaveBeenCalledWith('theme', 'dark');
    });

    test('should handle missing settings manager', async () => {
      // Re-setup without settings manager
      removeIpcHandlers();
      jest.clearAllMocks();
      ipcHandlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        ipcHandlers[channel] = handler;
      });

      setupIpcHandlers({
        mainWindow: mockMainWindow,
        backendManager: mockBackendManager,
        settingsManager: null,
      });

      const result = await ipcHandlers['set-setting'](null, {
        key: 'theme',
        value: 'dark',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Settings manager not initialized');
    });

    test('should handle errors', async () => {
      mockSettingsManager.set.mockImplementation(() => {
        throw new Error('Set error');
      });

      const result = await ipcHandlers['set-setting'](null, {
        key: 'theme',
        value: 'dark',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Set error');
    });
  });

  describe('set-api-key handler', () => {
    test('should set an API key', async () => {
      const result = await ipcHandlers['set-api-key'](null, {
        provider: 'openai',
        key: 'sk-test123',
      });

      expect(result.success).toBe(true);
      expect(result.data.provider).toBe('openai');
      expect(result.data.configured).toBe(true);
      expect(mockSettingsManager.setApiKey).toHaveBeenCalledWith('openai', 'sk-test123');
    });

    test('should handle validation errors', async () => {
      mockSettingsManager.setApiKey.mockImplementation(() => {
        throw new Error('Invalid API key format');
      });

      const result = await ipcHandlers['set-api-key'](null, {
        provider: 'openai',
        key: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key format');
    });

    test('should handle missing settings manager', async () => {
      // Re-setup without settings manager
      removeIpcHandlers();
      jest.clearAllMocks();
      ipcHandlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        ipcHandlers[channel] = handler;
      });

      setupIpcHandlers({
        mainWindow: mockMainWindow,
        backendManager: mockBackendManager,
        settingsManager: null,
      });

      const result = await ipcHandlers['set-api-key'](null, {
        provider: 'openai',
        key: 'sk-test123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Settings manager not initialized');
    });
  });

  describe('export-logs handler', () => {
    test('should export logs to selected location', async () => {
      const mockFilePath = '/path/to/exported-logs.log';
      fs.access.mockResolvedValue();
      dialog.showSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: mockFilePath,
      });
      fs.copyFile.mockResolvedValue();

      const result = await ipcHandlers['export-logs']();

      expect(result.success).toBe(true);
      expect(result.data.canceled).toBe(false);
      expect(result.data.filePath).toBe(mockFilePath);
      expect(fs.copyFile).toHaveBeenCalled();
    });

    test('should handle canceled export', async () => {
      fs.access.mockResolvedValue();
      dialog.showSaveDialog.mockResolvedValue({
        canceled: true,
      });

      const result = await ipcHandlers['export-logs']();

      expect(result.success).toBe(true);
      expect(result.data.canceled).toBe(true);
      expect(fs.copyFile).not.toHaveBeenCalled();
    });

    test('should handle missing log file', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));

      const result = await ipcHandlers['export-logs']();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No logs available to export');
    });

    test('should handle copy errors', async () => {
      fs.access.mockResolvedValue();
      dialog.showSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/path/to/exported-logs.log',
      });
      fs.copyFile.mockRejectedValue(new Error('Copy error'));

      const result = await ipcHandlers['export-logs']();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Copy error');
    });
  });

  describe('removeIpcHandlers', () => {
    test('should remove all IPC handlers', () => {
      removeIpcHandlers();

      const expectedChannels = [
        'open-file-dialog',
        'open-settings',
        'get-logs',
        'get-app-info',
        'quit-app',
        'get-backend-port',
        'get-settings',
        'set-setting',
        'set-api-key',
        'export-logs',
      ];

      expectedChannels.forEach(channel => {
        expect(ipcMain.removeHandler).toHaveBeenCalledWith(channel);
      });
    });
  });

  describe('response format consistency', () => {
    test('all successful responses should have success: true and data', async () => {
      const handlers = [
        'open-settings',
        'get-app-info',
        'quit-app',
        'get-backend-port',
        'get-settings',
      ];

      for (const handler of handlers) {
        const result = await ipcHandlers[handler]();
        expect(result).toHaveProperty('success');
        if (result.success) {
          expect(result).toHaveProperty('data');
        }
      }
    });

    test('all error responses should have success: false and error', async () => {
      // Force an error in get-logs
      fs.access.mockResolvedValue();
      fs.readFile.mockRejectedValue(new Error('Test error'));

      const result = await ipcHandlers['get-logs']();

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });
  });
});
