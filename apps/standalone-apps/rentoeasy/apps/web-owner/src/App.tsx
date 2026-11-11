import { Routes, Route, Navigate }          from 'react-router-dom'
import { useAuthStore }                      from '@/store/authStore'
import AppLayout                             from '@/components/layouts/AppLayout'
import LoginPage                             from '@/pages/auth/LoginPage'
import DashboardPage                         from '@/pages/dashboard/DashboardPage'
import ListingsPage                          from '@/pages/listings/ListingsPage'
import ListingFormPage                       from '@/pages/listings/ListingFormPage'
import { PhotoManagerPage }                  from '@/pages/listings/PhotoManagerPage'
import TenantsPage                           from '@/pages/tenants/TenantsPage'
import { EarningsPage, KYCPage }             from '@/pages/earnings/pages'
import ChatPage                              from '@/pages/chat/ChatPage'
import { ProfilePage, MaintenancePage }      from '@/pages/profile/pages'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/"                         element={<DashboardPage />} />
        <Route path="/listings"                 element={<ListingsPage />} />
        <Route path="/listings/new"             element={<ListingFormPage />} />
        <Route path="/listings/:id/edit"        element={<ListingFormPage />} />
        <Route path="/listings/:id/photos"      element={<PhotoManagerPage />} />
        <Route path="/tenants"                  element={<TenantsPage />} />
        <Route path="/earnings"                 element={<EarningsPage />} />
        <Route path="/chat"                     element={<ChatPage />} />
        <Route path="/chat/:roomId"             element={<ChatPage />} />
        <Route path="/kyc"                      element={<KYCPage />} />
        <Route path="/maintenance"              element={<MaintenancePage />} />
        <Route path="/profile"                  element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
