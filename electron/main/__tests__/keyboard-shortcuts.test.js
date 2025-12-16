/**
 * Unit Tests for Keyboard Shortcuts Manager
 * Tests shortcut registration and actions
 * Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

// Mock electron modules before requiring keyboard shortcuts
jest.mock('electron', () => {
  const mockGlobalShortcut = {
    register: jest.fn((accelerator, callback) => {
      // Store the callback for testing
      mockGlobalShortcut._callbacks = mockGlobalShortcut._callbacks || {};
      mockGlobalShortcut._callbacks[accelerator] = callback;
      return true; // Simulate successful registration
    }),
    unregister: jest.fn((accelerator) => {
      if (mockGlobalShortcut._callbacks) {
        delete mockGlobalShortcut._callbacks[accelerator];
      }
    }),
    unregisterAll: jest.fn(() => {
      mockGlobalShortcut._callbacks = {};
    }),
    isRegistered: jest.fn((accelerator) => {
      return mockGlobalShortcut._callbacks && 
             mockGlobalShortcut._callbacks.hasOwnProperty(accelerator);
    }),
    _callbacks: {},
    _trigger: (accelerator) => {
      if (mockGlobalShortcut._callbacks && mockGlobalShortcut._callbacks[accelerator]) {
        mockGlobalShortcut._callbacks[accelerator]();
      }
    },
  };

  return {
    globalShortcut: mockGlobalShortcut,
    app: {
      getPath: jest.fn(() => '/tmp/test'),
    },
  };
});

const { globalShortcut } = require('electron');
const KeyboardShortcutsManager = require('../keyboard-shortcuts');

describe('Keyboard Shortcuts Manager Unit Tests', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
    globalShortcut._callbacks = {};
    manager = new KeyboardShortcutsManager();
  });

  afterEach(() => {
    if (manager) {
      manager.unregisterAll();
    }
  });

  describe('Initialization', () => {
    test('should create a new KeyboardShortcutsManager instance', () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(KeyboardShortcutsManager);
    });

    test('should initialize with empty shortcuts map', () => {
      expect(manager.getShortcutCount()).toBe(0);
      expect(manager.getRegisteredShortcuts().size).toBe(0);
    });

    test('should initialize with registered flag as false', () => {
      expect(manager.registered).toBe(false);
    });
  });

  describe('Shortcut Registration', () => {
    test('should register a single shortcut', () => {
      const handler = jest.fn();
      const success = manager.register('Control+N', handler, 'Test Shortcut');

      expect(success).toBe(true);
      expect(globalShortcut.register).toHaveBeenCalledWith('Control+N', expect.any(Function));
      expect(manager.getShortcutCount()).toBe(1);
    });

    test('should register all shortcuts with registerAll', () => {
      const handlers = {
        onNewFlashcard: jest.fn(),
        onFileUpload: jest.fn(),
        onSettings: jest.fn(),
        onFullscreen: jest.fn(),
        onQuit: jest.fn(),
      };

      manager.registerAll(handlers);

      expect(manager.getShortcutCount()).toBe(5);
      expect(manager.registered).toBe(true);
    });

    test('should not register shortcuts twice', () => {
      const handlers = {
        onNewFlashcard: jest.fn(),
        onFileUpload: jest.fn(),
        onSettings: jest.fn(),
        onFullscreen: jest.fn(),
        onQuit: jest.fn(),
      };

      manager.registerAll(handlers);
      const firstCount = manager.getShortcutCount();

      // Try to register again
      manager.registerAll(handlers);
      const secondCount = manager.getShortcutCount();

      expect(firstCount).toBe(secondCount);
    });

    test('should register platform-specific shortcuts on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const handlers = {
        onNewFlashcard: jest.fn(),
        onFileUpload: jest.fn(),
        onSettings: jest.fn(),
        onFullscreen: jest.fn(),
        onQuit: jest.fn(),
      };

      manager.registerAll(handlers);

      expect(manager.isRegistered('Control+N')).toBe(true);
      expect(manager.isRegistered('Control+O')).toBe(true);
      expect(manager.isRegistered('Control+,')).toBe(true);
      expect(manager.isRegistered('Control+Q')).toBe(true);

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true,
      });
    });

    test('should register platform-specific shortcuts on macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });

      const handlers = {
        onNewFlashcard: jest.fn(),
        onFileUpload: jest.fn(),
        onSettings: jest.fn(),
        onFullscreen: jest.fn(),
        onQuit: jest.fn(),
      };

      manager.registerAll(handlers);

      expect(manager.isRegistered('Command+N')).toBe(true);
      expect(manager.isRegistered('Command+O')).toBe(true);
      expect(manager.isRegistered('Command+,')).toBe(true);
      expect(manager.isRegistered('Command+Q')).toBe(true);

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true,
      });
    });

    test('should register F11 for fullscreen on all platforms', () => {
      const handlers = {
        onNewFlashcard: jest.fn(),
        onFileUpload: jest.fn(),
        onSettings: jest.fn(),
        onFullscreen: jest.fn(),
        onQuit: jest.fn(),
      };

      manager.registerAll(handlers);

      expect(manager.isRegistered('F11')).toBe(true);
    });
  });

  describe('Shortcut Actions (Requirements 10.1, 10.2, 10.3, 10.4, 10.5)', () => {
    test('should trigger new flashcard handler (Requirement 10.1)', () => {
      const handler = jest.fn();
      const handlers = {
        onNewFlashcard: handler,
        onFileUpload: jest.fn(),
        onSettings: jest.fn(),
        onFullscreen: jest.fn(),
        onQuit: jest.fn(),
      };

      manager.registerAll(handlers);

      const isMac = process.platform === 'darwin';
      const shortcut = isMac ? 'Command+N' : 'Control+N';
      globalShortcut._trigger(shortcut);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should trigger file upload handler (Requirement 10.2)', () => {
      const handler = jest.fn();
      const handlers = {
        onNewFlashcard: jest.fn(),
        onFileUpload: handler,
        onSettings: jest.fn(),
        onFullscreen: jest.fn(),
        onQuit: jest.fn(),
      };

      manager.registerAll(handlers);

      const isMac = process.platform === 'darwin';
      const shortcut = isMac ? 'Command+O' : 'Control+O';
      globalShortcut._trigger(shortcut);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should trigger settings handler (Requirement 10.3)', () => {
      const handler = jest.fn();
      const handlers = {
        onNewFlashcard: jest.fn(),
        onFileUpload: jest.fn(),
        onSettings: handler,
        onFullscreen: jest.fn(),
        onQuit: jest.fn(),
      };

      manager.registerAll(handlers);

      const isMac = process.platform === 'darwin';
      const shortcut = isMac ? 'Command+,' : 'Control+,';
      globalShortcut._trigger(shortcut);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should trigger fullscreen handler (Requirement 10.4)', () => {
      const handler = jest.fn();
      const handlers = {
        onNewFlashcard: jest.fn(),
        onFileUpload: jest.fn(),
        onSettings: jest.fn(),
        onFullscreen: handler,
        onQuit: jest.fn(),
      };

      manager.registerAll(handlers);

      globalShortcut._trigger('F11');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should trigger quit handler (Requirement 10.5)', () => {
      const handler = jest.fn();
      const handlers = {
        onNewFlashcard: jest.fn(),
        onFileUpload: jest.fn(),
        onSettings: jest.fn(),
        onFullscreen: jest.fn(),
        onQuit: handler,
      };

      manager.registerAll(handlers);

      const isMac = process.platform === 'darwin';
      const shortcut = isMac ? 'Command+Q' : 'Control+Q';
      globalShortcut._trigger(shortcut);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Shortcut Unregistration', () => {
    test('should unregister a single shortcut', () => {
      const handler = jest.fn();
      manager.register('Control+N', handler, 'Test Shortcut');

      expect(manager.getShortcutCount()).toBe(1);

      manager.unregister('Control+N');

      expect(manager.getShortcutCount()).toBe(0);
      expect(globalShortcut.unregister).toHaveBeenCalledWith('Control+N');
    });

    test('should unregister all shortcuts', () => {
      const handlers = {
        onNewFlashcard: jest.fn(),
        onFileUpload: jest.fn(),
        onSettings: jest.fn(),
        onFullscreen: jest.fn(),
        onQuit: jest.fn(),
      };

      manager.registerAll(handlers);
      expect(manager.getShortcutCount()).toBe(5);

      manager.unregisterAll();

      expect(manager.getShortcutCount()).toBe(0);
      expect(manager.registered).toBe(false);
      expect(globalShortcut.unregisterAll).toHaveBeenCalled();
    });

    test('should not trigger handler after unregistering', () => {
      const handler = jest.fn();
      manager.register('Control+N', handler, 'Test Shortcut');

      manager.unregister('Control+N');

      globalShortcut._trigger('Control+N');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Shortcut Query Methods', () => {
    test('should check if shortcut is registered', () => {
      const handler = jest.fn();
      manager.register('Control+N', handler, 'Test Shortcut');

      expect(manager.isRegistered('Control+N')).toBe(true);
      expect(manager.isRegistered('Control+O')).toBe(false);
    });

    test('should get registered shortcuts map', () => {
      const handler = jest.fn();
      manager.register('Control+N', handler, 'Test Shortcut');

      const shortcuts = manager.getRegisteredShortcuts();

      expect(shortcuts).toBeInstanceOf(Map);
      expect(shortcuts.size).toBe(1);
      expect(shortcuts.has('Control+N')).toBe(true);
    });

    test('should get shortcut count', () => {
      expect(manager.getShortcutCount()).toBe(0);

      const handler = jest.fn();
      manager.register('Control+N', handler, 'Test 1');
      expect(manager.getShortcutCount()).toBe(1);

      manager.register('Control+O', handler, 'Test 2');
      expect(manager.getShortcutCount()).toBe(2);

      manager.unregister('Control+N');
      expect(manager.getShortcutCount()).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing handler gracefully', () => {
      const success = manager.register('Control+N', null, 'Test Shortcut');

      expect(success).toBe(true);
      expect(manager.getShortcutCount()).toBe(1);

      // Should not throw when triggered
      expect(() => {
        globalShortcut._trigger('Control+N');
      }).not.toThrow();
    });

    test('should handle registration failure', () => {
      // Mock registration failure
      globalShortcut.register.mockReturnValueOnce(false);

      const handler = jest.fn();
      const success = manager.register('Control+N', handler, 'Test Shortcut');

      expect(success).toBe(false);
    });

    test('should handle unregistering non-existent shortcut', () => {
      expect(() => {
        manager.unregister('Control+X');
      }).not.toThrow();
    });
  });

  describe('Shortcut Descriptions', () => {
    test('should store shortcut descriptions', () => {
      const handler = jest.fn();
      manager.register('Control+N', handler, 'New Flashcard');

      const shortcuts = manager.getRegisteredShortcuts();
      const shortcutInfo = shortcuts.get('Control+N');

      expect(shortcutInfo).toBeDefined();
      expect(shortcutInfo.description).toBe('New Flashcard');
    });

    test('should handle empty description', () => {
      const handler = jest.fn();
      manager.register('Control+N', handler);

      const shortcuts = manager.getRegisteredShortcuts();
      const shortcutInfo = shortcuts.get('Control+N');

      expect(shortcutInfo).toBeDefined();
      expect(shortcutInfo.description).toBe('');
    });
  });
});
