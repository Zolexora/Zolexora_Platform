import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery }    from '@tanstack/react-query'
import { Loader2 }     from 'lucide-react'
import { propertiesAPI } from '@/services/api'
import { useDebounce } from '@/hooks/useDebounce'
import PropertyCard    from '@/components/property/PropertyCard'

interface Props {
  properties:       any[]
  userLat:          number | null
  userLng:          number | null
  onBoundsChange:   (lat: number, lng: number) => void
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

declare global { interface Window { google: any; initMap: () => void } }

export default function MapView({ properties, userLat, userLng, onBoundsChange }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markers     = useRef<any[]>([])
  const infoWindow  = useRef<any>(null)

  const [mapCenter, setMapCenter] = useState({
    lat: userLat ?? 12.9716, // default: Bengaluru
    lng: userLng ?? 77.5946,
  })
  const [selected, setSelected]     = useState<any>(null)
  const [mapLoaded, setMapLoaded]   = useState(false)
  const debouncedCenter             = useDebounce(mapCenter, 600)

  // Fetch pins for current map area
  const { data: pinsData } = useQuery({
    queryKey: ['map-pins', debouncedCenter],
    queryFn:  () => propertiesAPI.mapPins(debouncedCenter.lat, debouncedCenter.lng, 8) as any,
    staleTime: 30000,
    enabled:  mapLoaded,
  })
  const pins: any[] = (pinsData as any) ?? []

  // Load Google Maps script once
  useEffect(() => {
    if (window.google) { setMapLoaded(true); return }
    if (document.getElementById('gmaps-script')) return

    window.initMap = () => setMapLoaded(true)
    const s = document.createElement('script')
    s.id  = 'gmaps-script'
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=initMap`
    s.async = true; s.defer = true
    document.head.appendChild(s)

    return () => { delete window.initMap }
  }, [])

  // Init map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstance.current) return

    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center:    { lat: mapCenter.lat, lng: mapCenter.lng },
      zoom:      13,
      mapTypeControl:    false,
      fullscreenControl: false,
      streetViewControl: false,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    })

    infoWindow.current = new window.google.maps.InfoWindow()

    // Update center when map is dragged
    mapInstance.current.addListener('idle', () => {
      const c = mapInstance.current.getCenter()
      const newLat = c.lat(); const newLng = c.lng()
      setMapCenter({ lat: newLat, lng: newLng })
      onBoundsChange(newLat, newLng)
    })

    // User location marker
    if (userLat && userLng) {
      new window.google.maps.Marker({
        position: { lat: userLat, lng: userLng },
        map:      mapInstance.current,
        icon: {
          path:        window.google.maps.SymbolPath.CIRCLE,
          scale:       8,
          fillColor:   '#185FA5',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        title: 'Your location',
      })
    }
  }, [mapLoaded])

  // Render pins
  useEffect(() => {
    if (!mapInstance.current || !pins.length) return

    // Clear old markers
    markers.current.forEach((m) => m.setMap(null))
    markers.current = []

    pins.forEach((pin) => {
      const label = pin.monthlyRent >= 1000
        ? `₹${Math.round(pin.monthlyRent / 1000)}k`
        : `₹${pin.monthlyRent}`

      // Custom price-label marker
      const marker = new window.google.maps.Marker({
        position: { lat: Number(pin.latitude), lng: Number(pin.longitude) },
        map:      mapInstance.current,
        label: {
          text:      label,
          fontSize:  '11px',
          fontWeight:'600',
          color:     '#fff',
        },
        icon: {
          path:        'M -20,-10 L 20,-10 Q 24,-10 24,-6 L 24,6 Q 24,10 20,10 L 4,10 L 0,16 L -4,10 L -20,10 Q -24,10 -24,6 L -24,-6 Q -24,-10 -20,-10 Z',
          fillColor:   '#0F6E56',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 1.5,
          scale:       1,
          labelOrigin: new window.google.maps.Point(0, -1),
          anchor:      new window.google.maps.Point(0, 16),
        },
        title: pin.title,
      })

      marker.addListener('click', () => {
        setSelected(pin)
        mapInstance.current.panTo({ lat: Number(pin.latitude), lng: Number(pin.longitude) })
      })

      markers.current.push(marker)
    })
  }, [pins])

  if (!mapLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center text-gray-400">
          <Loader2 size={32} className="animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading map…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Pin count badge */}
      {pins.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm
                        shadow-md rounded-full px-3 py-1 text-xs font-medium text-gray-700">
          {pins.length} rooms in this area
        </div>
      )}

      {/* Selected property card */}
      {selected && (
        <div className="absolute bottom-4 left-4 right-4 max-w-sm mx-auto">
          <div className="relative">
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-2 -right-2 z-10 w-6 h-6 bg-white rounded-full shadow
                         flex items-center justify-center text-gray-400 hover:text-gray-700 text-xs"
            >
              ✕
            </button>
            <PropertyCard p={selected} compact />
          </div>
        </div>
      )}
    </div>
  )
}
