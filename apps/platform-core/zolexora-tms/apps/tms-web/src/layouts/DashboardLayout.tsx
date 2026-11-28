
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Truck,
  LayoutDashboard,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Radio,
  Users,
  Building2,
  FileText,
  CreditCard,
  Receipt,
  Shield,
  Crown,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../features/auth/useAuth';
import { useApplicationRuntime } from '../providers/ApplicationRuntimeProvider';
import { resolveServiceConfig } from '../lib/serviceConfig';
import { SidebarBrand, useSidebarCollapsed } from '../components/SidebarBrand';
import { TopRightProfileMenu, SP_ADMIN_MENU_ITEMS } from '../components/TopRightProfileMenu';



const navigation = [
  {
    section: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Operations',
    items: [
      { name: 'Bookings', href: '/bookings', icon: CalendarCheck },
      { name: 'Shift Rosters', href: '/rosters', icon: CalendarClock },
      { name: 'Duties', href: '/duties', icon: ClipboardList },
      { name: 'Dispatch Board', href: '/dispatch', icon: Radio },
      { name: 'SLA & Safety Audit', href: '/reports/sla-safety', icon: Shield },
    ],
  },
  {
    section: 'Compliance & Fleet',
    items: [
      { name: 'Compliance & Rules', href: '/compliance', icon: Shield },
      { name: 'Vehicles', href: '/compliance/vehicles', icon: Truck },
      { name: 'Drivers', href: '/compliance/drivers', icon: Users },
      { name: 'Clients', href: '/compliance/customers', icon: Building2 },
      { name: 'Vendors', href: '/compliance/vendors', icon: Building2 },
    ],
  },
  {
    section: 'Billing & Receivables',
    items: [
      { name: 'Customer Rate Cards', href: '/rate-cards/customers', icon: FileText },
      { name: 'Billing', href: '/billing', icon: FileText },
      { name: 'Invoices', href: '/invoices', icon: Receipt },
      { name: 'Payments', href: '/payments', icon: CreditCard },
      { name: 'Receivables', href: '/receivables', icon: CreditCard },
    ],
  },
  {
    section: 'Vendor Payments',
    items: [
      { name: 'Vendor Rate Cards', href: '/rate-cards/vendors', icon: FileText },
      { name: 'Payables', href: '/payables', icon: Receipt },
      { name: 'Vendor Settlements', href: '/vendor-settlements', icon: Receipt },
      { name: 'Payment History', href: '/vendor-payments', icon: CreditCard },
    ],
  },
  {
    section: 'Finances',
    items: [
      { name: 'Expenses', href: '/expenses', icon: Receipt },
      { name: 'Profit & Loss', href: '/reports/pnl', icon: FileText },
      { name: 'Financial Periods', href: '/financial-periods', icon: FileText },
    ],
  },
  {
    section: 'Client Portal',
    items: [
      { name: 'Book Transport', href: '/client-bookings', icon: CalendarCheck },
      { name: 'Trip Tracking', href: '/client-duties', icon: Radio },
      { name: 'Client Invoices', href: '/client-invoices', icon: Receipt },
      { name: 'Client Payments', href: '/client-payments', icon: CreditCard },
    ],
  },
];

export function DashboardLayout() {
  const { user, authMe, organisation, zolexoraOrgId, personalSignedIn, isCommander, switchBusiness, signOut } = useAuth();
  const runtime = useApplicationRuntime();
  const serviceConfig = resolveServiceConfig(runtime, authMe?.workspace_type);
  const navigate = useNavigate();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();

  const opsModule = runtime.modules['operations'];
  const financeModule = runtime.modules['finance'];

  const filteredNavigation = navigation.map(group => {
    if (group.section === 'Client Portal') {
      return serviceConfig.client ? group : { ...group, items: [] };
    }
    if (group.section !== 'Overview' && !serviceConfig.service_provider) {
      return { ...group, items: [] };
    }
    // Check canonical module & page flags (`!== false` so absent keys default to enabled).
    if (group.section === 'Operations') {
      if (opsModule?.enabled === false) return { ...group, items: [] };
      return {
        ...group,
        items: group.items.filter(item => {
          if (!serviceConfig.passenger && (item.name === 'Shift Rosters' || item.name === 'SLA & Safety Audit')) {
            return false;
          }
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
          subtitle="Transport Hub"
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />

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

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-full border border-silver-700/30 bg-silver-900/60 px-3 py-1 text-xs font-medium text-silver-300">
              <span className="h-2 w-2 rounded-full bg-silver-300 animate-pulse" />
              API Connected: Render
            </div>

            <TopRightProfileMenu
              displayName={authMe?.full_name || user?.email || 'Authenticated User'}
              subtitle={authMe?.zolexora_id || user?.email || 'Manage Account'}
              organisationName={organisation?.name || 'Zolexora TMS'}
              organisationType={organisation?.organisation_type || 'Transport Org'}
              zolexoraOrgId={zolexoraOrgId || (organisation?.id ? organisation.id.substring(0, 6) : null)}
              roleLabel={authMe?.role_code || 'Member'}
              isCommander={isCommander}
              personalSignedIn={personalSignedIn}
              profileHref="/profile"
              adminItems={SP_ADMIN_MENU_ITEMS}
              onSwitchBusiness={handleSwitchBusiness}
              onSignOut={handleSignOut}
              accent="navy"
            />
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
