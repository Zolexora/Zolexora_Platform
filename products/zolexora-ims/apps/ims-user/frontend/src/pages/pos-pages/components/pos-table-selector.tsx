import React, { useState } from 'react';
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

const DEFAULT_TABLES: PosTable[] = [
  { id: 'T01', code: 'T-01', section: 'Main Hall', capacity: 2, status: 'Vacant' },
  { id: 'T02', code: 'T-02', section: 'Main Hall', capacity: 4, status: 'Occupied', runningAmount: 1450, activeTime: '24m', currentGuest: 'Vikram S.', itemCount: 3 },
  { id: 'T03', code: 'T-03', section: 'Main Hall', capacity: 4, status: 'Vacant' },
  { id: 'T04', code: 'T-04', section: 'Main Hall', capacity: 6, status: 'Occupied', runningAmount: 3820, activeTime: '42m', currentGuest: 'Meera K.', itemCount: 7 },
  { id: 'T05', code: 'T-05', section: 'AC Lounge', capacity: 4, status: 'Billed', runningAmount: 2190, activeTime: '55m', currentGuest: 'Sharma Family', itemCount: 5 },
  { id: 'T06', code: 'T-06', section: 'AC Lounge', capacity: 6, status: 'Vacant' },
  { id: 'T07', code: 'T-07', section: 'AC Lounge', capacity: 8, status: 'Occupied', runningAmount: 6400, activeTime: '18m', currentGuest: 'Corporate Lunch', itemCount: 11 },
  { id: 'T08', code: 'T-08', section: 'AC Lounge', capacity: 2, status: 'Vacant' },
  { id: 'T09', code: 'T-09', section: 'Rooftop', capacity: 4, status: 'Vacant' },
  { id: 'T10', code: 'T-10', section: 'Rooftop', capacity: 4, status: 'Occupied', runningAmount: 1890, activeTime: '12m', currentGuest: 'Aman Deep', itemCount: 4 },
  { id: 'T11', code: 'T-11', section: 'Rooftop', capacity: 6, status: 'Vacant' },
  { id: 'T12', code: 'T-12', section: 'Rooftop', capacity: 8, status: 'Vacant' },
];

interface PosTableSelectorProps {
  selectedTable: string | null;
  onSelectTable: (table: PosTable) => void;
  onClose?: () => void;
}

export default function PosTableSelector({
  selectedTable,
  onSelectTable,
}: PosTableSelectorProps) {
  const [activeSection, setActiveSection] = useState<string>('All');
  const sections = ['All', 'Main Hall', 'AC Lounge', 'Rooftop'];

  const filtered = activeSection === 'All'
    ? DEFAULT_TABLES
    : DEFAULT_TABLES.filter((t) => t.section === activeSection);

  const totalOccupied = DEFAULT_TABLES.filter((t) => t.status === 'Occupied').length;
  const totalBilled = DEFAULT_TABLES.filter((t) => t.status === 'Billed').length;
  const totalVacant = DEFAULT_TABLES.filter((t) => t.status === 'Vacant').length;

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
