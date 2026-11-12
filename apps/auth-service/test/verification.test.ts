// ADR 0004 §4: verification with providers, the rulebook, admin review, limits and re-verification.
import { randomUUID, generateKeyPairSync } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SignedXml } from "xml-crypto";
import { TextReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js";
import { buildTestApp } from "./helpers/fakes.js";
import { InMemoryAuthRepository } from "./helpers/in-memory-auth.repository.js";
import { PEOPLE, adminAuth, userAuth } from "./helpers/business.js";
import { UIDAI_TEST_KEYS } from "./helpers/test-env.js";
import { fakeProviders } from "./helpers/fake-network.js";
import { isValidGstin } from "../src/business/identifiers.js";

const COMPANY_PAN = "AABCZ1234F";
const COMPANY = "Meena Textiles Private Limited";
const gstinFor = (pan: string, state = "27") => {
  for (const c of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (isValidGstin(`${state}${pan}1Z${c}`)) return `${state}${pan}1Z${c}`;
  }
  throw new Error("no check digit");
};

/** A UIDAI Offline e-KYC ZIP signed with the test "UIDAI" key (or another key, to test forgery). */
async function aadhaarZip(o: { name?: string; shareCode?: string; hoursOld?: number; key?: string } = {}) {
  const at = new Date(Date.now() - (o.hoursOld ?? 1) * 3600_000 + 330 * 60_000); // IST digits
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  const ts = `${at.getUTCFullYear()}${p(at.getUTCMonth() + 1)}${p(at.getUTCDate())}${p(at.getUTCHours())}${p(at.getUTCMinutes())}${p(at.getUTCSeconds())}000`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><OfflinePaperlessKyc referenceId="6789${ts}"><UidData>` +
    `<Poi dob="15-08-1990" e="" gender="F" m="" name="${o.name ?? "Meena Kumari"}"/><Poa country="India" pc="400001" state="Maharashtra"/>` +
    `<Pht>AAAA</Pht></UidData></OfflinePaperlessKyc>`;
  const sig = new SignedXml({
    privateKey: o.key ?? UIDAI_TEST_KEYS.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
  });
  sig.addReference({
    xpath: "/*", isEmptyUri: true, digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/2001/10/xml-exc-c14n#"],
  });
  sig.computeSignature(xml);
  const zip = new ZipWriter(new Uint8ArrayWriter(), { password: o.shareCode ?? "1234", zipCrypto: true });
  await zip.add("offlineaadhaar20261106.xml", new TextReader(sig.getSignedXml()));
  return Buffer.from(await zip.close()).toString("base64");
}

describe("Verification", () => {
  let repo: InMemoryAuthRepository;
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let org: string;
  const owner = () => userAuth(PEOPLE.consumer);
  const inject = (method: string, url: string, headers: Record<string, string> = {}, payload?: unknown) =>
    app.inject({ method: method as any, url, headers, payload: payload as any });
  const v = (path = "") => `/api/v1/organizations/${org}/verification${path}`;

  beforeEach(async () => {
    repo = new InMemoryAuthRepository();
    app = await buildTestApp(repo);
    org = (await inject("POST", "/api/v1/organizations", owner(), { pan: COMPANY_PAN, legal_name: COMPANY, email: "accounts@meena.example" })).json().organization.zolexora_org_id;
  });
  afterEach(() => app.close());

  /** A KYC upload of `type` for business `orgId` (the upload route itself is covered by storage tests). */
  const doc = async (type: string, orgId = org) => {
    const id = randomUUID();
    await repo.saveKycDocument({ document_id: id, user_id: PEOPLE.consumer.zx, owner_id: PEOPLE.consumer.zx, org_id: orgId, document_type: type,
      storage_key: `kyc/${orgId}/${id}.pdf`, file_size: 1000, mime_type: "application/pdf", created_at: new Date().toISOString() });
    return id;
  };

  it("publishes which checks are on, the rulebook and the accepted documents", async () => {
    const c = (await inject("GET", "/api/v1/verification/config")).json();
    expect(c.checks.bank).toEqual({ enabled: true, methods: ["upi_vpa", "reverse_penny_drop", "penny_drop"] });
    expect(c.rulebook.company).toEqual(["pan", "registration", "authority", "bank"]);
    expect(c.rulebook.individual).toEqual(["pan", "bank"]);
    expect(c.documents.find((d: any) => d.key === "udyam").official_url).toBe("https://udyamregistration.gov.in");
  });

  describe("identity", () => {
    it("Aadhaar Offline e-KYC: checks UIDAI's signature and keeps only name, birth year and last 4", async () => {
      const res = await inject("POST", "/api/v1/me/verification/identity", owner(), { method: "aadhaar_offline", zip_base64: await aadhaarZip(), share_code: "1234" });
      expect(res.statusCode).toBe(200);
      expect(res.json().identity).toMatchObject({ status: "verified", registered_name: "Meena Kumari" });
      const row = (await repo.authDb.query("SELECT details, value_encrypted FROM zolexora_verifications WHERE check_type = 'identity'")).rows[0];
      expect(row.details).toEqual({ birth_year: "1990", aadhaar_last4: "6789", source: "uidai_offline_ekyc" });
      expect(JSON.stringify(row)).not.toContain("400001");
    });

    it("rejects a wrong share code, a forged signature and an old file", async () => {
      const send = async (zip: string, code = "1234") =>
        (await inject("POST", "/api/v1/me/verification/identity", owner(), { method: "aadhaar_offline", zip_base64: zip, share_code: code })).json().identity;
      expect((await send(await aadhaarZip(), "9999")).status).toBe("rejected");
      const forger = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
      expect((await send(await aadhaarZip({ key: forger }))).reason).toContain("signature");
      expect((await send(await aadhaarZip({ hoursOld: 24 * 5 }))).reason).toContain("fresh");
    });

    it("DigiLocker through Digio: start, finish in the SDK, then complete", async () => {
      const start = (await inject("POST", "/api/v1/me/verification/identity", owner(), { method: "digio" })).json().identity;
      expect(start.status).toBe("pending");
      expect(start.action).toMatchObject({ provider: "digio", request_id: "KID1", access_token: "GWT-test" });
      expect((await inject("POST", "/api/v1/me/verification/identity/complete", owner())).json().code).toBe("VERIFICATION_NOT_FINISHED");
      fakeProviders.digio.set("KID1", { status: "approved", actions: [{ details: { aadhaar: { name: "Meena Kumari" } } }] });
      const done = (await inject("POST", "/api/v1/me/verification/identity/complete", owner())).json().identity;
      expect(done).toMatchObject({ status: "verified", registered_name: "Meena Kumari" });
    });
  });

  describe("business checks", () => {
    it("GST by Cashfree, then the PAN for free from the verified GSTIN", async () => {
      const gstin = gstinFor(COMPANY_PAN);
      fakeProviders.gstins.set(gstin, { legal: "MEENA TEXTILES PVT. LTD.", nba: ["Wholesale Business", "Retail Business"] });
      expect((await inject("POST", v("/gst"), owner(), { gstin: gstinFor("AABCY1234F") })).json().code).toBe("VERIFICATION_GSTIN_PAN_MISMATCH");
      expect((await inject("POST", v("/gst"), owner(), { gstin: gstin.slice(0, 14) + (gstin[14] === "A" ? "B" : "A") })).json().code).toBe("VERIFICATION_BAD_GSTIN");

      const gst = (await inject("POST", v("/gst"), owner(), { gstin })).json().verification;
      expect(gst).toMatchObject({ status: "verified", provider: "cashfree", value_last4: gstin.slice(-4) });
      const summary = (await inject("GET", v(), owner())).json();
      expect(summary.checks.find((c: any) => c.check === "pan")).toMatchObject({ status: "verified", provider: "gstin" });
      expect(fakeProviders.calls).not.toContain("cashfree /pan");
      expect((await inject("GET", `/api/v1/organizations/${org}`, owner())).json().organization.official_activities).toEqual(["Wholesale Business", "Retail Business"]);
    });

    it("a name that doesn't match waits for an admin, who can approve it", async () => {
      fakeProviders.pans.set(COMPANY_PAN, "SOMEONE ELSE TRADERS");
      const pan = (await inject("POST", v("/pan"), owner())).json().verification;
      expect(pan.status).toBe("pending");
      expect(pan.reason).toContain("admin");

      const queue = (await inject("GET", "/api/v1/admin/verifications", adminAuth())).json().verifications;
      const item = queue.find((q: any) => q.zolexora_org_id === org && q.check_type === "pan");
      const detail = (await inject("GET", `/api/v1/admin/verifications/${item.id}`, adminAuth())).json();
      expect(detail.organization.pan).toBe(COMPANY_PAN); // admins see the full PAN
      expect(detail.attempts.map((a: any) => a.outcome)).toContain("name_mismatch");
      expect((await inject("GET", `/api/v1/admin/verifications/${item.id}`, owner())).statusCode).toBe(403);

      expect((await inject("POST", `/api/v1/admin/verifications/${item.id}/decision`, adminAuth(), { status: "rejected" })).statusCode).toBe(400);
      const ok = await inject("POST", `/api/v1/admin/verifications/${item.id}/decision`, adminAuth(), { status: "verified" });
      expect(ok.json().verification.status).toBe("verified");
    });

    it("an unavailable provider falls through to manual review with the e-PAN", async () => {
      fakeProviders.down.add("cashfree.test");
      expect((await inject("POST", v("/pan"), owner())).json().code).toBe("VERIFICATION_UNAVAILABLE");
      const pan = (await inject("POST", v("/pan"), owner(), { document_ids: [await doc("e_pan")] })).json().verification;
      expect(pan).toMatchObject({ status: "pending", provider: "manual" });
    });

    it("stops paid lookups after 5 a day", async () => {
      for (let i = 0; i < 5; i++) expect((await inject("POST", v("/pan"), owner(), { method: "cashfree" })).statusCode).toBe(200);
      const sixth = await inject("POST", v("/pan"), owner(), { method: "cashfree" });
      expect(sixth.statusCode).toBe(429);
      expect(sixth.json().code).toBe("VERIFICATION_DAILY_LIMIT");
    });

    it("registration follows the rulebook: a company needs its CIN and incorporation certificate", async () => {
      expect((await inject("POST", v("/registration"), owner(), { document_ids: [await doc("incorporation_certificate")] })).statusCode).toBe(400);
      const other = await doc("incorporation_certificate", "ZX-ORG-9Z8Y-7X6W-5V4U");
      expect((await inject("POST", v("/registration"), owner(), { cin: "U17110MH2015PTC123456", document_ids: [other] })).json().code).toBe("VERIFICATION_BAD_DOCUMENT");
      expect((await inject("POST", v("/registration"), owner(), { cin: "U17110MH2015PTC123456", document_ids: [await doc("udyam")] })).json().code).toBe("VERIFICATION_BAD_DOCUMENT");
      const ok = (await inject("POST", v("/registration"), owner(), { cin: "U17110MH2015PTC123456", document_ids: [await doc("incorporation_certificate")] })).json().verification;
      expect(ok).toMatchObject({ status: "pending", provider: "manual", value_last4: "3456" });
    });

    it("a proprietor needs any two different registration documents", async () => {
      const prop = (await inject("POST", "/api/v1/organizations", userAuth(PEOPLE.manager), { pan: "ABCPE1234F", legal_name: "Meena Store", has_business_registration: true })).json().organization.zolexora_org_id;
      const url = `/api/v1/organizations/${prop}/verification/registration`;
      const one = await inject("POST", url, userAuth(PEOPLE.manager), { document_ids: [await doc("udyam", prop), await doc("udyam", prop)] });
      expect(one.json().code).toBe("VERIFICATION_DOCUMENTS_REQUIRED");
      const two = await inject("POST", url, userAuth(PEOPLE.manager), { document_ids: [await doc("udyam", prop), await doc("fssai", prop)] });
      expect(two.json().verification.status).toBe("pending");
      // An individual has no registration check at all.
      const ind = (await inject("POST", "/api/v1/organizations", userAuth(PEOPLE.manager), { pan: "ABCPE1234F", legal_name: "Meena", has_business_registration: false })).json().organization.zolexora_org_id;
      expect((await inject("POST", `/api/v1/organizations/${ind}/verification/registration`, userAuth(PEOPLE.manager), {})).json().code).toBe("VERIFICATION_NOT_REQUIRED");
    });

    it("changing the business name sends verified checks back for review", async () => {
      fakeProviders.pans.set(COMPANY_PAN, COMPANY);
      expect((await inject("POST", v("/pan"), owner())).json().verification.status).toBe("verified");
      await inject("PATCH", `/api/v1/organizations/${org}`, owner(), { legal_name: "Meena Silks Private Limited" });
      const pan = (await inject("GET", v(), owner())).json().checks.find((c: any) => c.check === "pan");
      expect(pan).toMatchObject({ status: "pending" });
      expect(pan.reason).toContain("name changed");
    });
  });

  describe("payout accounts and bank checks", () => {
    const add = (payload: Record<string, unknown>) => inject("POST", `/api/v1/organizations/${org}/payout-accounts`, owner(), payload);
    const verifyAcc = (id: string, method?: string) => inject("POST", `/api/v1/organizations/${org}/payout-accounts/${id}/verify`, owner(), method ? { method } : {});

    it("penny drop and UPI: names at the bank must match the business", async () => {
      fakeProviders.accounts.set("50100012345678:HDFC0001234", "MEENA TEXTILES PRIVATE LIMITED");
      fakeProviders.vpas.set("meena@okhdfc", "Ramesh Gupta");
      const bank = (await add({ kind: "bank", holder_name: COMPANY, account_number: "5010 0012 345678", ifsc: "hdfc0001234" })).json().account;
      expect(bank).toMatchObject({ kind: "bank", last4: "5678", is_primary: true });
      expect(JSON.stringify(bank)).not.toContain("50100012345678");
      expect((await verifyAcc(bank.id, "penny_drop")).json().verification).toMatchObject({ status: "verified", method: "penny_drop" });

      const upi = (await add({ kind: "upi", holder_name: COMPANY, vpa: "meena@okhdfc" })).json().account;
      const r = (await verifyAcc(upi.id)).json().verification;
      expect(r).toMatchObject({ status: "pending", method: "upi_vpa", registered_name: "Ramesh Gupta" }); // mismatch → admin
    });

    it("reverse penny drop: pay ₹1 from the same account", async () => {
      const bank = (await add({ kind: "bank", holder_name: COMPANY, account_number: "50100012345678", ifsc: "HDFC0001234" })).json().account;
      const start = (await verifyAcc(bank.id, "reverse_penny_drop")).json().verification;
      expect(start.action.upi_link).toContain("upi://pay");
      const complete = () => inject("POST", `/api/v1/organizations/${org}/payout-accounts/${bank.id}/verify/complete`, owner());
      expect((await complete()).json().code).toBe("VERIFICATION_NOT_FINISHED");

      fakeProviders.remitter = { status: "SUCCESS", bank_account: "XXXXXXXXXX9999", ifsc: "HDFC0001234", name_at_bank: COMPANY };
      expect((await complete()).json().verification.status).toBe("rejected");

      await verifyAcc(bank.id, "reverse_penny_drop");
      fakeProviders.remitter = { status: "SUCCESS", bank_account: "XXXXXXXXXX5678", ifsc: "HDFC0001234", name_at_bank: "MEENA TEXTILES PVT LTD" };
      expect((await complete()).json().verification).toMatchObject({ status: "verified", registered_name: "MEENA TEXTILES PVT LTD" });
    });

    it("only payout managers add accounts; a delegated role needs a fresh MFA code", async () => {
      const orgUuid = (await repo.authDb.query("SELECT id FROM zolexora_organizations WHERE zolexora_org_id = $1", [org])).rows[0].id;
      const { addPerson } = await import("./helpers/business.js");
      await addPerson(repo, orgUuid, PEOPLE.manager, "admin");
      const r = await inject("POST", `/api/v1/organizations/${org}/payout-accounts`, userAuth(PEOPLE.manager), { kind: "upi", holder_name: COMPANY, vpa: "meena@okhdfc" });
      expect(r.statusCode).toBe(403);
    });

    it("/auth/me carries the verification summary", async () => {
      const s = (await inject("POST", "/api/v1/auth/org-session", owner(), { org_id: org })).json();
      const me = (await inject("GET", "/api/v1/auth/me", { authorization: `Bearer ${s.access_token}` })).json();
      expect(me.verification).toMatchObject({ pan: "not_submitted", gst: "not_submitted", bank: "not_submitted", identity: "not_submitted" });
    });
  });
});
