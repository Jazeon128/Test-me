/**
 * Splash Window Preload Script
 * Provides secure IPC bridge for splash window
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose splash API to renderer
contextBridge.exposeInMainWorld('splashAPI', {
  /**
   * Listen for progress updates
   * @param {Function} callback - Callback function receiving progress data
   */
  onProgress: (callback) => {
    ipcRenderer.on('splash:progress', (event, data) => {
      callback(data);
    });
  },

  /**
   * Listen for version updates
   * @param {Function} callback - Callback function receiving version string
   */
  onVersion: (callback) => {
    ipcRenderer.on('splash:version', (event, version) => {
      callback(version);
    });
  },
});
