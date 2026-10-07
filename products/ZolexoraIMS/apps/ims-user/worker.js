/**
 * Zolexora IMS — Cloudflare Worker Reverse Proxy & Native D1 Database Engine
 * 
 * Custom Domain: ims.zolexora.com
 * D1 Database Binding: env.DB (zolexora-ims-1-db)
 * KV Session Binding: env.SESSION_KV
 */

const DEFAULT_GAS_EXEC_URL = 'https://script.google.com/macros/s/AKfycbyQpkaxpQrmcDyFtROLp4PNRGVxTFpBzg7KkNBiqPOxSOtxijB8VUarYIpTuprSB7f3/exec';
const DEFAULT_SESSION_TTL_SECONDS = 604800; // 7 days
const COOKIE_NAME = 'zolexora_session';
const SALT = '_zolexora_salt_2026';

const APP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Zolexora IMS — Edge API</title>
  <style>body{font-family:system-ui,-apple-system,sans-serif;margin:40px;background:#0f172a;color:#f8fafc;text-align:center;}h1{color:#38bdf8;}</style>
</head>
<body>
  <h1>Zolexora IMS Edge API</h1>
  <p>User Edge API active. Inventory and POS UI is served via the Vite single-page application.</p>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return handleCorsPreflight(request);
    }

    // 2. Health check endpoints
    if (url.pathname === '/api/health' || url.pathname === '/api/d1/health') {
      return handleD1Health(request, env);
    }

    // 3. Edge Session Store endpoints
    if (url.pathname === '/api/session' || url.pathname.startsWith('/api/session/')) {
      return handleSessionApi(request, env, url);
    }

    // 4. Standalone Dedicated Dashboard Web Pages & Application Entry
    if (url.pathname === '/inv-dashboard' || url.pathname === '/inventory-dashboard' || url.pathname === '/inventory' ||
        url.pathname === '/pos-dashboard' || url.pathname === '/pos' ||
        url.pathname === '/login' || url.pathname === '/signin') {
      return htmlResponse(APP_HTML);
    }

    // 5. Universal RPC Bridge for D1 Database (/api/rpc/:functionName)
    if (url.pathname.startsWith('/api/rpc/')) {
      const functionName = url.pathname.replace('/api/rpc/', '').trim();
      return handleD1Rpc(request, env, functionName);
    }

    // 6. Direct REST APIs for D1 Database (/api/inv-dashboard, /api/pos-dashboard, etc.)
    if (url.pathname.startsWith('/api/')) {
      const restResponse = await handleRestApi(request, env, url);
      if (restResponse) return restResponse;
      return jsonResponse({ success: false, error: `API endpoint '${url.pathname}' not found on edge database` }, 404, request);
    }

    // 7. Direct Edge-Hosted UI (Eliminates Google Login redirect completely)
    if (url.pathname === '/' || url.pathname === '/index.html' || !url.pathname.startsWith('/api/')) {
      return htmlResponse(APP_HTML);
    }

    // 8. Fallback
    return htmlResponse(APP_HTML);
  }
};

// =====================================================================
// D1 DATABASE HEALTH CHECK
// =====================================================================
async function handleD1Health(request, env) {
  if (!env.DB) {
    return jsonResponse({
      status: 'error',
      message: 'Cloudflare D1 binding (env.DB) is not configured in wrangler.toml'
    }, 500, request);
  }

  try {
    const start = Date.now();
    const tablesRes = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';"
    ).all();
    const latency = Date.now() - start;

    const tableNames = (tablesRes.results || []).map(r => r.name);
    
    // Quick row counts
    const counts = {};
    for (const tbl of tableNames) {
      const countRes = await env.DB.prepare(`SELECT count(*) as count FROM ${tbl};`).first();
      counts[tbl] = countRes?.count ?? 0;
    }

    return jsonResponse({
      status: 'healthy',
      database: 'zolexora-ims-1-db',
      engine: 'Cloudflare D1 (Serverless SQLite)',
      edgeLocation: request.cf?.colo || 'UNKNOWN',
      queryLatencyMs: latency,
      tablesCount: tableNames.length,
      tables: counts,
      timestamp: new Date().toISOString()
    }, 200, request);
  } catch (err) {
    return jsonResponse({
      status: 'error',
      message: err.message,
      stack: err.stack
    }, 500, request);
  }
}

// =====================================================================
// UNIVERSAL RPC BRIDGE (/api/rpc/:functionName)
// Maps any frontend google.script.run call to Cloudflare D1
// =====================================================================
async function handleD1Rpc(request, env, functionName) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'RPC endpoints require POST requests' }, 405, request);
  }

  // Stage 2.2: Lock Down Universal RPC Bridge (/api/rpc/:functionName)
  // Publicly exempt ONLY loginUser, authenticateUser, and logoutUser
  const isPublicRpc = (functionName === 'loginUser' || functionName === 'authenticateUser' || functionName === 'logoutUser');
  let session = null;
  if (!isPublicRpc) {
    session = await authenticateRequest(request, env);
    if (!session) {
      return jsonResponse({ success: false, error: 'Unauthorized: Active session required.' }, 401, request);
    }
  }

  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }

  const args = Array.isArray(body.args) ? body.args : (body ? [body] : []);
  const db = env.DB;

  if (!db) {
    return jsonResponse({ success: false, error: 'Database binding env.DB not available.' }, 500, request);
  }

  const orgId = session?.user?.orgId || session?.orgId || 'ORG_ZOLEXORA_001';

  try {
    let result;
    switch (functionName) {
      case 'getInitialData':
        result = await getInitialData(db, orgId);
        break;

      case 'getInventoryDashboardData':
        result = await getInventoryDashboardData(db, orgId);
        break;

      case 'getPosDashboardData':
        result = await getPosDashboardData(db, orgId);
        break;

      case 'loginUser':
      case 'authenticateUser':
        result = await loginUser(db, env, args[0]);
        break;

      case 'checkUserSession':
      case 'validateUserSession':
        result = await checkUserSession(db, args[0], orgId);
        break;

      case 'logoutUser':
        result = { success: true, message: 'Logged out' };
        break;

      case 'getItems':
        result = await getProducts(db, orgId);
        break;

      case 'saveItem':
        result = await saveProduct(db, args[0], orgId);
        break;

      case 'setItemStatus':
      case 'updateItemStatus':
        result = await setProductStatus(db, args[0], args[1], orgId);
        break;

      case 'deleteItem':
        result = await deleteProduct(db, args[0], orgId);
        break;

      case 'getSuppliers':
        result = await getSuppliers(db, orgId);
        break;

      case 'saveSupplier':
        result = await saveSupplier(db, args[0], orgId);
        break;

      case 'deleteSupplier':
        result = await deleteSupplier(db, args[0], orgId);
        break;

      case 'getStores':
        result = await getStores(db, orgId);
        break;

      case 'saveStore':
        result = await saveStore(db, args[0], orgId);
        break;

      case 'deleteStore':
        result = await deleteStore(db, args[0], orgId);
        break;

      case 'getSellingPoints':
        result = await getSellingPoints(db, orgId);
        break;

      case 'saveSellingPoint':
        result = await saveSellingPoint(db, args[0], orgId);
        break;

      case 'deleteSellingPoint':
        result = await deleteSellingPoint(db, args[0], orgId);
        break;

      case 'getUsers':
        result = await getUsers(db, orgId);
        break;

      case 'saveUser':
        result = await saveUser(db, args[0], orgId);
        break;

      case 'deleteUser':
        result = await deleteUser(db, args[0], orgId);
        break;

      case 'getSellingPointTransactions':
        result = await getSellingPointTransactions(db, args[0], orgId);
        break;

      case 'recordSellingPointSale':
        result = await recordSellingPointSale(db, args[0], orgId);
        break;

      case 'recordSellingPointPurchase':
        result = await recordSellingPointPurchase(db, args[0], orgId);
        break;

      case 'recordSellingPointExpense':
        result = await recordSellingPointExpense(db, args[0], orgId);
        break;

      case 'getSupplierTransactions':
        result = await getSupplierTransactions(db, args[0], orgId);
        break;

      case 'processSupplierPurchase':
      case 'recordPurchaseInvoice':
      case 'processPurchaseInvoice':
        result = await processSupplierPurchase(db, args[0], orgId);
        break;

      case 'getIssuanceTransactions':
        result = await getIssuanceTransactions(db, args[0], orgId);
        break;

      case 'processStockIssuance':
      case 'recordTransferInvoice':
      case 'processTransferInvoice':
        result = await processStockIssuance(db, args[0], orgId);
        break;

      case 'getTransactions':
        result = await getTransactions(db, args[0], orgId);
        break;

      case 'getSettings':
        result = await getSettings(db, orgId);
        break;

      case 'saveSettings':
        result = await saveSettings(db, args[0], orgId);
        break;

      case 'listOrganizations':
        result = await listOrganizations(db);
        break;

      case 'switchOrganization':
        result = await switchOrganization(db, args[0]);
        break;

      case 'renameOrganization':
        result = await renameOrganization(db, args[0], args[1]);
        break;

      case 'createOrganization':
        result = await createOrganization(db, args[0]);
        break;

      default:
        // If unrecognized RPC call, return error
        return jsonResponse({
          success: false,
          error: `Unimplemented D1 RPC function: ${functionName}`
        }, 404, request);
    }

    const statusCode = result?.status || (result?.success === false ? 400 : 200);
    const extraHeaders = result?.sessionId ? {
      'Set-Cookie': `${COOKIE_NAME}=${result.sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DEFAULT_SESSION_TTL_SECONDS}`
    } : {};
    return jsonResponse(result, statusCode, request, extraHeaders);
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message || 'Database error occurred',
      stack: err.stack
    }, 500, request);
  }
}

