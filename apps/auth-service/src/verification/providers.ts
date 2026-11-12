// Verification provider clients (ADR 0004 §4.4). Each returns plain facts; the service decides the status.
// Cashfree and ClearTax request/response fields follow their published API references.
// Digio: request creation follows its docs; the result fetch must be confirmed in the Digio sandbox.
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import { configure, Uint8ArrayReader, TextWriter, ZipReader } from "@zip.js/zip.js";

configure({ useWebWorkers: false });

/** The provider could not answer (network, 5xx, bad config): try the next one in the list. */
export class ProviderUnavailable extends Error {}
/** The provider rejected the input itself (bad format, unknown id). */
export class ProviderRejected extends Error {}

const TIMEOUT_MS = 15_000;

async function call(url: string, init: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err: any) {
    throw new ProviderUnavailable(`unreachable: ${err?.message ?? err}`);
  }
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  if (res.status >= 500 || res.status === 401 || res.status === 403 || res.status === 429) {
    throw new ProviderUnavailable(`status ${res.status}`);
  }
  if (!res.ok) throw new ProviderRejected(body?.message ?? `status ${res.status}`);
  return body;
}

// ── Cashfree Verification API ──────────────────────────────────────────────
export class CashfreeClient {
  constructor(private readonly cfg: { baseUrl: string; clientId: string; clientSecret: string }) {}

