/**
 * Property-Based Tests for Keyboard Shortcuts
 * Feature: standalone-desktop-app, Property 21: Shortcut consistency
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 * 
 * Property 21: Shortcut consistency
 * For any keyboard shortcut defined in the application, pressing that shortcut should trigger the associated action.
 */

const fc = require('fast-check');

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

describe('Keyboard Shortcuts Property-Based Tests', () => {
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

  describe('Property 21: Shortcut consistency', () => {
    /**
     * Property: For any keyboard shortcut defined in the application,
     * pressing that shortcut should trigger the associated action.
     * 
     * This property tests that:
     * 1. All defined shortcuts can be registered
     * 2. Each shortcut triggers its associated handler when pressed
     * 3. Handlers are called exactly once per shortcut press
     * 4. The correct handler is called for each shortcut
     */
    test('all registered shortcuts trigger their associated handlers', () => {
      fc.assert(
        fc.property(
          fc.record({
            newFlashcardCalled: fc.constant(false),
            fileUploadCalled: fc.constant(false),
            settingsCalled: fc.constant(false),
            fullscreenCalled: fc.constant(false),
            quitCalled: fc.constant(false),
          }),
          (initialState) => {
            // Create tracking state
            const state = { ...initialState };
            
            // Create handlers that track calls
            const handlers = {
              onNewFlashcard: jest.fn(() => { state.newFlashcardCalled = true; }),
              onFileUpload: jest.fn(() => { state.fileUploadCalled = true; }),
              onSettings: jest.fn(() => { state.settingsCalled = true; }),
              onFullscreen: jest.fn(() => { state.fullscreenCalled = true; }),
              onQuit: jest.fn(() => { state.quitCalled = true; }),
            };

            // Register all shortcuts
            manager.registerAll(handlers);

            // Get the platform-specific shortcuts
            const isMac = process.platform === 'darwin';
            const shortcuts = {
              newFlashcard: isMac ? 'Command+N' : 'Control+N',
              fileUpload: isMac ? 'Command+O' : 'Control+O',
              settings: isMac ? 'Command+,' : 'Control+,',
              fullscreen: 'F11',
              quit: isMac ? 'Command+Q' : 'Control+Q',
            };

            // Property: All shortcuts should be registered
            expect(manager.isRegistered(shortcuts.newFlashcard)).toBe(true);
            expect(manager.isRegistered(shortcuts.fileUpload)).toBe(true);
            expect(manager.isRegistered(shortcuts.settings)).toBe(true);
            expect(manager.isRegistered(shortcuts.fullscreen)).toBe(true);
            expect(manager.isRegistered(shortcuts.quit)).toBe(true);

            // Property: Triggering each shortcut should call its handler exactly once
            globalShortcut._trigger(shortcuts.newFlashcard);
            expect(handlers.onNewFlashcard).toHaveBeenCalledTimes(1);
            expect(state.newFlashcardCalled).toBe(true);

            globalShortcut._trigger(shortcuts.fileUpload);
            expect(handlers.onFileUpload).toHaveBeenCalledTimes(1);
            expect(state.fileUploadCalled).toBe(true);

            globalShortcut._trigger(shortcuts.settings);
            expect(handlers.onSettings).toHaveBeenCalledTimes(1);
            expect(state.settingsCalled).toBe(true);

            globalShortcut._trigger(shortcuts.fullscreen);
            expect(handlers.onFullscreen).toHaveBeenCalledTimes(1);
            expect(state.fullscreenCalled).toBe(true);

            globalShortcut._trigger(shortcuts.quit);
            expect(handlers.onQuit).toHaveBeenCalledTimes(1);
            expect(state.quitCalled).toBe(true);

            // Property: Each handler should only be called by its own shortcut
            // (no cross-triggering)
            expect(handlers.onNewFlashcard).toHaveBeenCalledTimes(1);
            expect(handlers.onFileUpload).toHaveBeenCalledTimes(1);
            expect(handlers.onSettings).toHaveBeenCalledTimes(1);
            expect(handlers.onFullscreen).toHaveBeenCalledTimes(1);
            expect(handlers.onQuit).toHaveBeenCalledTimes(1);

            // Cleanup
            manager.unregisterAll();
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      );
    });

    /**
     * Property: Shortcuts should remain consistent across multiple trigger cycles
     */
    test('shortcuts trigger consistently across multiple presses', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // Number of times to press each shortcut
          (pressCount) => {
            // Create handlers that count calls
            const callCounts = {
              newFlashcard: 0,
              fileUpload: 0,
              settings: 0,
              fullscreen: 0,
              quit: 0,
            };

            const handlers = {
              onNewFlashcard: jest.fn(() => { callCounts.newFlashcard++; }),
              onFileUpload: jest.fn(() => { callCounts.fileUpload++; }),
              onSettings: jest.fn(() => { callCounts.settings++; }),
              onFullscreen: jest.fn(() => { callCounts.fullscreen++; }),
              onQuit: jest.fn(() => { callCounts.quit++; }),
            };

            // Register all shortcuts
            manager.registerAll(handlers);

            // Get the platform-specific shortcuts
            const isMac = process.platform === 'darwin';
            const shortcuts = {
              newFlashcard: isMac ? 'Command+N' : 'Control+N',
              fileUpload: isMac ? 'Command+O' : 'Control+O',
              settings: isMac ? 'Command+,' : 'Control+,',
              fullscreen: 'F11',
              quit: isMac ? 'Command+Q' : 'Control+Q',
            };

            // Trigger each shortcut multiple times
            for (let i = 0; i < pressCount; i++) {
              globalShortcut._trigger(shortcuts.newFlashcard);
              globalShortcut._trigger(shortcuts.fileUpload);
              globalShortcut._trigger(shortcuts.settings);
              globalShortcut._trigger(shortcuts.fullscreen);
              globalShortcut._trigger(shortcuts.quit);
            }

            // Property: Each handler should be called exactly pressCount times
            expect(handlers.onNewFlashcard).toHaveBeenCalledTimes(pressCount);
            expect(handlers.onFileUpload).toHaveBeenCalledTimes(pressCount);
            expect(handlers.onSettings).toHaveBeenCalledTimes(pressCount);
            expect(handlers.onFullscreen).toHaveBeenCalledTimes(pressCount);
            expect(handlers.onQuit).toHaveBeenCalledTimes(pressCount);

            expect(callCounts.newFlashcard).toBe(pressCount);
            expect(callCounts.fileUpload).toBe(pressCount);
            expect(callCounts.settings).toBe(pressCount);
            expect(callCounts.fullscreen).toBe(pressCount);
            expect(callCounts.quit).toBe(pressCount);

            // Cleanup
            manager.unregisterAll();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Unregistering shortcuts should prevent them from triggering
     */
    test('unregistered shortcuts do not trigger handlers', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('newFlashcard', 'fileUpload', 'settings', 'fullscreen', 'quit'),
          (shortcutToUnregister) => {
            // Create handlers
            const handlers = {
              onNewFlashcard: jest.fn(),
              onFileUpload: jest.fn(),
              onSettings: jest.fn(),
              onFullscreen: jest.fn(),
              onQuit: jest.fn(),
            };

            // Register all shortcuts
            manager.registerAll(handlers);

            // Get the platform-specific shortcuts
            const isMac = process.platform === 'darwin';
            const shortcuts = {
              newFlashcard: isMac ? 'Command+N' : 'Control+N',
              fileUpload: isMac ? 'Command+O' : 'Control+O',
              settings: isMac ? 'Command+,' : 'Control+,',
              fullscreen: 'F11',
              quit: isMac ? 'Command+Q' : 'Control+Q',
            };

            // Unregister one shortcut
            const acceleratorToUnregister = shortcuts[shortcutToUnregister];
            manager.unregister(acceleratorToUnregister);

            // Clear mock call history
            Object.values(handlers).forEach(handler => handler.mockClear());

            // Try to trigger all shortcuts
            Object.values(shortcuts).forEach(accelerator => {
              globalShortcut._trigger(accelerator);
            });

            // Property: The unregistered shortcut's handler should not be called
            const handlerKey = `on${shortcutToUnregister.charAt(0).toUpperCase()}${shortcutToUnregister.slice(1)}`;
            expect(handlers[handlerKey]).not.toHaveBeenCalled();

            // Property: Other shortcuts should still work
            Object.entries(handlers).forEach(([key, handler]) => {
              if (key !== handlerKey) {
                expect(handler).toHaveBeenCalledTimes(1);
              }
            });

            // Cleanup
            manager.unregisterAll();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Shortcut count should match registered shortcuts
     */
    test('shortcut count matches number of registered shortcuts', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            // Create handlers
            const handlers = {
              onNewFlashcard: jest.fn(),
              onFileUpload: jest.fn(),
              onSettings: jest.fn(),
              onFullscreen: jest.fn(),
              onQuit: jest.fn(),
            };

            // Initially, no shortcuts should be registered
            expect(manager.getShortcutCount()).toBe(0);

            // Register all shortcuts
            manager.registerAll(handlers);

            // Property: After registration, count should be 5
            expect(manager.getShortcutCount()).toBe(5);

            // Get registered shortcuts map
            const registeredShortcuts = manager.getRegisteredShortcuts();
            expect(registeredShortcuts.size).toBe(5);

            // Unregister all
            manager.unregisterAll();

            // Property: After unregistering all, count should be 0
            expect(manager.getShortcutCount()).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
