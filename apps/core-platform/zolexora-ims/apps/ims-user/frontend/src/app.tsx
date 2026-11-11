import React from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import Sidepanal from './pages/inv-pages/sidepanal';
import PosSidepanal from './pages/pos-pages/sidepanal';
import Dashboard from './pages/inv-pages/dashboard';
import Products from './pages/inv-pages/products';
import Requisitions from './pages/inv-pages/requisitions';
import Suppliers from './pages/inv-pages/suppliers';
import IssuanceLogs from './pages/inv-pages/issuance-logs';
import Reports from './pages/inv-pages/reports';
import Users from './pages/inv-pages/users';
import SiteManagement from './pages/inv-pages/site-management';
import Profile from './pages/inv-pages/profile';
import SKUaddition from './pages/inv-pages/forms/sku-addition';
import PurchaseEntry from './pages/inv-pages/forms/purchase-entry';
import IssuanceEntry from './pages/inv-pages/forms/issuance-entry';
import POSDashboard from './pages/pos-pages/dashboard';
import POSOrders from './pages/pos-pages/orders';
import POSTables from './pages/pos-pages/tables';
import POSMenu from './pages/pos-pages/menu';
import POSCustomers from './pages/pos-pages/customers';
import POSCashDrawer from './pages/pos-pages/cash-drawer';
import POSReports from './pages/pos-pages/reports';
import POSSettings from './pages/pos-pages/settings';
import POSOnlineOrders from './pages/pos-pages/online-orders';

// Command Panel Pages
import CmdSidepanal from './pages/cmd-panal-pages/sidepanal';
import CmdDashboard from './pages/cmd-panal-pages/dashboard';
import CmdPaymentSetup from './pages/cmd-panal-pages/payment-setup';
import CmdUsers from './pages/cmd-panal-pages/users';
import CmdSiteManagement from './pages/cmd-panal-pages/site-management';
import CmdCompanyProfile from './pages/cmd-panal-pages/company-profile';

// Shared Pages
import LandingPage from './pages/shared-pages/landing-page';
import LoginPage from './pages/shared-pages/login-page';
import NotFoundPage from './pages/shared-pages/not-found-page';

import { useAuth } from './lib/auth-context';
import { LogOut, UserCircle2, Loader2, Store, Boxes, ShieldCheck } from 'lucide-react';

