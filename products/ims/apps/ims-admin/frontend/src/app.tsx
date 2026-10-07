import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Shield, Terminal, Home as HomeIcon } from 'lucide-react';
import Home from './pages/home';
import AdminDashboard from './pages/admin-dashboard';

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-[#0b0d14] text-slate-100">
      <aside className="w-64 border-r border-white/10 bg-[#0f111c] flex flex-col justify-between p-4 flex-shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white shadow-md">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide text-white">ZOLEXORA ADMIN</div>
              <div className="text-[11px] text-purple-400">SuperAdmin Control Plane</div>
            </div>
          </div>

          <nav className="space-y-1">
            <Link
              to="/"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                location.pathname === '/'
                  ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <HomeIcon className="w-4 h-4" /> Home
            </Link>
            <Link
              to="/dashboard"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                location.pathname === '/dashboard'
                  ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Terminal className="w-4 h-4" /> SQL Console
            </Link>
          </nav>
        </div>

        <div className="border-t border-white/10 pt-4 px-2 text-xs text-slate-400">
          SuperAdmin Environment
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
