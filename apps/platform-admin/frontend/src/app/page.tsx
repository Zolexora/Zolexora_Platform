'use client';

import React, { useEffect, useState } from 'react';
import FleetGrid from '@/components/FleetGrid';
import DiagnosticBanner from '@/components/DiagnosticBanner';
import { fetchFleetOverview, fetchAccounts } from '@/lib/api';
import { FleetService, AccountDiagnosticAlert } from '@/lib/types';

export default function FleetOverviewPage() {
  const [services, setServices] = useState<FleetService[]>([]);
  const [alerts, setAlerts] = useState<AccountDiagnosticAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fleet, accountsRes] = await Promise.all([
        fetchFleetOverview(),
        fetchAccounts(),
      ]);
      setServices(fleet);
      setAlerts(accountsRes.alerts);
    } catch (e) {
      console.error('Failed to load fleet overview data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-white">
          Command Center Fleet Overview
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Unified operational telemetry and live health monitoring across Platform Control Plane, Cloud Database Clusters, and Services configured via Infisical.
        </p>
      </div>

      <DiagnosticBanner alerts={alerts} />

      <FleetGrid
        services={services}
        onRefresh={loadData}
        isLoading={isLoading}
      />
    </div>
  );
}
