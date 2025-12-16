/**
 * Property-Based Tests for Diagnostic Report
 * Feature: standalone-desktop-app, Property 26: Diagnostic report completeness
 * Validates: Requirements 9.3
 * 
 * Tests that diagnostic reports always contain required information:
 * - Application version
 * - Operating system information
 * - Configuration (sanitized)
 */

const fc = require('fast-check');
const DiagnosticReport = require('../diagnostic-report');
const Logger = require('../logger');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

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

describe('Property 26: Diagnostic report completeness', () => {
  let tempDir;
  let logger;
  let mockSettingsManager;

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
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Feature: standalone-desktop-app, Property 26: Diagnostic report completeness
   * For any diagnostic report generated, it should include the application version,
   * operating system information, and current configuration
   */
  test('Property 26: All diagnostic reports contain required information', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary settings configurations
        fc.record({
          apiProvider: fc.constantFrom('openai', 'anthropic', 'google'),
          theme: fc.constantFrom('light', 'dark', 'system'),
          autoUpdate: fc.boolean(),
          hasOpenAI: fc.boolean(),
          hasAnthropic: fc.boolean(),
          hasGoogle: fc.boolean(),
        }),
        async (config) => {
          // Update mock settings manager with generated config
          mockSettingsManager.getAll = jest.fn(() => ({
            apiProvider: config.apiProvider,
            theme: config.theme,
            autoUpdate: config.autoUpdate,
            apiKeys: {
              openai: config.hasOpenAI ? 'sk-test-key' : null,
              anthropic: config.hasAnthropic ? 'sk-test-key' : null,
              google: config.hasGoogle ? 'test-key' : null,
            },
          }));

          // Generate diagnostic report
          const diagnosticReport = new DiagnosticReport(logger, mockSettingsManager);
          const report = await diagnosticReport.generate();

          // Verify report structure and required fields
          expect(report).toBeDefined();
          expect(report).toHaveProperty('generatedAt');
          expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

          // Verify application information is present
          expect(report).toHaveProperty('application');
          expect(report.application).toHaveProperty('name');
          expect(report.application).toHaveProperty('version');
          expect(report.application).toHaveProperty('electronVersion');
          expect(report.application).toHaveProperty('chromeVersion');
          expect(report.application).toHaveProperty('nodeVersion');
          expect(report.application).toHaveProperty('v8Version');

          // Verify system information is present
          expect(report).toHaveProperty('system');
          expect(report.system).toHaveProperty('platform');
          expect(report.system).toHaveProperty('arch');
          expect(report.system).toHaveProperty('osType');
          expect(report.system).toHaveProperty('osRelease');
          expect(report.system).toHaveProperty('hostname');
          expect(report.system).toHaveProperty('totalMemory');
          expect(report.system).toHaveProperty('freeMemory');
          expect(report.system).toHaveProperty('cpuCount');
          expect(report.system).toHaveProperty('cpuModel');

          // Verify configuration is present and sanitized
          expect(report).toHaveProperty('configuration');
          expect(report.configuration).toHaveProperty('apiProvider', config.apiProvider);
          expect(report.configuration).toHaveProperty('theme', config.theme);
          expect(report.configuration).toHaveProperty('autoUpdate', config.autoUpdate);

          // Verify API keys are sanitized (not exposed in plain text)
          if (report.configuration.apiKeys) {
            expect(report.configuration.apiKeys.openai).toMatch(/^(\*\*\*SET\*\*\*|NOT SET)$/);
            expect(report.configuration.apiKeys.anthropic).toMatch(/^(\*\*\*SET\*\*\*|NOT SET)$/);
            expect(report.configuration.apiKeys.google).toMatch(/^(\*\*\*SET\*\*\*|NOT SET)$/);
            
            // Verify sanitization matches actual configuration
            expect(report.configuration.apiKeys.openai).toBe(config.hasOpenAI ? '***SET***' : 'NOT SET');
            expect(report.configuration.apiKeys.anthropic).toBe(config.hasAnthropic ? '***SET***' : 'NOT SET');
            expect(report.configuration.apiKeys.google).toBe(config.hasGoogle ? '***SET***' : 'NOT SET');
          }

          // Verify log information is present
          expect(report).toHaveProperty('logs');
          expect(report.logs).toHaveProperty('logFile');
          expect(report.logs).toHaveProperty('errorLogFile');
          expect(report.logs).toHaveProperty('logLevel');

          // Verify recent errors array is present (may be empty)
          expect(report).toHaveProperty('recentErrors');
          expect(Array.isArray(report.recentErrors)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 26: Diagnostic report text format contains all sections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          apiProvider: fc.constantFrom('openai', 'anthropic', 'google'),
          theme: fc.constantFrom('light', 'dark', 'system'),
        }),
        async (config) => {
          // Update mock settings manager
          mockSettingsManager.getAll = jest.fn(() => ({
            apiProvider: config.apiProvider,
            theme: config.theme,
            autoUpdate: true,
            apiKeys: {
              openai: 'sk-test-key',
              anthropic: null,
              google: null,
            },
          }));

          // Generate diagnostic report
          const diagnosticReport = new DiagnosticReport(logger, mockSettingsManager);
          const report = await diagnosticReport.generate();
          const textReport = diagnosticReport.formatAsText(report);

          // Verify all required sections are present in text format
          expect(textReport).toContain('DIAGNOSTIC REPORT');
          expect(textReport).toContain('APPLICATION INFORMATION');
          expect(textReport).toContain('SYSTEM INFORMATION');
          expect(textReport).toContain('CONFIGURATION');
          expect(textReport).toContain('LOG INFORMATION');
          expect(textReport).toContain('END OF REPORT');

          // Verify key information is present
          expect(textReport).toContain('Name:');
          expect(textReport).toContain('Version:');
          expect(textReport).toContain('Platform:');
          expect(textReport).toContain('OS:');
          expect(textReport).toContain('CPU:');
          expect(textReport).toContain('Memory:');
          expect(textReport).toContain('Log Level:');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 26: Diagnostic report never exposes raw API keys', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary API key-like strings
        fc.record({
          openaiKey: fc.string({ minLength: 20, maxLength: 50 }),
          anthropicKey: fc.string({ minLength: 20, maxLength: 50 }),
          googleKey: fc.string({ minLength: 20, maxLength: 50 }),
        }),
        async (keys) => {
          // Update mock settings manager with actual keys
          mockSettingsManager.getAll = jest.fn(() => ({
            apiProvider: 'openai',
            theme: 'dark',
            autoUpdate: true,
            apiKeys: {
              openai: keys.openaiKey,
              anthropic: keys.anthropicKey,
              google: keys.googleKey,
            },
          }));

          // Generate diagnostic report
          const diagnosticReport = new DiagnosticReport(logger, mockSettingsManager);
          const report = await diagnosticReport.generate();
          const jsonReport = JSON.stringify(report);
          const textReport = diagnosticReport.formatAsText(report);

          // Verify raw API keys are never present in the report
          expect(jsonReport).not.toContain(keys.openaiKey);
          expect(jsonReport).not.toContain(keys.anthropicKey);
          expect(jsonReport).not.toContain(keys.googleKey);

          expect(textReport).not.toContain(keys.openaiKey);
          expect(textReport).not.toContain(keys.anthropicKey);
          expect(textReport).not.toContain(keys.googleKey);

          // Verify sanitized indicators are present
          expect(report.configuration.apiKeys.openai).toBe('***SET***');
          expect(report.configuration.apiKeys.anthropic).toBe('***SET***');
          expect(report.configuration.apiKeys.google).toBe('***SET***');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 26: Diagnostic report JSON is valid and parseable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          apiProvider: fc.constantFrom('openai', 'anthropic', 'google'),
        }),
        async (config) => {
          // Update mock settings manager
          mockSettingsManager.getAll = jest.fn(() => ({
            apiProvider: config.apiProvider,
            theme: 'dark',
            autoUpdate: true,
            apiKeys: {
              openai: 'sk-test-key',
              anthropic: null,
              google: null,
            },
          }));

          // Generate diagnostic report
          const diagnosticReport = new DiagnosticReport(logger, mockSettingsManager);
          const jsonString = await diagnosticReport.generateJSON();

          // Verify JSON is valid
          expect(() => JSON.parse(jsonString)).not.toThrow();

          // Parse and verify structure
          const parsed = JSON.parse(jsonString);
          expect(parsed).toHaveProperty('generatedAt');
          expect(parsed).toHaveProperty('application');
          expect(parsed).toHaveProperty('system');
          expect(parsed).toHaveProperty('configuration');
          expect(parsed).toHaveProperty('logs');
          expect(parsed).toHaveProperty('recentErrors');
        }
      ),
      { numRuns: 100 }
    );
  });
});
