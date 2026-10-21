'use client';

import React, { useState } from 'react';
import { StorageQuotaMetric, ArchivePreviewResponse } from '@/lib/types';
import { previewArchive } from '@/lib/api';

interface CapacityGaugeProps {
  databases: StorageQuotaMetric[];
  overallThresholdAlert?: boolean;
}

export default function CapacityGauge({ databases, overallThresholdAlert = false }: CapacityGaugeProps) {
  const [selectedDbForArchive, setSelectedDbForArchive] = useState<string | null>(null);
  const [archiveResult, setArchiveResult] = useState<ArchivePreviewResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [targetPercent, setTargetPercent] = useState<number>(40);

  const handleOpenArchiveModal = async (dbName: string) => {
    setSelectedDbForArchive(dbName);
    setIsCalculating(true);
    try {
      const res = await previewArchive(dbName, targetPercent);
      setArchiveResult(res);
    } catch (e) {
      console.error('Failed to preview archive:', e);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleRecalculate = async () => {
    if (!selectedDbForArchive) return;
    setIsCalculating(true);
    try {
      const res = await previewArchive(selectedDbForArchive, targetPercent);
      setArchiveResult(res);
    } catch (e) {
      console.error('Failed to preview archive:', e);
    } finally {
      setIsCalculating(false);
    }
  };

  const getGaugeColor = (percentage: number) => {
    if (percentage < 70) {
      return {
        bar: 'bg-emerald-500',
        text: 'text-emerald-400',
        badge: 'bg-emerald-950 text-emerald-300 border-emerald-800',
        label: 'NORMAL',
      };
    }
    if (percentage < 90) {
      return {
        bar: 'bg-amber-500',
        text: 'text-amber-400',
        badge: 'bg-amber-950 text-amber-300 border-amber-800',
        label: 'WARNING',
      };
    }
    return {
      bar: 'bg-rose-500',
      text: 'text-rose-400',
      badge: 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse',
      label: 'CRITICAL',
    };
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {databases.map((db) => {
          const styling = getGaugeColor(db.usage_percentage);
          const isCritical = db.usage_percentage >= 90;
          const limitMb = Math.round(db.free_tier_limit_bytes / (1024 * 1024));

          return (
            <div
              key={`${db.service}-${db.project_or_cluster}`}
              className={`bg-slate-900 border rounded-lg p-5 flex flex-col justify-between transition-all ${
                isCritical
                  ? 'border-rose-700/80 shadow-lg shadow-rose-950/30'
                  : db.usage_percentage >= 70
                  ? 'border-amber-700/60'
                  : 'border-slate-800'
              }`}
            >
              <div>
                {/* Header: Service Name & State Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {db.service === 'supabase_postgresql' ? 'Supabase Postgres' : 'MongoDB Atlas'}
                    </span>
                    <h4 className="text-base font-bold text-white capitalize">
                      {db.project_or_cluster}
                    </h4>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${styling.badge}`}>
                    {styling.label}
                  </span>
                </div>

                {/* Free Tier Limit Progress */}
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-400">Capacity Used:</span>
                    <span className="font-mono text-slate-200">
                      <strong className={styling.text}>{db.used_pretty}</strong> / {limitMb} MB
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${styling.bar}`}
                      style={{ width: `${Math.min(100, Math.max(2, db.usage_percentage))}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>0 MB</span>
                    <span className={`font-bold ${styling.text}`}>
                      {db.usage_percentage.toFixed(1)}%
                    </span>
                    <span>{limitMb} MB (Free Tier)</span>
                  </div>
                </div>
              </div>

              {/* Action / Warning Footer */}
              <div className="mt-5 pt-3 border-t border-slate-800">
                {isCritical ? (
                  <div className="space-y-2">
                    <div className="inline-flex items-center px-2 py-1 rounded bg-rose-950/80 border border-rose-800 text-[11px] text-rose-300 font-medium w-full justify-center">
                      ⚠️ Autonomous Archive Recommended
                    </div>
                    <button
                      onClick={() => handleOpenArchiveModal(db.project_or_cluster)}
                      className="w-full px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold shadow transition-colors"
                    >
                      Run 90% Archival Preview
                    </button>
                  </div>
                ) : db.usage_percentage >= 70 ? (
                  <button
                    onClick={() => handleOpenArchiveModal(db.project_or_cluster)}
                    className="w-full px-3 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white rounded text-xs font-medium transition-colors"
                  >
                    Simulate Archival Preview
                  </button>
                ) : (
                  <p className="text-[11px] text-slate-400 text-center">
                    Healthy headroom — {(100 - db.usage_percentage).toFixed(1)}% remaining
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Archival Preview Modal */}
      {selectedDbForArchive && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Autonomous 90% Archival Simulator
                </h3>
                <p className="text-xs text-slate-400">
                  Target Database:{' '}
                  <span className="font-semibold text-indigo-400 capitalize">
                    {selectedDbForArchive}
                  </span>
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedDbForArchive(null);
                  setArchiveResult(null);
                }}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {isCalculating ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                <span className="inline-block animate-spin mr-2">⚙️</span>
                Analyzing table statistics and pinned hot exclusions...
              </div>
            ) : archiveResult ? (
              <div className="space-y-4 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Storage:</span>
                    <span className="font-mono text-white">
                      {(archiveResult.current_usage_bytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target Free Storage:</span>
                    <span className="font-mono text-emerald-400">
                      {(archiveResult.target_usage_bytes / (1024 * 1024)).toFixed(1)} MB (
                      {targetPercent}% capacity)
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/80 pt-2">
                    <span className="text-slate-400">Estimated Rows to Archive:</span>
                    <span className="font-bold text-rose-400 font-mono">
                      {archiveResult.estimated_rows_to_archive.toLocaleString()} rows
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Historical Cutoff Date:</span>
                    <span className="font-mono text-slate-300">
                      {new Date(archiveResult.cutoff_date).toLocaleDateString()} (older records moved to R2)
                    </span>
                  </div>
                </div>

                {archiveResult.pinned_tables_skipped.length > 0 && (
                  <div className="bg-amber-950/50 border border-amber-800/80 p-3 rounded-lg text-amber-200">
                    <span className="font-semibold">🔒 Hot Storage Protection Active:</span>
                    <p className="mt-1 text-[11px] text-amber-300/90">
                      The following pinned tables will be strictly preserved in active storage and skipped from archival:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {archiveResult.pinned_tables_skipped.map((tbl) => (
                        <span
                          key={tbl}
                          className="px-2 py-0.5 rounded bg-black/40 text-amber-300 font-mono text-[11px] border border-amber-700/60"
                        >
                          {tbl}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  <label className="text-slate-400">Target Capacity %:</label>
                  <input
                    type="number"
                    min={20}
                    max={70}
                    value={targetPercent}
                    onChange={(e) => setTargetPercent(Number(e.target.value))}
                    className="w-16 bg-slate-800 border border-slate-700 text-white px-2 py-1 rounded text-xs"
                  />
                  <button
                    onClick={handleRecalculate}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
                  >
                    Recalculate
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setSelectedDbForArchive(null);
                  setArchiveResult(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors"
              >
                Close Simulator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