  private req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
    return call(`${this.cfg.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-client-id": this.cfg.clientId,
        "x-client-secret": this.cfg.clientSecret,
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async pan(pan: string, name?: string) {
    const r = await this.req("POST", "/pan", { pan, name });
    return { valid: r?.valid === true, name: r?.registered_name ?? null, nameMatch: r?.name_match_result ?? null, ref: r?.reference_id ?? null };
  }

  async gstin(gstin: string, businessName?: string) {
    const r = await this.req("POST", "/gstin", { GSTIN: gstin, business_name: businessName });
    return {
      valid: r?.valid === true,
      active: String(r?.gst_in_status ?? "").toLowerCase() === "active",
      legalName: r?.legal_name_of_business ?? null,
      tradeName: r?.trade_name_of_business ?? null,
      activities: Array.isArray(r?.nature_of_business_activities) ? r.nature_of_business_activities.map(String) : [],
      ref: r?.reference_id ?? null,
    };
  }

  /** Penny drop: Cashfree chooses IMPS or NPCI lookup itself. */
  async bankAccount(account: string, ifsc: string, name?: string) {
    const r = await this.req("POST", "/bank-account/sync", { bank_account: account, ifsc, name });
    return { valid: r?.account_status === "VALID", name: r?.name_at_bank ?? null, ref: String(r?.reference_id ?? "") || null, code: r?.account_status_code ?? null };
  }

  async upi(verificationId: string, vpa: string, name?: string) {
    const r = await this.req("POST", "/upi/penny-drop", {
      verification_id: verificationId,
      vpa,
      name,
      user_consent: { obtained: true, type: "EXPLICIT", timestamp: new Date().toISOString(), purpose: "Verify payout UPI ID" },
    }, { "x-api-version": "2024-12-01" });
    return { valid: r?.status === "VALID", name: r?.name_at_bank ?? null, ref: verificationId };
  }

  /** Reverse penny drop: the user pays ₹1 by UPI (refunded); returns the pay link. */
  async reversePennyDrop(verificationId: string, name?: string) {
    const r = await this.req("POST", "/reverse-penny-drop", { verification_id: verificationId, name });
    return { ref: String(r?.ref_id ?? ""), upiLink: r?.upi_link ?? null, qrCode: r?.qr_code ?? null, validUpto: r?.valid_upto ?? null };
  }

  async reversePennyDropStatus(verificationId: string, ref: string) {
    const r = await this.req("GET", `/remitter/status?verification_id=${encodeURIComponent(verificationId)}&ref_id=${encodeURIComponent(ref)}`);
    return {
      status: String(r?.status ?? "").toUpperCase() as "SUCCESS" | "FAILURE" | "EXPIRED" | "PENDING" | string,
      account: r?.bank_account ?? null,
      ifsc: r?.ifsc ?? null,
      upi: r?.upi ?? null,
      name: r?.name_at_bank ?? null,
    };
  }
}

// ── ClearTax GST: taxpayer profile ─────────────────────────────────────────
export class ClearTaxClient {
  constructor(private readonly cfg: { baseUrl: string; authToken: string; taxableEntityId: string }) {}

  async gstin(gstin: string) {
    const r = await call(
      `${this.cfg.baseUrl.replace(/\/$/, "")}/gst/api/v0.2/taxable_entities/${encodeURIComponent(this.cfg.taxableEntityId)}/gstin_verification?gstin=${encodeURIComponent(gstin)}`,
      { method: "GET", headers: { "X-Cleartax-Auth-Token": this.cfg.authToken } },
    );
    return {
      valid: r?.gstin === gstin,
      active: String(r?.sts ?? "").toLowerCase() === "active",
      legalName: r?.lgnm ?? null,
      tradeName: r?.tradeNam ?? null,
      activities: Array.isArray(r?.nba) ? r.nba.map(String) : [],
      ref: null as string | null,
    };
  }
}

// ── Digio (DigiStudio templates; the user completes the flow in Digio's SDK) ──
export class DigioClient {
  constructor(private readonly cfg: { baseUrl: string; clientId: string; clientSecret: string }) {}

  private headers() {
    return {
      "content-type": "application/json",
      authorization: `Basic ${Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString("base64")}`,
    };
  }

  async start(template: string, customerIdentifier: string, customerName: string) {
    const r = await call(`${this.cfg.baseUrl.replace(/\/$/, "")}/client/kyc/v2/request/with_template`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        customer_identifier: customerIdentifier,
        customer_name: customerName,
        template_name: template,
        notify_customer: false,
        generate_access_token: true,
      }),
    });
    if (!r?.id) throw new ProviderUnavailable("no request id");
    return { ref: String(r.id), accessToken: r?.access_token?.id ?? null, customerIdentifier };
  }

  /** Result of a finished request. Field names to confirm in the Digio sandbox; anything unclear goes to admin review. */
  async result(ref: string) {
    const r = await call(`${this.cfg.baseUrl.replace(/\/$/, "")}/client/kyc/v2/${encodeURIComponent(ref)}/response`, {
      method: "POST",
      headers: this.headers(),
      body: "{}",
    });
    const status = String(r?.status ?? "").toLowerCase();
    const details = (Array.isArray(r?.actions) ? r.actions : []).map((a: any) => a?.details ?? {});
    const find = (...keys: string[]) => {
      for (const d of details) for (const k of keys) {
        const v = k.split(".").reduce((o: any, p) => o?.[p], d);
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return null;
    };
    return {
      done: ["approved", "completed"].includes(status),
      failed: ["rejected", "failed", "expired"].includes(status),
      name: find("aadhaar.name", "pan.name", "name", "beneficiary_name", "name_at_bank"),
      account: find("account_number", "bank_account"),
      ifsc: find("ifsc"),
      status,
    };
  }
}

// ── Aadhaar Offline e-KYC (₹0) ─────────────────────────────────────────────
export interface AadhaarFacts {
  name: string;
  birthYear: string | null;
  last4: string;
  generatedAt: Date | null;
}

/**
 * Opens the UIDAI Offline e-KYC ZIP with the share code and checks UIDAI's signature.
 * Data is read only from the signed part of the XML (no signature-wrapping tricks).
 */
export async function readAadhaarOfflineZip(zip: Buffer, shareCode: string, uidaiCertPem: string): Promise<AadhaarFacts> {
  let xml: string;
  try {
    const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(zip)));
    const entries = await reader.getEntries();
    const entry = entries.find((e) => !e.directory && /\.xml$/i.test(e.filename));
    if (!entry || entry.directory) throw new Error("no xml");
    xml = await entry.getData(new TextWriter(), { password: shareCode });
    await reader.close();
  } catch {
    throw new ProviderRejected("Could not open the file. Check the ZIP and the share code.");
  }
  if (xml.length > 2_000_000 || /<!DOCTYPE/i.test(xml)) throw new ProviderRejected("Not a UIDAI Offline e-KYC file.");

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const sigNode = doc.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature")[0];
  if (!sigNode) throw new ProviderRejected("The file is not signed by UIDAI.");
  const sig = new SignedXml({ publicCert: uidaiCertPem, getCertFromKeyInfo: () => null });
  sig.loadSignature(sigNode as any);
  let ok = false;
  try {
    ok = sig.checkSignature(xml);
  } catch {
    ok = false;
  }
  const signed = ok ? sig.getSignedReferences() : [];
  if (!ok || !signed.length) throw new ProviderRejected("UIDAI's signature on this file is not valid.");

  const signedDoc = new DOMParser().parseFromString(signed[0], "text/xml");
  const root = signedDoc.documentElement;
  const poi = signedDoc.getElementsByTagName("Poi")[0];
  const name = poi?.getAttribute("name")?.trim();
  const ref = root?.getAttribute("referenceId") ?? "";
  if (!root || root.nodeName !== "OfflinePaperlessKyc" || !name || !/^[0-9]{4}/.test(ref)) {
    throw new ProviderRejected("Not a UIDAI Offline e-KYC file.");
  }
  // referenceId = last 4 digits of Aadhaar + yyyyMMddHHmmssSSS
  const ts = ref.slice(4).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  const generatedAt = ts ? new Date(Date.UTC(+ts[1], +ts[2] - 1, +ts[3], +ts[4], +ts[5], +ts[6]) - 330 * 60_000) : null; // IST
  const dob = poi.getAttribute("dob") ?? "";
  return { name, birthYear: dob.match(/(\d{4})/)?.[1] ?? null, last4: ref.slice(0, 4), generatedAt };
}
