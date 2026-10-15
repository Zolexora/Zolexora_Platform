import React, { useState } from 'react';
import {
  Activity,
  Users,
  Radio,
  Calendar,
  Wrench,
  ShoppingBag,
  Unlock,
  Lock,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  QrCode,
  CreditCard,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

type ManagerTab = 'dashboard' | 'members' | 'turnstiles' | 'classes' | 'equipment' | 'pos';

export default function App() {
  const [activeTab, setActiveTab] = useState<ManagerTab>('dashboard');
  const [occupancy, setOccupancy] = useState(68);
  const maxCapacity = 160;

  // Real-time access logs state
  const [accessLogs, setAccessLogs] = useState([
    {
      id: 'log-01',
      time: 'Just now',
      name: 'Vikram Singhania',
      tier: 'BLACK_IRON_VIP',
      device: 'Main Turnstile A',
      direction: 'ENTRY',
      decision: 'GRANTED',
      reason: 'Authorized VIP Pass',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
    },
    {
      id: 'log-02',
      time: '2 mins ago',
      name: 'Ananya Deshmukh',
      tier: 'GOLD',
      device: 'Main Turnstile B',
      direction: 'ENTRY',
      decision: 'GRANTED',
      reason: 'Authorized Gold Pass',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80'
    },
    {
      id: 'log-03',
      time: '6 mins ago',
      name: 'Dev Kapoor',
      tier: 'BRONZE',
      device: 'Main Turnstile A',
      direction: 'ENTRY',
      decision: 'DENIED_EXPIRED',
      reason: 'Membership expired 2026-09-01',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80'
    },
    {
      id: 'log-04',
      time: '11 mins ago',
      name: 'Arjun Mehta',
      tier: 'SILVER',
      device: 'Exit Turnstile',
      direction: 'EXIT',
      decision: 'GRANTED',
      reason: 'Exit checkout recorded',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
    }
  ]);

  // Turnstile devices
  const [gates, setGates] = useState([
    { id: 'gate-01', name: 'Main Turnstile A (Tripod)', ip: '192.168.10.101', latency: 12, cycles: 342, online: true, locked: false },
    { id: 'gate-02', name: 'Main Turnstile B (Tripod)', ip: '192.168.10.102', latency: 14, cycles: 389, online: true, locked: false },
    { id: 'gate-03', name: 'VIP Studio Flap Barrier', ip: '192.168.10.105', latency: 18, cycles: 94, online: true, locked: false },
    { id: 'gate-04', name: 'Exit Speed Gate', ip: '192.168.10.110', latency: 11, cycles: 310, online: true, locked: false }
  ]);

  // Members list
  const [members, setMembers] = useState([
    { id: 'mem-001', num: 'IC-2026-0811', name: 'Vikram Singhania', phone: '+91 98200 11223', tier: 'BLACK_IRON_VIP', status: 'ACTIVE', workouts: 214, expiry: '2027-01-10' },
    { id: 'mem-002', num: 'IC-2026-0942', name: 'Ananya Deshmukh', phone: '+91 98199 44321', tier: 'GOLD', status: 'ACTIVE', workouts: 142, expiry: '2026-12-31' },
    { id: 'mem-003', num: 'IC-2026-1004', name: 'Arjun Mehta', phone: '+91 97690 99881', tier: 'SILVER', status: 'EXPIRING_SOON', workouts: 88, expiry: '2026-10-20' },
    { id: 'mem-004', num: 'IC-2025-0551', name: 'Dev Kapoor', phone: '+91 99300 55442', tier: 'BRONZE', status: 'EXPIRED', workouts: 65, expiry: '2026-09-01' }
  ]);

  // Classes list
  const [classes, setClasses] = useState([
    { id: 'cls-01', title: 'IronPower Heavy Barbell Deadlifts', category: 'POWERLIFTING', instructor: 'Raghav Sharma', time: '18:30 - 19:30', room: 'Platform Pit 01', enrolled: 11, capacity: 12 },
    { id: 'cls-02', title: 'Metcon 500: Tactical CrossFit Circuit', category: 'HIIT', instructor: 'Pooja Roy', time: '19:45 - 20:30', room: 'CrossFit Arena', enrolled: 18, capacity: 20 },
    { id: 'cls-03', title: 'Spinal Decompression & Fascia Release', category: 'YOGA', instructor: 'Simran Khanna', time: 'Tomorrow 06:30', room: 'Mind-Body Studio B', enrolled: 14, capacity: 25 }
  ]);

  // Equipment list
  const [equipment, setEquipment] = useState([
    { id: 'eq-01', tag: 'EQ-ELEIKO-PL01', name: 'Eleiko IPF Competition Power Rack', status: 'OPTIMAL', hours: 2180, nextService: '2026-12-10' },
    { id: 'eq-02', tag: 'EQ-PRIME-HACK02', name: 'Prime USA Plate-Loaded Hack Squat', status: 'OPTIMAL', hours: 1845, nextService: '2026-11-22' },
    { id: 'eq-03', tag: 'EQ-CYBEX-CABLE03', name: 'Cybex Dual Cable Crossover 8-Stack', status: 'INSPECTION_DUE', hours: 3290, nextService: '2026-10-18' },
    { id: 'eq-04', tag: 'EQ-ASSAULT-RUNNER04', name: 'Assault Runner Elite Manual Curved', status: 'OPTIMAL', hours: 1450, nextService: '2026-12-01' }
  ]);

  // Pro-Shop items
  const [posItems, setPosItems] = useState([
    { id: 'pos-01', name: 'IronClub Pure Whey Isolate (2kg)', price: 4899, stock: 38 },
    { id: 'pos-02', name: 'Creapure Micronized Creatine (300g)', price: 1299, stock: 65 },
    { id: 'pos-03', name: '10mm Competition Lever Belt', price: 3499, stock: 19 },
    { id: 'pos-04', name: 'Cold Brew Protein Shake (35g Protein)', price: 220, stock: 42 }
  ]);

  // Quick Gate Override
  const handleUnlockGate = (gateId: string, name: string) => {
    toast.success(`⚡ ${name} momentarily unlocked (5 seconds)`, {
      description: 'Physical gate open signal sent to ESP32 controller.'
    });
    setOccupancy((prev) => Math.min(maxCapacity, prev + 1));
    const newLog = {
      id: `log-${Date.now()}`,
      time: 'Just now',
      name: 'Manager Override',
      tier: 'BLACK_IRON_VIP',
      device: name,
      direction: 'ENTRY',
      decision: 'GRANTED',
      reason: 'Manual manager override trigger (5s)',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
    };
    setAccessLogs([newLog, ...accessLogs.slice(0, 10)]);
  };

  const handleToggleGateLock = (gateId: string) => {
    setGates(gates.map((g) => {
      if (g.id === gateId) {
        const next = !g.locked;
        if (next) {
          toast.error(`${g.name} locked down for safety.`);
        } else {
          toast.success(`${g.name} normal operation unlocked.`);
        }
        return { ...g, locked: next };
      }
      return g;
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center font-black text-lg text-slate-950 shadow-md">
            IC
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-white text-base">IRONCLUB BENGALURU</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Operations
              </span>
            </div>
            <p className="text-xs text-slate-400">Downtown Flagship • Indiranagar 100ft Road</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-slate-300">Live Rush: <strong className="text-emerald-400">{occupancy} in gym</strong></span>
          </div>

          <div className="flex items-center space-x-2 pl-3 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-amber-400 border border-slate-600">
              RS
            </div>
            <div className="hidden md:block text-left text-xs">
              <div className="font-bold text-white">Raghav Sharma</div>
              <div className="text-[10px] text-slate-400">General Manager</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex">
        {/* Navigation Sidebar */}
        <aside className="w-60 border-r border-slate-800/80 bg-slate-900/40 p-4 space-y-6 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">Branch Operations</div>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Floor Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'members'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Members Roster</span>
            </button>

            <button
              onClick={() => setActiveTab('turnstiles')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'turnstiles'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Turnstiles & Gates</span>
            </button>

            <button
              onClick={() => setActiveTab('classes')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'classes'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Class Schedule</span>
            </button>

            <button
              onClick={() => setActiveTab('equipment')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'equipment'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Smart Equipment</span>
            </button>

            <button
              onClick={() => setActiveTab('pos')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'pos'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Pro-Shop POS</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs space-y-1">
            <span className="text-slate-400 block font-medium">Platform HQ Network:</span>
            <a href="http://localhost:3040" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline flex items-center justify-between font-bold">
              <span>HQ Master Admin</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </aside>

        {/* Workspace Body */}
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto space-y-8">
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-white">LIVE GYM FLOOR COMMAND</h1>
                  <p className="text-sm text-slate-400">Real-time gate telemetry, attendance streams, and emergency controls</p>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleUnlockGate('gate-01', 'Main Turnstile A')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center space-x-2 transition-all"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Quick Unlock Gate A (5s)</span>
                  </button>
                  <button
                    onClick={() => toast.info('Walk-in member registration opened.')}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 flex items-center space-x-2 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Register Walk-in</span>
                  </button>
                </div>
              </div>

              {/* Live Occupancy Gauge + Quick Gate Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Meter */}
                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Occupancy Meter</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                      Normal Flow
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-5xl font-black text-white">{occupancy}</span>
                      <span className="text-xs text-slate-400">Capacity: 160 ({Math.round((occupancy / maxCapacity) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(occupancy / maxCapacity) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block">Today Check-ins</span>
                      <strong className="text-white text-base">342</strong>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block">Active Trainers</span>
                      <strong className="text-amber-400 text-base">4 on floor</strong>
                    </div>
                  </div>
                </div>

                {/* Gate Hardware Snapshot */}
                <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base">Turnstile Hardware Gateways</h3>
                      <p className="text-xs text-slate-400">Optical access barrier status & instantaneous triggers</p>
                    </div>
                    <button onClick={() => setActiveTab('turnstiles')} className="text-xs text-amber-400 hover:underline font-bold">
                      View Diagnostics
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {gates.map((g) => (
                      <div key={g.id} className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-xs flex items-center space-x-1.5">
                            <span className={`w-2 h-2 rounded-full ${g.locked ? 'bg-red-500' : 'bg-emerald-400'}`} />
                            <span>{g.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Latency: {g.latency}ms • {g.cycles} cycles</div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleUnlockGate(g.id, g.name)}
                            disabled={g.locked}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950/40 text-slate-300 hover:text-emerald-400 border border-slate-700 disabled:opacity-30"
                            title="Unlock for 5s"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleGateLock(g.id)}
                            className={`p-1.5 rounded-lg border text-xs ${
                              g.locked ? 'bg-red-600 text-white border-red-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-red-400'
                            }`}
                            title={g.locked ? 'Unlock from lockdown' : 'Lockdown Gate'}
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Real-Time Access Log Stream */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Live Access Feed</h2>
                    <p className="text-xs text-slate-400">Streaming physical card taps, biometric scans, and dynamic QR passes</p>
                  </div>
                  <button
                    onClick={() => {
                      toast.success('Simulated member entry generated.');
                      handleUnlockGate('gate-02', 'Main Turnstile B');
                    }}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 font-bold flex items-center space-x-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>Simulate Mobile QR Tap</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {accessLogs.map((log) => (
                    <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <img src={log.avatar} alt={log.name} className="w-8 h-8 rounded-full object-cover border border-slate-700" />
                        <div>
                          <div className="font-bold text-white text-sm">{log.name}</div>
                          <div className="text-slate-400 text-[11px]">{log.device} • {log.direction}</div>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="flex items-center justify-end space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.decision === 'GRANTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {log.decision}
                          </span>
                          <span className="text-slate-500 font-mono text-[11px]">{log.time}</span>
                        </div>
                        <div className="text-slate-400 text-[11px]">{log.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-white">MEMBERS DIRECTORY</h1>
                  <p className="text-sm text-slate-400">Manage memberships, RFID badges, emergency contacts, and attendance history</p>
                </div>
                <button
                  onClick={() => toast.success('New membership onboarding form opened.')}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Member</span>
                </button>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Member</th>
                      <th className="p-4">Membership #</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">Tier</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Workouts</th>
                      <th className="p-4">Expiry Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-bold text-white">{m.name}</td>
                        <td className="p-4 font-mono text-slate-400">{m.num}</td>
                        <td className="p-4 text-slate-300">{m.phone}</td>
                        <td className="p-4">
                          <span className="font-bold text-amber-400">{m.tier}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-200">{m.workouts} sessions</td>
                        <td className="p-4 text-slate-400">{m.expiry}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => toast.info(`Viewing profile for ${m.name}`)} className="text-amber-400 hover:underline font-bold">
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TURNSTILES */}
          {activeTab === 'turnstiles' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-white">TURNSTILES & ACCESS GATES</h1>
                  <p className="text-sm text-slate-400">Microcontroller health, Wiegand sensors, and gate cycle stats</p>
                </div>
                <button
                  onClick={() => toast.success('Mesh diagnostics updated.')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                  <span>Refresh Health</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {gates.map((g) => (
                  <div key={g.id} className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-white text-base">{g.name}</h3>
                        <p className="text-xs font-mono text-slate-400">IP: {g.ip}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                        g.locked ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {g.locked ? 'LOCKED DOWN' : 'OPERATIONAL'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800/60">
                      <div>
                        <span className="text-slate-500 block">Ping Latency:</span>
                        <strong className="text-emerald-400 font-mono">{g.latency} ms</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Today Cycles:</span>
                        <strong className="text-white">{g.cycles} passes</strong>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 pt-2">
                      <button
                        onClick={() => handleUnlockGate(g.id, g.name)}
                        disabled={g.locked}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unlock for 5s</span>
                      </button>
                      <button
                        onClick={() => handleToggleGateLock(g.id)}
                        className={`px-4 py-2 rounded-xl font-bold text-xs border ${
                          g.locked ? 'bg-slate-800 text-white border-slate-700' : 'bg-red-950/40 text-red-400 border-red-500/30 hover:bg-red-900/50'
                        }`}
                      >
                        {g.locked ? 'Restore Gate' : 'Lockdown'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: CLASSES */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-white">GROUP CLASSES & STUDIOS</h1>
                  <p className="text-sm text-slate-400">Weekly class roster, coach assignments, and participant reservations</p>
                </div>
                <button
                  onClick={() => toast.success('New class slot modal opened.')}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Schedule Class</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {classes.map((c) => (
                  <div key={c.id} className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4 hover:border-amber-500/30 transition-all">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">{c.category}</span>
                      <h3 className="text-base font-bold text-white mt-0.5">{c.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">Instructor: {c.instructor} • {c.room}</p>
                      <p className="text-xs font-semibold text-emerald-400 mt-0.5">{c.time}</p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Capacity Booked</span>
                        <span><strong>{c.enrolled}</strong> / {c.capacity} spots</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full"
                          style={{ width: `${(c.enrolled / c.capacity) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => toast.info(`Viewing attendee roster for ${c.title}`)}
                        className="text-xs text-amber-400 hover:underline font-bold"
                      >
                        View Attendees List
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: SMART EQUIPMENT */}
          {activeTab === 'equipment' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-white">SMART EQUIPMENT FLEET</h1>
                  <p className="text-sm text-slate-400">Machine telemetry, service logs, and maintenance ticket dispatch</p>
                </div>
                <button
                  onClick={() => toast.success('Equipment maintenance ticket logged.')}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Service Ticket</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {equipment.map((e) => (
                  <div key={e.id} className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-amber-400">{e.tag}</span>
                        <h3 className="text-base font-bold text-white mt-0.5">{e.name}</h3>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                        e.status === 'OPTIMAL' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {e.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800/60">
                      <div>
                        <span className="text-slate-500 block">Total Usage:</span>
                        <strong className="text-white">{e.hours} hours</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Next Service Due:</span>
                        <strong className="text-slate-200">{e.nextService}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: PRO-SHOP POS */}
          {activeTab === 'pos' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-white">PRO-SHOP POINT OF SALE</h1>
                <p className="text-sm text-slate-400">Quick-checkout terminal for whey protein, creatine, drinks, and lifting gear</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {posItems.map((item) => (
                  <div key={item.id} className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{item.name}</h4>
                      <div className="text-lg font-black text-amber-400 mt-2">₹{item.price}</div>
                      <div className="text-xs text-slate-400 mt-1">Stock: {item.stock} in inventory</div>
                    </div>

                    <button
                      onClick={() => {
                        toast.success(`Sold 1x ${item.name}!`, {
                          description: `₹${item.price} receipt generated via UPI Dynamic QR.`
                        });
                      }}
                      className="w-full bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Quick Sell (₹{item.price})</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
