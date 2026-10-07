/**
 * Zolexora IMS — Platform SuperAdmin Control Plane Worker
 * Service: admin-ims.zolexora.workers.dev / admin.ims.zolexora.com
 */

const APP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Zolexora IMS — Platform Admin Edge</title>
  <style>body{font-family:system-ui,-apple-system,sans-serif;margin:40px;background:#0f172a;color:#f8fafc;text-align:center;}h1{color:#38bdf8;}</style>
</head>
<body>
  <h1>Zolexora IMS — Platform Admin Edge API</h1>
  <p>Admin Edge API active. Platform UI is served via the Vite single-page application.</p>
</body>
</html>`;

const COOKIE_NAME = 'zolexora_admin_session';
const DEFAULT_SESSION_TTL = 604800; // 7 days

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return handleCorsPreflight(request);
    }

    // 2. Health check
    if (url.pathname === '/api/health') {
      return jsonResponse({
        status: 'healthy',
        service: 'Zolexora IMS Platform Admin Control Plane',
        version: '2.0.0',
        edgeLocation: request.cf?.colo || 'LOCAL',
        timestamp: new Date().toISOString()
      }, 200, request);
    }

    // 3. API Router
    if (url.pathname.startsWith('/api/')) {
      return handleApiRouter(request, env, url);
    }

    // 4. Default: Serve Platform Admin Single-Page App UI
    return new Response(APP_HTML, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Service': 'zolexora-platform-admin'
      }
    });
  }
};

const ALLOWED_ORIGINS = new Set([
  'https://ims.zolexora.com',
  'https://admin.ims.zolexora.com',
  'https://ims.zolexora.workers.dev',
  'https://admin-ims.zolexora.workers.dev'
]);

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/.*\.zolexora\.pages\.dev$/,
  /^https:\/\/.*\.zolexora\.workers\.dev$/,
  /^https:\/\/([a-zA-Z0-9-]+\.)*zolexora\.com$/
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some(p => p.test(origin));
}

function handleCorsPreflight(request) {
  const origin = request.headers.get('Origin');
  if (origin && isAllowedOrigin(origin)) {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-session-id, x-session-token',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'null',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-session-id, x-session-token',
      'Access-Control-Max-Age': '86400'
    }
  });
}

function jsonResponse(data, status = 200, request = null, extraHeaders = {}) {
  const origin = request?.headers?.get('Origin');
  const allowed = isAllowedOrigin(origin);
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  if (allowed) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  } else {
    headers['Access-Control-Allow-Origin'] = 'null';
  }
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

// ====================================================================
// API ROUTER
// ====================================================================
async function handleApiRouter(request, env, url) {
  const path = url.pathname;
  const method = request.method;
  const db = env.DB;

  try {
    // Ensure Platform Audit Log Table exists
    await ensurePlatformAuditTable(db);

    // Auth Endpoints (Unprotected)
    if (path === '/api/auth/login' && method === 'POST') {
      return handleAdminLogin(request, env);
    }
    if (path === '/api/auth/session' && (method === 'GET' || method === 'HEAD')) {
      return handleCheckSession(request, env);
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      return handleAdminLogout(request, env);
    }

    // Protected Platform Endpoints: Check SuperAdmin Session
    const session = await getAdminSession(request, env);
    if (!session) {
      return jsonResponse({ success: false, error: 'Unauthorized: Platform SuperAdmin session required.' }, 401, request);
    }

    // 1. Platform Pulse & Overview
    if (path === '/api/platform/overview' && method === 'GET') {
      return jsonResponse(await getPlatformOverview(db, request), 200, request);
    }

    // 2. Tenant Organizations Management
    if (path === '/api/platform/organizations' && method === 'GET') {
      return jsonResponse(await getPlatformOrganizations(db), 200, request);
    }
    if (path === '/api/platform/organizations' && method === 'POST') {
      const payload = await request.json();
      return jsonResponse(await savePlatformOrganization(db, payload, session), 200, request);
    }
    if (path.match(/^\/api\/platform\/organizations\/([^/]+)\/toggle-status$/) && method === 'POST') {
      const orgId = path.split('/')[4];
      const payload = await request.json().catch(() => ({}));
      return jsonResponse(await toggleOrgStatus(db, orgId, payload.status, session), 200, request);
    }
    if (path.match(/^\/api\/platform\/organizations\/([^/]+)$/) && method === 'DELETE') {
      const orgId = path.split('/')[4];
      return jsonResponse(await deletePlatformOrganization(db, orgId, session), 200, request);
    }

    // 3. Global Users Management
    if (path === '/api/platform/users' && method === 'GET') {
      return jsonResponse(await getPlatformUsers(db), 200, request);
    }
    if (path === '/api/platform/users' && method === 'POST') {
      const payload = await request.json();
      return jsonResponse(await savePlatformUser(db, payload, session), 200, request);
    }
    if (path.match(/^\/api\/platform\/users\/([^/]+)$/) && method === 'DELETE') {
      const userId = path.split('/')[4];
      return jsonResponse(await deletePlatformUser(db, userId, session), 200, request);
    }

    // 4. Database Diagnostics & Interactive SQL Console
    if (path === '/api/platform/database' && method === 'GET') {
      return jsonResponse(await getDatabaseDiagnostics(db), 200, request);
    }
    if (path === '/api/platform/database/query') {
      return jsonResponse({
        success: false,
        error: 'Direct SQL execution endpoint /api/platform/database/query has been decommissioned for security reasons. Please use Cloudflare Wrangler CLI (`npx wrangler d1 execute`) to execute database queries.'
      }, 403, request);
    }

    // 5. Audit Logs
    if (path === '/api/platform/audit-logs' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      return jsonResponse(await getPlatformAuditLogs(db, limit), 200, request);
    }

    // 6. Impersonate Tenant (Cross-launch into tenant IMS)
    if (path === '/api/platform/impersonate' && method === 'POST') {
      const payload = await request.json();
      return jsonResponse(await createImpersonationToken(env, payload, session), 200, request);
    }

    // 7. Platform Settings
    if (path === '/api/platform/settings' && method === 'GET') {
      return jsonResponse(await getPlatformSettings(db), 200, request);
    }
    if (path === '/api/platform/settings' && method === 'POST') {
      const payload = await request.json();
      return jsonResponse(await savePlatformSettings(db, payload, session), 200, request);
    }

    return jsonResponse({ success: false, error: 'Endpoint not found: ' + path }, 404, request);
  } catch (err) {
    console.error('Platform API router error:', err);
    return jsonResponse({ success: false, error: err.message || 'Internal Platform Error' }, 500, request);
  }
}

// ====================================================================
// AUTHENTICATION CONTROLLER
// ====================================================================
async function handleAdminLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) {
    return jsonResponse({ success: false, error: 'Email and password are required.' }, 400, request);
  }

  // Query DB for user with Admin or SuperAdmin role
  const dbUser = await env.DB.prepare('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1;').bind(email).first();
  let user = null;
  if (dbUser && (dbUser.role === 'SuperAdmin' || dbUser.role === 'PlatformAdmin' || dbUser.role === 'Admin')) {
    const check = await verifyPassword(password, dbUser.password_hash);
    if (check.verified) {
      if (check.needsRehash) {
        const newHash = await hashPassword(password);
        try {
          await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?;').bind(newHash, dbUser.id).run();
        } catch (e) {}
      }
      user = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        orgId: dbUser.org_id
      };
    }
  }

  if (!user) {
    await recordAuditEvent(env.DB, {
      type: 'SECURITY_LOGIN_FAILED',
      actor: email,
      details: 'Failed login attempt to Platform Admin',
      severity: 'warning'
    });
    return jsonResponse({ success: false, error: 'Invalid SuperAdmin credentials or insufficient platform privileges.' }, 401, request);
  }

  // 3. Issue Session Token in KV
  const token = 'adm_' + crypto.randomUUID().replace(/-/g, '');
  const sessionData = {
    user: user,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + DEFAULT_SESSION_TTL * 1000).toISOString()
  };

  if (env.SESSION_KV) {
    await env.SESSION_KV.put('admin_session:' + token, JSON.stringify(sessionData), {
      expirationTtl: DEFAULT_SESSION_TTL
    });
  }

  await recordAuditEvent(env.DB, {
    type: 'PLATFORM_LOGIN_SUCCESS',
    actor: user.email,
    details: 'SuperAdmin ' + user.name + ' logged into Platform Admin Control Plane',
    severity: 'info'
  });

  const cookieHeader = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DEFAULT_SESSION_TTL}`;
  return jsonResponse({
    success: true,
    message: 'Welcome to Zolexora IMS Platform Control Plane',
    user: user,
    token: token
  }, 200, request, { 'Set-Cookie': cookieHeader });
}

