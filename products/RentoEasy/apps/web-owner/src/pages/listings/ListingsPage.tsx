import { useState }                           from 'react'
import { Link, useNavigate }                   from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Image,
  MapPin, MoreVertical, Loader2, Camera,
} from 'lucide-react'
import { propertiesAPI }  from '@/services/api'
import { formatCurrency } from '@rent-stay/utils'

const STATUS_BADGE: Record<string, string> = {
  active:       'badge-green',
  occupied:     'badge-blue',
  inactive:     'badge-gray',
  under_review: 'badge-amber',
}

export default function ListingsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['my-listings'],
    queryFn:  () => propertiesAPI.myListings() as any,
    staleTime: 30000,
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      propertiesAPI.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-listings'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => propertiesAPI.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['my-listings'] }),
  })

  const listings = (data as any)?.data ?? []

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Listings</h1>
          <p className="text-sm text-gray-500 mt-0.5">{listings.length} properties</p>
        </div>
        <Link to="/listings/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Listing
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-gray-200" />
        </div>
      )}

      {!isLoading && listings.length === 0 && (
        <div className="card p-12 text-center space-y-4">
          <div className="text-5xl">🏠</div>
          <div>
            <p className="font-semibold text-gray-900">No listings yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Add your first property to start receiving booking requests.
            </p>
          </div>
          <Link to="/listings/new" className="btn-primary inline-flex items-center gap-2 px-6">
            <Plus size={16} /> Add First Listing
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {listings.map((p: any) => (
          <ListingCard
            key={p.id}
            property={p}
            onToggle={(id, status) => toggleMut.mutate({ id, status })}
            onDelete={(id) => {
              if (confirm('Delete this listing? This cannot be undone.')) deleteMut.mutate(id)
            }}
            isToggling={toggleMut.isPending}
          />
        ))}
      </div>
    </div>
  )
}

function ListingCard({ property: p, onToggle, onDelete, isToggling }: any) {
  const [menuOpen, setMenuOpen] = useState(false)
  const photo = p.photos?.find((x: any) => x.isPrimary) ?? p.photos?.[0]
  const isActive = p.status === 'active'

  return (
    <div className="card overflow-hidden">
      {/* Photo */}
      <div className="relative bg-gray-100 h-40">
        {photo ? (
          <img src={photo.thumbnailUrl ?? photo.url} alt={p.title}
            className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera size={28} className="text-gray-300" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-gray'} capitalize`}>
            {p.status.replace('_', ' ')}
          </span>
        </div>
        {/* Actions menu */}
        <div className="absolute top-2 right-2 relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow"
          >
            <MoreVertical size={15} className="text-gray-700" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-40">
                <Link to={`/listings/${p.id}/edit`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setMenuOpen(false)}>
                  <Edit2 size={14} /> Edit Details
                </Link>
                <Link to={`/listings/${p.id}/photos`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setMenuOpen(false)}>
                  <Image size={14} /> Manage Photos
                </Link>
                {p.status !== 'occupied' && p.status !== 'under_review' && (
                  <button
                    onClick={() => { onToggle(p.id, isActive ? 'inactive' : 'active'); setMenuOpen(false) }}
                    className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left hover:bg-gray-50"
                    disabled={isToggling}
                  >
                    {isActive ? <EyeOff size={14} className="text-amber-500" /> : <Eye size={14} className="text-green-500" />}
                    {isActive ? 'Deactivate' : 'Activate'}
                  </button>
                )}
                <button
                  onClick={() => { onDelete(p.id); setMenuOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 w-full text-left hover:bg-red-50"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 space-y-2">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{p.title}</h3>
        <div className="flex items-center gap-1 text-gray-400 text-xs">
          <MapPin size={11} />
          <span className="truncate">{p.addressLine1}, {p.city}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-violet-700">{formatCurrency(p.monthlyRent)}</span>
          <span className="text-xs text-gray-400 capitalize">{p.type.replace('_',' ')} · {p.furnishing.replace('_',' ')}</span>
        </div>

        {/* Photo count warning */}
        {(!p.photos || p.photos.length === 0) && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 text-xs text-amber-700">
            <Camera size={12} />
            Add photos to activate this listing
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Link to={`/listings/${p.id}/edit`} className="btn-outline flex-1 text-xs py-2 text-center">
            Edit
          </Link>
          <Link to={`/listings/${p.id}/photos`} className="btn-ghost flex-1 text-xs py-2 text-center border border-gray-200">
            Photos ({p.photos?.length ?? 0})
          </Link>
        </div>
      </div>
    </div>
  )
}
