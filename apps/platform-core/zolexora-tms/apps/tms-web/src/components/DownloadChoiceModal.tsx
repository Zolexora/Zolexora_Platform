import { useState } from 'react';
import { AlertCircle, Download, FileSpreadsheet, FolderArchive, Loader2, X } from 'lucide-react';
import { downloadApiBlob } from '../lib/api';

export interface DownloadTarget {
  /** Label shown in modal header, e.g. "MH12AB1234", "Tata Consumer", or "All Vehicles" */
  title: string;
  entityType: 'VEHICLE' | 'VENDOR' | 'CUSTOMER' | 'DRIVER';
  /** Omit for Export All */
  entityId?: string;
  /** Callback to download the tabular details CSV */
  onDownloadDetails: () => void;
  fallbackZipName: string;
}

export function DownloadChoiceModal({
  target,
  onClose,
}: {
  target: DownloadTarget | null;
  onClose: () => void;
}) {
  const [isDownloadingDocs, setIsDownloadingDocs] = useState(false);
  const [error, setError] = useState('');

  if (!target) return null;

  const handleDocsDownload = async () => {
    setError('');
    setIsDownloadingDocs(true);
    try {
      const params = new URLSearchParams({ entity_type: target.entityType });
      if (target.entityId) params.set('entity_id', target.entityId);
      await downloadApiBlob(`/api/v1/compliance/export-docs?${params.toString()}`, target.fallbackZipName);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to download compliance documents');
    } finally {
      setIsDownloadingDocs(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-silver-300" />
            <h3 className="text-base font-bold text-white">Download — {target.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setError('');
              onClose();
            }}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Choose what you want to download:
        </p>

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={isDownloadingDocs}
            onClick={() => {
              target.onDownloadDetails();
              onClose();
            }}
            className="w-full flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3.5 text-left hover:border-navy-500 hover:bg-slate-800/70 transition disabled:opacity-50"
          >
            <FileSpreadsheet className="h-5 w-5 text-silver-300 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-white">Download Details (CSV)</div>
              <div className="text-xs text-slate-400">
                {target.entityId ? 'Export profile & registration fields as CSV' : 'Export all rows & fields as a CSV spreadsheet'}
              </div>
            </div>
          </button>

          <button
            type="button"
            disabled={isDownloadingDocs}
            onClick={handleDocsDownload}
            className="w-full flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3.5 text-left hover:border-navy-500 hover:bg-slate-800/70 transition disabled:opacity-60"
          >
            {isDownloadingDocs ? (
              <Loader2 className="h-5 w-5 text-navy-400 animate-spin shrink-0" />
            ) : (
              <FolderArchive className="h-5 w-5 text-navy-400 shrink-0" />
            )}
            <div>
              <div className="text-sm font-semibold text-white">
                {isDownloadingDocs ? 'Preparing ZIP...' : 'Download Compliance Docs (ZIP)'}
              </div>
              <div className="text-xs text-slate-400">
                {target.entityId
                  ? `ZIP folder "${target.title}/" with all uploaded documents`
                  : 'ZIP containing separate folders for each record with uploaded documents'}
              </div>
            </div>
          </button>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
