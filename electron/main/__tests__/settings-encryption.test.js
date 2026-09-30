const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

let mockSettingsDirectory;
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => mockSettingsDirectory),
    getVersion: () => '0.1.0'
  },
  ipcMain: { on: jest.fn() }
}));
jest.mock('node-machine-id', () => ({ machineIdSync: jest.fn() }));
// Use real encrypted files, including when reproducing the old constructor.
jest.mock('electron-store', () => {
  const Store = jest.requireActual('electron-store');
  return class extends Store {
    constructor(options) {
      super({ ...options, cwd: options.cwd || mockSettingsDirectory });
    }
  };
});

const Store = require('electron-store');
const { machineIdSync } = require('node-machine-id');
let SettingsManager;
const LEGACY_KEY = 'flashlearn-default-encryption-key-32';
const machineKey = id => crypto.createHash('sha256')
  .update('test-me-settings:' + id).digest('hex').slice(0, 32);

describe('settings encryption and migration', () => {
  let cwd;
  let warning;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-encryption-'));
    mockSettingsDirectory = cwd;
    machineIdSync.mockReset().mockReturnValue('fake-machine-id');
    // Give each test a fresh process-level key cache.
    jest.isolateModules(() => {
      SettingsManager = require('../settings-manager');
    });
    warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warning.mockRestore();
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  test('derives a stable non-legacy key from the raw machine id', () => {
    const manager = new SettingsManager({ cwd });
    manager.set('theme', 'dark');
    manager.setSecure('apiKeys.openai', 'fake-openai-key');
    expect(machineIdSync).toHaveBeenCalledWith(true);
    expect(machineKey('fake-machine-id')).not.toBe(LEGACY_KEY);
    expect(new Store({ cwd, name: 'settings', encryptionKey: machineKey('fake-machine-id') })
      .get('theme')).toBe('dark');
    const next = new SettingsManager({ cwd });
    expect(next.get('theme')).toBe('dark');
    expect(next.getSecure('apiKeys.openai')).toBe('fake-openai-key');
    expect(fs.existsSync(path.join(cwd, 'settings-key'))).toBe(false);
  });

  test('migrates every entry in both legacy stores and runs only once', () => {
    const settings = new Store({ cwd, name: 'settings', encryptionKey: LEGACY_KEY });
    settings.store = { theme: 'dark', autoUpdate: false, custom: { nested: [1, 2] }, 'literal.key': 'fake-value' };
    const secure = new Store({ cwd, name: 'secure-settings', encryptionKey: LEGACY_KEY });
    secure.store = { apiKeys: { openai: 'fake-openai-key', anthropic: 'fake-anthropic-key', google: 'fake-google-key' }, other: { token: 'fake-token' } };
    const savedSettings = settings.store;
    const savedSecure = secure.store;

    const manager = new SettingsManager({ cwd });
    expect(manager.getAll()).toEqual({ ...manager._getDefaultSettings(), ...savedSettings });
    expect(manager.secureStore.store).toEqual(savedSecure);
    expect(manager.getApiKeys()).toEqual(savedSecure.apiKeys);
    for (const name of ['settings', 'secure-settings']) {
      expect(() => new Store({ cwd, name, encryptionKey: LEGACY_KEY, clearInvalidConfig: false })).toThrow();
    }
    const files = [manager.getPath(), manager.getSecurePath()];
    const contents = files.map(file => fs.readFileSync(file));
    const next = new SettingsManager({ cwd });
    expect(next.getAll()).toEqual(manager.getAll());
    expect(next.secureStore.store).toEqual(savedSecure);
    expect(files.map(file => fs.readFileSync(file))).toEqual(contents);
    expect(warning).not.toHaveBeenCalled();
  });

  test('constructing two managers calls machineIdSync once across directories', () => {
    const first = new SettingsManager({ cwd });
    first.setSecure('apiKeys.openai', 'fake-first-key');
    const otherCwd = path.join(cwd, 'other-directory');
    const second = new SettingsManager({ cwd: otherCwd });
    second.setSecure('apiKeys.openai', 'fake-second-key');
    expect(machineIdSync).toHaveBeenCalledTimes(1);
    expect(machineIdSync).toHaveBeenCalledWith(true);
    for (const directory of [cwd, otherCwd]) {
      expect(new Store({ cwd: directory, name: 'secure-settings', encryptionKey: machineKey('fake-machine-id') })
        .get('apiKeys.openai')).toBe(directory === cwd ? 'fake-first-key' : 'fake-second-key');
    }
  });

  test.each(['settings', 'secure-settings'])('preserves unreadable %s and starts with defaults', name => {
    const file = path.join(cwd, `${name}.json`);
    const unreadable = Buffer.from('obviously unreadable fake settings');
    fs.writeFileSync(file, unreadable);
    let manager;
    expect(() => { manager = new SettingsManager({ cwd }); }).not.toThrow();
    expect(manager.getAll()).toEqual(manager._getDefaultSettings());
    expect(manager.secureStore.store).toEqual({});
    const backups = fs.readdirSync(cwd).filter(entry => entry.startsWith(`${name}.json.unreadable-`));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/\.unreadable-\d+$/);
    expect(fs.readFileSync(path.join(cwd, backups[0]))).toEqual(unreadable);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  test('creates a private random fallback key once and reuses it', () => {
    machineIdSync.mockImplementation(() => { throw new Error('fake machine-id failure'); });
    const manager = new SettingsManager({ cwd });
    manager.setSecure('apiKeys.openai', 'fake-openai-key');
    const keyFile = path.join(cwd, 'settings-key');
    const key = fs.readFileSync(keyFile, 'utf8');
    const stat = fs.statSync(keyFile);
    expect(key).toMatch(/^[a-f0-9]{32}$/);
    expect(key).not.toBe(LEGACY_KEY);
    if (process.platform !== 'win32') expect(stat.mode & 0o777).toBe(0o600);
    const next = new SettingsManager({ cwd });
    expect(next.getSecure('apiKeys.openai')).toBe('fake-openai-key');
    expect(machineIdSync).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(keyFile, 'utf8')).toBe(key);
    expect(fs.statSync(keyFile).mtimeMs).toBe(stat.mtimeMs);
    expect(new Store({ cwd, name: 'secure-settings', encryptionKey: key }).get('apiKeys.openai'))
      .toBe('fake-openai-key');
  });

  test('an explicit key skips generation and migration', () => {
    new Store({ cwd, name: 'settings', encryptionKey: LEGACY_KEY }).set('theme', 'dark');
    const manager = new SettingsManager({ cwd, encryptionKey: LEGACY_KEY });
    expect(manager.get('theme')).toBe('dark');
    expect(machineIdSync).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(cwd, 'settings-key'))).toBe(false);
    const before = fs.readFileSync(manager.getPath());
    expect(() => new SettingsManager({ cwd, encryptionKey: 'fake-wrong-explicit-key' })).toThrow();
    expect(fs.readFileSync(manager.getPath())).toEqual(before);
    expect(fs.readdirSync(cwd).some(file => file.includes('.unreadable-'))).toBe(false);
  });
});
