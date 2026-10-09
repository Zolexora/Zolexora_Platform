"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, sellerOrgApi } from "@/lib/api";
import { useAuthStore } from "@/store";
import { CheckCircle, FileUp, Loader2, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

const inputClass = "w-full h-11 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gold focus:bg-white";

export default function BusinessVerificationPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [busy, setBusy] = useState(false);
  const [gstLoading, setGstLoading] = useState(false);
  const [gstError, setGstError] = useState("");
  const [gstDetails, setGstDetails] = useState<any>(null);
  const [status, setStatus] = useState<string>("");
  const [form, setForm] = useState({
    gstin: "", legalName: "", tradeName: "", entityType: "Proprietorship", pan: "",
    signatoryName: user?.name || "", mobile: "", email: user?.email || "", aadhaar: "",
    registeredLine1: "", registeredLine2: "", registeredPincode: "", registeredCity: "", registeredState: "",
    samePickup: true, pickupLine1: "", pickupLine2: "", pickupPincode: "", pickupCity: "", pickupState: "",
    accountHolder: "", accountNumber: "", confirmAccountNumber: "", ifsc: "", bankName: "", branch: "",
    terms: false, commission: false,
  });
  const [documents, setDocuments] = useState<Record<string, File | null>>({});

  useEffect(() => {
    sellerOrgApi.listMy().then((organizations: any[]) => {
      const current = organizations[0];
      if (current) setStatus(current.verification_status || current.status || "PENDING");
      if (organizations.some((org: any) => String(org.verification_status).toUpperCase() === "VERIFIED")) router.replace("/dashboard");
    }).catch(() => undefined);
  }, [router]);

  const update = (key: string, value: string | boolean) => setForm((previous) => ({ ...previous, [key]: value }));

  const lookupGstin = async () => {
    const gstin = form.gstin.trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      setGstError("Enter a valid 15-character GSTIN.");
      return;
    }
    setGstLoading(true); setGstError("");
    try {
      const result = await authApi.verifyGstin(gstin);
      if (result.status && String(result.status).toUpperCase() !== "ACTIVE") throw new Error(`GSTIN status is ${result.status}`);
      setGstDetails(result);
      const address = result.registered_address || {};
      setForm((previous) => ({ ...previous, gstin, legalName: result.legal_name || previous.legalName, tradeName: result.trade_name || previous.tradeName, entityType: result.entity_type || previous.entityType, registeredLine1: address.line1 || previous.registeredLine1, registeredLine2: address.line2 || previous.registeredLine2, registeredCity: address.city || previous.registeredCity, registeredState: address.state || previous.registeredState, registeredPincode: address.pincode ? String(address.pincode) : previous.registeredPincode }));
      toast.success("GSTIN verified and business details filled.");
    } catch (error: any) {
      setGstError(error?.response?.data?.detail || error?.message || "GSTIN verification failed");
    } finally { setGstLoading(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.legalName.trim() || !form.tradeName.trim() || !form.pan.trim() || !form.signatoryName.trim()) {
      toast.error("Complete the required business and signatory fields."); return;
    }
    if (form.accountNumber !== form.confirmAccountNumber) { toast.error("Bank account numbers do not match."); return; }
    if (!form.terms || !form.commission) { toast.error("Accept both seller agreements to continue."); return; }
    setBusy(true);
    try {
      const slug = (form.tradeName || form.legalName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
      await sellerOrgApi.create({
        name: form.legalName.trim(), slug: slug || `seller-${Date.now()}`,
        metadata: { ...form, documents: Object.fromEntries(Object.entries(documents).map(([key, file]) => [key, file?.name || null])) },
      });
      toast.success("Business verification submitted for review.");
      router.replace("/verification");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error?.message || "Unable to submit verification");
    } finally { setBusy(false); }
  };

  const documentField = (key: string, label: string, required = false) => (
    <label className="block rounded-xl border border-dashed border-gray-300 p-3 cursor-pointer hover:border-gold">
      <span className="flex items-center gap-2 text-xs font-semibold text-ink"><FileUp size={15} />{label}{required ? " *" : ""}</span>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" required={required} className="mt-2 block w-full text-xs" onChange={(event) => setDocuments((previous) => ({ ...previous, [key]: event.target.files?.[0] || null }))} />
    </label>
  );

  return (
    <main className="min-h-screen bg-surface px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-sidebar text-white rounded-3xl p-6 mb-6">
          <div className="flex items-center gap-3"><ShieldCheck className="text-gold" /><div><h1 className="font-display text-2xl font-bold">Business Verification</h1><p className="text-white/60 text-sm">Complete verification to access your seller dashboard.</p></div></div>
          {status && <p className="mt-4 text-xs text-gold uppercase font-bold tracking-wider">Current status: {status}</p>}
        </div>
        <form onSubmit={submit} className="space-y-6">
          <section className="bg-white rounded-2xl p-6 border border-gray-100"><h2 className="font-display text-lg font-bold mb-4">Business identity & GST</h2><div className="grid md:grid-cols-2 gap-4">
            <div className="flex gap-2"><input className={inputClass} required placeholder="GSTIN *" maxLength={15} value={form.gstin} onChange={(e) => update("gstin", e.target.value.toUpperCase())} onBlur={() => { if (form.gstin.length === 15) void lookupGstin(); }} /><button type="button" onClick={() => void lookupGstin()} disabled={gstLoading} className="h-11 px-4 rounded-xl bg-gold text-ink text-xs font-bold whitespace-nowrap disabled:opacity-60">{gstLoading ? "Checking…" : "Verify GSTIN"}</button></div>
            {gstError && <p className="md:col-span-2 text-xs text-red-600">{gstError}</p>}
            {gstDetails && <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-2 rounded-xl bg-green-50 border border-green-100 p-3 text-xs"><span><b>Status:</b> {gstDetails.status || "Unavailable"}</span><span><b>Taxpayer:</b> {gstDetails.taxpayer_type || "Unavailable"}</span><span><b>Registered:</b> {gstDetails.registration_date || "Unavailable"}</span><span><b>Compliance:</b> {gstDetails.compliance_score ?? "Not supplied"}</span></div>}
            <input className={inputClass} required placeholder="Legal business name *" value={form.legalName} onChange={(e) => update("legalName", e.target.value)} />
            <input className={inputClass} required placeholder="Trade / display name *" value={form.tradeName} onChange={(e) => update("tradeName", e.target.value)} />
            <select className={inputClass} value={form.entityType} onChange={(e) => update("entityType", e.target.value)}><option>Proprietorship</option><option>Partnership</option><option>Private Limited</option><option>Public Limited</option><option>LLP</option><option>HUF</option></select>
            <input className={inputClass} required placeholder="PAN *" maxLength={10} value={form.pan} onChange={(e) => update("pan", e.target.value.toUpperCase())} />
          </div></section>
          <section className="bg-white rounded-2xl p-6 border border-gray-100"><h2 className="font-display text-lg font-bold mb-4">Authorized signatory</h2><div className="grid md:grid-cols-2 gap-4">
            <input className={inputClass} required placeholder="Full name *" value={form.signatoryName} onChange={(e) => update("signatoryName", e.target.value)} /><input className={inputClass} required placeholder="Mobile number *" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} /><input suppressHydrationWarning className={inputClass} required type="email" placeholder="Email address *" value={form.email} onChange={(e) => update("email", e.target.value)} /><input className={inputClass} placeholder="Aadhaar number (optional)" maxLength={12} value={form.aadhaar} onChange={(e) => update("aadhaar", e.target.value)} />
          </div></section>
          <section className="bg-white rounded-2xl p-6 border border-gray-100"><h2 className="font-display text-lg font-bold mb-4">Registered & pickup address</h2><div className="grid md:grid-cols-2 gap-4"><input className={inputClass} required placeholder="Registered address line 1 *" value={form.registeredLine1} onChange={(e) => update("registeredLine1", e.target.value)} /><input className={inputClass} placeholder="Address line 2" value={form.registeredLine2} onChange={(e) => update("registeredLine2", e.target.value)} /><input className={inputClass} required placeholder="Pincode *" value={form.registeredPincode} onChange={(e) => update("registeredPincode", e.target.value)} /><input className={inputClass} required placeholder="City *" value={form.registeredCity} onChange={(e) => update("registeredCity", e.target.value)} /><input className={inputClass} required placeholder="State *" value={form.registeredState} onChange={(e) => update("registeredState", e.target.value)} /></div><label className="flex items-center gap-2 mt-4 text-sm"><input type="checkbox" checked={form.samePickup} onChange={(e) => update("samePickup", e.target.checked)} /> Pickup address same as registered address</label>{!form.samePickup && <div className="grid md:grid-cols-2 gap-4 mt-4"><input className={inputClass} required placeholder="Pickup address line 1" value={form.pickupLine1} onChange={(e) => update("pickupLine1", e.target.value)} /><input className={inputClass} placeholder="Pickup address line 2" value={form.pickupLine2} onChange={(e) => update("pickupLine2", e.target.value)} /><input className={inputClass} required placeholder="Pickup pincode" value={form.pickupPincode} onChange={(e) => update("pickupPincode", e.target.value)} /><input className={inputClass} required placeholder="Pickup city" value={form.pickupCity} onChange={(e) => update("pickupCity", e.target.value)} /><input className={inputClass} required placeholder="Pickup state" value={form.pickupState} onChange={(e) => update("pickupState", e.target.value)} /></div>}</section>
          <section className="bg-white rounded-2xl p-6 border border-gray-100"><h2 className="font-display text-lg font-bold mb-4">Bank account for payouts</h2><div className="grid md:grid-cols-2 gap-4"><input className={inputClass} required placeholder="Account holder name *" value={form.accountHolder} onChange={(e) => update("accountHolder", e.target.value)} /><input className={inputClass} required placeholder="Account number *" value={form.accountNumber} onChange={(e) => update("accountNumber", e.target.value)} /><input className={inputClass} required placeholder="Confirm account number *" value={form.confirmAccountNumber} onChange={(e) => update("confirmAccountNumber", e.target.value)} /><input className={inputClass} required placeholder="IFSC code *" value={form.ifsc} onChange={(e) => update("ifsc", e.target.value.toUpperCase())} /><input className={inputClass} placeholder="Bank name" value={form.bankName} onChange={(e) => update("bankName", e.target.value)} /><input className={inputClass} placeholder="Branch" value={form.branch} onChange={(e) => update("branch", e.target.value)} /></div></section>
          <section className="bg-white rounded-2xl p-6 border border-gray-100"><h2 className="font-display text-lg font-bold mb-4">Documents</h2><div className="grid md:grid-cols-2 gap-4">{documentField("gstCertificate", "GST certificate", true)}{documentField("cancelledCheque", "Cancelled cheque / passbook", true)}{documentField("digitalSignature", "Digital signature", true)}{documentField("fssai", "FSSAI license (if applicable)")}{documentField("trademark", "Trademark / brand authorization")}{documentField("udyam", "MSME / Udyam certificate")}</div><p className="text-xs text-gray-500 mt-3">Accepted formats: PDF, JPG, PNG. Maximum 5MB per file.</p></section>
          <section className="bg-white rounded-2xl p-6 border border-gray-100 space-y-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={form.terms} onChange={(e) => update("terms", e.target.checked)} /> I accept the Seller Agreement and Terms of Service.</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={form.commission} onChange={(e) => update("commission", e.target.checked)} /> I consent to the applicable platform commission rate.</label><button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-gold text-ink font-bold flex justify-center items-center gap-2 disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />} Submit for verification</button></section>
        </form>
      </div>
    </main>
  );
}
