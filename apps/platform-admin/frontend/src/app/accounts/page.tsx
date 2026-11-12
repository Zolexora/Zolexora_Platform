'use client';

import React, { useEffect, useState } from 'react';
import AccountTable from '@/components/AccountTable';
import ConnectionForm from '@/components/ConnectionForm';
import { fetchAccounts } from '@/lib/api';
import { DiscoveredAccount } from '@/lib/types';

export default function ConnectionsPage() {
  const [accounts, setAccounts] = useState<DiscoveredAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAccounts = async () => {
    try {
      setAccounts((await fetchAccounts()).accounts);
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
        <h1 className="text-2xl font-black tracking-tight text-white">Connections</h1>
        <p className="text-sm text-slate-400 mt-1">
          Supabase, MongoDB, R2, email, Cloudflare and Firebase accounts to monitor and use. Values stay in Infisical; the panel only stores key names.
        </p>
      </div>

      <ConnectionForm onSaved={loadAccounts} />

      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading connections…</div>
      ) : (
        <AccountTable initialAccounts={accounts} onAccountsUpdated={loadAccounts} />
      )}
    </div>
  );
}