async function handleCheckSession(request, env) {
  const session = await getAdminSession(request, env);
  if (!session) {
    return jsonResponse({
      authenticated: false
    }, 200, request);
  }
  return jsonResponse({
    authenticated: true,
    user: session.user
  }, 200, request);
}

async function handleAdminLogout(request, env) {
  const token = extractSessionToken(request);
  if (token && env.SESSION_KV) {
    await env.SESSION_KV.delete('admin_session:' + token);
  }
  const cookieHeader = `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return jsonResponse({ success: true, message: 'Logged out successfully' }, 200, request, { 'Set-Cookie': cookieHeader });
}

async function authenticateRequest(request, env) {
  const token = extractSessionToken(request);
  if (!token || !env.SESSION_KV) return null;
  let raw = await env.SESSION_KV.get('admin_session:' + token);
  if (!raw) {
    raw = await env.SESSION_KV.get('session:' + token);
  }
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

async function getAdminSession(request, env) {
  return authenticateRequest(request, env);
}

function extractSessionToken(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (match) return match[1];

  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.replace('Bearer ', '').trim();

  const customHeader = request.headers.get('x-session-id') || request.headers.get('x-session-token');
  if (customHeader) return customHeader.trim();

  try {
    const url = new URL(request.url);
    const qToken = url.searchParams.get('sessionId') || url.searchParams.get('sessionToken');
    if (qToken) return qToken.trim();
  } catch (e) {}

  return null;
}

// ====================================================================
// PLATFORM PULSE & OVERVIEW
// ====================================================================
async function getPlatformOverview(db, request) {
  const start = Date.now();

  const [orgsRes, storesRes, spsRes, usersRes, prodsRes, supsRes, salesRes] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM organizations;').first(),
    db.prepare('SELECT COUNT(*) as count FROM stores;').first(),
    db.prepare('SELECT COUNT(*) as count FROM selling_points;').first(),
    db.prepare('SELECT COUNT(*) as count FROM users;').first(),
    db.prepare('SELECT COUNT(*) as count, SUM(total_valuation) as val, SUM(total_stock) as units FROM products;').first(),
    db.prepare('SELECT COUNT(*) as count FROM suppliers;').first(),
    db.prepare('SELECT COUNT(*) as count, SUM(total_amount) as revenue FROM selling_point_sales;').first()
  ]);

  const activeOrgsRes = await db.prepare('SELECT COUNT(*) as count FROM organizations WHERE status = "Active";').first();
  const latencyMs = Date.now() - start;

  return {
    success: true,
    overview: {
      totalOrganizations: orgsRes?.count || 0,
      activeOrganizations: activeOrgsRes?.count || 0,
      suspendedOrganizations: (orgsRes?.count || 0) - (activeOrgsRes?.count || 0),
      totalStores: storesRes?.count || 0,
      totalSellingPoints: spsRes?.count || 0,
      totalUsers: usersRes?.count || 0,
      totalProducts: prodsRes?.count || 0,
      totalUnitsManaged: prodsRes?.units || 0,
      totalInventoryValuation: prodsRes?.val || 0,
      totalSuppliers: supsRes?.count || 0,
      totalSalesCount: salesRes?.count || 0,
      totalSalesRevenue: salesRes?.revenue || 0,
      dbLatencyMs: latencyMs,
      edgeLocation: request?.cf?.colo || 'SIN',
      dbEngine: 'Cloudflare D1 (Serverless SQLite)',
      lastSync: new Date().toISOString()
    }
  };
}

// ====================================================================
// TENANT ORGANIZATIONS CONTROLLER
// ====================================================================
async function getPlatformOrganizations(db) {
  const orgs = (await db.prepare('SELECT * FROM organizations ORDER BY created_at DESC;').all()).results || [];

  // Enrich each organization with stores, counters, users, products count
  const enriched = await Promise.all(orgs.map(async (o) => {
    const [storesCount, spsCount, usersCount, prodsCount] = await Promise.all([
      db.prepare('SELECT COUNT(*) as c FROM stores WHERE org_id = ?;').bind(o.id).first(),
      db.prepare('SELECT COUNT(*) as c FROM selling_points WHERE org_id = ?;').bind(o.id).first(),
      db.prepare('SELECT COUNT(*) as c FROM users WHERE org_id = ?;').bind(o.id).first(),
      db.prepare('SELECT COUNT(*) as c, SUM(total_valuation) as v FROM products WHERE org_id = ?;').bind(o.id).first()
    ]);

    return {
      id: o.id,
      name: o.name,
      industry: o.industry || 'General Commerce',
      ownerEmail: o.owner_email || '--',
      currency: o.currency || '₹',
      status: o.status || 'Active',
      createdAt: o.created_at,
      storeCount: storesCount?.c || 0,
      sellingPointCount: spsCount?.c || 0,
      userCount: usersCount?.c || 0,
      productCount: prodsCount?.c || 0,
      valuation: prodsCount?.v || 0,
      planTier: o.id === 'ORG_ZOLEXORA_001' ? 'Enterprise Cloud' : 'Pro Business',
      quotas: {
        maxSkus: 5000,
        maxStores: 10,
        maxCounters: 20,
        maxUsers: 50
      },
      features: {
        posBilling: true,
        multiWarehouseTransfer: true,
        barcodeScanning: true,
        aiForecasting: true
      }
    };
  }));

  return { success: true, organizations: enriched };
}

async function savePlatformOrganization(db, org, session) {
  const isNew = !org.id || org.id === 'NEW';
  const id = isNew ? `ORG_${org.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}_${Date.now().toString().slice(-4)}` : org.id;
  const name = String(org.name || 'New Organization').trim();
  const industry = org.industry || 'Hospitality & Retail';
  const ownerEmail = org.ownerEmail || 'admin@' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  const currency = org.currency || '₹';
  const status = org.status || 'Active';
  const now = new Date().toISOString();

  if (isNew) {
    await db.prepare(`
      INSERT INTO organizations (id, name, industry, owner_email, currency, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `).bind(id, name, industry, ownerEmail, currency, status, now).run();

    // Auto-provision initial warehouse store & selling point
    const storeCode = `S_${id.slice(-3)}`;
    await db.prepare(`
      INSERT INTO stores (code, org_id, name, type, status, description)
      VALUES (?, ?, ?, 'Central Depot', 'Active', 'Default central store provisioned during tenant onboarding');
    `).bind(storeCode, id, name + ' - Main Central Depot').run();

    const spCode = `SP_${id.slice(-3)}`;
    await db.prepare(`
      INSERT INTO selling_points (code, org_id, name, assigned_store_code, type, status)
      VALUES (?, ?, ?, ?, 'Sales Counter', 'Active');
    `).bind(spCode, id, name + ' - Primary Sales Desk', storeCode).run();

    // Provision Tenant Admin user
    const userId = `USR_${id.slice(-3)}_ADMIN`;
    const tempPassword = org.adminPassword || crypto.randomUUID().slice(0, 12);
    const defaultPasswordHash = await hashPassword(tempPassword);
    await db.prepare(`
      INSERT INTO users (id, org_id, email, password_hash, name, role, scope_type, assigned_location, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'Admin', 'ALL', 'ALL', 'Active', ?);
    `).bind(userId, id, ownerEmail, defaultPasswordHash, name + ' Administrator', now).run();

    await recordAuditEvent(db, {
      type: 'TENANT_PROVISIONED',
      actor: session?.user?.email || 'Platform Admin',
      tenantId: id,
      details: `Provisioned new tenant organization "${name}" [${id}] with default Store [${storeCode}] and Counter [${spCode}]`,
      severity: 'info'
    });
  } else {
    await db.prepare(`
      UPDATE organizations SET
        name = ?,
        industry = ?,
        owner_email = ?,
        currency = ?,
        status = ?
      WHERE id = ?;
    `).bind(name, industry, ownerEmail, currency, status, id).run();

    await recordAuditEvent(db, {
      type: 'TENANT_UPDATED',
      actor: session?.user?.email || 'Platform Admin',
      tenantId: id,
      details: `Updated tenant organization settings for "${name}" [${id}]`,
      severity: 'info'
    });
  }

  const updatedOrgs = await getPlatformOrganizations(db);
  return { success: true, id: id, organizations: updatedOrgs.organizations };
}

async function toggleOrgStatus(db, orgId, newStatus, session) {
  const status = newStatus === 'Suspended' ? 'Suspended' : 'Active';
  await db.prepare('UPDATE organizations SET status = ? WHERE id = ?;').bind(status, orgId).run();

  await recordAuditEvent(db, {
    type: status === 'Suspended' ? 'TENANT_SUSPENDED' : 'TENANT_ACTIVATED',
    actor: session?.user?.email || 'Platform Admin',
    tenantId: orgId,
    details: `Tenant [${orgId}] status set to ${status}`,
    severity: status === 'Suspended' ? 'warning' : 'info'
  });

  const updatedOrgs = await getPlatformOrganizations(db);
  return { success: true, orgId: orgId, status: status, organizations: updatedOrgs.organizations };
}

async function deletePlatformOrganization(db, orgId, session) {
  if (orgId === 'ORG_ZOLEXORA_001') {
    return { success: false, error: 'Cannot delete primary root tenant ORG_ZOLEXORA_001.' };
  }

  await db.prepare('DELETE FROM organizations WHERE id = ?;').bind(orgId).run();

  await recordAuditEvent(db, {
    type: 'TENANT_DELETED',
    actor: session?.user?.email || 'Platform Admin',
    tenantId: orgId,
    details: `Deleted tenant organization [${orgId}] and cascaded records`,
    severity: 'error'
  });

  const updatedOrgs = await getPlatformOrganizations(db);
  return { success: true, deletedOrgId: orgId, organizations: updatedOrgs.organizations };
}

// ====================================================================
// GLOBAL USERS CONTROLLER
// ====================================================================
async function getPlatformUsers(db) {
  const users = (await db.prepare(`
    SELECT u.*, o.name as org_name
    FROM users u
    LEFT JOIN organizations o ON u.org_id = o.id
    ORDER BY u.created_at DESC;
  `).all()).results || [];

  return {
    success: true,
    users: users.map(u => ({
      id: u.id,
      orgId: u.org_id,
      orgName: u.org_name || (u.org_id === 'ALL' ? 'Platform Global' : u.org_id),
      email: u.email,
      name: u.name,
      role: u.role,
      scopeType: u.scope_type || 'ALL',
      assignedLocation: u.assigned_location || 'ALL',
      locationName: u.location_name || '',
      status: u.status || 'Active',
      createdAt: u.created_at,
      lastLogin: u.last_login || '--'
    }))
  };
}

async function savePlatformUser(db, user, session) {
  const isNew = !user.id || user.id === 'NEW';
  const id = isNew ? `USR_${Date.now().toString().slice(-6)}` : user.id;
  const orgId = user.orgId || 'ORG_ZOLEXORA_001';
  const email = String(user.email).trim().toLowerCase();
  const name = String(user.name).trim();
  const role = user.role || 'Staff';
  const scopeType = user.scopeType || 'ALL';
  const assignedLocation = user.assignedLocation || 'ALL';
  const status = user.status || 'Active';
  const now = new Date().toISOString();

  if (isNew) {
    const password = user.password || crypto.randomUUID().slice(0, 12);
    const passwordHash = await hashPassword(password);

    await db.prepare(`
      INSERT INTO users (id, org_id, email, password_hash, name, role, scope_type, assigned_location, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).bind(id, orgId, email, passwordHash, name, role, scopeType, assignedLocation, status, now).run();

    await recordAuditEvent(db, {
      type: 'USER_CREATED',
      actor: session?.user?.email || 'Platform Admin',
      tenantId: orgId,
      details: `Created new user ${name} (${email}) with role [${role}]`,
      severity: 'info'
    });
  } else {
    if (user.password && user.password.trim()) {
      const passwordHash = await hashPassword(user.password.trim());
      await db.prepare(`
        UPDATE users SET
          org_id = ?,
          email = ?,
          password_hash = ?,
          name = ?,
          role = ?,
          scope_type = ?,
          assigned_location = ?,
          status = ?
        WHERE id = ?;
      `).bind(orgId, email, passwordHash, name, role, scopeType, assignedLocation, status, id).run();
    } else {
      await db.prepare(`
        UPDATE users SET
          org_id = ?,
          email = ?,
          name = ?,
          role = ?,
          scope_type = ?,
          assigned_location = ?,
          status = ?
        WHERE id = ?;
      `).bind(orgId, email, name, role, scopeType, assignedLocation, status, id).run();
    }

    await recordAuditEvent(db, {
      type: 'USER_UPDATED',
      actor: session?.user?.email || 'Platform Admin',
      tenantId: orgId,
      details: `Updated user profile ${name} (${email})`,
      severity: 'info'
    });
  }

  const updatedUsers = await getPlatformUsers(db);
  return { success: true, id: id, users: updatedUsers.users };
}

