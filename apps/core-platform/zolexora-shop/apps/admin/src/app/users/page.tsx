"use client";
import { useState, useEffect } from "react";
import { adminApi } from "@/lib/api";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string|null>(null);

  useEffect(() => { adminApi.users().then(setUsers).finally(() => setLoading(false)); }, []);

  // Access comes from the auth service (sign-in method), so users have no marketplace role.
  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const handleToggle = async (u: any) => {
    setUpdating(u.id);
    try {
      const res = await adminApi.toggleUser(u.id);
      setUsers(us => us.map(x => x.id === u.id ? { ...x, is_active: res.is_active } : x));
      toast.success(res.is_active ? "User activated" : "User suspended");
    } catch { toast.error("Failed"); } finally { setUpdating(null); }
  };

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
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-gray-100">
              <tr>{["User","Email","Status","Joined","Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-ink-muted whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? Array.from({length:8}).map((_,i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-8 shimmer rounded-lg" /></td></tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-muted">No users found</td></tr>
              ) : filtered.map((u,i) => {
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
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${u.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"2-digit"})}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggle(u)} disabled={updating === u.id}
                        className={`h-7 px-3 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-50 ${u.is_active ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-700 hover:bg-green-100"}`}>
                        {updating===u.id ? "..." : u.is_active ? "Suspend" : "Activate"}
                      </button>
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
