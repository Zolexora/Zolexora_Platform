import { useState }       from 'react'
import { useNavigate }    from 'react-router-dom'
import { useMutation }    from '@tanstack/react-query'
import { X, Calendar, IndianRupee, AlertCircle, CheckCircle } from 'lucide-react'
import { bookingsAPI }    from '@/services/api'
import { formatCurrency } from '@rent-stay/utils'

interface Props {
  property: any
  onClose:  () => void
}

export default function BookingModal({ property, onClose }: Props) {
  const navigate = useNavigate()

  const [moveIn,   setMoveIn]   = useState('')
  const [message,  setMessage]  = useState('')
  const [success,  setSuccess]  = useState(false)

  // Min date = tomorrow
  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  const mutation = useMutation({
    mutationFn: () => bookingsAPI.create({
      propertyId: property.id,
      moveInDate: moveIn,
      message:    message.trim() || undefined,
    }),
    onSuccess: () => setSuccess(true),
  })

  if (success) {
    return (
      <ModalShell onClose={() => { onClose(); navigate('/') }}>
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-brand-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Booking Requested!</h3>
            <p className="text-sm text-gray-500 mt-1">
              We've notified the owner. You'll get a response within 24 hours.
            </p>
          </div>
          <button
            onClick={() => { onClose(); navigate('/') }}
            className="btn-primary w-full"
          >
            Go to Dashboard
          </button>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell onClose={onClose} title="Request Booking">
      <div className="space-y-4">

        {/* Property summary */}
        <div className="bg-gray-50 rounded-xl p-3 flex gap-3">
          <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden shrink-0">
            {property.photos?.[0] && (
              <img src={property.photos[0].thumbnailUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 line-clamp-2">{property.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{property.city}</p>
            <p className="text-sm font-bold text-brand-700 mt-1">
              {formatCurrency(property.monthlyRent)}/mo
            </p>
          </div>
        </div>

        {/* Move-in date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Move-in Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              className="input pl-9"
              min={minDateStr}
              value={moveIn}
              onChange={(e) => setMoveIn(e.target.value)}
            />
          </div>
        </div>

        {/* Message to owner */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Message to Owner <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Introduce yourself — e.g. I'm a working professional, non-smoker…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
          />
          <p className="text-xs text-gray-400 text-right mt-0.5">{message.length}/500</p>
        </div>

        {/* Cost summary */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Monthly rent</span>
            <span className="font-medium text-gray-900">{formatCurrency(property.monthlyRent)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Security deposit</span>
            <span className="font-medium text-gray-900">{formatCurrency(property.securityDeposit)}</span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
            <span>Total due on move-in</span>
            <span className="text-brand-700">
              {formatCurrency(property.monthlyRent + property.securityDeposit)}
            </span>
          </div>
        </div>

        {/* Note */}
        <div className="flex gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="text-blue-400 shrink-0 mt-0.5" />
          <span>No payment needed now. Pay only after the owner accepts and you sign the agreement.</span>
        </div>

        {/* Error */}
        {mutation.isError && (
          <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!moveIn || mutation.isPending}
            className="btn-primary flex-1"
          >
            {mutation.isPending ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function ModalShell({ children, onClose, title }: {
  children: React.ReactNode; onClose: () => void; title?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-md
                      max-h-[90vh] overflow-y-auto">
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
