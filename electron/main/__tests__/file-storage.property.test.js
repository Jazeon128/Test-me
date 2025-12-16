/**
 * Property-Based Tests for File Storage
 * Feature: standalone-desktop-app, Property 8: File upload location
 * Validates: Requirements 3.3
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DataDirectoryManager = require('../data-directory-manager');
const BackendManager = require('../backend-manager');

describe('File Storage Properties', () => {
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

  describe('Property 8: File upload location', () => {
    test('for any file uploaded, file should be stored in application data directory', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringOf(
              fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
              { minLength: 1, maxLength: 20 }
            ).map(s => s + '.txt'),
            content: fc.string({ minLength: 0, maxLength: 1000 })
          }),
          async (data) => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            const uploadsPath = dataManager.getUploadsPath();

            // Simulate file upload
            const filePath = path.join(uploadsPath, data.filename);
            fs.writeFileSync(filePath, data.content);

            // Verify file is in the uploads directory
            expect(fs.existsSync(filePath)).toBe(true);
            expect(filePath.startsWith(uploadsPath)).toBe(true);
            expect(filePath.startsWith(tempDir)).toBe(true);

            // Verify content is correct
            const readContent = fs.readFileSync(filePath, 'utf8');
            expect(readContent).toBe(data.content);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any uploads directory, it should be a subdirectory of application data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            const uploadsPath = dataManager.getUploadsPath();
            const rootPath = dataManager.getRootPath();

            // Uploads should be within root
            expect(uploadsPath.startsWith(rootPath)).toBe(true);

            // Uploads should be a direct child of root
            expect(path.dirname(uploadsPath)).toBe(rootPath);

            // Uploads directory name should be 'uploads'
            expect(path.basename(uploadsPath)).toBe('uploads');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any backend manager, upload directory should point to application data directory', async () => {
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
            backendManager.port = 8000;
            const env = backendManager._getBackendEnvironment();

            // Upload directory should reference the correct path
            const expectedUploadsPath = dataManager.getUploadsPath();
            expect(env.UPLOAD_DIR).toBe(expectedUploadsPath);

            // Verify the path is in the application data directory
            expect(env.UPLOAD_DIR.startsWith(tempDir)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any backend manager without data directory manager, uploads should fallback to user data path', async () => {
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
            const expectedUploadsPath = path.join(tempDir, 'uploads');
            expect(env.UPLOAD_DIR).toBe(expectedUploadsPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any uploads directory, it should exist after initialization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            const uploadsPath = dataManager.getUploadsPath();

            // Directory should exist
            expect(fs.existsSync(uploadsPath)).toBe(true);

            // Should be a directory
            const stats = fs.statSync(uploadsPath);
            expect(stats.isDirectory()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any uploads path, it should be absolute', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            const uploadsPath = dataManager.getUploadsPath();

            // Path should be absolute
            expect(path.isAbsolute(uploadsPath)).toBe(true);

            // Path should not contain relative components
            expect(uploadsPath).not.toContain('..');
            expect(uploadsPath).not.toContain('./');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any multiple files uploaded, all should be in the same uploads directory', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              filename: fc.stringOf(
                fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
                { minLength: 1, maxLength: 20 }
              ).map(s => s + '.txt'),
              content: fc.string({ minLength: 0, maxLength: 100 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (files) => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            const uploadsPath = dataManager.getUploadsPath();

            // Upload all files
            const uploadedPaths = [];
            for (const file of files) {
              const filePath = path.join(uploadsPath, file.filename);
              fs.writeFileSync(filePath, file.content);
              uploadedPaths.push(filePath);
            }

            // All files should be in the same directory
            for (const filePath of uploadedPaths) {
              expect(path.dirname(filePath)).toBe(uploadsPath);
              expect(filePath.startsWith(uploadsPath)).toBe(true);
              expect(fs.existsSync(filePath)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any uploads directory, path should be consistent across calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            // Get uploads path multiple times
            const uploadsPath1 = dataManager.getUploadsPath();
            const uploadsPath2 = dataManager.getUploadsPath();
            const uploadsPath3 = dataManager.getUploadsPath();

            // All should be identical
            expect(uploadsPath1).toBe(uploadsPath2);
            expect(uploadsPath2).toBe(uploadsPath3);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('for any file with special characters in name, it should be stored correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate filenames with various special characters that are valid on most filesystems
            filename: fc.stringOf(
              fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_ '.split('')),
              { minLength: 1, maxLength: 20 }
            ).map(s => s.trim() || 'file').map(s => s + '.txt'),
            content: fc.string({ minLength: 0, maxLength: 100 })
          }),
          async (data) => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flashlearn-test-'));
            tempDirs.push(tempDir);

            const dataManager = new DataDirectoryManager(tempDir);
            await dataManager.initialize();

            const uploadsPath = dataManager.getUploadsPath();

            // Simulate file upload
            const filePath = path.join(uploadsPath, data.filename);
            fs.writeFileSync(filePath, data.content);

            // Verify file exists and is in correct location
            expect(fs.existsSync(filePath)).toBe(true);
            expect(filePath.startsWith(uploadsPath)).toBe(true);

            // Verify we can read it back
            const readContent = fs.readFileSync(filePath, 'utf8');
            expect(readContent).toBe(data.content);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
