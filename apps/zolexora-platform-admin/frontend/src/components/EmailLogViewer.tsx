'use client';

import React, { useState } from 'react';
import { EmailLogRecord, EmailSendResponse } from '@/lib/types';
import { fetchEmailLogs, sendTestEmail } from '@/lib/api';

interface EmailLogViewerProps {
  initialLogs: EmailLogRecord[];
  initialTotal: number;
}

export default function EmailLogViewer({ initialLogs, initialTotal }: EmailLogViewerProps) {
  const [logs, setLogs] = useState<EmailLogRecord[]>(initialLogs);
  const [total, setTotal] = useState<number>(initialTotal);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);

  // Filters
  const [filterProduct, setFilterProduct] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Test Send Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testProduct, setTestProduct] = useState('zolexora-tms');
  const [testRecipient, setTestRecipient] = useState('admin@zolexora.com');
  const [testSubject, setTestSubject] = useState('Platform Admin Health Test');
  const [testSending, setTestSending] = useState(false);
  const [sendResult, setSendResult] = useState<EmailSendResponse | null>(null);

  const loadLogs = async (newPage = 1) => {
    setIsLoading(true);
    try {
      const res = await fetchEmailLogs({
        product: filterProduct || undefined,
        provider: filterProvider || undefined,
        status: filterStatus || undefined,
        page: newPage,
        limit,
      });
      setLogs(res.logs);
      setTotal(res.total);
      setPage(newPage);
    } catch (e) {
      console.error('Failed to load email logs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs(1);
  };

  const handleResetFilters = () => {
    setFilterProduct('');
    setFilterProvider('');
    setFilterStatus('');
    setSearchQuery('');
    setTimeout(() => {
      loadLogs(1);
    }, 50);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestSending(true);
    setSendResult(null);
    try {
      const res = await sendTestEmail({
        product: testProduct,
        to: [testRecipient],
        subject: testSubject,
        text_content: `Automated test email dispatched from Platform Admin Command Center at ${new Date().toISOString()}`,
      });
      setSendResult(res);
      // Reload logs after dispatch
      setTimeout(() => {
        loadLogs(1);
      }, 500);
    } catch (e: any) {
      console.error('Test email send failed:', e);
      setSendResult({
        success: false,
        message_id: 'err_fallback_offline',
        provider_used: 'resend',
        account_used: 'offline_mode',
        status: 'failed',
        attempt_count: 1,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setTestSending(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.recipient.toLowerCase().includes(q) ||
      log.subject.toLowerCase().includes(q) ||
      log.product.toLowerCase().includes(q) ||
      log.message_id.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: EmailLogRecord['status']) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
            Delivered
          </span>
        );
      case 'sent':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-950 text-sky-300 border border-sky-800">
            Sent
          </span>
        );
      case 'queued':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
            Queued
          </span>
        );
      case 'bounced':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950 text-rose-300 border border-rose-800">
            Bounced
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-950 text-red-300 border border-red-800">
            Failed
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-white">Permanent Delivery Logs</h3>
            <p className="text-xs text-slate-400">
              Querying permanent transactional records archived in MongoDB Atlas (<code>email_logs</code>).
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsTestModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow transition-colors"
            >
              ✉️ Send Test Dispatch
            </button>
            <button
              onClick={() => loadLogs(page)}
              disabled={isLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs border border-slate-700"
            >
              {isLoading ? 'Loading...' : '↻ Refresh'}
            </button>
          </div>
        </div>

        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipient or subject..."
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />

          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Products</option>
            <option value="zolexora-tms">zolexora-tms</option>
            <option value="zolexora-ims">zolexora-ims</option>
            <option value="clarityfi">clarityfi</option>
            <option value="marketplace">marketplace</option>
            <option value="textile-care">textile-care</option>
          </select>

          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Providers</option>
            <option value="resend">Resend</option>
            <option value="brevo">Brevo</option>
            <option value="sendgrid">SendGrid</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="delivered">Delivered</option>
            <option value="sent">Sent</option>
            <option value="queued">Queued</option>
            <option value="bounced">Bounced</option>
            <option value="failed">Failed</option>
          </select>

          <div className="flex space-x-1.5">
            <button
              type="submit"
              className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold border border-slate-700 transition-colors"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded text-xs border border-slate-700 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Timestamp (UTC)</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Provider & Account</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                    {new Date(log.sent_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
                      {log.product}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-indigo-300">
                    {log.recipient}
                  </td>
                  <td className="px-4 py-3 text-slate-200 font-medium max-w-xs truncate" title={log.subject}>
                    {log.subject}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-slate-300 uppercase font-semibold mr-1">
                      {log.provider}
                    </span>
                    <span className="text-slate-500 text-[11px]">({log.account})</span>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(log.status)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {log.bounce_reason ? (
                      <span className="text-rose-400 font-mono text-[11px] truncate max-w-xs inline-block" title={log.bounce_reason}>
                        {log.bounce_reason}
                      </span>
                    ) : log.opened ? (
                      <span className="text-emerald-400 text-[11px]">✓ Opened</span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Delivered</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-xs">
            No email logs found matching criteria.
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {filteredLogs.length} of {total} records
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => loadLogs(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 bg-slate-800 disabled:opacity-40 text-slate-300 rounded border border-slate-700"
            >
              Previous
            </button>
            <span className="px-2.5 py-1 bg-slate-950 font-mono text-slate-300 rounded border border-slate-800">
              Page {page}
            </span>
            <button
              onClick={() => loadLogs(page + 1)}
              disabled={page * limit >= total}
              className="px-2.5 py-1 bg-slate-800 disabled:opacity-40 text-slate-300 rounded border border-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Test Email Dispatch Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Send Transactional Test Email</h3>
              <button
                onClick={() => {
                  setIsTestModalOpen(false);
                  setSendResult(null);
                }}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTest} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Source Product:</label>
                <select
                  value={testProduct}
                  onChange={(e) => setTestProduct(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="zolexora-tms">zolexora-tms</option>
                  <option value="zolexora-ims">zolexora-ims</option>
                  <option value="clarityfi">clarityfi</option>
                  <option value="marketplace">marketplace</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Recipient Address:</label>
                <input
                  type="email"
                  required
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Email Subject:</label>
                <input
                  type="text"
                  required
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {sendResult && (
                <div
                  className={`p-3 rounded border ${
                    sendResult.success
                      ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/80 border-rose-800 text-rose-200'
                  }`}
                >
                  <div className="font-semibold">
                    {sendResult.success ? '✓ Dispatch Successful' : '✕ Dispatch Failed'}
                  </div>
                  <div className="text-[11px] mt-1 space-y-0.5">
                    <p>Provider: {sendResult.provider_used} ({sendResult.account_used})</p>
                    <p>Message ID: {sendResult.message_id}</p>
                    <p>Status: {sendResult.status}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsTestModalOpen(false);
                    setSendResult(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testSending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded text-xs font-semibold shadow transition-colors"
                >
                  {testSending ? 'Routing & Sending...' : 'Dispatch Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
