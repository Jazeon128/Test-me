/**
 * Logger Module
 * Implements error logging with stack traces and log rotation
 * Implements Requirements 6.4, 9.5: Error logging with details
 */

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor(userDataPath, options = {}) {
    this.userDataPath = userDataPath;
    this.logDir = path.join(userDataPath, 'logs');
    this.logFile = path.join(this.logDir, 'app.log');
    this.errorLogFile = path.join(this.logDir, 'error.log');
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10 MB
    this.maxLogFiles = options.maxLogFiles || 5;
    this.initialized = false;
    
    // Log levels: DEBUG < INFO < WARN < ERROR
    this.logLevels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    };
    
    // Set minimum log level (default: INFO)
    this.minLogLevel = this.logLevels[options.minLogLevel || 'INFO'];
  }

  /**
   * Initialize the logger
   * Creates log directory if it doesn't exist
   */
  async initialize() {
    try {
      // Create logs directory if it doesn't exist
      await fs.mkdir(this.logDir, { recursive: true });
      this.initialized = true;
      
      // Log initialization
      await this.info('Logger initialized');
      
      // Check if log rotation is needed
      await this.checkLogRotation();
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  /**
   * Check if log rotation is needed and rotate if necessary
   */
  async checkLogRotation() {
    try {
      const stats = await fs.stat(this.logFile);
      
      if (stats.size >= this.maxLogSize) {
        await this.rotateLog(this.logFile);
      }
    } catch (error) {
      // Log file doesn't exist yet, no rotation needed
      if (error.code !== 'ENOENT') {
        console.error('Error checking log rotation:', error);
      }
    }

    try {
      const errorStats = await fs.stat(this.errorLogFile);
      
      if (errorStats.size >= this.maxLogSize) {
        await this.rotateLog(this.errorLogFile);
      }
    } catch (error) {
      // Error log file doesn't exist yet, no rotation needed
      if (error.code !== 'ENOENT') {
        console.error('Error checking error log rotation:', error);
      }
    }
  }

  /**
   * Rotate a log file
   * @param {string} logFilePath - Path to the log file to rotate
   */
  async rotateLog(logFilePath) {
    try {
      const ext = path.extname(logFilePath);
      const base = path.basename(logFilePath, ext);
      const dir = path.dirname(logFilePath);

      // Rotate existing log files
      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldFile = path.join(dir, `${base}.${i}${ext}`);
        const newFile = path.join(dir, `${base}.${i + 1}${ext}`);

        try {
          await fs.access(oldFile);
          if (i === this.maxLogFiles - 1) {
            // Delete the oldest log file
            await fs.unlink(oldFile);
          } else {
            // Rename to next number
            await fs.rename(oldFile, newFile);
          }
        } catch (error) {
          // File doesn't exist, skip
        }
      }

      // Rename current log file to .1
      const rotatedFile = path.join(dir, `${base}.1${ext}`);
      await fs.rename(logFilePath, rotatedFile);

      console.log(`Log file rotated: ${logFilePath} -> ${rotatedFile}`);
    } catch (error) {
      console.error('Error rotating log file:', error);
    }
  }

  /**
   * Format a log entry
   * @param {string} level - Log level (INFO, WARN, ERROR)
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @returns {string} Formatted log entry
   */
  formatLogEntry(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      ...context,
    };

    return JSON.stringify(entry) + '\n';
  }

  /**
   * Check if a log level should be logged
   * @param {string} level - Log level to check
   * @returns {boolean} True if the level should be logged
   */
  shouldLog(level) {
    return this.logLevels[level] >= this.minLogLevel;
  }

  /**
   * Write a log entry to a file
   * @param {string} filePath - Path to the log file
   * @param {string} entry - Formatted log entry
   */
  async writeLog(filePath, entry) {
    if (!this.initialized) {
      console.warn('Logger not initialized, skipping log write');
      return;
    }

    try {
      await fs.appendFile(filePath, entry, 'utf8');
      
      // Check if rotation is needed after writing
      const stats = await fs.stat(filePath);
      if (stats.size >= this.maxLogSize) {
        await this.rotateLog(filePath);
      }
    } catch (error) {
      console.error('Error writing log:', error);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  async debug(message, context = {}) {
    if (!this.shouldLog('DEBUG')) return;
    
    const entry = this.formatLogEntry('DEBUG', message, context);
    console.log(`[DEBUG] ${message}`, context);
    await this.writeLog(this.logFile, entry);
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  async info(message, context = {}) {
    if (!this.shouldLog('INFO')) return;
    
    const entry = this.formatLogEntry('INFO', message, context);
    console.log(`[INFO] ${message}`, context);
    await this.writeLog(this.logFile, entry);
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  async warn(message, context = {}) {
    if (!this.shouldLog('WARN')) return;
    
    const entry = this.formatLogEntry('WARN', message, context);
    console.warn(`[WARN] ${message}`, context);
    await this.writeLog(this.logFile, entry);
  }

  /**
   * Log an error message with stack trace
   * Implements Requirements 6.4, 9.5: Error detail logging
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   */
  async error(message, error = null, context = {}) {
    if (!this.shouldLog('ERROR')) return;
    
    const errorContext = {
      ...context,
    };

    // Add error details if provided
    if (error) {
      errorContext.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
      };
    }

    const entry = this.formatLogEntry('ERROR', message, errorContext);
    console.error(`[ERROR] ${message}`, errorContext);
    
    // Write to both main log and error log
    await this.writeLog(this.logFile, entry);
    await this.writeLog(this.errorLogFile, entry);
  }

  /**
   * Log a crash with full details
   * @param {string} reason - Crash reason
   * @param {Object} details - Crash details
   */
  async crash(reason, details = {}) {
    const crashContext = {
      ...details,
      appVersion: app ? app.getVersion() : 'unknown',
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron || 'unknown',
    };

    await this.error(`Application crash: ${reason}`, null, crashContext);
  }

  /**
   * Get the path to the main log file
   * @returns {string} Log file path
   */
  getLogPath() {
    return this.logFile;
  }

  /**
   * Get the path to the error log file
   * @returns {string} Error log file path
   */
  getErrorLogPath() {
    return this.errorLogFile;
  }

  /**
   * Get the log directory path
   * @returns {string} Log directory path
   */
  getLogDir() {
    return this.logDir;
  }

  /**
   * Read recent log entries
   * @param {number} lines - Number of lines to read (default: 100)
   * @returns {Promise<Array>} Array of log entries
   */
  async getRecentLogs(lines = 100) {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      const recentLines = allLines.slice(-lines);
      
      return recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line, timestamp: null };
        }
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Read recent error log entries
   * @param {number} lines - Number of lines to read (default: 100)
   * @returns {Promise<Array>} Array of error log entries
   */
  async getRecentErrors(lines = 100) {
    try {
      const content = await fs.readFile(this.errorLogFile, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      const recentLines = allLines.slice(-lines);
      
      return recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line, timestamp: null };
        }
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Set the minimum log level
   * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
   */
  setLogLevel(level) {
    if (this.logLevels[level] !== undefined) {
      this.minLogLevel = this.logLevels[level];
      console.log(`Log level set to: ${level}`);
    } else {
      console.warn(`Invalid log level: ${level}`);
    }
  }

  /**
   * Get the current log level
   * @returns {string} Current log level
   */
  getLogLevel() {
    const levels = Object.keys(this.logLevels);
    return levels.find(level => this.logLevels[level] === this.minLogLevel) || 'INFO';
  }

  /**
   * Clear all logs
   */
  async clearLogs() {
    try {
      await fs.unlink(this.logFile);
      await fs.unlink(this.errorLogFile);
      await this.info('Logs cleared');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error clearing logs:', error);
      }
    }
  }
}

module.exports = Logger;
