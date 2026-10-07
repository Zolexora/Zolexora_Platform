// ─── AUTH ───────────────────────────────────────────
const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes
let inactivityTimer;

function getSession() {
  try { return JSON.parse(sessionStorage.getItem('mm_session') || 'null'); } catch { return null; }
}
function saveSession(data) {
  sessionStorage.setItem('mm_session', JSON.stringify(data));
  resetInactivityTimer();
}
function clearSession() {
  sessionStorage.removeItem('mm_session');
}
function isLoggedIn() {
  return !!getSession()?.token;
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    clearSession();
    showToast('⏱️ Session expired due to inactivity', 'warning');
    setTimeout(() => { window.location.href = '/login.html?reason=inactive'; }, 1500);
  }, INACTIVITY_LIMIT);
}

// Reset timer on any user activity
['mousemove','keydown','click','scroll','touchstart'].forEach(evt => {
  document.addEventListener(evt, () => { if (isLoggedIn()) resetInactivityTimer(); }, { passive: true });
});

// ─── PROTECTED PAGES ────────────────────────────────
const PUBLIC_PAGES = ['login.html'];
function requireAuth() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (PUBLIC_PAGES.includes(page)) return;
  if (!isLoggedIn()) {
    window.location.href = '/login.html?reason=auth';
  } else {
    resetInactivityTimer();
  }
}

// ─── TOAST ──────────────────────────────────────────
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  const colors = { info: '#4d9fff', success: '#00d084', warning: '#ffd93d', error: '#ff4d4d' };
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:#1c1c1c;border:1px solid ${colors[type]};color:${colors[type]};padding:12px 20px;border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:slideIn 0.3s ease;max-width:320px`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ─── SIDEBAR ────────────────────────────────────────
async function initSidebar(activePage) {
  requireAuth();
  try {
    const res = await fetch('/sidebar.html');
    const html = await res.text();
    document.getElementById('sidebar-container').innerHTML = html;

    // Set active
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      if (item.getAttribute('data-page') === activePage) item.classList.add('active');
    });

    // Inject user info + logout into sidebar footer
    const session = getSession();
    if (session) {
      const footer = document.querySelector('.sidebar-footer');
      if (footer) {
        footer.innerHTML = `
          <div style="margin-bottom:10px">
            <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px">${session.name}</div>
            <div style="font-size:11px;color:var(--muted2)">${session.isAdmin ? '👑 Admin' : '👤 User'}</div>
          </div>
          <button onclick="logout()" style="width:100%;background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.2);color:var(--red);padding:7px;border-radius:6px;font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;transition:all 0.15s" onmouseover="this.style.background='rgba(255,77,77,0.15)'" onmouseout="this.style.background='rgba(255,77,77,0.08)'">
            Logout
          </button>
          <div style="margin-top:8px;font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace">v1.0.0 · Node.js</div>
          <div id="inactivityBar" style="margin-top:8px;height:2px;background:var(--border);border-radius:2px;overflow:hidden">
            <div id="inactivityFill" style="height:100%;background:var(--green);width:100%;transition:width 1s linear"></div>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:3px" id="inactivityLabel">Session active</div>
        `;
        startInactivityBar();
      }
    }
  } catch(e) { console.error('Sidebar load failed:', e); }
}

// ─── INACTIVITY BAR ─────────────────────────────────
let barInterval;
function startInactivityBar() {
  clearInterval(barInterval);
  let lastActivity = Date.now();
  ['mousemove','keydown','click','scroll'].forEach(evt => {
    document.addEventListener(evt, () => { lastActivity = Date.now(); }, { passive: true });
  });
  barInterval = setInterval(() => {
    const fill = document.getElementById('inactivityFill');
    const label = document.getElementById('inactivityLabel');
    if (!fill || !label) return;
    const elapsed = Date.now() - lastActivity;
    const pct = Math.max(0, 100 - (elapsed / INACTIVITY_LIMIT) * 100);
    fill.style.width = pct + '%';
    fill.style.background = pct > 50 ? 'var(--green)' : pct > 20 ? 'var(--yellow)' : 'var(--red)';
    const remaining = Math.max(0, Math.ceil((INACTIVITY_LIMIT - elapsed) / 1000));
    label.textContent = remaining > 60 ? `${Math.ceil(remaining/60)}m left` : `${remaining}s left`;
  }, 1000);
}

// ─── LOGOUT ─────────────────────────────────────────
function logout() {
  clearSession();
  clearTimeout(inactivityTimer);
  clearInterval(barInterval);
  showToast('👋 Logged out successfully', 'success');
  setTimeout(() => { window.location.href = '/login.html'; }, 800);
}