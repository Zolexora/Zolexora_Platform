// The rulebook (ADR 0004 §4.2). Fixed in code; the accepted documents' names and links are editable in platform-admin.
import { BusinessKind, CIN_RE, LLPIN_RE, UDYAM_RE } from "../business/identifiers.js";

export type CheckType = "identity" | "pan" | "gst" | "registration" | "authority" | "bank";
export const ORG_CHECKS = ["pan", "gst", "registration", "authority", "bank"] as const;
export type Status = "not_required" | "not_submitted" | "pending" | "verified" | "rejected" | "needs_revision";

/** Checks a business of this kind needs. `gst` is checked only when the business gives a GSTIN. */
export function requiredChecks(kind: BusinessKind): CheckType[] {
  const out: CheckType[] = ["pan"];
  if (!["individual", "public_body"].includes(kind)) out.push("registration");
  if (!["individual", "proprietor"].includes(kind)) out.push("authority");
  out.push("bank");
  return out;
}

/** P-type businesses: the PAN and bank names must match the owner's verified identity. */
export const isPersonalKind = (kind: string | null) => kind === "individual" || kind === "proprietor";

export interface RegistrationRule {
  number?: { field: "cin" | "llpin" | "udyam"; re: RegExp; label: string; required: boolean };
  /** Document type keys accepted; `min` distinct types needed. */
  docs: string[];
  min: number;
}

export function registrationRule(kind: BusinessKind): RegistrationRule | null {
  switch (kind) {
    case "proprietor":
      return {
        number: { field: "udyam", re: UDYAM_RE, label: "Udyam number", required: false },
        docs: ["udyam", "reg_gst_certificate", "shop_establishment", "trade_licence", "fssai"],
        min: 2, // any two, RBI style
      };
    case "company":
      return { number: { field: "cin", re: CIN_RE, label: "CIN", required: true }, docs: ["incorporation_certificate"], min: 1 };
    case "llp":
      return { number: { field: "llpin", re: LLPIN_RE, label: "LLPIN", required: true }, docs: ["incorporation_certificate"], min: 1 };
    case "partnership": return { docs: ["partnership_deed"], min: 1 };
    case "huf": return { docs: ["huf_declaration"], min: 1 };
    case "trust": return { docs: ["trust_deed"], min: 1 };
    case "society": return { docs: ["society_certificate"], min: 1 };
    default: return null;
  }
}

/**
 * Authority: how the person shows they may act for the business.
 * `named_in_records`: director/designated partner on MCA, or partner/karta/trustee/office-bearer named in the registration document.
 * `authorisation_letter`: a signed letter (or board resolution for companies). Public bodies: letter + official email only.
 */
export function authorityRule(kind: BusinessKind) {
  const roles: Partial<Record<BusinessKind, string>> = {
    company: "director", llp: "designated partner", partnership: "partner", huf: "karta", trust: "trustee", society: "office-bearer",
  };
  return {
    namedRole: roles[kind] ?? null,
    letterDocs: kind === "company" ? ["board_resolution", "authorisation_letter"] : ["authorisation_letter"],
    officialEmail: kind === "public_body",
  };
}

export const OFFICIAL_EMAIL_RE = /^[^@\s]+@([a-z0-9-]+\.)*(gov\.in|nic\.in)$/i;
