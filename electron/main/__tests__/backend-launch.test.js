const path = require('path');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const BackendManager = require('../backend-manager');

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('http', () => ({ request: jest.fn() }));
jest.mock('electron', () => ({ app: {} }));

describe('Backend launch and health', () => {
  const backendDir = path.resolve(__dirname, '../../../backend');
  let manager;
  let originalEnv;
  let originalPlatform;
  let statusCode;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    originalEnv = process.env.NODE_ENV;
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.NODE_ENV = 'development';
    manager = new BackendManager('/test/user-data');
    jest.spyOn(manager, '_findAvailablePort').mockResolvedValue(8000);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    statusCode = 200;
    spawn.mockImplementation(() => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.killed = false;
      return child;
    });
    http.request.mockImplementation((options, callback) => {
      const req = new EventEmitter();
      req.end = jest.fn(() => callback({ statusCode }));
      req.destroy = jest.fn();
      return req;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    Object.defineProperty(process, 'platform', originalPlatform);
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  });

  test('development launches venv Python with main.py and backend cwd', async () => {
    await expect(manager.start()).resolves.toBe(8000);
    expect(fs.existsSync).toHaveBeenCalledWith(path.join(backendDir, '.venv', 'Scripts', 'python.exe'));
    expect(spawn).toHaveBeenCalledWith(
      path.join(backendDir, '.venv', 'Scripts', 'python.exe'), ['main.py'],
      expect.objectContaining({ cwd: backendDir, env: expect.objectContaining({ PORT: '8000', HOST: '127.0.0.1' }) })
    );
  });

  test('development falls back to python when the venv is absent', async () => {
    fs.existsSync.mockReturnValue(false);
    await manager.start();
    expect(spawn).toHaveBeenCalledWith('python', ['main.py'], expect.objectContaining({ cwd: backendDir }));
  });

  test('development uses bin/python and falls back to python3 on Unix', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    await manager.start();
    expect(spawn).toHaveBeenCalledWith(path.join(backendDir, '.venv', 'bin', 'python'), ['main.py'], expect.objectContaining({ cwd: backendDir }));
    fs.existsSync.mockReturnValue(false);
    expect(manager._getBackendPath()).toBe('python3');
  });

  test('production preserves bundled executable launch', async () => {
    process.env.NODE_ENV = 'production';
    const executable = manager._getBackendPath();
    await manager.start();
    expect(spawn).toHaveBeenCalledWith(executable, [], expect.objectContaining({ cwd: path.dirname(executable) }));
  });

  test('health requests GET /health and accepts HTTP 200', async () => {
    manager.port = 8000;
    await expect(manager._checkHealth()).resolves.toBe(true);
    expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ path: '/health', method: 'GET', port: 8000 }), expect.any(Function));
  });

  test('HTTP 404 is unhealthy', async () => {
    statusCode = 404;
    await expect(manager._checkHealth()).resolves.toBe(false);
  });

  test('start rejects after all retries without a 200, including an existing process', async () => {
    statusCode = 404;
    manager.maxHealthCheckRetries = 2;
    const rejected = expect(manager.start()).rejects.toThrow('Failed to start backend after 3 attempts: Backend health check timeout');
    await jest.runAllTimersAsync();
    await rejected;
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledTimes(6);
    expect(manager.isStarting).toBe(false);
  });

  test('start checks health before accepting an existing process', async () => {
    manager.process = new EventEmitter();
    manager.port = 8001;
    await expect(manager.start()).resolves.toBe(8001);
    expect(spawn).not.toHaveBeenCalled();
    expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ path: '/health', port: 8001 }), expect.any(Function));
  });
});
