import { CalendarCheck, MapPin, FileText, TrendingUp } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex items-center gap-4">
      <div className={`rounded-xl p-3 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

export function ClientDashboardPage() {
  const { organisation } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome, {organisation?.name || 'Client'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your transport bookings, track trips, and review invoices from your Client Portal.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Requests" value="—" icon={CalendarCheck} color="bg-cyan-900/40 text-cyan-400" />
        <StatCard label="Trips In Transit" value="—" icon={MapPin} color="bg-blue-900/40 text-blue-400" />
        <StatCard label="Unpaid Invoices" value="—" icon={FileText} color="bg-amber-900/40 text-amber-400" />
        <StatCard label="Total Spend (MTD)" value="—" icon={TrendingUp} color="bg-emerald-900/40 text-emerald-400" />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/client/bookings" className="rounded-xl border border-cyan-700/40 bg-cyan-900/20 px-4 py-2 text-sm font-medium text-cyan-400 hover:bg-cyan-900/40 transition">
            + Book Transport
          </a>
          <a href="/client/invoices" className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition">
            View Invoices
          </a>
          <a href="/client/duties" className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition">
            Track Trips
          </a>
        </div>
      </div>
    </div>
  );
}
