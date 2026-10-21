'use client';

import React from 'react';
import { ProviderQuotaMetric } from '@/lib/types';

interface EmailQuotaBarProps {
  providers: ProviderQuotaMetric[];
  totalSentToday?: number;
  deliveryRatePercent?: number;
  bounceRatePercent?: number;
}

export default function EmailQuotaBar({
  providers,
  totalSentToday = 0,
  deliveryRatePercent = 100.0,
  bounceRatePercent = 0.0,
}: EmailQuotaBarProps) {
  const getProviderColor = (providerName: string) => {
    switch (providerName) {
      case 'resend':
        return {
          name: 'Resend Primary',
          tier: '100 / day',
          badge: 'bg-slate-800 text-white border-slate-700',
        };
      case 'brevo':
        return {
          name: 'Brevo Backup',
          tier: '300 / day',
          badge: 'bg-sky-950 text-sky-300 border-sky-800',
        };
      case 'sendgrid':
        return {
          name: 'SendGrid Tertiary',
          tier: '100 / day',
          badge: 'bg-blue-950 text-blue-300 border-blue-800',
        };
      default:
        return {
          name: providerName,
          tier: 'Standard',
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Delivery Health Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Dispatched Today
          </p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-extrabold text-white">{totalSentToday}</span>
            <span className="text-xs text-slate-400">across 3 providers</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Delivery Success Rate
          </p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-extrabold text-emerald-400">
              {deliveryRatePercent}%
            </span>
            <span className="text-xs text-emerald-500/80 font-medium">99.9% target SLA</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Bounce & Error Rate
          </p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span
              className={`text-2xl font-extrabold ${
                bounceRatePercent > 2 ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {bounceRatePercent}%
            </span>
            <span className="text-xs text-slate-400">under 5% warning limit</span>
          </div>
        </div>
      </div>

      {/* Provider Daily Quota Progress Bars */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Daily Multi-Provider Quotas</h3>
            <p className="text-xs text-slate-400">
              Intelligent failover triggers automatically when provider daily capacity reaches ≥90%.
            </p>
          </div>
          <span className="text-xs font-mono text-indigo-400 px-2 py-1 rounded bg-indigo-950/60 border border-indigo-800/60">
            Failover order: Resend → Brevo → SendGrid
          </span>
        </div>

        <div className="space-y-4">
          {providers.map((p) => {
            const info = getProviderColor(p.provider);
            const percent = Math.min(100, Math.max(0, p.usage_percentage));
            const isCritical = percent >= 90 || p.is_throttled;

            return (
              <div
                key={p.account_id}
                className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${info.badge}`}>
                      {p.provider.toUpperCase()}
                    </span>
                    <span className="font-semibold text-white">{info.name}</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      ({p.account_id})
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-slate-300 font-mono">
                      <strong>{p.daily_used}</strong> / {p.daily_limit} today
                    </span>
                    <span
                      className={`font-semibold ${
                        isCritical
                          ? 'text-rose-400 font-bold'
                          : percent >= 70
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {percent.toFixed(1)}%
                    </span>
                    {p.is_throttled && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800 font-bold uppercase">
                        Throttled
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isCritical
                        ? 'bg-rose-500'
                        : percent >= 70
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>Remaining today: {p.remaining_today} emails</span>
                  <span>Free-tier cap: {info.tier}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
