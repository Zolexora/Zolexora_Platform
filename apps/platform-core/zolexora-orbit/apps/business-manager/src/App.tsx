import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth.store.js";
import { BusinessSessionGate } from "./components/auth/BusinessSessionGate.js";
import { DashboardLayout } from "./components/layout/DashboardLayout.js";
import { DashboardPage } from "./pages/dashboard/DashboardPage.js";
import { AppointmentsPage } from "./pages/appointments/AppointmentsPage.js";
import { CustomersPage } from "./pages/customers/CustomersPage.js";
import { ServicesPage } from "./pages/services/ServicesPage.js";
import { SchedulePage } from "./pages/schedule/SchedulePage.js";
import { SettingsPage } from "./pages/settings/SettingsPage.js";
import { LoginPage } from "./pages/auth/LoginPage.js";

export function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — requires business session */}
      <Route element={<BusinessSessionGate />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/appointments/*" element={<AppointmentsPage />} />
          <Route path="/customers/*" element={<CustomersPage />} />
          <Route path="/services/*" element={<ServicesPage />} />
          <Route path="/schedule/*" element={<SchedulePage />} />
          <Route path="/settings/*" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
