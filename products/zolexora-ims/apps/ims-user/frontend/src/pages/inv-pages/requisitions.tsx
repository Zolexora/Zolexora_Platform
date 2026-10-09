import React, { useState } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface Requisition {
  id: string;
  req_number: string;
  request_date: string;
  site_code: string;
  requested_by: string;
  item_code: string;
  item_name: string;
  quantity: number;
  uom: string;
  urgency: 'Normal' | 'High' | 'Critical';
  status: 'Pending' | 'Approved' | 'Issued' | 'Rejected';
  notes?: string;
}

const INITIAL_REQUISITIONS: Requisition[] = [
  { id: 'req_1', req_number: 'REQ-2026-001', request_date: '2026-09-05', site_code: 'SP_001 Counter 1', requested_by: 'Vikas Patel', item_code: 'P001', item_name: 'Logitech MX Master 3S Wireless Mouse', quantity: 5, uom: 'Pcs', urgency: 'High', status: 'Pending', notes: 'Stock exhausted at retail counter' },
  { id: 'req_2', req_number: 'REQ-2026-002', request_date: '2026-09-04', site_code: 'SP_002 Counter 2', requested_by: 'Pooja Singh', item_code: 'P005', item_name: 'Apple AirPods Pro (2nd Gen) USB-C', quantity: 8, uom: 'Pcs', urgency: 'Critical', status: 'Approved', notes: 'Weekend promotion requirements' },
  { id: 'req_3', req_number: 'REQ-2026-003', request_date: '2026-09-03', site_code: 'Store 2 (Branch)', requested_by: 'Anil Kumar', item_code: 'P002', item_name: 'Keychron K2 Mechanical Keyboard V2', quantity: 10, uom: 'Pcs', urgency: 'Normal', status: 'Issued', notes: 'Routine store transfer completed' },
  { id: 'req_4', req_number: 'REQ-2026-004', request_date: '2026-09-02', site_code: 'Assembly Lab', requested_by: 'Dr. Sen', item_code: 'P010', item_name: 'CalDigit TS4 Thunderbolt 4 Dock', quantity: 2, uom: 'Pcs', urgency: 'Normal', status: 'Pending', notes: 'Workstation upgrade project' },
];

