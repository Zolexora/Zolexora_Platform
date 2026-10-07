import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Receipt,
  ArrowRightLeft,
  Sparkles,
  Layers,
  ChevronRight,
  IndianRupee,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';

interface PosTable {
  id: string;
  number: string;
  section: 'Main Hall' | 'AC Lounge' | 'Rooftop Patio' | 'Bar Counter';
  capacity: number;
  status: 'Vacant' | 'Occupied' | 'Billed' | 'Reserved';
  currentBill?: number;
  waiter?: string;
  seatedSince?: string;
  token?: string;
  itemsCount?: number;
}

const INITIAL_TABLES: PosTable[] = [
  { id: 't1', number: 'T-01', section: 'Main Hall', capacity: 2, status: 'Vacant' },
  { id: 't2', number: 'T-02', section: 'Main Hall', capacity: 4, status: 'Occupied', currentBill: 1450, waiter: 'Rajesh', seatedSince: '24 mins ago', token: 'TK-101', itemsCount: 3 },
  { id: 't3', number: 'T-03', section: 'Main Hall', capacity: 4, status: 'Billed', currentBill: 2890, waiter: 'Suresh', seatedSince: '48 mins ago', token: 'TK-098', itemsCount: 6 },
  { id: 't4', number: 'T-04', section: 'Main Hall', capacity: 6, status: 'Occupied', currentBill: 3820, waiter: 'Rajesh', seatedSince: '35 mins ago', token: 'TK-104', itemsCount: 7 },
  { id: 't5', number: 'T-05', section: 'Main Hall', capacity: 2, status: 'Vacant' },
  { id: 't6', number: 'T-06', section: 'Main Hall', capacity: 8, status: 'Reserved', waiter: 'Anil' },

  { id: 'ac1', number: 'AC-01', section: 'AC Lounge', capacity: 4, status: 'Occupied', currentBill: 1950, waiter: 'Pooja', seatedSince: '12 mins ago', token: 'TK-108', itemsCount: 4 },
  { id: 'ac2', number: 'AC-02', section: 'AC Lounge', capacity: 4, status: 'Vacant' },
  { id: 'ac3', number: 'AC-03', section: 'AC Lounge', capacity: 6, status: 'Occupied', currentBill: 4120, waiter: 'Pooja', seatedSince: '55 mins ago', token: 'TK-095', itemsCount: 9 },
  { id: 'ac4', number: 'AC-04', section: 'AC Lounge', capacity: 8, status: 'Vacant' },

  { id: 'rt1', number: 'RT-01', section: 'Rooftop Patio', capacity: 4, status: 'Occupied', currentBill: 2340, waiter: 'Vikas', seatedSince: '18 mins ago', token: 'TK-106', itemsCount: 5 },
  { id: 'rt2', number: 'RT-02', section: 'Rooftop Patio', capacity: 4, status: 'Vacant' },
  { id: 'rt3', number: 'RT-03', section: 'Rooftop Patio', capacity: 2, status: 'Vacant' },
  { id: 'rt4', number: 'RT-04', section: 'Rooftop Patio', capacity: 6, status: 'Vacant' },

  { id: 'b1', number: 'BAR-01', section: 'Bar Counter', capacity: 2, status: 'Occupied', currentBill: 850, waiter: 'Karan', seatedSince: '10 mins ago', token: 'TK-109', itemsCount: 2 },
  { id: 'b2', number: 'BAR-02', section: 'Bar Counter', capacity: 2, status: 'Vacant' },
  { id: 'b3', number: 'BAR-03', section: 'Bar Counter', capacity: 2, status: 'Vacant' },
];

