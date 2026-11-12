import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { IAuthRepository, OtpPurpose } from "../repositories/types.js";
import { AppError } from "../plugins/error-handler.js";

export interface OtpConfig {
  secret: string;
  ttlSeconds: number;
  maxAttempts: number;
}

const invalid = () =>
  new AppError({ statusCode: 400, code: "AUTH_OTP_INVALID_OR_EXPIRED", message: "Invalid or expired OTP code." });

/** Random 6-digit codes, stored only as an HMAC, with expiry and an attempt limit. */
export class OtpService {
  constructor(private readonly repo: IAuthRepository, private readonly config: OtpConfig) {}

  public get ttlSeconds() {
    return this.config.ttlSeconds;
  }

  private hash(email: string, purpose: OtpPurpose, code: string): string {
    return createHmac("sha256", this.config.secret).update(`${purpose}:${email}:${code}`).digest("hex");
  }

  /** Stores a fresh code (replacing any previous one) and returns it for delivery. */
  public async issue(email: string, purpose: OtpPurpose, payload: Record<string, any> = {}): Promise<string> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.repo.saveOtp({
      email,
      purpose,
      code_hash: this.hash(email, purpose, code),
      payload,
      attempts: 0,
      expires_at: Date.now() + this.config.ttlSeconds * 1000,
    });
    return code;
  }

  /** Verifies and consumes a code, returning its payload. */
  public async consume(email: string, purpose: OtpPurpose, code: unknown): Promise<Record<string, any>> {
    const otp = await this.repo.getOtp(email, purpose);
    if (!otp) throw invalid();
    if (otp.expires_at <= Date.now() || otp.attempts >= this.config.maxAttempts) {
      await this.repo.deleteOtp(email, purpose);
      throw invalid();
    }
    const expected = Buffer.from(otp.code_hash, "hex");
    const actual = Buffer.from(this.hash(email, purpose, typeof code === "string" ? code.trim() : ""), "hex");
    if (!timingSafeEqual(expected, actual)) {
      await this.repo.incrementOtpAttempts(email, purpose);
      throw invalid();
    }
    await this.repo.deleteOtp(email, purpose);
    return otp.payload;
  }
}
