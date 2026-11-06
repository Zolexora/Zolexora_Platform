import { startRealService, type RealService } from "./real-service";

export interface ZolexoraFetchOptions extends RequestInit {
  organisationId?: string | null;
  zolexoraId?: string | null;
  skipAuth?: boolean;
}

/** One real auth service per test file; `resetState()` restarts it with fresh seed data. */
export class TestHarness {
  private static instance: TestHarness | null = null;
  public service!: RealService;
  public baseUrl = "";

  private constructor() {}

  public static async getInstance(): Promise<TestHarness> {
    if (!TestHarness.instance) {
      TestHarness.instance = new TestHarness();
      await TestHarness.instance.start();
    }
    return TestHarness.instance;
  }

  private async start() {
    this.service = await startRealService();
    this.baseUrl = this.service.url;
  }

  /** Authorization header with a real session token for `claims`. */
  public bearer(claims: Record<string, unknown>) {
    return { Authorization: `Bearer ${this.service.token(claims)}` };
  }

  /** The seeded consumer (consumer@clarityfi.app, ZX-8K9M-4P2W-7Y3X). */
  public userAuth() {
    return this.bearer({ uid: "usr_9981", zolexora_id: "ZX-8K9M-4P2W-7Y3X", email: "consumer@clarityfi.app" });
  }

  /** An admin of the seeded organisation ZX-ORG-4B8T-9M2K-7Y4X. */
  public orgAdminAuth() {
    return this.bearer({ uid: "emp_admin_1", zolexora_id: "ZX-4B8T-9M2K-7Y4X", org_id: "ZX-ORG-4B8T-9M2K-7Y4X", role: "admin", permissions: ["*"] });
  }

  /** A platform admin: may invite into any business (employees join by invite link only, ADR 0005). */
  public platformAdminAuth() {
    return this.bearer({ uid: "00000000-0000-4000-8000-000000000201", is_platform_admin: true, type: "platform_admin" });
  }

  /** Invites an employee by email into `orgId` and accepts the emailed link with `password`. */
  public async inviteEmployee(orgId: string, email: string, password: string, extra: Record<string, unknown> = {}) {
    const invite = await fetch(`${this.baseUrl}/api/v1/organizations/${orgId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.platformAdminAuth() },
      body: JSON.stringify({ kind: "employee", email, ...extra }),
    });
    if (invite.status !== 201) return invite;
    const token = this.service.lastMail(email)!.match(/token=([A-Za-z0-9_%-]+)/)![1];
    return fetch(`${this.baseUrl}/api/v1/invites/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, turnstile_token: "0.valid-e2e" }),
    });
  }

  public async resetState() {
    await this.service.stop();
    await this.start();
  }

  public async teardown() {
    await this.service?.stop();
    TestHarness.instance = null;
  }
}

/** The real `@zolexora/auth-client` fetch wrapper (source), used against the real service. */
export { createZolexoraFetch as createTestZolexoraFetch } from "../../../../packages/auth-client/src/client/index";
