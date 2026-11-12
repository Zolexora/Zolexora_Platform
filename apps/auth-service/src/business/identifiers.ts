// Free automatic checks (ADR 0004 §4.4): formats, the PAN holder letter and the GSTIN check digit.

export type BusinessKind =
  | "individual" | "proprietor" | "company" | "llp" | "partnership" | "huf" | "trust" | "society" | "public_body";

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
export const LLPIN_RE = /^[A-Z]{3}-[0-9]{4}$/;
export const UDYAM_RE = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_RE = /^[0-9]{9,18}$/;
export const VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export const normalizeId = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, "").toUpperCase() : "");

/** PAN 4th letter → legal type. P and F need one follow-up answer (ADR 0004 §2). */
export function businessKindFromPan(
  pan: string,
  answers: { has_business_registration?: boolean; has_llpin?: boolean },
): BusinessKind | null {
  if (!PAN_RE.test(pan)) return null;
  switch (pan[3]) {
    case "P": return answers.has_business_registration ? "proprietor" : "individual";
    case "C": return "company";
    case "F": return answers.has_llpin ? "llp" : "partnership";
    case "E": return "llp";
    case "H": return "huf";
    case "T": return "trust";
    case "A": case "B": return "society";
    case "G": case "L": case "J": return "public_body";
    default: return null;
  }
}

const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** GSTIN check digit (mod-36 over the first 14 characters). */
export function isValidGstin(gstin: string): boolean {
  if (!GSTIN_RE.test(gstin)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GST_CHARS.indexOf(gstin[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return GST_CHARS[(36 - (sum % 36)) % 36] === gstin[14];
}

export const panOfGstin = (gstin: string) => gstin.slice(2, 12);

// Name matching: case, punctuation and common legal suffixes don't matter.
const SUFFIXES: [RegExp, string][] = [
  [/\bprivate\b/g, "pvt"], [/\blimited\b/g, "ltd"], [/\bcompany\b/g, "co"], [/\bcorporation\b/g, "corp"],
  [/\b(m\/s|ms|the|shri|smt|sri|mr|mrs|dr)\b/g, ""], [/&/g, " and "],
];
export function normalizeName(name: string): string {
  let n = name.toLowerCase().replace(/m\/s\.?/g, " ");
  for (const [re, to] of SUFFIXES) n = n.replace(re, to);
  return n.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** True when `found` equals one of the expected names after normalisation. Anything else goes to admin review. */
export function namesMatch(found: string | null | undefined, expected: (string | null | undefined)[]): boolean {
  if (!found) return false;
  const f = normalizeName(found);
  return expected.some((e) => !!e && normalizeName(e) === f);
}