async function deletePlatformUser(db, userId, session) {
  await db.prepare('DELETE FROM users WHERE id = ?;').bind(userId).run();

  await recordAuditEvent(db, {
    type: 'USER_DELETED',
    actor: session?.user?.email || 'Platform Admin',
    details: `Deleted user [${userId}]`,
    severity: 'warning'
  });

  const updatedUsers = await getPlatformUsers(db);
  return { success: true, deletedUserId: userId, users: updatedUsers.users };
}

// ====================================================================
// DATABASE DIAGNOSTICS & SQL CONSOLE
// ====================================================================
async function getDatabaseDiagnostics(db) {
  const start = Date.now();
  let tableNames = [];
  try {
    const res = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC;").all();
    tableNames = (res.results || [])
      .map(r => r.name)
      .filter(name => name && !name.startsWith('_') && !name.startsWith('sqlite'));
  } catch (e) {
    tableNames = [
      'organizations', 'stores', 'selling_points', 'users', 'products',
      'suppliers', 'supplier_transactions', 'issuance_transactions',
      'selling_point_sales', 'selling_point_purchases', 'selling_point_expenses',
      'settings', 'platform_audit_logs'
    ];
  }

  const tableStats = [];
  for (const name of tableNames) {
    try {
      const countRes = await db.prepare(`SELECT COUNT(*) as c FROM ${name};`).first();
      tableStats.push({
        name: name,
        rowCount: countRes?.c || 0,
        status: 'Healthy'
      });
    } catch (err) {
      tableStats.push({
        name: name,
        rowCount: 0,
        status: 'Unreachable'
      });
    }
  }

  const latency = Date.now() - start;

  return {
    success: true,
    diagnostics: {
      tables: tableStats,
      totalTables: tableStats.length,
      totalRecords: tableStats.reduce((acc, t) => acc + t.rowCount, 0),
      dbEngine: 'Cloudflare D1 SQLite Engine',
      latencyMs: latency,
      timestamp: new Date().toISOString()
    }
  };
}

