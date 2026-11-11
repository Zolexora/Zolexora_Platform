// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef }  from 'react'
import { Link }              from 'react-router-dom'
import {
  Users, Home, IndianRupee, TrendingUp,
  AlertCircle, Clock, ShieldCheck, BarChart3,
  CheckCircle, XCircle, Search, Filter, Loader2,
  ChevronRight, RefreshCw, DollarSign,
} from 'lucide-react'
import { adminAPI, usersAPI, kycAPI, propertiesAPI } from '@/services/api'
import { formatCurrency } from '@zolexora/rentoeasy-utils'

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn:  () => adminAPI.dashboard() as any,
    refetchInterval: 60000,
  })
  const { data: payData } = useQuery({
    queryKey: ['payment-overview'],
    queryFn:  () => adminAPI.paymentOverview() as any,
  })

  const d = data as any
  const p = payData as any

  const stats = [
    { label: 'Total Users',      value: d?.users?.total ?? 0,           sub: `+${d?.users?.newThisMonth ?? 0} this month`, icon: Users,       color: 'blue'   },
    { label: 'Active Listings',  value: d?.properties?.active ?? 0,     sub: `${d?.properties?.pendingReview ?? 0} under review`, icon: Home, color: 'violet' },
    { label: 'Active Bookings',  value: d?.bookings?.active ?? 0,        sub: `${d?.bookings?.total ?? 0} total`,             icon: CheckCircle, color: 'green'  },
    { label: 'Platform Revenue', value: formatCurrency(d?.revenue?.totalPlatformFeeRupees ?? 0), sub: formatCurrency(d?.revenue?.thisMonthFeeRupees ?? 0) + ' this month', icon: IndianRupee, color: 'amber' },
    { label: 'Overdue Payments', value: p?.overdueCount ?? 0,            sub: `${p?.failedCount ?? 0} failed`,               icon: AlertCircle, color: 'red'    },
    { label: 'KYC Pending',      value: d?.pending?.kyc ?? 0,            sub: 'Documents awaiting review',                    icon: ShieldCheck, color: 'orange' },
    { label: 'Pending Listings', value: d?.pending?.listings ?? 0,       sub: 'Awaiting moderation',                          icon: Clock,       color: 'yellow' },
    { label: 'Total Collected',  value: formatCurrency(p?.totalCollectedRupees ?? 0), sub: `${p?.totalTransactions ?? 0} transactions`, icon: DollarSign, color: 'teal' },
  ]

  const COLOR_MAP: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700', violet: 'bg-violet-50 text-violet-700',
    green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700', orange: 'bg-orange-50 text-orange-700',
    yellow: 'bg-yellow-50 text-yellow-700', teal: 'bg-teal-50 text-teal-700',
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Platform Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time overview of Rent & Stay</p>
        </div>
        <div className="flex gap-2">
          {d?.pending?.kyc > 0 && (
            <Link to="/kyc" className="flex items-center gap-1.5 text-xs bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700">
              <ShieldCheck size={13} /> {d.pending.kyc} KYC pending
            </Link>
          )}
          {d?.pending?.listings > 0 && (
            <Link to="/listings" className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700">
              <Home size={13} /> {d.pending.listings} listings to review
            </Link>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-200" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {stats.map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${COLOR_MAP[color]}`}>
                  <Icon size={18} />
                </div>
                <p className="text-xl font-bold text-gray-900">{value}</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">{label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* City stats */}
          <CityStats />

          {/* Quick actions */}
          <div className="grid sm:grid-cols-3 gap-3">
            <Link to="/kyc" className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 hover:bg-amber-100 transition-colors">
              <ShieldCheck size={20} className="text-amber-600 shrink-0" />
              <div><p className="font-semibold text-amber-800 text-sm">Review KYC Documents</p><p className="text-xs text-amber-600 mt-0.5">{d?.pending?.kyc ?? 0} awaiting</p></div>
              <ChevronRight size={16} className="text-amber-400 ml-auto" />
            </Link>
            <Link to="/listings" className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 hover:bg-blue-100 transition-colors">
              <Home size={20} className="text-blue-600 shrink-0" />
              <div><p className="font-semibold text-blue-800 text-sm">Moderate Listings</p><p className="text-xs text-blue-600 mt-0.5">{d?.pending?.listings ?? 0} under review</p></div>
              <ChevronRight size={16} className="text-blue-400 ml-auto" />
            </Link>
            <Link to="/payments" className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 hover:bg-red-100 transition-colors">
              <IndianRupee size={20} className="text-red-600 shrink-0" />
              <div><p className="font-semibold text-red-800 text-sm">Process Payouts</p><p className="text-xs text-red-600 mt-0.5">{p?.overdueCount ?? 0} overdue payments</p></div>
              <ChevronRight size={16} className="text-red-400 ml-auto" />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

function CityStats() {
  const { data } = useQuery({ queryKey: ['city-stats'], queryFn: () => adminAPI.cityStats() as any })
  const cities = (data as any) ?? []
  if (!cities.length) return null
  const max = cities[0]?.listings ?? 1

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart3 size={16} className="text-gray-400" /> Top Cities by Listings
      </h2>
      <div className="space-y-2">
        {cities.slice(0, 6).map((c: any) => (
          <div key={c.city} className="flex items-center gap-3">
            <span className="text-sm text-gray-600 w-28 truncate">{c.city}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${(c.listings / max) * 100}%` }} />
            </div>
            <span className="text-sm font-semibold text-gray-900 w-10 text-right">{c.listings}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── USERS PAGE ───────────────────────────────────────────────────────────────

export function UsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [role,   setRole]   = useState('')
  const [page,   setPage]   = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, role, page],
    queryFn:  () => usersAPI.list({ search: search||undefined, role: role||undefined, page, limit: 20 }) as any,
    staleTime: 30000,
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: any) => usersAPI.toggleStatus(id, isActive),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const users      = (data as any)?.data ?? []
  const total      = (data as any)?.total ?? 0
  const totalPages = (data as any)?.totalPages ?? 1

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Users ({total})</h1>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm w-full focus:border-red-400 focus:ring-2 focus:ring-red-100"
            placeholder="Search name, phone, email…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-red-400"
          value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }}>
          <option value="">All roles</option>
          <option value="tenant">Tenants</option>
          <option value="owner">Owners</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-200" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['User','Role','KYC','Status','Joined','Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                        {u.profilePhoto
                          ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover" />
                          : <span className="text-xs font-bold text-gray-500">{u.name?.charAt(0)}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate max-w-32">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge capitalize ${u.role==='owner'?'badge-violet':u.role==='admin'?'badge-red':'badge-blue'}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge capitalize ${u.kycStatus==='verified'?'badge-green':u.kycStatus==='submitted'?'badge-blue':u.kycStatus==='rejected'?'badge-red':'badge-gray'}`}>{u.kycStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.isActive?'badge-green':'badge-red'}`}>{u.isActive?'Active':'Suspended'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => toggleMut.mutate({ id: u.id, isActive: !u.isActive })}
                        disabled={toggleMut.isPending}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors
                          ${u.isActive ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                      >
                        {u.isActive ? 'Suspend' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-gray-100">
              <button onClick={() => setPage((v) => Math.max(1, v-1))} disabled={page===1}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40">← Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((v) => Math.min(totalPages, v+1))} disabled={page===totalPages}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── KYC QUEUE PAGE ───────────────────────────────────────────────────────────

export function KYCQueuePage() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('submitted')
  const [reason, setReason] = useState<Record<string,string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['kyc-queue', status],
    queryFn:  () => kycAPI.queue(status) as any,
    staleTime: 30000,
  })

  const updateMut = useMutation({
    mutationFn: ({ docId, newStatus, r }: any) => kycAPI.updateStatus(docId, newStatus, r),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['kyc-queue'] }),
  })

  const docs = (data as any)?.data ?? []

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">KYC Queue</h1>

      <div className="flex gap-2">
        {['submitted','verified','rejected','pending'].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors capitalize
              ${status===s?'border-red-500 bg-red-50 text-red-700 font-medium':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-200" /></div>}

      <div className="space-y-3">
        {docs.map((doc: any) => (
          <div key={doc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{doc.user?.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {doc.user?.phone} · {doc.user?.role} · Doc: <span className="font-medium capitalize">{doc.type.replace('_',' ')}</span>
                </p>
              </div>
              <span className={`badge capitalize shrink-0 ${doc.status==='verified'?'badge-green':doc.status==='rejected'?'badge-red':doc.status==='submitted'?'badge-blue':'badge-gray'}`}>
                {doc.status}
              </span>
            </div>

            {doc.verifiedData && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(doc.verifiedData as Record<string,any>)
                  .filter(([k]) => !['s3Key','digioStatus','verifiedAt'].includes(k))
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] text-gray-400 capitalize">{k.replace(/([A-Z])/g,' $1')}</p>
                      <p className="text-xs font-medium text-gray-900 truncate">{String(v ?? '—')}</p>
                    </div>
                  ))}
              </div>
            )}

            {doc.status === 'submitted' && (
              <div className="space-y-2">
                <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:border-red-400"
                  placeholder="Rejection reason (optional)"
                  value={reason[doc.id] ?? ''}
                  onChange={(e) => setReason((r) => ({ ...r, [doc.id]: e.target.value }))} />
                <div className="flex gap-2">
                  <button
                    onClick={() => updateMut.mutate({ docId: doc.id, newStatus: 'verified' })}
                    disabled={updateMut.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-700">
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    onClick={() => updateMut.mutate({ docId: doc.id, newStatus: 'rejected', r: reason[doc.id] })}
                    disabled={updateMut.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-700">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!isLoading && docs.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
            <ShieldCheck size={28} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm font-medium text-gray-700">No documents in this queue</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CONFIG PAGE ──────────────────────────────────────────────────────────────

export function ConfigPage() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['platform-config'], queryFn: () => adminAPI.getConfig() as any })

  const [form, setForm] = useState<any>(null)
  const [saved, setSaved] = useState(false)

  if (data && !form) setForm(data)

  const updateMut = useMutation({
    mutationFn: () => adminAPI.updateConfig({
      platformFeePercent:  Number(form.platformFeePercent),
      rentDueDayOfMonth:   Number(form.rentDueDayOfMonth),
      otpExpirySeconds:    Number(form.otpExpirySeconds),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-config'] }); setSaved(true); setTimeout(() => setSaved(false), 2500) },
  })

  if (!form) return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-200" /></div>

  const fields = [
    { key: 'platformFeePercent', label: 'Platform Fee (%)', min: 0, max: 10, step: 0.5, suffix: '%', desc: 'Deducted from each rent payment before owner payout' },
    { key: 'rentDueDayOfMonth',  label: 'Rent Due Day',     min: 1, max: 28, step: 1,   suffix: '',  desc: 'Day of month rent is due (1 = first day)' },
    { key: 'otpExpirySeconds',   label: 'OTP Expiry',       min: 60,max: 600,step: 60,  suffix: 's', desc: 'OTP validity in seconds (300 = 5 minutes)' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Platform Config</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-5">
        {fields.map(({ key, label, min, max, step, suffix, desc }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}: <span className="text-red-600 font-bold">{form[key]}{suffix}</span>
            </label>
            <input type="range" min={min} max={max} step={step}
              className="w-full accent-red-600"
              value={form[key]}
              onChange={(e) => setForm((f: any) => ({ ...f, [key]: e.target.value }))} />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{min}{suffix}</span>
              <span className="text-gray-500 italic">{desc}</span>
              <span>{max}{suffix}</span>
            </div>
          </div>
        ))}

        <div className="border-t border-gray-100 pt-4">
          <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}
            className="w-full bg-red-600 text-white font-medium py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {updateMut.isPending ? 'Saving…' : saved ? '✓ Config Saved!' : 'Save Config'}
          </button>
        </div>
      </div>

      {/* Payout queue */}
      <PayoutQueue />
    </div>
  )
}

function PayoutQueue() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['payout-queue'], queryFn: () => adminAPI.payoutQueue() as any })
  const payouts = (data as any)?.data ?? []

  const triggerMut = useMutation({
    mutationFn: (paymentId: string) => adminAPI.triggerPayout(paymentId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['payout-queue'] }),
  })

  if (!payouts.length) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">Payout Queue ({payouts.length})</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {payouts.map((po: any) => (
          <div key={po.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{po.owner?.name}</p>
              <p className="text-xs text-gray-400">{po.owner?.phone} · {po.payment?.receiptNumber}</p>
            </div>
            <span className="text-sm font-bold text-gray-900">
              {formatCurrency(po.amountPaise / 100)}
            </span>
            <button onClick={() => triggerMut.mutate(po.paymentId)} disabled={triggerMut.isPending}
              className="text-xs bg-green-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1 shrink-0">
              <RefreshCw size={11} /> Payout
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
