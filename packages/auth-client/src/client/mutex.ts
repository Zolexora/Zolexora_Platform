import { SESSION_EXPIRED_EVENT } from "../constants.js";

/**
 * Single-Flight Refresh Mutex.
 * Deduplicates concurrent 401 refresh calls and shares the refresh promise.
 */
export class SingleFlightRefreshMutex {
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;
  private lastRefreshedToken: string | null = null;
  private lastRefreshTimestamp = 0;

  constructor(
    private getToken: (forceRefresh?: boolean) => Promise<string | null>,
    private onSessionExpired?: () => void
  ) {}

  /**
   * Executes or shares a single-flight token refresh.
   * @param usedToken The token that resulted in the 401 response.
   */
  public async refreshToken(usedToken?: string | null): Promise<string | null> {
    // 1. Race optimization: If another concurrent request already refreshed the token
    // while this request was inflight, reuse that fresh token immediately!
    if (
      usedToken &&
      this.lastRefreshedToken &&
      this.lastRefreshedToken !== usedToken &&
      Date.now() - this.lastRefreshTimestamp < 60000
    ) {
      return this.lastRefreshedToken;
    }

    // 2. Single-flight deduplication: Join pending promise if refresh is already in-flight
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    // 3. Initiate single-flight refresh
    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const freshToken = await this.getToken(true);
        if (!freshToken) {
          this.triggerSessionExpired("EMPTY_REFRESHED_TOKEN");
          return null;
        }
        this.lastRefreshedToken = freshToken;
        this.lastRefreshTimestamp = Date.now();
        return freshToken;
      } catch (error) {
        this.triggerSessionExpired("REFRESH_PROMISE_REJECTED", error);
        return null;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Notifies session expiration callbacks and dispatches browser custom event.
   */
  public triggerSessionExpired(reason?: string, details?: any): void {
    if (this.onSessionExpired) {
      try {
        this.onSessionExpired();
      } catch (err) {
        console.error("[zolexoraFetch] onSessionExpired callback threw:", err);
      }
    }

    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      try {
        window.dispatchEvent(
          new CustomEvent(SESSION_EXPIRED_EVENT, {
            detail: {
              timestamp: Date.now(),
              reason: reason || "AUTHENTICATION_FAILED",
              details,
            },
          })
        );
      } catch (err) {
        console.error("[zolexoraFetch] Failed to dispatch session-expired event:", err);
      }
    }
  }

  public reset(): void {
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.lastRefreshedToken = null;
    this.lastRefreshTimestamp = 0;
  }
}
