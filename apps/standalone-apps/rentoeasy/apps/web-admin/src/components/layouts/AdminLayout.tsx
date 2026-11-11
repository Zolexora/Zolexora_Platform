// ─── ADMIN LAYOUT ─────────────────────────────────────────────────────────────
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState }    from 'react'
import { useAuthStore } from '@/store/authStore'
import { authAPI }     from '@/services/api'
import {
  LayoutDashboard, Users, Home, CreditCard,
  ShieldCheck, Settings, LogOut, Menu, X, FileText,
} from 'lucide-react'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/users',     icon: Users,           label: 'Users'      },
  { to: '/listings',  icon: Home,            label: 'Listings'   },
  { to: '/payments',  icon: CreditCard,      label: 'Payments'   },
  { to: '/kyc',       icon: ShieldCheck,     label: 'KYC Queue'  },
  { to: '/logs',      icon: FileText,        label: 'Audit Logs' },
  { to: '/config',    icon: Settings,        label: 'Config'     },
]

export function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate          = useNavigate()
  const [open, setOpen]   = useState(false)

  const handleLogout = async () => {
    try { await authAPI.logout() } catch {}
    logout(); navigate('/login')
  }

  const NavItems = () => (
    <>
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
             ${isActive ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Icon size={18} />{label}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏠</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">Rent & Stay</p>
              <p className="text-[10px] text-red-600 font-semibold uppercase tracking-wide">Admin</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto"><NavItems /></nav>
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 px-2 mb-2">{user?.name}</p>
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-white h-full flex flex-col shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-bold">Admin Panel</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5"><NavItems /></nav>
            <div className="p-3 border-t">
              <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">
                <LogOut size={16} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100"><Menu size={20} /></button>
          <span className="font-bold text-sm text-red-700">Admin Panel</span>
          <div className="w-8" />
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  )
}

import { authAPI as aAPI } from '@/services/api'

export function AdminLoginPage() {
  const navigate    = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Email and password are required')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await aAPI.emailLogin(email.trim(), password) as any
      if (res.user?.role !== 'admin') {
        setError('Access denied: User is not an admin')
        return
      }
      setAuth(res.user, res.accessToken)
      navigate('/')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-600 rounded-2xl mb-4">
            <span className="text-2xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
          <p className="text-gray-400 text-sm mt-1">Rent & Stay Platform</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-2xl space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Admin Sign In</h2>
              <p className="text-sm text-gray-500 mt-0.5">Restricted access only</p>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email Address</label>
                <input
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm w-full focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  type="email"
                  placeholder="admin@rentandstay.in"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  autoFocus
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Password</label>
                <input
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm w-full focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  required
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white font-medium py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

