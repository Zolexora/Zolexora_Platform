// ─── LISTINGS ADMIN PAGE ─────────────────────────────────────────────────────
import { useState }                              from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, CheckCircle, XCircle, Eye, Loader2, MapPin,
} from 'lucide-react'
import { propertiesAPI }  from '@/services/api'
import { formatCurrency } from '@rent-stay/utils'

const STATUS_OPTS = ['under_review','active','inactive']

export function ListingsAdminPage() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('under_review')
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)
  const [reason, setReason] = useState<Record<string,string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin-listings', status, search, page],
    queryFn:  () => propertiesAPI.list({ status: status||undefined, city: search||undefined, page, limit: 20 }) as any,
    staleTime: 30000,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, newStatus, r }: any) => propertiesAPI.updateStatus(id, newStatus, r),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-listings'] }),
  })

  const listings   = (data as any)?.data ?? []
  const total      = (data as any)?.total ?? 0
  const totalPages = (data as any)?.totalPages ?? 1

  const TYPE_LABELS: Record<string,string> = {
    single:'Single', shared:'Shared', pg:'PG', flat:'Flat', studio:'Studio',
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Listings ({total})</h1>

      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-2 overflow-x-auto">
          {STATUS_OPTS.map((s) => (
            <button key={s} onClick={() => { setStatus(s); setPage(1) }}
              className={`shrink-0 text-sm px-3.5 py-1.5 rounded-full border capitalize transition-colors
                ${status===s ? 'border-red-500 bg-red-50 text-red-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s.replace('_',' ')}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm w-full focus:border-red-400 focus:ring-1 focus:ring-red-100"
            placeholder="Filter by city…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-200" /></div>
      ) : (
        <div className="space-y-3">
          {listings.map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                  {p.photos?.[0] && <img src={p.photos[0].thumbnailUrl} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{p.title}</p>
                    <span className={`badge shrink-0 capitalize ${
                      p.status==='active'?'badge-green':p.status==='inactive'?'badge-gray':'badge-amber'}`}>
                      {p.status.replace('_',' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <MapPin size={11} /> {p.addressLine1}, {p.city}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    <span className="font-semibold text-gray-900">{formatCurrency(p.monthlyRent)}/mo</span>
                    <span className="capitalize">{TYPE_LABELS[p.type]}</span>
                    <span className="capitalize">{p.furnishing?.replace('_',' ')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                    <div className="w-5 h-5 rounded-full bg-gray-100 overflow-hidden">
                      {p.owner?.profilePhoto && <img src={p.owner.profilePhoto} alt="" className="w-full h-full object-cover" />}
                    </div>
                    Owner: {p.owner?.name} · {p.owner?.phone}
                    {p.owner?.aadhaarVerified && <span className="text-green-600 font-medium">· ✓ Verified</span>}
                  </div>
                </div>
              </div>

              {p.status === 'under_review' && (
                <div className="space-y-2">
                  <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:border-red-400"
                    placeholder="Rejection reason (optional)" value={reason[p.id]??''}
                    onChange={(e) => setReason((r) => ({ ...r, [p.id]: e.target.value }))} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateMut.mutate({ id: p.id, newStatus: 'active' })}
                      disabled={updateMut.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-700">
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      onClick={() => updateMut.mutate({ id: p.id, newStatus: 'inactive', r: reason[p.id] })}
                      disabled={updateMut.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-700">
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              )}

              {p.status === 'active' && (
                <button
                  onClick={() => updateMut.mutate({ id: p.id, newStatus: 'inactive' })}
                  disabled={updateMut.isPending}
                  className="w-full text-sm font-medium py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                  Deactivate Listing
                </button>
              )}
            </div>
          ))}

          {listings.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
              <p className="text-sm font-medium text-gray-700">No listings in this category</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-2">
              <button onClick={() => setPage((v) => Math.max(1,v-1))} disabled={page===1}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40">← Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((v) => Math.min(totalPages,v+1))} disabled={page===totalPages}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
