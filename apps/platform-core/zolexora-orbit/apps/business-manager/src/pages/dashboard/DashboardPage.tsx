import { useQuery } from "@tanstack/react-query";
import { Calendar, Users, Scissors, TrendingUp } from "lucide-react";
import { useAuthStore } from "../../store/auth.store.js";
import { api } from "../../lib/api.js";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { session } = useAuthStore();
  const orgId = session?.org.zolexora_org_id;

  const { data: todayAppointments } = useQuery({
    queryKey: ["appointments", "today", orgId],
    queryFn: () =>
      api.get<{ data: unknown[]; limit: number; page: number }>(
        `/appointments?orgId=${orgId}&date=${new Date().toISOString().slice(0, 10)}&limit=5`,
      ),
    enabled: !!orgId,
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Good {getGreeting()},{" "}
          {session?.org.name ?? ""}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Today's appointments"
          value={todayAppointments?.data.length ?? "—"}
          icon={Calendar}
          color="bg-indigo-50 text-indigo-600"
        />
        <StatCard label="Customers" value="—" icon={Users} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Services" value="—" icon={Scissors} color="bg-violet-50 text-violet-600" />
        <StatCard label="Revenue today" value="—" icon={TrendingUp} color="bg-amber-50 text-amber-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Today's Appointments</h2>
        {todayAppointments?.data.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            No appointments scheduled for today.
          </p>
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