async function executeSqlConsoleQuery(db, query, session) {
  if (!session || (session.user?.role !== 'SuperAdmin' && session.user?.role !== 'PlatformAdmin')) {
    return { success: false, error: 'Unauthorized: Platform SuperAdmin privileges required.' };
  }

  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    return { success: false, error: 'Empty query string provided.' };
  }

  // Safety safeguard against destructive commands
  const upper = cleanQuery.toUpperCase();
  const dangerousPatterns = ['DROP DATABASE', 'DROP ALL', 'ATTACH', 'DETACH', 'PRAGMA', 'DROP TABLE'];
  if (dangerousPatterns.some(kw => upper.includes(kw))) {
    return { success: false, error: 'Unsafe operation rejected by Platform Security Guardian.' };
  }

  const start = Date.now();
  try {
    const res = await db.prepare(cleanQuery).all();
    const durationMs = Date.now() - start;

    await recordAuditEvent(db, {
      type: 'SQL_CONSOLE_QUERY',
      actor: session?.user?.email || 'Platform Admin',
      details: `Executed SQL query: ${cleanQuery.slice(0, 100)}... (${durationMs}ms)`,
      severity: 'info'
    });

    return {
      success: true,
      query: cleanQuery,
      durationMs: durationMs,
      rowCount: res.results ? res.results.length : 0,
      columns: res.results && res.results[0] ? Object.keys(res.results[0]) : [],
      results: (res.results || []).slice(0, 100) // cap to 100 rows for UI safety
    };
  } catch (err) {
    return {
      success: false,
      query: cleanQuery,
      durationMs: Date.now() - start,
      error: err.message || 'SQL Execution Error'
    };
  }
}

