'use client';

import React, { useState } from 'react';
import { FleetService } from '@/lib/types';

interface FleetGridProps {
  services: FleetService[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function FleetGrid({ services, onRefresh, isLoading = false }: FleetGridProps) {
  const [selectedEnv, setSelectedEnv] = useState<'ALL' | 'P1' | 'P2'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'frontend' | 'backend' | 'database' | 'worker' | 'edge'>('ALL');

  const filteredServices = services.filter((svc) => {
    // Environment filter
    if (selectedEnv === 'P1' && !svc.environment.startsWith('Production-1')) return false;
    if (selectedEnv === 'P2' && !svc.environment.startsWith('Production-2')) return false;

    // Category filter
    if (categoryFilter !== 'ALL' && svc.category !== categoryFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        svc.name.toLowerCase().includes(q) ||
        svc.host.toLowerCase().includes(q) ||
        svc.endpoint.toLowerCase().includes(q) ||
        (svc.details && svc.details.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getStatusBadge = (status: FleetService['status']) => {
    switch (status) {
      case 'operational':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
            Operational
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
            Degraded
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5" />
            Critical
          </span>
        );
    }
  };

  const getCategoryBadge = (category: FleetService['category']) => {
    const colors: Record<string, string> = {
      frontend: 'bg-indigo-950 text-indigo-300 border-indigo-800',
      backend: 'bg-cyan-950 text-cyan-300 border-cyan-800',
      database: 'bg-emerald-950 text-emerald-300 border-emerald-800',
      worker: 'bg-purple-950 text-purple-300 border-purple-800',
      edge: 'bg-amber-950 text-amber-300 border-amber-800',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase border ${
          colors[category] || 'bg-slate-800 text-slate-300 border-slate-700'
        }`}
      >
        {category}
      </span>
    );
  };

  const operationalCount = services.filter((s) => s.status === 'operational').length;
  const degradedCount = services.filter((s) => s.status === 'degraded').length;
  const criticalCount = services.filter((s) => s.status === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Services</p>
          <p className="text-2xl font-bold text-white mt-1">{services.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Operational</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{operationalCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Degraded</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{degradedCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Critical</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">{criticalCount}</p>
        </div>
      </div>

      {/* Control Bar: Filter tabs & Search */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Environment Tabs */}
          <div className="inline-flex rounded-md shadow-sm bg-slate-800/80 p-0.5 border border-slate-700">
            <button
              onClick={() => setSelectedEnv('ALL')}
              className={`px-3 py-1 text-xs font-medium rounded ${
                selectedEnv === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Envs ({services.length})
            </button>
            <button
              onClick={() => setSelectedEnv('P1')}
              className={`px-3 py-1 text-xs font-medium rounded ${
                selectedEnv === 'P1'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Production-1 (Edge & PaaS)
            </button>
            <button
              onClick={() => setSelectedEnv('P2')}
              className={`px-3 py-1 text-xs font-medium rounded ${
                selectedEnv === 'P2'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Production-2 (K3s ARM)
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
            <option value="database">Database</option>
            <option value="worker">Worker</option>
            <option value="edge">Edge</option>
          </select>
        </div>

        {/* Search input & Refresh */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search service, host, endpoint..."
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none w-full md:w-64"
          />
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 flex items-center space-x-1 transition-colors whitespace-nowrap"
            >
              <span>{isLoading ? 'Refreshing...' : '↻ Refresh'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((svc) => (
          <div
            key={svc.id}
            className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-lg p-5 flex flex-col justify-between transition-all hover:shadow-lg hover:shadow-indigo-950/20"
          >
            <div>
              {/* Card Header: Category & Status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getCategoryBadge(svc.category)}
                  <span className="text-[11px] text-slate-400 font-mono">
                    {svc.host}
                  </span>
                </div>
                {getStatusBadge(svc.status)}
              </div>

              {/* Service Title */}
              <h3 className="text-base font-bold text-white tracking-tight">
                {svc.name}
              </h3>

              {svc.details && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {svc.details}
                </p>
              )}

              {/* Endpoint Link */}
              <div className="mt-3 p-2 bg-slate-950/70 border border-slate-800/80 rounded font-mono text-[11px] text-indigo-300 break-all select-all">
                {svc.endpoint}
              </div>
            </div>

            {/* Card Footer: Environment & Latency */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="truncate max-w-[170px]" title={svc.environment}>
                {svc.environment}
              </span>
              <div className="flex items-center space-x-1">
                <span className="text-slate-500">Latency:</span>
                <span
                  className={`font-semibold ${
                    svc.latency_ms < 30
                      ? 'text-emerald-400'
                      : svc.latency_ms < 80
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {svc.latency_ms > 0 ? `${svc.latency_ms}ms` : '—'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-12 bg-slate-900/50 rounded-lg border border-slate-800 text-slate-400 text-sm">
          No services match the current filter or search criteria.
        </div>
      )}
    </div>
  );
}
