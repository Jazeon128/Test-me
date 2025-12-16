/**
 * Unit Tests for Error Handling
 * Tests error dialog display, error logging, and crash recovery
 * Validates: Requirements 6.1, 6.3, 6.4, 6.5
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const Logger = require('../logger');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Error Handling Unit Tests', () => {
  let logger;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `error-handling-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    logger = new Logger(testDir);
    await logger.initialize();
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up test directory:', error);
    }
  });

  describe('Error Dialog Display', () => {
    it('should log backend errors', async () => {
      await logger.error('Backend connection failed', new Error('Connection refused'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = await logger.getRecentErrors(10);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1].message).toBe('Backend connection failed');
    });

    it('should log API errors', async () => {
      const apiError = new Error('API request failed');
      apiError.code = 'ECONNREFUSED';
      
      await logger.error('API error occurred', apiError);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = await logger.getRecentErrors(10);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1].error.code).toBe('ECONNREFUSED');
    });
  });

  describe('Error Logging', () => {
    it('should write errors to log file', async () => {
      await logger.error('Test error', new Error('Test'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logPath = logger.getLogPath();
      const content = await fs.readFile(logPath, 'utf8');
      expect(content).toContain('Test error');
    });

    it('should include stack traces in error logs', async () => {
      const error = new Error('Error with stack');
      await logger.error('Stack trace test', error);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = await logger.getRecentErrors(10);
      expect(logs[logs.length - 1].error.stack).toBeDefined();
    });

    it('should rotate logs when size limit is reached', async () => {
      logger.maxLogSize = 512; // Small size for testing
      
      for (let i = 0; i < 50; i++) {
        await logger.error(`Error ${i}`, new Error(`Test ${i}`));
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const logDir = logger.getLogDir();
      const files = await fs.readdir(logDir);
      const rotatedFiles = files.filter(f => f.includes('.1.log'));
      
      expect(rotatedFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Crash Recovery', () => {
    it('should log crash information', async () => {
      await logger.crash('Application crashed', {
        reason: 'Unhandled exception',
        component: 'main-process',
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = await logger.getRecentErrors(10);
      const crashLog = logs[logs.length - 1];
      
      expect(crashLog.message).toContain('crash');
      expect(crashLog.reason).toBe('Unhandled exception');
      expect(crashLog.component).toBe('main-process');
    });

    it('should include system information in crash logs', async () => {
      await logger.crash('Test crash', {});
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = await logger.getRecentErrors(10);
      const crashLog = logs[logs.length - 1];
      
      expect(crashLog.platform).toBeDefined();
      expect(crashLog.arch).toBeDefined();
      expect(crashLog.nodeVersion).toBeDefined();
    });
  });

  describe('Logger Initialization', () => {
    it('should create log directory on initialization', async () => {
      const logDir = logger.getLogDir();
      const stats = await fs.stat(logDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create log files when logging', async () => {
      await logger.info('Test message');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logPath = logger.getLogPath();
      const stats = await fs.stat(logPath);
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('Log Retrieval', () => {
    it('should retrieve recent logs', async () => {
      await logger.info('Info 1');
      await logger.warn('Warn 1');
      await logger.error('Error 1', new Error('Test'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = await logger.getRecentLogs(10);
      expect(logs.length).toBeGreaterThanOrEqual(3);
    });

    it('should retrieve recent errors only', async () => {
      await logger.info('Info message');
      await logger.error('Error 1', new Error('Test 1'));
      await logger.error('Error 2', new Error('Test 2'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const errors = await logger.getRecentErrors(10);
      expect(errors.every(log => log.level === 'ERROR')).toBe(true);
    });
  });
});