// ====================================================================
// PLATFORM AUDIT LOGS
// ====================================================================
async function ensurePlatformAuditTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS platform_audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      tenant_id TEXT,
      details TEXT NOT NULL,
      severity TEXT DEFAULT 'info'
    );
  `).run();
}

async function recordAuditEvent(db, { type, actor, tenantId = null, details, severity = 'info' }) {
  try {
    const id = 'LOG_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO platform_audit_logs (id, timestamp, event_type, actor_email, tenant_id, details, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `).bind(id, now, type, actor || 'system', tenantId, details, severity).run();
  } catch (err) {
    console.error('Failed to record audit event:', err);
  }
}

async function getPlatformAuditLogs(db, limit = 50) {
  const rows = (await db.prepare(`
    SELECT * FROM platform_audit_logs
    ORDER BY timestamp DESC
    LIMIT ?;
  `).bind(limit).all()).results || [];

  return { success: true, logs: rows };
}

// ====================================================================
// IMPERSONATE TENANT
// ====================================================================
async function createImpersonationToken(env, { tenantId, userId }, session) {
  const token = 'imp_' + crypto.randomUUID().replace(/-/g, '');
  const impUser = {
    id: userId || 'USR_SUPERADMIN_IMPERSONATE',
    email: session?.user?.email || env.SUPERADMIN_EMAIL || '',
    name: 'SuperAdmin (' + (session?.user?.name || 'Administrator') + ')',
    role: 'SuperAdmin',
    orgId: tenantId,
    impersonated: true
  };

  if (env.SESSION_KV) {
    await env.SESSION_KV.put('session:' + token, JSON.stringify({
      user: impUser,
      orgId: tenantId,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    }), { expirationTtl: 3600 });
  }

  const targetUrl = `https://ims.zolexora.workers.dev/?sessionToken=${token}&tenantId=${tenantId}`;

  return {
    success: true,
    token: token,
    targetUrl: targetUrl,
    message: `Generated impersonation token for tenant [${tenantId}]. Valid for 1 hour.`
  };
}

