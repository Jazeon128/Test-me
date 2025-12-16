/**
 * Auto-Updater Manager
 * Handles automatic application updates using electron-updater
 * Implements Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

class AutoUpdaterManager {
  constructor(settingsManager, logger) {
    this.settingsManager = settingsManager;
    this.logger = logger;
    this.updateAvailable = false;
    this.updateInfo = null;
    this.downloadProgress = 0;
    this.mainWindow = null;
    
    // Configure auto-updater
    this._configure();
    this._setupEventHandlers();
  }

  /**
   * Configure auto-updater settings
   * @private
   */
  _configure() {
    // Set update server URL
    // In production, this should point to your release server
    // For GitHub releases, electron-updater will automatically use GitHub
    autoUpdater.autoDownload = false; // We'll control when to download
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Configure update channel (stable, beta, etc.)
    const channel = this.settingsManager.get('updateChannel', 'stable');
    autoUpdater.channel = channel;
    
    // Enable logging
    autoUpdater.logger = this.logger;
  }

  /**
   * Set up event handlers for auto-updater
   * @private
   */
  _setupEventHandlers() {
    // Checking for update
    autoUpdater.on('checking-for-update', () => {
      this._log('info', 'Checking for updates...');
    });

    // Update available
    autoUpdater.on('update-available', (info) => {
      this._log('info', 'Update available', { version: info.version });
      this.updateAvailable = true;
      this.updateInfo = info;
      this._notifyUpdateAvailable(info);
    });

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      this._log('info', 'Update not available', { version: info.version });
      this.updateAvailable = false;
      this.updateInfo = null;
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      this.downloadProgress = progressObj.percent;
      this._log('info', 'Download progress', { 
        percent: progressObj.percent.toFixed(2),
        transferred: progressObj.transferred,
        total: progressObj.total
      });
      
      // Notify renderer of progress
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update:download-progress', {
          percent: progressObj.percent,
          transferred: progressObj.transferred,
          total: progressObj.total
        });
      }
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      this._log('info', 'Update downloaded', { version: info.version });
      this._notifyUpdateDownloaded(info);
    });

    // Error occurred
    autoUpdater.on('error', (error) => {
      this._log('error', 'Update error', error);
      this.updateAvailable = false;
      this.updateInfo = null;
      
      // Notify renderer of error
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update:error', {
          message: error.message
        });
      }
    });
  }

  /**
   * Set the main window reference
   * @param {BrowserWindow} window - Main window instance
   */
  setMainWindow(window) {
    this.mainWindow = window;
  }

  /**
   * Check for updates
   * Implements Requirements 5.1: Check for updates on startup
   * @returns {Promise<boolean>} True if update is available
   */
  async checkForUpdates() {
    try {
      // Check if auto-update is enabled
      const autoUpdateEnabled = this.settingsManager.get('autoUpdate', true);
      if (!autoUpdateEnabled) {
        this._log('info', 'Auto-update is disabled');
        return false;
      }

      this._log('info', 'Starting update check');
      const result = await autoUpdater.checkForUpdates();
      
      if (result && result.updateInfo) {
        return result.updateInfo.version !== autoUpdater.currentVersion.version;
      }
      
      return false;
    } catch (error) {
      this._log('error', 'Failed to check for updates', error);
      return false;
    }
  }

  /**
   * Download the available update
   * Implements Requirements 5.3: Download update in background
   * Note: electron-updater automatically verifies checksums during download
   * @returns {Promise<void>}
   */
  async downloadUpdate() {
    try {
      this._log('info', 'Starting update download');
      // electron-updater handles checksum verification automatically
      // It will emit an 'error' event if verification fails
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this._log('error', 'Failed to download update', error);
      throw error;
    }
  }

  /**
   * Install the downloaded update and restart the app
   * Implements Requirements 5.3, 5.4: Install update and restart
   */
  quitAndInstall() {
    this._log('info', 'Installing update and restarting');
    autoUpdater.quitAndInstall(false, true);
  }

  /**
   * Notify user that an update is available
   * Implements Requirements 5.2: Display update notification
   * @param {object} info - Update information
   * @private
   */
  _notifyUpdateAvailable(info) {
    // Check if this update was previously declined
    const declinedVersion = this.settingsManager.get('declinedUpdateVersion');
    const shouldRemind = this._shouldRemindAboutUpdate(declinedVersion, info.version);
    
    if (declinedVersion === info.version && !shouldRemind) {
      this._log('info', 'Update was previously declined, skipping notification');
      return;
    }

    // Send notification to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update:available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    }

    // Also show native dialog as fallback
    const response = dialog.showMessageBoxSync(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: 'Would you like to download and install it?',
      buttons: ['Download Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (response === 0) {
      // User accepted, download update
      this.downloadUpdate();
    } else {
      // User declined, track this
      this._trackDeclinedUpdate(info.version);
    }
  }

  /**
   * Notify user that update has been downloaded
   * @param {object} info - Update information
   * @private
   */
  _notifyUpdateDownloaded(info) {
    // Send notification to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update:downloaded', {
        version: info.version
      });
    }

    // Show dialog to restart
    const response = dialog.showMessageBoxSync(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update has been downloaded',
      detail: 'The application will restart to install the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (response === 0) {
      // User wants to restart now
      this.quitAndInstall();
    }
  }

  /**
   * Track that user declined an update
   * Implements Requirements 5.5: Track declined updates
   * @param {string} version - Version that was declined
   * @private
   */
  _trackDeclinedUpdate(version) {
    this.settingsManager.set('declinedUpdateVersion', version);
    this.settingsManager.set('declinedUpdateTimestamp', Date.now());
    this._log('info', 'User declined update', { version });
  }

  /**
   * Check if we should remind user about a declined update
   * Implements Requirements 5.5: Show reminder on next startup
   * @param {string} declinedVersion - Previously declined version
   * @param {string} currentVersion - Current available version
   * @returns {boolean} True if should remind
   * @private
   */
  _shouldRemindAboutUpdate(declinedVersion, currentVersion) {
    if (!declinedVersion) {
      return true;
    }

    // If it's a different version, always remind
    if (declinedVersion !== currentVersion) {
      return true;
    }

    // Check if enough time has passed (e.g., 24 hours)
    const declinedTimestamp = this.settingsManager.get('declinedUpdateTimestamp', 0);
    const hoursSinceDeclined = (Date.now() - declinedTimestamp) / (1000 * 60 * 60);
    
    // Remind after 24 hours
    return hoursSinceDeclined >= 24;
  }

  /**
   * Get current update status
   * @returns {object} Update status
   */
  getStatus() {
    return {
      updateAvailable: this.updateAvailable,
      updateInfo: this.updateInfo,
      downloadProgress: this.downloadProgress,
      currentVersion: autoUpdater.currentVersion ? autoUpdater.currentVersion.version : null
    };
  }

  /**
   * Log a message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {*} data - Additional data
   * @private
   */
  _log(level, message, data = {}) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](message, data);
    } else {
      console.log(`[AutoUpdater] ${level.toUpperCase()}: ${message}`, data);
    }
  }
}

module.exports = AutoUpdaterManager;
