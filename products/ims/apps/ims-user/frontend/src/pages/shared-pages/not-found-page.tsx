import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ShoppingCart, Boxes, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#07080e] text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-16 h-16 rounded-3xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-6 shadow-xl">
        <AlertCircle className="w-8 h-8" />
      </div>

      <span className="font-mono text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">
        Error 404 • Route Not Found
      </span>
      <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
        Page Does Not Exist
      </h1>
      <p className="text-xs text-slate-400 max-w-sm mb-8">
        The requested URL path was not found in the Zolexora IMS business suite. Choose a destination below:
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/pos"
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Go to POS Register</span>
        </Link>
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition"
        >
          <Boxes className="w-4 h-4 text-emerald-400" />
          <span>Go to Inventory Master</span>
        </Link>
        <Link
          to="/landing"
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home Overview</span>
        </Link>
      </div>
    </div>
  );
}
