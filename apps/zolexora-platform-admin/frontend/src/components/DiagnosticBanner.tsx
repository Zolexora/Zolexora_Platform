'use client';

import React, { useState } from 'react';
import { AccountDiagnosticAlert } from '@/lib/types';

interface DiagnosticBannerProps {
  alerts: AccountDiagnosticAlert[];
  overallThresholdAlert?: boolean;
}

export default function DiagnosticBanner({
  alerts,
  overallThresholdAlert = false,
}: DiagnosticBannerProps) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const activeAlerts = alerts.filter((a, idx) => !dismissed[`${a.event}-${a.target_product}-${idx}`]);

  if (activeAlerts.length === 0 && !overallThresholdAlert) {
    return null;
  }

  const dismiss = (key: string) => {
    setDismissed((prev) => ({ ...prev, [key]: true }));
  };

  return (
    <div className="space-y-2 mb-6">
      {/* 90% Database Storage Threshold Alert */}
      {overallThresholdAlert && !dismissed['db-threshold'] && (
        <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-rose-950/80 border border-rose-700/60 text-rose-200 text-sm shadow-sm">
          <div className="flex items-start sm:items-center space-x-3">
            <span className="text-xl sm:text-2xl">🚨</span>
            <div>
              <span className="font-semibold text-rose-100">
                Critical Storage Threshold Exceeded (≥90% Free Tier):
              </span>{' '}
              One or more PostgreSQL/MongoDB clusters have surpassed safe capacity limits.{' '}
              <span className="underline font-medium">Autonomous archival recommended</span> to prevent connection throttling.
            </div>
          </div>
          <button
            onClick={() => dismiss('db-threshold')}
            className="ml-3 text-rose-400 hover:text-rose-100 text-xs px-2 py-1 rounded bg-rose-900/60 hover:bg-rose-900 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Account Missing Credential / Degraded Diagnostics */}
      {activeAlerts.map((alert, idx) => {
        const key = `${alert.event}-${alert.target_product}-${idx}`;
        const isCritical = alert.severity === 'CRITICAL';
        return (
          <div
            key={key}
            className={`flex items-center justify-between p-3 sm:p-4 rounded-lg text-sm border shadow-sm ${
              isCritical
                ? 'bg-rose-950/70 border-rose-800 text-rose-200'
                : 'bg-amber-950/70 border-amber-800 text-amber-200'
            }`}
          >
            <div className="flex items-start sm:items-center space-x-3">
              <span className="text-xl">{isCritical ? '⚠️' : '⚡'}</span>
              <div>
                <span className="font-bold uppercase tracking-wider text-xs px-2 py-0.5 rounded bg-black/40 mr-2 border border-white/10">
                  {alert.event}
                </span>
                <span className="font-semibold">
                  Product: {alert.target_product} ({alert.provider})
                </span>
                <p className="mt-0.5 text-xs text-slate-300">
                  {alert.message} — Expected Secret:{' '}
                  <code className="text-amber-300 font-mono bg-black/30 px-1 py-0.5 rounded">
                    {alert.expected_secret}
                  </code>{' '}
                  at Infisical path{' '}
                  <code className="text-slate-300 font-mono bg-black/30 px-1 py-0.5 rounded">
                    {alert.infisical_path}
                  </code>
                </p>
              </div>
            </div>
            <button
              onClick={() => dismiss(key)}
              className="ml-3 text-xs px-2 py-1 rounded bg-black/30 hover:bg-black/50 text-slate-300 transition-colors"
            >
              Dismiss
            </button>
          </div>
        );
      })}
    </div>
  );
}
