import { useQuery }     from '@tanstack/react-query'
import { Link }         from 'react-router-dom'
import {
  Home, Users, IndianRupee, Wrench,
  Plus, ChevronRight, TrendingUp, Clock,
  CheckCircle, AlertCircle, ShieldAlert,
} from 'lucide-react'
import { paymentsAPI, bookingsAPI, propertiesAPI, kycAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@zolexora/rentoeasy-utils'

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: earnings }   = useQuery({ queryKey: ['earnings'], queryFn: () => paymentsAPI.earnings() as any })
  const { data: bookData }   = useQuery({ queryKey: ['owner-bookings'], queryFn: () => bookingsAPI.myBookings({ limit: 5 }) as any })
  const { data: propData }   = useQuery({ queryKey: ['my-listings'], queryFn: () => propertiesAPI.myListings({ limit: 5 }) as any })
  const { data: kycData }    = useQuery({ queryKey: ['kyc-status'], queryFn: () => kycAPI.getStatus() as any })

  const earn     = (earnings as any)
  const bookings = (bookData as any)?.data ?? []
  const listings = (propData as any)?.data ?? []
  const kycStatus = (kycData as any)?.overall ?? 'pending'
  const pendingBookings = bookings.filter((b: any) => b.status === 'pending')

  const stats = [
    { label: 'Total Earned',   value: formatCurrency(earn?.totalEarnedRupees ?? 0), icon: IndianRupee, color: 'text-violet-700', bg: 'bg-violet-50' },
    { label: 'This Month',     value: formatCurrency(earn?.thisMonthRupees   ?? 0), icon: TrendingUp,  color: 'text-green-700',  bg: 'bg-green-50'  },
    { label: 'Active Listings',value: listings.filter((l: any) => l.status === 'active').length, icon: Home, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Payout Pending', value: formatCurrency(earn?.pendingPayoutRupees ?? 0), icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's your property overview</p>
        </div>
        <Link to="/listings/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Listing
        </Link>
      </div>

      {/* KYC alert */}
      {kycStatus !== 'verified' && (
        <Link to="/kyc">
          <div className={`flex items-center gap-3 border rounded-xl p-4
            ${kycStatus === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <ShieldAlert size={20} className={kycStatus === 'rejected' ? 'text-red-500' : 'text-amber-500'} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {kycStatus === 'pending'   && 'Complete verification to list properties'}
                {kycStatus === 'submitted' && 'Verification in progress…'}
                {kycStatus === 'rejected'  && 'Verification failed — please re-upload'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Aadhaar · PAN · Bank account required
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        </Link>
      )}

      {/* Pending bookings alert */}
      {pendingBookings.length > 0 && (
        <Link to="/tenants">
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <Clock size={20} className="text-blue-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">
                {pendingBookings.length} booking request{pendingBookings.length > 1 ? 's' : ''} waiting
              </p>
              <p className="text-xs text-blue-600 mt-0.5">Accept or reject within 24 hours</p>
            </div>
            <ChevronRight size={16} className="text-blue-400" />
          </div>
        </Link>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">

        {/* Recent bookings */}
        <div className="card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Bookings</h2>
            <Link to="/tenants" className="text-sm text-violet-700 hover:underline">View all</Link>
          </div>
          {bookings.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">No bookings yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {bookings.slice(0, 4).map((b: any) => (
                <Link key={b.id} to={`/tenants/${b.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {b.tenant?.profilePhoto
                      ? <img src={b.tenant.profilePhoto} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold text-gray-500">{b.tenant?.name?.charAt(0)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.tenant?.name}</p>
                    <p className="text-xs text-gray-400 truncate">{b.property?.title}</p>
                  </div>
                  <BookingBadge status={b.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Listings summary */}
        <div className="card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">My Listings</h2>
            <Link to="/listings" className="text-sm text-violet-700 hover:underline">View all</Link>
          </div>
          {listings.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400 mb-3">No listings yet</p>
              <Link to="/listings/new" className="btn-primary text-sm px-4">+ Add First Listing</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {listings.slice(0, 4).map((p: any) => (
                <Link key={p.id} to={`/listings/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                    {p.photos?.[0] && <img src={p.photos[0].thumbnailUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(p.monthlyRent)}/mo · {p.city}</p>
                  </div>
                  <ListingBadge status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const BOOKING_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'badge-amber'  },
  accepted:  { label: 'Accepted',  cls: 'badge-blue'   },
  active:    { label: 'Active',    cls: 'badge-green'  },
  rejected:  { label: 'Rejected',  cls: 'badge-red'    },
  cancelled: { label: 'Cancelled', cls: 'badge-gray'   },
  completed: { label: 'Completed', cls: 'badge-gray'   },
}
const LISTING_BADGE: Record<string, { label: string; cls: string }> = {
  active:       { label: 'Active',       cls: 'badge-green'  },
  occupied:     { label: 'Occupied',     cls: 'badge-blue'   },
  inactive:     { label: 'Inactive',     cls: 'badge-gray'   },
  under_review: { label: 'Under Review', cls: 'badge-amber'  },
}
const BookingBadge = ({ status }: { status: string }) => {
  const c = BOOKING_BADGE[status] ?? { label: status, cls: 'badge-gray' }
  return <span className={`badge ${c.cls} shrink-0`}>{c.label}</span>
}
const ListingBadge = ({ status }: { status: string }) => {
  const c = LISTING_BADGE[status] ?? { label: status, cls: 'badge-gray' }
  return <span className={`badge ${c.cls} shrink-0`}>{c.label}</span>
}
