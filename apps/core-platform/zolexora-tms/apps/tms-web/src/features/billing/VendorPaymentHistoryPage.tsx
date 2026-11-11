import { PayablesPage } from './PayablesPage';

export function VendorPaymentHistoryPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-navy-800/40 p-4 border border-navy-600/20 text-silver-400 text-sm">
        Viewing unified Vendor Payments & Settlements.
      </div>
      <PayablesPage />
    </div>
  );
}
