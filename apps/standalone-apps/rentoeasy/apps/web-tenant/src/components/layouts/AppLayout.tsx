import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState }                       from 'react'
import { useAuthStore }                   from '@/store/authStore'
import { authAPI }                        from '@/services/api'
import {
  Home, Search, CreditCard, MessageSquare,
  Wrench, User, Bell, LogOut, Menu, X, ShieldCheck,
} from 'lucide-react'

const NAV = [
  { to: '/',            icon: Home,          label: 'Dashboard'    },
  { to: '/search',      icon: Search,        label: 'Find Rooms'   },
  { to: '/payments',    icon: CreditCard,    label: 'Payments'     },
  { to: '/chat',        icon: MessageSquare, label: 'Messages'     },
  { to: '/maintenance', icon: Wrench,        label: 'Maintenance'  },
  { to: '/kyc',         icon: ShieldCheck,   label: 'Verification' },
  { to: '/profile',     icon: User,          label: 'Profile'      },
]

export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate          = useNavigate()
  const [open, setOpen]   = useState(false)

  const handleLogout = async () => {
    try { await authAPI.logout(localStorage.getItem('refresh_token') ?? undefined) } catch {}
    logout()
    navigate('/login')
  }

  const NavItems = () => (
    <>
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
             ${isActive
               ? 'bg-brand-50 text-brand-700'
               : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
             }`
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏠</span>
            <span className="font-bold text-gray-900">Rent & Stay</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <NavItems />
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center overflow-hidden shrink-0">
              {user?.profilePhoto
                ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
                : <span className="text-brand-700 font-semibold text-sm">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">+91 {user?.phone}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500
                       hover:bg-red-50 rounded-lg transition-colors mt-1"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-white h-full flex flex-col shadow-xl">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏠</span>
                <span className="font-bold text-gray-900">Rent & Stay</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5">
              <NavItems />
            </nav>
            <div className="p-3 border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500
                           hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">🏠</span>
            <span className="font-bold text-gray-900 text-sm">Rent & Stay</span>
          </div>
          <NavLink to="/profile" className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
            <span className="text-brand-700 font-semibold text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </NavLink>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
