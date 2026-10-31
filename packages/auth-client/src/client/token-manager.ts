/**
 * In-memory Token Manager for caching and lifecycle coordination.
 */
export class TokenManager {
  private token: string | null = null;
  private expiresAt: number | null = null;

  constructor(
    private fetchToken?: (forceRefresh?: boolean) => Promise<string | null>
  ) {}

  public setToken(token: string | null): void {
    this.token = token;
    if (token) {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            typeof atob !== "undefined"
              ? atob(parts[1]!)
              : Buffer.from(parts[1]!, "base64").toString("utf-8")
          );
          if (payload.exp) {
            this.expiresAt = payload.exp * 1000;
          }
        }
      } catch {
        this.expiresAt = null;
      }
    } else {
      this.expiresAt = null;
    }
  }

  public getToken(): string | null {
    if (this.isExpired()) {
      return null;
    }
    return this.token;
  }

  public isExpired(clockSkewSeconds = 10): boolean {
    if (!this.token || !this.expiresAt) return false;
    return Date.now() + clockSkewSeconds * 1000 >= this.expiresAt;
  }

  public async getOrRefreshToken(forceRefresh = false): Promise<string | null> {
    if (!forceRefresh && !this.isExpired() && this.token) {
      return this.token;
    }
    if (this.fetchToken) {
      const fresh = await this.fetchToken(forceRefresh || this.isExpired());
      this.setToken(fresh);
      return fresh;
    }
    return this.token;
  }

  public clear(): void {
    this.token = null;
    this.expiresAt = null;
  }
}
