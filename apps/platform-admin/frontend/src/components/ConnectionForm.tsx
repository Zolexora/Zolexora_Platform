'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import { createConnection, fetchProviders, testConnection } from '@/lib/api';
import { ProbeResult, ProviderSpec, ProviderType } from '@/lib/types';

/** Register a provider account by naming the Infisical keys that hold its values. No values are typed here. */
export default function ConnectionForm({ onSaved }: { onSaved: () => void }) {
  const [providers, setProviders] = useState<ProviderSpec[]>([]);
  const [provider, setProvider] = useState<ProviderType>('supabase');
  const [name, setName] = useState('');
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'test' | 'save' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchProviders().then(setProviders).catch((e) => setResult({ ok: false, text: e.message }));
  }, []);

  const spec = providers.find((p) => p.provider === provider);
  const input = { provider, name, keys };

  const pickProvider = (p: ProviderType) => {
    setProvider(p);
    setKeys({});
    setResult(null);
  };

  const run = async (kind: 'test' | 'save') => {
    setBusy(kind);
    setResult(null);
    try {
      if (kind === 'test') {
        const probe: ProbeResult = await testConnection({ ...input, name: name || provider }); // name not needed to test
        setResult({
          ok: probe.status === 'healthy',
          text: `${probe.status === 'healthy' ? 'Connected' : 'Failed'}: ${probe.detail}${probe.latency_ms ? ` (${probe.latency_ms} ms)` : ''}`,
        });
      } else {
        await createConnection(input);
        setResult({ ok: true, text: `Connected "${name}".` });
        setName('');
        setKeys({});
        onSaved();
      }
    } catch (e: any) {
      setResult({ ok: false, text: e?.message || 'Request failed' });
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run('save');
  };

  const field =
    'w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none';

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div>
        <h3 className="text-base font-bold text-white">Add connection</h3>
        <p className="text-xs text-slate-400">
          Add the values in Infisical first (admin folder, or <code>sub/folder/KEY</code> below it), then enter the key names here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-400">
          Provider
          <select className={`${field} mt-1`} value={provider} onChange={(e) => pickProvider(e.target.value as ProviderType)}>
            {providers.map((p) => (
              <option key={p.provider} value={p.provider}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Name
          <input className={`${field} mt-1`} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Supabase Core" />
        </label>
        {spec?.fields.map((f) => (
          <label key={f.name} className="text-xs text-slate-400">
            {f.label} <span className="text-slate-600">– Infisical key{!f.required && ', optional'}</span>
            <input
              className={`${field} mt-1 font-mono`}
              autoComplete="off"
              spellCheck={false}
              required={f.required}
              placeholder={f.placeholder}
              value={keys[f.name] ?? ''}
              onChange={(e) => setKeys({ ...keys, [f.name]: e.target.value })}
            />
          </label>
        ))}
      </div>

      {spec?.hint && <p className="text-[11px] text-slate-500">{spec.hint}</p>}
      {result && <p className={`text-xs ${result.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{result.text}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!!busy || !spec}
          onClick={() => run('test')}
          className="rounded border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          {busy === 'test' ? 'Testing…' : 'Test'}
        </button>
        <button
          type="submit"
          disabled={!!busy || !spec}
          className="rounded bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
