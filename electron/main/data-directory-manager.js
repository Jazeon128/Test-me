/**
 * Data Directory Manager
 * Manages application data directories and paths
 * Implements Requirements 3.1, 3.2, 3.3
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class DataDirectoryManager {
  constructor(userDataPath = null) {
    // Use provided path or get from Electron app
    this.userDataPath = userDataPath || (app ? app.getPath('userData') : null);
    
    if (!this.userDataPath) {
      throw new Error('User data path not available');
    }

    this.initialized = false;
    this.paths = {
      root: this.userDataPath,
      database: null,
      uploads: null,
      logs: null,
      backups: null
    };
  }

  /**
   * Initialize the data directory structure
   * Creates all necessary directories on first run
   * Implements Requirements 3.1: Create data directory on first run
   * @returns {Promise<Object>} Object containing all directory paths
   */
  async initialize() {
    if (this.initialized) {
      return this.paths;
    }

    try {
      // Ensure root directory exists
      await this._ensureDirectory(this.paths.root);

      // Create subdirectories
      const uploadsDir = path.join(this.paths.root, 'uploads');
      const logsDir = path.join(this.paths.root, 'logs');
      const backupsDir = path.join(this.paths.root, 'backups');

      await this._ensureDirectory(uploadsDir);
      await this._ensureDirectory(logsDir);
      await this._ensureDirectory(backupsDir);

      // Set up paths
      this.paths.database = path.join(this.paths.root, 'flashlearn.db');
      this.paths.uploads = uploadsDir;
      this.paths.logs = logsDir;
      this.paths.backups = backupsDir;

      this.initialized = true;

      return this.paths;
    } catch (error) {
      throw new Error(`Failed to initialize data directories: ${error.message}`);
    }
  }

  /**
   * Get the database file path
   * Implements Requirements 3.2: Database in application data directory
   * @returns {string} Path to the database file
   */
  getDatabasePath() {
    if (!this.initialized) {
      throw new Error('Data directory not initialized. Call initialize() first.');
    }
    return this.paths.database;
  }

  /**
   * Get the uploads directory path
   * Implements Requirements 3.3: Uploads in application data directory
   * @returns {string} Path to the uploads directory
   */
  getUploadsPath() {
    if (!this.initialized) {
      throw new Error('Data directory not initialized. Call initialize() first.');
    }
    return this.paths.uploads;
  }

  /**
   * Get the logs directory path
   * @returns {string} Path to the logs directory
   */
  getLogsPath() {
    if (!this.initialized) {
      throw new Error('Data directory not initialized. Call initialize() first.');
    }
    return this.paths.logs;
  }

  /**
   * Get the backups directory path
   * @returns {string} Path to the backups directory
   */
  getBackupsPath() {
    if (!this.initialized) {
      throw new Error('Data directory not initialized. Call initialize() first.');
    }
    return this.paths.backups;
  }

  /**
   * Get the root data directory path
   * @returns {string} Path to the root data directory
   */
  getRootPath() {
    return this.paths.root;
  }

  /**
   * Get all paths
   * @returns {Object} Object containing all directory paths
   */
  getAllPaths() {
    if (!this.initialized) {
      throw new Error('Data directory not initialized. Call initialize() first.');
    }
    return { ...this.paths };
  }

  /**
   * Check if data directory is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Check if the data directory exists
   * @returns {boolean} True if directory exists
   */
  exists() {
    return fs.existsSync(this.paths.root);
  }

  /**
   * Check if the database file exists
   * @returns {boolean} True if database file exists
   */
  databaseExists() {
    if (!this.initialized) {
      return false;
    }
    return fs.existsSync(this.paths.database);
  }

  /**
   * Get the OS-specific application data location
   * @static
   * @returns {string} OS-specific app data path
   */
  static getOSDataPath() {
    const platform = process.platform;
    const home = process.env.HOME || process.env.USERPROFILE;

    switch (platform) {
      case 'win32':
        // Windows: %APPDATA%/FlashLearn
        return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'FlashLearn');
      
      case 'darwin':
        // macOS: ~/Library/Application Support/FlashLearn
        return path.join(home, 'Library', 'Application Support', 'FlashLearn');
      
      case 'linux':
        // Linux: ~/.config/FlashLearn
        return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'FlashLearn');
      
      default:
        // Fallback
        return path.join(home, '.flashlearn');
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   * @param {string} dirPath - Directory path
   * @returns {Promise<void>}
   * @private
   */
  async _ensureDirectory(dirPath) {
    try {
      await fs.promises.access(dirPath);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Clean up old files (for testing or maintenance)
   * @param {number} daysOld - Delete files older than this many days
   * @returns {Promise<number>} Number of files deleted
   */
  async cleanupOldFiles(daysOld = 30) {
    if (!this.initialized) {
      throw new Error('Data directory not initialized. Call initialize() first.');
    }

    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    // Clean up old backups
    const backupFiles = await fs.promises.readdir(this.paths.backups);
    for (const file of backupFiles) {
      const filePath = path.join(this.paths.backups, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.mtime.getTime() < cutoffTime) {
        await fs.promises.unlink(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

module.exports = DataDirectoryManager;
