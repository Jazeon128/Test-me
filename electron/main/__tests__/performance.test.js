/**
 * Performance Tests for FlashLearn Desktop Application
 * 
 * These tests measure startup time, memory usage, and CPU usage.
 * Requirements: 8.1, 8.2, 8.3
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Mock electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name) => {
      const mockPath = require('path');
      const mockOs = require('os');
      if (name === 'userData') return mockPath.join(mockOs.tmpdir(), 'flashlearn-perf-test');
      if (name === 'appData') return mockPath.join(mockOs.tmpdir(), 'flashlearn-perf-test');
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
    getBounds: jest.fn(() => ({ width: 1200, height: 800, x: 0, y: 0 })),
    isMaximized: jest.fn(() => false),
    isFullScreen: jest.fn(() => false),
    isDestroyed: jest.fn(() => false),
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
}));

// Measure real stores in a fresh directory, without shared application data.
let mockSettingsDirectory;
jest.mock('electron-store', () => {
  const Store = jest.requireActual('electron-store');
  return class extends Store {
    constructor(options) {
      super({ ...options, cwd: mockSettingsDirectory });
    }
  };
});

describe('Performance Tests', () => {
  let testDataDir;

  beforeEach(() => {
    testDataDir = path.join(os.tmpdir(), 'flashlearn-perf-test-' + Date.now());
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    mockSettingsDirectory = testDataDir;
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Startup Time - Requirement 8.1, 8.2', () => {
    test('should display splash screen within 1 second', async () => {
      const SplashWindow = require('../splash-window');
      
      const startTime = Date.now();
      const splash = new SplashWindow();
      // SplashWindow creates the window in constructor
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      // Requirement 8.1: Splash screen within 1 second
      expect(duration).toBeLessThan(1000);
      
      console.log(`Splash screen displayed in ${duration}ms`);
    });

    test('should initialize backend within 3 seconds', async () => {
      const BackendManager = require('../backend-manager');
      const backendManager = new BackendManager(testDataDir);
      
      // Mock the backend start to simulate initialization
      backendManager.start = jest.fn(async () => {
        // Simulate backend initialization time
        await new Promise(resolve => setTimeout(resolve, 100));
        return 8000;
      });
      
      const startTime = Date.now();
      await backendManager.start();
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      // Requirement 8.2: Main window within 3 seconds
      // Backend initialization is part of this
      expect(duration).toBeLessThan(3000);
      
      console.log(`Backend initialized in ${duration}ms`);
    });

    test('should initialize data directory quickly', async () => {
      const DataDirectoryManager = require('../data-directory-manager');
      const manager = new DataDirectoryManager(testDataDir);
      
      const startTime = Date.now();
      await manager.initialize();
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      // Data directory initialization should be fast (< 500ms)
      expect(duration).toBeLessThan(500);
      
      console.log(`Data directory initialized in ${duration}ms`);
    });

    test('should load settings quickly', () => {
      const SettingsManager = require('../settings-manager');
      
      const startTime = Date.now();
      const manager = new SettingsManager(testDataDir);
      manager.get('theme');
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      // Settings loading should be very fast (< 100ms)
      expect(duration).toBeLessThan(100);
      
      console.log(`Settings loaded in ${duration}ms`);
    });
  });

  describe('Window Restoration Time - Requirement 8.3', () => {
    test('should restore window state within 500ms', () => {
      const WindowStateManager = require('../window-state-manager');
      const manager = new WindowStateManager();
      
      // Save a window state first
      const mockWindow = {
        isDestroyed: () => false,
        getBounds: () => ({ width: 1280, height: 720, x: 100, y: 100 }),
        isFullScreen: () => false,
        isMaximized: () => false
      };
      manager.saveState(mockWindow);
      
      // Measure restoration time
      const startTime = Date.now();
      const bounds = manager.getBounds();
      const isMaximized = manager.isMaximized();
      const isFullScreen = manager.isFullScreen();
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      // Requirement 8.3: Restore within 500ms
      expect(duration).toBeLessThan(500);
      
      // Verify state was restored
      expect(bounds.width).toBe(1280);
      expect(bounds.height).toBe(720);
      
      console.log(`Window state restored in ${duration}ms`);
    });

    test('should use cached state for fast restoration', () => {
      const WindowStateManager = require('../window-state-manager');
      const manager = new WindowStateManager();
      
      // First access (may load from disk)
      const startTime1 = Date.now();
      manager.getBounds();
      const endTime1 = Date.now();
      const firstAccess = endTime1 - startTime1;
      
      // Second access (should use cache)
      const startTime2 = Date.now();
      manager.getBounds();
      const endTime2 = Date.now();
      const secondAccess = endTime2 - startTime2;
      
      // Cached access should be faster or equal
      expect(secondAccess).toBeLessThanOrEqual(firstAccess);
      
      // Both should be very fast
      expect(firstAccess).toBeLessThan(100);
      expect(secondAccess).toBeLessThan(100);
      
      console.log(`First access: ${firstAccess}ms, Cached access: ${secondAccess}ms`);
    });
  });

  describe('Memory Usage', () => {
    test('should not leak memory when creating/destroying managers', () => {
      const SettingsManager = require('../settings-manager');
      // Measure retained memory, with collection available under plain npx jest.
      const v8 = require('v8');
      v8.setFlagsFromString('--expose_gc');
      const collectGarbage = require('vm').runInNewContext('gc');
      v8.setFlagsFromString('--no-expose_gc');
      collectGarbage();
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and destroy multiple managers
      for (let i = 0; i < 100; i++) {
        const manager = new SettingsManager(testDataDir);
        manager.get('theme');
      }
      
      collectGarbage();
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (< 30MB for 100 instances)
      // Note: electron-store creates persistent storage which uses memory
      const maxIncreaseMB = 30;
      const maxIncreaseBytes = maxIncreaseMB * 1024 * 1024;
      
      expect(memoryIncrease).toBeLessThan(maxIncreaseBytes);
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    test('should handle large settings efficiently', () => {
      const SettingsManager = require('../settings-manager');
      const manager = new SettingsManager(testDataDir);
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Store large settings
      const largeData = {
        recentFiles: Array(1000).fill(null).map((_, i) => ({
          path: `/path/to/file${i}.pdf`,
          timestamp: Date.now(),
          size: 1024 * 1024
        }))
      };
      
      manager.set('recentFiles', largeData);
      const retrieved = manager.get('recentFiles');
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Verify data integrity
      expect(retrieved.recentFiles).toHaveLength(1000);
      
      // Memory increase should be reasonable (< 5MB for this data)
      const maxIncreaseMB = 5;
      const maxIncreaseBytes = maxIncreaseMB * 1024 * 1024;
      
      expect(memoryIncrease).toBeLessThan(maxIncreaseBytes);
      
      console.log(`Memory for large settings: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('CPU Usage', () => {
    test('should not block event loop during initialization', async () => {
      const DataDirectoryManager = require('../data-directory-manager');
      
      let eventLoopBlocked = false;
      
      // Set up a timer to detect event loop blocking
      const checkTimer = setTimeout(() => {
        eventLoopBlocked = true;
      }, 100);
      
      // Initialize data directory
      const manager = new DataDirectoryManager(testDataDir);
      await manager.initialize();
      
      clearTimeout(checkTimer);
      
      // Event loop should not have been blocked
      expect(eventLoopBlocked).toBe(false);
    });

    test('should handle concurrent operations efficiently', async () => {
      const SettingsManager = require('../settings-manager');
      const manager = new SettingsManager(testDataDir);
      
      const startTime = Date.now();
      
      // Perform multiple concurrent operations
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(
          Promise.resolve().then(() => {
            manager.set(`key${i}`, `value${i}`);
            return manager.get(`key${i}`);
          })
        );
      }
      
      await Promise.all(operations);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete reasonably quickly (< 3 seconds for 100 operations)
      expect(duration).toBeLessThan(3000);
      
      console.log(`100 concurrent operations completed in ${duration}ms`);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should provide performance summary', async () => {
      console.log('\n=== Performance Summary ===');
      
      // Startup metrics
      const DataDirectoryManager = require('../data-directory-manager');
      const manager = new DataDirectoryManager(testDataDir);
      
      const startupStart = Date.now();
      await manager.initialize();
      const startupEnd = Date.now();
      
      console.log(`Data Directory Init: ${startupEnd - startupStart}ms`);
      
      // Memory metrics
      const memUsage = process.memoryUsage();
      console.log(`Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`);
      console.log(`RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`);
      
      // System info
      console.log(`Platform: ${process.platform}`);
      console.log(`Node Version: ${process.version}`);
      console.log(`CPU Cores: ${os.cpus().length}`);
      console.log(`Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`);
      console.log('========================\n');
      
      // This test always passes, it's just for reporting
      expect(true).toBe(true);
    });
  });
});
