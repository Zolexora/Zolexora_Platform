import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useAdminAuth } from './features/auth/useAdminAuth';
import { LoginPage } from './features/auth/LoginPage';
import { AdminLayout } from './layouts/AdminLayout';
import { TenantsPage } from './features/tenants/TenantsPage';
import { MembersPage } from './features/tenants/MembersPage';

const queryClient = new QueryClient();

function AdminPortal() {
  const { user, isLoading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('tenants');

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-black text-silver-400">
        <Loader2 className="h-8 w-8 animate-spin text-silver-300 mb-4" />
        <p className="text-sm font-medium">Verifying Administrator Session…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'tenants' && <TenantsPage />}
      {activeTab === 'members' && <MembersPage />}
    </AdminLayout>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AdminPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
