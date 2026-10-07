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
import OnboardingPage from './pages/shared-pages/onboarding-page';
import NotFoundPage from './pages/shared-pages/not-found-page';

// Supabase Auth
import { useAuth } from './lib/auth-context';
import { LogOut, UserCircle2, Loader2, Store, Boxes, ShieldCheck } from 'lucide-react';

/**
 * Route guard enforcing authentic Supabase session.
 * Unauthenticated requests are intercepted and redirected to /login.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080e] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-xs font-mono tracking-wider">Verifying Supabase Session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

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
                  <span className="text-emerald-400 font-medium">POS Register Terminal (Desk SP_001)</span>
                </>
              ) : isCmdRoute ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>Workspace:</span>
                  <span className="text-purple-300 font-medium">Command Panel (Corporate Governance)</span>
                </>
              ) : (
                <>
                  <Boxes className="w-4 h-4 text-indigo-400" />
                  <span>Workspace:</span>
                  <span className="text-white font-medium">Zolexora Retail Operations (Inventory Master)</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <UserCircle2 className="w-4 h-4 text-indigo-400" />
                <span className="text-slate-300 font-medium">{user.email}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                  isPosRoute
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : isCmdRoute
                    ? 'bg-gradient-to-r from-purple-500/30 to-indigo-500/30 text-purple-200 border-purple-500/40 font-bold uppercase tracking-wider shadow-xs'
                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                }`}>
                  {isCmdRoute ? 'Commander' : user.user_metadata?.name || (isPosRoute ? 'POS Cashier' : 'Staff')}
                </span>
              </div>
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
            <Route path="/onboarding" element={<OnboardingPage />} />

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
                <ProtectedRoute>
                  <POSDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/online-orders"
              element={
                <ProtectedRoute>
                  <POSOnlineOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/orders"
              element={
                <ProtectedRoute>
                  <POSOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/tables"
              element={
                <ProtectedRoute>
                  <POSTables />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/menu"
              element={
                <ProtectedRoute>
                  <POSMenu />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/customers"
              element={
                <ProtectedRoute>
                  <POSCustomers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/cash-drawer"
              element={
                <ProtectedRoute>
                  <POSCashDrawer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/reports"
              element={
                <ProtectedRoute>
                  <POSReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos/settings"
              element={
                <ProtectedRoute>
                  <POSSettings />
                </ProtectedRoute>
              }
            />

            {/* Command Panel (Commander Governance) Core Routes */}
            <Route
              path="/cmd-panal"
              element={
                <ProtectedRoute>
                  <CmdDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cmd-panal/dashboard"
              element={
                <ProtectedRoute>
                  <CmdDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cmd-panal/payments"
              element={
                <ProtectedRoute>
                  <CmdPaymentSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cmd-panal/users"
              element={
                <ProtectedRoute>
                  <CmdUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cmd-panal/sites"
              element={
                <ProtectedRoute>
                  <CmdSiteManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cmd-panal/company"
              element={
                <ProtectedRoute>
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
                <ProtectedRoute>
                  <div className="p-6 overflow-y-auto flex-1"><Dashboard /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/products"
              element={
                <ProtectedRoute>
                  <div className="p-6 overflow-y-auto flex-1"><Products /></div>
                </ProtectedRoute>
              }
            />
            <Route path="/inv/catalog" element={<Navigate to="/inv/products" replace />} />
            <Route path="/inv/items" element={<Navigate to="/inv/products" replace />} />
            <Route
              path="/inv/requisitions"
              element={
                <ProtectedRoute>
                  <div className="p-6 overflow-y-auto flex-1"><Requisitions /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/suppliers"
              element={
                <ProtectedRoute>
                  <div className="p-6 overflow-y-auto flex-1"><Suppliers /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/issuance-logs"
              element={
                <ProtectedRoute>
                  <div className="p-6 overflow-y-auto flex-1"><IssuanceLogs /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/reports"
              element={
                <ProtectedRoute>
                  <div className="p-6 overflow-y-auto flex-1"><Reports /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/users"
              element={
                <ProtectedRoute>
                  <div className="p-6 overflow-y-auto flex-1"><Users /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/site-management"
              element={
                <ProtectedRoute>
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
                <ProtectedRoute>
                  <div className="p-6 overflow-y-auto flex-1"><SKUaddition /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/forms/purchase-entry"
              element={
                <ProtectedRoute>
                  <div className="p-6 overflow-y-auto flex-1"><PurchaseEntry /></div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inv/forms/issuance-entry"
              element={
                <ProtectedRoute>
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
