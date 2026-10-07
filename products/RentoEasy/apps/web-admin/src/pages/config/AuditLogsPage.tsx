import { useState }    from 'react'
import { useQuery }    from '@tanstack/react-query'
import { Loader2, FileText } from 'lucide-react'
import { adminAPI }   from '@/services/api'

const ACTION_COLOR: Record<string, string> = {
  USER_SUSPENDED:           'badge-red',
  USER_UNSUSPENDED:         'badge-green',
  KYC_VERIFIED:             'badge-green',
  KYC_REJECTED:             'badge-red',
  PROPERTY_ACTIVE:          'badge-green',
  PROPERTY_INACTIVE:        'badge-gray',
  MANUAL_PAYOUT_INITIATED:  'badge-blue',
  PAYMENT_REFUNDED:         'badge-amber',
  PLATFORM_CONFIG_UPDATED:  'badge-violet',
}

export function AuditLogsPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn:  () => adminAPI.auditLogs(page) as any,
    staleTime: 30000,
  })

  const logs       = (data as any)?.data ?? []
  const totalPages = (data as any)?.totalPages ?? 1

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-200" /></div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <FileText size={28} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm font-medium text-gray-700">No audit logs yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <FileText size={14} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge ${ACTION_COLOR[log.action] ?? 'badge-gray'} text-[10px]`}>
                          {log.action.replace(/_/g,' ')}
                        </span>
                        <span className="text-xs text-gray-400">
                          on {log.targetType} {log.targetId.slice(0,8)}…
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        By admin {log.actorId.slice(0,8)}…
                        {log.metadata?.reason && ` · "${log.metadata.reason}"`}
                      </p>
                      {log.metadata && Object.keys(log.metadata).filter(k => k !== 'reason').length > 0 && (
                        <div className="flex gap-3 mt-1">
                          {Object.entries(log.metadata as Record<string,any>)
                            .filter(([k]) => k !== 'reason')
                            .slice(0, 3)
                            .map(([k, v]) => (
                              <span key={k} className="text-[10px] text-gray-400">
                                {k}: <span className="text-gray-600">{String(v)}</span>
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    <time className="text-[11px] text-gray-400 shrink-0 mt-0.5">
                      {new Date(log.createdAt).toLocaleDateString('en-IN',{
                        day:'numeric', month:'short', year:'2-digit',
                      })}<br />
                      {new Date(log.createdAt).toLocaleTimeString('en-IN',{
                        hour:'2-digit', minute:'2-digit',
                      })}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage((v) => Math.max(1,v-1))} disabled={page===1}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40">← Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((v) => Math.min(totalPages,v+1))} disabled={page===totalPages}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
