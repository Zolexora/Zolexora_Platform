"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { useAuth } from "@zolexora/auth-client/react";
import { setActiveOrganizationId } from "@zolexora/marketplace-sign-in";
import { authApi, sellerOrgApi } from "@/lib/api";

/** Owners choose one of their seller organisations or create another (like TMS). */
export default function OrganisationsPage() {
  const router = useRouter();
  const { user: account, loading, signOut } = useAuth();
  const [orgs, setOrgs] = useState<any[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!account) { router.replace("/auth"); return; }
    (async () => {
      const me = await authApi.me();
      if (me.zolexora_org_id) { router.replace("/dashboard"); return; } // staff: their linked organisation
      const mine = await sellerOrgApi.listMy();
      if (!mine.length) { router.replace("/verification?new=1"); return; } // create your organisation
      setOrgs(mine);
    })().catch(() => router.replace("/auth"));
  }, [account, loading, router]);

  const open = (org: any) => {
    setActiveOrganizationId(org.id);
    router.push(org.status === "ACTIVE" ? "/dashboard" : "/verification");
  };

  if (!orgs) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-gold" /></div>;
  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
        <div className="text-center">
          <h1 className="font-display text-xl font-bold text-ink">Choose an organisation</h1>
          <p className="text-xs text-ink-muted mt-1">Seller organisations connected to your Zolexora account</p>
        </div>
        {orgs.map((org) => (
          <button key={org.id} type="button" onClick={() => open(org)}
            className="w-full flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-gold">
            <span>
              <span className="block text-sm font-semibold text-ink">{org.name}</span>
              <span className="block text-[11px] text-ink-muted">{org.status === "ACTIVE" ? "Active" : `Verification: ${org.verification_status}`}</span>
            </span>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        ))}
        <button type="button" onClick={() => router.push("/verification?new=1")}
          className="w-full h-11 rounded-xl border border-gray-200 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-50">
          <Plus size={16} /> Create another organisation
        </button>
        <button type="button" onClick={() => void signOut().then(() => { setActiveOrganizationId(null); router.replace("/auth"); })}
          className="w-full text-xs text-ink-muted underline">Sign out</button>
      </div>
    </main>
  );
}