export default function PosTables() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const [tables, setTables] = useState<PosTable[]>(INITIAL_TABLES);
  const [selectedSection, setSelectedSection] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<PosTable | null>(null);

  const fetchTables = () => {
    authFetch('/api/v1/tables')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTables(
            data.map((t: any) => ({
              id: t.id,
              number: t.number,
              section: t.section,
              capacity: t.capacity,
              status: t.status,
              currentBill: t.current_bill || undefined,
              waiter: t.waiter || undefined,
              seatedSince: t.seated_since || undefined,
              token: t.token || undefined,
              itemsCount: t.items_count || undefined,
            }))
          );
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const sections = ['All', 'Main Hall', 'AC Lounge', 'Rooftop Patio', 'Bar Counter'];

  // Metrics
  const totalTables = tables.length;
  const occupiedCount = tables.filter((t) => t.status === 'Occupied').length;
  const vacantCount = tables.filter((t) => t.status === 'Vacant').length;
  const billedCount = tables.filter((t) => t.status === 'Billed').length;
  const totalRunningSales = tables.reduce((acc, t) => acc + (t.currentBill || 0), 0);

  const filteredTables = tables.filter((table) => {
    const matchesSection = selectedSection === 'All' || table.section === selectedSection;
    const matchesStatus = statusFilter === 'All' || table.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      table.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (table.waiter && table.waiter.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSection && matchesStatus && matchesSearch;
  });

  const handleTableClick = (table: PosTable) => {
    setSelectedTable(table);
  };

  const handleOpenInTerminal = (table: PosTable) => {
    navigate(`/pos/dashboard?table=${table.number}`);
  };

  const handleToggleStatus = async (tableId: string, newStatus: PosTable['status']) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id === tableId) {
          return {
            ...t,
            status: newStatus,
            currentBill: newStatus === 'Vacant' ? undefined : t.currentBill,
            token: newStatus === 'Vacant' ? undefined : t.token,
            itemsCount: newStatus === 'Vacant' ? undefined : t.itemsCount,
            seatedSince: newStatus === 'Occupied' && !t.seatedSince ? 'Just now' : newStatus === 'Vacant' ? undefined : t.seatedSince,
          };
        }
        return t;
      })
    );
    if (selectedTable && selectedTable.id === tableId) {
      setSelectedTable((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    try {
      await authFetch(`/api/v1/tables/${tableId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          current_bill: newStatus === 'Vacant' ? 0.0 : undefined,
          token: newStatus === 'Vacant' ? null : undefined,
          items_count: newStatus === 'Vacant' ? 0 : undefined,
          seated_since: newStatus === 'Occupied' ? 'Just now' : newStatus === 'Vacant' ? null : undefined,
        }),
      });
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07080e] p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-emerald-400" />
            <span>Dine-In Floor & Table Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time table layout, active guest tabs, KOT status & floor occupancy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/pos/dashboard')}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-emerald-600/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>New Table Order</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Total Tables</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1.5">{totalTables}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across 4 Floor Sections</div>
        </div>

        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
            <span>Occupied Tables</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 mt-1.5">{occupiedCount}</div>
          <div className="text-[11px] text-amber-400/80 mt-0.5">
            {Math.round((occupiedCount / totalTables) * 100)}% Occupancy rate
          </div>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
            <span>Vacant & Ready</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 mt-1.5">{vacantCount}</div>
          <div className="text-[11px] text-emerald-400/80 mt-0.5">Ready for seating</div>
        </div>

        <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
            <span>Live Table Sales</span>
            <IndianRupee className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300 mt-1.5">
            ₹{totalRunningSales.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-indigo-400/80 mt-0.5">{billedCount} bills ready for payment</div>
        </div>
      </div>

      {/* Filters & Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-white/5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {sections.map((sec) => (
            <button
              key={sec}
              onClick={() => setSelectedSection(sec)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                selectedSection === sec
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5 text-xs">
            {['All', 'Vacant', 'Occupied', 'Billed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  statusFilter === st
                    ? 'bg-white/10 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search table or waiter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-44"
            />
          </div>
        </div>
      </div>

      {/* Table Grid & Detail Drawer */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 content-start">
          {filteredTables.map((table) => {
            const isOccupied = table.status === 'Occupied';
            const isBilled = table.status === 'Billed';
            const isReserved = table.status === 'Reserved';
            const isVacant = table.status === 'Vacant';
            const isSelected = selectedTable?.id === table.id;

            return (
              <div
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`cursor-pointer relative p-4 rounded-xl border transition-all select-none group flex flex-col justify-between min-h-[140px] ${
                  isSelected
                    ? 'ring-2 ring-emerald-500 shadow-lg'
                    : ''
                } ${
                  isOccupied
                    ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                    : isBilled
                    ? 'bg-indigo-950/30 border-indigo-500/40 hover:border-indigo-400'
                    : isReserved
                    ? 'bg-purple-950/20 border-purple-500/30'
                    : 'bg-slate-900/40 border-white/10 hover:border-emerald-500/50 hover:bg-slate-900/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-black text-white group-hover:text-emerald-300 transition">
                      {table.number}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        isOccupied
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : isBilled
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : isReserved
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {table.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                    <Users className="w-3 h-3 text-slate-500" />
                    <span>{table.capacity} Seater</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 text-[10px] truncate">{table.section}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-white/5 text-xs">
                  {isOccupied || isBilled ? (
                    <div>
                      <div className="flex items-center justify-between font-mono font-bold text-white">
                        <span>₹{table.currentBill?.toLocaleString('en-IN')}</span>
                        <span className="text-[10px] text-amber-400 font-normal">{table.itemsCount} items</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-slate-500" />
                          {table.seatedSince}
                        </span>
                        <span>{table.waiter}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Available</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition text-emerald-400" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Table Inspector Panel */}
        <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          {selectedTable ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Selected Table</div>
                    <div className="text-2xl font-black text-white font-mono">{selectedTable.number}</div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                      selectedTable.status === 'Occupied'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : selectedTable.status === 'Billed'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : selectedTable.status === 'Reserved'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {selectedTable.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Section Area</span>
                    <span className="text-white font-semibold">{selectedTable.section}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Capacity</span>
                    <span className="text-white font-semibold">{selectedTable.capacity} Guests</span>
                  </div>
                  {selectedTable.waiter && (
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Assigned Waiter</span>
                      <span className="text-white font-semibold">{selectedTable.waiter}</span>
                    </div>
                  )}
                  {selectedTable.seatedSince && (
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Occupied Since</span>
                      <span className="text-amber-400 font-semibold">{selectedTable.seatedSince}</span>
                    </div>
                  )}
                  {selectedTable.token && (
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Active Token</span>
                      <span className="text-indigo-400 font-mono font-bold">{selectedTable.token}</span>
                    </div>
                  )}
                  {selectedTable.currentBill !== undefined && (
                    <div className="flex justify-between py-2 border-b border-white/10 text-sm">
                      <span className="text-slate-300 font-bold">Current Tab Total</span>
                      <span className="text-emerald-400 font-mono font-black">
                        ₹{selectedTable.currentBill.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>

                {/* State Changer */}
                <div className="pt-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Quick Change Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleToggleStatus(selectedTable.id, 'Vacant')}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                        selectedTable.status === 'Vacant'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      Vacant
                    </button>
                    <button
                      onClick={() => handleToggleStatus(selectedTable.id, 'Occupied')}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                        selectedTable.status === 'Occupied'
                          ? 'bg-amber-600 text-white border-amber-500'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      Occupied
                    </button>
                    <button
                      onClick={() => handleToggleStatus(selectedTable.id, 'Billed')}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                        selectedTable.status === 'Billed'
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      Billed / Settle
                    </button>
                    <button
                      onClick={() => handleToggleStatus(selectedTable.id, 'Reserved')}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                        selectedTable.status === 'Reserved'
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      Reserved
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 border-t border-white/10">
                <button
                  onClick={() => handleOpenInTerminal(selectedTable)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-600/25"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Open in POS Terminal</span>
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleStatus(selectedTable.id, 'Vacant')}
                    className="flex-1 py-2 bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 rounded-xl text-xs font-semibold transition"
                  >
                    Clear & Free Table
                  </button>
                  <button
                    onClick={() => alert(`Transfer table ${selectedTable.number} to another table`)}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transfer Table</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <UtensilsCrossed className="w-12 h-12 text-slate-600 mb-3" />
              <div className="font-bold text-slate-300 text-sm">No Table Selected</div>
              <p className="text-xs text-slate-500 mt-1">
                Click any table on the floor map to inspect bill, take orders or transfer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
