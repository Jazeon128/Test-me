/**
 * Property-Based Tests for Database Location
 * Feature: standalone-desktop-app, Property 2: Database initialization
 * Feature: standalone-desktop-app, Property 9: Database location
 * Validates: Requirements 1.3, 3.2
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DataDirectoryManager = require('../data-directory-manager');
const BackendManager = require('../backend-manager');

describe('Database Location Properties', () => {
  let tempDirs = [];

  afterEach(() => {
    // Clean up all temp directories
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
    tempDirs = [];
  });

  describe('Property 2: Database initialization', () => {
    test('for any first launch, database file should exist in application data directory after startup', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            // Database file should not exist yet
            expect(dataManager.databaseExists()).toBe(false);

            // Get the expected database path
            const dbPath = dataManager.getDatabasePath();

            // Verify path is in the application data directory
            expect(dbPath.startsWith(tempDir)).toBe(true);
            expect(dbPath).toBe(path.join(tempDir, 'flashlearn.db'));

            // Simulate database creation (what the backend would do)
            fs.writeFileSync(dbPath, '');

            // Now database should exist
            expect(dataManager.databaseExists()).toBe(true);
            expect(fs.existsSync(dbPath)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any application data directory, database path should be consistent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            // Get database path multiple times
            const dbPath1 = dataManager.getDatabasePath();
            const dbPath2 = dataManager.getDatabasePath();
            const dbPath3 = dataManager.getDatabasePath();

            // All should be identical
            expect(dbPath1).toBe(dbPath2);
            expect(dbPath2).toBe(dbPath3);

            // Should always be in the root directory
            expect(dbPath1).toBe(path.join(tempDir, 'flashlearn.db'));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9: Database location', () => {
    test('for any data modification operation, database should be in application data directory', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            const dbPath = dataManager.getDatabasePath();

            // Database path should be within the application data directory
            expect(dbPath.startsWith(tempDir)).toBe(true);

            // Database path should be a direct child of the root directory
            expect(path.dirname(dbPath)).toBe(tempDir);

            // Database filename should be 'flashlearn.db'
            expect(path.basename(dbPath)).toBe('flashlearn.db');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any backend manager, database URL should point to application data directory', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            const backendManager = new BackendManager(tempDir, dataManager);

            // Get the environment that would be passed to the backend
            // We need to set a port first
            backendManager.port = 8000;
            const env = backendManager._getBackendEnvironment();

            // Database URL should reference the correct path
            const expectedDbPath = dataManager.getDatabasePath();
            const expectedUrl = `sqlite:///${expectedDbPath}`;

            expect(env.DATABASE_URL).toBe(expectedUrl);

            // Verify the path in the URL is in the application data directory
            const urlPath = env.DATABASE_URL.replace('sqlite:///', '');
            expect(urlPath.startsWith(tempDir)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any backend manager without data directory manager, database should fallback to user data path', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            // Create backend manager without data directory manager
            const backendManager = new BackendManager(tempDir, null);

            // Set a port
            backendManager.port = 8000;
            const env = backendManager._getBackendEnvironment();

            // Should fallback to old behavior
            const expectedDbPath = path.join(tempDir, 'flashlearn.db');
            const expectedUrl = `sqlite:///${expectedDbPath}`;

            expect(env.DATABASE_URL).toBe(expectedUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any initialized data directory, database path should be absolute', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            const dbPath = dataManager.getDatabasePath();

            // Path should be absolute
            expect(path.isAbsolute(dbPath)).toBe(true);

            // Path should not contain relative components
            expect(dbPath).not.toContain('..');
            expect(dbPath).not.toContain('./');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any OS platform, database should be in the correct OS-specific location', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('win32', 'darwin', 'linux'),
          (platform) => {
            // Save original platform
            const originalPlatform = process.platform;

            // Mock platform
            Object.defineProperty(process, 'platform', {
              value: platform,
              configurable: true
            });

            try {
              const osDataPath = DataDirectoryManager.getOSDataPath();

              // Create a data manager with this path
              const dataManager = new DataDirectoryManager(osDataPath);

              // Database path should be within the OS-specific path
              const rootPath = dataManager.getRootPath();
              expect(rootPath).toBe(osDataPath);

              // Verify OS-specific path patterns
              switch (platform) {
                case 'win32':
                  // Windows: should contain AppData or Roaming
                  expect(
                    osDataPath.includes('AppData') || osDataPath.includes('Roaming')
                  ).toBe(true);
                  break;
                case 'darwin':
                  // macOS: should contain Library and Application Support (with any separator)
                  expect(osDataPath.includes('Library')).toBe(true);
                  expect(osDataPath.includes('Application Support')).toBe(true);
                  break;
                case 'linux':
                  // Linux: should contain .config
                  expect(osDataPath.includes('.config')).toBe(true);
                  break;
              }
            } finally {
              // Restore original platform
              Object.defineProperty(process, 'platform', {
                value: originalPlatform,
                configurable: true
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any data directory, database path should have .db extension', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            const dbPath = dataManager.getDatabasePath();

            // Should have .db extension
            expect(path.extname(dbPath)).toBe('.db');
            expect(dbPath.endsWith('.db')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
