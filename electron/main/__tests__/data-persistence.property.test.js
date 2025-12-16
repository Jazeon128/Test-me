/**
 * Property-Based Tests for Data Persistence
 * Feature: standalone-desktop-app, Property 3: Data persistence round-trip
 * Validates: Requirements 3.4
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DataDirectoryManager = require('../data-directory-manager');

describe('Data Persistence Properties', () => {
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

  describe('Property 3: Data persistence round-trip', () => {
    test('for any data created in one session, restarting should make data available', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Simulate database data
            dbContent: fc.string({ minLength: 10, maxLength: 1000 }),
            // Simulate uploaded files
            files: fc.array(
              fc.record({
                filename: fc.stringOf(
                  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
                  { minLength: 1, maxLength: 20 }
                ).map(s => s + '.txt'),
                content: fc.string({ minLength: 0, maxLength: 500 })
              }),
              { minLength: 1, maxLength: 5 }
            )
          }),
          async (data) => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            // Session 1: Create data
            const manager1 = new DataDirectoryManager(tempDir);
            await manager1.initialize();

            // Write database file
            const dbPath = manager1.getDatabasePath();
            fs.writeFileSync(dbPath, data.dbContent);

            // Write uploaded files
            const uploadsPath = manager1.getUploadsPath();
            for (const file of data.files) {
              const filePath = path.join(uploadsPath, file.filename);
              fs.writeFileSync(filePath, file.content);
            }

            // Verify data exists in session 1
            expect(fs.existsSync(dbPath)).toBe(true);
            expect(manager1.databaseExists()).toBe(true);

            // Session 2: Restart (create new manager instance)
            const manager2 = new DataDirectoryManager(tempDir);
            await manager2.initialize();

            // Verify database persisted
            expect(manager2.databaseExists()).toBe(true);
            const persistedDbContent = fs.readFileSync(manager2.getDatabasePath(), 'utf8');
            expect(persistedDbContent).toBe(data.dbContent);

            // Verify uploaded files persisted
            const persistedUploadsPath = manager2.getUploadsPath();
            for (const file of data.files) {
              const filePath = path.join(persistedUploadsPath, file.filename);
              expect(fs.existsSync(filePath)).toBe(true);
              const persistedContent = fs.readFileSync(filePath, 'utf8');
              expect(persistedContent).toBe(file.content);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any data directory, paths should remain consistent across restarts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            // Session 1
            const manager1 = new DataDirectoryManager(tempDir);
            await manager1.initialize();

            const paths1 = manager1.getAllPaths();

            // Session 2
            const manager2 = new DataDirectoryManager(tempDir);
            await manager2.initialize();

            const paths2 = manager2.getAllPaths();

            // All paths should be identical
            expect(paths2.root).toBe(paths1.root);
            expect(paths2.database).toBe(paths1.database);
            expect(paths2.uploads).toBe(paths1.uploads);
            expect(paths2.logs).toBe(paths1.logs);
            expect(paths2.backups).toBe(paths1.backups);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any database file, it should persist across multiple restarts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 500 }),
          async (dbContent) => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            // Create and write database
            const manager1 = new DataDirectoryManager(tempDir);
            await manager1.initialize();
            fs.writeFileSync(manager1.getDatabasePath(), dbContent);

            // Restart multiple times
            for (let i = 0; i < 3; i++) {
              const manager = new DataDirectoryManager(tempDir);
              await manager.initialize();

              // Database should still exist with same content
              expect(manager.databaseExists()).toBe(true);
              const content = fs.readFileSync(manager.getDatabasePath(), 'utf8');
              expect(content).toBe(dbContent);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any uploaded files, they should persist across multiple restarts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              filename: fc.stringOf(
                fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
                { minLength: 1, maxLength: 20 }
              ).map(s => s + '.txt'),
              content: fc.string({ minLength: 0, maxLength: 200 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (files) => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            // Create and write files
            const manager1 = new DataDirectoryManager(tempDir);
            await manager1.initialize();

            for (const file of files) {
              const filePath = path.join(manager1.getUploadsPath(), file.filename);
              fs.writeFileSync(filePath, file.content);
            }

            // Restart multiple times
            for (let i = 0; i < 3; i++) {
              const manager = new DataDirectoryManager(tempDir);
              await manager.initialize();

              // All files should still exist with same content
              for (const file of files) {
                const filePath = path.join(manager.getUploadsPath(), file.filename);
                expect(fs.existsSync(filePath)).toBe(true);
                const content = fs.readFileSync(filePath, 'utf8');
                expect(content).toBe(file.content);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any data modifications, changes should persist after restart', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialContent: fc.string({ minLength: 10, maxLength: 200 }),
            modifiedContent: fc.string({ minLength: 10, maxLength: 200 })
          }).filter(data => data.initialContent !== data.modifiedContent), // Ensure they're different
          async (data) => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            // Session 1: Create initial data
            const manager1 = new DataDirectoryManager(tempDir);
            await manager1.initialize();
            fs.writeFileSync(manager1.getDatabasePath(), data.initialContent);

            // Session 2: Modify data
            const manager2 = new DataDirectoryManager(tempDir);
            await manager2.initialize();
            fs.writeFileSync(manager2.getDatabasePath(), data.modifiedContent);

            // Session 3: Verify modifications persisted
            const manager3 = new DataDirectoryManager(tempDir);
            await manager3.initialize();
            const content = fs.readFileSync(manager3.getDatabasePath(), 'utf8');
            expect(content).toBe(data.modifiedContent);
            expect(content).not.toBe(data.initialContent);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any directory structure, it should persist across restarts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            // Session 1: Initialize
            const manager1 = new DataDirectoryManager(tempDir);
            await manager1.initialize();

            // Verify directories exist
            expect(fs.existsSync(manager1.getUploadsPath())).toBe(true);
            expect(fs.existsSync(manager1.getLogsPath())).toBe(true);
            expect(fs.existsSync(manager1.getBackupsPath())).toBe(true);

            // Session 2: Restart
            const manager2 = new DataDirectoryManager(tempDir);
            await manager2.initialize();

            // All directories should still exist
            expect(fs.existsSync(manager2.getUploadsPath())).toBe(true);
            expect(fs.existsSync(manager2.getLogsPath())).toBe(true);
            expect(fs.existsSync(manager2.getBackupsPath())).toBe(true);

            // Paths should be the same
            expect(manager2.getUploadsPath()).toBe(manager1.getUploadsPath());
            expect(manager2.getLogsPath()).toBe(manager1.getLogsPath());
            expect(manager2.getBackupsPath()).toBe(manager1.getBackupsPath());
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any empty data directory, restart should not lose directory structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            // Session 1: Initialize but don't create any data
            const manager1 = new DataDirectoryManager(tempDir);
            await manager1.initialize();

            // Session 2: Restart
            const manager2 = new DataDirectoryManager(tempDir);
            await manager2.initialize();

            // Directory structure should still exist
            expect(fs.existsSync(manager2.getRootPath())).toBe(true);
            expect(fs.existsSync(manager2.getUploadsPath())).toBe(true);
            expect(fs.existsSync(manager2.getLogsPath())).toBe(true);
            expect(fs.existsSync(manager2.getBackupsPath())).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any data in subdirectories, it should persist correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            logContent: fc.string({ minLength: 10, maxLength: 200 }),
            backupContent: fc.string({ minLength: 10, maxLength: 200 })
          }),
          async (data) => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            // Session 1: Create data in subdirectories
            const manager1 = new DataDirectoryManager(tempDir);
            await manager1.initialize();

            const logFile = path.join(manager1.getLogsPath(), 'test.log');
            const backupFile = path.join(manager1.getBackupsPath(), 'test.backup');

            fs.writeFileSync(logFile, data.logContent);
            fs.writeFileSync(backupFile, data.backupContent);

            // Session 2: Restart and verify
            const manager2 = new DataDirectoryManager(tempDir);
            await manager2.initialize();

            const persistedLogFile = path.join(manager2.getLogsPath(), 'test.log');
            const persistedBackupFile = path.join(manager2.getBackupsPath(), 'test.backup');

            expect(fs.existsSync(persistedLogFile)).toBe(true);
            expect(fs.existsSync(persistedBackupFile)).toBe(true);

            const logContent = fs.readFileSync(persistedLogFile, 'utf8');
            const backupContent = fs.readFileSync(persistedBackupFile, 'utf8');

            expect(logContent).toBe(data.logContent);
            expect(backupContent).toBe(data.backupContent);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
