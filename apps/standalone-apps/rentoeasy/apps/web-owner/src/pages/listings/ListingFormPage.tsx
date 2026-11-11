import { useState, useEffect }             from 'react'
import { useNavigate, useParams }          from 'react-router-dom'
import { useQuery, useMutation }           from '@tanstack/react-query'
import { ChevronLeft, Loader2, AlertCircle } from 'lucide-react'
import { propertiesAPI }                   from '@/services/api'

const TYPES      = ['single','shared','pg','flat','studio']
const FURNISHING = ['furnished','semi_furnished','unfurnished']
const GENDER     = ['any','male','female']

interface Form {
  title: string; description: string; type: string; monthlyRent: string
  securityDeposit: string; furnishing: string; genderPreference: string
  rules: string; availableFrom: string; addressLine1: string
  addressLine2: string; city: string; state: string; pincode: string
  landmark: string; latitude: string; longitude: string; amenityIds: string[]
}

const EMPTY: Form = {
  title:'', description:'', type:'single', monthlyRent:'', securityDeposit:'',
  furnishing:'furnished', genderPreference:'any', rules:'', availableFrom:'',
  addressLine1:'', addressLine2:'', city:'', state:'', pincode:'',
  landmark:'', latitude:'', longitude:'', amenityIds:[],
}

