import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ZolexoraAuthProvider } from '@zolexora/auth-client/react';
import { AUTH_SERVICE_PUBLIC_URL, TURNSTILE_SITE_KEY } from './lib/runtime';
import { AuthenticationForm } from './components/authentication-form';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { ClientRoute } from './routes/ClientRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ClientDashboardLayout } from './layouts/ClientDashboardLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { BookingsPage } from './features/bookings/BookingsPage';
import { DutiesPage } from './features/duties/DutiesPage';
import { DispatchPage } from './features/dispatch/DispatchPage';
import { VehiclesPage } from './features/fleet/VehiclesPage';
import { DriversPage } from './features/fleet/DriversPage';
import { CustomersPage } from './features/fleet/CustomersPage';
import { VendorsPage } from './features/fleet/VendorsPage';
import { RateCardsPage } from './features/rate-cards/RateCardsPage';
import { BillingPage } from './features/billing/BillingPage';
import { InvoicesPage } from './features/invoices/InvoicesPage';
import { PaymentsPage } from './features/billing/PaymentsPage';
import { PayablesPage } from './features/billing/PayablesPage';
import { ExpensesPage } from './features/expenses/ExpensesPage';
import { ReceivablesAgeingPage } from './features/billing/ReceivablesAgeingPage';
import { VendorPaymentHistoryPage } from './features/billing/VendorPaymentHistoryPage';
import { VendorSettlementsPage } from './features/billing/VendorSettlementsPage';
import { FinancialPeriodsPage } from './features/reports/FinancialPeriodsPage';
import { PnLReportsPage } from './features/reports/PnLReportsPage';
import { WorkspaceSettingsPage } from './features/organization/WorkspaceSettingsPage';
import { RolesPage } from './features/organization/RolesPage';
import { MembersPage } from './features/organization/MembersPage';
import { OperatingUnitsPage } from './features/operations/OperatingUnitsPage';
import CompliancePage from './pages/compliance/CompliancePage';
import { ApplicationRuntimeProvider } from './providers/ApplicationRuntimeProvider';
import { PublicLayout } from './layouts/PublicLayout';
import { LandingPage } from './pages/LandingPage';
import { OurServicesPage } from './pages/OurServicesPage';
import { SolutionsPage } from './pages/SolutionsPage';
import { PricingPage } from './pages/PricingPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { ClientDashboardPage } from './features/client-dashboard/ClientDashboardPage';
import { ClientBookingsPage } from './features/client-bookings/ClientBookingsPage';
import { ClientDutiesPage } from './features/client-duties/ClientDutiesPage';
import { ClientInvoicesPage } from './features/client-invoices/ClientInvoicesPage';
import { ClientPaymentsPage } from './features/client-payments/ClientPaymentsPage';
import { ClientSettingsPage } from './features/client-settings/ClientSettingsPage';
import { UserProfilePage } from './features/profile/UserProfilePage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { PublicTrackingPage } from './pages/PublicTrackingPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function AuthPageWrapper({ children, showBack = false }: { children: React.ReactNode; showBack?: boolean }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 p-4">
      {showBack && (
        <Link
          to="/"
          className="absolute top-6 left-6 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3.5 py-2 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back</span>
        </Link>
      )}
      {children}
    </div>
  );
}

export function App() {
  const authUrl = AUTH_SERVICE_PUBLIC_URL();
  if (!authUrl || !TURNSTILE_SITE_KEY()) {
    return (
      <AuthPageWrapper>
        <p className="text-sm text-rose-300">
          Sign-in is not configured: set AUTH_SERVICE_PUBLIC_URL and TURNSTILE_SITE_KEY in Infisical.
        </p>
      </AuthPageWrapper>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <ZolexoraAuthProvider authUrl={authUrl} product="zolexora-tms" optimisticHydration>
          <BrowserRouter>
          <Routes>
            {/* Public Editorial Marketing Pages */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/our-services" element={<OurServicesPage />} />
              <Route path="/ourservisess" element={<Navigate to="/our-services" replace />} />
              <Route path="/services" element={<Navigate to="/our-services" replace />} />
              <Route path="/solutions" element={<SolutionsPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Route>

            {/* Authentication & Invites */}
            <Route path="/authentication" element={<AuthPageWrapper showBack><AuthenticationForm /></AuthPageWrapper>} />
            <Route path="/invite" element={<AcceptInvitePage />} />
            <Route path="/invites/accept" element={<AcceptInvitePage />} />
            <Route path="/t/:token" element={<PublicTrackingPage />} />
            <Route path="/login" element={<Navigate to="/authentication" replace />} />
            <Route path="/onboarding" element={<Navigate to="/authentication" replace />} />
            <Route path="/auth" element={<Navigate to="/authentication" replace />} />

            {/* Service Provider Workspace */}
            <Route path="/sp" element={<ProtectedRoute />}>
              <Route element={<ApplicationRuntimeProvider><DashboardLayout /></ApplicationRuntimeProvider>}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="duties" element={<DutiesPage />} />
                <Route path="dispatch" element={<DispatchPage />} />
                <Route path="settings/operating-units" element={<OperatingUnitsPage />} />
                <Route path="compliance/vehicles" element={<VehiclesPage />} />
                <Route path="compliance/drivers" element={<DriversPage />} />
                <Route path="compliance/customers" element={<CustomersPage />} />
                <Route path="compliance/vendors" element={<VendorsPage />} />
                <Route path="rate-cards/customers" element={<RateCardsPage type="customer" />} />
                <Route path="rate-cards/vendors" element={<RateCardsPage type="vendor" />} />
                <Route path="billing" element={<BillingPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="payables" element={<PayablesPage />} />
                <Route path="vendor-settlements" element={<VendorSettlementsPage />} />
                <Route path="vendor-payments" element={<VendorPaymentHistoryPage />} />
                <Route path="receivables" element={<ReceivablesAgeingPage />} />
                <Route path="financial-periods" element={<FinancialPeriodsPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="reports/pnl" element={<PnLReportsPage />} />
                <Route path="compliance" element={<CompliancePage />} />
                <Route path="settings" element={<WorkspaceSettingsPage />} />
                <Route path="settings/roles" element={<RolesPage />} />
                <Route path="settings/members" element={<MembersPage />} />
                <Route path="profile" element={<UserProfilePage />} />
              </Route>
            </Route>

            {/* Client Portal — isolated workspace for CLIENT organisations */}
            <Route element={<ClientRoute />}>
              <Route element={<ApplicationRuntimeProvider><ClientDashboardLayout /></ApplicationRuntimeProvider>}>
                <Route path="/client/dashboard" element={<ClientDashboardPage />} />
                <Route path="/client/bookings" element={<ClientBookingsPage />} />
                <Route path="/client/duties" element={<ClientDutiesPage />} />
                <Route path="/client/invoices" element={<ClientInvoicesPage />} />
                <Route path="/client/payments" element={<ClientPaymentsPage />} />
                <Route path="/client/settings" element={<ClientSettingsPage />} />
                <Route path="/client/profile" element={<UserProfilePage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ZolexoraAuthProvider>
    </QueryClientProvider>
  );
}

