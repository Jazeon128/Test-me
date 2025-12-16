/**
 * Window State Manager
 * Caches and manages window state for fast restoration
 * Implements Requirements 8.3: Target 500ms restoration time
 */

const Store = require('electron-store');

class WindowStateManager {
  constructor() {
    // Use electron-store for persistent state
    this.store = new Store({
      name: 'window-state',
      defaults: {
        bounds: {
          width: 1200,
          height: 800,
          x: undefined,
          y: undefined,
        },
        isMaximized: false,
        isFullScreen: false,
      },
    });

    // In-memory cache for fast access
    this.cache = {
      bounds: null,
      isMaximized: false,
      isFullScreen: false,
      lastUpdate: null,
    };

    // Load initial state into cache
    this._loadCache();
  }

  /**
   * Load state from persistent storage into cache
   * @private
   */
  _loadCache() {
    this.cache.bounds = this.store.get('bounds');
    this.cache.isMaximized = this.store.get('isMaximized');
    this.cache.isFullScreen = this.store.get('isFullScreen');
    this.cache.lastUpdate = Date.now();
  }

  /**
   * Get window bounds from cache (fast)
   * Requirements 8.3: Minimize restoration operations
   * @returns {Object} Window bounds {width, height, x, y}
   */
  getBounds() {
    return { ...this.cache.bounds };
  }

  /**
   * Get maximized state from cache (fast)
   * @returns {boolean}
   */
  isMaximized() {
    return this.cache.isMaximized;
  }

  /**
   * Get fullscreen state from cache (fast)
   * @returns {boolean}
   */
  isFullScreen() {
    return this.cache.isFullScreen;
  }

  /**
   * Save window state to cache and persistent storage
   * Requirements 8.3: Cache window state
   * @param {BrowserWindow} window - The window to save state from
   */
  saveState(window) {
    if (!window || window.isDestroyed()) {
      return;
    }

    // Update cache first (fast)
    this.cache.isMaximized = window.isMaximized();
    this.cache.isFullScreen = window.isFullScreen();

    // Only save bounds if not maximized or fullscreen
    if (!this.cache.isMaximized && !this.cache.isFullScreen) {
      const bounds = window.getBounds();
      this.cache.bounds = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
      };
    }

    this.cache.lastUpdate = Date.now();

    // Persist to storage (async, doesn't block)
    this._persistState();
  }

  /**
   * Persist cached state to storage
   * @private
   */
  _persistState() {
    try {
      this.store.set('bounds', this.cache.bounds);
      this.store.set('isMaximized', this.cache.isMaximized);
      this.store.set('isFullScreen', this.cache.isFullScreen);
    } catch (error) {
      console.error('Failed to persist window state:', error);
    }
  }

  /**
   * Restore window state from cache
   * Requirements 8.3: Target 500ms restoration time
   * @param {BrowserWindow} window - The window to restore state to
   */
  restoreState(window) {
    if (!window || window.isDestroyed()) {
      return;
    }

    const startTime = Date.now();

    try {
      // Restore bounds (fast - from cache)
      const bounds = this.getBounds();
      if (bounds.x !== undefined && bounds.y !== undefined) {
        window.setBounds(bounds);
      } else {
        // Center window if no position saved
        window.center();
      }

      // Restore maximized state (fast)
      if (this.cache.isMaximized) {
        window.maximize();
      }

      // Restore fullscreen state (fast)
      if (this.cache.isFullScreen) {
        window.setFullScreen(true);
      }

      const restorationTime = Date.now() - startTime;
      console.log(`Window state restored in ${restorationTime}ms`);

      // Should be well under 500ms target
      if (restorationTime > 500) {
        console.warn(`Window restoration took ${restorationTime}ms (target: 500ms)`);
      }
    } catch (error) {
      console.error('Failed to restore window state:', error);
    }
  }

  /**
   * Track window state changes and update cache
   * @param {BrowserWindow} window - The window to track
   */
  trackWindow(window) {
    if (!window || window.isDestroyed()) {
      return;
    }

    // Debounce state saves to avoid excessive writes
    let saveTimeout = null;
    const debouncedSave = () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        this.saveState(window);
      }, 500); // Save 500ms after last change
    };

    // Track resize events
    window.on('resize', debouncedSave);

    // Track move events
    window.on('move', debouncedSave);

    // Track maximize/unmaximize
    window.on('maximize', () => {
      this.cache.isMaximized = true;
      this._persistState();
    });

    window.on('unmaximize', () => {
      this.cache.isMaximized = false;
      this._persistState();
    });

    // Track fullscreen changes
    window.on('enter-full-screen', () => {
      this.cache.isFullScreen = true;
      this._persistState();
    });

    window.on('leave-full-screen', () => {
      this.cache.isFullScreen = false;
      this._persistState();
    });

    // Save state before window closes
    window.on('close', () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      this.saveState(window);
    });
  }

  /**
   * Get the time of last state update
   * @returns {number|null} Timestamp of last update
   */
  getLastUpdateTime() {
    return this.cache.lastUpdate;
  }

  /**
   * Reset window state to defaults
   */
  reset() {
    this.cache = {
      bounds: {
        width: 1200,
        height: 800,
        x: undefined,
        y: undefined,
      },
      isMaximized: false,
      isFullScreen: false,
      lastUpdate: Date.now(),
    };
    this._persistState();
  }
}

module.exports = WindowStateManager;
