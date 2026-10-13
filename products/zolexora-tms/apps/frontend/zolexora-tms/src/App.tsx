import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ZolexoraAuthProvider } from '@zolexora/user-auth-firebase';
import { LoginForm } from './components/login-form';
import { OnboardingForm } from './components/onboarding-form';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
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
import { R1TikriOperationsPage } from './features/extensions/r1rcm/R1TikriOperationsPage';
import { AuthCallback } from './features/auth/AuthCallback';
import CompliancePage from './pages/compliance/CompliancePage';
import { ApplicationRuntimeProvider } from './providers/ApplicationRuntimeProvider';
import { LandingPage } from './pages/LandingPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function AuthPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      {children}
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ZolexoraAuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Landing & Authentication */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPageWrapper><LoginForm /></AuthPageWrapper>} />
            <Route path="/onboarding" element={<AuthPageWrapper><OnboardingForm /></AuthPageWrapper>} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected Workspace Navigation */}
            <Route element={<ProtectedRoute />}>
              <Route element={<ApplicationRuntimeProvider><DashboardLayout /></ApplicationRuntimeProvider>}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/duties" element={<DutiesPage />} />
                <Route path="/dispatch" element={<DispatchPage />} />
                <Route path="/settings/operating-units" element={<OperatingUnitsPage />} />
                <Route path="/compliance/vehicles" element={<VehiclesPage />} />
                <Route path="/compliance/drivers" element={<DriversPage />} />
                <Route path="/compliance/customers" element={<CustomersPage />} />
                <Route path="/compliance/vendors" element={<VendorsPage />} />
                <Route path="/rate-cards/customers" element={<RateCardsPage type="customer" />} />
                <Route path="/rate-cards/vendors" element={<RateCardsPage type="vendor" />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/payables" element={<PayablesPage />} />
                <Route path="/vendor-settlements" element={<VendorSettlementsPage />} />
                <Route path="/vendor-payments" element={<VendorPaymentHistoryPage />} />
                <Route path="/receivables" element={<ReceivablesAgeingPage />} />
                <Route path="/financial-periods" element={<FinancialPeriodsPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/reports/pnl" element={<PnLReportsPage />} />
                <Route path="/compliance" element={<CompliancePage />} />
                <Route path="/settings" element={<WorkspaceSettingsPage />} />
                <Route path="/settings/roles" element={<RolesPage />} />
                <Route path="/settings/members" element={<MembersPage />} />

                
                {/* Customer Specific Extensions */}
                <Route path="/operations/r1rcm/tikri" element={<R1TikriOperationsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ZolexoraAuthProvider>
    </QueryClientProvider>
  );
}

