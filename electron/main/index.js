/**
 * Electron Main Process
 * Manages application lifecycle, windows, and native OS features
 */

const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const BackendManager = require('./backend-manager');
const SettingsManager = require('./settings-manager');
const DataDirectoryManager = require('./data-directory-manager');
const Logger = require('./logger');
const KeyboardShortcutsManager = require('./keyboard-shortcuts');
const AutoUpdaterManager = require('./auto-updater');
const SplashWindowManager = require('./splash-window');
const WindowStateManager = require('./window-state-manager');
const { setupIpcHandlers, removeIpcHandlers } = require('./ipc-handlers');

let mainWindow = null;
let tray = null;
let backendManager = null;
let settingsManager = null;
let dataDirectoryManager = null;
let logger = null;
let keyboardShortcutsManager = null;
let autoUpdaterManager = null;
let splashWindowManager = null;
let windowStateManager = null;

// Make isQuitting global so IPC handlers can access it
global.isQuitting = false;

/**
 * Create the main application window
 * Implements Requirements 2.1: Native window with standard controls
 * Implements Requirements 8.3: Optimize window restoration
 */
function createWindow() {
  // Initialize window state manager if not already done
  if (!windowStateManager) {
    windowStateManager = new WindowStateManager();
  }

  // Get cached window state for fast restoration
  const bounds = windowStateManager.getBounds();

  // Create the browser window with proper configuration
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 800,
    minHeight: 600,
    show: false, // Don't show until ready
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    // Native window controls (minimize, maximize, close)
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'default' : 'default',
  });

  // Restore window state (maximized, fullscreen) from cache
  // Requirements 8.3: Target 500ms restoration time
  windowStateManager.restoreState(mainWindow);

  // Track window state changes for future restorations
  windowStateManager.trackWindow(mainWindow);

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready to prevent flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle window close event
  // Requirements 2.2: Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!global.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Show notification on first minimize (optional)
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
      
      return false;
    }
  });

  // Handle window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window minimize
  mainWindow.on('minimize', (event) => {
    // Optional: could minimize to tray here too
  });

  // Handle window restore
  mainWindow.on('restore', () => {
    mainWindow.show();
  });

  return mainWindow;
}

/**
 * Create system tray icon and menu
 * Implements Requirements 2.2, 2.3, 2.4, 2.5: System tray functionality
 */
function createTray() {
  // Create tray icon
  // In production, this should use a proper icon file
  const iconPath = path.join(__dirname, '../build/tray-icon.png');
  
  // For now, create a simple icon (in production, use actual icon files)
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
  } catch (error) {
    // Fallback: create empty icon if file doesn't exist
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon);
  
  // Set tooltip
  tray.setToolTip('FlashLearn');
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show FlashLearn',
      click: () => {
        showWindow();
      },
    },
    {
      label: 'Hide FlashLearn',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
          if (process.platform === 'darwin') {
            app.dock.hide();
          }
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        global.isQuitting = true;
        app.quit();
      },
    },
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Handle tray click (Requirements 2.3: Restore window on tray click)
  tray.on('click', () => {
    showWindow();
  });
  
  // Handle double-click on macOS
  tray.on('double-click', () => {
    showWindow();
  });
  
  return tray;
}

/**
 * Show and focus the main window
 * Implements Requirements 2.3: Restore window from tray
 * Implements Requirements 8.3: Target 500ms restoration time
 */
function showWindow() {
  const startTime = Date.now();

  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    
    if (process.platform === 'darwin') {
      app.dock.show();
    }

    const restorationTime = Date.now() - startTime;
    if (logger) {
      logger.info('window_restored', { duration_ms: restorationTime });
    }
  } else {
    createWindow();
  }
}

/**
 * Hide the main window
 */
function hideWindow() {
  if (mainWindow) {
    mainWindow.hide();
    if (process.platform === 'darwin') {
      app.dock.hide();
    }
  }
}

/**
 * Initialize the application
 */
