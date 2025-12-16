/**
 * Splash Window Manager
 * Manages the splash screen displayed during application startup
 * Implements Requirements 8.1, 8.4, 8.5: Display splash screen within 1 second, show loading progress
 */

const { BrowserWindow } = require('electron');
const path = require('path');

class SplashWindowManager {
  constructor() {
    this.splashWindow = null;
    this.creationTime = null;
  }

  /**
   * Create and show the splash window
   * Requirements 8.1: Display within 1 second of launch
   */
  create() {
    this.creationTime = Date.now();

    this.splashWindow = new BrowserWindow({
      width: 500,
      height: 350,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      skipTaskbar: true,
      center: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/splash-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    // Load splash screen HTML
    const splashPath = path.join(__dirname, '../renderer/splash.html');
    this.splashWindow.loadFile(splashPath);

    // Show immediately (no waiting for ready-to-show)
    this.splashWindow.show();

    return this.splashWindow;
  }

  /**
   * Update loading progress
   * Requirements 8.4: Show loading progress
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} status - Status message
   */
  updateProgress(progress, status) {
    if (this.splashWindow && !this.splashWindow.isDestroyed()) {
      this.splashWindow.webContents.send('splash:progress', {
        progress,
        status,
      });
    }
  }

  /**
   * Set the application version in splash screen
   * @param {string} version - Application version
   */
  setVersion(version) {
    if (this.splashWindow && !this.splashWindow.isDestroyed()) {
      this.splashWindow.webContents.send('splash:version', version);
    }
  }

  /**
   * Hide and destroy the splash window
   * Requirements 8.5: Hide when backend ready
   */
  close() {
    if (this.splashWindow && !this.splashWindow.isDestroyed()) {
      // Fade out effect (optional)
      this.splashWindow.setOpacity(0.8);
      setTimeout(() => {
        if (this.splashWindow && !this.splashWindow.isDestroyed()) {
          this.splashWindow.setOpacity(0.6);
          setTimeout(() => {
            if (this.splashWindow && !this.splashWindow.isDestroyed()) {
              this.splashWindow.close();
              this.splashWindow = null;
            }
          }, 100);
        }
      }, 100);
    }
  }

  /**
   * Get the time elapsed since splash window creation
   * @returns {number} Time in milliseconds
   */
  getElapsedTime() {
    if (!this.creationTime) {
      return 0;
    }
    return Date.now() - this.creationTime;
  }

  /**
   * Check if splash window is currently shown
   * @returns {boolean}
   */
  isShown() {
    return this.splashWindow !== null && !this.splashWindow.isDestroyed();
  }

  /**
   * Get the splash window instance
   * @returns {BrowserWindow|null}
   */
  getWindow() {
    return this.splashWindow;
  }
}

module.exports = SplashWindowManager;
