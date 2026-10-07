import React, { useState, useEffect } from 'react';
import {
  Bike,
  UtensilsCrossed,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Phone,
  Printer,
  Sparkles,
  Volume2,
  VolumeX,
  RefreshCw,
  Power,
  ChevronRight,
  ShieldCheck,
  Gift,
  ExternalLink,
  Flame,
  IndianRupee,
  Link as LinkIcon,
  Copy,
  Check,
  Send,
  HelpCircle,
  Layers,
  Settings,
  ArrowRight,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useNavigate } from 'react-router-dom';

interface AggregatorOrder {
  id: string;
  platform: string;
  channel_color: string;
  source: string;
  order_time: string;
  customer_name: string;
  customer_phone: string;
  items: Array<{ name: string; qty: number; price: number; notes?: string }>;
  subtotal: number;
  tax: number;
  total_amount: number;
  payment_status: string;
  status: 'NEW' | 'ACCEPTED' | 'READY' | 'DISPATCHED' | 'CANCELLED';
  rider?: {
    name: string;
    phone: string;
    status: string;
    otp: string;
  };
  table_no?: string;
  prep_time_mins: number;
}

interface PlatformState {
  id: string;
  name: string;
  channel_type: string;
  connected: boolean;
  status: 'Online' | 'Paused' | 'Not Connected';
  active_orders: number;
  auto_accept: boolean;
  outlet_id?: string | null;
  rating: number;
  portal_url: string;
  docs_url: string;
}

interface ChannelConfigItem {
  platform_id: string;
  name: string;
  channel_type: string;
  connected: boolean;
  status: string;
  outlet_id: string | null;
  has_api_key: boolean;
  auto_accept: boolean;
  webhook_url: string;
  portal_url: string;
  docs_url: string;
}

