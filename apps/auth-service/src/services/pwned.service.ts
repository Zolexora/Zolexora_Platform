import { createHash } from "node:crypto";

/**
 * Leaked-password check (Have I Been Pwned range API, k-anonymity: only the first 5 hex chars of the SHA-1 leave us).
 * Fails open: if the service is slow or down we log and allow, so sign-up never breaks because of it.
 */
export class PwnedPasswordService {
  constructor(private readonly rangeUrl: string, private readonly log: (msg: string) => void, private readonly timeoutMs = 2500) {}

  async isPwned(password: string): Promise<boolean> {
    const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
    try {
      const res = await fetch(`${this.rangeUrl.replace(/\/$/, "")}/${sha.slice(0, 5)}`, {
        headers: { "Add-Padding": "true" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const suffix = sha.slice(5);
      return (await res.text()).split("\n").some((line) => {
        const [s, n] = line.trim().split(":");
        return s === suffix && Number(n) > 0;
      });
    } catch (err: any) {
      this.log(`[pwned-passwords] check skipped: ${err?.message ?? err}`);
      return false;
    }
  }
}
