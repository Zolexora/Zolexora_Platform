import React, { useState } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  Building2,
  Mail,
  Shield,
  Lock,
  CheckCircle2,
  AlertTriangle,
  UserX,
} from 'lucide-react';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'Commander' | 'Ops Master' | 'Org Admin' | 'Inventory Manager' | 'POS Cashier' | 'Storekeeper' | 'Procurement Officer' | 'Auditor';
  location: string;
  status: 'Active' | 'Suspended';
  last_login: string;
}

const INITIAL_USERS: StaffUser[] = [
  {
    id: 'usr_1',
    name: 'Abhishek Sharma',
    email: 'abhishek@zolexora.com',
    role: 'Commander',
    location: 'ALL (Enterprise)',
    status: 'Active',
    last_login: 'Today at 10:45 AM',
  },
  {
    id: 'usr_2',
    name: 'Rohan Deshmukh',
    email: 'rohan.d@zolexora.com',
    role: 'Storekeeper',
    location: 'S_001 (Main Warehouse)',
    status: 'Active',
    last_login: 'Today at 08:30 AM',
  },
  {
    id: 'usr_3',
    name: 'Megha Iyer',
    email: 'megha.i@zolexora.com',
    role: 'POS Cashier',
    location: 'SP_001 (Front Register)',
    status: 'Active',
    last_login: 'Today at 09:15 AM',
  },
  {
    id: 'usr_4',
    name: 'Sanjay Rawat',
    email: 'sanjay.r@zolexora.com',
    role: 'Inventory Manager',
    location: 'S_002 (Branch Store)',
    status: 'Active',
    last_login: 'Sep 03 at 11:20 AM',
  },
  {
    id: 'usr_5',
    name: 'Kavita Menon',
    email: 'kavita.m@zolexora.com',
    role: 'Auditor',
    location: 'ALL (Enterprise)',
    status: 'Active',
    last_login: 'Aug 29 at 02:00 PM',
  },
];

export default function OrgUsers() {
  const [users, setUsers] = useState<StaffUser[]>(INITIAL_USERS);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'POS Cashier' as StaffUser['role'],
    location: 'SP_001 (Front Register)',
  });

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim()) return;

    const created: StaffUser = {
      id: `usr_${Date.now()}`,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      location: newUser.location,
      status: 'Active',
      last_login: 'Invited (Pending Confirmation)',
    };

    setUsers([...users, created]);
    setIsAddModalOpen(false);
    setNewUser({
      name: '',
      email: '',
      role: 'POS Cashier',
      location: 'SP_001 (Front Register)',
    });
  };

  const toggleUserStatus = (id: string) => {
    setUsers(
      users.map((u) => {
        if (u.id === id) {
          return {
            ...u,
            status: u.status === 'Active' ? 'Suspended' : 'Active',
          };
        }
        return u;
      })
    );
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Staff & Role Permissions (RBAC)</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
              ACCESS CONTROL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Grant or revoke access for Cashiers, Inventory Managers, Storekeepers, and Corporate Auditors.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-900/30 transition"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Staff Member</span>
        </button>
      </div>

      {/* Role Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { role: 'Commander', count: users.filter((u) => u.role === 'Commander' || u.role === 'Ops Master' || u.role === 'Org Admin').length, color: 'text-purple-400' },
          { role: 'POS Cashier', count: users.filter((u) => u.role === 'POS Cashier').length, color: 'text-emerald-400' },
          { role: 'Inventory Mgr', count: users.filter((u) => u.role === 'Inventory Manager').length, color: 'text-indigo-400' },
          { role: 'Storekeeper', count: users.filter((u) => u.role === 'Storekeeper').length, color: 'text-amber-400' },
          { role: 'Procurement', count: users.filter((u) => u.role === 'Procurement Officer').length, color: 'text-teal-400' },
          { role: 'Auditor', count: users.filter((u) => u.role === 'Auditor').length, color: 'text-rose-400' },
        ].map((item) => (
          <div key={item.role} className="p-3 bg-slate-900/40 border border-white/10 rounded-xl text-center">
            <div className={`text-lg font-bold ${item.color}`}>{item.count}</div>
            <div className="text-[10px] text-slate-400 font-medium truncate">{item.role}</div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 bg-slate-900/40 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff by name or email address..."
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-black/40 border border-white/10 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="All">All Staff Roles</option>
            <option value="Commander">Commander</option>
            <option value="POS Cashier">POS Cashier</option>
            <option value="Inventory Manager">Inventory Manager</option>
            <option value="Storekeeper">Storekeeper</option>
            <option value="Procurement Officer">Procurement Officer</option>
            <option value="Auditor">Auditor</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-black/40 border-b border-white/10 text-slate-400 font-medium">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-4">Assigned Location</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/5 transition">
                  <td className="py-3 px-4 font-semibold text-white flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-xs">
                      {u.name.charAt(0)}
                    </div>
                    <span>{u.name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">{u.email}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        u.role === 'Commander' || u.role === 'Ops Master' || u.role === 'Org Admin'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : u.role === 'POS Cashier'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : u.role === 'Inventory Manager'
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                      }`}
                    >
                      {u.role === 'Org Admin' || u.role === 'Ops Master' ? 'Commander' : u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{u.location}</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        u.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          u.status === 'Active' ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">{u.last_login}</td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => toggleUserStatus(u.id)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                        u.status === 'Active'
                          ? 'text-rose-400 hover:bg-rose-500/10'
                          : 'text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      {u.status === 'Active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#121422] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Invite New Staff Member</span>
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meera Nair"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Official Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. meera.n@zolexora.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Role Permission *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
                >
                  <option value="POS Cashier">POS Cashier (Front Desk Checkout Only)</option>
                  <option value="Storekeeper">Storekeeper (Warehouse Receiving & Issuance)</option>
                  <option value="Inventory Manager">Inventory Manager (Stock Requisition & Purchase)</option>
                  <option value="Procurement Officer">Procurement Officer (Vendor Management)</option>
                  <option value="Auditor">Auditor (View-Only Reports & Reconciliations)</option>
                  <option value="Commander">Commander (Full Corporate & Executive Authority)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Assigned Location</label>
                <input
                  type="text"
                  placeholder="e.g. SP_001 (Front Register) or S_001"
                  value={newUser.location}
                  onChange={(e) => setNewUser({ ...newUser, location: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
