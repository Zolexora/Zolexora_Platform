import React, { useState } from 'react';
import {
  Building2,
  Cpu,
  CreditCard,
  TrendingUp,
  ShieldCheck,
  Activity,
  Users,
  Search,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Radio,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

type NavTab = 'overview' | 'branches' | 'iot-fleet' | 'plans' | 'audit';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [fleetLockdown, setFleetLockdown] = useState(false);

  // Global Mock Franchise Data
  const branches = [
    {
      id: 'branch-blr-01',
      code: 'IC-BLR-01',
      name: 'IronClub Downtown Flagship',
      city: 'Bengaluru, KA',
      manager: 'Coach Raghav Sharma',
      members: 1420,
      capacity: 160,
      occupancy: 68,
      gatesOnline: 4,
      totalGates: 4,
      mrr: '₹18.4L',
      status: 'OPTIMAL'
    },
    {
      id: 'branch-mum-02',
      code: 'IC-MUM-02',
      name: 'IronClub Marine Beachfront',
      city: 'Mumbai, MH',
      manager: 'Pooja Roy',
      members: 980,
      capacity: 120,
      occupancy: 44,
      gatesOnline: 3,
      totalGates: 3,
      mrr: '₹14.2L',
      status: 'OPTIMAL'
    },
    {
      id: 'branch-del-03',
      code: 'IC-DEL-03',
      name: 'IronClub CyberHub Elite',
      city: 'Gurugram, HR',
      manager: 'Vikram Choudhary',
      members: 1150,
      capacity: 140,
      occupancy: 59,
      gatesOnline: 4,
      totalGates: 4,
      mrr: '₹16.1L',
      status: 'OPTIMAL'
    },
    {
      id: 'branch-hyd-04',
      code: 'IC-HYD-04',
      name: 'IronClub HITEC PowerBox',
      city: 'Hyderabad, TG',
      manager: 'Aditya Varma',
      members: 890,
      capacity: 110,
      occupancy: 38,
      gatesOnline: 2,
      totalGates: 3,
      mrr: '₹11.8L',
      status: 'WARNING'
    }
  ];

  const gateDevices = [
    { id: 'gate-blr-01', branch: 'Bengaluru Flagship', name: 'Main Turnstile A (Tripod)', ip: '192.168.10.101', latency: '12ms', passesToday: 412, status: 'ONLINE', firmware: 'v3.2.1' },
    { id: 'gate-blr-02', branch: 'Bengaluru Flagship', name: 'Main Turnstile B (Tripod)', ip: '192.168.10.102', latency: '14ms', passesToday: 389, status: 'ONLINE', firmware: 'v3.2.1' },
    { id: 'gate-blr-03', branch: 'Bengaluru Flagship', name: 'VIP Studio Flap Barrier', ip: '192.168.10.105', latency: '18ms', passesToday: 94, status: 'ONLINE', firmware: 'v3.2.1' },
    { id: 'gate-mum-01', branch: 'Mumbai Beachfront', name: 'Entry Speed Gate 01', ip: '192.168.20.101', latency: '16ms', passesToday: 310, status: 'ONLINE', firmware: 'v3.2.0' },
    { id: 'gate-del-01', branch: 'Gurugram CyberHub', name: 'Facial Biometric Turnstile', ip: '192.168.30.101', latency: '24ms', passesToday: 290, status: 'ONLINE', firmware: 'v3.2.1' },
    { id: 'gate-hyd-02', branch: 'Hyderabad HITEC', name: 'Recovery Suite Access Gate', ip: '192.168.40.102', latency: '145ms', passesToday: 48, status: 'HIGH_LATENCY', firmware: 'v3.1.8' },
  ];

  const membershipTiers = [
    { id: 'tier-bronze', name: 'Bronze Off-Peak', price: '₹1,999/mo', annual: '₹19,990/yr', activeSubscribers: 840, target: 'Budget Fitness Enthusiasts', perks: ['Off-peak gym floor access', 'Locker room & shower'] },
    { id: 'tier-silver', name: 'Silver All-Hours', price: '₹2,999/mo', annual: '₹29,990/yr', activeSubscribers: 1490, target: 'Core Daily Gym-goers', perks: ['Unlimited 05:00-23:30 access', 'Steam & sauna access', '1 Fitness Assessment'] },
    { id: 'tier-gold', name: 'Gold Executive Club', price: '₹4,499/mo', annual: '₹44,990/yr', activeSubscribers: 1620, target: 'Group Classes & Athletic Training', perks: ['Unlimited gym & all group classes', 'HIIT/CrossFit/Yoga', 'Guest pass 1x/mo'] },
    { id: 'tier-vip', name: 'Black Iron VIP Elite', price: '₹7,499/mo', annual: '₹74,990/yr', activeSubscribers: 490, target: 'HNIs, Executives & Serious Lifters', perks: ['24/7 Multi-Branch all access', 'Personal permanent locker', '2 PT sessions/mo included', 'Pro-Shop 15% discount'] }
  ];

  const handleToggleFleetLockdown = () => {
    const nextState = !fleetLockdown;
    setFleetLockdown(nextState);
    if (nextState) {
      toast.error('EMERGENCY LOCKDOWN ACTIVATED across all 14 turnstiles nationwide.', {
        description: 'Physical gate arms secured. Emergency exits remain free per NFPA code.'
      });
    } else {
      toast.success('Systemwide lockdown lifted. Turnstile normal operation restored.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/20 text-slate-950">
            IC
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold tracking-tight text-white text-base">ZOLEXORA IRONCLUB</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                HQ Master Admin
              </span>
            </div>
            <p className="text-xs text-slate-400">Enterprise Smart Gym Platform & IoT Turnstile Hub</p>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-slate-300">IoT Mesh: <strong className="text-emerald-400">13/14 Gates Online</strong></span>
          </div>

          <button
            onClick={handleToggleFleetLockdown}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              fleetLockdown
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 animate-pulse'
                : 'bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/40'
            }`}
          >
            {fleetLockdown ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{fleetLockdown ? 'EMERGENCY LOCKDOWN ACTIVE' : 'Fleet Lockdown'}</span>
          </button>

          <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-xs font-bold border border-slate-600">
              MK
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-bold leading-tight">Marcus Kane</div>
              <div className="text-[10px] text-amber-400">Chief Executive Officer</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-800/80 bg-slate-900/40 p-4 space-y-6 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">Franchise Navigation</div>
            
            <button
              onClick={() => setCurrentTab('overview')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentTab === 'overview'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>HQ Overview</span>
            </button>

            <button
              onClick={() => setCurrentTab('branches')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentTab === 'branches'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Branch Locations (4)</span>
            </button>

            <button
              onClick={() => setCurrentTab('iot-fleet')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentTab === 'iot-fleet'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>IoT Turnstiles & Gates</span>
            </button>

            <button
              onClick={() => setCurrentTab('plans')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentTab === 'plans'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Membership Tiers</span>
            </button>

            <button
              onClick={() => setCurrentTab('audit')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentTab === 'audit'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Security & Audit Log</span>
            </button>
          </div>

          {/* Quick Ecosystem Links */}
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl space-y-2">
            <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
              <span>IronClub Ecosystem</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Connected to Manager Web (Port 3042), Marketing Web (Port 3043) and Expo Mobile Apps.
            </p>
            <div className="pt-1 flex flex-col space-y-1 text-xs">
              <a href="http://localhost:3042" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline flex items-center justify-between">
                <span>Branch Manager Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a href="http://localhost:3043" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline flex items-center justify-between">
                <span>Marketing & Landing Site</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </aside>

        {/* Content View */}
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto space-y-8">
          {/* TAB 1: OVERVIEW */}
          {currentTab === 'overview' && (
            <div className="space-y-8">
              {/* Top Banner KPI */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-white">FRANCHISE COMMAND CENTER</h1>
                  <p className="text-sm text-slate-400">Real-time telemetry across all 4 operational smart gyms in India</p>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toast.success('Telemetry synchronizing with all branch hardware...')}
                    className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-slate-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync IoT Mesh</span>
                  </button>
                  <button
                    onClick={() => toast.info('Franchise onboarding wizard launching...')}
                    className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Gym Branch</span>
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Active Members</div>
                  <div className="text-3xl font-black text-white">4,440</div>
                  <div className="text-xs text-emerald-400 mt-2 font-medium flex items-center space-x-1">
                    <span>+12.4% MoM Growth</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Consolidated MRR</div>
                  <div className="text-3xl font-black text-amber-400">₹60.5L</div>
                  <div className="text-xs text-slate-400 mt-2 font-medium">Annualized Run Rate: ₹7.26 Cr</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Live In-Gym Floor Count</div>
                  <div className="text-3xl font-black text-emerald-400">209 <span className="text-sm font-normal text-slate-400">/ 530 cap</span></div>
                  <div className="text-xs text-slate-400 mt-2 font-medium">39.4% Network Utilization</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Hardware Gate Fleet</div>
                  <div className="text-3xl font-black text-cyan-400">13 <span className="text-sm font-normal text-slate-400">/ 14 Online</span></div>
                  <div className="text-xs text-amber-400 mt-2 font-medium">1 Gate high latency warning</div>
                </div>
              </div>

              {/* Branch Network Snapshot */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Branch Network Performance</h2>
                    <p className="text-xs text-slate-400">Live operational status and revenue by location</p>
                  </div>
                  <button onClick={() => setCurrentTab('branches')} className="text-xs text-amber-400 hover:underline flex items-center space-x-1 font-bold">
                    <span>View Detailed Breakdown</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {branches.map((b) => (
                    <div key={b.id} className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between hover:border-slate-700 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-sm">{b.name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            b.status === 'OPTIMAL' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">{b.city} • Manager: {b.manager}</div>
                        <div className="text-xs text-slate-300 font-medium">
                          Active Members: <strong className="text-white">{b.members}</strong> • Gates: <strong className="text-cyan-400">{b.gatesOnline}/{b.totalGates}</strong>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="text-sm font-black text-amber-400">{b.mrr} MRR</div>
                        <div className="text-xs text-slate-400">
                          Live: <strong className="text-emerald-400">{b.occupancy}</strong> / {b.capacity}
                        </div>
                        <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden ml-auto">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${(b.occupancy / b.capacity) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BRANCHES */}
          {currentTab === 'branches' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-white">GYM BRANCH NETWORK</h1>
                  <p className="text-sm text-slate-400">Configure franchise branches, operating hours, capacity limits and managers</p>
                </div>
                <button
                  onClick={() => toast.success('New branch registration opened.')}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Branch</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {branches.map((b) => (
                  <div key={b.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-amber-500/30 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-mono text-amber-400 font-bold">{b.code}</div>
                        <h3 className="text-lg font-bold text-white mt-0.5">{b.name}</h3>
                        <p className="text-xs text-slate-400">{b.city}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        b.status === 'OPTIMAL' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {b.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-xl text-xs border border-slate-800/60">
                      <div>
                        <span className="text-slate-500 block">Head Coach / Manager:</span>
                        <strong className="text-slate-200">{b.manager}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Monthly Recurring:</span>
                        <strong className="text-amber-400">{b.mrr}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Active Members:</span>
                        <strong className="text-slate-200">{b.members} lifters</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Smart Turnstiles:</span>
                        <strong className="text-cyan-400">{b.gatesOnline} of {b.totalGates} Online</strong>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Current Occupancy</span>
                        <span><strong>{b.occupancy}</strong> / {b.capacity} Max ({Math.round((b.occupancy / b.capacity) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-amber-500 h-full rounded-full"
                          style={{ width: `${(b.occupancy / b.capacity) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs">
                      <span className="text-slate-400">Open: 05:00 - 23:30 (Mon-Sun)</span>
                      <button
                        onClick={() => toast.info(`Accessing Manager view for ${b.name}`)}
                        className="text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1"
                      >
                        <span>Manage Branch</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: IOT FLEET */}
          {currentTab === 'iot-fleet' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-white">IOT TURNSTILE & HARDWARE FLEET</h1>
                  <p className="text-sm text-slate-400">Hardware controllers, Wiegand RFID readers, and optical barcode scanners</p>
                </div>
                <button
                  onClick={() => toast.success('Diagnostic ping dispatched to all 14 gate microcontrollers.')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 flex items-center space-x-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Fleet Ping Test</span>
                </button>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-4">Gate Device</th>
                        <th className="p-4">Branch</th>
                        <th className="p-4">IP Address</th>
                        <th className="p-4">Ping Latency</th>
                        <th className="p-4">Cycles Today</th>
                        <th className="p-4">Firmware</th>
                        <th className="p-4">Hardware Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {gateDevices.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 font-bold text-white flex items-center space-x-2">
                            <Radio className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{g.name}</span>
                          </td>
                          <td className="p-4 text-slate-400">{g.branch}</td>
                          <td className="p-4 font-mono text-slate-300">{g.ip}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                              parseInt(g.latency) < 30 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {g.latency}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-slate-200">{g.passesToday} passes</td>
                          <td className="p-4 font-mono text-slate-400">{g.firmware}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              g.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {g.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => toast.success(`Diagnostic signal sent to ${g.name}`)}
                              className="text-amber-400 hover:text-amber-300 font-bold"
                            >
                              Test Ping
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MEMBERSHIP TIERS */}
          {currentTab === 'plans' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-white">MEMBERSHIP TIERS & PRICING</h1>
                  <p className="text-sm text-slate-400">Configure nation-wide membership pricing, perks, and access privileges</p>
                </div>
                <button
                  onClick={() => toast.success('New tier creation form opened.')}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Custom Tier</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {membershipTiers.map((t) => (
                  <div key={t.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-amber-500/30 transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black text-white">{t.name}</h3>
                        <p className="text-xs text-slate-400">{t.target}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-amber-400">{t.price}</div>
                        <div className="text-[11px] text-slate-500">{t.annual}</div>
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 text-xs flex justify-between items-center">
                      <span className="text-slate-400">Active Subscribers:</span>
                      <strong className="text-white text-sm">{t.activeSubscribers} members</strong>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Included Privileges:</span>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {t.perks.map((p, idx) => (
                          <li key={idx} className="flex items-center space-x-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2 flex items-center justify-end border-t border-slate-800 text-xs">
                      <button
                        onClick={() => toast.info(`Editing plan config for ${t.name}`)}
                        className="text-amber-400 hover:text-amber-300 font-bold"
                      >
                        Edit Plan Rules
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY AUDIT */}
          {currentTab === 'audit' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-white">SECURITY & AUDIT LOG</h1>
                <p className="text-sm text-slate-400">Immutable trace of access overrides, hardware pings, and administrative actions</p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
                <div className="flex items-center space-x-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div className="flex-1">
                    <span className="font-bold text-white">Turnstile Mesh Healthcheck OK:</span> All 14 gate firmware signatures verified against SHA-256 certificate.
                  </div>
                  <span className="text-slate-500 font-mono">10 mins ago</span>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <div className="flex-1">
                    <span className="font-bold text-white">Manual Override Invoked:</span> Front Desk Officer at Bengaluru Flagship opened Turnstile A for a VIP tour.
                  </div>
                  <span className="text-slate-500 font-mono">35 mins ago</span>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div className="flex-1">
                    <span className="font-bold text-white">Cashfree & Razorpay Settlement:</span> Daily sweep completed. ₹2.84L credited to merchant escrow.
                  </div>
                  <span className="text-slate-500 font-mono">2 hours ago</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
