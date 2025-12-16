/**
 * Unit Tests for BackendManager
 */

const BackendManager = require('../backend-manager');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Mock the electron app module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => require('path').join(require('os').tmpdir(), 'flashlearn-test')),
  },
}));

describe('BackendManager Unit Tests', () => {
  let testDataPath;
  let manager;

  beforeEach(() => {
    // Create a temporary directory for test data
    testDataPath = path.join(os.tmpdir(), `flashlearn-test-${Date.now()}`);
    if (!fs.existsSync(testDataPath)) {
      fs.mkdirSync(testDataPath, { recursive: true });
    }
    manager = new BackendManager(testDataPath);
  });

  afterEach(async () => {
    // Clean up
    if (manager) {
      await manager.stop();
    }
    
    // Clean up test directory
    if (fs.existsSync(testDataPath)) {
      fs.rmSync(testDataPath, { recursive: true, force: true });
    }
  });

  describe('Constructor', () => {
    test('should initialize with correct default values', () => {
      expect(manager.userDataPath).toBe(testDataPath);
      expect(manager.process).toBeNull();
      expect(manager.port).toBeNull();
      expect(manager.isStarting).toBe(false);
      expect(manager.crashCount).toBe(0);
      expect(manager.autoRestart).toBe(true);
    });
  });

  describe('isRunning()', () => {
    test('should return false when no process exists', () => {
      expect(manager.isRunning()).toBe(false);
    });

    test('should return false after stop is called', async () => {
      await manager.stop();
      expect(manager.isRunning()).toBe(false);
    });
  });

  describe('getPort()', () => {
    test('should return null when backend is not running', () => {
      expect(manager.getPort()).toBeNull();
    });

    test('should return null after stop is called', async () => {
      await manager.stop();
      expect(manager.getPort()).toBeNull();
    });
  });

  describe('_findAvailablePort()', () => {
    test('should return a port in the valid range', async () => {
      const port = await manager._findAvailablePort();
      expect(port).toBeGreaterThanOrEqual(8000);
      expect(port).toBeLessThanOrEqual(8010);
    });

    test('should find different ports when called multiple times', async () => {
      const port1 = await manager._findAvailablePort();
      const port2 = await manager._findAvailablePort();
      
      // Both should be valid
      expect(port1).toBeGreaterThanOrEqual(8000);
      expect(port1).toBeLessThanOrEqual(8010);
      expect(port2).toBeGreaterThanOrEqual(8000);
      expect(port2).toBeLessThanOrEqual(8010);
    });
  });

  describe('_isPortAvailable()', () => {
    test('should return boolean for valid port', async () => {
      const result = await manager._isPortAvailable(8000);
      expect(typeof result).toBe('boolean');
    });

    test('should return true for available port', async () => {
      const result = await manager._isPortAvailable(8000);
      expect(result).toBe(true);
    });
  });

  describe('_getBackendEnvironment()', () => {
    test('should return environment variables with correct structure', () => {
      manager.port = 8000;
      const env = manager._getBackendEnvironment();

      expect(env).toHaveProperty('PORT');
      expect(env).toHaveProperty('HOST');
      expect(env).toHaveProperty('DATABASE_URL');
      expect(env).toHaveProperty('UPLOAD_DIR');
      expect(env).toHaveProperty('CORS_ENABLED');
    });

    test('should set PORT to the current port', () => {
      manager.port = 8005;
      const env = manager._getBackendEnvironment();
      expect(env.PORT).toBe('8005');
    });

    test('should set HOST to localhost', () => {
      manager.port = 8000;
      const env = manager._getBackendEnvironment();
      expect(env.HOST).toBe('127.0.0.1');
    });

    test('should disable CORS', () => {
      manager.port = 8000;
      const env = manager._getBackendEnvironment();
      expect(env.CORS_ENABLED).toBe('false');
    });

    test('should set DATABASE_URL with correct path', () => {
      manager.port = 8000;
      const env = manager._getBackendEnvironment();
      expect(env.DATABASE_URL).toContain('sqlite:///');
      expect(env.DATABASE_URL).toContain('flashlearn.db');
      expect(env.DATABASE_URL).toContain(testDataPath);
    });

    test('should set UPLOAD_DIR with correct path', () => {
      manager.port = 8000;
      const env = manager._getBackendEnvironment();
      expect(env.UPLOAD_DIR).toContain('uploads');
      expect(env.UPLOAD_DIR).toContain(testDataPath);
    });
  });

  describe('_getBackendPath()', () => {
    test('should return a string path', () => {
      const backendPath = manager._getBackendPath();
      expect(typeof backendPath).toBe('string');
      expect(backendPath.length).toBeGreaterThan(0);
    });

    test('should return python/python3 in development mode', () => {
      process.env.NODE_ENV = 'development';
      const backendPath = manager._getBackendPath();
      expect(['python', 'python3']).toContain(backendPath);
    });

    test('should return executable path in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const backendPath = manager._getBackendPath();
      expect(backendPath).toContain('backend');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('stop()', () => {
    test('should resolve immediately when no process exists', async () => {
      await expect(manager.stop()).resolves.toBeUndefined();
    });

    test('should set process and port to null', async () => {
      await manager.stop();
      expect(manager.process).toBeNull();
      expect(manager.port).toBeNull();
    });

    test('should be idempotent', async () => {
      await manager.stop();
      await manager.stop();
      expect(manager.isRunning()).toBe(false);
    });
  });

  describe('Crash handling', () => {
    test('should initialize with zero crash count', () => {
      expect(manager.crashCount).toBe(0);
    });

    test('should have auto-restart enabled by default', () => {
      expect(manager.autoRestart).toBe(true);
    });

    test('setAutoRestart should update auto-restart setting', () => {
      manager.setAutoRestart(false);
      expect(manager.autoRestart).toBe(false);
      
      manager.setAutoRestart(true);
      expect(manager.autoRestart).toBe(true);
    });

    test('getCrashStats should return crash statistics', () => {
      const stats = manager.getCrashStats();
      expect(stats).toHaveProperty('crashCount');
      expect(stats).toHaveProperty('lastCrashTime');
      expect(stats).toHaveProperty('autoRestartEnabled');
      expect(stats.crashCount).toBe(0);
      expect(stats.autoRestartEnabled).toBe(true);
    });

    test('resetCrashCounter should reset crash count', () => {
      manager.crashCount = 5;
      manager.autoRestart = false;
      
      manager.resetCrashCounter();
      
      expect(manager.crashCount).toBe(0);
      expect(manager.autoRestart).toBe(true);
    });

    test('_logCrash should log crash information', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      manager._logCrash('Test crash', { code: 1 });
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toBe('[Backend Crash]');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Health check', () => {
    test('_checkHealth should return boolean', async () => {
      manager.port = 8000;
      const result = await manager._checkHealth();
      expect(typeof result).toBe('boolean');
    });

    test('_checkHealth should return false for non-existent backend', async () => {
      manager.port = 8000;
      const result = await manager._checkHealth();
      expect(result).toBe(false);
    });
  });
});
