import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Printer,
  ExternalLink,
  Calendar,
  Building2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface IssuanceLog {
  id: string;
  voucher_no: string;
  timestamp: string;
  item_code: string;
  item_name: string;
  quantity: number;
  uom: string;
  source_store: string;
  destination: string;
  recipient: string;
  authorized_by: string;
  purpose?: string;
}

const INITIAL_LOGS: IssuanceLog[] = [
  { id: 'iss_1', voucher_no: 'ISS-104921', timestamp: '2026-09-05 10:14', item_code: 'P001', item_name: 'Logitech MX Master 3S Wireless Mouse', quantity: 5, uom: 'Pcs', source_store: 'S_001 (Main)', destination: 'SP_001 Counter 1', recipient: 'Ramesh Kumar (EMP-892)', authorized_by: 'Storekeeper 01', purpose: 'Daily counter stock replenishment' },
  { id: 'iss_2', voucher_no: 'ISS-104920', timestamp: '2026-09-04 16:30', item_code: 'P006', item_name: 'Anker 737 Power Bank (PowerCore 24K)', quantity: 4, uom: 'Pcs', source_store: 'S_001 (Main)', destination: 'Technical Testing Lab', recipient: 'Sneha Roy (EMP-410)', authorized_by: 'Storekeeper 01', purpose: 'Internal field operations kit' },
  { id: 'iss_3', voucher_no: 'ISS-104919', timestamp: '2026-09-04 11:20', item_code: 'P005', item_name: 'Apple AirPods Pro (2nd Gen) USB-C', quantity: 3, uom: 'Pcs', source_store: 'S_002 (Branch)', destination: 'SP_002 Counter 2', recipient: 'Pooja Singh', authorized_by: 'Store Incharge 02', purpose: 'Retail counter stock' },
  { id: 'iss_4', voucher_no: 'ISS-104918', timestamp: '2026-09-03 14:45', item_code: 'P007', item_name: 'Samsung T7 Shield 2TB Portable SSD', quantity: 2, uom: 'Pcs', source_store: 'S_001 (Main)', destination: 'IT Infrastructure', recipient: 'Amit V (SYS-01)', authorized_by: 'Storekeeper 01', purpose: 'Server backup media' },
  { id: 'iss_5', voucher_no: 'ISS-104917', timestamp: '2026-09-02 09:15', item_code: 'P002', item_name: 'Keychron K2 Mechanical Keyboard V2', quantity: 6, uom: 'Pcs', source_store: 'Central Hub', destination: 'S_002 Branch Warehouse', recipient: 'Truck #DL-01-4491', authorized_by: 'Logistics Supervisor', purpose: 'Inter-warehouse stock transfer' },
];

export default function IssuanceLogs() {
  const [logs, setLogs] = useState<IssuanceLog[]>(INITIAL_LOGS);
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('All');
  const [selectedSlip, setSelectedSlip] = useState<IssuanceLog | null>(null);

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.voucher_no.toLowerCase().includes(search.toLowerCase()) ||
      l.item_code.toLowerCase().includes(search.toLowerCase()) ||
      l.item_name.toLowerCase().includes(search.toLowerCase()) ||
      l.recipient.toLowerCase().includes(search.toLowerCase()) ||
      l.destination.toLowerCase().includes(search.toLowerCase());
    const matchesStore = storeFilter === 'All' || l.source_store.includes(storeFilter);
    return matchesSearch && matchesStore;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
            Material Issuance & Consumption Logs
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail of all issued materials, dispatch vouchers, recipient receipts, and store decrements
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/forms/issuance-entry"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Issue Material</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#12141f] border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by voucher #, item code, recipient or destination..."
            className="w-full bg-[#181a28] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="bg-[#181a28] border border-white/10 text-slate-200 text-xs rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            <option value="All">Source Warehouse: All</option>
            <option value="S_001">Store 1 (Main)</option>
            <option value="S_002">Store 2 (Branch)</option>
            <option value="Central">Central Hub</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#12141f] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#161826] border-b border-white/10 text-slate-400 font-medium">
                <th className="py-3 px-4">Voucher No</th>
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-4">Item Issued</th>
                <th className="py-3 px-3 text-center">Qty</th>
                <th className="py-3 px-3">Source Store</th>
                <th className="py-3 px-4">Destination Site / Dept</th>
                <th className="py-3 px-3">Recipient</th>
                <th className="py-3 px-4 text-right">Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No issuance logs found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                      {log.voucher_no}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{log.timestamp}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{log.item_code}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{log.item_name}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-400 font-mono">
                      {log.quantity} {log.uom}
                    </td>
                    <td className="py-3 px-3 text-slate-300">{log.source_store}</td>
                    <td className="py-3 px-4 text-slate-200 font-medium">{log.destination}</td>
                    <td className="py-3 px-3 text-slate-300">{log.recipient}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedSlip(log)}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium transition"
                      >
                        View Slip
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12141f] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-sm text-white">Material Issuance Voucher</h3>
              <span className="font-mono text-xs text-indigo-400">{selectedSlip.voucher_no}</span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>{selectedSlip.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Source:</span>
                <span>{selectedSlip.source_store}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Destination:</span>
                <span>{selectedSlip.destination}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient:</span>
                <span>{selectedSlip.recipient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Authorized By:</span>
                <span>{selectedSlip.authorized_by}</span>
              </div>
              <div className="border-t border-dashed border-white/10 pt-2 flex justify-between font-bold text-white">
                <span>{selectedSlip.item_name}</span>
                <span className="text-emerald-400">{selectedSlip.quantity} {selectedSlip.uom}</span>
              </div>
              {selectedSlip.purpose && (
                <div className="pt-1 text-[11px] text-slate-400 font-sans">
                  Note: {selectedSlip.purpose}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={() => setSelectedSlip(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
