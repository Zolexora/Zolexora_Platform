import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { Users, Clock, UtensilsCrossed, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';

export interface PosTable {
  id: string;
  code: string;
  section: string;
  capacity: number;
  status: 'Vacant' | 'Occupied' | 'Billed';
  runningAmount?: number;
  activeTime?: string;
  currentGuest?: string;
  itemCount?: number;
}

interface TableRow {
  id: string;
  number: string;
  section: string;
  capacity: number;
  status: PosTable['status'];
  current_bill?: number;
  waiter?: string;
  items_count?: number;
  seated_since?: string;
}

const toTable = (r: TableRow): PosTable => ({
  id: r.id,
  code: r.number,
  section: r.section,
  capacity: r.capacity,
  status: r.status,
  runningAmount: r.current_bill || undefined,
  currentGuest: r.waiter || undefined,
  itemCount: r.items_count || undefined,
  activeTime: r.seated_since ? `${Math.max(0, Math.round((Date.now() - Date.parse(r.seated_since)) / 60000))}m` : undefined,
});

interface PosTableSelectorProps {
  selectedTable: string | null;
  onSelectTable: (table: PosTable) => void;
  onClose?: () => void;
}

export default function PosTableSelector({
  selectedTable,
  onSelectTable,
}: PosTableSelectorProps) {
  const { authFetch } = useAuth();
  const [tables, setTables] = useState<PosTable[]>([]);
  const [activeSection, setActiveSection] = useState<string>('All');
  const [draft, setDraft] = useState({ number: '', section: '', capacity: 4 });

  const load = () =>
    authFetch('/api/v1/tables')
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: TableRow[]) => setTables(rows.map(toTable)))
      .catch(() => setTables([]));
  useEffect(() => {
    load();
  }, []);

  const addTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const number = draft.number.trim();
    if (!number) return;
    const res = await authFetch('/api/v1/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: number.toUpperCase().replace(/\W+/g, '-'), number, section: draft.section.trim() || 'Main', capacity: draft.capacity }),
    }).catch(() => null);
    if (!res?.ok) {
      alert('Table not saved.');
      return;
    }
    setDraft({ ...draft, number: '' });
    load();
  };

  const sections = ['All', ...Array.from(new Set(tables.map((t) => t.section)))];
  const filtered = activeSection === 'All' ? tables : tables.filter((t) => t.section === activeSection);

  const totalOccupied = tables.filter((t) => t.status === 'Occupied').length;
  const totalBilled = tables.filter((t) => t.status === 'Billed').length;
  const totalVacant = tables.filter((t) => t.status === 'Vacant').length;

  return (
    <div className="flex-1 flex flex-col bg-[#0b0d14] overflow-hidden p-4 space-y-4">
      {/* Top Section Tabs & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        {/* Sections */}
        <div className="flex items-center gap-1.5 bg-[#121420] p-1 rounded-xl border border-white/10">
          {sections.map((sec) => (
            <button
              key={sec}
              onClick={() => setActiveSection(sec)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSection === sec
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Vacant ({totalVacant})</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Occupied ({totalOccupied})</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>Billed ({totalBilled})</span>
          </div>
        </div>
      </div>

      <form onSubmit={addTable} className="flex flex-wrap items-center gap-2 text-xs">
        <input
          value={draft.number}
          onChange={(e) => setDraft({ ...draft, number: e.target.value })}
          placeholder="Table no. (e.g. T-01)"
          className="bg-[#121420] border border-white/10 rounded-lg px-2 py-1.5 text-white w-36"
        />
        <input
          value={draft.section}
          onChange={(e) => setDraft({ ...draft, section: e.target.value })}
          placeholder="Section (e.g. Main Hall)"
          className="bg-[#121420] border border-white/10 rounded-lg px-2 py-1.5 text-white w-40"
        />
        <input
          type="number"
          min={1}
          value={draft.capacity}
          onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) || 1 })}
          className="bg-[#121420] border border-white/10 rounded-lg px-2 py-1.5 text-white w-16"
        />
        <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold">
          + Add table
        </button>
      </form>

      {tables.length === 0 && (
        <div className="py-10 text-center text-slate-500 text-xs">No tables yet. Add your first table above.</div>
      )}

      {/* Tables Grid */}
      <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        {filtered.map((table) => {
          const isSelected = selectedTable === table.code;

          let statusColor = 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300 hover:border-emerald-400';
          let badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

          if (table.status === 'Occupied') {
            statusColor = 'border-amber-500/40 bg-amber-950/20 text-amber-300 hover:border-amber-400';
            badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
          } else if (table.status === 'Billed') {
            statusColor = 'border-blue-500/40 bg-blue-950/20 text-blue-300 hover:border-blue-400';
            badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
          }

          if (isSelected) {
            statusColor = 'border-indigo-500 bg-indigo-950/40 ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20';
          }

          return (
            <button
              key={table.id}
              onClick={() => onSelectTable(table)}
              className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition group relative ${statusColor}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-black tracking-wide text-white group-hover:scale-105 transition">
                  {table.code}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-semibold border ${badgeColor}`}>
                  {table.status}
                </span>
              </div>

              <div className="my-2.5 space-y-1">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Users className="w-3 h-3 text-slate-500" />
                  <span>Cap: {table.capacity} Guests</span>
                </div>
                {table.status !== 'Vacant' && (
                  <>
                    <div className="text-[11px] font-semibold text-white truncate">
                      {table.currentGuest}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {table.activeTime}
                      </span>
                      <span className="font-mono text-white font-bold">
                        ₹{table.runningAmount}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="w-full pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-white transition">
                <span>{table.section}</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
