import { LogOut, Building2, Users, ShieldAlert, Menu } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAdminAuth } from '../features/auth/useAdminAuth';

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const NAV = [
  { id: 'tenants', label: 'Tenants', icon: Building2 },
  { id: 'members',  label: 'Members',  icon: Users },
];

export function AdminLayout({ children, activeTab, onTabChange }: AdminLayoutProps) {
  const { user, signOut } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-brand-black">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-silver-900/60 bg-brand-near transition-transform duration-200 lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-silver-900/60 px-5">
          <img src="/logo.png" alt="Zolexora" className="h-9 w-9 rounded-xl object-contain" />
          <div>
            <div className="text-sm font-bold text-white">Zolexora TMS</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-silver-600">Admin Panel</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { onTabChange(id); setMobileOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                activeTab === id
                  ? 'bg-navy-600 text-white shadow-md'
                  : 'text-silver-400 hover:bg-silver-900/40 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-silver-900/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 border border-navy-600">
              <ShieldAlert className="h-4 w-4 text-silver-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-silver-200">{user?.email}</p>
              <p className="text-[10px] text-silver-600">Platform Admin</p>
            </div>
            <button onClick={signOut} className="rounded-lg p-1.5 text-silver-600 hover:bg-silver-900 hover:text-silver-300 transition" title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-brand-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="flex h-14 items-center border-b border-silver-900/60 px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-silver-400 hover:bg-silver-900">
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-3 text-sm font-semibold text-white">Admin Panel</span>
        </div>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
