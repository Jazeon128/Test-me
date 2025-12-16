/**
 * Diagnostic Report Generator
 * Collects system information and generates diagnostic reports
 * Implements Requirement 9.3: Diagnostic report generation
 */

const os = require('os');
const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

class DiagnosticReport {
  constructor(logger, settingsManager) {
    this.logger = logger;
    this.settingsManager = settingsManager;
  }

  /**
   * Collect application version information
   * @returns {Object} Application version info
   */
  getApplicationInfo() {
    return {
      name: app.getName(),
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      v8Version: process.versions.v8,
    };
  }

  /**
   * Collect operating system information
   * @returns {Object} OS information
   */
  getSystemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      osType: os.type(),
      osRelease: os.release(),
      osVersion: os.version(),
      hostname: os.hostname(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      uptime: os.uptime(),
    };
  }

  /**
   * Collect configuration information (sanitized)
   * Removes sensitive data like API keys
   * @returns {Object} Sanitized configuration
   */
  async getConfigurationInfo() {
    try {
      const settings = this.settingsManager.getAll();
      
      // Sanitize sensitive data
      const sanitized = { ...settings };
      
      // Remove API keys but indicate if they're set
      if (sanitized.apiKeys) {
        sanitized.apiKeys = {
          openai: sanitized.apiKeys.openai ? '***SET***' : 'NOT SET',
          anthropic: sanitized.apiKeys.anthropic ? '***SET***' : 'NOT SET',
          google: sanitized.apiKeys.google ? '***SET***' : 'NOT SET',
        };
      }
      
      return sanitized;
    } catch (error) {
      return { error: 'Failed to load configuration' };
    }
  }

  /**
   * Collect log file information
   * @returns {Object} Log file stats
   */
  async getLogInfo() {
    try {
      const logPath = this.logger.getLogPath();
      const errorLogPath = this.logger.getErrorLogPath();
      
      const logStats = await fs.stat(logPath).catch(() => null);
      const errorLogStats = await fs.stat(errorLogPath).catch(() => null);
      
      return {
        logFile: {
          path: logPath,
          size: logStats ? logStats.size : 0,
          exists: !!logStats,
        },
        errorLogFile: {
          path: errorLogPath,
          size: errorLogStats ? errorLogStats.size : 0,
          exists: !!errorLogStats,
        },
        logLevel: this.logger.getLogLevel(),
      };
    } catch (error) {
      return { error: 'Failed to collect log information' };
    }
  }

  /**
   * Collect recent errors from logs
   * @param {number} count - Number of recent errors to include
   * @returns {Array} Recent error entries
   */
  async getRecentErrors(count = 10) {
    try {
      const errors = await this.logger.getRecentErrors(count);
      
      // Sanitize error entries (remove potentially sensitive data)
      return errors.map(error => ({
        timestamp: error.timestamp,
        level: error.level,
        message: error.message,
        errorName: error.error?.name,
        errorMessage: error.error?.message,
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate a complete diagnostic report
   * Implements Requirement 9.3: Diagnostic report with version, OS, and configuration
   * @returns {Promise<Object>} Complete diagnostic report
   */
  async generate() {
    const timestamp = new Date().toISOString();
    
    const report = {
      generatedAt: timestamp,
      application: this.getApplicationInfo(),
      system: this.getSystemInfo(),
      configuration: await this.getConfigurationInfo(),
      logs: await this.getLogInfo(),
      recentErrors: await this.getRecentErrors(),
    };
    
    // Log the report generation
    await this.logger.info('Diagnostic report generated', {
      timestamp,
    });
    
    return report;
  }

  /**
   * Format diagnostic report as human-readable text
   * @param {Object} report - Diagnostic report object
   * @returns {string} Formatted report text
   */
  formatAsText(report) {
    const lines = [];
    
    lines.push('='.repeat(60));
    lines.push('DIAGNOSTIC REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Generated: ${report.generatedAt}`);
    lines.push('');
    
    // Application Info
    lines.push('APPLICATION INFORMATION');
    lines.push('-'.repeat(60));
    lines.push(`Name: ${report.application.name}`);
    lines.push(`Version: ${report.application.version}`);
    lines.push(`Electron: ${report.application.electronVersion}`);
    lines.push(`Chrome: ${report.application.chromeVersion}`);
    lines.push(`Node: ${report.application.nodeVersion}`);
    lines.push('');
    
    // System Info
    lines.push('SYSTEM INFORMATION');
    lines.push('-'.repeat(60));
    lines.push(`Platform: ${report.system.platform} (${report.system.arch})`);
    lines.push(`OS: ${report.system.osType} ${report.system.osRelease}`);
    lines.push(`Hostname: ${report.system.hostname}`);
    lines.push(`CPU: ${report.system.cpuModel} (${report.system.cpuCount} cores)`);
    lines.push(`Memory: ${Math.round(report.system.freeMemory / 1024 / 1024)} MB free / ${Math.round(report.system.totalMemory / 1024 / 1024)} MB total`);
    lines.push(`Uptime: ${Math.round(report.system.uptime / 3600)} hours`);
    lines.push('');
    
    // Configuration
    lines.push('CONFIGURATION');
    lines.push('-'.repeat(60));
    lines.push(JSON.stringify(report.configuration, null, 2));
    lines.push('');
    
    // Log Info
    lines.push('LOG INFORMATION');
    lines.push('-'.repeat(60));
    lines.push(`Log Level: ${report.logs.logLevel}`);
    lines.push(`Main Log: ${report.logs.logFile.path} (${report.logs.logFile.size} bytes)`);
    lines.push(`Error Log: ${report.logs.errorLogFile.path} (${report.logs.errorLogFile.size} bytes)`);
    lines.push('');
    
    // Recent Errors
    if (report.recentErrors.length > 0) {
      lines.push('RECENT ERRORS');
      lines.push('-'.repeat(60));
      report.recentErrors.forEach((error, index) => {
        lines.push(`${index + 1}. [${error.timestamp}] ${error.message}`);
        if (error.errorName) {
          lines.push(`   ${error.errorName}: ${error.errorMessage}`);
        }
      });
      lines.push('');
    }
    
    lines.push('='.repeat(60));
    lines.push('END OF REPORT');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  /**
   * Save diagnostic report to file
   * @param {string} filePath - Path to save the report
   * @returns {Promise<void>}
   */
  async saveToFile(filePath) {
    const report = await this.generate();
    const text = this.formatAsText(report);
    
    await fs.writeFile(filePath, text, 'utf8');
    await this.logger.info('Diagnostic report saved', { filePath });
  }

  /**
   * Generate and return diagnostic report as JSON
   * @returns {Promise<string>} JSON string of the report
   */
  async generateJSON() {
    const report = await this.generate();
    return JSON.stringify(report, null, 2);
  }
}

module.exports = DiagnosticReport;
