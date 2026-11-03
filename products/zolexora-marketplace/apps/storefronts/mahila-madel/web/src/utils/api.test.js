jest.mock('@zolexora/marketplace-sign-in', () => ({
  storedSessionToken: () => 'session-token',
  expireStoredSession: jest.fn(),
}));

beforeAll(() => {
  window.__ENV__ = { MARKETPLACE_API_URL: 'https://api.example.test/api/' };
});

test('sends requests to the configured API with the auth-service session', async () => {
  const { default: API } = await import('./api');
  const [interceptor] = API.interceptors.request.handlers;
  const config = interceptor.fulfilled({ headers: {} });
  expect(config.baseURL).toBe('https://api.example.test/api');
  expect(config.headers.Authorization).toBe('Bearer session-token');
  expect(config.headers['X-Storefront-Key']).toBe('mahila-madel');
});
