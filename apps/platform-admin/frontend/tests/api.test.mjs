import test, { beforeEach } from 'node:test';
import assert from 'node:assert';
import { SESSION_EXPIRED_EVENT, SESSION_STORAGE_KEY } from '@zolexora/auth-client';
import { createConnection, deleteConnection, fetchAccounts, fetchDatabaseHealth, fetchEmailQuotas, fetchSystemHealth } from '../src/lib/api.ts';

let calls;
let events;
let nextResponse;

// Minimal browser: localStorage with a signed-in admin session, and an event sink.
beforeEach(() => {
  calls = [];
  events = [];
  nextResponse = { status: 200, body: {} };
  const store = { [SESSION_STORAGE_KEY]: JSON.stringify({ token: 'admin-token' }) };
  globalThis.window = {
    localStorage: { getItem: (k) => store[k] ?? null },
    dispatchEvent: (e) => events.push(e.type),
  };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const { status, body } = nextResponse;
    if (status === 0) throw new TypeError('fetch failed');
    return { ok: status < 400, status, json: async () => body, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
  };
});

test('calls the API on the same origin with the admin bearer token', async () => {
  nextResponse.body = { providers: [], timestamp: 't' };
  await fetchEmailQuotas();
  assert.strictEqual(calls[0].url, '/api/email/quotas');
  assert.strictEqual(calls[0].headers.Authorization, 'Bearer admin-token');
});

test('no session means no Authorization header', async () => {
  globalThis.window.localStorage.getItem = () => null;
  await fetchEmailQuotas();
  assert.strictEqual(calls[0].headers.Authorization, undefined);
});

test('401 sends the user back to the login form', async () => {
  nextResponse = { status: 401, body: { detail: 'Invalid or expired session' } };
  const res = await fetchAccounts();
  assert.deepStrictEqual(events, [SESSION_EXPIRED_EVENT]);
  assert.strictEqual(res.accounts.length, 0);
});

test('403 does not sign the user out', async () => {
  nextResponse = { status: 403, body: {} };
  await fetchAccounts();
  assert.deepStrictEqual(events, []);
});

test('backend offline: health helpers degrade instead of throwing', async () => {
  nextResponse = { status: 0 };
  const health = await fetchSystemHealth();
  assert.strictEqual(health.status, 'degraded');
  const db = await fetchDatabaseHealth();
  assert.strictEqual(db.overall_status, 'degraded');
  assert.deepStrictEqual(db.targets, {});
});

test('delete connection handles 204 No Content', async () => {
  nextResponse = { status: 204, body: undefined };
  assert.strictEqual(await deleteConnection('abc'), undefined);
  assert.strictEqual(calls[0].url, '/api/connections/abc');
});

test('backend error detail reaches the form', async () => {
  nextResponse = { status: 422, body: { detail: 'Missing: API key' } };
  await assert.rejects(createConnection({ provider: 'supabase', name: 'x', keys: {} }), /Missing: API key/);
});
