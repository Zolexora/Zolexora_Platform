'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckType, QueueItem, VStatus, VerificationDetail, decideVerification, documentUrl, fetchQueue, fetchVerification,
} from '@/lib/identity';

const CHECKS: (CheckType | '')[] = ['', 'identity', 'pan', 'gst', 'registration', 'authority', 'bank'];
const STATUSES: VStatus[] = ['pending', 'needs_revision', 'rejected', 'verified'];
const badge: Record<VStatus, string> = {
  pending: 'bg-amber-950 text-amber-300 border-amber-800',
  verified: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  rejected: 'bg-rose-950 text-rose-300 border-rose-800',
  needs_revision: 'bg-sky-950 text-sky-300 border-sky-800',
};
const field = 'bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200';
const button = 'px-3 py-1.5 rounded text-xs font-semibold border transition-colors disabled:opacity-50';

export default function VerificationsPage() {
  const [status, setStatus] = useState<VStatus>('pending');
  const [check, setCheck] = useState<CheckType | ''>('');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await fetchQueue(status, check || undefined));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [status, check]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-white">Verification queue</h1>
        <p className="text-sm text-slate-400 mt-1">
          Checks waiting for a decision: documents, name mismatches and anything a provider could not settle. Oldest first.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select className={field} value={status} onChange={(e) => setStatus(e.target.value as VStatus)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className={field} value={check} onChange={(e) => setCheck(e.target.value as CheckType | '')}>
          {CHECKS.map((c) => <option key={c} value={c}>{c || 'all checks'}</option>)}
        </select>
        <button className={`${button} bg-slate-800 border-slate-700 text-slate-200`} onClick={load}>↻ Refresh</button>
        {error && <span className="text-sm text-rose-400">{error}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg border border-slate-800 divide-y divide-slate-800">
          {items.length === 0 && <p className="p-4 text-sm text-slate-500">Nothing here.</p>}
          {items.map((i) => (
            <button
              key={i.id}
              onClick={() => setSelected(i.id)}
              className={`w-full text-left p-3 hover:bg-slate-800/60 ${selected === i.id ? 'bg-slate-800/80' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-100">{i.org_name ?? i.user_name ?? i.user_zolexora_id}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded border ${badge[i.status]}`}>{i.check_type}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {i.zolexora_org_id ?? i.user_zolexora_id} · {i.business_kind ?? 'person'} · via {i.provider}
                {i.value_last4 ? ` · ••${i.value_last4}` : ''}
              </div>
              {i.reason && <div className="text-xs text-amber-300/80 mt-1">{i.reason}</div>}
            </button>
          ))}
        </div>
        {selected ? <Detail id={selected} onDecided={() => { setSelected(null); load(); }} /> : (
          <p className="text-sm text-slate-500 p-4">Pick an item to review it.</p>
        )}
      </div>
    </div>
  );
}

function Detail({ id, onDecided }: { id: string; onDecided: () => void }) {
  const [d, setD] = useState<VerificationDetail | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setD(null);
    setReason('');
    fetchVerification(id).then(setD).catch((e) => setError((e as Error).message));
  }, [id]);

  const open = async (documentId: string) => {
    try {
      window.open((await documentUrl(documentId)).signed_url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const decide = async (s: VStatus) => {
    if (s !== 'verified' && reason.trim().length < 3) return setError('Write a reason the business can act on.');
    setBusy(true);
    try {
      await decideVerification(id, s, reason.trim() || undefined);
      onDecided();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!d) return <p className="text-sm text-slate-500 p-4">{error ?? 'Loading…'}</p>;
  const v = d.verification;
  return (
    <div className="rounded-lg border border-slate-800 p-4 space-y-5 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white capitalize">{v.check_type} check</h2>
        <p className="text-slate-400">Status <b className="text-slate-200">{v.status}</b> · via {v.provider}{v.method ? ` (${v.method})` : ''}</p>
        {v.reason && <p className="text-amber-300/90 mt-1">{v.reason}</p>}
      </div>

      {d.organization && (
        <dl className="grid grid-cols-[9rem_1fr] gap-y-1">
          <dt className="text-slate-500">Business</dt><dd className="text-slate-200">{d.organization.name} ({d.organization.zolexora_org_id})</dd>
          <dt className="text-slate-500">Legal name</dt><dd className="text-slate-200">{d.organization.legal_name ?? '—'}</dd>
          <dt className="text-slate-500">Trade name</dt><dd className="text-slate-200">{d.organization.trade_name ?? '—'}</dd>
          <dt className="text-slate-500">Type</dt><dd className="text-slate-200">{d.organization.business_kind}</dd>
          <dt className="text-slate-500">PAN</dt><dd className="font-mono text-slate-200">{d.organization.pan}</dd>
          <dt className="text-slate-500">Owner identity</dt><dd className="text-slate-200">{d.organization.owner_identity_names.join(', ') || 'not verified'}</dd>
        </dl>
      )}

      <dl className="grid grid-cols-[9rem_1fr] gap-y-1">
        <dt className="text-slate-500">Submitted value</dt>
        <dd className="font-mono text-slate-200 break-all">{d.value === null ? '—' : typeof d.value === 'string' ? d.value : JSON.stringify(d.value)}</dd>
        <dt className="text-slate-500">Name from source</dt><dd className="text-slate-200">{v.registered_name ?? '—'}</dd>
        {Object.entries(v.details ?? {}).filter(([, x]) => x !== null && x !== '').map(([k, x]) => (
          <React.Fragment key={k}>
            <dt className="text-slate-500">{k.replace(/_/g, ' ')}</dt>
            <dd className="text-slate-200 break-all">{typeof x === 'string' ? x : JSON.stringify(x)}</dd>
          </React.Fragment>
        ))}
      </dl>

      {d.documents.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-200 mb-2">Documents</h3>
          <ul className="space-y-2">
            {d.documents.map((doc) => (
              <li key={doc.document_id} className="flex flex-wrap items-center gap-2">
                <span className="text-slate-300">{doc.label ?? doc.document_type}</span>
                <button className={`${button} bg-indigo-950 border-indigo-800 text-indigo-200`} onClick={() => open(doc.document_id)}>
                  Open (15-minute link)
                </button>
                {doc.verify_url && (
                  <a className="text-xs text-sky-300 underline" href={doc.verify_url} target="_blank" rel="noopener noreferrer">
                    Verify on official portal ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-slate-200 mb-2">History</h3>
        <ol className="space-y-1 text-xs text-slate-400">
          {d.attempts.map((a, i) => (
            <li key={i}>
              {new Date(a.created_at).toLocaleString()} · {a.provider}{a.method ? `/${a.method}` : ''} · <b className="text-slate-300">{a.outcome}</b>
              {a.paid ? ' · paid' : ''}{a.registered_name ? ` · “${a.registered_name}”` : ''}{a.note ? ` · ${a.note}` : ''}
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-2 border-t border-slate-800 pt-4">
        <textarea
          className={`${field} w-full`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required to reject or ask for changes; shown to the business)"
        />
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className={`${button} bg-emerald-900 border-emerald-700 text-emerald-100`} onClick={() => decide('verified')}>Approve</button>
          <button disabled={busy} className={`${button} bg-sky-950 border-sky-800 text-sky-200`} onClick={() => decide('needs_revision')}>Ask for changes</button>
          <button disabled={busy} className={`${button} bg-rose-950 border-rose-800 text-rose-200`} onClick={() => decide('rejected')}>Reject</button>
        </div>
        {error && <p className="text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
