/**
 * Property-Based Tests for Error Logging
 * Feature: standalone-desktop-app, Property 17: Error logging
 * Feature: standalone-desktop-app, Property 28: Error detail logging
 * Validates: Requirements 6.4, 9.5
 * 
 * Property 17: Error logging
 * For any unexpected error that occurs, the error details should be written
 * to the log file in the application data directory.
 * 
 * Property 28: Error detail logging
 * For any error that occurs, the log file should contain the error message,
 * stack trace, and relevant context.
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const Logger = require('../logger');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Property 17 & 28: Error logging with details', () => {
  let logger;
  let testDir;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = path.join(os.tmpdir(), `logger-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    logger = new Logger(testDir);
    await logger.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up test directory:', error);
    }
  });

  it('should write error logs to the log file', async () => {
    // Property 17: For any error, it should be written to the log file
    
    const errorMessage = 'Test error message';
    const error = new Error('Test error');
    
    await logger.error(errorMessage, error);
    
    // Wait a bit for file write
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify log file exists
    const logPath = logger.getLogPath();
    const stats = await fs.stat(logPath);
    expect(stats.isFile()).toBe(true);
    
    // Verify log content
    const content = await fs.readFile(logPath, 'utf8');
    expect(content).toContain(errorMessage);
    expect(content).toContain('ERROR');
  });

  it('should include error stack trace in logs', async () => {
    // Property 28: For any error, stack trace should be included
    
    const error = new Error('Test error with stack');
    await logger.error('Error occurred', error);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const content = await fs.readFile(logger.getLogPath(), 'utf8');
    const logEntries = content.split('\n').filter(line => line.trim());
    const lastEntry = JSON.parse(logEntries[logEntries.length - 1]);
    
    expect(lastEntry.error).toBeDefined();
    expect(lastEntry.error.stack).toBeDefined();
    expect(lastEntry.error.stack).toContain('Test error with stack');
  });

  it('should include error message in logs', async () => {
    // Property 28: For any error, error message should be included
    
    const error = new Error('Specific error message');
    await logger.error('Error occurred', error);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const content = await fs.readFile(logger.getLogPath(), 'utf8');
    const logEntries = content.split('\n').filter(line => line.trim());
    const lastEntry = JSON.parse(logEntries[logEntries.length - 1]);
    
    expect(lastEntry.error).toBeDefined();
    expect(lastEntry.error.message).toBe('Specific error message');
  });

  it('should include context in error logs', async () => {
    // Property 28: For any error, relevant context should be included
    
    const error = new Error('Test error');
    const context = {
      userId: 'test-user',
      operation: 'test-operation',
      timestamp: Date.now(),
    };
    
    await logger.error('Error with context', error, context);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const content = await fs.readFile(logger.getLogPath(), 'utf8');
    const logEntries = content.split('\n').filter(line => line.trim());
    const lastEntry = JSON.parse(logEntries[logEntries.length - 1]);
    
    expect(lastEntry.userId).toBe(context.userId);
    expect(lastEntry.operation).toBe(context.operation);
    expect(lastEntry.timestamp).toBe(context.timestamp);
  });

  it('should write errors to both main log and error log', async () => {
    // Property 17: Errors should be written to dedicated error log
    
    const error = new Error('Test error');
    await logger.error('Error message', error);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check main log
    const mainLogContent = await fs.readFile(logger.getLogPath(), 'utf8');
    expect(mainLogContent).toContain('Error message');
    
    // Check error log
    const errorLogContent = await fs.readFile(logger.getErrorLogPath(), 'utf8');
    expect(errorLogContent).toContain('Error message');
  });

  it('should include timestamp in all log entries', async () => {
    // Property 28: For any log entry, timestamp should be included
    
    await logger.error('Test error', new Error('Test'));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const content = await fs.readFile(logger.getLogPath(), 'utf8');
    const logEntries = content.split('\n').filter(line => line.trim());
    const lastEntry = JSON.parse(logEntries[logEntries.length - 1]);
    
    expect(lastEntry.timestamp).toBeDefined();
    expect(new Date(lastEntry.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('should include log level in all entries', async () => {
    // Property 28: For any log entry, log level should be included
    
    await logger.error('Test error', new Error('Test'));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const content = await fs.readFile(logger.getLogPath(), 'utf8');
    const logEntries = content.split('\n').filter(line => line.trim());
    const lastEntry = JSON.parse(logEntries[logEntries.length - 1]);
    
    expect(lastEntry.level).toBe('ERROR');
  });

  it('should rotate logs when size exceeds limit', async () => {
    // Property 17: Log rotation should occur when file size exceeds limit
    
    // Set a small max log size for testing
    logger.maxLogSize = 1024; // 1 KB
    
    // Write many log entries to exceed the limit
    for (let i = 0; i < 100; i++) {
      await logger.error(`Error message ${i}`, new Error(`Test error ${i}`));
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check if rotated log file exists
    const logDir = logger.getLogDir();
    const files = await fs.readdir(logDir);
    const rotatedFiles = files.filter(f => f.includes('.1.log'));
    
    expect(rotatedFiles.length).toBeGreaterThan(0);
  });

  it('should retrieve recent log entries', async () => {
    // Property 17: Should be able to retrieve recent logs
    
    await logger.info('Info message 1');
    await logger.warn('Warning message 2');
    await logger.error('Error message 3', new Error('Test'));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const recentLogs = await logger.getRecentLogs(10);
    
    expect(recentLogs.length).toBeGreaterThanOrEqual(3);
    expect(recentLogs.some(log => log.message === 'Info message 1')).toBe(true);
    expect(recentLogs.some(log => log.message === 'Warning message 2')).toBe(true);
    expect(recentLogs.some(log => log.message === 'Error message 3')).toBe(true);
  });

  it('should retrieve recent error entries', async () => {
    // Property 17: Should be able to retrieve recent errors
    
    await logger.error('Error 1', new Error('Test 1'));
    await logger.error('Error 2', new Error('Test 2'));
    await logger.error('Error 3', new Error('Test 3'));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const recentErrors = await logger.getRecentErrors(10);
    
    expect(recentErrors.length).toBeGreaterThanOrEqual(3);
    expect(recentErrors.some(log => log.message === 'Error 1')).toBe(true);
    expect(recentErrors.some(log => log.message === 'Error 2')).toBe(true);
    expect(recentErrors.some(log => log.message === 'Error 3')).toBe(true);
  });

  it('should handle errors without error objects gracefully', async () => {
    // Property 17: Should handle logging errors without error objects
    
    await logger.error('Error message without error object');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const content = await fs.readFile(logger.getLogPath(), 'utf8');
    expect(content).toContain('Error message without error object');
  });

  it('should include error code if available', async () => {
    // Property 28: For any error with code, code should be included
    
    const error = new Error('Test error');
    error.code = 'TEST_ERROR_CODE';
    
    await logger.error('Error with code', error);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const content = await fs.readFile(logger.getLogPath(), 'utf8');
    const logEntries = content.split('\n').filter(line => line.trim());
    const lastEntry = JSON.parse(logEntries[logEntries.length - 1]);
    
    expect(lastEntry.error.code).toBe('TEST_ERROR_CODE');
  });

  it('should log crash information with system details', async () => {
    // Property 28: Crash logs should include system information
    
    await logger.crash('Test crash', { reason: 'Test reason' });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const content = await fs.readFile(logger.getLogPath(), 'utf8');
    const logEntries = content.split('\n').filter(line => line.trim());
    const lastEntry = JSON.parse(logEntries[logEntries.length - 1]);
    
    expect(lastEntry.platform).toBeDefined();
    expect(lastEntry.arch).toBeDefined();
    expect(lastEntry.nodeVersion).toBeDefined();
  });

  it('should handle concurrent log writes', async () => {
    // Property 17: Should handle multiple concurrent log writes
    
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(logger.error(`Concurrent error ${i}`, new Error(`Test ${i}`)));
    }
    
    await Promise.all(promises);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const recentLogs = await logger.getRecentLogs(20);
    expect(recentLogs.length).toBeGreaterThanOrEqual(10);
  });
});
