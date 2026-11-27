import { describe, it, expect, vi } from "vitest";
import { MailService } from "../src/services/mail.service.js";
import { AppError } from "../src/plugins/error-handler.js";

const cfg = { apiUrl: "https://mail.test/emails", apiKey: "test-key", from: "Zolexora <no-reply@zolexora.com>" };

describe("MailService", () => {
  it("sends email without logging on 2xx", async () => {
    const log = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "em_1" }), { status: 200 })));
    const mail = new MailService(cfg, log);

    await mail.sendOtp("user@example.com", "123456", "reset", 600);
    expect(log).not.toHaveBeenCalled();
  });

  it("logs Resend HTTP status and body on non-2xx and throws AUTH_EMAIL_DELIVERY_FAILED", async () => {
    const log = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"name":"validation_error","message":"Domain not verified"}', { status: 403 })));
    const mail = new MailService(cfg, log);

    await expect(mail.send("user@example.com", "Subject", "Body")).rejects.toMatchObject({
      statusCode: 502,
      code: "AUTH_EMAIL_DELIVERY_FAILED",
      message: "Could not send email.",
    });
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toContain("status=403");
    expect(log.mock.calls[0][0]).toContain("Domain not verified");
  });

  it("logs network errors and throws AUTH_EMAIL_DELIVERY_FAILED", async () => {
    const log = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network timeout"); }));
    const mail = new MailService(cfg, log);

    await expect(mail.send("user@example.com", "Subject", "Body")).rejects.toBeInstanceOf(AppError);
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toContain("network timeout");
  });
});
