const http = require('http');
const { ipcMain } = require('electron');
const { setupIpcHandlers } = require('../ipc-handlers');

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));

describe('onboarding backend settings', () => {
  let server;
  let handlers;
  let settingsManager;
  let backendManager;
  let received;
  let status;
  let responseBody;

  beforeEach(async () => {
    received = [];
    status = 200;
    responseBody = { success: true };
    server = http.createServer((request, response) => {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        received.push({ method: request.method, url: request.url, body: JSON.parse(body) });
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(responseBody));
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    handlers = {};
    ipcMain.handle.mockImplementation((channel, handler) => { handlers[channel] = handler; });
    settingsManager = { setApiKey: jest.fn() };
    backendManager = { getPort: () => server.address().port, restart: jest.fn() };
    setupIpcHandlers({ settingsManager, backendManager });
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  test.each([['google', 'gemini'], ['openai', 'openai'], ['anthropic', 'anthropic']])(
    'saves %s to the backend as %s', async (provider, mappedProvider) => {
      const result = await handlers['set-api-key'](null, { provider, key: 'test-provider-key' });
      expect(result.success).toBe(true);
      expect(settingsManager.setApiKey).toHaveBeenCalledWith(provider, 'test-provider-key');
      expect(received).toEqual([{
        method: 'POST', url: '/api/settings/ai-config',
        body: { provider: mappedProvider, api_key: 'test-provider-key' },
      }]);
    }
  );

  test.each([{ detail: 'Invalid provider key' }, { error: { message: 'Invalid provider key' } }])(
    'returns the backend 400 message: %j', async (body) => {
      status = 400;
      responseBody = body;
      const result = await handlers['set-api-key'](null, { provider: 'google', key: 'test-provider-key' });
      expect(result).toEqual({ success: false, error: 'Invalid provider key' });
      expect(settingsManager.setApiKey).toHaveBeenCalledWith('google', 'test-provider-key');
    }
  );

  test('both port handlers include the API prefix and compatibility alias', async () => {
    for (const channel of ['get-backend-port', 'restart-backend']) {
      const result = await handlers[channel]();
      const baseURL = `http://127.0.0.1:${backendManager.getPort()}/api`;
      expect(result.data).toEqual({ port: backendManager.getPort(), baseURL, baseUrl: baseURL });
    }
  });
});
