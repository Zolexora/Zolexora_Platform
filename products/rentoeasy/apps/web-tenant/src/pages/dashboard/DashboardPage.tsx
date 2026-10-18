import { useQuery }        from '@tanstack/react-query'
import { Link }             from 'react-router-dom'
import {
  Home, CreditCard, MessageSquare, Wrench,
  Calendar, CheckCircle, Clock, AlertCircle,
  ChevronRight, IndianRupee, Loader2,
} from 'lucide-react'
import { bookingsAPI, paymentsAPI } from '@/services/api'
import { useAuthStore }             from '@/store/authStore'
import { formatCurrency }           from '@zolexora/rentoeasy-utils'
import KYCBanner                    from '@/components/kyc/KYCBanner'

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  pending:   { label: 'Pending',   cls: 'badge-amber', icon: Clock },
  accepted:  { label: 'Accepted',  cls: 'badge-blue',  icon: CheckCircle },
  active:    { label: 'Active',    cls: 'badge-green', icon: CheckCircle },
  rejected:  { label: 'Rejected',  cls: 'badge-red',   icon: AlertCircle },
  cancelled: { label: 'Cancelled', cls: 'badge-gray',  icon: AlertCircle },
}

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: bookingsData } = useQuery({
    queryKey: ['my-bookings'],
    queryFn:  () => bookingsAPI.myBookings({ limit: 3 }) as any,
  })
  const { data: duePayments } = useQuery({
    queryKey: ['due-payments'],
    queryFn:  () => paymentsAPI.getDue() as any,
  })

  const bookings    = (bookingsData as any)?.data ?? []
  const activeBook  = bookings.find((b: any) => b.status === 'active')
  const pendingBook = bookings.find((b: any) => b.status === 'pending' || b.status === 'accepted')
  const dues        = (duePayments as any) ?? []
  const overdueDues = dues.filter((p: any) => p.isOverdue)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {greeting()}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Here's what's happening</p>
      </div>

      {/* KYC banner */}
      <KYCBanner />

      {/* Overdue alert */}
      {overdueDues.length > 0 && (
        <Link to="/payments" className="block">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={20} className="text-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-700">
                {overdueDues.length} overdue payment{overdueDues.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-500 mt-0.5">
                Total: {formatCurrency(overdueDues.reduce((s: number, p: any) => s + p.amountPaise / 100, 0))}
              </p>
            </div>
            <ChevronRight size={16} className="text-red-400 shrink-0" />
          </div>
        </Link>
      )}

      {/* Active booking */}
      {activeBook ? (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Your Current Home</h2>
            <span className="badge badge-green">Active</span>
          </div>
          <div className="flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
              {activeBook.property?.photos?.[0] && (
                <img src={activeBook.property.photos[0].thumbnailUrl}
                  alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 text-sm truncate">
                {activeBook.property?.title}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeBook.property?.city}
              </p>
              <p className="text-sm font-bold text-brand-700 mt-1">
                {formatCurrency(activeBook.monthlyRent)}/mo
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/payments" className="btn-primary text-sm py-2 text-center">
              Pay Rent
            </Link>
            <Link to="/chat" className="btn-outline text-sm py-2 text-center">
              Message Owner
            </Link>
          </div>
        </div>
      ) : pendingBook ? (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Booking in Progress</h2>
            <span className={`badge ${STATUS_CONFIG[pendingBook.status]?.cls}`}>
              {STATUS_CONFIG[pendingBook.status]?.label}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-800">{pendingBook.property?.title}</p>
          <p className="text-xs text-gray-500">{pendingBook.property?.city}</p>
          {pendingBook.status === 'accepted' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
              <p className="text-sm text-blue-700 font-medium">
                🎉 Booking accepted! Sign your agreement to confirm.
              </p>
              <Link
                to={`/bookings/${pendingBook.id}`}
                className="text-xs text-blue-600 underline mt-1 block"
              >
                Sign agreement →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-5 text-center space-y-3">
          <div className="text-4xl">🔍</div>
          <div>
            <p className="font-semibold text-gray-900">No active booking</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Find your perfect room and book it today
            </p>
          </div>
          <Link to="/search" className="btn-primary inline-block px-8">
            Browse Rooms
          </Link>
        </div>
      )}

      {/* Due payments */}
      {dues.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Upcoming Payments</h2>
            <Link to="/payments" className="text-sm text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {dues.slice(0, 3).map((p: any) => (
              <div key={p.id}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5
                  ${p.isOverdue ? 'bg-red-50' : 'bg-gray-50'}`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">{p.type.replace('_', ' ')}</p>
                  <p className={`text-xs mt-0.5 ${p.isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                    {p.isOverdue
                      ? `${p.daysOverdue}d overdue`
                      : `Due ${new Date(p.dueDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}`
                    }
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${p.isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatCurrency(p.amountPaise / 100)}
                  </p>
                  <Link to="/payments" className="text-xs text-brand-700 hover:underline">
                    Pay now →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Search, label: 'Find Rooms',     to: '/search' },
          { icon: MessageSquare, label: 'Messages', to: '/chat' },
          { icon: Wrench, label: 'Maintenance',    to: '/maintenance' },
          { icon: CreditCard, label: 'Payments',   to: '/payments' },
        ].map(({ icon: Icon, label, to }) => (
          <Link key={to} to={to}
            className="card p-4 flex flex-col items-center gap-2 hover:shadow-md
                       transition-shadow text-center group">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center
                            group-hover:bg-brand-100 transition-colors">
              <Icon size={18} className="text-brand-700" />
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// dummy import to avoid error
const Search = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)