// =====================================================================
// REST API ROUTER
// =====================================================================
async function handleRestApi(request, env, url) {
  const db = env.DB;
  if (!db) return null;

  const path = url.pathname;
  const method = request.method;
  const isGetOrHead = method === 'GET' || method === 'HEAD';

  // 1. Auth Endpoints
  if (path === '/api/login' && isGetOrHead) {
    return jsonResponse({
      success: true,
      service: 'Zolexora Auth API'
    }, 200, request);
  }

  if (path === '/api/login' && method === 'POST') {
    const payload = await request.json().catch(() => ({}));
    if (!payload.email || !payload.password) {
      return jsonResponse({ success: false, error: 'Email and password are required' }, 400, request);
    }
    const res = await loginUser(db, env, payload);
    const status = res.success ? 200 : (res.status || 401);
    const extraHeaders = res.sessionId ? {
      'Set-Cookie': `${COOKIE_NAME}=${res.sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DEFAULT_SESSION_TTL_SECONDS}`
    } : {};
    return jsonResponse(res, status, request, extraHeaders);
  }

  // 2. HTML Views (Unauthenticated Dashboard Shells)
  if (path === '/api/inv-dashboard' && isGetOrHead && prefersHtml(request, url)) {
    return htmlResponse(APP_HTML);
  }
  if (path === '/api/pos-dashboard' && isGetOrHead && prefersHtml(request, url)) {
    return htmlResponse(APP_HTML);
  }

  // 3. Protected REST Endpoints (Requires Active Authenticated Session)
  const session = await authenticateRequest(request, env);
  if (!session) {
    return jsonResponse({ success: false, error: 'Unauthorized: Active session required.' }, 401, request);
  }
  const orgId = session.user?.orgId || session.orgId || 'ORG_ZOLEXORA_001';

  if (path === '/api/dashboard' && isGetOrHead) {
    return jsonResponse(await getInitialData(db, orgId), 200, request);
  }

  if (path === '/api/inv-dashboard' && isGetOrHead) {
    return jsonResponse(await getInventoryDashboardData(db, orgId), 200, request);
  }

  if (path === '/api/pos-dashboard' && isGetOrHead) {
    return jsonResponse(await getPosDashboardData(db, orgId), 200, request);
  }

  if (path === '/api/products' && isGetOrHead) {
    return jsonResponse({ success: true, items: await getProducts(db, orgId) }, 200, request);
  }

  if (path === '/api/products' && method === 'POST') {
    const payload = await request.json();
    return jsonResponse(await saveProduct(db, payload, orgId), 200, request);
  }

  if (path === '/api/stores' && isGetOrHead) {
    return jsonResponse({ success: true, stores: await getStores(db, orgId) }, 200, request);
  }

  if (path === '/api/selling-points' && isGetOrHead) {
    return jsonResponse({ success: true, sellingPoints: await getSellingPoints(db, orgId) }, 200, request);
  }

  if (path === '/api/suppliers' && isGetOrHead) {
    return jsonResponse({ success: true, suppliers: await getSuppliers(db, orgId) }, 200, request);
  }

  if (path === '/api/users' && isGetOrHead) {
    return jsonResponse({ success: true, users: await getUsers(db, orgId) }, 200, request);
  }

  if (path === '/api/sales' && method === 'POST') {
    const payload = await request.json();
    return jsonResponse(await recordSellingPointSale(db, payload, orgId), 200, request);
  }

  return null;
}

// =====================================================================
// D1 DATABASE OPERATIONS & QUERIES
// =====================================================================

async function getInitialData(db, orgId = 'ORG_ZOLEXORA_001') {
  const [org, stores, sellingPoints, suppliers, users, settingsList, products, supTxns, issTxns, salesTxns] = await Promise.all([
    db.prepare('SELECT * FROM organizations WHERE id = ? LIMIT 1;').bind(orgId).first(),
    db.prepare('SELECT * FROM stores WHERE org_id = ? ORDER BY code ASC;').bind(orgId).all(),
    db.prepare('SELECT * FROM selling_points WHERE org_id = ? ORDER BY code ASC;').bind(orgId).all(),
    db.prepare('SELECT * FROM suppliers WHERE org_id = ? ORDER BY code ASC;').bind(orgId).all(),
    db.prepare('SELECT id, email, name, role, scope_type as scopeType, assigned_location as assignedLocation, location_name as locationName, status FROM users WHERE org_id = ?;').bind(orgId).all(),
    db.prepare('SELECT key, value FROM settings WHERE org_id = ?;').bind(orgId).all(),
    db.prepare('SELECT * FROM products WHERE org_id = ? ORDER BY item_code ASC;').bind(orgId).all(),
    db.prepare('SELECT * FROM supplier_transactions WHERE org_id = ? ORDER BY timestamp DESC LIMIT 50;').bind(orgId).all(),
    db.prepare('SELECT * FROM issuance_transactions WHERE org_id = ? ORDER BY timestamp DESC LIMIT 50;').bind(orgId).all(),
    db.prepare('SELECT * FROM selling_point_sales WHERE org_id = ? ORDER BY timestamp DESC LIMIT 50;').bind(orgId).all()
  ]);

  const settings = {};
  (settingsList.results || []).forEach(s => { settings[s.key] = s.value; });

  const items = (products.results || []).map(p => formatProductFromRow(p));
  const storesList = (stores.results || []).map(s => ({
    code: s.code,
    name: s.name,
    type: s.type || 'Store',
    status: s.status || 'Active'
  }));

  const spList = (sellingPoints.results || []).map(sp => ({
    code: sp.code,
    name: sp.name,
    storeCode: sp.assigned_store_code || 'S_001',
    type: sp.type || 'Selling Point',
    status: sp.status || 'Active'
  }));

  const suppliersList = (suppliers.results || []).map(sup => ({
    code: sup.code,
    name: sup.name,
    category: sup.category || 'General',
    contactPerson: sup.contact_person || '',
    phone: sup.phone || '',
    email: sup.email || '',
    status: sup.status || 'Active'
  }));

  const supFormatted = (supTxns.results || []).map(r => formatSupplierTxn(r));
  const issFormatted = (issTxns.results || []).map(r => formatIssuanceTxn(r));
  const allRecent = [...supFormatted, ...issFormatted].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const metrics = calculateMetrics(items, supFormatted, issFormatted, storesList);
  const activeOrg = org || { id: orgId, name: `Organization (${orgId})` };

  return {
    success: true,
    hasOrganization: Boolean(org),
    activeOrganization: activeOrg,
    organizations: [activeOrg],
    workbooksInfo: {
      databaseType: 'Cloudflare D1 (Serverless SQL)',
      databaseName: 'zolexora-ims-1-db',
      workbooks: []
    },
    metrics: metrics,
    items: items,
    suppliers: suppliersList,
    stores: storesList,
    sellingPoints: spList,
    users: users.results || [],
    settings: settings,
    supplierTransactions: supFormatted,
    issuanceTransactions: issFormatted,
    recentTransactions: allRecent.slice(0, 50),
    sellingPointTransactions: {
      sales: (salesTxns.results || []).map(s => formatSaleFromRow(s)),
      purchases: [],
      expenses: []
    }
  };
}

