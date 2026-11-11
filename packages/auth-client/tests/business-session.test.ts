import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AuthServiceError,
  BUSINESS_SESSION_EXPIRED_EVENT,
  employeeSignIn,
  getBusinessAccessToken,
  loadBusinessSession,
  openBusinessSession,
  signOutBusiness,
} from "../src/business-session/index.js";

const AUTH = "https://auth.test/";
const sessionBody = (n: number, expires_in = 900) => ({
  success: true,
  access_token: `access_${n}`,
  refresh_token: `refresh_${n}`,
  expires_in,
  session_id: "sess_1",
  org: { zolexora_org_id: "ZX-ORG-1", name: "Acme", role: "owner" },
});
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("business-session", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("opens a session with the personal token and stores it", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(sessionBody(1)));
    const s = await openBusinessSession(AUTH, "personal", { orgId: "ZX-ORG-1", product: "zolexora-ims" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://auth.test/api/v1/auth/org-session");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer personal");
    expect(JSON.parse(init!.body as string)).toEqual({ org_id: "ZX-ORG-1", product: "zolexora-ims" });
    expect(loadBusinessSession()).toEqual(s);
    expect(await getBusinessAccessToken(AUTH)).toBe("access_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps auth-service errors to AuthServiceError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply({ success: false, code: "AUTH_MFA_REQUIRED", message: "Code needed", error: { code: "AUTH_MFA_REQUIRED" } }, 403),
    );
    const err = await openBusinessSession(AUTH, "p", { orgId: "o", product: "zolexora-ims" }).catch((e) => e);
    expect(err).toBeInstanceOf(AuthServiceError);
    expect(err).toMatchObject({ code: "AUTH_MFA_REQUIRED", status: 403 });
    expect(loadBusinessSession()).toBeNull();
  });

  it("refreshes a nearly expired token once for concurrent callers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply(sessionBody(1, 30)));
    await openBusinessSession(AUTH, "p", { orgId: "ZX-ORG-1", product: "zolexora-ims" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockClear().mockResolvedValue(reply(sessionBody(2)));
    const tokens = await Promise.all([getBusinessAccessToken(AUTH), getBusinessAccessToken(AUTH)]);
    expect(tokens).toEqual(["access_2", "access_2"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ refresh_token: "refresh_1" });
  });

  it("clears the session and fires the expired event when refresh is rejected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply(sessionBody(1, 30)));
    await openBusinessSession(AUTH, "p", { orgId: "ZX-ORG-1", product: "zolexora-ims" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ success: false, code: "AUTH_REFRESH_REUSED" }, 401));
    const onExpired = vi.fn();
    window.addEventListener(BUSINESS_SESSION_EXPIRED_EVENT, onExpired);
    expect(await getBusinessAccessToken(AUTH)).toBeNull();
    expect(onExpired).toHaveBeenCalledOnce();
    expect(loadBusinessSession()).toBeNull();
    window.removeEventListener(BUSINESS_SESSION_EXPIRED_EVENT, onExpired);
  });

  it("keeps the session when the auth service is down during refresh", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply(sessionBody(1, 30)));
    await openBusinessSession(AUTH, "p", { orgId: "ZX-ORG-1", product: "zolexora-ims" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ success: false, code: "UNAVAILABLE" }, 503));
    await expect(getBusinessAccessToken(AUTH)).rejects.toBeInstanceOf(AuthServiceError);
    expect(loadBusinessSession()?.refresh_token).toBe("refresh_1");
  });

  it("handles employee login branches", async () => {
    const businesses = [{ zolexora_org_id: "ZX-ORG-1", name: "Acme" }];
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(reply({ success: true, choose_business: true, login_ticket: "lt", businesses }))
      .mockResolvedValueOnce(reply({ success: true, mfa_required: true, mfa_ticket: "mt" }))
      .mockResolvedValueOnce(reply(sessionBody(3)));
    expect(await employeeSignIn(AUTH, { product: "zolexora-ims", identifier: "a@b.c", password: "x" })).toEqual({
      status: "choose_business",
      login_ticket: "lt",
      businesses,
    });
    expect(await employeeSignIn(AUTH, { product: "zolexora-ims", loginTicket: "lt", orgId: "ZX-ORG-1" })).toEqual({
      status: "mfa_required",
      mfa_ticket: "mt",
    });
    const done = await employeeSignIn(AUTH, { product: "zolexora-ims", identifier: "a@b.c", password: "x", orgId: "ZX-ORG-1" });
    expect(done.status).toBe("signed_in");
    expect(loadBusinessSession()?.access_token).toBe("access_3");
  });

  it("signs out locally even if the server call fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply(sessionBody(1)));
    await openBusinessSession(AUTH, "p", { orgId: "ZX-ORG-1", product: "zolexora-ims" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockClear().mockRejectedValue(new TypeError("offline"));
    await signOutBusiness(AUTH);
    expect(loadBusinessSession()).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe("https://auth.test/api/v1/auth/session/logout");
  });
});
