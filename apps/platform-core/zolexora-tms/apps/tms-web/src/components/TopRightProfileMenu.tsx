import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Building2,
  ChevronDown,
  Crown,
  LogOut,
  Settings,
  Shield,
  UserCircle2,
  Users,
} from 'lucide-react';

export interface ProfileMenuItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface TopRightProfileMenuProps {
  displayName: string;
  subtitle: string;
  organisationName: string;
  organisationType?: string;
  zolexoraOrgId?: string | null;
  roleLabel: string;
  isCommander?: boolean;
  personalSignedIn?: boolean;
  profileHref: string;
  adminItems: ProfileMenuItem[];
  onSwitchBusiness: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  accent?: 'navy' | 'cyan';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TopRightProfileMenu({
  displayName,
  subtitle,
  organisationName,
  organisationType,
  zolexoraOrgId,
  roleLabel,
  isCommander = false,
  personalSignedIn = false,
  profileHref,
  adminItems,
  onSwitchBusiness,
  onSignOut,
  accent = 'navy',
}: TopRightProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const goTo = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  const avatarBg =
    accent === 'cyan'
      ? 'bg-cyan-900/60 text-cyan-200 border-cyan-700/50'
      : 'bg-navy-600/80 text-white border-navy-500/50';

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-left hover:border-slate-700 hover:bg-slate-800/80 transition"
      >
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${avatarBg}`}
        >
          {getInitials(displayName)}
        </div>
        <div className="hidden sm:flex flex-col min-w-0 max-w-[150px]">
          <span className="truncate text-xs font-semibold text-slate-100 leading-tight">
            {displayName}
          </span>
          <span className="truncate text-[10px] text-slate-400 leading-tight">
            {organisationName} · {isCommander ? 'Commander' : roleLabel}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-black/60 backdrop-blur-xl z-50 overflow-hidden"
        >
          {/* User + Workspace Header */}
          <div className="border-b border-slate-800/80 bg-slate-950/50 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${avatarBg}`}
              >
                {getInitials(displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                <p className="truncate font-mono text-[11px] text-slate-400">{subtitle}</p>
              </div>
            </div>
            <div className="mt-2.5 rounded-lg border border-slate-800/80 bg-slate-900/80 px-2.5 py-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-slate-200">{organisationName}</span>
                {isCommander ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-silver-900/40 px-2 py-0.5 text-[10px] font-semibold text-silver-300 border border-silver-700/30">
                    <Crown className="h-2.5 w-2.5" />
                    Commander
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 border border-slate-700">
                    <Shield className="h-2.5 w-2.5" />
                    {roleLabel}
                  </span>
                )}
              </div>
              {(organisationType || zolexoraOrgId) && (
                <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                  <span className="truncate">{organisationType || ''}</span>
                  {zolexoraOrgId && <span className="font-mono shrink-0">{zolexoraOrgId}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Account Actions */}
          <div className="p-1.5">
            <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Account
            </p>
            <button
              type="button"
              role="menuitem"
              onClick={() => goTo(profileHref)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 hover:text-white transition"
            >
              <UserCircle2 className="h-4 w-4 text-slate-400" />
              <span>My Account &amp; 2FA</span>
            </button>
            {personalSignedIn && (
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  setOpen(false);
                  await onSwitchBusiness();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 hover:text-white transition"
              >
                <ArrowLeftRight className="h-4 w-4 text-cyan-400" />
                <span>Switch Business</span>
              </button>
            )}
          </div>

          {/* Administration Section */}
          {adminItems.length > 0 && (
            <div className="border-t border-slate-800/80 p-1.5">
              <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Administration
              </p>
              {adminItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    role="menuitem"
                    onClick={() => goTo(item.href)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 hover:text-white transition"
                  >
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sign Out */}
          <div className="border-t border-slate-800/80 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await onSignOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const SP_ADMIN_MENU_ITEMS: ProfileMenuItem[] = [
  { label: 'Workspace & RBAC', href: '/settings', icon: Settings },
  { label: 'Roles & Permissions', href: '/settings/roles', icon: Shield },
  { label: 'Members & Access', href: '/settings/members', icon: Users },
  { label: 'Operating Units', href: '/settings/operating-units', icon: Building2 },
];

export const CLIENT_ADMIN_MENU_ITEMS: ProfileMenuItem[] = [
  { label: 'Settings & Team', href: '/client/settings', icon: Settings },
];
