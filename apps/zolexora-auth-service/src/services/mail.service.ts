import { AppError } from "../plugins/error-handler.js";

export interface MailConfig {
  apiUrl: string;
  apiKey: string;
  from: string;
}

/** Sends transactional email through the Resend HTTP API. */
export class MailService {
  constructor(private readonly config: MailConfig) {}

  public async send(to: string, subject: string, text: string): Promise<void> {
    const res = await fetch(this.config.apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.config.from, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) {
      throw new AppError({ statusCode: 502, code: "AUTH_EMAIL_DELIVERY_FAILED", message: "Could not send email." });
    }
  }

  public sendOtp(to: string, otp: string, purpose: "signup" | "reset", ttlSeconds: number): Promise<void> {
    const minutes = Math.ceil(ttlSeconds / 60);
    const action = purpose === "signup" ? "verify your email" : "reset your password";
    return this.send(
      to,
      `Your Zolexora code: ${otp}`,
      `Use ${otp} to ${action}. The code expires in ${minutes} minutes. If you did not request it, ignore this email.`,
    );
  }
}
