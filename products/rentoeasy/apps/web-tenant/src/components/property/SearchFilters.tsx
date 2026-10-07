import { useState }   from 'react'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'

export interface Filters {
  type?:            string
  minRent?:         number
  maxRent?:         number
  furnishing?:      string
  genderPreference?: string
  sortBy?:          string
}

interface Props {
  filters:    Filters
  onChange:   (f: Filters) => void
  onReset:    () => void
  resultCount: number
}

const TYPES = [
  { value: '',        label: 'All Types'  },
  { value: 'single',  label: 'Single Room' },
  { value: 'shared',  label: 'Shared Room' },
  { value: 'pg',      label: 'PG'          },
  { value: 'flat',    label: 'Full Flat'   },
  { value: 'studio',  label: 'Studio'      },
]

const FURNISHING = [
  { value: '',              label: 'Any'         },
  { value: 'furnished',     label: 'Furnished'   },
  { value: 'semi_furnished', label: 'Semi'       },
  { value: 'unfurnished',   label: 'Unfurnished' },
]

const GENDER = [
  { value: '',       label: 'Any Gender' },
  { value: 'male',   label: 'Boys only'  },
  { value: 'female', label: 'Girls only' },
]

const SORT = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'price_asc',  label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'rating',     label: 'Top rated' },
  { value: 'distance',   label: 'Nearest first' },
]

const RENT_PRESETS = [
  { label: '< ₹5k',        min: 0,     max: 5000  },
  { label: '₹5k–10k',      min: 5000,  max: 10000 },
  { label: '₹10k–20k',     min: 10000, max: 20000 },
  { label: '₹20k+',        min: 20000, max: undefined },
]

export default function SearchFilters({ filters, onChange, onReset, resultCount }: Props) {
  const [open, setOpen] = useState(false)

  const activeCount = [
    filters.type, filters.furnishing, filters.genderPreference,
    filters.minRent !== undefined, filters.maxRent !== undefined,
  ].filter(Boolean).length

  const set = (key: keyof Filters, val: any) =>
    onChange({ ...filters, [key]: val || undefined })

  const Chip = ({ value, current, label, onClick }: any) => (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors
        ${current === value || (value === '' && !current)
          ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }`}
    >
      {label}
    </button>
  )

  return (
    <>
      {/* Filter toggle bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-xl border
                      transition-colors ${activeCount > 0
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
        >
          <SlidersHorizontal size={15} />
          Filters
          {activeCount > 0 && (
            <span className="bg-brand-600 text-white text-xs rounded-full w-4 h-4
                             flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </button>

        {/* Quick sort */}
        <select
          value={filters.sortBy ?? 'newest'}
          onChange={(e) => set('sortBy', e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white
                     text-gray-700 cursor-pointer focus:border-brand-500 focus:ring-2
                     focus:ring-brand-100"
        >
          {SORT.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Active filter pills */}
        {filters.type && (
          <FilterPill label={TYPES.find(t => t.value === filters.type)?.label ?? filters.type}
            onRemove={() => set('type', '')} />
        )}
        {filters.furnishing && (
          <FilterPill label={FURNISHING.find(f => f.value === filters.furnishing)?.label ?? filters.furnishing}
            onRemove={() => set('furnishing', '')} />
        )}
        {filters.genderPreference && (
          <FilterPill label={GENDER.find(g => g.value === filters.genderPreference)?.label ?? filters.genderPreference}
            onRemove={() => set('genderPreference', '')} />
        )}
        {(filters.minRent !== undefined || filters.maxRent !== undefined) && (
          <FilterPill
            label={`₹${(filters.minRent ?? 0).toLocaleString('en-IN')}–${filters.maxRent ? (filters.maxRent).toLocaleString('en-IN') : '+'}`}
            onRemove={() => onChange({ ...filters, minRent: undefined, maxRent: undefined })}
          />
        )}

        <span className="text-sm text-gray-400 ml-auto">
          {resultCount} {resultCount === 1 ? 'room' : 'rooms'}
        </span>
      </div>

      {/* Filter panel */}
      {open && (
        <div className="card p-4 space-y-5 mt-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Filters</h3>
            <div className="flex items-center gap-3">
              {activeCount > 0 && (
                <button onClick={onReset} className="text-sm text-brand-700 hover:underline">
                  Reset all
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Room type */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Room Type</p>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <Chip key={t.value} value={t.value} current={filters.type ?? ''}
                  label={t.label} onClick={() => set('type', t.value)} />
              ))}
            </div>
          </div>

          {/* Rent range */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Monthly Rent</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {RENT_PRESETS.map((r) => (
                <button
                  key={r.label}
                  onClick={() => onChange({ ...filters, minRent: r.min || undefined, maxRent: r.max })}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                    ${filters.minRent === (r.min || undefined) && filters.maxRent === r.max
                      ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number" placeholder="Min ₹"
                className="input text-sm w-full"
                value={filters.minRent ?? ''}
                onChange={(e) => set('minRent', e.target.value ? Number(e.target.value) : undefined)}
              />
              <span className="text-gray-400 shrink-0">to</span>
              <input
                type="number" placeholder="Max ₹"
                className="input text-sm w-full"
                value={filters.maxRent ?? ''}
                onChange={(e) => set('maxRent', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>

          {/* Furnishing */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Furnishing</p>
            <div className="flex flex-wrap gap-2">
              {FURNISHING.map((f) => (
                <Chip key={f.value} value={f.value} current={filters.furnishing ?? ''}
                  label={f.label} onClick={() => set('furnishing', f.value)} />
              ))}
            </div>
          </div>

          {/* Gender */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Preferred For</p>
            <div className="flex flex-wrap gap-2">
              {GENDER.map((g) => (
                <Chip key={g.value} value={g.value} current={filters.genderPreference ?? ''}
                  label={g.label} onClick={() => set('genderPreference', g.value)} />
              ))}
            </div>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="btn-primary w-full"
          >
            Show {resultCount} {resultCount === 1 ? 'room' : 'rooms'}
          </button>
        </div>
      )}
    </>
  )
}

const FilterPill = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <span className="flex items-center gap-1 text-xs bg-brand-50 text-brand-700
                   border border-brand-200 px-2.5 py-1 rounded-full font-medium">
    {label}
    <button onClick={onRemove} className="ml-0.5 hover:text-brand-900">
      <X size={11} />
    </button>
  </span>
)
