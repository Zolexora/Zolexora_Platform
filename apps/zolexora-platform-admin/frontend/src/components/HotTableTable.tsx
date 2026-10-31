'use client';

import React, { useState } from 'react';
import { HotTableMetric } from '@/lib/types';
import { toggleArchiveExclusion } from '@/lib/api';

interface HotTableTableProps {
  tables: HotTableMetric[];
  onPinChange?: () => void;
}

export default function HotTableTable({ tables, onPinChange }: HotTableTableProps) {
  const [pinnedMap, setPinnedMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    tables.forEach((t) => {
      initial[`${t.schema_name}.${t.table_name}`] = !!t.is_pinned;
    });
    return initial;
  });

  const [togglingTable, setTogglingTable] = useState<string | null>(null);

  const handleTogglePin = async (schema: string, table: string) => {
    const fullName = `${schema}.${table}`;
    const nextState = !pinnedMap[fullName];
    setTogglingTable(fullName);

    // Optimistic update
    setPinnedMap((prev) => ({ ...prev, [fullName]: nextState }));

    try {
      await toggleArchiveExclusion(fullName, nextState);
      if (onPinChange) onPinChange();
    } catch (e) {
      console.error(`Failed to toggle pin for ${fullName}:`, e);
      // Revert on error
      setPinnedMap((prev) => ({ ...prev, [fullName]: !nextState }));
    } finally {
      setTogglingTable(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-white">
            Hot Data Profiling & Table Pinning
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Profiles largest cross-product tables, row estimates, read activity, and archival exclusions.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          <span>Pinned tables are protected from automated 90% pruning.</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/70 text-slate-400 uppercase font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Schema & Namespace</th>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Est. Row Count</th>
              <th className="px-4 py-3">Total Size</th>
              <th className="px-4 py-3">Read Activity Score</th>
              <th className="px-4 py-3 text-right">Hot Storage Pin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {tables.map((tbl) => {
              const fullName = `${tbl.schema_name}.${tbl.table_name}`;
              const isPinned = pinnedMap[fullName] ?? !!tbl.is_pinned;
              const isToggling = togglingTable === fullName;
              const activityScore = tbl.read_activity_score || 50;

              return (
                <tr key={fullName} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-indigo-300">
                    <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/60">
                      {tbl.schema_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">
                    {tbl.table_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {tbl.row_count_estimate.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                    {tbl.total_size_pretty}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${activityScore}%` }}
                        />
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {activityScore}/100
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleTogglePin(tbl.schema_name, tbl.table_name)}
                      disabled={isToggling}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all shadow-sm ${
                        isPinned
                          ? 'bg-amber-950 text-amber-200 border border-amber-700/80 hover:bg-amber-900/60'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <span>{isPinned ? '🔒' : '🔓'}</span>
                      <span>
                        {isToggling
                          ? 'Updating...'
                          : isPinned
                          ? 'Pinned to Hot Storage'
                          : 'Pin to Hot Storage'}
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tables.length === 0 && (
          <div className="p-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 text-slate-400">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7M4 7c0-2 1.5-3 3.5-3h9c2 0 3.5 1 3.5 3M4 7c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3m-16 5c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">No Cloud PostgreSQL Clusters Connected</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Real-time table size profiling, live row counts, and hot storage pin management require an active cloud Supabase connection via Infisical. Local PostgreSQL instances are strictly excluded.
              </p>
            </div>
            <div className="inline-block px-3 py-1 bg-slate-950 rounded text-[11px] font-mono text-indigo-300 border border-slate-800">
              Required path: <code className="text-slate-300">/shared/database-pool/SUPABASE_*_URL</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
