import React, { useState } from 'react';
import {
  Zap,
  ShieldCheck,
  Flame,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  Activity,
  MapPin,
  Smartphone,
  Star,
  Users
} from 'lucide-react';
import { toast } from 'sonner';

export default function App() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialForm, setTrialForm] = useState({ name: '', phone: '', email: '', branch: 'Bengaluru Flagship' });

  const handleClaimTrial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trialForm.name || !trialForm.phone) {
      toast.error('Please enter your name and phone number');
      return;
    }
    toast.success(`🎉 1-Day VIP Pass generated for ${trialForm.name}!`, {
      description: `A dynamic entry QR code has been sent via SMS to ${trialForm.phone}. Valid at ${trialForm.branch}.`
    });
    setShowTrialModal(false);
  };

  const plans = [
    {
      name: 'Bronze Off-Peak',
      price: billingCycle === 'annual' ? '₹1,665' : '₹1,999',
      period: '/mo',
      billedNote: billingCycle === 'annual' ? 'Billed ₹19,990 annually' : 'Billed monthly',
      popular: false,
      desc: 'Ideal for remote professionals & students seeking quieter midday workout hours.',
      features: [
        'Off-peak gym floor access (11 AM - 4 PM)',
        'Standard locker room & rain showers',
        'Zolexora IronClub mobile app access',
        'Basic workout tracking engine'
      ]
    },
    {
      name: 'Gold Executive Club',
      price: billingCycle === 'annual' ? '₹3,749' : '₹4,499',
      period: '/mo',
      billedNote: billingCycle === 'annual' ? 'Billed ₹44,990 annually' : 'Billed monthly',
      popular: true,
      desc: 'Our most sought-after pass. Complete access to weights, cardio, and unlimited group fitness classes.',
      features: [
        'Unlimited 05:00 - 23:30 access (All 7 days)',
        'Unlimited HIIT, CrossFit, Yoga & Spin classes',
        'Infrared sauna & contrast cold shower suite',
        'Live Gym Rush Meter on Mobile App',
        '1 Free InBody 570 Composition Scan / month',
        '1 Complimentary Guest Pass every month'
      ]
    },
    {
      name: 'Black Iron VIP Elite',
      price: billingCycle === 'annual' ? '₹6,249' : '₹7,499',
      period: '/mo',
      billedNote: billingCycle === 'annual' ? 'Billed ₹74,990 annually' : 'Billed monthly',
      popular: false,
      desc: 'The pinnacle of strength and luxury. Nationwide multi-branch privileges with dedicated personal training.',
      features: [
        '24/7 All-Access across all branches in India',
        'Personal assigned permanent locker with nameplate',
        '2 One-on-One PT Sessions every month included',
        'Priority biometric turnstile fast-lane entry',
        '15% VIP discount across all Pro-Shop supplements',
        'Locker laundry & fresh towel service daily'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <header className="h-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 px-6 lg:px-12 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/20 text-slate-950">
            IC
          </div>
          <div>
            <div className="font-black tracking-tight text-white text-lg">ZOLEXORA IRONCLUB</div>
            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Smart Gym & Athletic Club</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-300">
          <a href="#features" className="hover:text-amber-400 transition-colors">Smart Features</a>
          <a href="#occupancy" className="hover:text-amber-400 transition-colors">Live Rush Meter</a>
          <a href="#plans" className="hover:text-amber-400 transition-colors">Memberships</a>
          <a href="#branches" className="hover:text-amber-400 transition-colors">Locations</a>
        </nav>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowTrialModal(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center space-x-2"
          >
            <span>Claim 1-Day Pass</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-6 lg:px-12 overflow-hidden border-b border-slate-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.15),rgba(255,255,255,0))]" />
        
        <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Generation Connected Fitness</span>
          </div>

          <h1 className="text-4xl md:text-7xl font-black tracking-tight text-white leading-tight">
            FORGE STRENGTH WITH <br />
            <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
              SMART INTELLIGENCE.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
            India’s most advanced athletic clubs powered by sub-50ms IoT turnstiles, live floor rush telemetry, Eleiko competition iron, and infrared recovery suites.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => setShowTrialModal(true)}
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 px-8 py-4 rounded-xl font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <span>Get Free 1-Day VIP Pass</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#plans"
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-8 py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2"
            >
              <span>Explore Memberships</span>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </a>
          </div>

          {/* Social Proof */}
          <div className="pt-12 flex flex-wrap items-center justify-center gap-8 text-xs text-slate-400 font-medium">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Contactless Sub-50ms Turnstile Pass</span>
            </div>
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>IPF Certified Competition Platforms</span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>4,400+ Active Athletes Nationwide</span>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE OCCUPANCY METER SPOTLIGHT */}
      <section id="occupancy" className="py-20 px-6 lg:px-12 bg-slate-900/30 border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center space-x-2 text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span>Real-Time Gym Floor Telemetry</span>
                </div>

                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                  Never Guess If The Squat Racks Are Free.
                </h2>

                <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                  Our optical turnstiles and machine sensor mesh monitor exact in-gym floor density in real-time. Check the IronClub Mobile App before leaving home to plan peak PR sessions during low-rush windows.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center space-x-3 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Real-time headcount synced across turnstiles every 5 seconds</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Historical peak hour heatmaps for every day of the week</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Smart notifications when your favorite lifting zone drops below 50%</span>
                  </div>
                </div>
              </div>

              {/* Interactive Meter Card */}
              <div className="bg-slate-950/80 border border-slate-800 p-6 md:p-8 rounded-2xl space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-400">IronClub Bengaluru Downtown</div>
                    <div className="text-lg font-black text-white">Live Gym Floor Rush</div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                    MODERATE CROWD
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-black text-white">68</span>
                    <span className="text-xs text-slate-400">160 Max Capacity (42.5% full)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-400 via-amber-400 to-amber-500 h-full rounded-full w-[42.5%]" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center pt-2">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Platforms</div>
                    <div className="text-sm font-black text-emerald-400">3 of 5 Open</div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Cable Towers</div>
                    <div className="text-sm font-black text-amber-400">4 of 8 Open</div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Sauna Suite</div>
                    <div className="text-sm font-black text-emerald-400">2 Active</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SMART FEATURES GRID */}
      <section id="features" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">ENGINEERED FOR PEAK PERFORMANCE</h2>
          <p className="text-slate-400 text-sm md:text-base">Built from the ground up for competitive athletes, powerlifters, and busy professionals.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-2xl space-y-4 hover:border-amber-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Sub-50ms Optical Turnstile Access</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              No lost plastic membership cards. Tap your iPhone, Android, or Apple Watch NFC badge for lightning-fast, zero-friction entry into the club.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-2xl space-y-4 hover:border-amber-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">World-Class Heavy Iron Fleet</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Eleiko IPF calibrated plates, Prime Fitness USA selectorized machines, Rogue Ohio power bars, and custom 100kg dumbbell racks.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-2xl space-y-4 hover:border-amber-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
              <Flame className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Infrared Sauna & Contrast Plunges</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Accelerate muscular recovery with cedarwood dry saunas, infrared therapy pods, and 6°C filtered cold plunge tubs.
            </p>
          </div>
        </div>
      </section>

      {/* MEMBERSHIP PLANS */}
      <section id="plans" className="py-24 px-6 lg:px-12 bg-slate-900/20 border-t border-slate-800/60">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">TRANSPARENT MEMBERSHIP PLANS</h2>
            <p className="text-slate-400 text-sm md:text-base">No hidden registration fees. No lock-in traps. Cancel anytime.</p>

            {/* Toggle Billing */}
            <div className="flex items-center justify-center space-x-3 pt-4">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  billingCycle === 'monthly' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  billingCycle === 'annual' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Annual Pass</span>
                <span className="bg-slate-950 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-black">SAVE 20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((p, idx) => (
              <div
                key={idx}
                className={`bg-slate-900/60 border rounded-3xl p-8 space-y-6 relative flex flex-col justify-between transition-all hover:scale-[1.02] ${
                  p.popular ? 'border-amber-500 shadow-xl shadow-amber-500/10' : 'border-slate-800'
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-md">
                    MOST POPULAR
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-xl font-black text-white">{p.name}</h3>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-4xl font-black text-white">{p.price}</span>
                    <span className="text-slate-400 text-sm">{p.period}</span>
                  </div>
                  <div className="text-xs text-amber-400 font-medium">{p.billedNote}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>

                  <div className="pt-4 border-t border-slate-800 space-y-2.5">
                    {p.features.map((f, fIdx) => (
                      <div key={fIdx} className="flex items-start space-x-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => {
                      toast.success(`Redirecting to secure payment checkout for ${p.name}...`);
                    }}
                    className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                      p.popular
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    Select Plan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRANCH LOCATIONS */}
      <section id="branches" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">FLAGSHIP GYM LOCATIONS</h2>
          <p className="text-slate-400 text-sm md:text-base">Prime central locations designed for serious lifters and recovery enthusiasts.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3">
            <MapPin className="w-5 h-5 text-amber-400" />
            <h4 className="font-bold text-white text-base">Bengaluru Downtown</h4>
            <p className="text-xs text-slate-400">100ft Road, Indiranagar</p>
            <div className="text-xs text-emerald-400 font-semibold">Open 05:00 - 23:30</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3">
            <MapPin className="w-5 h-5 text-amber-400" />
            <h4 className="font-bold text-white text-base">Mumbai Beachfront</h4>
            <p className="text-xs text-slate-400">Marine Drive, Nariman Point</p>
            <div className="text-xs text-emerald-400 font-semibold">Open 05:30 - 23:00</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3">
            <MapPin className="w-5 h-5 text-amber-400" />
            <h4 className="font-bold text-white text-base">Gurugram CyberHub</h4>
            <p className="text-xs text-slate-400">DLF Phase 2, Gurugram</p>
            <div className="text-xs text-emerald-400 font-semibold">Open 05:00 - 23:30</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3">
            <MapPin className="w-5 h-5 text-amber-400" />
            <h4 className="font-bold text-white text-base">Hyderabad HITEC</h4>
            <p className="text-xs text-slate-400">Madhapur, HITEC City</p>
            <div className="text-xs text-emerald-400 font-semibold">Open 05:30 - 23:00</div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 px-6 lg:px-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-black text-slate-950 text-sm">
              IC
            </div>
            <div>
              <span className="font-extrabold text-white text-sm">ZOLEXORA IRONCLUB</span>
              <p className="text-[10px] text-slate-500">© 2026 Zolexora Platform. All rights reserved.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
            <a href="http://localhost:3040" target="_blank" rel="noreferrer" className="hover:text-amber-400 transition-colors">HQ Admin Web</a>
            <a href="http://localhost:3042" target="_blank" rel="noreferrer" className="hover:text-amber-400 transition-colors">Gym Manager Web</a>
            <a href="#plans" className="hover:text-amber-400 transition-colors">Memberships</a>
            <a href="#occupancy" className="hover:text-amber-400 transition-colors">Rush Meter</a>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400">Mobile Apps on iOS & Android (Expo SDK 52)</span>
          </div>
        </div>
      </footer>

      {/* 1-DAY PASS MODAL */}
      {showTrialModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowTrialModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">Exclusive Invitation</div>
              <h3 className="text-2xl font-black text-white">Claim Your 1-Day VIP Pass</h3>
              <p className="text-xs text-slate-400 mt-1">Experience India’s smartest athletic club with full access to weights, group classes, and sauna.</p>
            </div>

            <form onSubmit={handleClaimTrial} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={trialForm.name}
                  onChange={(e) => setTrialForm({ ...trialForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Phone Number (For Dynamic Entry QR)</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={trialForm.phone}
                  onChange={(e) => setTrialForm({ ...trialForm, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Select Branch</label>
                <select
                  value={trialForm.branch}
                  onChange={(e) => setTrialForm({ ...trialForm, branch: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Bengaluru Flagship">Bengaluru Flagship (Indiranagar)</option>
                  <option value="Mumbai Beachfront">Mumbai Beachfront (Marine Drive)</option>
                  <option value="Gurugram CyberHub">Gurugram CyberHub</option>
                  <option value="Hyderabad HITEC">Hyderabad HITEC City</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-amber-500/20 transition-all mt-2"
              >
                Send Me My Dynamic Pass
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
