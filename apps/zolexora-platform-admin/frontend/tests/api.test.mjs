import test from 'node:test';
import assert from 'node:assert';
import {
  fetchSystemHealth,
  fetchDatabaseHealth,
  fetchAccounts,
  fetchCapacityTelemetry,
  fetchEmailQuotas,
  fetchEmailLogs,
  fetchFleetOverview,
} from '../src/lib/api.ts';

test('fetchSystemHealth returns structured status payload', async () => {
  const health = await fetchSystemHealth();
  assert.ok(health.service === 'platform-admin-backend');
  assert.ok(['ok', 'degraded', 'unhealthy'].includes(health.status));
  assert.ok(typeof health.timestamp === 'string');
});

test('fetchDatabaseHealth returns consolidated database targets without throwing', async () => {
  const dbHealth = await fetchDatabaseHealth();
  assert.ok(['healthy', 'degraded', 'unhealthy'].includes(dbHealth.overall_status));
  assert.ok(dbHealth.targets.supabase_core);
  assert.ok(dbHealth.targets.supabase_commerce);
  assert.ok(dbHealth.targets.supabase_business);
  assert.ok(dbHealth.targets.supabase_ai_erp);
  assert.ok(dbHealth.targets.mongodb_atlas);
});

test('fetchAccounts returns discovered accounts and alerts', async () => {
  const accountsRes = await fetchAccounts();
  assert.ok(Array.isArray(accountsRes.accounts));
  assert.ok(accountsRes.total_count >= 1);
  assert.ok(Array.isArray(accountsRes.alerts));
  const hasMissingAlert = accountsRes.alerts.some(
    (a) => a.event === 'ROUTER_CREDENTIAL_MISSING'
  );
  assert.ok(hasMissingAlert, 'Expected diagnostic alert for missing credentials');
});

test('fetchCapacityTelemetry returns 500MB PG and 512MB Mongo quotas with hot tables', async () => {
  const telemetry = await fetchCapacityTelemetry();
  assert.ok(Array.isArray(telemetry.databases));
  assert.strictEqual(telemetry.databases.length, 5);

  const pgCore = telemetry.databases.find((d) => d.project_or_cluster === 'core');
  assert.ok(pgCore);
  assert.strictEqual(pgCore.free_tier_limit_bytes, 524288000); // 500MB

  const mongo = telemetry.databases.find((d) => d.service === 'mongodb_atlas');
  assert.ok(mongo);
  assert.strictEqual(mongo.free_tier_limit_bytes, 536870912); // 512MB

  assert.ok(Array.isArray(telemetry.hot_tables));
  assert.ok(telemetry.hot_tables.some((t) => t.table_name === 'products' && t.schema_name === 'ims'));
  assert.ok(telemetry.hot_tables.some((t) => t.table_name === 'shipments' && t.schema_name === 'tms'));
});

test('fetchEmailQuotas returns Resend (100), Brevo (300), SendGrid (100)', async () => {
  const quotas = await fetchEmailQuotas();
  assert.ok(Array.isArray(quotas.providers));
  assert.strictEqual(quotas.providers.length, 3);

  const resend = quotas.providers.find((p) => p.provider === 'resend');
  assert.strictEqual(resend?.daily_limit, 100);

  const brevo = quotas.providers.find((p) => p.provider === 'brevo');
  assert.strictEqual(brevo?.daily_limit, 300);

  const sendgrid = quotas.providers.find((p) => p.provider === 'sendgrid');
  assert.strictEqual(sendgrid?.daily_limit, 100);
});

test('fetchFleetOverview returns microservices across P1 and P2', async () => {
  const fleet = await fetchFleetOverview();
  assert.ok(Array.isArray(fleet));
  const p1Services = fleet.filter((s) => s.environment.startsWith('Production-1'));
  const p2Services = fleet.filter((s) => s.environment.startsWith('Production-2'));

  assert.ok(p1Services.length >= 5, 'Production-1 services present');
  assert.ok(p2Services.length >= 2, 'Production-2 K3s services present');
});