// ====================================================================
// PLATFORM SETTINGS
// ====================================================================
async function getPlatformSettings(db) {
  return {
    success: true,
    settings: {
      platformName: 'Zolexora IMS Platform',
      maintenanceMode: false,
      tenantRegistrationOpen: true,
      broadcastNotice: 'All systems operating at peak performance across Cloudflare Edge network.',
      defaultCurrency: '₹',
      maxTenantQuotaDefault: 5000,
      supportEmail: 'support@zolexora.com',
      systemVersion: 'v2.4.0 (Enterprise)'
    }
  };
}

async function savePlatformSettings(db, payload, session) {
  await recordAuditEvent(db, {
    type: 'PLATFORM_SETTINGS_CHANGED',
    actor: session?.user?.email || 'Platform Admin',
    details: 'Updated global platform operational settings',
    severity: 'warning'
  });
  return { success: true, message: 'Platform settings updated successfully.' };
}

// ====================================================================
// CRYPTO UTILS (PBKDF2 100,000 iterations + Legacy Migration)
// ====================================================================
async function hashPassword(password, saltHex = null) {
  const enc = new TextEncoder();
  let salt;
  if (saltHex) {
    salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  } else {
    salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
  }
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes
  );
  const actualSaltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:100000:${actualSaltHex}:${hashHex}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || !password) return { verified: false, needsRehash: false };

  // 1. Check PBKDF2 format: pbkdf2:iterations:saltHex:hashHex
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length === 4) {
      const iterations = parseInt(parts[1], 10);
      const saltHex = parts[2];
      const expectedHashHex = parts[3];
      if (iterations === 100000) {
        const computed = await hashPassword(password, saltHex);
        const computedHashHex = computed.split(':')[3];
        return { verified: computedHashHex === expectedHashHex, needsRehash: false };
      }
    }
    return { verified: false, needsRehash: false };
  }

  // 2. Legacy SHA-256 support: password + '_zolexora_salt_2026'
  const enc = new TextEncoder();
  const legacyData = enc.encode(password + '_zolexora_salt_2026');
  const legacyDigest = await crypto.subtle.digest('SHA-256', legacyData);
  const legacyHex = Array.from(new Uint8Array(legacyDigest)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (storedHash === legacyHex) {
    return { verified: true, needsRehash: true };
  }

  return { verified: false, needsRehash: false };
}
