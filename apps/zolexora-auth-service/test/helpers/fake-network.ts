import { createHash } from "node:crypto";
// Fake Cloudinary upload API and S3-compatible bucket for tests. Anything else goes to `passthrough`.
/** Objects stored by the fake S3 endpoint, keyed by URL path. */
export const fakeS3Objects = new Map<string, { contentType: string; size: number }>();

/** What the fake verification providers know. Reset before every test (see setup.ts). */
export const fakeProviders = {
  pans: new Map<string, string>(), // PAN → registered name
  gstins: new Map<string, { legal: string; trade?: string; active?: boolean; nba?: string[] }>(),
  accounts: new Map<string, string>(), // "<account>:<ifsc>" → name at bank
  vpas: new Map<string, string>(),
  /** Reverse penny drop: what Cashfree reports once the user has paid. */
  remitter: null as null | { status: string; bank_account?: string; ifsc?: string; upi?: string; name_at_bank?: string },
  digio: new Map<string, { status: string; actions?: unknown[] }>(),
  down: new Set<string>(), // hosts that answer 503
  calls: [] as string[],
};
export function resetFakeProviders() {
  for (const v of Object.values(fakeProviders)) if (v instanceof Map || v instanceof Set) v.clear();
  fakeProviders.remitter = null;
  fakeProviders.calls.length = 0;
}

async function fakeVerification(url: URL, init?: RequestInit): Promise<Response | null> {
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const json = (b: unknown, status = 200) => Response.json(b, { status });
  if (fakeProviders.down.has(url.host)) return new Response("down", { status: 503 });
  if (url.host === "cashfree.test") {
    const h = new Headers(init?.headers);
    if (h.get("x-client-id") !== "cf-client" || h.get("x-client-secret") !== "cf-secret") return json({ message: "auth" }, 401);
    const path = url.pathname.replace("/verification", "");
    fakeProviders.calls.push(`cashfree ${path}`);
    if (path === "/pan") {
      const n = fakeProviders.pans.get(body.pan);
      return json(n ? { valid: true, registered_name: n, pan: body.pan, reference_id: 1 } : { valid: false, pan: body.pan });
    }
    if (path === "/gstin") {
      const g = fakeProviders.gstins.get(body.GSTIN);
      return json(g ? { valid: true, GSTIN: body.GSTIN, legal_name_of_business: g.legal, trade_name_of_business: g.trade ?? "",
        gst_in_status: g.active === false ? "Cancelled" : "Active", nature_of_business_activities: g.nba ?? [] } : { valid: false, GSTIN: body.GSTIN });
    }
    if (path === "/bank-account/sync") {
      const n = fakeProviders.accounts.get(`${body.bank_account}:${body.ifsc}`);
      return json(n ? { account_status: "VALID", account_status_code: "ACCOUNT_IS_VALID", name_at_bank: n, reference_id: 7 }
        : { account_status: "INVALID", account_status_code: "INVALID_ACCOUNT_FAIL" });
    }
    if (path === "/upi/penny-drop") {
      if (!h.get("x-api-version") || body.user_consent?.obtained !== true) return json({ message: "consent" }, 400);
      const n = fakeProviders.vpas.get(body.vpa);
      return json(n ? { status: "VALID", vpa: body.vpa, name_at_bank: n } : { status: "INVALID", vpa: body.vpa });
    }
    if (path === "/reverse-penny-drop") {
      return json({ ref_id: 4242, verification_id: body.verification_id, upi_link: "upi://pay?pa=test@cf&am=1", qr_code: "data:image/png;base64,AA", valid_upto: "2026-11-06T10:10:00" });
    }
    if (path === "/remitter/status") return json(fakeProviders.remitter ?? { status: "PENDING" });
  }
  if (url.host === "digio.test") {
    fakeProviders.calls.push(`digio ${url.pathname}`);
    if (url.pathname === "/client/kyc/v2/request/with_template") {
      const id = `KID${fakeProviders.digio.size + 1}`;
      fakeProviders.digio.set(id, { status: "requested" });
      return json({ id, customer_identifier: body.customer_identifier, access_token: { id: "GWT-test" } });
    }
    const m = url.pathname.match(/^\/client\/kyc\/v2\/(KID\d+)\/response$/);
    if (m) return json({ id: m[1], ...(fakeProviders.digio.get(m[1]) ?? { status: "unknown" }) });
  }
  return null;
}

/** Passwords the fake Have I Been Pwned range API reports as leaked. */
export const PWNED_TEST_PASSWORDS = ["LeakedPassword123!"];

export function fakeFetch(passthrough?: typeof fetch) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://s3.test/")) {
      const req = input instanceof Request ? input : new Request(url, init);
      if (!req.headers.get("authorization")?.startsWith("AWS4-HMAC-SHA256"))
        return new Response("unsigned", { status: 403 });
      const path = new URL(url).pathname;
      if (req.method === "PUT") {
        const body = await req.arrayBuffer();
        fakeS3Objects.set(path, {
          contentType: req.headers.get("content-type") ?? "",
          size: body.byteLength,
        });
        return new Response(null, { status: 200 });
      }
      if (req.method === "DELETE") {
        fakeS3Objects.delete(path);
        return new Response(null, { status: 204 });
      }
    }
    if (url.startsWith("https://cashfree.test/") || url.startsWith("https://digio.test/")) {
      const r = await fakeVerification(new URL(url), init);
      if (r) return r;
    }
    if (url.startsWith("https://pwned.test/range/")) {
      const prefix = url.slice(-5);
      const lines = PWNED_TEST_PASSWORDS.map((p) => createHash("sha1").update(p).digest("hex").toUpperCase())
        .filter((h) => h.startsWith(prefix)).map((h) => `${h.slice(5)}:42`);
      return new Response([...lines, "0000000000000000000000000000000000A:0"].join("\r\n"));
    }
    if (url.startsWith("https://api.cloudinary.com/")) {
      const form = init?.body as FormData;
      const publicId = String(form.get("public_id"));
      const file = form.get("file") as Blob;
      const format = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
      return Response.json({
        secure_url: `https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto/${publicId}.${format}`,
        public_id: publicId,
        bytes: file.size,
        format,
        version: 1,
      });
    }
    if (passthrough) return passthrough(input, init);
    throw new Error(`Unexpected network call in tests: ${url}`);
  };
}
