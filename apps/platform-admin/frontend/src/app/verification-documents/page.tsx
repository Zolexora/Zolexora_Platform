'use client';

import React, { useEffect, useState } from 'react';
import { DocumentType, fetchDocumentTypes, saveDocumentType } from '@/lib/identity';

const KINDS = ['individual', 'proprietor', 'company', 'llp', 'partnership', 'huf', 'trust', 'society', 'public_body'];
const CHECKS: DocumentType['check_type'][] = ['identity', 'pan', 'gst', 'registration', 'authority'];
const field = 'bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 w-full';
const blank: DocumentType = {
  key: '', label: '', check_type: 'registration', business_kinds: [], official_url: null, verify_url: null,
  instructions: '', active: true, sort_order: 500,
};

/** What businesses may upload for each check, where to download the authentic PDF, and where an admin verifies it. */
export default function VerificationDocumentsPage() {
  const [docs, setDocs] = useState<DocumentType[]>([]);
  const [edit, setEdit] = useState<DocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => fetchDocumentTypes().then(setDocs).catch((e) => setError((e as Error).message));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    setError(null);
    try {
      await saveDocumentType({ ...edit, official_url: edit.official_url || null, verify_url: edit.verify_url || null });
      setEdit(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Accepted documents</h1>
          <p className="text-sm text-slate-400 mt-1">
            The checks each business type needs are fixed in code. Here you choose which documents count, with the official download link and instructions businesses see.
          </p>
        </div>
        <button className="px-3 py-1.5 rounded text-xs font-semibold bg-indigo-700 text-white" onClick={() => setEdit({ ...blank })}>+ Add document</button>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {edit && (
        <div className="rounded-lg border border-indigo-800 p-4 grid gap-3 sm:grid-cols-2 text-sm">
          <label className="space-y-1"><span className="text-slate-400">Key</span>
            <input className={field} value={edit.key} disabled={docs.some((d) => d.key === edit.key)}
              onChange={(e) => setEdit({ ...edit, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
          </label>
          <label className="space-y-1"><span className="text-slate-400">Label</span>
            <input className={field} value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
          </label>
          <label className="space-y-1"><span className="text-slate-400">Check</span>
            <select className={field} value={edit.check_type} onChange={(e) => setEdit({ ...edit, check_type: e.target.value as DocumentType['check_type'] })}>
              {CHECKS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="space-y-1"><span className="text-slate-400">Order</span>
            <input type="number" className={field} value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} />
          </label>
          <label className="space-y-1"><span className="text-slate-400">Official download link (https)</span>
            <input className={field} value={edit.official_url ?? ''} onChange={(e) => setEdit({ ...edit, official_url: e.target.value })} />
          </label>
          <label className="space-y-1"><span className="text-slate-400">Admin verification page (https)</span>
            <input className={field} value={edit.verify_url ?? ''} onChange={(e) => setEdit({ ...edit, verify_url: e.target.value })} />
          </label>
          <div className="sm:col-span-2 space-y-1">
            <span className="text-slate-400">Business types (none ticked = all)</span>
            <div className="flex flex-wrap gap-3">
              {KINDS.map((k) => (
                <label key={k} className="flex items-center gap-1 text-slate-300">
                  <input type="checkbox" checked={edit.business_kinds.includes(k)}
                    onChange={(e) => setEdit({ ...edit, business_kinds: e.target.checked ? [...edit.business_kinds, k] : edit.business_kinds.filter((x) => x !== k) })} />
                  {k}
                </label>
              ))}
            </div>
          </div>
          <label className="sm:col-span-2 space-y-1"><span className="text-slate-400">Instructions shown to businesses</span>
            <textarea className={field} rows={4} value={edit.instructions} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-slate-300">
            <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Accepted
          </label>
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-1.5 rounded text-xs bg-slate-800 text-slate-200" onClick={() => setEdit(null)}>Cancel</button>
            <button className="px-3 py-1.5 rounded text-xs font-semibold bg-emerald-800 text-white" onClick={save}>Save</button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="text-left text-slate-500">
          <tr><th className="py-2">Document</th><th>Check</th><th>Types</th><th>Links</th><th></th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {docs.map((d) => (
            <tr key={d.key} className={d.active ? '' : 'opacity-50'}>
              <td className="py-2"><div className="text-slate-100">{d.label}</div><div className="text-xs text-slate-500">{d.key}</div></td>
              <td className="text-slate-300">{d.check_type}</td>
              <td className="text-xs text-slate-400">{d.business_kinds.length ? d.business_kinds.join(', ') : 'all'}</td>
              <td className="text-xs space-x-2">
                {d.official_url && <a className="text-sky-300 underline" href={d.official_url} target="_blank" rel="noopener noreferrer">download</a>}
                {d.verify_url && <a className="text-sky-300 underline" href={d.verify_url} target="_blank" rel="noopener noreferrer">verify</a>}
              </td>
              <td className="text-right"><button className="text-xs text-indigo-300" onClick={() => setEdit({ ...d })}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