async function initialize() {
  try {
    // Create and show splash screen immediately
    // Requirements 8.1: Display within 1 second of launch
    splashWindowManager = new SplashWindowManager();
    splashWindowManager.create();
    splashWindowManager.setVersion(app.getVersion());
    splashWindowManager.updateProgress(10, 'Initializing...');

    // Get user data path
    const userDataPath = app.getPath('userData');
    console.log('User data path:', userDataPath);
    
    // Initialize logger first
    splashWindowManager.updateProgress(20, 'Setting up logging...');
    logger = new Logger(userDataPath);
    await logger.initialize();
    await logger.info('Application starting', { version: app.getVersion() });
    
    // Make logger globally accessible
    global.logger = logger;
    
    // Initialize data directory manager
    splashWindowManager.updateProgress(30, 'Setting up data directories...');
    dataDirectoryManager = new DataDirectoryManager(userDataPath);
    await dataDirectoryManager.initialize();
    await logger.info('Data directories initialized', {
      databasePath: dataDirectoryManager.getDatabasePath(),
      uploadsPath: dataDirectoryManager.getUploadsPath(),
    });
    
    // Initialize settings manager
    splashWindowManager.updateProgress(40, 'Loading settings...');
    settingsManager = new SettingsManager();
    await logger.info('Settings manager initialized');
    
    // Initialize backend manager with data directory manager
    splashWindowManager.updateProgress(50, 'Preparing backend...');
    backendManager = new BackendManager(userDataPath, dataDirectoryManager);
    
    // Start backend
    splashWindowManager.updateProgress(60, 'Starting backend server...');
    await logger.info('Starting backend...');
    const port = await backendManager.start();
    await logger.info(`Backend started on port ${port}`);
    
    // Create window
    splashWindowManager.updateProgress(80, 'Creating main window...');
    createWindow();
    
    // Create system tray
    createTray();
    
    // Initialize auto-updater (before IPC handlers so it can be passed)
    // Requirements 5.1: Check for updates on startup
    autoUpdaterManager = new AutoUpdaterManager(settingsManager, logger);
    autoUpdaterManager.setMainWindow(mainWindow);
    await logger.info('Auto-updater initialized');
    
    // Set up IPC handlers
    setupIpcHandlers({
      mainWindow,
      backendManager,
      settingsManager,
      dataDirectoryManager,
      logger,
      autoUpdaterManager,
    });
    await logger.info('IPC handlers initialized');
    
    // Set up keyboard shortcuts
    // Requirements 10.1, 10.2, 10.3, 10.4, 10.5
    keyboardShortcutsManager = new KeyboardShortcutsManager();
    keyboardShortcutsManager.registerAll({
      onNewFlashcard: () => {
        // Send IPC message to renderer to open new flashcard dialog
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('shortcut:new-flashcard');
        }
      },
      onFileUpload: () => {
        // Send IPC message to renderer to open file upload dialog
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('shortcut:file-upload');
        }
      },
      onSettings: () => {
        // Send IPC message to renderer to open settings dialog
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('shortcut:settings');
        }
      },
      onFullscreen: () => {
        // Toggle fullscreen mode
        if (mainWindow && !mainWindow.isDestroyed()) {
          const isFullscreen = mainWindow.isFullScreen();
          mainWindow.setFullScreen(!isFullscreen);
        }
      },
      onQuit: () => {
        // Quit the application
        global.isQuitting = true;
        app.quit();
      },
    });
    await logger.info('Keyboard shortcuts initialized');
    
    // Check for updates after a short delay to let the app fully initialize
    setTimeout(async () => {
      try {
        await autoUpdaterManager.checkForUpdates();
      } catch (error) {
        await logger.error('Failed to check for updates', error);
      }
    }, 5000); // 5 second delay

    // Hide splash screen after everything is ready
    // Requirements 8.5: Hide when backend ready
    splashWindowManager.updateProgress(100, 'Ready!');
    setTimeout(() => {
      if (splashWindowManager) {
        splashWindowManager.close();
      }
    }, 500); // Small delay to show 100% completion
    
  } catch (error) {
    console.error('Failed to initialize application:', error);
    if (logger) {
      await logger.error('Application initialization failed', error);
    }
    // Close splash screen on error
    if (splashWindowManager) {
      splashWindowManager.close();
    }
    // TODO: Show error dialog to user
    app.quit();
  }
}

