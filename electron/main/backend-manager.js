/**
 * Backend Process Manager
 * Manages the lifecycle of the bundled Python FastAPI backend
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { app } = require('electron');
const DataDirectoryManager = require('./data-directory-manager');

class BackendManager {
  constructor(userDataPath, dataDirectoryManager = null) {
    this.userDataPath = userDataPath;
    this.dataDirectoryManager = dataDirectoryManager;
    this.process = null;
    this.port = null;
    this.isStarting = false;
    this.startAttempts = 0;
    this.maxStartAttempts = 3;
    this.healthCheckInterval = null;
    this.healthCheckRetries = 0;
    this.maxHealthCheckRetries = 30; // 30 seconds with 1 second intervals
    this.crashCount = 0;
    this.maxCrashCount = 5;
    this.autoRestart = true;
    this.lastCrashTime = null;
    this.crashBackoffMs = 1000; // Start with 1 second backoff
  }

  /**
   * Start the backend process
   * @returns {Promise<number>} The port the backend is running on
   */
  async start() {
    if (this.isStarting) {
      throw new Error('Backend is already starting');
    }

    this.isStarting = true;
    this.startAttempts++;

    try {
      if (this.isRunning()) {
        await this._waitForHealthy();
        this.isStarting = false;
        this.startAttempts = 0;
        return this.port;
      }

      // Find an available port
      this.port = await this._findAvailablePort();
      
      // Get the backend executable path
      const backendPath = this._getBackendPath();
      const isDev = process.env.NODE_ENV === 'development';
      
      // Set up environment variables
      const env = this._getBackendEnvironment();
      
      // Spawn the backend process
      this.process = spawn(backendPath, isDev ? ['main.py'] : [], {
        env,
        cwd: isDev ? path.resolve(__dirname, '../../backend') : path.dirname(backendPath),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Set up process event handlers
      this._setupProcessHandlers();

      // Wait for backend to be healthy
      await this._waitForHealthy();

      this.isStarting = false;
      this.startAttempts = 0;
      
      return this.port;
    } catch (error) {
      this.isStarting = false;
      
      if (this.startAttempts < this.maxStartAttempts) {
        console.error(`Backend start attempt ${this.startAttempts} failed:`, error.message);
        // Retry with exponential backoff
        const delay = Math.pow(2, this.startAttempts - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.start();
      }
      
      throw new Error(`Failed to start backend after ${this.maxStartAttempts} attempts: ${error.message}`);
    }
  }

  /**
   * Stop the backend process
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (!this.process) {
      return;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
          this.process = null;
          this.port = null;
        }
        resolve();
      }, 5000); // 5 second timeout for graceful shutdown

      this.process.once('exit', () => {
        clearTimeout(timeout);
        this.process = null;
        this.port = null;
        resolve();
      });

      // Try graceful shutdown first
      try {
        this.process.kill('SIGTERM');
      } catch (error) {
        // Process might already be dead
        clearTimeout(timeout);
        this.process = null;
        this.port = null;
        resolve();
      }
    });
  }

  /**
   * Restart the backend process
   * @returns {Promise<number>}
   */
  async restart() {
    await this.stop();
    return this.start();
  }

  /**
   * Check if the backend is running
   * @returns {boolean}
   */
  isRunning() {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Get the current backend port
   * @returns {number|null}
   */
  getPort() {
    return this.port;
  }

  /**
   * Find an available port in the range 8000-8010
   * @returns {Promise<number>}
   * @private
   */
  async _findAvailablePort() {
    const startPort = 8000;
    const endPort = 8010;

    for (let port = startPort; port <= endPort; port++) {
      if (await this._isPortAvailable(port)) {
        return port;
      }
    }

    throw new Error(`No available ports found in range ${startPort}-${endPort}`);
  }

  /**
   * Check if a port is available
   * @param {number} port
   * @returns {Promise<boolean>}
   * @private
   */
  _isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = http.createServer();
      
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Get the path to the backend executable
   * @returns {string}
   * @private
   */
  _getBackendPath() {
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      const backendDir = path.resolve(__dirname, '../../backend');
      const pythonPath = process.platform === 'win32'
        ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
        : path.join(backendDir, '.venv', 'bin', 'python');
      return fs.existsSync(pythonPath) ? pythonPath : (process.platform === 'win32' ? 'python' : 'python3');
    }

    // In production, use the bundled executable
    const resourcesPath = process.resourcesPath || path.join(__dirname, '../../');
    const backendDir = path.join(resourcesPath, 'backend');
    
    let executableName;
    if (process.platform === 'win32') {
      executableName = 'backend.exe';
    } else {
      executableName = 'backend';
    }

    return path.join(backendDir, executableName);
  }

  /**
   * Get environment variables for the backend process
   * @returns {Object}
   * @private
   */
  _getBackendEnvironment() {
    const env = { ...process.env };
    
    // Set the port
    env.PORT = this.port.toString();
    
    // Use DataDirectoryManager paths if available, otherwise fallback to old behavior
    if (this.dataDirectoryManager && this.dataDirectoryManager.isInitialized()) {
      env.DATABASE_URL = `sqlite:///${this.dataDirectoryManager.getDatabasePath()}`;
      env.UPLOAD_DIR = this.dataDirectoryManager.getUploadsPath();
    } else {
      // Fallback to old behavior
      const dbPath = path.join(this.userDataPath, 'flashlearn.db');
      env.DATABASE_URL = `sqlite:///${dbPath}`;
      
      const uploadsPath = path.join(this.userDataPath, 'uploads');
      env.UPLOAD_DIR = uploadsPath;
    }
    
    // Set host to localhost only
    env.HOST = '127.0.0.1';
    
    // Allow the packaged file page's opaque origin in the backend.
    env.DESKTOP_MODE = 'true';
    
    return env;
  }

  /**
   * Set up process event handlers
   * @private
   */
  _setupProcessHandlers() {
    if (!this.process) return;

    // Log stdout
    this.process.stdout.on('data', (data) => {
      console.log(`[Backend] ${data.toString().trim()}`);
    });

    // Log stderr
    this.process.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data.toString().trim()}`);
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      const wasRunning = this.process !== null;
      console.log(`Backend process exited with code ${code} and signal ${signal}`);
      
      this.process = null;
      this.port = null;

      // Detect unexpected crashes (non-zero exit code and not during shutdown)
      if (wasRunning && code !== 0 && code !== null && this.autoRestart) {
        this._handleCrash(code, signal);
      }
    });

    // Handle process errors
    this.process.on('error', (error) => {
      console.error('Backend process error:', error);
      this._logCrash('Process error', error);
    });
  }

  /**
   * Handle backend crash and attempt restart
   * @param {number} code - Exit code
   * @param {string} signal - Exit signal
   * @private
   */
  async _handleCrash(code, signal) {
    this.crashCount++;
    this.lastCrashTime = Date.now();

    this._logCrash('Unexpected exit', { code, signal, crashCount: this.crashCount });

    if (this.crashCount >= this.maxCrashCount) {
      console.error(`Backend crashed ${this.crashCount} times. Giving up on auto-restart.`);
      this.autoRestart = false;
      return;
    }

    // Calculate backoff delay (exponential backoff)
    const backoffDelay = Math.min(this.crashBackoffMs * Math.pow(2, this.crashCount - 1), 30000);
    console.log(`Attempting to restart backend in ${backoffDelay}ms (attempt ${this.crashCount}/${this.maxCrashCount})`);

    // Wait before restarting
    await new Promise(resolve => setTimeout(resolve, backoffDelay));

    try {
      await this.start();
      console.log('Backend successfully restarted after crash');
      // Reset crash count on successful restart
      this.crashCount = 0;
      this.crashBackoffMs = 1000;
    } catch (error) {
      console.error('Failed to restart backend after crash:', error.message);
    }
  }

  /**
   * Log crash information
   * @param {string} reason - Crash reason
   * @param {Object} details - Crash details
   * @private
   */
  _logCrash(reason, details) {
    const crashLog = {
      timestamp: new Date().toISOString(),
      reason,
      details,
      crashCount: this.crashCount,
      port: this.port,
    };

    console.error('[Backend Crash]', JSON.stringify(crashLog, null, 2));

    // If logger is available, log the crash
    if (global.logger) {
      global.logger.crash(reason, details);
    }
  }

  /**
   * Enable or disable auto-restart on crash
   * @param {boolean} enabled
   */
  setAutoRestart(enabled) {
    this.autoRestart = enabled;
  }

  /**
   * Get crash statistics
   * @returns {Object}
   */
  getCrashStats() {
    return {
      crashCount: this.crashCount,
      lastCrashTime: this.lastCrashTime,
      autoRestartEnabled: this.autoRestart,
    };
  }

  /**
   * Reset crash counter
   */
  resetCrashCounter() {
    this.crashCount = 0;
    this.crashBackoffMs = 1000;
    this.autoRestart = true;
  }

  /**
   * Wait for the backend to become healthy
   * Requirements 8.2: Optimize for 3 second startup time
   * @returns {Promise<void>}
   * @private
   */
  async _waitForHealthy() {
    this.healthCheckRetries = 0;

    return new Promise((resolve, reject) => {
      const checkHealth = async () => {
        try {
          const isHealthy = await this._checkHealth();
          
          if (isHealthy) {
            resolve();
            return;
          }

          this.healthCheckRetries++;
          
          if (this.healthCheckRetries >= this.maxHealthCheckRetries) {
            reject(new Error('Backend health check timeout'));
            return;
          }

          // Retry with shorter interval for faster startup
          // First few retries are faster (500ms), then fall back to 1s
          const retryDelay = this.healthCheckRetries < 5 ? 500 : 1000;
          setTimeout(checkHealth, retryDelay);
        } catch (error) {
          this.healthCheckRetries++;
          
          if (this.healthCheckRetries >= this.maxHealthCheckRetries) {
            reject(new Error(`Backend health check failed: ${error.message}`));
            return;
          }

          // Retry with shorter interval for faster startup
          const retryDelay = this.healthCheckRetries < 5 ? 500 : 1000;
          setTimeout(checkHealth, retryDelay);
        }
      };

      // Start checking immediately (no initial delay) for faster startup
      // Requirements 8.2: Target 3 second startup time
      checkHealth();
    });
  }

  /**
   * Perform a health check on the backend
   * Requirements 8.2: Optimize for fast startup
   * @returns {Promise<boolean>}
   * @private
   */
  _checkHealth() {
    return new Promise((resolve) => {
      const options = {
        hostname: '127.0.0.1',
        port: this.port,
        path: '/health',
        method: 'GET',
        timeout: 1000, // Reduced from 2000ms to 1000ms for faster checks
      };

      const req = http.request(options, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }
}

module.exports = BackendManager;
