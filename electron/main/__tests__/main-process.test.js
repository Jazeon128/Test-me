/**
 * Unit Tests for Main Process
 * Tests window creation, tray menu creation, and lifecycle handlers
 */

// Mock electron modules before requiring main module
jest.mock('electron', () => {
  const mockBrowserWindow = jest.fn().mockImplementation((options) => ({
    loadURL: jest.fn().mockResolvedValue(undefined),
    loadFile: jest.fn().mockResolvedValue(undefined),
    isDestroyed: jest.fn(() => false),
    center: jest.fn(),
    setBounds: jest.fn(),
    getBounds: jest.fn(() => ({ width: 1200, height: 800 })),
    isFullScreen: jest.fn(() => false),
    setFullScreen: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    focus: jest.fn(),
    isMinimized: jest.fn().mockReturnValue(false),
    isVisible: jest.fn().mockReturnValue(true),
    restore: jest.fn(),
    once: jest.fn((event, callback) => {
      if (event === 'ready-to-show') {
        setTimeout(callback, 0);
      }
    }),
    on: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
    },
    minimize: jest.fn(),
    maximize: jest.fn(),
    close: jest.fn(),
    isMaximized: jest.fn().mockReturnValue(false),
    isMinimizable: jest.fn().mockReturnValue(true),
    isMaximizable: jest.fn().mockReturnValue(true),
    isClosable: jest.fn().mockReturnValue(true),
    _options: options, // Store options for testing
  }));

  mockBrowserWindow.getAllWindows = jest.fn().mockReturnValue([]);

  const mockTray = jest.fn().mockImplementation(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
  }));

  return {
    app: {
      getVersion: jest.fn(() => '1.0.0'),
      getPath: jest.fn((name) => {
        if (name === 'userData') return '/tmp/flashlearn-test';
        return '/tmp';
      }),
      whenReady: jest.fn(() => new Promise(() => {})),
      on: jest.fn(),
      quit: jest.fn(),
      dock: {
        hide: jest.fn(),
        show: jest.fn(),
      },
    },
    BrowserWindow: mockBrowserWindow,
    Tray: mockTray,
    Menu: {
      buildFromTemplate: jest.fn((template) => ({ template })),
    },
    nativeImage: {
      createFromPath: jest.fn().mockReturnValue({}),
      createEmpty: jest.fn().mockReturnValue({}),
    },
  };
});

// Isolate updater initialization and persistent window state in these window/tray tests.
jest.mock('electron-updater', () => ({ autoUpdater: { on: jest.fn() } }));
jest.mock('electron-store', () => jest.fn().mockImplementation(options => ({
  get: jest.fn(key => options.defaults[key]),
  set: jest.fn(),
})));

// Mock BackendManager
jest.mock('../backend-manager', () => {
  return jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(8000),
    stop: jest.fn().mockResolvedValue(undefined),
    isRunning: jest.fn().mockReturnValue(true),
    getPort: jest.fn().mockReturnValue(8000),
  }));
});

const { BrowserWindow, Tray, Menu, nativeImage, app } = require('electron');
const mainModule = require('../index');

