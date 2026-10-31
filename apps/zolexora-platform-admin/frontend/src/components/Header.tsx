'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { fetchSystemHealth, fetchDatabaseHealth } from '@/lib/api';

export default function Header() {
  const pathname = usePathname();
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'unhealthy'>('healthy');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadHealth = async () => {
    setIsRefreshing(true);
    try {
      const [sysHealth, dbHealth] = await Promise.all([
        fetchSystemHealth(),
        fetchDatabaseHealth(),
      ]);
      if (sysHealth.status === 'ok' && dbHealth.overall_status === 'healthy') {
        setHealthStatus('healthy');
      } else {
        setHealthStatus('degraded');
      }
    } catch {
      setHealthStatus('degraded');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { href: '/', label: 'Fleet Overview' },
    { href: '/databases', label: 'Database & Storage Capacity' },
    { href: '/accounts', label: 'Dynamic Account Manager' },
    { href: '/email', label: 'Email Operations Panel' },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Info */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-md shadow-indigo-500/20 text-lg">
                Z
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold tracking-wider text-base text-white">ZOLEXORA</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                    CONTROL PLANE
                  </span>
                </div>
                <p className="text-xs text-slate-400">Platform Admin • Port 3082</p>
              </div>
            </Link>
          </div>

          {/* Quick Health & Environment Badges */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="text-slate-400">Environments:</span>
              <span className="font-medium text-emerald-400">P1 (Edge)</span>
              <span className="text-slate-600">•</span>
              <span className="font-medium text-sky-400">P2 (K3s ARM)</span>
            </div>

            <button
              onClick={loadHealth}
              title="Click to refresh system health"
              className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                healthStatus === 'healthy'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  healthStatus === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>{healthStatus === 'healthy' ? 'Operational' : 'Degraded'}</span>
              {isRefreshing && <span className="text-[10px] opacity-75">↻</span>}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-4 border-t border-slate-800/80 pt-1 pb-2 overflow-x-auto">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
