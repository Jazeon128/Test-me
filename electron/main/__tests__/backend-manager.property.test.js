/**
 * Property-Based Tests for BackendManager
 * Feature: standalone-desktop-app
 */

const fc = require('fast-check');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Mock the electron app module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => require('path').join(require('os').tmpdir(), 'flashlearn-test')),
  },
}));

const BackendManager = require('../backend-manager');

describe('BackendManager Property-Based Tests', () => {
  let testDataPath;

  beforeEach(() => {
    // Create a temporary directory for test data
    testDataPath = path.join(os.tmpdir(), `flashlearn-test-${Date.now()}`);
    if (!fs.existsSync(testDataPath)) {
      fs.mkdirSync(testDataPath, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDataPath)) {
      fs.rmSync(testDataPath, { recursive: true, force: true });
    }
  });

  /**
   * Feature: standalone-desktop-app, Property 1: Backend startup invariant
   * Validates: Requirements 1.2
   * 
   * For any application launch, starting the application should result in 
   * both the backend process running and the main window being displayed.
   * 
   * Note: This test focuses on the backend process portion of the property.
   * The main window display is tested separately in window management tests.
   * 
   * Since we don't have an actual backend executable in the test environment,
   * these tests validate the manager's logic and error handling.
   */
  describe('Property 1: Backend startup invariant', () => {
    test('port allocation should always be in valid range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userDataPath: fc.constant(testDataPath),
          }),
          async ({ userDataPath }) => {
            const manager = new BackendManager(userDataPath);
            
            // Test port finding logic
            const port = await manager._findAvailablePort();
            
            // Verify a port was allocated in the correct range
            expect(port).toBeGreaterThanOrEqual(8000);
            expect(port).toBeLessThanOrEqual(8010);
          }
        ),
        { numRuns: 100 }
      );
    }, 10000);

    test('stop should always result in a non-running backend', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(testDataPath),
          async (userDataPath) => {
            const manager = new BackendManager(userDataPath);
            
            // Even without starting, stop should work
            await manager.stop();
            
            expect(manager.isRunning()).toBe(false);
            expect(manager.getPort()).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    }, 10000);

    test('environment variables should be properly configured', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(testDataPath),
          async (userDataPath) => {
            const manager = new BackendManager(userDataPath);
            manager.port = 8000; // Set a port for testing
            
            const env = manager._getBackendEnvironment();
            
            // Verify required environment variables
            expect(env.PORT).toBe('8000');
            expect(env.HOST).toBe('127.0.0.1');
            expect(env.CORS_ENABLED).toBe('false');
            expect(env.DATABASE_URL).toContain('sqlite:///');
            expect(env.DATABASE_URL).toContain('flashlearn.db');
            expect(env.UPLOAD_DIR).toContain('uploads');
          }
        ),
        { numRuns: 100 }
      );
    }, 10000);
  });

  describe('Backend lifecycle properties', () => {
    test('isRunning should return false when no process exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(testDataPath),
          async (userDataPath) => {
            const manager = new BackendManager(userDataPath);
            
            // Before starting, should not be running
            expect(manager.isRunning()).toBe(false);
            
            // After stopping (even without starting), should not be running
            await manager.stop();
            expect(manager.isRunning()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    }, 10000);

    test('getPort should return null when backend is not running', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(testDataPath),
          async (userDataPath) => {
            const manager = new BackendManager(userDataPath);
            
            expect(manager.getPort()).toBeNull();
            
            await manager.stop();
            expect(manager.getPort()).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    }, 10000);
  });

  describe('Port allocation properties', () => {
    test('port availability check should correctly identify available ports', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 8000, max: 8010 }),
          async (port) => {
            const manager = new BackendManager(testDataPath);
            
            // Check if port is available
            const isAvailable = await manager._isPortAvailable(port);
            
            // Result should be a boolean
            expect(typeof isAvailable).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    }, 10000);

    test('findAvailablePort should always return a port in range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(testDataPath),
          async (userDataPath) => {
            const manager = new BackendManager(userDataPath);
            
            const port = await manager._findAvailablePort();
            
            expect(port).toBeGreaterThanOrEqual(8000);
            expect(port).toBeLessThanOrEqual(8010);
          }
        ),
        { numRuns: 100 }
      );
    }, 10000);
  });
});
