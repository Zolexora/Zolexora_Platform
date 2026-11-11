import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams }  from 'react-router-dom'
import { useQuery }         from '@tanstack/react-query'
import { Search, MapPin, List, Map, Loader2, AlertCircle } from 'lucide-react'
import { propertiesAPI }    from '@/services/api'
import PropertyCard         from '@/components/property/PropertyCard'
import SearchFilters, { Filters } from '@/components/property/SearchFilters'
import MapView              from '@/components/map/MapView'
import { useDebounce }      from '@/hooks/useDebounce'

type ViewMode = 'list' | 'map'

const DEFAULT_FILTERS: Filters = {}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [query,   setQuery]   = useState(searchParams.get('q') ?? '')
  const [city,    setCity]    = useState(searchParams.get('city') ?? '')
  const [view,    setView]    = useState<ViewMode>('list')
  const [filters, setFilters] = useState<Filters>({
    type:             searchParams.get('type')      ?? undefined,
    furnishing:       searchParams.get('furnishing') ?? undefined,
    genderPreference: searchParams.get('gender')    ?? undefined,
    minRent:          searchParams.get('minRent')   ? Number(searchParams.get('minRent')) : undefined,
    maxRent:          searchParams.get('maxRent')   ? Number(searchParams.get('maxRent')) : undefined,
    sortBy:           searchParams.get('sort')      ?? 'newest',
  })
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [page,    setPage]    = useState(1)

  const debouncedQuery = useDebounce(query, 400)
  const debouncedCity  = useDebounce(city,  400)

  // Request user location silently on mount
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude) },
      () => {}, // silently fail
      { timeout: 5000 },
    )
  }, [])

  // Sync filters → URL params
  useEffect(() => {
    const p: Record<string, string> = {}
    if (debouncedQuery)       p.q          = debouncedQuery
    if (debouncedCity)        p.city       = debouncedCity
    if (filters.type)         p.type       = filters.type
    if (filters.furnishing)   p.furnishing = filters.furnishing
    if (filters.genderPreference) p.gender = filters.genderPreference
    if (filters.minRent)      p.minRent    = String(filters.minRent)
    if (filters.maxRent)      p.maxRent    = String(filters.maxRent)
    if (filters.sortBy)       p.sort       = filters.sortBy
    setSearchParams(p, { replace: true })
    setPage(1)
  }, [debouncedQuery, debouncedCity, filters])

  // Build API params
  const apiParams = {
    ...(debouncedQuery && { q: debouncedQuery }),
    ...(debouncedCity  && { city: debouncedCity }),
    ...(userLat && userLng && !debouncedCity && { lat: userLat, lng: userLng, radiusKm: 10 }),
    ...filters,
    page,
    limit: 20,
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['properties', apiParams],
    queryFn:  () => propertiesAPI.search(apiParams) as any,
    staleTime: 1000 * 60,
    placeholderData: (prev) => prev,
  })

  const properties = (data as any)?.data ?? []
  const total      = (data as any)?.total ?? 0
  const totalPages = (data as any)?.totalPages ?? 1

  const resetFilters = () => { setFilters(DEFAULT_FILTERS); setQuery(''); setCity('') }

  return (
    <div className="flex flex-col h-full">

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-3">
        <div className="flex gap-2">
          {/* City / location */}
          <div className="relative flex-1">
            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-8 rounded-xl text-sm"
              placeholder="City or area"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          {/* Keyword */}
          <div className="relative flex-[1.5]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-8 rounded-xl text-sm"
              placeholder="Search rooms, landmarks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`px-3 flex items-center gap-1.5 text-sm transition-colors
                ${view === 'list' ? 'bg-brand-700 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <List size={15} />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setView('map')}
              className={`px-3 flex items-center gap-1.5 text-sm transition-colors
                ${view === 'map' ? 'bg-brand-700 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Map size={15} />
              <span className="hidden sm:inline">Map</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <SearchFilters
          filters={filters}
          onChange={setFilters}
          onReset={resetFilters}
          resultCount={total}
        />
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {view === 'map' ? (
          <MapView
            properties={properties}
            userLat={userLat}
            userLng={userLng}
            onBoundsChange={(lat, lng) => {
              setUserLat(lat); setUserLng(lng)
            }}
          />
        ) : (
          <div className="h-full overflow-y-auto px-4 py-4">
            {/* Loading */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Loader2 size={32} className="animate-spin mb-3" />
                <p className="text-sm">Finding rooms…</p>
              </div>
            )}

            {/* Error */}
            {isError && (
              <div className="flex flex-col items-center justify-center py-20 text-red-400">
                <AlertCircle size={32} className="mb-3" />
                <p className="text-sm font-medium">Something went wrong</p>
                <p className="text-xs text-gray-400 mt-1">{(error as Error).message}</p>
              </div>
            )}

            {/* Empty */}
            {!isLoading && !isError && properties.length === 0 && (
              <EmptyState onReset={resetFilters} />
            )}

            {/* Grid */}
            {!isLoading && properties.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {properties.map((p: any) => (
                    <PropertyCard key={p.id} p={p} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8 pb-4">
                    <button
                      onClick={() => setPage((v) => Math.max(1, v - 1))}
                      disabled={page === 1}
                      className="btn-outline text-sm px-4 disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    <span className="text-sm text-gray-500 px-2">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
                      disabled={page === totalPages}
                      className="btn-outline text-sm px-4 disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="text-5xl mb-4">🏠</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">No rooms found</h3>
      <p className="text-sm text-gray-500 max-w-xs mb-5">
        Try a different city, adjust your budget, or clear the filters to see more results.
      </p>
      <button onClick={onReset} className="btn-primary px-6">
        Clear all filters
      </button>
    </div>
  )
}
