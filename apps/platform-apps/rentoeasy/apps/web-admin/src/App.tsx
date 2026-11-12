// ─── APP.TSX ─────────────────────────────────────────────────────────────────
import { Routes, Route, Navigate }    from 'react-router-dom'
import { useAuthStore }               from '@/store/authStore'
import { AdminLayout, AdminLoginPage } from '@/components/layouts/AdminLayout'
import {
  DashboardPage, UsersPage, KYCQueuePage, ConfigPage,
} from '@/pages/dashboard/pages'
import { ListingsAdminPage }          from '@/pages/listings/ListingsAdminPage'
import { PaymentsAdminPage }          from '@/pages/payments/PaymentsAdminPage'
import { AuditLogsPage }              from '@/pages/config/AuditLogsPage'

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route path="/"         element={<DashboardPage />} />
        <Route path="/users"    element={<UsersPage />} />
        <Route path="/listings" element={<ListingsAdminPage />} />
        <Route path="/payments" element={<PaymentsAdminPage />} />
        <Route path="/kyc"      element={<KYCQueuePage />} />
        <Route path="/logs"     element={<AuditLogsPage />} />
        <Route path="/config"   element={<ConfigPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
