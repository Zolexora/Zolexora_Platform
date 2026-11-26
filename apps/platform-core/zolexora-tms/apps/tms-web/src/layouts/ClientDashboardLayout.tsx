import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  MapPin,
  Receipt,
  CreditCard,
  Settings,
  LogOut,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../features/auth/useAuth';
import { useApplicationRuntime } from '../providers/ApplicationRuntimeProvider';

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
  {
    section: 'Account',
    items: [
      { name: 'Settings & Team', href: '/client/settings', icon: Settings },
    ],
  },
];

export function ClientDashboardLayout() {
  const { user, organisation, signOut } = useAuth();
  const runtime = useApplicationRuntime();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/authentication');
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800/80 bg-slate-900/90 backdrop-blur-xl">
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-800/80 px-6">
          <img src="/logo.png" alt="Zolexora TMS" className="h-10 w-10 rounded-xl object-contain" />
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-white text-base">{runtime.branding.application_name}</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-cyan-500">Client Portal</span>
          </div>
        </div>

        {/* Organisation Context Card */}
        <div className="p-4 border-b border-slate-800/60">
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 truncate max-w-[140px]">
                {organisation?.name || 'Loading...'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-900/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-700/30">
                <Building2 className="h-3 w-3" />
                Client
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">
              {organisation?.organisation_type || 'Client Organisation'}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {clientNavigation.map((group) => (
            <div key={group.section} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {group.section}
              </p>
              <div className="mt-2 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/30'
                            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                        }`
                      }
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.name}</span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="border-t border-slate-800/80 p-3">
          <div className="flex items-center justify-between rounded-lg bg-slate-950/40 p-2 border border-slate-800/60">
            <div className="flex flex-col truncate pr-2">
              <span className="text-xs font-medium text-slate-200 truncate">
                {user?.email || 'Authenticated User'}
              </span>
              <span className="text-[10px] text-slate-500">Client Account</span>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-64 flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Client Portal</span>
            <span>/</span>
            <span className="font-semibold text-slate-200">{organisation?.name || 'Zolexora TMS'}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-cyan-700/30 bg-cyan-900/20 px-3 py-1 text-xs font-medium text-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            Client Workspace
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
