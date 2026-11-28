import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  MapPin,
  Receipt,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../features/auth/useAuth';
import { useApplicationRuntime } from '../providers/ApplicationRuntimeProvider';
import { SidebarBrand, useSidebarCollapsed } from '../components/SidebarBrand';
import { TopRightProfileMenu, CLIENT_ADMIN_MENU_ITEMS } from '../components/TopRightProfileMenu';

const clientNavigation = [
  {
    section: 'Overview',
    items: [
      { name: 'Dashboard', href: '/client/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Transport',
    items: [
      { name: 'Book Transport', href: '/client/bookings', icon: CalendarCheck },
      { name: 'Trip Tracking', href: '/client/duties', icon: MapPin },
    ],
  },
  {
    section: 'Finance',
    items: [
      { name: 'Invoices', href: '/client/invoices', icon: Receipt },
      { name: 'Payments', href: '/client/payments', icon: CreditCard },
    ],
  },
];

export function ClientDashboardLayout() {
  const { user, authMe, organisation, zolexoraOrgId, personalSignedIn, switchBusiness, signOut } = useAuth();
  const runtime = useApplicationRuntime();
  const navigate = useNavigate();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();

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
          subtitle="Client Portal"
          subtitleClassName="text-cyan-500"
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-4 ${collapsed ? 'px-2 space-y-3' : 'px-3 space-y-6'}`}>
          {clientNavigation.map((group) => (
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
                            ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/30'
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
            <span>Client Portal</span>
            <span>/</span>
            <span className="font-semibold text-slate-200">{organisation?.name || 'Zolexora TMS'}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-full border border-cyan-700/30 bg-cyan-900/20 px-3 py-1 text-xs font-medium text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              Client Workspace
            </div>

            <TopRightProfileMenu
              displayName={authMe?.full_name || user?.email || 'Authenticated User'}
              subtitle={authMe?.zolexora_id || user?.email || 'Manage Account'}
              organisationName={organisation?.name || 'Client Workspace'}
              organisationType={organisation?.organisation_type || 'Client Organisation'}
              zolexoraOrgId={zolexoraOrgId}
              roleLabel="Client"
              personalSignedIn={personalSignedIn}
              profileHref="/client/profile"
              adminItems={CLIENT_ADMIN_MENU_ITEMS}
              onSwitchBusiness={handleSwitchBusiness}
              onSignOut={handleSignOut}
              accent="cyan"
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
