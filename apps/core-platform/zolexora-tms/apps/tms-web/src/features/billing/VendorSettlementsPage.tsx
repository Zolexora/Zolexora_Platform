import { PayablesPage } from './PayablesPage';

export function VendorSettlementsPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-silver-900/30 p-4 border border-silver-700/20 text-silver-500 text-sm">
        Viewing unified DCO & Vendor Settlements.
      </div>
      <PayablesPage />
    </div>
  );
}
