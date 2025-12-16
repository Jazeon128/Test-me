/**
 * Keyboard Shortcuts Manager
 * Manages global keyboard shortcuts for the application
 * Implements Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

const { globalShortcut, app } = require('electron');

class KeyboardShortcutsManager {
  constructor() {
    this.shortcuts = new Map();
    this.registered = false;
  }

  /**
   * Register all keyboard shortcuts
   * @param {Object} handlers - Object containing handler functions
   * @param {Function} handlers.onNewFlashcard - Handler for new flashcard shortcut
   * @param {Function} handlers.onFileUpload - Handler for file upload shortcut
   * @param {Function} handlers.onSettings - Handler for settings shortcut
   * @param {Function} handlers.onFullscreen - Handler for fullscreen toggle shortcut
   * @param {Function} handlers.onQuit - Handler for quit shortcut
   */
  registerAll(handlers) {
    if (this.registered) {
      console.warn('Shortcuts already registered');
      return;
    }

    const isMac = process.platform === 'darwin';

    // Requirements 10.1: Ctrl+N / Cmd+N for new flashcard
    const newFlashcardShortcut = isMac ? 'Command+N' : 'Control+N';
    this.register(newFlashcardShortcut, handlers.onNewFlashcard, 'New Flashcard');

    // Requirements 10.2: Ctrl+O / Cmd+O for file upload
    const fileUploadShortcut = isMac ? 'Command+O' : 'Control+O';
    this.register(fileUploadShortcut, handlers.onFileUpload, 'File Upload');

    // Requirements 10.3: Ctrl+, / Cmd+, for settings
    const settingsShortcut = isMac ? 'Command+,' : 'Control+,';
    this.register(settingsShortcut, handlers.onSettings, 'Settings');

    // Requirements 10.4: F11 for fullscreen toggle
    this.register('F11', handlers.onFullscreen, 'Fullscreen Toggle');

    // Requirements 10.5: Ctrl+Q / Cmd+Q for quit
    const quitShortcut = isMac ? 'Command+Q' : 'Control+Q';
    this.register(quitShortcut, handlers.onQuit, 'Quit');

    this.registered = true;
    console.log('All keyboard shortcuts registered');
  }

  /**
   * Register a single keyboard shortcut
   * @param {string} accelerator - The keyboard shortcut (e.g., 'Control+N')
   * @param {Function} handler - The function to call when shortcut is pressed
   * @param {string} description - Description of the shortcut
   */
  register(accelerator, handler, description = '') {
    try {
      const success = globalShortcut.register(accelerator, () => {
        console.log(`Keyboard shortcut triggered: ${accelerator} (${description})`);
        if (typeof handler === 'function') {
          handler();
        } else {
          console.warn(`No handler provided for shortcut: ${accelerator}`);
        }
      });

      if (success) {
        this.shortcuts.set(accelerator, { handler, description });
        console.log(`Registered shortcut: ${accelerator} (${description})`);
      } else {
        console.error(`Failed to register shortcut: ${accelerator}`);
      }

      return success;
    } catch (error) {
      console.error(`Error registering shortcut ${accelerator}:`, error);
      return false;
    }
  }

  /**
   * Unregister a specific keyboard shortcut
   * @param {string} accelerator - The keyboard shortcut to unregister
   */
  unregister(accelerator) {
    try {
      globalShortcut.unregister(accelerator);
      this.shortcuts.delete(accelerator);
      console.log(`Unregistered shortcut: ${accelerator}`);
    } catch (error) {
      console.error(`Error unregistering shortcut ${accelerator}:`, error);
    }
  }

  /**
   * Unregister all keyboard shortcuts
   */
  unregisterAll() {
    try {
      globalShortcut.unregisterAll();
      this.shortcuts.clear();
      this.registered = false;
      console.log('All keyboard shortcuts unregistered');
    } catch (error) {
      console.error('Error unregistering all shortcuts:', error);
    }
  }

  /**
   * Check if a shortcut is registered
   * @param {string} accelerator - The keyboard shortcut to check
   * @returns {boolean} True if the shortcut is registered
   */
  isRegistered(accelerator) {
    return globalShortcut.isRegistered(accelerator);
  }

  /**
   * Get all registered shortcuts
   * @returns {Map} Map of registered shortcuts
   */
  getRegisteredShortcuts() {
    return new Map(this.shortcuts);
  }

  /**
   * Get the count of registered shortcuts
   * @returns {number} Number of registered shortcuts
   */
  getShortcutCount() {
    return this.shortcuts.size;
  }
}

module.exports = KeyboardShortcutsManager;
