'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FleetIcon,
  DatabaseIcon,
  KeyIcon,
  EmailIcon,
  ApiDocsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
} from './icons';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const navItems = [
    {
      href: '/',
      label: 'Fleet Overview',
      shortLabel: 'Fleet',
      icon: FleetIcon,
      badge: 'P1 / P2',
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    },
    {
      href: '/databases',
      label: 'Databases & Storage',
      shortLabel: 'Databases',
      icon: DatabaseIcon,
      badge: '500MB Cap',
      badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
    },
    {
      href: '/accounts',
      label: 'Dynamic Accounts',
      shortLabel: 'Accounts',
      icon: KeyIcon,
      badge: 'Infisical',
      badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
    },
    {
      href: '/email',
      label: 'Email Operations',
      shortLabel: 'Email',
      icon: EmailIcon,
      badge: 'Failover',
      badgeColor: 'bg-sky-950 text-sky-300 border-sky-800',
    },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/80 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* 1. Header / Logo Area */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800/80">
        <Link
          href="/"
          className={`flex items-center space-x-3 overflow-hidden ${
            isCollapsed ? 'justify-center w-full' : ''
          }`}
          title="Zolexora Control Plane"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 font-black text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <span className="text-xl tracking-tighter">Z</span>
          </div>

          {!isCollapsed && (
            <div className="min-w-0 flex-1 transition-opacity duration-200">
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold tracking-wider text-sm text-white">ZOLEXORA</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                  ADMIN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate">Control Plane • 3095</p>
            </div>
          )}
        </Link>
      </div>

      {/* 2. Navigation Items */}
      <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto overflow-x-hidden">
        {/* Core Management Section */}
        <div>
          {!isCollapsed && (
            <h2 className="px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2">
              Core Management
            </h2>
          )}

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => setHoveredItem(item.href)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <Link
                    href={item.href}
                    className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                      isCollapsed
                        ? 'h-12 w-12 mx-auto justify-center'
                        : 'px-3.5 py-2.5 space-x-3 w-full'
                    } ${
                      isActive
                        ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30 ring-1 ring-white/10'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center shrink-0 transition-transform duration-200 ${
                        isActive ? 'scale-110 text-white' : 'group-hover:scale-110'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    {!isCollapsed && (
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span className="text-sm truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium border ${item.badgeColor}`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>

                  {/* Tooltip for Collapsed State */}
                  {isCollapsed && hoveredItem === item.href && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 pointer-events-none">
                      <div className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-100 text-xs font-medium shadow-2xl border border-slate-700 whitespace-nowrap flex items-center space-x-2">
                        <span>{item.label}</span>
                        {item.badge && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${item.badgeColor}`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Infrastructure & Tools Section */}
        <div>
          {!isCollapsed && (
            <h2 className="px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2">
              Infrastructure & APIs
            </h2>
          )}

          <nav className="space-y-1.5">
            {/* Swagger API Documentation link */}
            <div
              className="relative"
              onMouseEnter={() => setHoveredItem('/docs')}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <a
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center rounded-xl transition-all duration-200 group text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 ${
                  isCollapsed
                    ? 'h-12 w-12 mx-auto justify-center'
                    : 'px-3.5 py-2.5 space-x-3 w-full'
                }`}
              >
                <div className="flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <ApiDocsIcon className="w-5 h-5" />
                </div>

                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="text-sm truncate">API Docs (Swagger)</span>
                    <ExternalLinkIcon className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                  </div>
                )}
              </a>

              {/* Tooltip for Collapsed State */}
              {isCollapsed && hoveredItem === '/docs' && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 pointer-events-none">
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-100 text-xs font-medium shadow-2xl border border-slate-700 whitespace-nowrap flex items-center space-x-1.5">
                    <span>Swagger API Docs</span>
                    <ExternalLinkIcon className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>

      {/* 3. Footer / Collapse Trigger Area */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        {!isCollapsed && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">Local Platform</span>
              <span className="text-emerald-400 flex items-center space-x-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Docker Live</span>
              </span>
            </div>
            <div className="text-[10px] text-slate-500">Port 3095 Nginx Gateway</div>
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`flex items-center rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-all duration-200 border border-slate-700/50 ${
            isCollapsed
              ? 'h-10 w-10 mx-auto justify-center'
              : 'w-full px-3 py-2 justify-between text-xs font-medium'
          }`}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {!isCollapsed && <span>Collapse Sidebar</span>}
          <div className="flex items-center justify-center">
            {isCollapsed ? (
              <ChevronRightIcon className="w-4 h-4 text-indigo-400" />
            ) : (
              <ChevronLeftIcon className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>
      </div>
    </aside>
  );
}
