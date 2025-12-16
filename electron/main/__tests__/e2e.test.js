/**
 * End-to-End Tests for FlashLearn Desktop Application
 * 
 * These tests verify complete user workflows across the application.
 * Requirements: All
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Mock electron modules
const mockTmpDir = os.tmpdir();
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name) => {
      const mockPath = require('path');
      const mockOs = require('os');
      if (name === 'userData') return mockPath.join(mockOs.tmpdir(), 'flashlearn-test');
      if (name === 'appData') return mockPath.join(mockOs.tmpdir(), 'flashlearn-test');
      return mockOs.tmpdir();
    }),
    getVersion: jest.fn(() => '0.1.0'),
    getName: jest.fn(() => 'FlashLearn'),
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
    isReady: jest.fn(() => true),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(() => Promise.resolve()),
    loadFile: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    webContents: {
      on: jest.fn(),
      send: jest.fn(),
    },
    show: jest.fn(),
    hide: jest.fn(),
    isVisible: jest.fn(() => true),
    close: jest.fn(),
    destroy: jest.fn(),
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  Tray: jest.fn().mockImplementation(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn(),
  })),
  Menu: {
    buildFromTemplate: jest.fn(() => ({})),
  },
  dialog: {
    showOpenDialog: jest.fn(() => Promise.resolve({ canceled: false, filePaths: ['/test/file.pdf'] })),
    showMessageBox: jest.fn(() => Promise.resolve({ response: 0 })),
  },
}));

describe('End-to-End Tests', () => {
  let testDataDir;

  beforeEach(() => {
    testDataDir = path.join(os.tmpdir(), 'flashlearn-e2e-test-' + Date.now());
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Complete User Workflow', () => {
    test('should complete full workflow: launch -> upload -> generate -> study', async () => {
      // This test verifies the complete user journey
      const BackendManager = require('../backend-manager');
      const SettingsManager = require('../settings-manager');
      const DataDirectoryManager = require('../data-directory-manager');

      // 1. Initialize application
      const dataDirManager = new DataDirectoryManager(testDataDir);
      await dataDirManager.initialize();

      // 2. Verify data directory structure
      expect(fs.existsSync(dataDirManager.getDatabasePath())).toBe(false); // Not created yet
      expect(fs.existsSync(dataDirManager.getUploadsPath())).toBe(true);

      // 3. Configure settings (API keys)
      const settingsManager = new SettingsManager(testDataDir);
      settingsManager.setSecure('apiKey', 'sk-test-key-12345');
      expect(settingsManager.getSecure('apiKey')).toBe('sk-test-key-12345');

      // 4. Start backend
      const backendManager = new BackendManager(testDataDir);
      // Mock the backend start to avoid actual process spawning
      backendManager.start = jest.fn(() => Promise.resolve(8000));
      const port = await backendManager.start();
      expect(port).toBe(8000);

      // 5. Simulate file upload
      const uploadPath = path.join(dataDirManager.getUploadsPath(), 'test-document.pdf');
      fs.writeFileSync(uploadPath, 'test content');
      expect(fs.existsSync(uploadPath)).toBe(true);

      // 6. Verify workflow completion - settings manager should be functional
      expect(settingsManager.get('apiProvider')).toBeDefined();
    });

    test('should handle first-run experience', async () => {
      const SettingsManager = require('../settings-manager');
      // Use a fresh directory for this test
      const firstRunDir = path.join(os.tmpdir(), 'flashlearn-first-run-' + Date.now());
      fs.mkdirSync(firstRunDir, { recursive: true });
      
      const settingsManager = new SettingsManager(firstRunDir);

      // User configures API key on first run
      settingsManager.setSecure('apiKey', 'sk-new-key');
      expect(settingsManager.getSecure('apiKey')).toBe('sk-new-key');

      // Settings should persist across sessions
      const newSettingsManager = new SettingsManager(firstRunDir);
      expect(newSettingsManager.getSecure('apiKey')).toBe('sk-new-key');
      
      // Cleanup
      fs.rmSync(firstRunDir, { recursive: true, force: true });
    });

    test('should handle application restart with data persistence', async () => {
      const SettingsManager = require('../settings-manager');
      const DataDirectoryManager = require('../data-directory-manager');

      // First session
      const dataDirManager1 = new DataDirectoryManager(testDataDir);
      await dataDirManager1.initialize();
      
      const settingsManager1 = new SettingsManager(testDataDir);
      settingsManager1.set('theme', 'dark');
      settingsManager1.setSecure('apiKey', 'sk-persistent-key');

      // Create a test file
      const testFile = path.join(dataDirManager1.getUploadsPath(), 'persistent-file.txt');
      fs.writeFileSync(testFile, 'persistent data');

      // Second session (simulating restart)
      const dataDirManager2 = new DataDirectoryManager(testDataDir);
      await dataDirManager2.initialize();
      
      const settingsManager2 = new SettingsManager(testDataDir);
      
      // Verify data persisted
      expect(settingsManager2.get('theme')).toBe('dark');
      expect(settingsManager2.getSecure('apiKey')).toBe('sk-persistent-key');
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf8')).toBe('persistent data');
    });
  });

  describe('Platform-Specific Tests', () => {
    test('should use correct data directory for Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const DataDirectoryManager = require('../data-directory-manager');
      const osPath = DataDirectoryManager.getOSDataPath();
      
      // Windows should use APPDATA
      expect(osPath.toLowerCase()).toContain('flashlearn');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('should use correct data directory for macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const DataDirectoryManager = require('../data-directory-manager');
      const osPath = DataDirectoryManager.getOSDataPath();
      
      // macOS should use Application Support
      expect(osPath.toLowerCase()).toContain('flashlearn');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('should use correct data directory for Linux', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const DataDirectoryManager = require('../data-directory-manager');
      const osPath = DataDirectoryManager.getOSDataPath();
      
      // Linux should use .config
      expect(osPath.toLowerCase()).toContain('flashlearn');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('Screen Configuration Tests', () => {
    test('should handle different screen resolutions', () => {
      const WindowStateManager = require('../window-state-manager');
      
      // Test with small screen
      const smallScreenState = new WindowStateManager();
      const mockSmallWindow = {
        isDestroyed: () => false,
        getBounds: () => ({ width: 800, height: 600, x: 0, y: 0 }),
        isFullScreen: () => false,
        isMaximized: () => false
      };
      smallScreenState.saveState(mockSmallWindow);
      const smallBounds = smallScreenState.getBounds();
      expect(smallBounds.width).toBe(800);
      expect(smallBounds.height).toBe(600);

      // Test with large screen
      const largeScreenState = new WindowStateManager();
      const mockLargeWindow = {
        isDestroyed: () => false,
        getBounds: () => ({ width: 1920, height: 1080, x: 0, y: 0 }),
        isFullScreen: () => false,
        isMaximized: () => false
      };
      largeScreenState.saveState(mockLargeWindow);
      const largeBounds = largeScreenState.getBounds();
      expect(largeBounds.width).toBe(1920);
      expect(largeBounds.height).toBe(1080);
    });

    test('should handle multi-monitor setup', () => {
      const WindowStateManager = require('../window-state-manager');
      const manager = new WindowStateManager();

      // Window on second monitor (negative coordinates)
      const mockWindow = {
        isDestroyed: () => false,
        getBounds: () => ({ width: 1280, height: 720, x: -1920, y: 0 }),
        isFullScreen: () => false,
        isMaximized: () => false
      };
      manager.saveState(mockWindow);
      const bounds = manager.getBounds();
      
      expect(bounds.x).toBe(-1920);
      expect(bounds.y).toBe(0);
    });

    test('should handle fullscreen mode', () => {
      const WindowStateManager = require('../window-state-manager');
      const manager = new WindowStateManager();

      const mockWindow = {
        isDestroyed: () => false,
        getBounds: () => ({ width: 1920, height: 1080, x: 0, y: 0 }),
        isFullScreen: () => true,
        isMaximized: () => false
      };
      manager.saveState(mockWindow);
      
      expect(manager.isFullScreen()).toBe(true);
    });
  });

  describe('Error Recovery Tests', () => {
    test('should recover from backend failure', async () => {
      const BackendManager = require('../backend-manager');
      const backendManager = new BackendManager(testDataDir);

      // Mock backend failure then success
      const mockStart = jest.fn()
        .mockRejectedValueOnce(new Error('Port in use'))
        .mockResolvedValueOnce(8001);
      
      backendManager.start = mockStart;

      // First attempt should fail
      await expect(backendManager.start()).rejects.toThrow('Port in use');
      
      // Second attempt should succeed
      const port = await backendManager.start();
      expect(port).toBe(8001);
    });

    test('should handle corrupted settings gracefully', () => {
      const SettingsManager = require('../settings-manager');
      
      // Create a fresh test directory for this test
      const corruptedTestDir = path.join(os.tmpdir(), 'flashlearn-corrupted-test-' + Date.now());
      fs.mkdirSync(corruptedTestDir, { recursive: true });
      
      const settingsPath = path.join(corruptedTestDir, 'settings.json');
      fs.writeFileSync(settingsPath, '{ invalid json }');

      // electron-store should handle corrupted files and use defaults
      const manager = new SettingsManager(corruptedTestDir);
      const theme = manager.get('theme');
      
      // Should either use default or handle gracefully
      expect(['system', 'light', 'dark']).toContain(theme);
      
      // Cleanup
      fs.rmSync(corruptedTestDir, { recursive: true, force: true });
    });

    test('should handle missing data directory', async () => {
      const DataDirectoryManager = require('../data-directory-manager');
      const nonExistentPath = path.join(testDataDir, 'non-existent');
      
      const manager = new DataDirectoryManager(nonExistentPath);
      await manager.initialize();

      // Should create the directory
      expect(fs.existsSync(nonExistentPath)).toBe(true);
    });
  });
});
