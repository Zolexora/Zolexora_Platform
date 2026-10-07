import React from 'react';
import { Shield, Database, Users, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">SuperAdmin Control Plane</h1>
        <p className="text-sm text-slate-400">Platform management, tenant provisioning, and D1 database diagnostics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#121522] border border-white/10 rounded-xl p-5">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Active Tenants</span>
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">1</div>
          <span className="text-xs text-emerald-400">Zolexora_1's Org</span>
        </div>

        <div className="bg-[#121522] border border-white/10 rounded-xl p-5">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Database Engine</span>
            <Database className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">Cloudflare D1</div>
          <span className="text-xs text-slate-400">13 relational tables</span>
        </div>

        <div className="bg-[#121522] border border-white/10 rounded-xl p-5">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Control Plane</span>
            <Shield className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">SuperAdmin</div>
          <span className="text-xs text-purple-400">Master Privileges</span>
        </div>
      </div>

      <div className="bg-[#121522] border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-2">Control Console</h2>
        <p className="text-sm text-slate-400 mb-4">
          Directly inspect database rows, manage registered tenant organizations, or run diagnostic queries.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
        >
          <Terminal className="w-4 h-4" /> Open Admin Console
        </Link>
      </div>
    </div>
  );
}