function calculateMetrics(items, supTxns, issTxns, storesList) {
  let totalValuation = 0;
  let totalUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const categoryMap = {};
  const lowStockItems = [];

  const storeMetrics = {};
  storesList.forEach(st => {
    storeMetrics[st.code] = { code: st.code, name: st.name, units: 0, valuation: 0 };
  });

  items.forEach(itm => {
    const units = Number(itm.totalStock) || 0;
    const rate = Number(itm.rate) || 0;
    const val = Number(itm.totalValue) || (units * rate);

    totalUnits += units;
    totalValuation += val;

    if (units <= 0) {
      outOfStockCount++;
      lowStockCount++;
      lowStockItems.push(itm);
    } else if (units <= (Number(itm.minStock) || 0)) {
      lowStockCount++;
      lowStockItems.push(itm);
    }

    const cat = itm.category || 'General';
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, units: 0, valuation: 0 };
    categoryMap[cat].count++;
    categoryMap[cat].units += units;
    categoryMap[cat].valuation += val;

    if (storeMetrics['S_001']) {
      storeMetrics['S_001'].units += (Number(itm.stockS001) || 0);
      storeMetrics['S_001'].valuation += (Number(itm.stockS001) || 0) * rate;
    }
    if (storeMetrics['S_002']) {
      storeMetrics['S_002'].units += (Number(itm.stockS002) || 0);
      storeMetrics['S_002'].valuation += (Number(itm.stockS002) || 0) * rate;
    }
    if (storeMetrics['S_000']) {
      storeMetrics['S_000'].units += (Number(itm.centralStock) || 0);
      storeMetrics['S_000'].valuation += (Number(itm.centralStock) || 0) * rate;
    }
  });

  let stockInQty = 0;
  let stockInVal = 0;
  let stockOutQty = 0;
  let stockOutVal = 0;

  supTxns.forEach(t => {
    const q = Number(t.quantity) || 0;
    const v = Number(t.totalCost != null ? t.totalCost : (t.total_amount != null ? t.total_amount : t.totalAmount)) || 0;
    stockInQty += q;
    stockInVal += v;
  });

  issTxns.forEach(t => {
    const q = Number(t.quantity) || 0;
    const v = Number(t.totalCost != null ? t.totalCost : (t.total_value != null ? t.total_value : t.totalValue)) || 0;
    stockOutQty += q;
    stockOutVal += v;
  });

  return {
    totalSkus: items.length,
    totalValuation: Math.round(totalValuation),
    totalUnits: totalUnits,
    lowStockCount: lowStockCount,
    outOfStockCount: outOfStockCount,
    stores: storeMetrics,
    categoryBreakdown: categoryMap,
    lowStockItems: lowStockItems.slice(0, 15),
    todaySummary: {
      txnCount: supTxns.length + issTxns.length,
      stockIn: stockInQty,
      stockInValue: stockInVal,
      stockOut: stockOutQty,
      stockOutValue: stockOutVal
    }
  };
}

