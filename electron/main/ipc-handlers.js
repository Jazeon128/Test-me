/**
 * IPC Handlers
 * Handles inter-process communication between renderer and main process
 * Implements Requirements 9.1, 9.2: Native dialogs and application info access
 */

const { ipcMain, dialog, app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Set up all IPC handlers
 * @param {Object} context - Application context
 * @param {BrowserWindow} context.mainWindow - Main application window
 * @param {BackendManager} context.backendManager - Backend process manager
 * @param {SettingsManager} context.settingsManager - Settings manager
 * @param {Logger} context.logger - Logger instance
 * @param {AutoUpdaterManager} context.autoUpdaterManager - Auto-updater manager
 */
function setupIpcHandlers({ mainWindow, backendManager, settingsManager, logger, autoUpdaterManager }) {
  /**
   * Handle open-file-dialog requests
   * Opens a native file picker dialog
   * Requirements 9.1: Native file dialogs
   */
  ipcMain.handle('open-file-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Documents', extensions: ['pdf', 'docx', 'md', 'txt', 'html'] },
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'Word Documents', extensions: ['docx'] },
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'HTML Files', extensions: ['html'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled) {
        return {
          success: true,
          data: {
            canceled: true,
            filePaths: [],
          },
        };
      }

      return {
        success: true,
        data: {
          canceled: false,
          filePaths: result.filePaths,
        },
      };
    } catch (error) {
      console.error('Error opening file dialog:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle open-settings requests
   * Opens the settings dialog/window
   * Requirements 9.1: Settings access
   */
  ipcMain.handle('open-settings', async () => {
    try {
      // For now, just return success
      // The actual settings dialog will be implemented in the frontend
      return {
        success: true,
        data: {
          opened: true,
        },
      };
    } catch (error) {
      console.error('Error opening settings:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle get-logs requests
   * Retrieves application logs
   * Requirements 9.2: Log access
   */
  ipcMain.handle('get-logs', async () => {
    try {
      if (!logger) {
        return {
          success: true,
          data: {
            logs: [],
            message: 'Logger not initialized',
          },
        };
      }

      const logs = await logger.getRecentLogs(100);

      return {
        success: true,
        data: {
          logs,
          logPath: logger.getLogPath(),
          ...(logs.length === 0 ? { message: 'No logs available yet' } : {}),
        },
      };
    } catch (error) {
      console.error('Error getting logs:', error);
      if (logger) {
        await logger.error('Failed to retrieve logs', error);
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle get-app-info requests
   * Returns application version and system information
   * Requirements 9.2: Application info access
   */
  ipcMain.handle('get-app-info', async () => {
    try {
      const appInfo = {
        version: app.getVersion(),
        name: app.getName(),
        platform: process.platform,
        arch: process.arch,
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        nodeVersion: process.versions.node,
        os: {
          type: os.type(),
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
          hostname: os.hostname(),
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          cpus: os.cpus().length,
        },
        paths: {
          userData: app.getPath('userData'),
          appData: app.getPath('appData'),
          temp: app.getPath('temp'),
          logs: app.getPath('logs'),
        },
      };

      // Add backend info if available
      if (backendManager) {
        appInfo.backend = {
          running: backendManager.isRunning(),
          port: backendManager.getPort(),
          crashStats: backendManager.getCrashStats(),
        };
      }

      // Add settings info if available
      if (settingsManager) {
        appInfo.settings = {
          hasApiKeys: settingsManager.hasApiKeys(),
          apiProvider: settingsManager.get('apiProvider'),
          theme: settingsManager.get('theme'),
          autoUpdate: settingsManager.get('autoUpdate'),
        };
      }

      return {
        success: true,
        data: appInfo,
      };
    } catch (error) {
      console.error('Error getting app info:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle quit-app requests
   * Quits the application gracefully
   * Requirements 9.1: Application control
   */
  ipcMain.handle('quit-app', async () => {
    try {
      // Set quitting flag to prevent minimize to tray
      if (global.isQuitting !== undefined) {
        global.isQuitting = true;
      }
      
      // Quit the app
      app.quit();
      
      return {
        success: true,
        data: {
          quitting: true,
        },
      };
    } catch (error) {
      console.error('Error quitting app:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle get-backend-port requests
   * Returns the current backend port
   */
  ipcMain.handle('get-backend-port', async () => {
    try {
      if (!backendManager) {
        return {
          success: false,
          error: 'Backend manager not initialized',
        };
      }

      const port = backendManager.getPort();
      
      if (!port) {
        return {
          success: false,
          error: 'Backend not running',
        };
      }

      return {
        success: true,
        data: {
          port,
          baseUrl: `http://127.0.0.1:${port}`,
        },
      };
    } catch (error) {
      console.error('Error getting backend port:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle get-settings requests
   * Returns all application settings
   */
  ipcMain.handle('get-settings', async () => {
    try {
      if (!settingsManager) {
        return {
          success: false,
          error: 'Settings manager not initialized',
        };
      }

      const settings = settingsManager.getAll();
      const apiKeys = settingsManager.getApiKeys();

      return {
        success: true,
        data: {
          settings,
          hasApiKeys: settingsManager.hasApiKeys(),
          apiProvider: settings.apiProvider,
          // Don't send actual API keys to renderer for security
          apiKeysConfigured: {
            openai: !!apiKeys.openai,
            anthropic: !!apiKeys.anthropic,
            google: !!apiKeys.google,
          },
        },
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle set-setting requests
   * Updates a single setting
   */
  ipcMain.handle('set-setting', async (event, { key, value }) => {
    try {
      if (!settingsManager) {
        return {
          success: false,
          error: 'Settings manager not initialized',
        };
      }

      settingsManager.set(key, value);

      return {
        success: true,
        data: {
          key,
          value,
        },
      };
    } catch (error) {
      console.error('Error setting setting:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle set-api-key requests
   * Updates an API key for a provider
   */
  ipcMain.handle('set-api-key', async (event, { provider, key }) => {
    try {
      if (!settingsManager) {
        return {
          success: false,
          error: 'Settings manager not initialized',
        };
      }

      // This will validate and throw if invalid
      settingsManager.setApiKey(provider, key);

      return {
        success: true,
        data: {
          provider,
          configured: !!key,
        },
      };
    } catch (error) {
      console.error('Error setting API key:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle export-logs requests
   * Exports logs to a user-selected location
   */
  ipcMain.handle('export-logs', async () => {
    try {
      if (!logger) {
        return {
          success: false,
          error: 'Logger not initialized',
        };
      }

      const logPath = logger.getLogPath();

      // Check if log file exists
      try {
        await fs.access(logPath);
      } catch (error) {
        return {
          success: false,
          error: 'No logs available to export',
        };
      }

      // Show save dialog
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Logs',
        defaultPath: `flashlearn-logs-${new Date().toISOString().split('T')[0]}.log`,
        filters: [
          { name: 'Log Files', extensions: ['log'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled) {
        return {
          success: true,
          data: {
            canceled: true,
          },
        };
      }

      // Copy log file to selected location
      await fs.copyFile(logPath, result.filePath);

      if (logger) {
        await logger.info('Logs exported', { destination: result.filePath });
      }

      return {
        success: true,
        data: {
          canceled: false,
          filePath: result.filePath,
        },
      };
    } catch (error) {
      console.error('Error exporting logs:', error);
      if (logger) {
        await logger.error('Failed to export logs', error);
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle restart-backend requests
   * Restarts the backend process
   * Requirements 6.1: Backend failure handling with retry
   */
  ipcMain.handle('restart-backend', async () => {
    try {
      if (!backendManager) {
        return {
          success: false,
          error: 'Backend manager not initialized',
        };
      }

      await backendManager.restart();
      const port = backendManager.getPort();

      return {
        success: true,
        data: {
          port,
          baseUrl: `http://127.0.0.1:${port}`,
        },
      };
    } catch (error) {
      console.error('Error restarting backend:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle check-for-updates requests
   * Manually triggers an update check
   * Requirements 5.1: Check for updates
   */
  ipcMain.handle('check-for-updates', async () => {
    try {
      if (!autoUpdaterManager) {
        return {
          success: false,
          error: 'Auto-updater not initialized',
        };
      }

      const updateAvailable = await autoUpdaterManager.checkForUpdates();

      return {
        success: true,
        data: {
          updateAvailable,
          status: autoUpdaterManager.getStatus(),
        },
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle download-update requests
   * Downloads an available update
   * Requirements 5.3: Download update
   */
  ipcMain.handle('download-update', async () => {
    try {
      if (!autoUpdaterManager) {
        return {
          success: false,
          error: 'Auto-updater not initialized',
        };
      }

      await autoUpdaterManager.downloadUpdate();

      return {
        success: true,
        data: {
          downloading: true,
        },
      };
    } catch (error) {
      console.error('Error downloading update:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle install-update requests
   * Installs a downloaded update and restarts
   * Requirements 5.4: Install update and restart
   */
  ipcMain.handle('install-update', async () => {
    try {
      if (!autoUpdaterManager) {
        return {
          success: false,
          error: 'Auto-updater not initialized',
        };
      }

      autoUpdaterManager.quitAndInstall();

      return {
        success: true,
        data: {
          installing: true,
        },
      };
    } catch (error) {
      console.error('Error installing update:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle get-update-status requests
   * Returns current update status
   */
  ipcMain.handle('get-update-status', async () => {
    try {
      if (!autoUpdaterManager) {
        return {
          success: false,
          error: 'Auto-updater not initialized',
        };
      }

      const status = autoUpdaterManager.getStatus();

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      console.error('Error getting update status:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle generate-diagnostic-report requests
   * Generates a diagnostic report
   * Requirements 9.3: Diagnostic report generation
   */
  ipcMain.handle('generate-diagnostic-report', async () => {
    try {
      // Import DiagnosticReport class
      const DiagnosticReport = require('./diagnostic-report');
      
      if (!logger || !settingsManager) {
        return {
          success: false,
          error: 'Required components not initialized',
        };
      }

      const diagnosticReport = new DiagnosticReport(logger, settingsManager);
      const report = await diagnosticReport.generate();

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      console.error('Error generating diagnostic report:', error);
      if (logger) {
        await logger.error('Failed to generate diagnostic report', error);
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Handle export-diagnostic-report requests
   * Exports diagnostic report to a file
   * Requirements 9.3: Diagnostic report export
   */
  ipcMain.handle('export-diagnostic-report', async () => {
    try {
      // Import DiagnosticReport class
      const DiagnosticReport = require('./diagnostic-report');
      
      if (!logger || !settingsManager) {
        return {
          success: false,
          error: 'Required components not initialized',
        };
      }

      // Show save dialog
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Diagnostic Report',
        defaultPath: `flashlearn-diagnostic-${new Date().toISOString().split('T')[0]}.txt`,
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled) {
        return {
          success: true,
          data: {
            canceled: true,
          },
        };
      }

      const diagnosticReport = new DiagnosticReport(logger, settingsManager);
      
      // Save as JSON or text based on extension
      const ext = path.extname(result.filePath).toLowerCase();
      if (ext === '.json') {
        const jsonReport = await diagnosticReport.generateJSON();
        await fs.writeFile(result.filePath, jsonReport, 'utf8');
      } else {
        await diagnosticReport.saveToFile(result.filePath);
      }

      if (logger) {
        await logger.info('Diagnostic report exported', { destination: result.filePath });
      }

      return {
        success: true,
        data: {
          canceled: false,
          filePath: result.filePath,
        },
      };
    } catch (error) {
      console.error('Error exporting diagnostic report:', error);
      if (logger) {
        await logger.error('Failed to export diagnostic report', error);
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });

  console.log('IPC handlers registered successfully');
}

/**
 * Remove all IPC handlers
 */
function removeIpcHandlers() {
  const channels = [
    'open-file-dialog',
    'open-settings',
    'get-logs',
    'get-app-info',
    'quit-app',
    'get-backend-port',
    'get-settings',
    'set-setting',
    'set-api-key',
    'export-logs',
    'restart-backend',
    'check-for-updates',
    'download-update',
    'install-update',
    'get-update-status',
    'generate-diagnostic-report',
    'export-diagnostic-report',
  ];

  channels.forEach(channel => {
    ipcMain.removeHandler(channel);
  });

  console.log('IPC handlers removed');
}

module.exports = {
  setupIpcHandlers,
  removeIpcHandlers,
};