export default function ListingFormPage() {
  const { id }   = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEdit   = !!id

  const [form, setForm]   = useState<Form>(EMPTY)
  const [error, setError] = useState('')

  const { data: amenitiesData } = useQuery({
    queryKey: ['amenities'],
    queryFn:  () => propertiesAPI.amenities() as any,
  })
  const amenities = (amenitiesData as any) ?? []

  const { data: existing } = useQuery({
    queryKey: ['property', id],
    queryFn:  () => propertiesAPI.getOne(id!) as any,
    enabled:  isEdit,
  })

  useEffect(() => {
    if (!existing) return
    setForm({
      title:           existing.title ?? '',
      description:     existing.description ?? '',
      type:            existing.type ?? 'single',
      monthlyRent:     String(existing.monthlyRent ?? ''),
      securityDeposit: String(existing.securityDeposit ?? ''),
      furnishing:      existing.furnishing ?? 'furnished',
      genderPreference: existing.genderPreference ?? 'any',
      rules:           existing.rules ?? '',
      availableFrom:   existing.availableFrom?.split('T')[0] ?? '',
      addressLine1:    existing.addressLine1 ?? '',
      addressLine2:    existing.addressLine2 ?? '',
      city:            existing.city ?? '',
      state:           existing.state ?? '',
      pincode:         existing.pincode ?? '',
      landmark:        existing.landmark ?? '',
      latitude:        String(existing.latitude ?? ''),
      longitude:       String(existing.longitude ?? ''),
      amenityIds:      existing.amenities?.map((a: any) => a.amenityId) ?? [],
    })
  }, [existing])

  const set = (key: keyof Form, val: any) => setForm((f) => ({ ...f, [key]: val }))

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        monthlyRent:     Number(form.monthlyRent),
        securityDeposit: Number(form.securityDeposit),
        latitude:        Number(form.latitude),
        longitude:       Number(form.longitude),
      }
      return isEdit ? propertiesAPI.update(id!, payload) : propertiesAPI.create(payload)
    },
    onSuccess: (res: any) => navigate(`/listings/${res?.id ?? id}/photos`),
    onError:   (e: any)   => setError(e.message),
  })

  const Field = ({ label, req, children }: any) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {req && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/listings')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? 'Edit Listing' : 'New Listing'}
        </h1>
      </div>

      {/* Basic Info */}
      <div className="card p-4 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Basic Information</h2>

        <Field label="Title" req>
          <input className="input" placeholder="e.g. Furnished 1BHK near Metro, Koramangala"
            value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} />
          <p className="text-xs text-gray-400 mt-0.5 text-right">{form.title.length}/120</p>
        </Field>

        <Field label="Description" req>
          <textarea className="input resize-none" rows={4}
            placeholder="Describe the room — size, sunlight, neighbours, nearby facilities…"
            value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Room Type" req>
            <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.replace('_',' ')}</option>)}
            </select>
          </Field>
          <Field label="Furnishing" req>
            <select className="input" value={form.furnishing} onChange={(e) => set('furnishing', e.target.value)}>
              {FURNISHING.map((f) => <option key={f} value={f}>{f.replace('_',' ')}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monthly Rent (₹)" req>
            <input className="input" type="number" placeholder="12000"
              value={form.monthlyRent} onChange={(e) => set('monthlyRent', e.target.value)} />
          </Field>
          <Field label="Security Deposit (₹)" req>
            <input className="input" type="number" placeholder="24000"
              value={form.securityDeposit} onChange={(e) => set('securityDeposit', e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Preferred For" req>
            <select className="input" value={form.genderPreference} onChange={(e) => set('genderPreference', e.target.value)}>
              {GENDER.map((g) => <option key={g} value={g} className="capitalize">{g==='any'?'Any Gender':g==='male'?'Boys Only':'Girls Only'}</option>)}
            </select>
          </Field>
          <Field label="Available From" req>
            <input className="input" type="date" value={form.availableFrom}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => set('availableFrom', e.target.value)} />
          </Field>
        </div>

        <Field label="House Rules">
          <textarea className="input resize-none" rows={2}
            placeholder="No smoking, guests allowed till 10pm, etc."
            value={form.rules} onChange={(e) => set('rules', e.target.value)} maxLength={500} />
        </Field>
      </div>

      {/* Address */}
      <div className="card p-4 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Property Address</h2>

        <Field label="Address Line 1" req>
          <input className="input" placeholder="12, 5th Cross, Koramangala 4th Block"
            value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} />
        </Field>
        <Field label="Address Line 2">
          <input className="input" placeholder="Near Forum Mall (optional)"
            value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} />
        </Field>
        <Field label="Landmark">
          <input className="input" placeholder="Near Koramangala Water Tank"
            value={form.landmark} onChange={(e) => set('landmark', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="City" req>
            <input className="input" placeholder="Bengaluru"
              value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="State" req>
            <input className="input" placeholder="Karnataka"
              value={form.state} onChange={(e) => set('state', e.target.value)} />
          </Field>
          <Field label="Pincode" req>
            <input className="input" placeholder="560034" maxLength={6}
              value={form.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g,''))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" req>
            <input className="input" type="number" step="any" placeholder="12.9352"
              value={form.latitude} onChange={(e) => set('latitude', e.target.value)} />
          </Field>
          <Field label="Longitude" req>
            <input className="input" type="number" step="any" placeholder="77.6245"
              value={form.longitude} onChange={(e) => set('longitude', e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-gray-400">
          📍 Find coordinates: open Google Maps → right-click your property → copy coordinates
        </p>
      </div>

      {/* Amenities */}
      {amenities.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm">Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {amenities.map((a: any) => {
              const selected = form.amenityIds.includes(a.id)
              return (
                <button key={a.id}
                  onClick={() => set('amenityIds', selected
                    ? form.amenityIds.filter((x) => x !== a.id)
                    : [...form.amenityIds, a.id]
                  )}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                    ${selected ? 'border-violet-600 bg-violet-50 text-violet-700 font-medium'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {a.icon} {a.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        <button onClick={() => navigate('/listings')} className="btn-outline flex-1">Cancel</button>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !form.title || !form.monthlyRent || !form.city}
          className="btn-primary flex-1"
        >
          {saveMut.isPending ? <><Loader2 size={14} className="animate-spin inline mr-2" />Saving…</> : isEdit ? 'Save Changes' : 'Save & Add Photos →'}
        </button>
      </div>
    </div>
  )
}