async function getInventoryDashboardData(db, orgId = 'ORG_ZOLEXORA_001') {
  const [org, stores, suppliers, products, supTxns, issTxns] = await Promise.all([
    db.prepare('SELECT * FROM organizations WHERE id = ? LIMIT 1;').bind(orgId).first(),
    db.prepare('SELECT * FROM stores WHERE org_id = ? ORDER BY code ASC;').bind(orgId).all(),
    db.prepare('SELECT * FROM suppliers WHERE org_id = ? ORDER BY code ASC;').bind(orgId).all(),
    db.prepare('SELECT * FROM products WHERE org_id = ? ORDER BY item_code ASC;').bind(orgId).all(),
    db.prepare('SELECT * FROM supplier_transactions WHERE org_id = ? ORDER BY timestamp DESC LIMIT 25;').bind(orgId).all(),
    db.prepare('SELECT * FROM issuance_transactions WHERE org_id = ? ORDER BY timestamp DESC LIMIT 25;').bind(orgId).all()
  ]);

  const items = (products.results || []).map(p => formatProductFromRow(p));
  const storesList = (stores.results || []).map(s => ({
    code: s.code,
    name: s.name,
    type: s.type || 'Store',
    status: s.status || 'Active'
  }));
  const suppliersList = (suppliers.results || []).map(s => ({
    code: s.code,
    name: s.name,
    category: s.category || 'General',
    contactPerson: s.contact_person || '',
    phone: s.phone || '',
    email: s.email || '',
    status: s.status || 'Active'
  }));

  let totalValuation = 0;
  let totalUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const categoryBreakdown = {};
  const lowStockAlerts = [];
  const warehouseBreakdown = {};

  storesList.forEach(st => {
    warehouseBreakdown[st.code] = {
      code: st.code,
      name: st.name,
      type: st.type,
      units: 0,
      valuation: 0
    };
  });

  items.forEach(itm => {
    const units = Number(itm.totalStock) || 0;
    const rate = Number(itm.rate) || 0;
    const val = Number(itm.totalValue) || (units * rate);
    const minStock = Number(itm.minStock) || 0;

    totalUnits += units;
    totalValuation += val;

    if (units <= 0) {
      outOfStockCount++;
      lowStockCount++;
      lowStockAlerts.push({
        code: itm.code,
        name: itm.name,
        category: itm.category,
        currentStock: units,
        minStock: minStock,
        status: 'OUT_OF_STOCK',
        rate: rate,
        supplierCode: itm.supplierCode || ''
      });
    } else if (units <= minStock) {
      lowStockCount++;
      lowStockAlerts.push({
        code: itm.code,
        name: itm.name,
        category: itm.category,
        currentStock: units,
        minStock: minStock,
        status: 'LOW_STOCK',
        rate: rate,
        supplierCode: itm.supplierCode || ''
      });
    }

    const cat = itm.category || 'General';
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = { count: 0, units: 0, valuation: 0 };
    }
    categoryBreakdown[cat].count++;
    categoryBreakdown[cat].units += units;
    categoryBreakdown[cat].valuation += val;

    if (warehouseBreakdown['S_000']) {
      const u = Number(itm.centralStock) || 0;
      warehouseBreakdown['S_000'].units += u;
      warehouseBreakdown['S_000'].valuation += u * rate;
    }
    if (warehouseBreakdown['S_001']) {
      const u = Number(itm.stockS001) || 0;
      warehouseBreakdown['S_001'].units += u;
      warehouseBreakdown['S_001'].valuation += u * rate;
    }
    if (warehouseBreakdown['S_002']) {
      const u = Number(itm.stockS002) || 0;
      warehouseBreakdown['S_002'].units += u;
      warehouseBreakdown['S_002'].valuation += u * rate;
    }
  });

  const recentMovements = [
    ...(supTxns.results || []).map(t => ({
      type: 'INWARD_PURCHASE',
      id: t.id,
      timestamp: t.timestamp,
      itemCode: t.item_code,
      itemName: t.item_description,
      quantity: t.quantity,
      rate: t.rate,
      totalAmount: t.total_amount,
      source: t.supplier_name || t.supplier_code,
      destination: t.receiving_store_name || t.receiving_store_code
    })),
    ...(issTxns.results || []).map(t => ({
      type: 'OUTWARD_TRANSFER',
      id: t.id,
      timestamp: t.timestamp,
      itemCode: t.item_code,
      itemName: t.item_description,
      quantity: t.quantity,
      rate: t.unit_rate,
      totalAmount: t.total_value,
      source: t.from_store_name || t.from_store_code,
      destination: t.to_selling_point_name || t.to_selling_point_code
    }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 20);

  return {
    success: true,
    dashboardType: 'inventory',
    title: 'Zolexora Inventory & Warehouse Operations Dashboard',
    organization: org || { id: 'ORG_ZOLEXORA_001', name: "Zolexora_1's org" },
    timestamp: new Date().toISOString(),
    summary: {
      totalSkus: items.length,
      totalUnits: totalUnits,
      totalValuation: Math.round(totalValuation),
      lowStockCount: lowStockCount,
      outOfStockCount: outOfStockCount,
      totalWarehouses: storesList.length,
      totalSuppliers: suppliersList.length
    },
    warehouses: Object.values(warehouseBreakdown),
    categoryBreakdown: categoryBreakdown,
    lowStockAlerts: lowStockAlerts,
    recentStockMovements: recentMovements,
    items: items
  };
}

async function getPosDashboardData(db, orgId = 'ORG_ZOLEXORA_001') {
  const [org, sellingPoints, salesRes, purchasesRes, expensesRes] = await Promise.all([
    db.prepare('SELECT * FROM organizations WHERE id = ? LIMIT 1;').bind(orgId).first(),
    db.prepare('SELECT * FROM selling_points WHERE org_id = ? ORDER BY code ASC;').bind(orgId).all(),
    db.prepare('SELECT * FROM selling_point_sales WHERE org_id = ? ORDER BY timestamp DESC;').bind(orgId).all(),
    db.prepare('SELECT * FROM selling_point_purchases WHERE org_id = ? ORDER BY timestamp DESC;').bind(orgId).all(),
    db.prepare('SELECT * FROM selling_point_expenses WHERE org_id = ? ORDER BY timestamp DESC;').bind(orgId).all()
  ]);

  const sales = (salesRes.results || []).map(s => formatSaleFromRow(s));
  const purchases = (purchasesRes.results || []).map(p => ({
    id: p.id,
    timestamp: p.timestamp,
    date: p.date,
    sellingPointCode: p.selling_point_code,
    sellingPointName: p.selling_point_name,
    itemCode: p.item_code,
    itemName: p.item_name,
    quantity: p.quantity,
    costRate: p.cost_rate,
    totalCost: p.total_cost,
    invoiceRef: p.invoice_ref,
    paymentStatus: p.payment_status,
    receivedBy: p.received_by
  }));
  const expenses = (expensesRes.results || []).map(e => ({
    id: e.id,
    timestamp: e.timestamp,
    date: e.date,
    sellingPointCode: e.selling_point_code,
    sellingPointName: e.selling_point_name,
    category: e.category,
    amount: e.amount,
    paymentMode: e.payment_mode,
    paidTo: e.paid_to,
    voucherRef: e.voucher_ref,
    recordedBy: e.recorded_by,
    status: e.status
  }));

  const sellingPointsList = (sellingPoints.results || []).map(sp => ({
    code: sp.code,
    name: sp.name,
    assignedStoreCode: sp.assigned_store_code || 'S_001',
    type: sp.type || 'Selling Point',
    status: sp.status || 'Active'
  }));

  let totalRevenue = 0;
  let totalUnitsSold = 0;
  let todayRevenue = 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const paymentBreakdown = { Cash: 0, UPI: 0, Card: 0, Other: 0 };
  const counterStats = {};
  const itemSalesMap = {};

  sellingPointsList.forEach(sp => {
    counterStats[sp.code] = {
      code: sp.code,
      name: sp.name,
      assignedStore: sp.assignedStoreCode,
      salesCount: 0,
      totalRevenue: 0,
      todayRevenue: 0
    };
  });

  sales.forEach(s => {
    const amt = Number(s.totalAmount) || 0;
    const qty = Number(s.quantity) || 0;
    totalRevenue += amt;
    totalUnitsSold += qty;

    if (s.date === todayStr || (s.timestamp && s.timestamp.startsWith(todayStr))) {
      todayRevenue += amt;
    }

    const mode = s.paymentMode || 'Cash';
    if (paymentBreakdown[mode] !== undefined) {
      paymentBreakdown[mode] += amt;
    } else {
      paymentBreakdown.Other += amt;
    }

    if (counterStats[s.sellingPointCode]) {
      counterStats[s.sellingPointCode].salesCount++;
      counterStats[s.sellingPointCode].totalRevenue += amt;
      if (s.date === todayStr || (s.timestamp && s.timestamp.startsWith(todayStr))) {
        counterStats[s.sellingPointCode].todayRevenue += amt;
      }
    }

    const itmCode = s.itemCode || s.itemName || 'OTHER';
    if (!itemSalesMap[itmCode]) {
      itemSalesMap[itmCode] = {
        code: itmCode,
        name: s.itemName || itmCode,
        category: s.category || 'General',
        unitsSold: 0,
        revenue: 0
      };
    }
    itemSalesMap[itmCode].unitsSold += qty;
    itemSalesMap[itmCode].revenue += amt;
  });

  const totalPurchasesCost = purchases.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
  const totalExpensesAmt = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netCashFlow = totalRevenue - (totalPurchasesCost + totalExpensesAmt);

  const topSellingItems = Object.values(itemSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    success: true,
    dashboardType: 'pos',
    title: 'Zolexora Point of Sale (POS) & Counter Operations Dashboard',
    organization: org || { id: 'ORG_ZOLEXORA_001', name: "Zolexora_1's org" },
    timestamp: new Date().toISOString(),
    summary: {
      totalRevenue: totalRevenue,
      todayRevenue: todayRevenue,
      totalBills: sales.length,
      totalUnitsSold: totalUnitsSold,
      averageBillValue: sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0,
      totalPurchasesCost: totalPurchasesCost,
      totalExpensesAmt: totalExpensesAmt,
      netCashFlow: netCashFlow,
      paymentBreakdown: paymentBreakdown
    },
    counters: Object.values(counterStats),
    topSellingItems: topSellingItems,
    recentSales: sales.slice(0, 50),
    recentPurchases: purchases.slice(0, 50),
    recentExpenses: expenses.slice(0, 50)
  };
}

function formatProductFromRow(row) {
  return {
    id: row.item_code,
    code: row.item_code,
    sku: row.item_code,
    name: row.description,
    description: row.description,
    category: row.category,
    categoryCode: row.category_code || '',
    unit: row.uom,
    uom: row.uom,
    rate: row.rate,
    unitCost: row.rate,
    taxPercent: row.tax_percent,
    minStock: row.min_stock,
    stockS001: row.stock_s_001,
    stockS002: row.stock_s_002,
    centralStock: row.central_stock,
    totalStock: row.total_stock,
    totalValue: row.total_valuation,
    supplierCode: row.preferred_supplier_code || '',
    supplier: row.preferred_supplier_code || '',
    status: row.status || 'Active'
  };
}

function formatSaleFromRow(r) {
  return {
    id: r.id,
    timestamp: r.timestamp,
    date: r.date,
    sellingPointCode: r.selling_point_code,
    sellingPointName: r.selling_point_name,
    billNo: r.bill_no || r.id,
    customerName: r.customer_name || 'Walk-in Guest',
    itemCode: r.item_code,
    itemName: r.item_name,
    category: r.category,
    quantity: r.quantity,
    unit: r.uom,
    rate: r.rate,
    taxPercent: r.tax_percent,
    totalAmount: r.total_amount,
    paymentMode: r.payment_mode || 'Cash',
    paymentStatus: r.payment_status || 'Completed',
    cashier: r.cashier || 'Staff',
    notes: r.notes || ''
  };
}

function formatSupplierTxn(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    type: 'STOCK_IN',
    timestamp: row.timestamp,
    supplierCode: row.supplier_code || row.supplierCode || '',
    supplierName: row.supplier_name || row.supplierName || '',
    sku: row.item_code || row.sku || '',
    itemCode: row.item_code || row.itemCode || '',
    itemName: row.item_description || row.itemName || '',
    itemDescription: row.item_description || row.itemDescription || '',
    category: row.category || '',
    quantity: Number(row.quantity) || 0,
    unit: row.uom || row.unit || '',
    uom: row.uom || row.unit || '',
    rate: Number(row.rate) || 0,
    costRate: Number(row.rate) || 0,
    taxPercent: Number(row.tax_percent != null ? row.tax_percent : row.taxPercent) || 0,
    totalAmount: Number(row.total_amount != null ? row.total_amount : row.totalAmount) || 0,
    totalCost: Number(row.total_amount != null ? row.total_amount : row.totalCost) || 0,
    sourceLocation: row.supplier_name || row.supplierCode || 'Supplier',
    destLocation: row.receiving_store_name || row.receiving_store_code || 'Store',
    receivingStoreCode: row.receiving_store_code || row.receivingStoreCode || '',
    receivingStoreName: row.receiving_store_name || row.receivingStoreName || '',
    reference: row.po_invoice_ref || row.reference || '',
    poInvoiceRef: row.po_invoice_ref || row.poInvoiceRef || '',
    performedBy: row.received_by || row.performedBy || 'Staff',
    receivedBy: row.received_by || row.receivedBy || 'Staff',
    notes: row.notes || ''
  };
}

function formatIssuanceTxn(row) {
  if (!row) return null;
  const rawType = String(row.type || 'STOCK_OUT').toUpperCase();
  const normalizedType = (rawType === 'DISBURSEMENT' || rawType === 'STOCK_OUT') ? 'STOCK_OUT' : rawType;
  return {
    ...row,
    id: row.id,
    type: normalizedType,
    rawType: row.type || 'STOCK_OUT',
    timestamp: row.timestamp,
    sku: row.item_code || row.sku || '',
    itemCode: row.item_code || row.itemCode || '',
    itemName: row.item_description || row.itemName || '',
    itemDescription: row.item_description || row.itemDescription || '',
    category: row.category || '',
    quantity: Number(row.quantity) || 0,
    unit: row.uom || row.unit || '',
    uom: row.uom || row.unit || '',
    rate: Number(row.unit_rate != null ? row.unit_rate : row.rate) || 0,
    unitRate: Number(row.unit_rate != null ? row.unit_rate : row.unitRate) || 0,
    totalCost: Number(row.total_value != null ? row.total_value : row.totalCost) || 0,
    totalValue: Number(row.total_value != null ? row.total_value : row.totalValue) || 0,
    totalAmount: Number(row.total_value != null ? row.total_value : row.totalAmount) || 0,
    sourceLocation: row.from_store_name || row.from_store_code || 'Store',
    fromStoreCode: row.from_store_code || row.fromStoreCode || '',
    fromStoreName: row.from_store_name || row.fromStoreName || '',
    destLocation: row.to_selling_point_name || row.to_selling_point_code || 'Selling Point / Dept',
    toSellingPointCode: row.to_selling_point_code || row.toSellingPointCode || '',
    toSellingPointName: row.to_selling_point_name || row.toSellingPointName || '',
    reference: row.requisition_ref || row.reference || '',
    requisitionRef: row.requisition_ref || row.requisitionRef || '',
    performedBy: row.issued_by || row.performedBy || 'Staff',
    issuedBy: row.issued_by || row.issuedBy || 'Staff',
    status: row.status || 'Approved',
    notes: row.notes || ''
  };
}