/** Needs a business session; with `perm`, also that ims:* (or org:*) permission. */
function ProtectedRoute({ children, perm }: { children: React.ReactNode; perm?: string }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080e] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-xs font-mono tracking-wider">Checking your session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (perm && !can(perm)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-10 text-center">
        <ShieldCheck className="w-8 h-8 text-slate-600 mb-3" />
        <p className="text-sm text-slate-300">You don't have access to this page.</p>
        <p className="text-xs mt-1">Ask your business owner for <span className="font-mono">{perm}</span>.</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, org, role, signOut, switchBusiness } = useAuth();

  // Public standalone authentication/onboarding routes
  const isPublicRoute = ['/landing', '/login', '/onboarding'].includes(location.pathname);
  const isPosRoute = location.pathname.startsWith('/pos');
  const isCmdRoute = location.pathname.startsWith('/cmd-panal') || location.pathname.startsWith('/admin') || location.pathname.startsWith('/org');

  // Track active workspace to eliminate accidental jumps between POS, INV, and COMMAND PANEL
  React.useEffect(() => {
    if (location.pathname.startsWith('/pos')) {
      localStorage.setItem('zolexora_last_app', 'pos');
    } else if (location.pathname.startsWith('/cmd-panal') || location.pathname.startsWith('/admin') || location.pathname.startsWith('/org')) {
      localStorage.setItem('zolexora_last_app', 'cmd-panal');
    } else if (location.pathname.startsWith('/inv')) {
      localStorage.setItem('zolexora_last_app', 'inv');
    }
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSwitch = async () => {
    await switchBusiness();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-[#07080e] text-slate-100 font-sans">
      {/* Dynamic Sidepanel: PosSidepanal for POS, CmdSidepanal for Command Panel, Sidepanal for Inventory */}
      {!isPublicRoute && user && (
        isPosRoute ? <PosSidepanal /> : isCmdRoute ? <CmdSidepanal /> : <Sidepanal />
      )}

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {!isPublicRoute && user && (
          <header className="h-14 border-b border-white/10 bg-[#0c0e18]/80 backdrop-blur-sm px-6 flex items-center justify-between sticky top-0 z-20 flex-shrink-0">
            <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
              {isPosRoute ? (
                <>
                  <Store className="w-4 h-4 text-emerald-400" />
                  <span>Workspace:</span>
                  <span className="text-emerald-400 font-medium">{org?.name}</span>
                </>
              ) : isCmdRoute ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>Workspace:</span>
                  <span className="text-purple-300 font-medium">{org?.name} · Command Panel</span>
                </>
              ) : (
                <>
                  <Boxes className="w-4 h-4 text-indigo-400" />
                  <span>Workspace:</span>
                  <span className="text-white font-medium">{org?.name}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <UserCircle2 className="w-4 h-4 text-indigo-400" />
                <span className="text-slate-300 font-medium">{user.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold border bg-indigo-500/20 text-indigo-300 border-indigo-500/30 capitalize">
                  {role || 'member'}
                </span>
              </div>
              <button
                onClick={handleSwitch}
                className="text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-lg transition"
                title="Switch business"
              >
                Switch business
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-2.5 py-1 rounded-lg transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-hidden flex flex-col">
          <Routes>
            {/* Public Unprotected Pages */}
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/onboarding" element={<Navigate to="/login" replace />} />

            {/* Main Application Entry Roots */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Navigate
                    to={
                      localStorage.getItem('zolexora_last_app') === 'pos'
                        ? '/pos/dashboard'
                        : localStorage.getItem('zolexora_last_app') === 'cmd-panal' ||
                          localStorage.getItem('zolexora_last_app') === 'admin' ||
                          localStorage.getItem('zolexora_last_app') === 'org'
                        ? '/cmd-panal/dashboard'
                        : '/inv/dashboard'
                    }
                    replace
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv"
              element={
                <ProtectedRoute>
                  <Navigate to="/inv/dashboard" replace />
                </ProtectedRoute>
              }
            />

            {/* POS Multipage App Routes */}
            <Route
              path="/pos"
              element={
                <ProtectedRoute>
                  <Navigate to="/pos/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/dashboard"
              element={
                <ProtectedRoute perm="ims:pos:sell">
                  <POSDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/online-orders"
              element={
                <ProtectedRoute perm="ims:orders:view">
                  <POSOnlineOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/orders"
              element={
                <ProtectedRoute perm="ims:orders:view">
                  <POSOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/tables"
              element={
                <ProtectedRoute perm="ims:pos:sell">
                  <POSTables />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/menu"
              element={
                <ProtectedRoute perm="ims:pos:manage">
                  <POSMenu />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/customers"
              element={
                <ProtectedRoute perm="ims:customers:manage">
                  <POSCustomers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/cash-drawer"
              element={
                <ProtectedRoute perm="ims:cash:manage">
                  <POSCashDrawer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/reports"
              element={
                <ProtectedRoute perm="ims:reports:view">
                  <POSReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/settings"
              element={
                <ProtectedRoute perm="ims:pos:manage">
                  <POSSettings />
                </ProtectedRoute>
              }
            />

            {/* Command Panel (Commander Governance) Core Routes */}
            <Route
              path="/cmd-panal"
              element={
                <ProtectedRoute perm="ims:reports:view">
                  <CmdDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cmd-panal/dashboard"
              element={
                <ProtectedRoute perm="ims:reports:view">
                  <CmdDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cmd-panal/payments"
              element={
                <ProtectedRoute perm="ims:payments:manage">
                  <CmdPaymentSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cmd-panal/users"
              element={
                <ProtectedRoute perm="org:team:view">
                  <CmdUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cmd-panal/sites"
              element={
                <ProtectedRoute perm="ims:sites:manage">
                  <CmdSiteManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cmd-panal/company"
              element={
                <ProtectedRoute perm="ims:company:manage">
                  <CmdCompanyProfile />
                </ProtectedRoute>
              }
            />

            {/* Seamless Fallback Aliases (Redirect legacy /admin/* and /org/* to /cmd-panal/*) */}
            <Route path="/admin" element={<ProtectedRoute><Navigate to="/cmd-panal/dashboard" replace /></ProtectedRoute>} />
            <Route path="/admin/dashboard" element={<ProtectedRoute><Navigate to="/cmd-panal/dashboard" replace /></ProtectedRoute>} />
            <Route path="/admin/payments" element={<ProtectedRoute><Navigate to="/cmd-panal/payments" replace /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><Navigate to="/cmd-panal/users" replace /></ProtectedRoute>} />
            <Route path="/admin/sites" element={<ProtectedRoute><Navigate to="/cmd-panal/sites" replace /></ProtectedRoute>} />
            <Route path="/admin/company" element={<ProtectedRoute><Navigate to="/cmd-panal/company" replace /></ProtectedRoute>} />

            <Route path="/org" element={<ProtectedRoute><Navigate to="/cmd-panal/dashboard" replace /></ProtectedRoute>} />
            <Route path="/org/dashboard" element={<ProtectedRoute><Navigate to="/cmd-panal/dashboard" replace /></ProtectedRoute>} />
            <Route path="/org/payments" element={<ProtectedRoute><Navigate to="/cmd-panal/payments" replace /></ProtectedRoute>} />
            <Route path="/org/users" element={<ProtectedRoute><Navigate to="/cmd-panal/users" replace /></ProtectedRoute>} />
            <Route path="/org/sites" element={<ProtectedRoute><Navigate to="/cmd-panal/sites" replace /></ProtectedRoute>} />
            <Route path="/org/company" element={<ProtectedRoute><Navigate to="/cmd-panal/company" replace /></ProtectedRoute>} />

            {/* Inventory Module Core Routes */}
            <Route
              path="/inv/dashboard"
              element={
                <ProtectedRoute perm="ims:dashboard:view">
                  <div className="p-6 overflow-y-auto flex-1"><Dashboard /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/products"
              element={
                <ProtectedRoute perm="ims:items:view">
                  <div className="p-6 overflow-y-auto flex-1"><Products /></div>
                </ProtectedRoute>
              }
            />
            <Route path="/inv/catalog" element={<Navigate to="/inv/products" replace />} />
            <Route path="/inv/items" element={<Navigate to="/inv/products" replace />} />
            <Route
              path="/inv/requisitions"
              element={
                <ProtectedRoute perm="ims:requisitions:manage">
                  <div className="p-6 overflow-y-auto flex-1"><Requisitions /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/suppliers"
              element={
                <ProtectedRoute perm="ims:suppliers:view">
                  <div className="p-6 overflow-y-auto flex-1"><Suppliers /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/issuance-logs"
              element={
                <ProtectedRoute perm="ims:items:view">
                  <div className="p-6 overflow-y-auto flex-1"><IssuanceLogs /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/reports"
              element={
                <ProtectedRoute perm="ims:reports:view">
                  <div className="p-6 overflow-y-auto flex-1"><Reports /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/users"
              element={
                <ProtectedRoute perm="org:team:view">
                  <div className="p-6 overflow-y-auto flex-1"><Users /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/site-management"
              element={
                <ProtectedRoute perm="ims:sites:manage">
                  <div className="p-6 overflow-y-auto flex-1"><SiteManagement /></div>
                </ProtectedRoute>
              }
            />
            <Route path="/inv/stores" element={<Navigate to="/inv/site-management" replace />} />
            <Route
              path="/inv/profile"
              element={
                <ProtectedRoute>
                  <div className="p-6 overflow-y-auto flex-1"><Profile /></div>
                </ProtectedRoute>
              }
            />

            {/* Protected Inventory Action Forms */}
            <Route
              path="/inv/forms/sku-addition"
              element={
                <ProtectedRoute perm="ims:items:manage">
                  <div className="p-6 overflow-y-auto flex-1"><SKUaddition /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/forms/purchase-entry"
              element={
                <ProtectedRoute perm="ims:purchases:create">
                  <div className="p-6 overflow-y-auto flex-1"><PurchaseEntry /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/forms/issuance-entry"
              element={
                <ProtectedRoute perm="ims:issuance:create">
                  <div className="p-6 overflow-y-auto flex-1"><IssuanceEntry /></div>
                </ProtectedRoute>
              }
            />

            {/* Legacy Path Aliases: Seamlessly redirect to /inv/* */}
            <Route path="/dashboard" element={<Navigate to="/inv/dashboard" replace />} />
            <Route path="/products" element={<Navigate to="/inv/products" replace />} />
            <Route path="/catalog" element={<Navigate to="/inv/products" replace />} />
            <Route path="/items" element={<Navigate to="/inv/products" replace />} />
            <Route path="/requisitions" element={<Navigate to="/inv/requisitions" replace />} />
            <Route path="/suppliers" element={<Navigate to="/inv/suppliers" replace />} />
            <Route path="/issuance-logs" element={<Navigate to="/inv/issuance-logs" replace />} />
            <Route path="/reports" element={<Navigate to="/inv/reports" replace />} />
            <Route path="/users" element={<Navigate to="/inv/users" replace />} />
            <Route path="/site-management" element={<Navigate to="/inv/site-management" replace />} />
            <Route path="/stores" element={<Navigate to="/inv/site-management" replace />} />
            <Route path="/profile" element={<Navigate to="/inv/profile" replace />} />
            <Route path="/forms/sku-addition" element={<Navigate to="/inv/forms/sku-addition" replace />} />
            <Route path="/forms/purchase-entry" element={<Navigate to="/inv/forms/purchase-entry" replace />} />
            <Route path="/forms/issuance-entry" element={<Navigate to="/inv/forms/issuance-entry" replace />} />

            {/* 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