describe('Main Process Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Window Creation (Requirements 2.1)', () => {
    test('createWindow should create a BrowserWindow instance', () => {
      const window = mainModule.createWindow();
      
      expect(BrowserWindow).toHaveBeenCalled();
      expect(window).toBeDefined();
    });

    test('createWindow should set correct window dimensions', () => {
      const window = mainModule.createWindow();
      
      const options = window._options;
      expect(options.width).toBe(1200);
      expect(options.height).toBe(800);
      expect(options.minWidth).toBe(800);
      expect(options.minHeight).toBe(600);
    });

    test('createWindow should enable native frame with controls', () => {
      const window = mainModule.createWindow();
      
      const options = window._options;
      expect(options.frame).toBe(true);
    });

    test('createWindow should configure security settings', () => {
      const window = mainModule.createWindow();
      
      const options = window._options;
      expect(options.webPreferences.contextIsolation).toBe(true);
      expect(options.webPreferences.nodeIntegration).toBe(false);
      expect(options.webPreferences.sandbox).toBe(true);
    });

    test('createWindow should not show window immediately', () => {
      const window = mainModule.createWindow();
      
      const options = window._options;
      expect(options.show).toBe(false);
    });

    test('createWindow should load URL in development mode', () => {
      process.env.NODE_ENV = 'development';
      const window = mainModule.createWindow();
      
      expect(window.loadURL).toHaveBeenCalledWith('http://localhost:5173');
      expect(window.webContents.openDevTools).toHaveBeenCalled();
    });

    test('createWindow should load file in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const window = mainModule.createWindow();
      
      expect(window.loadFile).toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });

    test('createWindow should register ready-to-show handler', () => {
      const window = mainModule.createWindow();
      
      expect(window.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
    });

    test('createWindow should register close handler', () => {
      const window = mainModule.createWindow();
      
      expect(window.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    test('createWindow should register closed handler', () => {
      const window = mainModule.createWindow();
      
      expect(window.on).toHaveBeenCalledWith('closed', expect.any(Function));
    });
  });

  describe('System Tray Creation (Requirements 2.2, 2.3, 2.4, 2.5)', () => {
    test('createTray should create a Tray instance', () => {
      const tray = mainModule.createTray();
      
      expect(Tray).toHaveBeenCalled();
      expect(tray).toBeDefined();
    });

    test('createTray should set tooltip', () => {
      const tray = mainModule.createTray();
      
      expect(tray.setToolTip).toHaveBeenCalledWith('FlashLearn');
    });

    test('createTray should create context menu', () => {
      const tray = mainModule.createTray();
      
      expect(Menu.buildFromTemplate).toHaveBeenCalled();
      expect(tray.setContextMenu).toHaveBeenCalled();
    });

    test('createTray should have Show menu item', () => {
      mainModule.createTray();
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[0][0];
      const showItem = menuTemplate.find(item => item.label === 'Show FlashLearn');
      
      expect(showItem).toBeDefined();
      expect(typeof showItem.click).toBe('function');
    });

    test('createTray should have Hide menu item', () => {
      mainModule.createTray();
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[0][0];
      const hideItem = menuTemplate.find(item => item.label === 'Hide FlashLearn');
      
      expect(hideItem).toBeDefined();
      expect(typeof hideItem.click).toBe('function');
    });

    test('createTray should have Quit menu item', () => {
      mainModule.createTray();
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[0][0];
      const quitItem = menuTemplate.find(item => item.label === 'Quit');
      
      expect(quitItem).toBeDefined();
      expect(typeof quitItem.click).toBe('function');
    });

    test('createTray should have separator in menu', () => {
      mainModule.createTray();
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[0][0];
      const separator = menuTemplate.find(item => item.type === 'separator');
      
      expect(separator).toBeDefined();
    });

    test('createTray should register click handler', () => {
      const tray = mainModule.createTray();
      
      expect(tray.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('createTray should register double-click handler', () => {
      const tray = mainModule.createTray();
      
      expect(tray.on).toHaveBeenCalledWith('double-click', expect.any(Function));
    });
  });

  describe('Window Management Functions', () => {
    test('showWindow should show and focus window', () => {
      const window = mainModule.createWindow();
      mainModule.showWindow();
      
      expect(window.show).toHaveBeenCalled();
      expect(window.focus).toHaveBeenCalled();
    });

    test('showWindow should restore minimized window', () => {
      const window = mainModule.createWindow();
      window.isMinimized.mockReturnValue(true);
      
      mainModule.showWindow();
      
      expect(window.restore).toHaveBeenCalled();
      expect(window.show).toHaveBeenCalled();
      expect(window.focus).toHaveBeenCalled();
    });

    test('hideWindow should hide window', () => {
      const window = mainModule.createWindow();
      mainModule.hideWindow();
      
      expect(window.hide).toHaveBeenCalled();
    });

    test('hideWindow should hide dock on macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });
      
      mainModule.createWindow();
      mainModule.hideWindow();
      
      expect(app.dock.hide).toHaveBeenCalled();
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true,
      });
    });
  });

  describe('Lifecycle Handlers (Requirements 1.2)', () => {
    test('getMainWindow should return main window', () => {
      const window = mainModule.createWindow();
      const mainWindow = mainModule.getMainWindow();
      
      expect(mainWindow).toBe(window);
    });

    test('getTray should return tray', () => {
      const tray = mainModule.createTray();
      const mainTray = mainModule.getTray();
      
      expect(mainTray).toBe(tray);
    });

    test('getBackendManager should return backend manager or null', () => {
      const backendManager = mainModule.getBackendManager();
      
      // Can be null initially or a BackendManager instance after initialize
      // Since initialize is called on module load, it might be initialized
      expect(backendManager === null || typeof backendManager === 'object').toBe(true);
    });
  });

  describe('Tray Menu Actions', () => {
    test('Show menu item should call showWindow', () => {
      const window = mainModule.createWindow();
      mainModule.createTray();
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[0][0];
      const showItem = menuTemplate.find(item => item.label === 'Show FlashLearn');
      
      // Clear previous calls
      window.show.mockClear();
      window.focus.mockClear();
      
      // Click show item
      showItem.click();
      
      expect(window.show).toHaveBeenCalled();
      expect(window.focus).toHaveBeenCalled();
    });

    test('Hide menu item should hide window', () => {
      const window = mainModule.createWindow();
      mainModule.createTray();
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[0][0];
      const hideItem = menuTemplate.find(item => item.label === 'Hide FlashLearn');
      
      // Clear previous calls
      window.hide.mockClear();
      
      // Click hide item
      hideItem.click();
      
      expect(window.hide).toHaveBeenCalled();
    });

    test('Quit menu item should quit app', () => {
      mainModule.createTray();
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[0][0];
      const quitItem = menuTemplate.find(item => item.label === 'Quit');
      
      // Click quit item
      quitItem.click();
      
      expect(app.quit).toHaveBeenCalled();
    });
  });

  describe('Window Event Handlers', () => {
    test('window close handler should be registered', () => {
      const window = mainModule.createWindow();
      
      // Get the close handler
      const closeCall = window.on.mock.calls.find(
        call => call[0] === 'close'
      );
      
      // Verify close handler is registered
      expect(closeCall).toBeDefined();
      expect(typeof closeCall[1]).toBe('function');
      
      // Note: The actual behavior (hide vs close) depends on the isQuitting flag
      // which is a module-level variable. The handler's logic is tested in
      // integration tests and property-based tests.
    });

    test('ready-to-show handler should show and focus window', () => {
      const window = mainModule.createWindow();
      
      // Get the ready-to-show handler
      const readyHandler = window.once.mock.calls.find(
        call => call[0] === 'ready-to-show'
      )[1];
      
      // Clear previous calls
      window.show.mockClear();
      window.focus.mockClear();
      
      // Call ready handler
      readyHandler();
      
      expect(window.show).toHaveBeenCalled();
      expect(window.focus).toHaveBeenCalled();
    });
  });

  describe('Platform-Specific Behavior', () => {
    test('should show dock on macOS when showing window', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });
      
      mainModule.createWindow();
      mainModule.showWindow();
      
      expect(app.dock.show).toHaveBeenCalled();
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true,
      });
    });

    test('should hide dock on macOS when hiding window', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });
      
      mainModule.createWindow();
      mainModule.hideWindow();
      
      expect(app.dock.hide).toHaveBeenCalled();
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true,
      });
    });
  });
});
