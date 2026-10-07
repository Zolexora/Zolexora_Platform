import { Link }         from 'react-router-dom'
import { MapPin, Wifi, Wind, Car, Star, Heart } from 'lucide-react'
import { useState }       from 'react'
import { formatCurrency } from '@rent-stay/utils'

interface Photo  { url: string; thumbnailUrl: string; isPrimary: boolean }
interface Amenity { amenity: { name: string; icon: string } }

export interface PropertyCardProps {
  id:              string
  title:           string
  monthlyRent:     number
  securityDeposit: number
  type:            string
  furnishing:      string
  genderPreference: string
  city:            string
  addressLine1:    string
  landmark?:       string
  rating?:         number
  reviewCount:     number
  photos:          Photo[]
  amenities:       Amenity[]
  availableFrom:   string
  distance_km?:    number
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi:    <Wifi size={12} />,
  ac:      <Wind size={12} />,
  parking: <Car  size={12} />,
}

const TYPE_LABEL: Record<string, string> = {
  single: 'Single Room', shared: 'Shared Room',
  pg: 'PG', flat: 'Full Flat', studio: 'Studio',
}

const GENDER_BADGE: Record<string, { label: string; cls: string }> = {
  male:   { label: '♂ Boys',      cls: 'bg-blue-50 text-blue-600'  },
  female: { label: '♀ Girls',     cls: 'bg-pink-50 text-pink-600'  },
  any:    { label: '⚥ Any Gender', cls: 'bg-gray-100 text-gray-600' },
}

export default function PropertyCard({ p, compact = false }: { p: PropertyCardProps; compact?: boolean }) {
  const [saved, setSaved] = useState(false)
  const photo  = p.photos?.find((x) => x.isPrimary) ?? p.photos?.[0]
  const gender = GENDER_BADGE[p.genderPreference] ?? GENDER_BADGE.any

  return (
    <Link
      to={`/rooms/${p.id}`}
      className="card block overflow-hidden hover:shadow-md transition-shadow duration-200 group"
    >
      {/* Photo */}
      <div className="relative overflow-hidden bg-gray-100" style={{ height: compact ? 160 : 200 }}>
        {photo ? (
          <img
            src={photo.thumbnailUrl ?? photo.url}
            alt={p.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-gray-100">🏠</div>
        )}

        {/* Save button */}
        <button
          onClick={(e) => { e.preventDefault(); setSaved((v) => !v) }}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm
                     flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
          aria-label="Save property"
        >
          <Heart
            size={15}
            className={saved ? 'fill-red-500 text-red-500' : 'text-gray-400'}
          />
        </button>

        {/* Type badge */}
        <div className="absolute bottom-2.5 left-2.5">
          <span className="bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm">
            {TYPE_LABEL[p.type] ?? p.type}
          </span>
        </div>

        {/* Distance */}
        {p.distance_km !== undefined && (
          <div className="absolute bottom-2.5 right-2.5">
            <span className="bg-brand-700/90 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {p.distance_km < 1
                ? `${Math.round(p.distance_km * 1000)}m away`
                : `${p.distance_km.toFixed(1)} km away`}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 flex-1">
            {p.title}
          </h3>
          {p.rating && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <span className="text-xs font-medium text-gray-700">{p.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 text-gray-500">
          <MapPin size={12} className="shrink-0" />
          <span className="text-xs truncate">
            {p.landmark ?? p.addressLine1}, {p.city}
          </span>
        </div>

        {/* Rent + gender */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-base font-bold text-brand-700">
              {formatCurrency(p.monthlyRent)}
            </span>
            <span className="text-xs text-gray-400">/month</span>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${gender.cls}`}>
            {gender.label}
          </span>
        </div>

        {/* Amenities */}
        {!compact && p.amenities?.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {p.amenities.slice(0, 4).map(({ amenity }, i) => (
              <span
                key={i}
                className="flex items-center gap-1 bg-gray-50 text-gray-500
                           text-xs px-2 py-0.5 rounded-full border border-gray-100"
              >
                {AMENITY_ICONS[amenity.name.toLowerCase()] ?? '•'}
                {amenity.name}
              </span>
            ))}
            {p.amenities.length > 4 && (
              <span className="text-xs text-gray-400">+{p.amenities.length - 4} more</span>
            )}
          </div>
        )}

        {/* Deposit */}
        {!compact && (
          <p className="text-xs text-gray-400 border-t border-gray-50 pt-2">
            Deposit: {formatCurrency(p.securityDeposit)} ·{' '}
            Available from {new Date(p.availableFrom).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
          </p>
        )}
      </div>
    </Link>
  )
}
