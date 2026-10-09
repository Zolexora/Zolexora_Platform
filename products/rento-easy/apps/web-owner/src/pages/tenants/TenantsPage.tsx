import { useState }                         from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate }     from 'react-router-dom'
import {
  CheckCircle, XCircle, ExternalLink, Shield,
  ChevronLeft, Loader2, AlertCircle, ClipboardList,
} from 'lucide-react'
import { bookingsAPI } from '@/services/api'
import { formatCurrency } from '@rent-stay/utils'

const STATUS_TABS = [
  { value: '',          label: 'All'       },
  { value: 'pending',   label: 'Pending'   },
  { value: 'active',    label: 'Active'    },
  { value: 'accepted',  label: 'Accepted'  },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected',  label: 'Rejected'  },
]

export default function TenantsPage() {
  const [tab, setTab] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['owner-bookings', tab],
    queryFn:  () => bookingsAPI.myBookings({ status: tab || undefined }) as any,
    staleTime: 30000,
  })

  const bookings = (data as any)?.data ?? []

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Tenants & Bookings</h1>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`shrink-0 text-sm px-3.5 py-1.5 rounded-full border transition-colors
              ${tab === t.value ? 'border-violet-600 bg-violet-50 text-violet-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-300" /></div>}

      {!isLoading && bookings.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          <p className="font-medium text-gray-700 mb-1">No bookings yet</p>
          <p className="text-sm">Bookings will appear here once tenants request your properties.</p>
        </div>
      )}

      <div className="space-y-3">
        {bookings.map((b: any) => (
          <BookingCard key={b.id} booking={b} />
        ))}
      </div>
    </div>
  )
}

function BookingCard({ booking: b }: { booking: any }) {
  const qc    = useQueryClient()
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject]     = useState(false)

  const respondMut = useMutation({
    mutationFn: (action: 'accepted' | 'rejected') =>
      bookingsAPI.respond(b.id, action, action === 'rejected' ? rejectReason : undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-bookings'] }),
  })

  const isPending  = b.status === 'pending'
  const isActive   = b.status === 'active'
  const isAccepted = b.status === 'accepted'

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        {/* Tenant info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
            {b.tenant?.profilePhoto
              ? <img src={b.tenant.profilePhoto} alt="" className="w-full h-full object-cover" />
              : <span className="font-bold text-gray-500">{b.tenant?.name?.charAt(0)}</span>
            }
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{b.tenant?.name}</p>
            <p className="text-xs text-gray-500">+91 {b.tenant?.phone}</p>
            {b.tenant?.kycStatus === 'verified' && (
              <div className="flex items-center gap-1 mt-0.5">
                <Shield size={11} className="text-green-500" />
                <span className="text-xs text-green-600 font-medium">Aadhaar Verified</span>
              </div>
            )}
          </div>
        </div>
        <StatusBadge status={b.status} />
      </div>

      {/* Property + dates */}
      <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1">
        <p className="text-sm font-medium text-gray-900 truncate">{b.property?.title}</p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Move-in: {new Date(b.moveInDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
          <span className="font-semibold text-gray-900">{formatCurrency(b.monthlyRent)}/mo</span>
        </div>
      </div>

      {/* Actions */}
      {isPending && !showReject && (
        <div className="flex gap-2">
          <button
            onClick={() => respondMut.mutate('accepted')}
            disabled={respondMut.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm py-2"
          >
            <CheckCircle size={15} />
            {respondMut.isPending ? 'Accepting…' : 'Accept'}
          </button>
          <button
            onClick={() => setShowReject(true)}
            className="btn-outline flex-1 flex items-center justify-center gap-2 text-sm py-2 border-red-300 text-red-600 hover:bg-red-50"
          >
            <XCircle size={15} /> Reject
          </button>
        </div>
      )}

      {/* Reject form */}
      {showReject && (
        <div className="space-y-2">
          <input
            className="input text-sm"
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => setShowReject(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
            <button
              onClick={() => respondMut.mutate('rejected')}
              disabled={respondMut.isPending}
              className="flex-1 bg-red-600 text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-red-700"
            >
              {respondMut.isPending ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </div>
        </div>
      )}

      {/* Active booking actions */}
      {isActive && (
        <PoliceVerificationRow bookingId={b.id} policeStatus={b.policeVerificationStatus} />
      )}

      {/* Agreement signing */}
      {isAccepted && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="text-blue-500 shrink-0" />
          <p className="text-xs text-blue-700 flex-1">Agreement ready — waiting for both parties to sign</p>
          <AgreementSignButton bookingId={b.id} />
        </div>
      )}
    </div>
  )
}

function PoliceVerificationRow({ bookingId, policeStatus }: { bookingId: string; policeStatus: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: formData, isLoading } = useQuery({
    queryKey: ['police-form', bookingId],
    queryFn:  () => bookingsAPI.getPoliceForm(bookingId) as any,
    enabled:  open,
  })

  const updateMut = useMutation({
    mutationFn: (status: string) => bookingsAPI.updatePolice(bookingId, status),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['owner-bookings'] }),
  })

  const statusIcon = policeStatus === 'verified'   ? <CheckCircle size={14} className="text-green-500" />
                   : policeStatus === 'submitted'  ? <Shield size={14} className="text-blue-500" />
                   : <Shield size={14} className="text-amber-500" />

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
      >
        {statusIcon}
        <p className="text-sm font-medium text-gray-900 flex-1">Police Verification</p>
        <span className={`text-xs font-medium capitalize ${
          policeStatus === 'verified'  ? 'text-green-600' :
          policeStatus === 'submitted' ? 'text-blue-600'  : 'text-amber-600'
        }`}>{policeStatus}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-3 py-3 space-y-3 bg-gray-50">
          {isLoading && <Loader2 size={16} className="animate-spin text-gray-400 mx-auto" />}
          {formData && (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries((formData as any).prefilled ?? {}).slice(0, 6).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-gray-400 capitalize">{k.replace(/_/g, ' ')}</p>
                    <p className="font-medium text-gray-900 truncate">{String(v)}</p>
                  </div>
                ))}
              </div>
              {(formData as any).portalUrl && (
                <a href={(formData as any).portalUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 btn-primary text-xs py-2 justify-center">
                  <ExternalLink size={13} /> Submit on Police Portal
                </a>
              )}
              {policeStatus !== 'verified' && (
                <div className="flex gap-2">
                  {policeStatus === 'pending' && (
                    <button onClick={() => updateMut.mutate('submitted')}
                      className="flex-1 text-xs btn-outline py-2">
                      Mark Submitted
                    </button>
                  )}
                  {policeStatus === 'submitted' && (
                    <button onClick={() => updateMut.mutate('verified')}
                      className="flex-1 text-xs btn-primary py-2">
                      Mark Verified
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function AgreementSignButton({ bookingId }: { bookingId: string }) {
  const { data } = useQuery({
    queryKey: ['signing-url', bookingId],
    queryFn:  () => bookingsAPI.getOne(bookingId) as any,
  })
  return (
    <a href={(data as any)?.signingUrl} target="_blank" rel="noopener noreferrer"
      className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg shrink-0 hover:bg-blue-700">
      Sign →
    </a>
  )
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'badge-amber'  },
  accepted:  { label: 'Accepted',  cls: 'badge-blue'   },
  active:    { label: 'Active',    cls: 'badge-green'  },
  rejected:  { label: 'Rejected',  cls: 'badge-red'    },
  cancelled: { label: 'Cancelled', cls: 'badge-gray'   },
  completed: { label: 'Completed', cls: 'badge-gray'   },
}
const StatusBadge = ({ status }: { status: string }) => {
  const c = STATUS_CONFIG[status] ?? { label: status, cls: 'badge-gray' }
  return <span className={`badge ${c.cls} shrink-0`}>{c.label}</span>
}
