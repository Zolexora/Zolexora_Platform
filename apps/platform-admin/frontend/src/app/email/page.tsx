'use client';

import React, { useEffect, useState } from 'react';
import EmailQuotaBar from '@/components/EmailQuotaBar';
import EmailLogViewer from '@/components/EmailLogViewer';
import { fetchEmailQuotas, fetchEmailLogs } from '@/lib/api';
import { ProviderQuotaMetric, EmailLogRecord } from '@/lib/types';

export default function EmailOperationsPage() {
  const [providers, setProviders] = useState<ProviderQuotaMetric[]>([]);
  const [initialLogs, setInitialLogs] = useState<EmailLogRecord[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [quotasRes, logsRes] = await Promise.all([
        fetchEmailQuotas(),
        fetchEmailLogs({ page: 1, limit: 20 }),
      ]);
      setProviders(quotasRes.providers);
      setInitialLogs(logsRes.logs);
      setTotalLogs(logsRes.total);
    } catch (e) {
      console.error('Failed to load email operations data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalSentToday = providers.reduce((acc, curr) => acc + curr.daily_used, 0);
  const deliveredCount = initialLogs.filter((l) => l.status === 'delivered').length;
  const bouncedCount = initialLogs.filter((l) => l.status === 'bounced').length;
  const deliveryRate = totalLogs > 0 ? Number(((deliveredCount / totalLogs) * 100).toFixed(1)) : 100.0;
  const bounceRate = totalLogs > 0 ? Number(((bouncedCount / totalLogs) * 100).toFixed(1)) : 0.0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Unified Transactional Email Gateway
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Dynamic provider failover across Resend (100/d), Brevo (300/d), and SendGrid (100/d) with permanent MongoDB delivery archives.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="self-start sm:self-auto px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded text-xs font-medium transition-colors"
        >
          {isLoading ? 'Updating...' : '↻ Refresh Status'}
        </button>
      </div>

      <section>
        <EmailQuotaBar
          providers={providers}
          totalSentToday={totalSentToday}
          deliveryRatePercent={deliveryRate}
          bounceRatePercent={bounceRate}
        />
      </section>

      <section>
        <EmailLogViewer
          initialLogs={initialLogs}
          initialTotal={totalLogs}
        />
      </section>
    </div>
  );
}
