import API from './api';

test('uses the new shared FastAPI backend by default', () => {
  expect(API.defaults.baseURL).toBe('http://localhost:4100/api');
});
