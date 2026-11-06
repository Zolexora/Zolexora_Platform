'use client';

import React, { useEffect, useState } from 'react';
import { ActivityGroup, fetchActivityGroups, saveActivityGroup } from '@/lib/identity';

const field = 'bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200';

/** "What the business does": the list businesses pick from. Hidden groups stay on existing businesses but can't be chosen. */
export default function ActivityGroupsPage() {
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [draft, setDraft] = useState<ActivityGroup>({ key: '', label: '', hidden: false, sort_order: 500 });
  const [error, setError] = useState<string | null>(null);

  const load = () => fetchActivityGroups().then(setGroups).catch((e) => setError((e as Error).message));
  useEffect(() => { load(); }, []);

  const save = async (g: ActivityGroup) => {
    setError(null);
    try {
      await saveActivityGroup(g);
      load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-white">Activity groups</h1>
        <p className="text-sm text-slate-400 mt-1">
          The list businesses choose their main and other activities from. Official activities come from GST automatically.
        </p>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        <input className={field} placeholder="key (e.g. dairy)" value={draft.key}
          onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
        <input className={field} placeholder="Label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        <input className={`${field} w-24`} type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
        <button className="px-3 py-1.5 rounded text-xs font-semibold bg-indigo-700 text-white"
          onClick={async () => { if (await save(draft)) setDraft({ key: '', label: '', hidden: false, sort_order: 500 }); }}>
          + Add
        </button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-slate-500"><tr><th className="py-2">Label</th><th>Key</th><th>Order</th><th>Shown</th></tr></thead>
        <tbody className="divide-y divide-slate-800">
          {groups.map((g) => <Row key={g.key} group={g} onSave={save} />)}
        </tbody>
      </table>
    </div>
  );
}

function Row({ group, onSave }: { group: ActivityGroup; onSave: (g: ActivityGroup) => Promise<boolean> }) {
  const [g, setG] = useState(group);
  const changed = JSON.stringify(g) !== JSON.stringify(group);
  return (
    <tr className={g.hidden ? 'opacity-60' : ''}>
      <td className="py-1.5"><input className={`${field} w-full`} value={g.label} onChange={(e) => setG({ ...g, label: e.target.value })} /></td>
      <td className="text-xs text-slate-500 px-2">{g.key}</td>
      <td><input className={`${field} w-20`} type="number" value={g.sort_order} onChange={(e) => setG({ ...g, sort_order: Number(e.target.value) })} /></td>
      <td className="px-2"><input type="checkbox" checked={!g.hidden} onChange={(e) => setG({ ...g, hidden: !e.target.checked })} /></td>
      <td className="text-right">
        {changed && <button className="text-xs text-emerald-300" onClick={() => onSave(g)}>Save</button>}
      </td>
    </tr>
  );
}
