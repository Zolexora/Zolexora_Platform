import { useState } from 'react';
import { useComplianceRecords, useComplianceRequirements, useUpdateComplianceRecord, useUploadComplianceDocument, useVerifyComplianceRecord, useWaiveComplianceRecord } from './hooks';
import { ComplianceEntityType } from './api';
import { FileWarning, ShieldCheck, Clock, Upload, CheckCircle, XCircle, FileText } from 'lucide-react';

const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(dateString));
};

export function EntityComplianceManager({ entityType, entityId }: { entityType: ComplianceEntityType; entityId: string }) {
  const { data: requirements = [], isLoading: reqLoading } = useComplianceRequirements(entityType);
  const { data: records = [], isLoading: recLoading } = useComplianceRecords({ entity_type: entityType, entity_id: entityId });
  
  const updateRecord = useUpdateComplianceRecord();
  const uploadDocument = useUploadComplianceDocument();
  const verifyRecord = useVerifyComplianceRecord();
  const waiveRecord = useWaiveComplianceRecord();

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [waivingRecordId, setWaivingRecordId] = useState<string | null>(null);
  const [waiverReason, setWaiverReason] = useState("");
  const [waiverDate, setWaiverDate] = useState("");
  
  // Form State
  const [documentNumber, setDocumentNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);

  if (reqLoading || recLoading) {
    return <div className="p-4 text-center text-sm text-silver-500">Loading compliance data...</div>;
  }

  const recordMap = new Map(records.map(r => [r.requirement_id, r]));

  const handleUploadClick = (reqId: string) => {
    setSelectedReqId(reqId);
    setDocumentNumber('');
    setExpiryDate('');
    setFile(null);
    uploadDocument.reset();
    setUploadModalOpen(true);
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqId || !file) return;

    uploadDocument.mutate(
      {
        file,
        requirement_id: selectedReqId,
        entity_type: entityType,
        entity_id: entityId,
        document_number: documentNumber,
        expiry_date: expiryDate || undefined,
      },
      { onSuccess: () => setUploadModalOpen(false) } // on error the modal stays open and shows the message
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Compliance Documents</h3>
        <span className="text-sm text-silver-500">
          {records.filter(r => r.status === 'VALID').length} of {requirements.length} Valid
        </span>
      </div>

      <div className="grid gap-3">
        {requirements.length === 0 ? (
          <div className="text-center p-6 border border-dashed border-silver-800 rounded-xl text-silver-500 text-sm">
            No compliance requirements configured for this entity type.
          </div>
        ) : (
          requirements.map((req) => {
            const record = recordMap.get(req.id);
            const status = record?.status || 'MISSING';
            
            return (
              <div key={req.id} className="flex items-center justify-between rounded-xl border border-silver-200 dark:border-silver-900 bg-white dark:bg-brand-near/50 p-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    status === 'VALID' ? 'bg-silver-900/60 text-silver-300' :
                    status === 'EXPIRING_SOON' ? 'bg-silver-900/30 text-silver-500' :
                    status === 'VERIFICATION_REQUIRED' ? 'bg-blue-500/10 text-blue-500' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    {status === 'VALID' ? <ShieldCheck className="h-5 w-5" /> :
                     status === 'EXPIRING_SOON' ? <Clock className="h-5 w-5" /> :
                     status === 'VERIFICATION_REQUIRED' ? <FileText className="h-5 w-5" /> :
                     <FileWarning className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{req.name}</p>
                      {req.blocking && (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">
                          BLOCKING
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-silver-500">{req.category}</p>
                    
                    {record && record.document_number && (
                      <p className="mt-1 font-mono text-xs text-silver-500">
                        ID: {record.document_number} 
                        {record.expiry_date && ` • Exp: ${formatDate(record.expiry_date)}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${
                    status === 'VALID' ? 'text-silver-300' :
                    status === 'EXPIRING_SOON' ? 'text-silver-500' :
                    status === 'VERIFICATION_REQUIRED' ? 'text-blue-500' :
                    'text-red-500'
                  }`}>
                    {status.replace('_', ' ')}
                  </span>
                  
                  {record && record.document_url && (
                    <a
                      href={record.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 inline-flex items-center gap-1 rounded-lg bg-silver-100 dark:bg-silver-900 px-3 py-1.5 text-xs font-medium hover:bg-silver-200 dark:hover:bg-silver-800 transition"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View
                    </a>
                  )}

                  {(status === 'MISSING' || status === 'EXPIRED' || status === 'REJECTED' || status === 'EXPIRING_SOON') && (
                    <button
                      onClick={() => handleUploadClick(req.id)}
                      className="ml-2 inline-flex items-center gap-1 rounded-lg bg-silver-100 dark:bg-silver-900 px-3 py-1.5 text-xs font-medium hover:bg-silver-200 dark:hover:bg-silver-800 transition"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload
                    </button>
                  )}

                  {status === 'VERIFICATION_REQUIRED' && record && (
                    <div className="ml-2 flex items-center gap-1">
                      <button
                        onClick={() => verifyRecord.mutateAsync({ id: record.id, method: 'MANUAL', comments: 'Looks good' })}
                        className="inline-flex items-center gap-1 rounded-lg bg-silver-900/60 px-3 py-1.5 text-xs font-medium text-silver-300 hover:bg-silver-700/20 transition"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => updateRecord.mutateAsync({ ...record, status: 'REJECTED', rejection_reason: 'Invalid document' })}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-silver-900 bg-brand-black p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-4">Upload Compliance Document</h2>
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-silver-500">Document Number / ID</label>
                <input
                  type="text"
                  required
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-silver-900 bg-brand-near px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  placeholder="e.g. DL-142023001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-silver-500">Expiry Date</label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-silver-900 bg-brand-near px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                />
              </div>

              <label className="block cursor-pointer rounded-xl border border-dashed border-silver-800 p-6 text-center">
                <Upload className="mx-auto h-8 w-8 text-silver-500 mb-2" />
                <p className="text-sm text-silver-500">{file ? file.name : 'Choose a PDF or image (max 10 MB)'}</p>
                <input
                  type="file"
                  required
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>

              {uploadDocument.isError && (
                <p className="text-sm text-red-500">{uploadDocument.error.message}</p>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-silver-900">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-silver-500 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadDocument.isPending || !file}
                  className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-600 transition disabled:opacity-50"
                >
                  {uploadDocument.isPending ? 'Uploading...' : 'Submit Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Waiver Modal */}
      {waivingRecordId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-silver-900 bg-brand-black shadow-xl overflow-hidden p-6">
            <h2 className="text-xl font-bold text-white mb-4">Waive Requirement</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-silver-500 mb-1">Reason for Waiver</label>
                <input
                  type="text"
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  className="w-full rounded-lg border border-silver-900 bg-brand-near px-3 py-2 text-white"
                  placeholder="e.g. RTO delay, official receipt held"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-silver-500 mb-1">Valid Until</label>
                <input
                  type="date"
                  value={waiverDate}
                  onChange={(e) => setWaiverDate(e.target.value)}
                  className="w-full rounded-lg border border-silver-900 bg-brand-near px-3 py-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setWaivingRecordId(null)}
                  className="rounded-lg px-4 py-2 text-sm text-silver-500 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!waiverReason || !waiverDate) return;
                    await waiveRecord.mutateAsync({ id: waivingRecordId, reason: waiverReason, valid_until: waiverDate });
                    setWaivingRecordId(null);
                    setWaiverReason('');
                    setWaiverDate('');
                  }}
                  disabled={!waiverReason || !waiverDate || waiveRecord.isPending}
                  className="rounded-lg bg-silver-700 px-4 py-2 text-sm font-bold text-white hover:bg-silver-700 disabled:opacity-50"
                >
                  {waiveRecord.isPending ? 'Saving...' : 'Grant Waiver'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
