'use client';

import React, { useEffect, useState } from 'react';
import AccountTable from '@/components/AccountTable';
import DiagnosticBanner from '@/components/DiagnosticBanner';
import { fetchAccounts } from '@/lib/api';
import { DiscoveredAccount, AccountDiagnosticAlert } from '@/lib/types';

export default function DynamicAccountsPage() {
  const [accounts, setAccounts] = useState<DiscoveredAccount[]>([]);
  const [alerts, setAlerts] = useState<AccountDiagnosticAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetchAccounts();
      setAccounts(res.accounts);
      setAlerts(res.alerts);
    } catch (e) {
      console.error('Failed to load accounts list:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    const interval = setInterval(loadAccounts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-white">
          Dynamic Account Manager & Infisical Secrets Sync
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Discovers multi-tenant accounts across Infisical workspace paths, tracks usage quotas, and triggers failovers.
        </p>
      </div>

      <DiagnosticBanner alerts={alerts} />

      {isLoading && accounts.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Loading discovered accounts...
        </div>
      ) : (
        <AccountTable
          initialAccounts={accounts}
          onAccountsUpdated={loadAccounts}
        />
      )}
    </div>
  );
}
