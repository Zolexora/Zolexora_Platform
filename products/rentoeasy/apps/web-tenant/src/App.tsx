import { Routes, Route, Navigate }  from 'react-router-dom'
import { useAuthStore }              from '@/store/authStore'
import AppLayout              from '@/components/layouts/AppLayout'
import LoginPage              from '@/pages/auth/LoginPage'
import DashboardPage          from '@/pages/dashboard/DashboardPage'
import SearchPage             from '@/pages/search/SearchPage'
import PropertyDetailPage     from '@/pages/search/PropertyDetailPage'
import PaymentsPage           from '@/pages/payments/PaymentsPage'
import ChatPage               from '@/pages/chat/ChatPage'
import KYCPage                from '@/pages/kyc/KYCPage'
import { ProfilePage, MaintenancePage } from '@/pages/profile/pages'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"     element={<LoginPage />} />
      <Route path="/rooms/:id" element={<PropertyDetailPage />} />
      <Route path="/rooms"     element={<SearchPage />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/"              element={<DashboardPage />} />
        <Route path="/search"        element={<SearchPage />} />
        <Route path="/payments"      element={<PaymentsPage />} />
        <Route path="/chat"          element={<ChatPage />} />
        <Route path="/chat/:roomId"  element={<ChatPage />} />
        <Route path="/kyc"           element={<KYCPage />} />
        <Route path="/maintenance"   element={<MaintenancePage />} />
        <Route path="/profile"       element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