export default function PosOnlineOrders() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();

  const [orders, setOrders] = useState<AggregatorOrder[]>([]);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  // Platform states & configurations
  const [platforms, setPlatforms] = useState<PlatformState[]>([
    {
      id: 'urbanpiper',
      name: 'UrbanPiper Hub (Swiggy + Zomato)',
      channel_type: 'Aggregator Middleware',
      connected: false,
      status: 'Not Connected',
      active_orders: 0,
      auto_accept: false,
      rating: 4.9,
      portal_url: 'https://atlas.urbanpiper.com',
      docs_url: 'https://developer.urbanpiper.com',
    },
    {
      id: 'swiggy',
      name: 'Swiggy Direct Partner',
      channel_type: 'Direct Delivery Partner',
      connected: false,
      status: 'Not Connected',
      active_orders: 0,
      auto_accept: false,
      rating: 4.6,
      portal_url: 'https://partner.swiggy.com',
      docs_url: 'https://partner.swiggy.com',
    },
    {
      id: 'zomato',
      name: 'Zomato Direct Merchant',
      channel_type: 'Direct Delivery Partner',
      connected: false,
      status: 'Not Connected',
      active_orders: 0,
      auto_accept: false,
      rating: 4.7,
      portal_url: 'https://www.zomato.com/business',
      docs_url: 'https://www.zomato.com/business',
    },
    {
      id: 'ondc',
      name: 'ONDC Open Network (Beckn)',
      channel_type: 'National Open Commerce Network',
      connected: false,
      status: 'Not Connected',
      active_orders: 0,
      auto_accept: false,
      rating: 4.5,
      portal_url: 'https://ondc.org',
      docs_url: 'https://ondc.org',
    },
  ]);

  // Setup Wizard Modal State
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('urbanpiper');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [savingChannel, setSavingChannel] = useState<boolean>(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  // Form Inputs for Channel Configuration
  const [outletIdInput, setOutletIdInput] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [apiUsernameInput, setApiUsernameInput] = useState<string>('');
  const [webhookSecretInput, setWebhookSecretInput] = useState<string>('');
  const [autoAcceptInput, setAutoAcceptInput] = useState<boolean>(false);

  // Test Webhook Simulation
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [testSuccessMsg, setTestSuccessMsg] = useState<string | null>(null);

  // Print KOT Modal
  const [printingOrder, setPrintingOrder] = useState<AggregatorOrder | null>(null);

  // Dining Benefit modal
  const [showGoldModal, setShowGoldModal] = useState<boolean>(false);
  const [memberCode, setMemberCode] = useState<string>('GOLD15');
  const [checkBillAmount, setCheckBillAmount] = useState<number>(1450);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const getWebhookUrl = (channelId: string) => {
    const origin = window.location.origin;
    // In dev codespaces, port 3000 routes to 8000 via proxy or direct backend URL
    const backendBase = origin.includes('app.github.dev')
      ? origin.replace('-3000.', '-8000.')
      : 'http://127.0.0.1:8000';
    return `${backendBase}/api/v1/aggregator/webhook/${channelId}`;
  };

  const fetchLiveState = async () => {
    try {
      const pRes = await authFetch('/api/v1/aggregator/platforms');
      if (pRes.ok) {
        const pData = await pRes.json();
        setPlatforms(pData);
      }
      const oRes = await authFetch('/api/v1/aggregator/orders');
      if (oRes.ok) {
        const oData = await oRes.json();
        if (Array.isArray(oData)) {
          // Play chime if new orders arrived and sound enabled
          if (soundEnabled && oData.length > orders.length && orders.length > 0) {
            playAudioChime();
          }
          setOrders(oData);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveState();
    const interval = setInterval(fetchLiveState, 8000);
    return () => clearInterval(interval);
  }, [soundEnabled, orders.length]);

  const playAudioChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  const handleCopyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleOpenSetup = (channelId: string) => {
    setSelectedChannel(channelId);
    const plat = platforms.find((p) => p.id === channelId);
    setOutletIdInput(plat?.outlet_id || '');
    setApiKeyInput('');
    setWebhookSecretInput('');
    setAutoAcceptInput(plat?.auto_accept || false);
    setConfigSuccessMsg(null);
    setShowSetupModal(true);
  };

  const handleSaveChannelConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletIdInput.trim()) {
      alert('Please enter your Outlet / Store ID.');
      return;
    }

    setSavingChannel(true);
    setConfigSuccessMsg(null);

    try {
      const res = await authFetch(`/api/v1/aggregator/config/${selectedChannel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedChannel,
          outlet_id: outletIdInput.trim(),
          api_key: apiKeyInput.trim() || undefined,
          api_username: apiUsernameInput.trim() || undefined,
          webhook_secret: webhookSecretInput.trim() || undefined,
          auto_accept: autoAcceptInput,
          is_active: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setConfigSuccessMsg(data.message || 'Channel connected and activated!');
        fetchLiveState();
        setTimeout(() => {
          setShowSetupModal(false);
          setConfigSuccessMsg(null);
        }, 1500);
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to connect channel.');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving configuration.');
    } finally {
      setSavingChannel(false);
    }
  };

  const handleDisconnectChannel = async (channelId: string) => {
    if (!confirm(`Are you sure you want to disconnect ${channelId.toUpperCase()}?`)) return;

    try {
      const res = await authFetch(`/api/v1/aggregator/config/${channelId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchLiveState();
        setShowSetupModal(false);
      }
    } catch {}
  };

  const handleSendTestWebhook = async (platformName: string) => {
    setSendingTest(true);
    setTestSuccessMsg(null);
    try {
      const res = await authFetch('/api/v1/aggregator/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: platformName,
          customer_name: 'Test Customer (Live Handshake)',
          customer_phone: '+91 98765 43210',
          item_name: 'Specialty Artisan Cold Brew 300ml',
          amount: 320.0,
        }),
      });

      if (res.ok) {
        playAudioChime();
        setTestSuccessMsg(`Test order pushed! Watching incoming feed...`);
        fetchLiveState();
        setTimeout(() => setTestSuccessMsg(null), 4000);
      }
    } catch {
    } finally {
      setSendingTest(false);
    }
  };

  const handleClearOrders = async () => {
    if (!confirm('Clear all orders from live stream?')) return;
    try {
      await authFetch('/api/v1/aggregator/orders', { method: 'DELETE' });
      setOrders([]);
    } catch {}
  };

  const handleTogglePlatform = async (platformId: string) => {
    const plat = platforms.find((p) => p.id === platformId);
    if (!plat?.connected) {
      handleOpenSetup(platformId);
      return;
    }

    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === platformId
          ? { ...p, status: p.status === 'Online' ? 'Paused' : 'Online' }
          : p
      )
    );
    try {
      await authFetch(`/api/v1/aggregator/platforms/${platformId}/toggle`, {
        method: 'POST',
      });
    } catch {}
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: AggregatorOrder['status']
  ) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    try {
      await authFetch(`/api/v1/aggregator/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {}
  };

  const handleVerifyBenefit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/v1/aggregator/dining-benefit/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'Zomato Gold',
          membership_code: memberCode,
          bill_amount: checkBillAmount,
        }),
      });
      const data = await res.json();
      setVerifyResult(data);
    } catch {}
  };

  const anyConnected = platforms.some((p) => p.connected);
  const connectedCount = platforms.filter((p) => p.connected).length;

  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'New') return o.status === 'NEW';
    if (activeTab === 'Kitchen') return o.status === 'ACCEPTED';
    if (activeTab === 'Ready') return o.status === 'READY';
    if (activeTab === 'Dispatched') return o.status === 'DISPATCHED';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#090a10] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="h-16 bg-[#0f111a] border-b border-white/10 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-600/30">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white">
                Online Delivery Aggregators
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Live Kitchen Dispatch
              </span>
            </div>
            <p className="text-xs text-slate-400">
              UrbanPiper • Swiggy Direct • Zomato Merchant • ONDC Network
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound alert toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold ${
              soundEnabled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}
            title={soundEnabled ? 'Mute incoming order chime' : 'Enable incoming order sound'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Chime On' : 'Chime Off'}</span>
          </button>

          {/* Dining Privilege button */}
          <button
            type="button"
            onClick={() => {
              setVerifyResult(null);
              setShowGoldModal(true);
            }}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Zomato Gold / Dineout</span>
          </button>

          {/* Connect Channels Wizard Button */}
          <button
            type="button"
            onClick={() => handleOpenSetup('urbanpiper')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
          >
            <LinkIcon className="w-4 h-4" />
            <span>Connect Channels</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
              {connectedCount}/4
            </span>
          </button>

          {/* Return to POS button */}
          <button
            type="button"
            onClick={() => navigate('/pos/dashboard')}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition"
          >
            POS Register
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Channel Status Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {platforms.map((plat) => (
            <div
              key={plat.id}
              className={`p-4 rounded-2xl border transition relative overflow-hidden flex flex-col justify-between ${
                plat.connected
                  ? plat.status === 'Online'
                    ? 'bg-[#121422] border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                    : 'bg-[#121422] border-amber-500/30 shadow-lg shadow-amber-500/5'
                  : 'bg-[#0f111a] border-white/5 opacity-85 hover:opacity-100 hover:border-indigo-500/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">{plat.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{plat.channel_type}</span>
                </div>

                {/* Status Badge */}
                {plat.connected ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                      plat.status === 'Online'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        plat.status === 'Online' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    ></span>
                    {plat.status}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-slate-400 border border-white/5">
                    Not Connected
                  </span>
                )}
              </div>

              {/* Outlet details & Toggle controls */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                {plat.connected ? (
                  <>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 block">
                        Outlet ID: <strong className="text-slate-200">{plat.outlet_id}</strong>
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Active Orders:{' '}
                        <strong className="text-white font-bold">{plat.active_orders}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTogglePlatform(plat.id)}
                        className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                          plat.status === 'Online'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                        }`}
                        title={plat.status === 'Online' ? 'Pause store during rush' : 'Resume store'}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{plat.status === 'Online' ? 'Pause' : 'Resume'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenSetup(plat.id)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 transition"
                        title="Configure channel"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenSetup(plat.id)}
                    className="w-full py-1.5 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Connect Channel</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Global Notification Banner if test was pushed */}
        {testSuccessMsg && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{testSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setTestSuccessMsg(null)}
              className="text-emerald-400 hover:text-white font-bold text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Orders Stream Section Header & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {(['All', 'New', 'Kitchen', 'Ready', 'Dispatched'] as const).map((tab) => {
              const count =
                tab === 'All'
                  ? orders.length
                  : tab === 'New'
                  ? orders.filter((o) => o.status === 'NEW').length
                  : tab === 'Kitchen'
                  ? orders.filter((o) => o.status === 'ACCEPTED').length
                  : tab === 'Ready'
                  ? orders.filter((o) => o.status === 'READY').length
                  : orders.filter((o) => o.status === 'DISPATCHED').length;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    activeTab === tab
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{tab} Orders</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      activeTab === tab ? 'bg-white/25 text-white' : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {anyConnected && (
              <button
                type="button"
                onClick={() => handleSendTestWebhook('Swiggy')}
                disabled={sendingTest}
                className="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                title="Simulate a real webhook arrival to test sound, display, and receipt printer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingTest ? 'Sending...' : 'Send Test Webhook'}</span>
              </button>
            )}

            {orders.length > 0 && (
              <button
                type="button"
                onClick={handleClearOrders}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/5 transition"
                title="Clear order queue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={fetchLiveState}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition"
              title="Refresh live order stream"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* STATE 1: NO PLATFORMS CONNECTED YET (Guided Onboarding Hero) */}
        {!anyConnected && orders.length === 0 && (
          <div className="bg-[#0f111c] border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-600/30">
              <LinkIcon className="w-8 h-8" />
            </div>

            <div className="max-w-xl mx-auto space-y-2">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Connect Your Delivery Channels
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your restaurant partner listings from <strong>Swiggy</strong>,{' '}
                <strong>Zomato</strong>, <strong>Dineout</strong>, or <strong>UrbanPiper Hub</strong>{' '}
                to receive real customer orders directly onto this terminal in real time.
              </p>
            </div>

            {/* Step by Step Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
              <div className="p-4 rounded-2xl bg-[#151726] border border-white/5 space-y-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="font-bold text-xs text-white">Copy Webhook Endpoint</h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Generate your dedicated, encrypted webhook callback URL to receive instant order
                  pushes.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#151726] border border-white/5 space-y-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="font-bold text-xs text-white">Paste in Merchant Portal</h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Paste the URL into your <em>UrbanPiper Atlas</em>, <em>Swiggy Partner</em>, or{' '}
                  <em>Zomato Business</em> account.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#151726] border border-white/5 space-y-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="font-bold text-xs text-white">Live Kitchen Dispatch</h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Orders automatically ring with audio alerts, print KOT tickets, and notify delivery
                  riders with OTPs.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenSetup('urbanpiper')}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/30 inline-flex items-center gap-2 transition"
            >
              <LinkIcon className="w-4 h-4" />
              <span>Start Channel Setup Wizard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STATE 2: CHANNELS ARE CONNECTED, BUT NO INCOMING ORDERS CURRENTLY */}
        {anyConnected && orders.length === 0 && (
          <div className="bg-[#0f111c] border border-white/10 rounded-3xl p-12 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"></span>
              <div className="relative w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Bike className="w-7 h-7" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-base text-white">Listening for Incoming Orders...</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Your store is online and active. When customers place orders on Swiggy, Zomato, or
                UrbanPiper, they will automatically appear here with sound chimes.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleSendTestWebhook('Swiggy')}
                disabled={sendingTest}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5 text-orange-400" />
                <span>Send Test Webhook Order</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenSetup('urbanpiper')}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Manage Integrations
              </button>
            </div>
          </div>
        )}

        {/* STATE 3: LIVE ACTIVE ORDERS STREAM */}
        {filteredOrders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-[#121422] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between"
              >
                {/* Order Top Bar */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${order.channel_color}`}
                    >
                      {order.platform}
                    </span>
                    <span className="font-mono text-xs font-extrabold text-white">#{order.id}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{order.order_time}</span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200 block">{order.customer_name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{order.customer_phone}</span>
                  </div>
                  {order.table_no && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold text-[10px]">
                      Dine-in {order.table_no}
                    </span>
                  )}
                </div>

                {/* Items List */}
                <div className="space-y-1.5 border-y border-white/5 py-3 text-xs">
                  {order.items.map((it, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-md bg-white/10 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {it.qty}x
                          </span>
                          <span className="font-medium text-slate-200">{it.name}</span>
                        </div>
                        {it.notes && (
                          <span className="text-[10px] text-amber-400/90 italic pl-5 block">
                            Note: {it.notes}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-300">₹{(it.price * it.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Financials & Rider Details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Net Bill:</span>
                    <span className="font-black text-sm text-emerald-400 font-mono">
                      ₹{order.total_amount.toFixed(2)}
                    </span>
                  </div>

                  {order.rider && (
                    <div className="p-2.5 rounded-xl bg-[#181a28] border border-white/5 text-[11px] flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 block">Delivery Rider:</span>
                        <strong className="text-slate-200">{order.rider.name}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-amber-400 font-mono block">
                          OTP: {order.rider.otp}
                        </span>
                        <span className="text-[10px] text-slate-400">{order.rider.status}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Controls based on Status */}
                <div className="pt-2 flex items-center gap-2">
                  {order.status === 'NEW' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateOrderStatus(order.id, 'ACCEPTED')}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept ({order.prep_time_mins}m)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateOrderStatus(order.id, 'CANCELLED')}
                        className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
                        title="Reject / Cancel"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {order.status === 'ACCEPTED' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateOrderStatus(order.id, 'READY')}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition"
                    >
                      <UtensilsCrossed className="w-4 h-4" />
                      <span>Mark Food Ready</span>
                    </button>
                  )}

                  {order.status === 'READY' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateOrderStatus(order.id, 'DISPATCHED')}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 flex items-center justify-center gap-1.5 transition"
                    >
                      <Bike className="w-4 h-4" />
                      <span>Handover to Rider</span>
                    </button>
                  )}

                  {order.status === 'DISPATCHED' && (
                    <div className="w-full py-2 rounded-xl bg-white/5 border border-white/5 text-center text-xs font-semibold text-slate-400 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Dispatched with Rider</span>
                    </div>
                  )}

                  {order.status === 'CANCELLED' && (
                    <div className="w-full py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center text-xs font-semibold text-rose-400">
                      Cancelled
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setPrintingOrder(order)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition"
                    title="Print KOT Ticket"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CHANNEL SETUP & WEBHOOK CONFIGURATION WIZARD MODAL */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f111c] border border-white/15 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    Delivery Channel Integration Wizard
                  </h3>
                  <p className="text-xs text-slate-400">
                    Connect real restaurant partner credentials & webhooks
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedChannel(p.id);
                    setOutletIdInput(p.outlet_id || '');
                    setConfigSuccessMsg(null);
                  }}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    selectedChannel === p.id
                      ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-md shadow-indigo-600/30'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <span className="text-xs block font-bold truncate">{p.name.split(' ')[0]}</span>
                  <span className="text-[10px] text-white/60 block">
                    {p.connected ? '● Linked' : 'Connect'}
                  </span>
                </button>
              ))}
            </div>

            {configSuccessMsg && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{configSuccessMsg}</span>
              </div>
            )}

            {/* Step 1: Dedicated Webhook URL */}
            <div className="p-4 rounded-2xl bg-[#151726] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center">
                    1
                  </span>
                  Your Webhook Callback URL
                </label>
                <a
                  href={platforms.find((p) => p.id === selectedChannel)?.portal_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                >
                  Open {selectedChannel.toUpperCase()} Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-slate-400">
                Copy this URL and paste it into your merchant developer settings:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getWebhookUrl(selectedChannel)}
                  className="flex-1 bg-[#090a10] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopyWebhookUrl(getWebhookUrl(selectedChannel))}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Step 2: Credentials Form */}
            <form onSubmit={handleSaveChannelConfig} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center">
                    2
                  </span>
                  Merchant Account Credentials
                </label>
                <p className="text-[11px] text-slate-400">
                  Enter your restaurant outlet details from the merchant dashboard:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Store / Outlet ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SWIGGY_BLR_10492"
                    value={outletIdInput}
                    onChange={(e) => setOutletIdInput(e.target.value)}
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>

                {selectedChannel === 'urbanpiper' && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Atlas Username
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. myrestaurant_api"
                      value={apiUsernameInput}
                      onChange={(e) => setApiUsernameInput(e.target.value)}
                      className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    API Key / Secret Token
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Webhook Verification Secret
                  </label>
                  <input
                    type="password"
                    placeholder="Optional HMAC secret"
                    value={webhookSecretInput}
                    onChange={(e) => setWebhookSecretInput(e.target.value)}
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Auto Accept Switch */}
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAcceptInput}
                  onChange={(e) => setAutoAcceptInput(e.target.checked)}
                  className="rounded border-white/10 bg-[#181a28] text-indigo-600 focus:ring-0"
                />
                <span className="text-xs text-slate-300 font-medium">
                  Auto-accept incoming orders immediately into kitchen queue
                </span>
              </label>

              {/* Footer buttons */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                {platforms.find((p) => p.id === selectedChannel)?.connected ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnectChannel(selectedChannel)}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Disconnect Channel</span>
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSetupModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingChannel}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50 transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{savingChannel ? 'Verifying...' : 'Save & Activate Channel'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KOT TICKET PRINT PREVIEW MODAL */}
      {printingOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-950 font-mono p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
              <h4 className="font-extrabold text-sm uppercase">*** KITCHEN ORDER TICKET (KOT) ***</h4>
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                {printingOrder.platform} ONLINE DELIVERY
              </p>
              <p className="text-[11px] text-slate-500">Order ID: #{printingOrder.id}</p>
              <p className="text-[10px] text-slate-400">{new Date().toLocaleString()}</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-bold border-b border-slate-200 pb-1">
                <span>ITEM</span>
                <span>QTY</span>
              </div>
              {printingOrder.items.map((it, i) => (
                <div key={i} className="flex justify-between items-start">
                  <div>
                    <span className="font-bold">{it.name}</span>
                    {it.notes && <span className="text-[10px] text-rose-600 block">*** {it.notes}</span>}
                  </div>
                  <span className="font-black text-sm">{it.qty}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-slate-300 pt-3 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-bold">{printingOrder.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Phone:</span>
                <span>{printingOrder.customer_phone}</span>
              </div>
              {printingOrder.rider && (
                <div className="flex justify-between font-bold text-indigo-700">
                  <span>Rider Pickup OTP:</span>
                  <span>{printingOrder.rider.otp}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setPrintingOrder(null)}
                className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setPrintingOrder(null);
                }}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Send to Printer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DINING PRIVILEGE MODAL */}
      {showGoldModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f111c] border border-white/15 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-white">Dining Privileges</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGoldModal(false)}
                className="w-7 h-7 rounded-full bg-white/5 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVerifyBenefit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Membership Voucher Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GOLD15, DINEOUT20, MAGICPIN"
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                  className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase font-mono tracking-wider focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Bill Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={checkBillAmount}
                  onChange={(e) => setCheckBillAmount(Number(e.target.value))}
                  className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-hidden focus:border-amber-500"
                />
              </div>

              {verifyResult && (
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    verifyResult.valid
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {verifyResult.valid ? (
                    <>
                      <div className="flex justify-between font-bold">
                        <span>{verifyResult.benefit_title}</span>
                        <span>-{verifyResult.discount_percent}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Discount Savings:</span>
                        <span className="font-mono font-bold">₹{verifyResult.discount_amount}</span>
                      </div>
                      <div className="flex justify-between text-xs pt-1 border-t border-emerald-500/20">
                        <span>Net Payable by Guest:</span>
                        <strong className="font-mono text-sm text-white">
                          ₹{verifyResult.net_payable}
                        </strong>
                      </div>
                    </>
                  ) : (
                    <span>{verifyResult.message}</span>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoldModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                >
                  Verify Privilege
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