async function getProducts(db, orgId = 'ORG_ZOLEXORA_001') {
  const res = await db.prepare('SELECT * FROM products WHERE org_id = ? ORDER BY item_code ASC;').bind(orgId).all();
  return (res.results || []).map(p => formatProductFromRow(p));
}

async function saveProduct(db, item, orgId = 'ORG_ZOLEXORA_001') {
  const code = String(item.code || item.sku || item.id || `ITM_${Date.now().toString().slice(-4)}`).trim().toUpperCase();
  const desc = String(item.name || item.description || '').trim();
  const cat = String(item.category || 'General').trim();
  const uom = String(item.uom || item.unit || 'Pcs').trim();
  const rate = Number(item.rate || item.unitCost || 0);
  const tax = Number(item.taxPercent || item.tax_percent || 0);
  const minStock = Number(item.minStock || 0);
  const stockS001 = Number(item.stockS001 || 0);
  const stockS002 = Number(item.stockS002 || 0);
  const centralStock = Number(item.centralStock || 0);
  const totalStock = stockS001 + stockS002 + centralStock;
  const totalValuation = totalStock * rate;
  const status = item.status || 'Active';
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO products (
      item_code, org_id, description, category, category_code, uom, rate, tax_percent,
      min_stock, stock_s_001, stock_s_002, central_stock, total_stock, total_valuation,
      preferred_supplier_code, status, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(item_code) DO UPDATE SET
      org_id = excluded.org_id,
      description = excluded.description,
      category = excluded.category,
      uom = excluded.uom,
      rate = excluded.rate,
      tax_percent = excluded.tax_percent,
      min_stock = excluded.min_stock,
      stock_s_001 = excluded.stock_s_001,
      stock_s_002 = excluded.stock_s_002,
      central_stock = excluded.central_stock,
      total_stock = excluded.total_stock,
      total_valuation = excluded.total_valuation,
      status = excluded.status,
      last_updated = excluded.last_updated;
  `).bind(
    code, orgId, desc, cat, item.categoryCode || '', uom, rate, tax,
    minStock, stockS001, stockS002, centralStock, totalStock, totalValuation,
    item.supplierCode || '', status, now
  ).run();

  const allItems = await getProducts(db, orgId);
  return { success: true, itemCode: code, items: allItems };
}

async function setProductStatus(db, code, status, orgId = 'ORG_ZOLEXORA_001') {
  const now = new Date().toISOString();
  await db.prepare('UPDATE products SET status = ?, last_updated = ? WHERE item_code = ? AND org_id = ?;')
    .bind(status, now, code, orgId).run();
  const allItems = await getProducts(db, orgId);
  return { success: true, itemCode: code, status: status, items: allItems };
}

async function deleteProduct(db, code, orgId = 'ORG_ZOLEXORA_001') {
  await db.prepare('DELETE FROM products WHERE item_code = ? AND org_id = ?;').bind(code, orgId).run();
  const allItems = await getProducts(db, orgId);
  return { success: true, items: allItems };
}

async function getStores(db, orgId = 'ORG_ZOLEXORA_001') {
  const res = await db.prepare('SELECT * FROM stores WHERE org_id = ? ORDER BY code ASC;').bind(orgId).all();
  return (res.results || []).map(s => ({
    code: s.code,
    name: s.name,
    type: s.type || 'Store',
    status: s.status || 'Active',
    description: s.description || ''
  }));
}

async function saveStore(db, store, orgId = 'ORG_ZOLEXORA_001') {
  const code = String(store.code || `S_${Date.now().toString().slice(-3)}`).trim();
  await db.prepare(`
    INSERT INTO stores (code, org_id, name, type, status, description)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      org_id = excluded.org_id,
      name = excluded.name,
      type = excluded.type,
      status = excluded.status,
      description = excluded.description;
  `).bind(code, orgId, store.name, store.type || 'Store', store.status || 'Active', store.description || '').run();
  const stores = await getStores(db, orgId);
  return { success: true, code: code, stores: stores };
}

async function deleteStore(db, code, orgId = 'ORG_ZOLEXORA_001') {
  await db.prepare('DELETE FROM stores WHERE code = ? AND org_id = ?;').bind(code, orgId).run();
  const stores = await getStores(db, orgId);
  return { success: true, stores: stores };
}

async function getSellingPoints(db, orgId = 'ORG_ZOLEXORA_001') {
  const res = await db.prepare('SELECT * FROM selling_points WHERE org_id = ? ORDER BY code ASC;').bind(orgId).all();
  return (res.results || []).map(sp => ({
    code: sp.code,
    name: sp.name,
    storeCode: sp.assigned_store_code || 'S_001',
    type: sp.type || 'Selling Point',
    status: sp.status || 'Active'
  }));
}

async function saveSellingPoint(db, sp, orgId = 'ORG_ZOLEXORA_001') {
  const code = String(sp.code || `SP_${Date.now().toString().slice(-3)}`).trim();
  await db.prepare(`
    INSERT INTO selling_points (code, org_id, name, assigned_store_code, type, status)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      org_id = excluded.org_id,
      name = excluded.name,
      assigned_store_code = excluded.assigned_store_code,
      type = excluded.type,
      status = excluded.status;
  `).bind(code, orgId, sp.name, sp.storeCode || 'S_001', sp.type || 'Selling Point', sp.status || 'Active').run();
  const sellingPoints = await getSellingPoints(db, orgId);
  return { success: true, code: code, sellingPoints: sellingPoints };
}

async function deleteSellingPoint(db, code, orgId = 'ORG_ZOLEXORA_001') {
  await db.prepare('DELETE FROM selling_points WHERE code = ? AND org_id = ?;').bind(code, orgId).run();
  const sellingPoints = await getSellingPoints(db, orgId);
  return { success: true, sellingPoints: sellingPoints };
}

async function getSuppliers(db, orgId = 'ORG_ZOLEXORA_001') {
  const res = await db.prepare('SELECT * FROM suppliers WHERE org_id = ? ORDER BY code ASC;').bind(orgId).all();
  return (res.results || []).map(sup => ({
    id: sup.code,
    code: sup.code,
    name: sup.name,
    category: sup.category || 'General',
    categorySupplied: sup.category || 'General',
    contactPerson: sup.contact_person || '',
    phone: sup.phone || '',
    email: sup.email || '',
    address: sup.address || '',
    status: sup.status || 'Active'
  }));
}

async function saveSupplier(db, sup, orgId = 'ORG_ZOLEXORA_001') {
  const code = String(sup.code || sup.id || `SUP_${Date.now().toString().slice(-3)}`).trim();
  const cat = sup.category || sup.categorySupplied || 'General';
  await db.prepare(`
    INSERT INTO suppliers (code, org_id, name, category, contact_person, phone, email, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      org_id = excluded.org_id,
      name = excluded.name,
      category = excluded.category,
      contact_person = excluded.contact_person,
      phone = excluded.phone,
      email = excluded.email,
      status = excluded.status;
  `).bind(code, orgId, sup.name, cat, sup.contactPerson || '', sup.phone || '', sup.email || '', sup.status || 'Active').run();
  const suppliers = await getSuppliers(db, orgId);
  return { success: true, code: code, suppliers: suppliers };
}

async function deleteSupplier(db, code, orgId = 'ORG_ZOLEXORA_001') {
  await db.prepare('DELETE FROM suppliers WHERE code = ? AND org_id = ?;').bind(code, orgId).run();
  const suppliers = await getSuppliers(db, orgId);
  return { success: true, suppliers: suppliers };
}

async function getUsers(db, orgId = 'ORG_ZOLEXORA_001') {
  const res = await db.prepare(`
    SELECT id, email, name, role, scope_type as scopeType, assigned_location as assignedLocation, location_name as locationName, status
    FROM users WHERE org_id = ? ORDER BY id ASC;
  `).bind(orgId).all();
  return res.results || [];
}

async function saveUser(db, user, orgId = 'ORG_ZOLEXORA_001') {
  const id = String(user.id || `USR_${Date.now().toString().slice(-4)}`).trim();
  const now = new Date().toISOString();
  const targetOrgId = user.orgId || orgId;
  const passwordHash = user.password ? await hashPassword(user.password.trim()) : (user.password_hash || 'managed_by_supabase_auth');
  await db.prepare(`
    INSERT INTO users (id, org_id, email, password_hash, name, role, scope_type, assigned_location, location_name, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      org_id = excluded.org_id,
      name = excluded.name,
      role = excluded.role,
      scope_type = excluded.scope_type,
      assigned_location = excluded.assigned_location,
      location_name = excluded.location_name,
      status = excluded.status;
  `).bind(
    id, targetOrgId, user.email, passwordHash,
    user.name, user.role || 'Staff', user.scopeType || 'ALL', user.assignedLocation || 'ALL',
    user.locationName || '', user.status || 'Active', now
  ).run();

  const users = await getUsers(db, targetOrgId);
  return { success: true, users: users };
}

async function deleteUser(db, id, orgId = 'ORG_ZOLEXORA_001') {
  await db.prepare('DELETE FROM users WHERE id = ? AND org_id = ?;').bind(id, orgId).run();
  const users = await getUsers(db, orgId);
  return { success: true, users: users };
}

async function getSellingPointTransactions(db, limit = 150, orgId = 'ORG_ZOLEXORA_001') {
  const [sales, purchases, expenses] = await Promise.all([
    db.prepare('SELECT * FROM selling_point_sales WHERE org_id = ? ORDER BY timestamp DESC LIMIT ?;').bind(orgId, limit).all(),
    db.prepare('SELECT * FROM selling_point_purchases WHERE org_id = ? ORDER BY timestamp DESC LIMIT ?;').bind(orgId, limit).all(),
    db.prepare('SELECT * FROM selling_point_expenses WHERE org_id = ? ORDER BY timestamp DESC LIMIT ?;').bind(orgId, limit).all()
  ]);

  return {
    sales: (sales.results || []).map(s => formatSaleFromRow(s)),
    purchases: purchases.results || [],
    expenses: expenses.results || []
  };
}

async function recordSellingPointSale(db, sale, orgId = 'ORG_ZOLEXORA_001') {
  const now = new Date();
  const saleId = 'SALE_' + now.toISOString().slice(0, 10).replace(/-/g, '') + '_' + Math.floor(1000 + Math.random() * 9000);
  const today = now.toISOString().slice(0, 10);
  const qty = Number(sale.quantity) || 1;
  const rate = Number(sale.rate) || 0;
  const tax = Number(sale.taxPercent) || 0;
  const total = Number(sale.totalAmount) || (qty * rate * (1 + tax / 100));
  const spCode = String(sale.sellingPointCode || 'SP_001');

  // 1. Insert Sale record into D1
  await db.prepare(`
    INSERT INTO selling_point_sales (
      id, org_id, timestamp, date, selling_point_code, selling_point_name, bill_no,
      customer_name, item_code, item_name, category, quantity, uom, rate, tax_percent,
      total_amount, payment_mode, payment_status, cashier, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).bind(
    saleId, orgId, now.toISOString(), today, spCode, sale.sellingPointName || 'Selling Point',
    sale.billNo || saleId, sale.customerName || 'Walk-in Guest', sale.itemCode || '',
    sale.itemName || '', sale.category || 'General', qty, sale.unit || 'Pcs',
    rate, tax, total, sale.paymentMode || 'Cash', 'Completed', sale.cashier || 'Cashier',
    sale.notes || ''
  ).run();

  // 2. Automatically deduct stock from products table in D1
  if (sale.itemCode) {
    const isS002 = spCode.includes('002') || spCode.includes('S_002');
    if (isS002) {
      await db.prepare(`
        UPDATE products SET
          stock_s_002 = MAX(0, stock_s_002 - ?),
          total_stock = MAX(0, total_stock - ?),
          total_valuation = MAX(0, total_stock - ?) * rate,
          last_updated = ?
        WHERE item_code = ? AND org_id = ?;
      `).bind(qty, qty, qty, now.toISOString(), sale.itemCode, orgId).run();
    } else {
      await db.prepare(`
        UPDATE products SET
          stock_s_001 = MAX(0, stock_s_001 - ?),
          total_stock = MAX(0, total_stock - ?),
          total_valuation = MAX(0, total_stock - ?) * rate,
          last_updated = ?
        WHERE item_code = ? AND org_id = ?;
      `).bind(qty, qty, qty, now.toISOString(), sale.itemCode, orgId).run();
    }
  }

  return {
    success: true,
    saleId: saleId,
    totalAmount: total,
    message: `Sale ${saleId} recorded in Cloudflare D1 with instant stock deduction.`
  };
}

async function recordSellingPointPurchase(db, pur, orgId = 'ORG_ZOLEXORA_001') {
  const now = new Date();
  const purId = 'PUR_SP_' + now.toISOString().slice(0, 10).replace(/-/g, '') + '_' + Math.floor(100 + Math.random() * 900);
  const today = now.toISOString().slice(0, 10);
  const qty = Number(pur.quantity) || 1;
  const costRate = Number(pur.costRate) || 0;
  const tax = Number(pur.taxPercent) || 0;
  const totalCost = Number(pur.totalCost) || (qty * costRate * (1 + tax / 100));
  const spCode = String(pur.sellingPointCode || 'SP_001');

  await db.prepare(`
    INSERT INTO selling_point_purchases (
      id, org_id, timestamp, date, selling_point_code, selling_point_name, source,
      item_code, item_name, category, quantity, uom, cost_rate, tax_percent,
      total_cost, invoice_ref, payment_status, received_by, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).bind(
    purId, orgId, now.toISOString(), today, spCode, pur.sellingPointName || 'Selling Point',
    pur.source || 'Direct Supplier', pur.itemCode || '', pur.itemName || '',
    pur.category || 'General', qty, pur.unit || 'Pcs', costRate, tax, totalCost,
    pur.invoiceRef || '', pur.paymentStatus || 'Paid', pur.receivedBy || 'Staff',
    pur.notes || ''
  ).run();

  // Add stock to products in D1
  if (pur.itemCode) {
    const isS002 = spCode.includes('002') || spCode.includes('S_002');
    if (isS002) {
      await db.prepare(`
        UPDATE products SET
          stock_s_002 = stock_s_002 + ?,
          total_stock = total_stock + ?,
          total_valuation = (total_stock + ?) * rate,
          last_updated = ?
        WHERE item_code = ? AND org_id = ?;
      `).bind(qty, qty, qty, now.toISOString(), pur.itemCode, orgId).run();
    } else {
      await db.prepare(`
        UPDATE products SET
          stock_s_001 = stock_s_001 + ?,
          total_stock = total_stock + ?,
          total_valuation = (total_stock + ?) * rate,
          last_updated = ?
        WHERE item_code = ? AND org_id = ?;
      `).bind(qty, qty, qty, now.toISOString(), pur.itemCode, orgId).run();
    }
  }

  return { success: true, purchaseId: purId, totalCost: totalCost };
}

async function recordSellingPointExpense(db, exp, orgId = 'ORG_ZOLEXORA_001') {
  const now = new Date();
  const expId = 'EXP_' + now.toISOString().slice(0, 10).replace(/-/g, '') + '_' + Math.floor(1000 + Math.random() * 9000);
  const today = now.toISOString().slice(0, 10);
  const amount = Number(exp.amount) || 0;

  await db.prepare(`
    INSERT INTO selling_point_expenses (
      id, org_id, timestamp, date, selling_point_code, selling_point_name,
      category, amount, payment_mode, paid_to, voucher_ref, recorded_by, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved', ?);
  `).bind(
    expId, orgId, now.toISOString(), today, exp.sellingPointCode || 'SP_001',
    exp.sellingPointName || 'Selling Point', exp.category || 'Petty Cash',
    amount, exp.paymentMode || 'Cash', exp.paidTo || 'Vendor', exp.voucherRef || '',
    exp.recordedBy || 'Staff', exp.notes || ''
  ).run();

  return { success: true, expenseId: expId, amount: amount };
}

async function getSupplierTransactions(db, limit = 50, orgId = 'ORG_ZOLEXORA_001') {
  const res = await db.prepare('SELECT * FROM supplier_transactions WHERE org_id = ? ORDER BY timestamp DESC LIMIT ?;').bind(orgId, limit).all();
  return (res.results || []).map(r => formatSupplierTxn(r));
}

async function processSupplierPurchase(db, txn, orgId = 'ORG_ZOLEXORA_001') {
  const now = new Date().toISOString();
  const txnId = 'TXN_SUP_' + Date.now().toString().slice(-6);
  const qty = Number(txn.quantity) || 1;
  const rate = Number(txn.rate) || 0;
  const tax = Number(txn.taxPercent) || 0;
  const total = Number(txn.totalAmount) || (qty * rate * (1 + tax / 100));
  const storeCode = txn.receivingStoreCode || 'S_001';

  await db.prepare(`
    INSERT INTO supplier_transactions (
      id, org_id, timestamp, supplier_code, supplier_name, item_code, item_description,
      category, quantity, uom, rate, tax_percent, total_amount, receiving_store_code,
      receiving_store_name, po_invoice_ref, received_by, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).bind(
    txnId, orgId, now, txn.supplierCode || '', txn.supplierName || '', txn.itemCode || '',
    txn.itemDescription || '', txn.category || 'General', qty, txn.uom || 'Pcs',
    rate, tax, total, storeCode, txn.receivingStoreName || 'Main Store',
    txn.poInvoiceRef || '', txn.receivedBy || 'Store Incharge', txn.notes || ''
  ).run();

  // Increment stock in D1
  if (txn.itemCode) {
    if (storeCode === 'S_002') {
      await db.prepare(`
        UPDATE products SET stock_s_002 = stock_s_002 + ?, total_stock = total_stock + ?, total_valuation = (total_stock + ?) * rate, last_updated = ? WHERE item_code = ? AND org_id = ?;
      `).bind(qty, qty, qty, now, txn.itemCode, orgId).run();
    } else if (storeCode === 'S_000') {
      await db.prepare(`
        UPDATE products SET central_stock = central_stock + ?, total_stock = total_stock + ?, total_valuation = (total_stock + ?) * rate, last_updated = ? WHERE item_code = ? AND org_id = ?;
      `).bind(qty, qty, qty, now, txn.itemCode, orgId).run();
    } else {
      await db.prepare(`
        UPDATE products SET stock_s_001 = stock_s_001 + ?, total_stock = total_stock + ?, total_valuation = (total_stock + ?) * rate, last_updated = ? WHERE item_code = ? AND org_id = ?;
      `).bind(qty, qty, qty, now, txn.itemCode, orgId).run();
    }
  }

  return { success: true, txnId: txnId, totalAmount: total };
}

async function getIssuanceTransactions(db, limit = 50, orgId = 'ORG_ZOLEXORA_001') {
  const res = await db.prepare('SELECT * FROM issuance_transactions WHERE org_id = ? ORDER BY timestamp DESC LIMIT ?;').bind(orgId, limit).all();
  return (res.results || []).map(r => formatIssuanceTxn(r));
}

async function processStockIssuance(db, txn, orgId = 'ORG_ZOLEXORA_001') {
  const now = new Date().toISOString();
  const issId = 'ISS_' + Date.now().toString().slice(-6);
  const qty = Number(txn.quantity) || 1;
  const rate = Number(txn.unitRate) || 0;
  const total = Number(txn.totalValue) || (qty * rate);
  const fromStore = txn.fromStoreCode || 'S_001';

  await db.prepare(`
    INSERT INTO issuance_transactions (
      id, org_id, timestamp, type, item_code, item_description, quantity, uom,
      from_store_code, from_store_name, to_selling_point_code, to_selling_point_name,
      unit_rate, total_value, requisition_ref, issued_by, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved', ?);
  `).bind(
    issId, orgId, now, txn.type || 'DISBURSEMENT', txn.itemCode || '', txn.itemDescription || '',
    qty, txn.uom || 'Pcs', fromStore, txn.fromStoreName || 'Main Store',
    txn.toSellingPointCode || 'SP_001', txn.toSellingPointName || 'Selling Point',
    rate, total, txn.requisitionRef || '', txn.issuedBy || 'Store Keeper', txn.notes || ''
  ).run();

  // Deduct from source store in D1
  if (txn.itemCode) {
    if (fromStore === 'S_002') {
      await db.prepare(`
        UPDATE products SET stock_s_002 = MAX(0, stock_s_002 - ?), total_stock = MAX(0, stock_s_001 + MAX(0, stock_s_002 - ?) + central_stock), last_updated = ? WHERE item_code = ? AND org_id = ?;
      `).bind(qty, qty, now, txn.itemCode, orgId).run();
    } else if (fromStore === 'S_000') {
      await db.prepare(`
        UPDATE products SET central_stock = MAX(0, central_stock - ?), total_stock = MAX(0, stock_s_001 + stock_s_002 + MAX(0, central_stock - ?)), last_updated = ? WHERE item_code = ? AND org_id = ?;
      `).bind(qty, qty, now, txn.itemCode, orgId).run();
    } else {
      await db.prepare(`
        UPDATE products SET stock_s_001 = MAX(0, stock_s_001 - ?), total_stock = MAX(0, MAX(0, stock_s_001 - ?) + stock_s_002 + central_stock), last_updated = ? WHERE item_code = ? AND org_id = ?;
      `).bind(qty, qty, now, txn.itemCode, orgId).run();
    }
  }

  return { success: true, issuanceId: issId, totalValue: total };
}

async function getTransactions(db, limit = 50, orgId = 'ORG_ZOLEXORA_001') {
  const [sup, iss] = await Promise.all([
    getSupplierTransactions(db, limit, orgId),
    getIssuanceTransactions(db, limit, orgId)
  ]);
  return [...sup, ...iss].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
}

async function getSettings(db, orgId = 'ORG_ZOLEXORA_001') {
  const res = await db.prepare('SELECT key, value FROM settings WHERE org_id = ?;').bind(orgId).all();
  const map = {};
  (res.results || []).forEach(r => { map[r.key] = r.value; });
  return map;
}

async function saveSettings(db, settingsObj, orgId = 'ORG_ZOLEXORA_001') {
  for (const [k, v] of Object.entries(settingsObj || {})) {
    await db.prepare(`
      INSERT INTO settings (key, org_id, value, description)
      VALUES (?, ?, ?, 'Updated setting')
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, org_id = excluded.org_id;
    `).bind(k, orgId, String(v)).run();
  }
  return { success: true };
}

async function listOrganizations(db) {
  const res = await db.prepare('SELECT * FROM organizations;').all();
  return res.results || [];
}

async function switchOrganization(db, orgId) {
  const org = await db.prepare('SELECT * FROM organizations WHERE id = ?;').bind(orgId).first();
  const allOrgs = await listOrganizations(db);
  return { success: true, activeOrganization: org, organizations: allOrgs };
}

async function renameOrganization(db, orgId, newName) {
  const name = String(newName || '').trim();
  if (!name) return { success: false, error: 'Organization name cannot be empty' };
  await db.prepare('UPDATE organizations SET name = ? WHERE id = ?;').bind(name, orgId).run();
  const org = await db.prepare('SELECT * FROM organizations WHERE id = ?;').bind(orgId).first();
  const allOrgs = await listOrganizations(db);
  return { success: true, activeOrganization: org, organizations: allOrgs };
}

async function createOrganization(db, orgData) {
  const id = orgData.id || `ORG_${Date.now()}`;
  const name = String(orgData.name || 'New Organization').trim();
  await db.prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?);').bind(id, name, new Date().toISOString()).run();
  const org = await db.prepare('SELECT * FROM organizations WHERE id = ?;').bind(id).first();
  const allOrgs = await listOrganizations(db);
  return { success: true, organization: org, activeOrganization: org, organizations: allOrgs };
}

// =====================================================================
// AUTHENTICATION & SESSIONS
// =====================================================================

async function loginUser(db, env, credentials) {
  const email = String(credentials?.email || '').trim().toLowerCase();
  const password = String(credentials?.password || '').trim();

  if (!email || !password) {
    return { success: false, status: 400, error: 'Email and password are required', message: 'Email and password are required' };
  }

  const user = await db.prepare('SELECT * FROM users WHERE LOWER(email) = ?;').bind(email).first();
  if (!user) {
    return { 
      success: false, 
      status: 401,
      error: 'Invalid email or password', 
      message: 'Invalid email or password' 
    };
  }

  // Verify password with PBKDF2 (with legacy SHA-256 fallback)
  const { verified, needsRehash } = await verifyPassword(password, user.password_hash);

  if (!verified) {
    return { 
      success: false, 
      status: 401,
      error: 'Invalid email or password', 
      message: 'Invalid email or password' 
    };
  }

  // If authenticated via legacy hash, migrate to PBKDF2
  if (needsRehash) {
    try {
      const newHash = await hashPassword(password);
      await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?;').bind(newHash, user.id).run();
    } catch (e) {
      console.error('Failed to migrate password hash to PBKDF2:', e);
    }
  }

  // Update last_login
  const now = new Date().toISOString();
  try {
    await db.prepare('UPDATE users SET last_login = ? WHERE id = ?;').bind(now, user.id).run();
  } catch (e) {}

  const formattedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    scopeType: user.scope_type || 'ALL',
    assignedLocation: user.assigned_location || 'ALL',
    locationName: user.location_name || '',
    orgId: user.org_id || 'ORG_ZOLEXORA_001',
    orgName: "Zolexora_1's org"
  };

  let sessionId = null;
  // Cache in SESSION_KV if available
  let sessionId = null;
  if (env.SESSION_KV) {
    sessionId = generateSessionId();
    await env.SESSION_KV.put(`session:${sessionId}`, JSON.stringify({
      sessionId: sessionId,
      user: formattedUser,
      orgId: formattedUser.orgId,
      role: formattedUser.role,
      expiresAt: new Date(Date.now() + DEFAULT_SESSION_TTL_SECONDS * 1000).toISOString()
    }), { expirationTtl: DEFAULT_SESSION_TTL_SECONDS });
  }

  const initialData = await getInitialData(db, formattedUser.orgId);

  return {
    success: true,
    sessionId: sessionId,
    token: sessionId,
    user: formattedUser,
    data: initialData
  };
}

async function checkUserSession(db, email, orgId = 'ORG_ZOLEXORA_001') {
  if (!email) return { success: false, error: 'No email provided' };
  const user = await db.prepare('SELECT * FROM users WHERE LOWER(email) = ? AND org_id = ?;').bind(email.toLowerCase().trim(), orgId).first();
  if (!user) return { success: false, error: 'Session expired or user not found' };

  const formattedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    scopeType: user.scope_type || 'ALL',
    assignedLocation: user.assigned_location || 'ALL',
    locationName: user.location_name || '',
    orgId: user.org_id || orgId,
    orgName: "Zolexora_1's org"
  };

  const initialData = await getInitialData(db, orgId);
  return {
    success: true,
    user: formattedUser,
    data: initialData
  };
}

// =====================================================================
// CRYPTO UTILS (PBKDF2 100,000 iterations + Legacy Migration)
// =====================================================================
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

// =====================================================================
// EDGE SESSION API (/api/session)
// =====================================================================
async function handleSessionApi(request, env, url) {
  const method = request.method.toUpperCase();

  if (url.pathname === '/api/session/health') {
    return jsonResponse({
      status: 'healthy',
      service: 'zolexora-edge-session-store',
      kvConfigured: Boolean(env.SESSION_KV),
      d1Configured: Boolean(env.DB),
      edgeLocation: request.cf?.colo || 'UNKNOWN',
      timestamp: new Date().toISOString()
    }, 200, request);
  }

  if (!env.SESSION_KV) {
    return jsonResponse({ success: false, error: 'KV namespace SESSION_KV is not bound.' }, 500, request);
  }

  if (method === 'GET') {
    const token = extractSessionToken(request);
    if (!token) {
      return jsonResponse({ success: false, cached: false, error: 'No session token provided.' }, 401, request);
    }
    let raw = await env.SESSION_KV.get(`session:${token}`);
    if (!raw) {
      raw = await env.SESSION_KV.get(`admin_session:${token}`);
    }
    if (!raw) {
      return jsonResponse({ success: false, cached: false, error: 'Session expired or not found.' }, 404, request);
    }
    try {
      const sessionData = JSON.parse(raw);
      if (sessionData.expiresAt && new Date(sessionData.expiresAt) < new Date()) {
        return jsonResponse({ success: false, cached: false, error: 'Session expired.' }, 401, request);
      }
      return jsonResponse({
        success: true,
        cached: true,
        sessionId: token,
        user: sessionData.user,
        orgId: sessionData.orgId || sessionData.user?.orgId
      }, 200, request);
    } catch (e) {
      return jsonResponse({ success: false, cached: false, error: 'Invalid session data.' }, 500, request);
    }
  }

  if (method === 'POST') {
    return jsonResponse({
      success: false,
      error: 'Unauthorized: Direct session forging via POST /api/session is disabled. Authenticate via /api/login.'
    }, 403, request);
  }

  if (method === 'DELETE') {
    const token = extractSessionToken(request);
    if (token) {
      await env.SESSION_KV.delete(`session:${token}`);
      await env.SESSION_KV.delete(`admin_session:${token}`);
    }
    const headers = {
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
    };
    return jsonResponse({ success: true, message: 'Session logged out' }, 200, request, headers);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405, request);
}

// =====================================================================
// PROXY REQUEST & CLIENT INJECTION
// =====================================================================
async function handleProxyRequest(request, env, url) {
  const gasExecUrl = env.GAS_EXEC_URL || DEFAULT_GAS_EXEC_URL;
  const targetUrl = new URL(gasExecUrl);

  url.searchParams.forEach((val, key) => {
    targetUrl.searchParams.set(key, val);
  });

  const modifiedHeaders = new Headers(request.headers);
  modifiedHeaders.set('Host', 'script.google.com');

  const init = {
    method: request.method,
    headers: modifiedHeaders,
    redirect: 'follow'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  const response = await fetch(targetUrl.toString(), init);

  const contentType = response.headers.get('content-type') || '';
  const newHeaders = new Headers(response.headers);
  const origin = request.headers.get('Origin');
  if (origin && isAllowedOrigin(origin)) {
    newHeaders.set('Access-Control-Allow-Origin', origin);
    newHeaders.set('Access-Control-Allow-Credentials', 'true');
  } else {
    newHeaders.set('Access-Control-Allow-Origin', 'null');
  }
  newHeaders.set('Permissions-Policy', 'camera=*, microphone=*, geolocation=*, clipboard-write=*');
  newHeaders.delete('X-Frame-Options');
  newHeaders.set('x-edge-worker', 'zolexora-ims-d1-proxy');

  if (contentType.includes('text/html')) {
    let html = await response.text();
    const d1BridgeScript = `
<script>
/** Zolexora IMS Cloudflare D1 Native Edge RPC Bridge **/
(function() {
  function createD1Bridge(successHandler, failureHandler) {
    return new Proxy({}, {
      get(target, prop) {
        if (prop === 'withSuccessHandler') return function(fn) { return createD1Bridge(fn, failureHandler); };
        if (prop === 'withFailureHandler') return function(fn) { return createD1Bridge(successHandler, fn); };
        return async function(...args) {
          try {
            var res = await fetch('/api/rpc/' + prop, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ args: args })
            });
            var data = await res.json();
            if (successHandler) successHandler(data);
            return data;
          } catch (err) {
            if (failureHandler) failureHandler(err);
            else console.error('D1 RPC error on ' + prop, err);
            throw err;
          }
        };
      }
    });
  }
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createD1Bridge();
  window.ZOLEXORA_DB_ENGINE = 'Cloudflare D1 (Serverless SQL)';
})();
</script>
`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', d1BridgeScript + '</head>');
    } else {
      html = d1BridgeScript + html;
    }

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

// =====================================================================
// UTILITIES & AUTHENTICATION MIDDLEWARE
// =====================================================================

async function authenticateRequest(request, env) {
  const token = extractSessionToken(request);
  if (!token || !env.SESSION_KV) return null;
  let raw = await env.SESSION_KV.get('session:' + token);
  if (!raw) {
    raw = await env.SESSION_KV.get('admin_session:' + token);
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

function extractSessionToken(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`)) || cookieHeader.match(/zolexora_admin_session=([^;]+)/);
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

async function authenticateUserSession(request, env) {
  const token = getSessionToken(request);
  if (!token) return null;
  if (env.SESSION_KV) {
    try {
      const raw = await env.SESSION_KV.get(`session:${token}`, { type: 'json' });
      if (raw && raw.user) {
        if (raw.expiresAt && new Date(raw.expiresAt) < new Date()) {
          return null;
        }
        return raw;
      }
    } catch (e) {
      return null;
    }
  }
  return null;
}

function generateSessionId() {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return 'sess_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

const ALLOWED_ORIGINS = new Set([
  'https://ims.zolexora.com',
  'https://admin.ims.zolexora.com',
  'https://ims.zolexora.workers.dev',
  'https://admin-ims.zolexora.workers.dev'
]);

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
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  };
  if (extraHeaders instanceof Headers) {
    for (const [k, v] of extraHeaders.entries()) {
      headers[k] = v;
    }
  } else if (extraHeaders && typeof extraHeaders === 'object') {
    Object.assign(headers, extraHeaders);
  }

  if (allowed) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  } else {
    headers['Access-Control-Allow-Origin'] = 'null';
  }

  return new Response(JSON.stringify(data, null, 2), {
    status: status,
    headers: headers
  });
}

function htmlResponse(html) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'x-edge-worker': 'zolexora-ims-edge'
    }
  });
}

function prefersHtml(request, url) {
  if (url.searchParams.has('json') || url.searchParams.get('format') === 'json') {
    return false;
  }
  if (url.searchParams.has('view') || url.searchParams.get('format') === 'html') {
    return true;
  }
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

