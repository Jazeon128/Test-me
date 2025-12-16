/**
 * Electron Preload Script
 * Provides secure IPC bridge between renderer and main process
 * Implements Requirements 1.2: Secure IPC communication with type-safe API
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Type-safe IPC API exposed to renderer process
 * All methods return Promise<IPCResponse>
 * 
 * @typedef {Object} IPCResponse
 * @property {boolean} success - Whether the operation succeeded
 * @property {*} [data] - Response data if successful
 * @property {string} [error] - Error message if failed
 */

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * File Operations
   */
  
  /**
   * Open native file picker dialog
   * @returns {Promise<IPCResponse>} Response with selected file paths
   */
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  
  /**
   * Settings Management
   */
  
  /**
   * Open settings dialog
   * @returns {Promise<IPCResponse>} Response indicating settings opened
   */
  openSettings: () => ipcRenderer.invoke('open-settings'),
  
  /**
   * Get all application settings
   * @returns {Promise<IPCResponse>} Response with settings object
   */
  getSettings: () => ipcRenderer.invoke('get-settings'),
  
  /**
   * Set a single setting value
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   * @returns {Promise<IPCResponse>} Response confirming setting updated
   */
  setSetting: (key, value) => {
    if (typeof key !== 'string') {
      return Promise.resolve({
        success: false,
        error: 'Setting key must be a string',
      });
    }
    return ipcRenderer.invoke('set-setting', { key, value });
  },
  
  /**
   * Set API key for a provider
   * @param {string} provider - Provider name (openai, anthropic, google)
   * @param {string} key - API key
   * @returns {Promise<IPCResponse>} Response confirming API key set
   */
  setApiKey: (provider, key) => {
    if (typeof provider !== 'string' || typeof key !== 'string') {
      return Promise.resolve({
        success: false,
        error: 'Provider and key must be strings',
      });
    }
    return ipcRenderer.invoke('set-api-key', { provider, key });
  },
  
  /**
   * Logging and Diagnostics
   */
  
  /**
   * Get application logs
   * @returns {Promise<IPCResponse>} Response with log entries
   */
  getLogs: () => ipcRenderer.invoke('get-logs'),
  
  /**
   * Export logs to a file
   * @returns {Promise<IPCResponse>} Response with export file path
   */
  exportLogs: () => ipcRenderer.invoke('export-logs'),
  
  /**
   * Generate a diagnostic report
   * @returns {Promise<IPCResponse>} Response with diagnostic report data
   */
  generateDiagnosticReport: () => ipcRenderer.invoke('generate-diagnostic-report'),
  
  /**
   * Export diagnostic report to a file
   * @returns {Promise<IPCResponse>} Response with export file path
   */
  exportDiagnosticReport: () => ipcRenderer.invoke('export-diagnostic-report'),
  
  /**
   * Application Info
   */
  
  /**
   * Get application version and system information
   * @returns {Promise<IPCResponse>} Response with app info
   */
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  /**
   * Backend Communication
   */
  
  /**
   * Get the current backend port
   * @returns {Promise<IPCResponse>} Response with backend port and base URL
   */
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
  
  /**
   * Restart the backend process
   * @returns {Promise<IPCResponse>} Response with new backend port and base URL
   */
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  
  /**
   * Application Control
   */
  
  /**
   * Quit the application
   * @returns {Promise<IPCResponse>} Response confirming quit initiated
   */
  quitApp: () => ipcRenderer.invoke('quit-app'),
  
  /**
   * Platform Information
   */
  
  /**
   * Get the current platform
   * @returns {string} Platform identifier (win32, darwin, linux)
   */
  platform: process.platform,
  
  /**
   * Check if running on macOS
   * @returns {boolean} True if macOS
   */
  isMac: process.platform === 'darwin',
  
  /**
   * Check if running on Windows
   * @returns {boolean} True if Windows
   */
  isWindows: process.platform === 'win32',
  
  /**
   * Check if running on Linux
   * @returns {boolean} True if Linux
   */
  isLinux: process.platform === 'linux',
  
  /**
   * Keyboard Shortcuts
   * Requirements 10.1, 10.2, 10.3, 10.4, 10.5
   */
  
  /**
   * Register a listener for keyboard shortcut events
   * @param {string} shortcut - Shortcut name (new-flashcard, file-upload, settings)
   * @param {Function} callback - Function to call when shortcut is triggered
   */
  onShortcut: (shortcut, callback) => {
    const validShortcuts = ['new-flashcard', 'file-upload', 'settings'];
    if (!validShortcuts.includes(shortcut)) {
      console.warn(`Invalid shortcut: ${shortcut}`);
      return;
    }
    if (typeof callback !== 'function') {
      console.warn('Callback must be a function');
      return;
    }
    ipcRenderer.on(`shortcut:${shortcut}`, callback);
  },
  
  /**
   * Remove a keyboard shortcut event listener
   * @param {string} shortcut - Shortcut name
   * @param {Function} callback - The callback to remove
   */
  removeShortcutListener: (shortcut, callback) => {
    ipcRenderer.removeListener(`shortcut:${shortcut}`, callback);
  },
  
  /**
   * Auto-Updater
   * Requirements 5.1, 5.2, 5.3, 5.4, 5.5
   */
  
  /**
   * Check for application updates
   * @returns {Promise<IPCResponse>} Response with update availability
   */
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  /**
   * Download an available update
   * @returns {Promise<IPCResponse>} Response confirming download started
   */
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  
  /**
   * Install a downloaded update and restart
   * @returns {Promise<IPCResponse>} Response confirming installation started
   */
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  /**
   * Get current update status
   * @returns {Promise<IPCResponse>} Response with update status
   */
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  
  /**
   * Register a listener for update events
   * @param {string} event - Event name (available, downloaded, download-progress, error)
   * @param {Function} callback - Function to call when event occurs
   */
  onUpdateEvent: (event, callback) => {
    const validEvents = ['available', 'downloaded', 'download-progress', 'error'];
    if (!validEvents.includes(event)) {
      console.warn(`Invalid update event: ${event}`);
      return;
    }
    if (typeof callback !== 'function') {
      console.warn('Callback must be a function');
      return;
    }
    ipcRenderer.on(`update:${event}`, callback);
  },
  
  /**
   * Remove an update event listener
   * @param {string} event - Event name
   * @param {Function} callback - The callback to remove
   */
  removeUpdateListener: (event, callback) => {
    ipcRenderer.removeListener(`update:${event}`, callback);
  },
});