export default function Requisitions() {
  const navigate = useNavigate();
  const [requisitions, setRequisitions] = useState<Requisition[]>(INITIAL_REQUISITIONS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // New Requisition Form state
  const [newReq, setNewReq] = useState({
    site_code: 'SP_001 Counter 1',
    requested_by: '',
    item_code: 'P001',
    item_name: 'Logitech MX Master 3S Wireless Mouse',
    quantity: 5,
    uom: 'Pcs',
    urgency: 'Normal' as const,
    notes: '',
  });

  const filteredRequisitions = requisitions.filter((r) => {
    const matchesSearch =
      r.req_number.toLowerCase().includes(search.toLowerCase()) ||
      r.item_name.toLowerCase().includes(search.toLowerCase()) ||
      r.requested_by.toLowerCase().includes(search.toLowerCase()) ||
      r.site_code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReq.requested_by.trim()) return;

    const created: Requisition = {
      id: `req_${Date.now()}`,
      req_number: `REQ-2026-${Math.floor(100 + Math.random() * 900)}`,
      request_date: new Date().toISOString().split('T')[0],
      site_code: newReq.site_code,
      requested_by: newReq.requested_by,
      item_code: newReq.item_code,
      item_name: newReq.item_name,
      quantity: newReq.quantity,
      uom: newReq.uom,
      urgency: newReq.urgency,
      status: 'Pending',
      notes: newReq.notes,
    };

    setRequisitions([created, ...requisitions]);
    setIsNewModalOpen(false);
    setNewReq({
      site_code: 'SP_001 Counter 1',
      requested_by: '',
      item_code: 'P001',
      item_name: 'Logitech MX Master 3S Wireless Mouse',
      quantity: 5,
      uom: 'Pcs',
      urgency: 'Normal',
      notes: '',
    });
  };

  const updateStatus = (id: string, newStatus: 'Approved' | 'Rejected') => {
    setRequisitions(
      requisitions.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-400" />
            Material Requisitions & Indents
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage site stock requests, internal replenishment indents, and approval workflows
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          <span>+ Raise Requisition</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#12141f] border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by requisition number, requester, item or destination..."
            className="w-full bg-[#181a28] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center bg-[#181a28] border border-white/10 rounded-xl p-0.5 text-xs w-full sm:w-auto">
          {(['All', 'Pending', 'Approved', 'Issued', 'Rejected'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                statusFilter === filter
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Requisitions Table */}
      <div className="bg-[#12141f] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#161826] border-b border-white/10 text-slate-400 font-medium">
                <th className="py-3 px-4">Req No</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-4">Destination Site / Counter</th>
                <th className="py-3 px-4">Requested Item</th>
                <th className="py-3 px-3 text-center">Qty</th>
                <th className="py-3 px-3">Requester</th>
                <th className="py-3 px-3 text-center">Urgency</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRequisitions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No material requisitions found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRequisitions.map((req) => (
                  <tr key={req.id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                      {req.req_number}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono">{req.request_date}</td>
                    <td className="py-3 px-4 font-medium text-white">{req.site_code}</td>
                    <td className="py-3 px-4 text-slate-200">
                      <div className="font-semibold text-white">{req.item_code}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{req.item_name}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-white font-mono">
                      {req.quantity} {req.uom}
                    </td>
                    <td className="py-3 px-3 text-slate-300">{req.requested_by}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          req.urgency === 'Critical'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : req.urgency === 'High'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        {req.urgency}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          req.status === 'Issued'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : req.status === 'Approved'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : req.status === 'Rejected'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {req.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => updateStatus(req.id, 'Approved')}
                              className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-[10px] font-semibold transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateStatus(req.id, 'Rejected')}
                              className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg text-[10px] font-semibold transition"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {req.status === 'Approved' && (
                          <Link
                            to="/forms/issuance-entry"
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-semibold transition"
                          >
                            <span>Issue Stock</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                        {req.status === 'Issued' && (
                          <span className="text-[11px] text-slate-500">Fulfilled</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal to Raise New Requisition */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12141f] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-400" />
              Raise Material Requisition
            </h2>

            <form onSubmit={handleCreateRequisition} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Destination Site / Counter *</label>
                <select
                  value={newReq.site_code}
                  onChange={(e) => setNewReq({ ...newReq, site_code: e.target.value })}
                  className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                >
                  <option value="SP_001 Counter 1">SP_001 — Main Retail Counter 1</option>
                  <option value="SP_002 Counter 2">SP_002 — Outlet Retail Counter 2</option>
                  <option value="Store 2 (Branch)">Store 2 — Branch Warehouse</option>
                  <option value="Assembly Lab">Technical Testing & Assembly Lab</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Requester Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newReq.requested_by}
                    onChange={(e) => setNewReq({ ...newReq, requested_by: e.target.value })}
                    placeholder="e.g. Vikas Patel"
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Urgency Level</label>
                  <select
                    value={newReq.urgency}
                    onChange={(e) => setNewReq({ ...newReq, urgency: e.target.value as any })}
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                  >
                    <option value="Normal">Normal Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Item Title / Code *</label>
                <input
                  type="text"
                  required
                  value={newReq.item_name}
                  onChange={(e) => setNewReq({ ...newReq, item_name: e.target.value })}
                  placeholder="e.g. Logitech MX Master 3S Mouse"
                  className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newReq.quantity}
                    onChange={(e) => setNewReq({ ...newReq, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white font-mono outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Unit (UOM)</label>
                  <input
                    type="text"
                    value={newReq.uom}
                    onChange={(e) => setNewReq({ ...newReq, uom: e.target.value })}
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Justification / Reason</label>
                <input
                  type="text"
                  value={newReq.notes}
                  onChange={(e) => setNewReq({ ...newReq, notes: e.target.value })}
                  placeholder="e.g. Stock critically depleted at counter."
                  className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md transition"
                >
                  Submit Indent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
