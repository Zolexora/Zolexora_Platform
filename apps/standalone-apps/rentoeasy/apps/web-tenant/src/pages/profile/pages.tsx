// ─── PROFILE PAGE ────────────────────────────────────────────────────────────
import { useState, useRef }          from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, CheckCircle, Loader2, Plus, AlertCircle } from 'lucide-react'
import { usersAPI, maintenanceAPI }  from '@/services/api'
import { useAuthStore }              from '@/store/authStore'

export function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form,    setForm]    = useState({ name: user?.name ?? '', email: user?.email ?? '', city: user?.city ?? '', permanentAddress: user?.permanentAddress ?? '' })
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  const updateMut = useMutation({
    mutationFn: () => usersAPI.updateProfile(form),
    onSuccess:  (data: any) => { updateUser(data); setSaved(true); setTimeout(() => setSaved(false), 2500) },
    onError:    (e: any) => setError(e.message),
  })

  const photoMut = useMutation({
    mutationFn: (f: File) => usersAPI.uploadPhoto(f),
    onSuccess:  (data: any) => updateUser({ profilePhoto: data.profilePhoto }),
  })

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Profile</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-brand-100 overflow-hidden">
            {user?.profilePhoto
              ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
              : <span className="w-full h-full flex items-center justify-center text-2xl font-bold text-brand-700">
                  {user?.name?.charAt(0)}
                </span>
            }
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-7 h-7 bg-brand-700 text-white rounded-full
                       flex items-center justify-center shadow"
          >
            {photoMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) photoMut.mutate(f) }} />
        <div className="text-center">
          <p className="font-semibold text-gray-900">{user?.name}</p>
          <p className="text-sm text-gray-500">+91 {user?.phone}</p>
        </div>
      </div>

      {/* Form */}
      <div className="card p-4 space-y-4">
        {[
          { key: 'name',            label: 'Full Name',         placeholder: 'Rahul Sharma' },
          { key: 'email',           label: 'Email',             placeholder: 'rahul@email.com' },
          { key: 'city',            label: 'Current City',      placeholder: 'Bengaluru' },
          { key: 'permanentAddress',label: 'Permanent Address', placeholder: '12, MG Road, Bengaluru' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            <input
              className="input"
              placeholder={placeholder}
              value={(form as any)[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </div>
        ))}

        {error && (
          <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={() => updateMut.mutate()}
          disabled={updateMut.isPending}
          className="btn-primary w-full"
        >
          {updateMut.isPending ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Phone (read-only) */}
      <div className="card p-4">
        <p className="text-sm font-medium text-gray-700 mb-1.5">Mobile Number</p>
        <div className="flex items-center gap-2">
          <input className="input flex-1" value={`+91 ${user?.phone}`} readOnly
            style={{ background: '#f9fafb', cursor: 'not-allowed' }} />
          <span className="badge badge-green"><CheckCircle size={10} /> Verified</span>
        </div>
      </div>
    </div>
  )
}

// ─── MAINTENANCE PAGE ─────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { Link }     from 'react-router-dom'
import { Wrench, ChevronRight } from 'lucide-react'
import { bookingsAPI } from '@/services/api'

export function MaintenancePage() {
  const qc = useQueryClient()

  const { data: bookData } = useQuery({
    queryKey: ['my-bookings'],
    queryFn:  () => bookingsAPI.myBookings({ status: 'active' }) as any,
  })
  const activeBooking = ((bookData as any)?.data ?? [])[0]

  const { data: reqData, isLoading } = useQuery({
    queryKey: ['maintenance-requests'],
    queryFn:  () => maintenanceAPI.myList({}) as any,
    enabled:  !!activeBooking,
  })

  const [form, setForm]       = useState({ title: '', description: '', priority: 'medium', bookingId: activeBooking?.id ?? '' })
  const [open, setOpen]       = useState(false)
  const [error, setError]     = useState('')

  const createMut = useMutation({
    mutationFn: () => maintenanceAPI.create({ ...form, bookingId: activeBooking?.id }),
    onSuccess:  () => { setOpen(false); setForm({ title:'', description:'', priority:'medium', bookingId: activeBooking?.id ?? '' }); qc.invalidateQueries({ queryKey: ['maintenance-requests'] }) },
    onError:    (e: any) => setError(e.message),
  })

  const requests = (reqData as any)?.data ?? []

  const STATUS_COLORS: Record<string, string> = {
    open:        'badge-red',
    in_progress: 'badge-amber',
    resolved:    'badge-green',
    closed:      'badge-gray',
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Maintenance</h1>
        {activeBooking && (
          <button onClick={() => setOpen(true)} className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
            <Plus size={15} /> New Request
          </button>
        )}
      </div>

      {!activeBooking && (
        <div className="card p-6 text-center space-y-2">
          <Wrench size={28} className="text-gray-300 mx-auto" />
          <p className="text-sm font-medium text-gray-700">No active booking</p>
          <p className="text-xs text-gray-400">You can raise maintenance requests once you have an active booking.</p>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>}

      {requests.length > 0 && (
        <div className="card divide-y divide-gray-100 overflow-hidden">
          {requests.map((r: any) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                <Wrench size={15} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{r.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(r.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                </p>
              </div>
              <span className={`badge ${STATUS_COLORS[r.status] ?? 'badge-gray'} capitalize`}>
                {r.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {requests.length === 0 && activeBooking && !isLoading && (
        <div className="card p-6 text-center space-y-2">
          <p className="text-sm text-gray-500">No requests yet</p>
          <button onClick={() => setOpen(true)} className="btn-outline text-sm px-6">Raise a Request</button>
        </div>
      )}

      {/* New request modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-md p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">New Maintenance Request</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Issue Title</label>
              <input className="input" placeholder="e.g. Tap leaking in bathroom"
                value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea className="input resize-none" rows={3}
                placeholder="Describe the problem in detail…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
              <select className="input" value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low — not urgent</option>
                <option value="medium">Medium — needs attention</option>
                <option value="high">High — urgent</option>
                <option value="urgent">Urgent — emergency</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="btn-outline flex-1">Cancel</button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!form.title || !form.description || createMut.isPending}
                className="btn-primary flex-1"
              >
                {createMut.isPending ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
