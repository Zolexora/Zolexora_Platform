'use client';

import React, { useEffect, useState } from 'react';
import { CatalogVersion, catalogAction, fetchCatalogVersions } from '@/lib/identity';

const badge: Record<CatalogVersion['status'], string> = {
  applied: 'text-emerald-300', approved: 'text-emerald-300', pending_approval: 'text-amber-300', rejected: 'text-rose-300',
};

/**
 * Products register their permissions on deploy. New permissions go live at once;
 * removals take access away from people, so they wait here until a platform admin approves them.
 */
export default function CatalogPage() {
  const [versions, setVersions] = useState<CatalogVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => fetchCatalogVersions().then(setVersions).catch((e) => setError((e as Error).message));
  useEffect(() => { load(); }, []);

  const act = async (v: CatalogVersion, action: 'approve' | 'reject' | 'rollback') => {
    const msg = {
      approve: `Remove ${v.removed.length} permission(s) from ${v.product} for every business? People lose that access now.`,
      reject: `Keep the ${v.removed.length} permission(s) ${v.product} wanted to remove?`,
      rollback: `Register ${v.product} version ${v.version} again? Any removals in it will wait for approval.`,
    }[action];
    if (!window.confirm(msg)) return;
    setBusy(v.id);
    setError(null);
    try {
      await catalogAction(v.id, action);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pending = versions.filter((v) => v.status === 'pending_approval');
  return (
    <div className="space-y-8">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-white">Permission catalog</h1>
        <p className="text-sm text-slate-400 mt-1">Additions are live at once. Removals wait for you. Every version can be rolled back.</p>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Waiting for approval ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-slate-500">Nothing waiting.</p>}
        {pending.map((v) => (
          <div key={v.id} className="rounded-lg border border-amber-800/60 p-4 space-y-2">
            <div className="font-semibold text-slate-100">{v.product} · version {v.version}</div>
            <div className="text-sm text-slate-300">Removes: {v.removed.map((k) => <code key={k} className="mr-2 text-rose-300">{k}</code>)}</div>
            {v.added.length > 0 && <div className="text-sm text-slate-400">Also added (already live): {v.added.join(', ')}</div>}
            <div className="flex gap-2">
              <button disabled={busy === v.id} className="px-3 py-1.5 rounded text-xs font-semibold bg-rose-900 text-rose-100" onClick={() => act(v, 'approve')}>Approve removal</button>
              <button disabled={busy === v.id} className="px-3 py-1.5 rounded text-xs bg-slate-800 text-slate-200" onClick={() => act(v, 'reject')}>Keep them</button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-bold text-white mb-2">History</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500"><tr><th className="py-2">Product</th><th>Version</th><th>Status</th><th>Added</th><th>Removed</th><th>When</th><th></th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {versions.map((v) => (
              <tr key={v.id}>
                <td className="py-1.5 text-slate-200">{v.product}</td>
                <td className="text-slate-300">{v.version}</td>
                <td className={badge[v.status]}>{v.status.replace('_', ' ')}</td>
                <td className="text-slate-400">{v.added.length}</td>
                <td className="text-slate-400">{v.removed.length}</td>
                <td className="text-xs text-slate-500">{new Date(v.created_at).toLocaleString()}</td>
                <td className="text-right">
                  <button disabled={busy === v.id} className="text-xs text-indigo-300" onClick={() => act(v, 'rollback')}>Roll back to this</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
