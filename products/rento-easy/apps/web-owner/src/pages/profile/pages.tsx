// ─── PROFILE PAGE ────────────────────────────────────────────────────────────
import { useState, useRef }              from 'react'
import { useMutation, useQueryClient }   from '@tanstack/react-query'
import { Camera, Loader2, CheckCircle }  from 'lucide-react'
import { usersAPI }                      from '@/services/api'
import { useAuthStore }                  from '@/store/authStore'

export function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [form,  setForm]  = useState({ name: user?.name ?? '', email: user?.email ?? '' })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const updateMut = useMutation({
    mutationFn: () => usersAPI.updateProfile(form),
    onSuccess:  (d: any) => { updateUser(d); setSaved(true); setTimeout(() => setSaved(false), 2500) },
    onError:    (e: any) => setError(e.message),
  })

  const photoMut = useMutation({
    mutationFn: (f: File) => usersAPI.uploadPhoto(f),
    onSuccess:  (d: any) => updateUser({ profilePhoto: d.profilePhoto }),
  })

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Profile</h1>

      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-violet-100 overflow-hidden flex items-center justify-center">
            {user?.profilePhoto
              ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-violet-700">{user?.name?.charAt(0)}</span>}
          </div>
          <button onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-7 h-7 bg-violet-700 text-white rounded-full flex items-center justify-center shadow">
            {photoMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) photoMut.mutate(f) }} />
        <div className="text-center">
          <p className="font-semibold">{user?.name}</p>
          <p className="text-sm text-gray-500">+91 {user?.phone}</p>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        {[
          { key: 'name',  label: 'Full Name', placeholder: 'Rahul Sharma'      },
          { key: 'email', label: 'Email',     placeholder: 'rahul@email.com'   },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            <input className="input" placeholder={placeholder}
              value={(form as any)[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending} className="btn-primary w-full">
          {updateMut.isPending ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="card p-4">
        <p className="text-sm font-medium text-gray-700 mb-1.5">Mobile Number</p>
        <div className="flex items-center gap-2">
          <input className="input flex-1 bg-gray-50 cursor-not-allowed"
            value={`+91 ${user?.phone}`} readOnly />
          <span className="badge badge-green"><CheckCircle size={10} /> Verified</span>
        </div>
      </div>

      {/* KYC summary */}
      <div className="card p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-900">Verification Status</p>
        {[
          { label: 'Aadhaar', verified: user?.aadhaarVerified },
          { label: 'PAN',     verified: user?.panVerified     },
          { label: 'Bank Account', verified: user?.bankVerified },
        ].map(({ label, verified }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{label}</span>
            <span className={`badge ${verified ? 'badge-green' : 'badge-amber'}`}>
              {verified ? '✓ Verified' : 'Pending'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAINTENANCE PAGE ─────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { maintenanceAPI } from '@/services/api'
import { Wrench, CheckCircle2 } from 'lucide-react'

const PRIORITY_CLS: Record<string, string> = {
  low: 'badge-gray', medium: 'badge-blue', high: 'badge-amber', urgent: 'badge-red',
}
const STATUS_CLS: Record<string, string> = {
  open: 'badge-red', in_progress: 'badge-amber', resolved: 'badge-green', closed: 'badge-gray',
}

export function MaintenancePage() {
  const qc     = useQueryClient()
  const [tab,  setTab]  = useState('open')
  const [note, setNote] = useState<Record<string,string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['owner-maintenance', tab],
    queryFn:  () => maintenanceAPI.ownerList({ status: tab === 'all' ? undefined : tab }) as any,
    staleTime: 30000,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status, ownerNote }: any) => maintenanceAPI.update(id, { status, ownerNote }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['owner-maintenance'] }),
  })

  const requests = (data as any)?.data ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Maintenance Requests</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['open','in_progress','resolved','all'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 text-sm px-3.5 py-1.5 rounded-full border transition-colors capitalize
              ${tab===t ? 'border-violet-600 bg-violet-50 text-violet-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.replace('_',' ')}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-300" /></div>}

      {!isLoading && requests.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          <Wrench size={28} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm font-medium text-gray-700">No requests</p>
        </div>
      )}

      <div className="space-y-3">
        {requests.map((r: any) => (
          <div key={r.id} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {r.tenant?.name} · {r.property?.title}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`badge ${STATUS_CLS[r.status] ?? 'badge-gray'} capitalize`}>
                  {r.status.replace('_',' ')}
                </span>
                <span className={`badge ${PRIORITY_CLS[r.priority] ?? 'badge-gray'} capitalize`}>
                  {r.priority}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{r.description}</p>

            {r.photos?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {r.photos.map((url: string, i: number) => (
                  <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                ))}
              </div>
            )}

            {/* Owner note */}
            <div>
              <textarea className="input resize-none text-sm" rows={2}
                placeholder="Add a note for the tenant…"
                value={note[r.id] ?? r.ownerNote ?? ''}
                onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))} />
            </div>

            {/* Status actions */}
            {r.status !== 'resolved' && r.status !== 'closed' && (
              <div className="flex gap-2">
                {r.status === 'open' && (
                  <button
                    onClick={() => updateMut.mutate({ id: r.id, status: 'in_progress', ownerNote: note[r.id] })}
                    className="btn-outline flex-1 text-sm py-2">
                    Mark In Progress
                  </button>
                )}
                <button
                  onClick={() => updateMut.mutate({ id: r.id, status: 'resolved', ownerNote: note[r.id] })}
                  className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={14} /> Mark Resolved
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
