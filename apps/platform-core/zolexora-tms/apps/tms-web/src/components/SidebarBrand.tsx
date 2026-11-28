import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, Menu, UserCircle2 } from 'lucide-react';

const SIDEBAR_STORAGE_KEY = 'tms-sidebar-collapsed';

/** Persists desktop sidebar collapsed state across page loads. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore storage quota / privacy-mode errors.
    }
  }, [collapsed]);

  return { collapsed, toggleCollapsed: () => setCollapsed((prev) => !prev) };
}

interface SidebarBrandProps {
  applicationName: string;
  subtitle: string;
  subtitleClassName?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/** Sidebar brand header with collapse toggle and safe title wrapping (logo removed). */
export function SidebarBrand({
  applicationName,
  subtitle,
  subtitleClassName = 'text-silver-500',
  collapsed = false,
  onToggleCollapse,
}: SidebarBrandProps) {
  return (
    <div
      className={`flex min-h-16 items-center border-b border-slate-800/80 py-3 ${
        collapsed ? 'justify-center px-3' : 'gap-2.5 px-3.5'
      }`}
    >
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand side panel' : 'Collapse side panel'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand side panel' : 'Collapse side panel'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/80 hover:text-white transition"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      {!collapsed && (
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            title={applicationName}
            className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-white"
          >
            {applicationName}
          </span>
          <span className={`mt-0.5 truncate text-[10px] font-medium uppercase tracking-widest ${subtitleClassName}`}>
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}

interface SidebarUserFooterProps {
  profileTo: string;
  displayName: string;
  subtitle: string;
  collapsed: boolean;
  onSignOut: () => void;
}

/** Sidebar user profile link and sign-out action adapted for expanded/collapsed widths. */
export function SidebarUserFooter({
  profileTo,
  displayName,
  subtitle,
  collapsed,
  onSignOut,
}: SidebarUserFooterProps) {
  return (
    <div className="border-t border-slate-800/80 p-3">
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-slate-950/40 p-2 border border-slate-800/60">
          <NavLink
            to={profileTo}
            title={displayName}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <UserCircle2 className="h-4 w-4" />
          </NavLink>
          <button
            type="button"
            onClick={onSignOut}
            title="Sign Out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg bg-slate-950/40 p-2 border border-slate-800/60">
          <NavLink to={profileTo} className="flex flex-col truncate pr-2 hover:text-white transition">
            <span className="text-xs font-medium text-slate-200 truncate">{displayName}</span>
            <span className="text-[10px] font-mono text-slate-500 truncate">{subtitle}</span>
          </NavLink>
          <button
            type="button"
            onClick={onSignOut}
            title="Sign Out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
