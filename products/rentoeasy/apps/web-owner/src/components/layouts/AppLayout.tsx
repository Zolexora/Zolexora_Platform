import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState }   from 'react'
import { useAuthStore } from '@/store/authStore'
import { authAPI }    from '@/services/api'
import {
  LayoutDashboard, Home, Users, IndianRupee,
  MessageSquare, Wrench, User, LogOut, Menu, X, ShieldCheck,
} from 'lucide-react'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/listings',  icon: Home,            label: 'Listings'   },
  { to: '/tenants',   icon: Users,           label: 'Tenants'    },
  { to: '/earnings',  icon: IndianRupee,     label: 'Earnings'   },
  { to: '/chat',      icon: MessageSquare,   label: 'Messages'   },
  { to: '/maintenance',icon: Wrench,         label: 'Maintenance'},
  { to: '/kyc',       icon: ShieldCheck,     label: 'Verification'},
  { to: '/profile',   icon: User,            label: 'Profile'    },
]

export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate          = useNavigate()
  const [open, setOpen]   = useState(false)

  const handleLogout = async () => {
    try { await authAPI.logout(localStorage.getItem('ras_owner_refresh') ?? undefined) } catch {}
    logout(); navigate('/login')
  }

  const NavItems = () => (
    <>
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
             ${isActive ? 'bg-violet-50 text-violet-700' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <Icon size={18} />{label}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 shrink-0">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xl">🏠</span>
          <div>
            <p className="font-bold text-gray-900 text-sm">Rent & Stay</p>
            <p className="text-[10px] text-violet-600 font-medium">Owner Portal</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto"><NavItems /></nav>
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-violet-100 overflow-hidden flex items-center justify-center shrink-0">
              {user?.profilePhoto
                ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
                : <span className="text-violet-700 font-bold text-sm">{user?.name?.charAt(0)}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">+91 {user?.phone}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg mt-1">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-white h-full flex flex-col shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-bold text-gray-900">Rent & Stay</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5"><NavItems /></nav>
            <div className="p-3 border-t">
              <button onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">
                <LogOut size={16} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <span className="font-bold text-sm">Owner Portal</span>
          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
            <span className="text-violet-700 font-bold text-sm">{user?.name?.charAt(0)}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  )
}
