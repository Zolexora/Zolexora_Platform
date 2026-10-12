'use client'

import { useState, useTransition } from 'react'
import { updateRequestStatusAction } from '@/lib/actions/team-actions'
import { Button } from '@/components/ui/button'
import { REQUEST_STATUS_LABELS, type RequestStatus } from '@/lib/types'
import { Check } from 'lucide-react'

const ALL_STATUSES: RequestStatus[] = [
  'submitted',
  'in_review',
  'contracted',
  'in_development',
  'delivered',
]

export function RequestStatusUpdater({
  requestId,
  currentStatus,
}: {
  requestId: string
  currentStatus: RequestStatus
}) {
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus>(currentStatus)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function handleUpdate() {
    setMessage(null)
    startTransition(async () => {
      const res = await updateRequestStatusAction(requestId, selectedStatus)
      if (res.success) {
        setMessage('Status updated successfully!')
      } else {
        setMessage(res.error || 'Failed to update')
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {ALL_STATUSES.map((status) => {
          const isSelected = selectedStatus === status
          return (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[var(--color-brand-primary)] text-black shadow-sm'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5" />}
              {REQUEST_STATUS_LABELS[status]}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={handleUpdate}
          loading={isPending}
          disabled={selectedStatus === currentStatus}
        >
          Save Status Change
        </Button>
        {message && (
          <span className="text-xs text-[var(--color-brand-primary)]">
            {message}
          </span>
        )}
      </div>
    </div>
  )
}
