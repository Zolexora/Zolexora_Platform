import { useState }          from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery }           from '@tanstack/react-query'
import {
  MapPin, Star, Wifi, Wind, Car, Shield, ChevronLeft,
  ChevronRight, Share2, Heart, Calendar, IndianRupee,
  CheckCircle, Loader2,
} from 'lucide-react'
import { propertiesAPI }      from '@/services/api'
import { useAuthStore }       from '@/store/authStore'
import { formatCurrency }     from '@zolexora/rentoeasy-utils'
import BookingModal           from './BookingModal'

const TYPE_LABEL: Record<string, string> = {
  single:'Single Room', shared:'Shared Room', pg:'PG', flat:'Full Flat', studio:'Studio',
}
const FURNISH_LABEL: Record<string, string> = {
  furnished:'Furnished', semi_furnished:'Semi-Furnished', unfurnished:'Unfurnished',
}
const GENDER_LABEL: Record<string, string> = {
  male:'Boys only', female:'Girls only', any:'Any gender',
}

export default function PropertyDetailPage() {
  const { id }       = useParams<{ id: string }>()
  const navigate     = useNavigate()
  const { isAuthenticated } = useAuthStore()

  const [photoIdx,    setPhotoIdx]    = useState(0)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [saved,       setSaved]       = useState(false)

  const { data: property, isLoading, isError } = useQuery({
    queryKey: ['property', id],
    queryFn:  () => propertiesAPI.getOne(id!) as any,
    enabled:  !!id,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={28} className="animate-spin text-brand-600" />
    </div>
  )

  if (isError || !property) return (
    <div className="flex flex-col items-center justify-center py-32 text-gray-400">
      <div className="text-5xl mb-3">🏚</div>
      <p className="font-medium text-gray-700">Room not found</p>
      <Link to="/search" className="btn-primary mt-4 px-6">Browse rooms</Link>
    </div>
  )

  const photos   = property.photos ?? []
  const amenities = property.amenities ?? []

  const prevPhoto = () => setPhotoIdx((v) => (v - 1 + photos.length) % photos.length)
  const nextPhoto = () => setPhotoIdx((v) => (v + 1) % photos.length)

  const handleBook = () => {
    if (!isAuthenticated) { navigate('/login'); return }
    setBookingOpen(true)
  }

  return (
    <div className="max-w-4xl mx-auto pb-24">

      {/* Back */}
      <div className="px-4 pt-4 pb-2">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ChevronLeft size={16} /> Back
        </button>
      </div>

      {/* Photo gallery */}
      <div className="relative bg-gray-100 overflow-hidden" style={{ height: 320 }}>
        {photos.length > 0 ? (
          <img
            src={photos[photoIdx]?.url}
            alt={property.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">🏠</div>
        )}

        {photos.length > 1 && (
          <>
            <button onClick={prevPhoto}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80
                         backdrop-blur-sm rounded-full flex items-center justify-center shadow">
              <ChevronLeft size={18} />
            </button>
            <button onClick={nextPhoto}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80
                         backdrop-blur-sm rounded-full flex items-center justify-center shadow">
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
              {photos.map((_: any, i: number) => (
                <button key={i} onClick={() => setPhotoIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors
                    ${i === photoIdx ? 'bg-white' : 'bg-white/50'}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="absolute top-3 right-3 flex gap-2">
          <button onClick={() => navigator.share?.({ title: property.title, url: location.href })}
            className="w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow">
            <Share2 size={15} className="text-gray-700" />
          </button>
          <button onClick={() => setSaved(v => !v)}
            className="w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow">
            <Heart size={15} className={saved ? 'fill-red-500 text-red-500' : 'text-gray-600'} />
          </button>
        </div>

        {/* Photo count */}
        {photos.length > 1 && (
          <div className="absolute top-3 left-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            {photoIdx + 1} / {photos.length}
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-5">

        {/* Title + rating */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-gray-900 leading-snug flex-1">
              {property.title}
            </h1>
            {property.rating && (
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-100
                              px-2 py-1 rounded-lg shrink-0">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                <span className="text-sm font-semibold text-amber-700">
                  {property.rating.toFixed(1)}
                </span>
                <span className="text-xs text-amber-500">({property.reviewCount})</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 text-gray-500">
            <MapPin size={14} />
            <span className="text-sm">
              {[property.addressLine1, property.addressLine2, property.city]
                .filter(Boolean).join(', ')}
            </span>
          </div>
          {property.landmark && (
            <p className="text-xs text-gray-400 mt-0.5 ml-5">Near {property.landmark}</p>
          )}
        </div>

        {/* Quick tags */}
        <div className="flex flex-wrap gap-2">
          {[
            TYPE_LABEL[property.type],
            FURNISH_LABEL[property.furnishing],
            GENDER_LABEL[property.genderPreference],
          ].map((tag) => tag && (
            <span key={tag} className="badge badge-gray">{tag}</span>
          ))}
        </div>

        {/* Rent card */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-brand-700">
                  {formatCurrency(property.monthlyRent)}
                </span>
                <span className="text-sm text-gray-400">/month</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Security deposit: {formatCurrency(property.securityDeposit)}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Calendar size={14} />
                Available
              </div>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {new Date(property.availableFrom).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <button
            onClick={handleBook}
            className="btn-primary w-full text-base py-3"
          >
            Request Booking
          </button>

          <p className="text-xs text-center text-gray-400 mt-2">
            No payment until owner accepts
          </p>
        </div>

        {/* About */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-2">About this place</h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            {property.description}
          </p>
        </div>

        {/* Amenities */}
        {amenities.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-3">Amenities</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {amenities.map(({ amenity }: any, i: number) => (
                <div key={i}
                  className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700">
                  <CheckCircle size={15} className="text-brand-600 shrink-0" />
                  {amenity.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rules */}
        {property.rules && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-2">House Rules</h2>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-sm text-amber-800 leading-relaxed">{property.rules}</p>
            </div>
          </div>
        )}

        {/* Owner */}
        {property.owner && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-3">Owner</h2>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center
                              overflow-hidden shrink-0">
                {property.owner.profilePhoto
                  ? <img src={property.owner.profilePhoto} alt="" className="w-full h-full object-cover" />
                  : <span className="text-brand-700 font-bold text-lg">
                      {property.owner.name?.charAt(0)}
                    </span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{property.owner.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Shield size={12} className="text-brand-600" />
                  <span className="text-xs text-brand-700 font-medium">Verified Owner</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reviews */}
        {property.reviews?.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-3">
              Reviews ({property.reviewCount})
            </h2>
            <div className="space-y-3">
              {property.reviews.map((r: any) => (
                <div key={r.id} className="card p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0">
                      {r.tenant?.profilePhoto
                        ? <img src={r.tenant.profilePhoto} alt="" className="w-full h-full object-cover" />
                        : <span className="w-full h-full flex items-center justify-center text-xs font-semibold text-gray-500">
                            {r.tenant?.name?.charAt(0)}
                          </span>
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.tenant?.name}</p>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={10}
                            className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100
                      px-4 py-3 flex items-center justify-between md:hidden shadow-lg">
        <div>
          <p className="text-lg font-bold text-brand-700">{formatCurrency(property.monthlyRent)}</p>
          <p className="text-xs text-gray-400">per month</p>
        </div>
        <button onClick={handleBook} className="btn-primary px-8">
          Request Booking
        </button>
      </div>

      {/* Booking modal */}
      {bookingOpen && (
        <BookingModal
          property={property}
          onClose={() => setBookingOpen(false)}
        />
      )}
    </div>
  )
}
