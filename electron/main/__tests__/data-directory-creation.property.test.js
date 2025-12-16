/**
 * Property-Based Tests for Data Directory Creation
 * Feature: standalone-desktop-app, Property 10: Data directory creation
 * Validates: Requirements 3.1
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DataDirectoryManager = require('../data-directory-manager');

describe('Data Directory Creation Properties', () => {
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

  describe('Property 10: Data directory creation', () => {
    test('for any first launch, data directory should be created in OS-standard location', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // No input needed
          async () => {
            // Create a unique temp directory for this test
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const manager = new DataDirectoryManager(tempDir);

            // Before initialization, directory structure should not exist
            const uploadsPath = path.join(tempDir, 'uploads');
            const logsPath = path.join(tempDir, 'logs');
            const backupsPath = path.join(tempDir, 'backups');

            // Initialize
            const paths = await manager.initialize();

            // Verify root directory exists
            expect(fs.existsSync(tempDir)).toBe(true);

            // Verify subdirectories were created
            expect(fs.existsSync(uploadsPath)).toBe(true);
            expect(fs.existsSync(logsPath)).toBe(true);
            expect(fs.existsSync(backupsPath)).toBe(true);

            // Verify paths are correct
            expect(paths.root).toBe(tempDir);
            expect(paths.uploads).toBe(uploadsPath);
            expect(paths.logs).toBe(logsPath);
            expect(paths.backups).toBe(backupsPath);
            expect(paths.database).toBe(path.join(tempDir, 'flashlearn.db'));

            // Verify manager is initialized
            expect(manager.isInitialized()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any data directory path, initialization should be idempotent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const manager = new DataDirectoryManager(tempDir);

            // Initialize multiple times
            const paths1 = await manager.initialize();
            const paths2 = await manager.initialize();
            const paths3 = await manager.initialize();

            // All should return the same paths
            expect(paths1).toEqual(paths2);
            expect(paths2).toEqual(paths3);

            // Directory should still exist and be valid
            expect(fs.existsSync(tempDir)).toBe(true);
            expect(fs.existsSync(paths1.uploads)).toBe(true);
            expect(fs.existsSync(paths1.logs)).toBe(true);
            expect(fs.existsSync(paths1.backups)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any OS platform, getOSDataPath should return a valid path', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('win32', 'darwin', 'linux', 'freebsd'),
          (platform) => {
            // Save original platform
            const originalPlatform = process.platform;

            // Mock platform
            Object.defineProperty(process, 'platform', {
              value: platform,
              configurable: true
            });

            try {
              const dataPath = DataDirectoryManager.getOSDataPath();

              // Path should be non-empty
              expect(dataPath).toBeTruthy();
              expect(typeof dataPath).toBe('string');
              expect(dataPath.length).toBeGreaterThan(0);

              // Path should contain 'FlashLearn' or '.flashlearn'
              expect(
                dataPath.includes('FlashLearn') || dataPath.includes('.flashlearn')
              ).toBe(true);

              // Path should be absolute
              expect(path.isAbsolute(dataPath)).toBe(true);
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

    test('for any initialized manager, all path getters should return valid paths', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const manager = new DataDirectoryManager(tempDir);
            await manager.initialize();

            // All getters should return valid paths
            const dbPath = manager.getDatabasePath();
            const uploadsPath = manager.getUploadsPath();
            const logsPath = manager.getLogsPath();
            const backupsPath = manager.getBackupsPath();
            const rootPath = manager.getRootPath();

            // All paths should be non-empty strings
            expect(typeof dbPath).toBe('string');
            expect(typeof uploadsPath).toBe('string');
            expect(typeof logsPath).toBe('string');
            expect(typeof backupsPath).toBe('string');
            expect(typeof rootPath).toBe('string');

            expect(dbPath.length).toBeGreaterThan(0);
            expect(uploadsPath.length).toBeGreaterThan(0);
            expect(logsPath.length).toBeGreaterThan(0);
            expect(backupsPath.length).toBeGreaterThan(0);
            expect(rootPath.length).toBeGreaterThan(0);

            // All paths should be absolute
            expect(path.isAbsolute(dbPath)).toBe(true);
            expect(path.isAbsolute(uploadsPath)).toBe(true);
            expect(path.isAbsolute(logsPath)).toBe(true);
            expect(path.isAbsolute(backupsPath)).toBe(true);
            expect(path.isAbsolute(rootPath)).toBe(true);

            // Subdirectory paths should be within root
            expect(uploadsPath.startsWith(rootPath)).toBe(true);
            expect(logsPath.startsWith(rootPath)).toBe(true);
            expect(backupsPath.startsWith(rootPath)).toBe(true);
            expect(dbPath.startsWith(rootPath)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any uninitialized manager, path getters should throw errors', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const manager = new DataDirectoryManager(tempDir);

            // All getters should throw before initialization
            expect(() => manager.getDatabasePath()).toThrow('not initialized');
            expect(() => manager.getUploadsPath()).toThrow('not initialized');
            expect(() => manager.getLogsPath()).toThrow('not initialized');
            expect(() => manager.getBackupsPath()).toThrow('not initialized');
            expect(() => manager.getAllPaths()).toThrow('not initialized');

            // isInitialized should return false
            expect(manager.isInitialized()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any data directory, exists() should correctly report directory existence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const manager = new DataDirectoryManager(tempDir);

            // Before initialization, directory exists (we created it)
            expect(manager.exists()).toBe(true);

            // After initialization, directory should still exist
            await manager.initialize();
            expect(manager.exists()).toBe(true);

            // Create a manager for a non-existent directory
            const nonExistentDir = path.join(tempDir, 'non-existent-' + Date.now());
            const manager2 = new DataDirectoryManager(nonExistentDir);

            // Should not exist yet
            expect(manager2.exists()).toBe(false);

            // After initialization, should exist
            await manager2.initialize();
            expect(manager2.exists()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any data directory, databaseExists() should correctly report database file existence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const manager = new DataDirectoryManager(tempDir);

            // Before initialization, should return false
            expect(manager.databaseExists()).toBe(false);

            // After initialization, database file doesn't exist yet (not created)
            await manager.initialize();
            expect(manager.databaseExists()).toBe(false);

            // Create the database file
            const dbPath = manager.getDatabasePath();
            fs.writeFileSync(dbPath, '');

            // Now it should exist
            expect(manager.databaseExists()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any data directory, getAllPaths() should return all paths', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const manager = new DataDirectoryManager(tempDir);
            await manager.initialize();

            const allPaths = manager.getAllPaths();

            // Should have all required keys
            expect(allPaths).toHaveProperty('root');
            expect(allPaths).toHaveProperty('database');
            expect(allPaths).toHaveProperty('uploads');
            expect(allPaths).toHaveProperty('logs');
            expect(allPaths).toHaveProperty('backups');

            // Should match individual getters
            expect(allPaths.root).toBe(manager.getRootPath());
            expect(allPaths.database).toBe(manager.getDatabasePath());
            expect(allPaths.uploads).toBe(manager.getUploadsPath());
            expect(allPaths.logs).toBe(manager.getLogsPath());
            expect(allPaths.backups).toBe(manager.getBackupsPath());
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
