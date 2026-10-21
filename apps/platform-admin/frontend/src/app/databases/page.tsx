'use client';

import React, { useEffect, useState } from 'react';
import CapacityGauge from '@/components/CapacityGauge';
import HotTableTable from '@/components/HotTableTable';
import DiagnosticBanner from '@/components/DiagnosticBanner';
import { fetchCapacityTelemetry } from '@/lib/api';
import { StorageQuotaMetric, HotTableMetric } from '@/lib/types';

export default function DatabasesCapacityPage() {
  const [databases, setDatabases] = useState<StorageQuotaMetric[]>([]);
  const [hotTables, setHotTables] = useState<HotTableMetric[]>([]);
  const [overallThresholdAlert, setOverallThresholdAlert] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadTelemetry = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCapacityTelemetry();
      setDatabases(data.databases);
      setHotTables(data.hot_tables);
      setOverallThresholdAlert(data.overall_threshold_alert);
    } catch (e) {
      console.error('Failed to load capacity telemetry:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTelemetry();
    const interval = setInterval(loadTelemetry, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Database & Storage Capacity Monitoring
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telemetry tracking against 500MB PostgreSQL (Supabase Core, Commerce, Business, AI/ERP) and 512MB MongoDB Atlas free limits.
          </p>
        </div>
        <button
          onClick={loadTelemetry}
          disabled={isLoading}
          className="self-start sm:self-auto px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded text-xs font-medium transition-colors"
        >
          {isLoading ? 'Updating...' : '↻ Refresh Telemetry'}
        </button>
      </div>

      <DiagnosticBanner alerts={[]} overallThresholdAlert={overallThresholdAlert} />

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <span>Cluster Storage Quotas</span>
          <span className="text-xs font-normal text-slate-400">
            (&lt;70% Green • 70-89% Amber • ≥90% Red Critical)
          </span>
        </h2>
        <CapacityGauge
          databases={databases}
          overallThresholdAlert={overallThresholdAlert}
        />
      </section>

      <section className="space-y-4">
        <HotTableTable
          tables={hotTables}
          onPinChange={loadTelemetry}
        />
      </section>
    </div>
  );
}