/**
 * Check for previous crash and handle recovery
 * Implements Requirements 6.5: Crash detection and recovery
 */
async function checkForCrash() {
  const userDataPath = app.getPath('userData');
  const crashFlagPath = path.join(userDataPath, '.crash-flag');
  
  try {
    // Check if crash flag exists
    const fs = require('fs').promises;
    await fs.access(crashFlagPath);
    
    // Crash flag exists, meaning previous session crashed
    console.log('Previous session crashed, initiating recovery');
    
    if (logger) {
      await logger.warn('Application recovered from crash');
    }
    
    // Remove crash flag
    await fs.unlink(crashFlagPath);
    
    return true;
  } catch (error) {
    // No crash flag, normal startup
    return false;
  }
}

/**
 * Set crash flag to detect crashes on next startup
 */
async function setCrashFlag() {
  const userDataPath = app.getPath('userData');
  const crashFlagPath = path.join(userDataPath, '.crash-flag');
  
  try {
    const fs = require('fs').promises;
    await fs.writeFile(crashFlagPath, new Date().toISOString(), 'utf8');
  } catch (error) {
    console.error('Failed to set crash flag:', error);
  }
}

/**
 * Clear crash flag on clean shutdown
 */
async function clearCrashFlag() {
  const userDataPath = app.getPath('userData');
  const crashFlagPath = path.join(userDataPath, '.crash-flag');
  
  try {
    const fs = require('fs').promises;
    await fs.unlink(crashFlagPath);
  } catch (error) {
    // Flag doesn't exist, ignore
  }
}

// App lifecycle handlers
// Requirements 1.2: Handle app ready event

app.whenReady().then(async () => {
  // Check for previous crash
  const hadCrash = await checkForCrash();
  
  // Set crash flag (will be cleared on clean shutdown)
  await setCrashFlag();
  
  initialize();

  // macOS specific: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showWindow();
    }
  });
});

// Requirements 1.2: Handle window-all-closed event
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    if (!global.isQuitting) {
      // Don't quit, just hide to tray
      return;
    }
    app.quit();
  }
});

// Requirements 1.2: Handle before-quit event and ensure graceful backend shutdown
app.on('before-quit', async (event) => {
  if (backendManager && backendManager.isRunning()) {
    event.preventDefault();
    global.isQuitting = true;
    
    try {
      console.log('Shutting down backend...');
      await backendManager.stop();
      console.log('Backend stopped successfully');
      
      // Clear crash flag on clean shutdown
      await clearCrashFlag();
      
      if (logger) {
        await logger.info('Application shutdown cleanly');
      }
    } catch (error) {
      console.error('Error stopping backend:', error);
      if (logger) {
        await logger.error('Error during shutdown', error);
      }
    } finally {
      app.quit();
    }
  } else {
    // Clear crash flag even if backend isn't running
    await clearCrashFlag();
  }
});

// Handle app quit
app.on('will-quit', () => {
  // Cleanup IPC handlers
  removeIpcHandlers();
  
  // Cleanup keyboard shortcuts
  if (keyboardShortcutsManager) {
    keyboardShortcutsManager.unregisterAll();
    keyboardShortcutsManager = null;
  }
  
  // Cleanup tray
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// Export for testing
module.exports = {
  createWindow,
  createTray,
  showWindow,
  hideWindow,
  getMainWindow: () => mainWindow,
  getTray: () => tray,
  getBackendManager: () => backendManager,
  getSettingsManager: () => settingsManager,
  getDataDirectoryManager: () => dataDirectoryManager,
  getLogger: () => logger,
  getKeyboardShortcutsManager: () => keyboardShortcutsManager,
  getAutoUpdaterManager: () => autoUpdaterManager,
  getSplashWindowManager: () => splashWindowManager,
  getWindowStateManager: () => windowStateManager,
};
