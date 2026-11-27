
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Truck,
  LayoutDashboard,
  CalendarCheck,
  ClipboardList,
  Radio,
  Users,
  Building2,
  FileText,
  CreditCard,
  Receipt,
  Settings,
  Shield,
  Crown,
  ChevronRight,
  UserCircle2,
  ArrowLeftRight,
} from 'lucide-react';
import { useAuth } from '../features/auth/useAuth';
import { useApplicationRuntime } from '../providers/ApplicationRuntimeProvider';
import { SidebarBrand, SidebarUserFooter, useSidebarCollapsed } from '../components/SidebarBrand';



const navigation = [
  {
    section: 'Overview',
    items: [
      { name: 'Dashboard', href: '/sp/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Operations',
    items: [
      { name: 'Bookings', href: '/sp/bookings', icon: CalendarCheck },
      { name: 'Duties', href: '/sp/duties', icon: ClipboardList },
      { name: 'Dispatch Board', href: '/sp/dispatch', icon: Radio },
    ],
  },
  {
    section: 'Compliance & Fleet',
    items: [
      { name: 'Vehicles', href: '/sp/compliance/vehicles', icon: Truck },
      { name: 'Drivers', href: '/sp/compliance/drivers', icon: Users },
      { name: 'Clients', href: '/sp/compliance/customers', icon: Building2 },
      { name: 'Vendors', href: '/sp/compliance/vendors', icon: Building2 },
    ],
  },
  {
    section: 'Billing & Receivables',
    items: [
      { name: 'Customer Rate Cards', href: '/sp/rate-cards/customers', icon: FileText },
      { name: 'Billing', href: '/sp/billing', icon: FileText },
      { name: 'Invoices', href: '/sp/invoices', icon: Receipt },
      { name: 'Payments', href: '/sp/payments', icon: CreditCard },
      { name: 'Receivables', href: '/sp/receivables', icon: CreditCard },
    ],
  },
  {
    section: 'Vendor Payments',
    items: [
      { name: 'Vendor Rate Cards', href: '/sp/rate-cards/vendors', icon: FileText },
      { name: 'Payables', href: '/sp/payables', icon: Receipt },
      { name: 'Vendor Settlements', href: '/sp/vendor-settlements', icon: Receipt },
      { name: 'Payment History', href: '/sp/vendor-payments', icon: CreditCard },
    ],
  },
  {
    section: 'Finances',
    items: [
      { name: 'Expenses', href: '/sp/expenses', icon: Receipt },
      { name: 'Profit & Loss', href: '/sp/reports/pnl', icon: FileText },
      { name: 'Financial Periods', href: '/sp/financial-periods', icon: FileText },
    ],
  },
  {
    section: 'Administration',
    items: [
      { name: 'Workspace & RBAC', href: '/sp/settings', icon: Settings },
      { name: 'Roles & Permissions', href: '/sp/settings/roles', icon: Shield },
      { name: 'Members & Access', href: '/sp/settings/members', icon: Users },
      { name: 'Operating Units', href: '/sp/settings/operating-units', icon: Building2 },
      { name: 'My Account & 2FA', href: '/sp/profile', icon: UserCircle2 },
    ],
  },
];

export function DashboardLayout() {
  const { user, authMe, organisation, zolexoraOrgId, personalSignedIn, isCommander, switchBusiness, signOut } = useAuth();
  const runtime = useApplicationRuntime();
  const navigate = useNavigate();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();

  const opsModule = runtime.modules['operations'];
  const financeModule = runtime.modules['finance'];

  const filteredNavigation = navigation.map(group => {
    // Check canonical module & page flags (`!== false` so absent keys default to enabled).
    if (group.section === 'Operations') {
      if (opsModule?.enabled === false) return { ...group, items: [] };
      return {
        ...group,
        items: group.items.filter(item => {
          const pageCode =
            item.name === 'Bookings' ? 'bookings' :
            item.name === 'Duties' ? 'duties' :
            item.name === 'Dispatch Board' ? 'dispatch' : null;
          return !pageCode || opsModule?.pages?.[pageCode]?.enabled !== false;
        }),
      };
    }
    if (group.section === 'Billing & Receivables' && (financeModule?.enabled === false || financeModule?.pages?.['billing']?.enabled === false)) {
      return { ...group, items: [] };
    }
    return group;
  }).filter(group => group.items.length > 0);

  const handleSignOut = async () => {
    await signOut();
    navigate('/authentication');
  };

  const handleSwitchBusiness = async () => {
    await switchBusiness();
    navigate('/authentication');
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-800/80 bg-slate-900/90 backdrop-blur-xl transition-all duration-200 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <SidebarBrand
          applicationName={runtime.branding.application_name}
          logoUrl={runtime.branding.logo_url}
          subtitle="Transport Hub"
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />

        {/* Organisation Context Card */}
        {collapsed ? (
          <div className="border-b border-slate-800/60 p-2.5 flex flex-col items-center gap-2">
            <div
              title={organisation?.name || 'Workspace'}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60 text-silver-400"
            >
              {isCommander ? <Crown className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            </div>
            {personalSignedIn && (
              <button
                type="button"
                onClick={handleSwitchBusiness}
                title="Switch Business"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/70 text-slate-300 hover:border-cyan-500/40 hover:text-white transition"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 border-b border-slate-800/60">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 truncate max-w-[140px]">
                  {organisation?.name || 'Loading Workspace...'}
                </span>
                {isCommander ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-silver-900/30 px-2 py-0.5 text-[10px] font-semibold text-silver-500 border border-silver-700/30">
                    <Crown className="h-3 w-3" />
                    Commander
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-navy-800/40 px-2 py-0.5 text-[10px] font-semibold text-silver-500 border border-navy-600/30">
                    <Shield className="h-3 w-3" />
                    {authMe?.role_code || 'Member'}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                <span className="truncate">{organisation?.organisation_type || 'Transport Org'}</span>
                <span className="font-mono text-[9px] text-slate-500">
                  {zolexoraOrgId || (organisation?.id ? organisation.id.substring(0, 6) : '---')}
                </span>
              </div>
              {personalSignedIn && (
                <button
                  type="button"
                  onClick={handleSwitchBusiness}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 py-1 text-[11px] text-slate-300 hover:border-cyan-500/40 hover:text-white transition"
                >
                  <ArrowLeftRight className="h-3 w-3" /> Switch Business
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-4 ${collapsed ? 'px-2 space-y-3' : 'px-3 space-y-6'}`}>
          {filteredNavigation.map((group) => (
            <div key={group.section} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.section}
                </p>
              )}
              <div className={collapsed ? 'space-y-1' : 'mt-2 space-y-0.5'}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      title={collapsed ? item.name : undefined}
                      className={({ isActive }) =>
                        `group flex items-center rounded-lg text-sm font-medium transition ${
                          collapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                        } ${
                          isActive
                            ? 'bg-navy-600 text-white shadow-md shadow-navy-800/20'
                            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                        }`
                      }
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.name}</span>}
                      </div>
                      {!collapsed && (
                        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <SidebarUserFooter
          profileTo="/sp/profile"
          displayName={authMe?.full_name || user?.email || 'Authenticated User'}
          subtitle={authMe?.zolexora_id || 'Manage Account'}
          collapsed={collapsed}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Main Content Area */}
      <div className={`flex flex-1 flex-col min-w-0 transition-all duration-200 ${collapsed ? 'pl-20' : 'pl-64'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Workspace</span>
            <span>/</span>
            <span className="font-semibold text-slate-200">{organisation?.name || 'Zolexora TMS'}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-silver-700/30 bg-silver-900/60 px-3 py-1 text-xs font-medium text-silver-300">
              <span className="h-2 w-2 rounded-full bg-silver-300 animate-pulse" />
              API Connected: Render
            </div>

            {isCommander && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-silver-700/30 bg-silver-900/30 px-3 py-1 text-xs font-medium text-silver-400">
                <Crown className="h-3.5 w-3.5" />
                Commander Authority Active
              </span>
            )}
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
