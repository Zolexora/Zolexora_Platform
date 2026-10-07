"use client";
import { useState, useEffect } from "react";
import { adminApi } from "@/lib/api";
import { Search, UserCheck, UserX, Shield, ShoppingBag, Store, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

const ROLE_CFG: Record<string,{label:string;color:string;icon:any}> = {
  admin:  { label:"Admin",  color:"bg-red-50 text-red-600 border-red-100",    icon:Shield },
  seller: { label:"Seller", color:"bg-purple-50 text-purple-600 border-purple-100", icon:Store },
  buyer: { label:"Buyer",  color:"bg-blue-50 text-blue-600 border-blue-100", icon:ShoppingBag },
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updating, setUpdating] = useState<string|null>(null);

  useEffect(() => { adminApi.users().then(setUsers).finally(() => setLoading(false)); }, []);

  const filtered = users.filter(u => {
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const handleRoleChange = async (uid: string, role: string) => {
    setUpdating(uid);
    try {
      await adminApi.setUserRole(uid, role);
      setUsers(us => us.map(u => u.id === uid ? { ...u, role } : u));
      toast.success(`Role updated to ${role}`);
    } catch { toast.error("Failed"); } finally { setUpdating(null); }
  };

  const handleToggle = async (u: any) => {
    setUpdating(u.id);
    try {
      const res = await adminApi.toggleUser(u.id);
      setUsers(us => us.map(x => x.id === u.id ? { ...x, is_active: res.is_active } : x));
      toast.success(res.is_active ? "User activated" : "User suspended");
    } catch { toast.error("Failed"); } finally { setUpdating(null); }
  };

  const counts = { all: users.length, admin: users.filter(u=>u.role==="admin").length, seller: users.filter(u=>u.role==="seller").length, buyer: users.filter(u=>u.role==="buyer").length };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Users</h1>
        <p className="text-ink-muted text-sm mt-0.5">{users.length} total registered users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-3 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-gold" />
        </div>
        <div className="flex gap-2">
          {(["all","buyer","seller","admin"] as const).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`h-9 px-4 rounded-xl text-xs font-semibold capitalize transition-all ${roleFilter===r ? "bg-ink text-white" : "bg-white border border-gray-200 text-ink-muted hover:border-gray-400"}`}>
              {r === "buyer" ? "Buyers" : r} ({counts[r]})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-gray-100">
              <tr>{["User","Email","Role","Status","Coins","Joined","Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-ink-muted whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? Array.from({length:8}).map((_,i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-8 shimmer rounded-lg" /></td></tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-muted">No users found</td></tr>
              ) : filtered.map((u,i) => {
                const rCfg = ROLE_CFG[u.role] || ROLE_CFG.buyer;
                return (
                  <motion.tr key={u.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.02 }}
                    className="hover:bg-surface/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-ink-muted flex-shrink-0">
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-ink whitespace-nowrap">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="relative inline-block">
                        <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} disabled={updating === u.id || u.role === "admin"}
                          className={`appearance-none text-[11px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none disabled:cursor-default ${rCfg.color}`}>
                          <option value="buyer">Buyer</option>
                          <option value="seller">Seller</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${u.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{u.coin_balance}</td>
                    <td className="px-4 py-3 text-xs text-ink-muted whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"2-digit"})}
                    </td>
                    <td className="px-4 py-3">
                      {u.role !== "admin" && (
                        <button onClick={() => handleToggle(u)} disabled={updating === u.id}
                          className={`h-7 px-3 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50 ${u.is_active ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-700 hover:bg-green-100"}`}>
                          {updating===u.id ? "..." : u.is_active ? "Suspend" : "Activate"}
                        </button>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
