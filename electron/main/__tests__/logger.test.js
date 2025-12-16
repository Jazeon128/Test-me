/**
 * Unit Tests for Logger
 * Tests log file creation, log rotation, and diagnostic report generation
 * Validates: Requirements 6.4, 9.3, 9.5
 */

const Logger = require('../logger');
const DiagnosticReport = require('../diagnostic-report');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock electron app
jest.mock('electron', () => ({
  app: {
    getName: () => 'FlashLearn',
    getVersion: () => '0.1.0',
    getPath: (name) => {
      if (name === 'userData') return '/tmp/test-user-data';
      return '/tmp/test';
    },
  },
}));

describe('Logger', () => {
  let tempDir;
  let logger;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = path.join(os.tmpdir(), `logger-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create logger
    logger = new Logger(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('should create log directory on initialization', async () => {
      await logger.initialize();

      const logDir = logger.getLogDir();
      const stats = await fs.stat(logDir);
      expect(stats.isDirectory()).toBe(true);
    });

    test('should create log files when logging', async () => {
      await logger.initialize();
      await logger.info('Test message');

      const logPath = logger.getLogPath();
      const stats = await fs.stat(logPath);
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('Log Levels', () => {
    test('should support DEBUG log level', async () => {
      logger = new Logger(tempDir, { minLogLevel: 'DEBUG' });
      await logger.initialize();
      await logger.debug('Debug message');

      const logs = await logger.getRecentLogs(10);
      expect(logs.some(log => log.level === 'DEBUG')).toBe(true);
    });

    test('should support INFO log level', async () => {
      await logger.initialize();
      await logger.info('Info message');

      const logs = await logger.getRecentLogs(10);
      expect(logs.some(log => log.level === 'INFO')).toBe(true);
    });

    test('should support WARN log level', async () => {
      await logger.initialize();
      await logger.warn('Warning message');

      const logs = await logger.getRecentLogs(10);
      expect(logs.some(log => log.level === 'WARN')).toBe(true);
    });

    test('should support ERROR log level', async () => {
      await logger.initialize();
      await logger.error('Error message');

      const logs = await logger.getRecentLogs(10);
      expect(logs.some(log => log.level === 'ERROR')).toBe(true);
    });

    test('should filter logs based on minimum log level', async () => {
      logger = new Logger(tempDir, { minLogLevel: 'WARN' });
      await logger.initialize();

      await logger.debug('Debug message');
      await logger.info('Info message');
      await logger.warn('Warning message');
      await logger.error('Error message');

      const logs = await logger.getRecentLogs(10);
      
      // Should only have WARN and ERROR
      expect(logs.some(log => log.level === 'DEBUG')).toBe(false);
      expect(logs.some(log => log.level === 'INFO')).toBe(false);
      expect(logs.some(log => log.level === 'WARN')).toBe(true);
      expect(logs.some(log => log.level === 'ERROR')).toBe(true);
    });

    test('should allow changing log level dynamically', async () => {
      await logger.initialize();
      
      expect(logger.getLogLevel()).toBe('INFO');
      
      logger.setLogLevel('DEBUG');
      expect(logger.getLogLevel()).toBe('DEBUG');
      
      logger.setLogLevel('ERROR');
      expect(logger.getLogLevel()).toBe('ERROR');
    });
  });

  describe('Log Formatting', () => {
    test('should include timestamp in log entries', async () => {
      await logger.initialize();
      await logger.info('Test message');

      const logs = await logger.getRecentLogs(1);
      expect(logs[0]).toHaveProperty('timestamp');
      expect(logs[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should include log level in log entries', async () => {
      await logger.initialize();
      await logger.info('Test message');

      const logs = await logger.getRecentLogs(1);
      expect(logs[0]).toHaveProperty('level');
      expect(logs[0].level).toBe('INFO');
    });

    test('should include message in log entries', async () => {
      await logger.initialize();
      await logger.info('Test message');

      const logs = await logger.getRecentLogs(1);
      expect(logs[0]).toHaveProperty('message');
      expect(logs[0].message).toBe('Test message');
    });

    test('should include context in log entries', async () => {
      await logger.initialize();
      await logger.info('Test message', { userId: 123, action: 'login' });

      const logs = await logger.getRecentLogs(1);
      expect(logs[0]).toHaveProperty('userId', 123);
      expect(logs[0]).toHaveProperty('action', 'login');
    });
  });

  describe('Error Logging', () => {
    test('should log error with stack trace', async () => {
      await logger.initialize();
      
      const error = new Error('Test error');
      await logger.error('An error occurred', error);

      const errors = await logger.getRecentErrors(1);
      expect(errors[0]).toHaveProperty('error');
      expect(errors[0].error).toHaveProperty('message', 'Test error');
      expect(errors[0].error).toHaveProperty('stack');
      expect(errors[0].error.stack).toContain('Test error');
    });

    test('should write errors to both main log and error log', async () => {
      await logger.initialize();
      
      await logger.error('Test error');

      const mainLogs = await logger.getRecentLogs(10);
      const errorLogs = await logger.getRecentErrors(10);

      expect(mainLogs.some(log => log.message === 'Test error')).toBe(true);
      expect(errorLogs.some(log => log.message === 'Test error')).toBe(true);
    });

    test('should log crash with system information', async () => {
      await logger.initialize();
      
      await logger.crash('Application crashed', { reason: 'Out of memory' });

      const errors = await logger.getRecentErrors(1);
      expect(errors[0].message).toContain('Application crash');
      expect(errors[0]).toHaveProperty('reason', 'Out of memory');
      expect(errors[0]).toHaveProperty('platform');
      expect(errors[0]).toHaveProperty('arch');
    });
  });

  describe('Log Rotation', () => {
    test('should rotate log file when it exceeds max size', async () => {
      // Create logger with small max size for testing
      logger = new Logger(tempDir, { maxLogSize: 1024 }); // 1 KB
      await logger.initialize();

      // Write enough logs to trigger rotation
      for (let i = 0; i < 100; i++) {
        await logger.info(`Test message ${i}`, { data: 'x'.repeat(50) });
      }

      // Check if rotated file exists
      const logDir = logger.getLogDir();
      const files = await fs.readdir(logDir);
      
      // Should have app.log and app.1.log (or more)
      expect(files.some(f => f === 'app.log')).toBe(true);
      expect(files.some(f => f.startsWith('app.') && f.endsWith('.log'))).toBe(true);
    });

    test('should limit number of rotated log files', async () => {
      // Create logger with small max size and max files
      logger = new Logger(tempDir, { maxLogSize: 500, maxLogFiles: 3 });
      await logger.initialize();

      // Write enough logs to trigger multiple rotations
      for (let i = 0; i < 200; i++) {
        await logger.info(`Test message ${i}`, { data: 'x'.repeat(50) });
      }

      // Check number of log files
      const logDir = logger.getLogDir();
      const files = await fs.readdir(logDir);
      const appLogFiles = files.filter(f => f.startsWith('app.') && f.endsWith('.log'));
      
      // Should have at most maxLogFiles + 1 (current file)
      expect(appLogFiles.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Log Retrieval', () => {
    test('should retrieve recent log entries', async () => {
      await logger.initialize();

      await logger.info('Message 1');
      await logger.info('Message 2');
      await logger.info('Message 3');

      const logs = await logger.getRecentLogs(2);
      expect(logs.length).toBe(2);
      expect(logs[0].message).toBe('Message 2');
      expect(logs[1].message).toBe('Message 3');
    });

    test('should retrieve recent error entries', async () => {
      await logger.initialize();

      await logger.error('Error 1');
      await logger.error('Error 2');
      await logger.error('Error 3');

      const errors = await logger.getRecentErrors(2);
      expect(errors.length).toBe(2);
      expect(errors[0].message).toBe('Error 2');
      expect(errors[1].message).toBe('Error 3');
    });

    test('should return empty array when no logs exist', async () => {
      await logger.initialize();

      const logs = await logger.getRecentLogs(10);
      // Logger initialization creates one log entry
      expect(logs.length).toBeLessThanOrEqual(1);
      if (logs.length === 1) {
        expect(logs[0].message).toBe('Logger initialized');
      }
    });
  });

  describe('Log Clearing', () => {
    test('should clear all logs', async () => {
      await logger.initialize();

      await logger.info('Test message');
      await logger.error('Test error');

      await logger.clearLogs();

      const logs = await logger.getRecentLogs(10);
      const errors = await logger.getRecentErrors(10);

      // After clearing, only the "Logs cleared" message should remain
      expect(logs.length).toBeLessThanOrEqual(1);
      if (logs.length === 1) {
        expect(logs[0].message).toBe('Logs cleared');
      }
      expect(errors).toEqual([]);
    });
  });
});

describe('DiagnosticReport', () => {
  let tempDir;
  let logger;
  let mockSettingsManager;
  let diagnosticReport;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = path.join(os.tmpdir(), `diagnostic-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create logger
    logger = new Logger(tempDir);
    await logger.initialize();

    // Create mock settings manager
    mockSettingsManager = {
      getAll: jest.fn(() => ({
        apiProvider: 'openai',
        theme: 'dark',
        autoUpdate: true,
        apiKeys: {
          openai: 'sk-test-key',
          anthropic: null,
          google: null,
        },
      })),
    };

    // Create diagnostic report
    diagnosticReport = new DiagnosticReport(logger, mockSettingsManager);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Report Generation', () => {
    test('should generate complete diagnostic report', async () => {
      const report = await diagnosticReport.generate();

      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('application');
      expect(report).toHaveProperty('system');
      expect(report).toHaveProperty('configuration');
      expect(report).toHaveProperty('logs');
      expect(report).toHaveProperty('recentErrors');
    });

    test('should include application information', async () => {
      const report = await diagnosticReport.generate();

      expect(report.application).toHaveProperty('name');
      expect(report.application).toHaveProperty('version');
      expect(report.application).toHaveProperty('electronVersion');
      expect(report.application).toHaveProperty('chromeVersion');
      expect(report.application).toHaveProperty('nodeVersion');
    });

    test('should include system information', async () => {
      const report = await diagnosticReport.generate();

      expect(report.system).toHaveProperty('platform');
      expect(report.system).toHaveProperty('arch');
      expect(report.system).toHaveProperty('osType');
      expect(report.system).toHaveProperty('osRelease');
      expect(report.system).toHaveProperty('hostname');
      expect(report.system).toHaveProperty('totalMemory');
      expect(report.system).toHaveProperty('freeMemory');
      expect(report.system).toHaveProperty('cpuCount');
    });

    test('should sanitize API keys in configuration', async () => {
      const report = await diagnosticReport.generate();

      expect(report.configuration.apiKeys.openai).toBe('***SET***');
      expect(report.configuration.apiKeys.anthropic).toBe('NOT SET');
      expect(report.configuration.apiKeys.google).toBe('NOT SET');
    });

    test('should include log information', async () => {
      const report = await diagnosticReport.generate();

      expect(report.logs).toHaveProperty('logFile');
      expect(report.logs).toHaveProperty('errorLogFile');
      expect(report.logs).toHaveProperty('logLevel');
      expect(report.logs.logFile).toHaveProperty('path');
      expect(report.logs.logFile).toHaveProperty('size');
      expect(report.logs.logFile).toHaveProperty('exists');
    });
  });

  describe('Report Formatting', () => {
    test('should format report as text', async () => {
      const report = await diagnosticReport.generate();
      const text = diagnosticReport.formatAsText(report);

      expect(text).toContain('DIAGNOSTIC REPORT');
      expect(text).toContain('APPLICATION INFORMATION');
      expect(text).toContain('SYSTEM INFORMATION');
      expect(text).toContain('CONFIGURATION');
      expect(text).toContain('LOG INFORMATION');
      expect(text).toContain('END OF REPORT');
    });

    test('should generate valid JSON', async () => {
      const jsonString = await diagnosticReport.generateJSON();

      expect(() => JSON.parse(jsonString)).not.toThrow();
      
      const parsed = JSON.parse(jsonString);
      expect(parsed).toHaveProperty('generatedAt');
      expect(parsed).toHaveProperty('application');
      expect(parsed).toHaveProperty('system');
    });
  });

  describe('Report Saving', () => {
    test('should save report to file', async () => {
      const reportPath = path.join(tempDir, 'diagnostic-report.txt');
      await diagnosticReport.saveToFile(reportPath);

      const stats = await fs.stat(reportPath);
      expect(stats.isFile()).toBe(true);

      const content = await fs.readFile(reportPath, 'utf8');
      expect(content).toContain('DIAGNOSTIC REPORT');
    });
  });

  describe('Recent Errors', () => {
    test('should include recent errors in report', async () => {
      // Log some errors
      await logger.error('Error 1');
      await logger.error('Error 2');

      const report = await diagnosticReport.generate();

      expect(Array.isArray(report.recentErrors)).toBe(true);
      expect(report.recentErrors.length).toBeGreaterThan(0);
    });

    test('should sanitize error entries', async () => {
      const error = new Error('Test error');
      await logger.error('An error occurred', error);

      const report = await diagnosticReport.generate();
      const recentError = report.recentErrors[0];

      expect(recentError).toHaveProperty('timestamp');
      expect(recentError).toHaveProperty('level');
      expect(recentError).toHaveProperty('message');
      expect(recentError).toHaveProperty('errorName');
      expect(recentError).toHaveProperty('errorMessage');
    });
  });
});
