import React, { useEffect, useState } from 'react';
import { Terminal, Database, Play, CheckCircle } from 'lucide-react';

export default function AdminDashboard() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [sql, setSql] = useState('SELECT name FROM sqlite_master WHERE type=\'table\';');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/v1/organizations')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setOrgs(data);
      })
      .catch(() => {});
  }, []);

  const runSql = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const data = await res.json();
      setQueryResult(data);
    } catch (err: any) {
      setQueryResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Admin Diagnostics & Database</h1>
        <p className="text-sm text-slate-400">Direct query console and tenant directories</p>
      </div>

      {/* Organizations */}
      <div className="bg-[#121522] border border-white/10 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-3">Registered Tenant Organizations</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-[#181b2a] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2.5">Org ID</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Industry</th>
                <th className="px-4 py-2.5">Owner Email</th>
                <th className="px-4 py-2.5">Currency</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2.5 font-mono text-indigo-400">{o.id}</td>
                  <td className="px-4 py-2.5 font-medium text-white">{o.name}</td>
                  <td className="px-4 py-2.5 text-slate-400">{o.industry}</td>
                  <td className="px-4 py-2.5 text-slate-300">{o.owner_email}</td>
                  <td className="px-4 py-2.5 text-white font-mono">{o.currency}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQL Diagnostic Console */}
      <div className="bg-[#121522] border border-white/10 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Terminal className="w-4 h-4 text-indigo-400" /> SQL Diagnostic Console
        </div>
        <form onSubmit={runSql} className="space-y-3">
          <textarea
            rows={3}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            className="w-full bg-[#181b2a] border border-white/10 rounded-lg p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Run Query
          </button>
        </form>

        {queryResult && (
          <div className="bg-[#0b0d14] border border-white/10 rounded-lg p-4 overflow-x-auto">
            <pre className="font-mono text-xs text-slate-300">{JSON.stringify(queryResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
