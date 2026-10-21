'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { fetchSystemHealth, fetchDatabaseHealth } from '@/lib/api';
import { MenuIcon, RefreshIcon, ApiDocsIcon } from './icons';

interface TopBarProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onMobileMenuToggle: () => void;
}

export default function TopBar({
  onToggleSidebar,
  onMobileMenuToggle,
}: TopBarProps) {
  const pathname = usePathname();
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'unhealthy'>('healthy');
  const [environment, setEnvironment] = useState<string>('Development');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>('');

  const loadHealth = async () => {
    setIsRefreshing(true);
    try {
      const [sysHealth, dbHealth] = await Promise.all([
        fetchSystemHealth(),
        fetchDatabaseHealth(),
      ]);
      setEnvironment(sysHealth.environment || 'Development');
      if (sysHealth.status === 'ok' && dbHealth.overall_status === 'healthy') {
        setHealthStatus('healthy');
      } else {
        setHealthStatus('degraded');
      }
      setLastCheck(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
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

  const getBreadcrumb = () => {
    switch (pathname) {
      case '/databases':
        return { category: 'Infrastructure', title: 'Database & Storage Capacity' };
      case '/accounts':
        return { category: 'Secrets & IAM', title: 'Dynamic Account Manager' };
      case '/email':
        return { category: 'Communications', title: 'Email Operations Panel' };
      default:
        return { category: 'Platform Core', title: 'Fleet Overview & Command Center' };
    }
  };

  const breadcrumb = getBreadcrumb();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-6 lg:px-8">
      {/* Left: Mobile Toggle + Breadcrumb */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Mobile Hamburger */}
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 focus:outline-none"
          title="Open Navigation Menu"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        {/* Desktop Collapse Toggle Shortcut */}
        <button
          onClick={onToggleSidebar}
          className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          title="Toggle Aside Panel"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        {/* Breadcrumb Display */}
        <div className="flex items-center space-x-2 text-xs sm:text-sm">
          <span className="text-slate-500 font-medium hidden md:inline">{breadcrumb.category}</span>
          <span className="text-slate-700 hidden md:inline">/</span>
          <span className="font-bold text-slate-100 tracking-tight text-sm sm:text-base">
            {breadcrumb.title}
          </span>
        </div>
      </div>

      {/* Right: Operational Status & Controls */}
      <div className="flex items-center space-x-2.5 sm:space-x-3.5">
        {/* Environment Badge */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
          <span className="text-slate-400">Environment:</span>
          <span className="font-semibold text-emerald-400 capitalize">{environment}</span>
          <span className="text-slate-600">•</span>
          <span className="font-semibold text-sky-400">Docker Gateway :3095</span>
        </div>

        {/* Swagger API Quick Link */}
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          title="Open Interactive Swagger Documentation"
        >
          <ApiDocsIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Swagger Docs</span>
        </a>

        {/* Refresh Trigger */}
        <button
          onClick={loadHealth}
          disabled={isRefreshing}
          className={`flex items-center justify-center p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors ${
            isRefreshing ? 'animate-spin text-indigo-400' : ''
          }`}
          title={lastCheck ? `Refreshed at ${lastCheck}` : 'Refresh health telemetry'}
        >
          <RefreshIcon className="w-4 h-4" />
        </button>

        {/* Health Status Indicator Badge */}
        <div
          className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
            healthStatus === 'healthy'
              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80 shadow-sm shadow-emerald-950'
              : 'bg-amber-950/70 text-amber-300 border-amber-800/80 shadow-sm shadow-amber-950'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              healthStatus === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="capitalize">{healthStatus === 'healthy' ? 'System Operational' : 'Degraded'}</span>
        </div>
      </div>
    </header>
  );
}
