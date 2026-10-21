'use client';

import React, { useState } from 'react';
import { DiscoveredAccount, AccountStatus, AccountSyncResponse } from '@/lib/types';
import { syncAccounts, updateAccountStatus } from '@/lib/api';

interface AccountTableProps {
  initialAccounts: DiscoveredAccount[];
  onAccountsUpdated?: () => void;
}

export default function AccountTable({
  initialAccounts,
  onAccountsUpdated,
}: AccountTableProps) {
  const [accounts, setAccounts] = useState<DiscoveredAccount[]>(initialAccounts);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<AccountSyncResponse | null>(null);
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);
  const [filterProvider, setFilterProvider] = useState<string>('ALL');

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncAccounts();
      setSyncResult(res);
      if (onAccountsUpdated) onAccountsUpdated();
    } catch (e) {
      console.error('Account sync failed:', e);
      setSyncResult({
        status: 'failed',
        discovered_count: accounts.length,
        active_count: accounts.filter((a) => a.status === 'ACTIVE').length,
        throttled_count: accounts.filter((a) => a.status === 'QUOTA_THROTTLED').length,
        disconnected_count: accounts.filter((a) => a.status === 'DISCONNECTED').length,
        diagnostics: ['Infisical CLI authentication unavailable; fallback to environment secrets.'],
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatusChange = async (accountId: string, newStatus: AccountStatus) => {
    setUpdatingAccountId(accountId);
    try {
      const updated = await updateAccountStatus(accountId, newStatus);
      setAccounts((prev) =>
        prev.map((acc) => (acc.id === accountId ? { ...acc, status: updated.status } : acc))
      );
      if (onAccountsUpdated) onAccountsUpdated();
    } catch (e) {
      console.error(`Failed to update account ${accountId} status:`, e);
    } finally {
      setUpdatingAccountId(null);
    }
  };

  const getStatusBadge = (status: AccountStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
            ACTIVE
          </span>
        );
      case 'DRAINING':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">
            DRAINING
          </span>
        );
      case 'QUOTA_THROTTLED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950 text-rose-300 border border-rose-800">
            QUOTA_THROTTLED
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            DISCONNECTED
          </span>
        );
    }
  };

  const getProviderBadge = (provider: string) => {
    const map: Record<string, string> = {
      firebase: 'bg-amber-950 text-amber-300 border-amber-800',
      cloudflare: 'bg-orange-950 text-orange-300 border-orange-800',
      supabase: 'bg-emerald-950 text-emerald-300 border-emerald-800',
      mongodb: 'bg-green-950 text-green-300 border-green-800',
      resend: 'bg-slate-900 text-white border-slate-700',
      brevo: 'bg-sky-950 text-sky-300 border-sky-800',
      sendgrid: 'bg-blue-950 text-blue-300 border-blue-800',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase border ${
          map[provider] || 'bg-slate-800 text-slate-300 border-slate-700'
        }`}
      >
        {provider}
      </span>
    );
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (filterProvider !== 'ALL' && acc.provider !== filterProvider) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Action Bar with Sync Trigger & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 border border-slate-800 p-4 rounded-lg">
        <div>
          <h3 className="text-base font-bold text-white">Dynamic Account Discovery</h3>
          <p className="text-xs text-slate-400">
            Real-time multi-account registry from Infisical workspace paths and fallback env variables.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Providers</option>
            <option value="supabase">Supabase</option>
            <option value="mongodb">MongoDB</option>
            <option value="cloudflare">Cloudflare</option>
            <option value="firebase">Firebase</option>
            <option value="resend">Resend</option>
            <option value="brevo">Brevo</option>
            <option value="sendgrid">SendGrid</option>
          </select>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:opacity-60 text-white rounded text-xs font-semibold shadow flex items-center space-x-1.5 transition-colors whitespace-nowrap"
          >
            <span>{isSyncing ? '🔄 Syncing Infisical...' : '🔄 Re-sync from Infisical'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Feedback Toast/Banner */}
      {syncResult && (
        <div
          className={`p-3 rounded-lg text-xs border flex items-center justify-between ${
            syncResult.status === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-amber-950/80 border-amber-800 text-amber-200'
          }`}
        >
          <div>
            <span className="font-semibold uppercase tracking-wider mr-2">
              Sync Status: {syncResult.status}
            </span>
            Discovered {syncResult.discovered_count} accounts ({syncResult.active_count} active,{' '}
            {syncResult.throttled_count} throttled).
            {syncResult.diagnostics.length > 0 && (
              <p className="mt-1 text-[11px] opacity-90">{syncResult.diagnostics.join(' • ')}</p>
            )}
          </div>
          <button
            onClick={() => setSyncResult(null)}
            className="text-xs px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Accounts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Account Alias</th>
                <th className="px-4 py-3">Target / Project ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Quota Consumption</th>
                <th className="px-4 py-3">Latency</th>
                <th className="px-4 py-3 text-right">Operational Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredAccounts.map((account) => {
                const isUpdating = updatingAccountId === account.id;
                const quotaPercent = Math.min(100, Math.max(0, account.quota_percentage || 0));
                const isThrottled = account.status === 'QUOTA_THROTTLED' || quotaPercent >= 90;

                return (
                  <tr key={account.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      {getProviderBadge(account.provider)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {account.alias}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {account.project_id_or_account_id}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(account.status)}
                    </td>
                    <td className="px-4 py-3 min-w-[180px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">
                            {account.daily_quota_used !== null && account.daily_quota_used !== undefined
                              ? `${account.daily_quota_used} / ${account.daily_quota_total} (day)`
                              : account.monthly_quota_used !== null && account.monthly_quota_used !== undefined
                              ? `${(account.monthly_quota_used / (1024 * 1024)).toFixed(0)} MB / ${(
                                  (account.monthly_quota_total || 0) /
                                  (1024 * 1024)
                                ).toFixed(0)} MB`
                              : 'Dynamic quota'}
                          </span>
                          <span
                            className={`font-semibold ${
                              isThrottled ? 'text-rose-400' : 'text-slate-300'
                            }`}
                          >
                            {quotaPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isThrottled
                                ? 'bg-rose-500'
                                : quotaPercent >= 70
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${quotaPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {account.latency_ms ? `${account.latency_ms}ms` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <select
                        value={account.status}
                        disabled={isUpdating}
                        onChange={(e) =>
                          handleStatusChange(account.id, e.target.value as AccountStatus)
                        }
                        className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="DRAINING">DRAINING</option>
                        <option value="QUOTA_THROTTLED">QUOTA_THROTTLED</option>
                        <option value="DISCONNECTED">DISCONNECTED</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
