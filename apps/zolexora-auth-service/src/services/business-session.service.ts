import { CONSTANTS } from "../config/constants.js";
import { AppError } from "../plugins/error-handler.js";
import { computeAccess, scopeToProduct } from "../rbac/engine.js";
import { CatalogStore } from "../stores/catalog.store.js";
import { SecurityStore, SessionRow } from "../stores/security.store.js";
import { TeamStore } from "../stores/team.store.js";
import { CipherService } from "./cipher.service.js";
import { TokenService } from "./token.service.js";

const { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } = CONSTANTS.BUSINESS;

export const disabled = () =>
  new AppError({ statusCode: 403, code: "AUTH_ACCOUNT_DISABLED", message: "Your access to this business is not active." });
const badRefresh = (code: string, message: string) => new AppError({ statusCode: 401, code, message });

export interface ClientInfo {
  userAgent: string | null;
  ip: string | null;
}

/**
 * Acting for a business (ADR 0004 §3a, ADR 0005 §5–6): a 15-minute ES256 access token for one member,
 * one product, and a rotating refresh token. Permissions are recomputed on every refresh.
 */
export class BusinessSessionService {
  constructor(
    private readonly team: TeamStore,
    private readonly security: SecurityStore,
    private readonly catalog: CatalogStore,
    private readonly tokens: TokenService,
    private readonly cipher: CipherService,
  ) {}

  /** Current access of a member, from the database. */
  async access(memberId: string) {
    const loaded = await this.team.loadAccessInput(memberId, await this.catalog.liveKeys());
    return loaded ? { ...loaded, access: computeAccess(loaded.input) } : null;
  }

  async open(memberId: string, product: string | null, opts: ClientInfo & { mfa: boolean }) {
    const a = await this.access(memberId);
    if (!a || !a.input.memberActive || !a.input.orgActive) throw disabled();
    const refresh = CipherService.token();
    const session = await this.security.createSession({
      member_id: memberId,
      product,
      refresh_hash: this.cipher.hash(refresh),
      mfa_at: opts.mfa ? new Date() : null,
      user_agent: opts.userAgent,
      ip: opts.ip,
      expires_at: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    });
    return this.issue(a, session, refresh);
  }

  async refresh(refreshToken: unknown) {
    if (typeof refreshToken !== "string" || refreshToken.length < 20 || refreshToken.length > 200) {
      throw badRefresh("AUTH_REFRESH_INVALID", "Refresh token is invalid or expired.");
    }
    const next = CipherService.token();
    const r = await this.security.rotate(this.cipher.hash(refreshToken), this.cipher.hash(next));
    if (!r) throw badRefresh("AUTH_REFRESH_INVALID", "Refresh token is invalid or expired.");
    if ("reused" in r) {
      // An old token came back: someone kept a copy. End the whole session.
      await this.security.revokeSession(r.reused.id, "refresh_token_reused");
      throw badRefresh("AUTH_REFRESH_REUSED", "This session was ended because its refresh token was used twice.");
    }
    const a = await this.access(r.session.member_id);
    if (!a || !a.input.memberActive || !a.input.orgActive) {
      await this.security.revokeSession(r.session.id, "access_removed");
      throw disabled();
    }
    return this.issue(a, r.session, next);
  }

  private async issue(a: NonNullable<Awaited<ReturnType<BusinessSessionService["access"]>>>, session: SessionRow, refresh: string) {
    const who = (await this.team.getMemberIdentity(a.member.id))!;
    const permissions = scopeToProduct(a.access.permissions, session.product);
    const claims = {
      zolexora_id: who.zolexora_id,
      org_id: a.org.zolexora_org_id,
      org_role: a.access.orgRoleKey,
      role: a.access.orgRoleKey ?? "member",
      product: session.product ?? undefined,
      permissions,
      mfa: !!session.mfa_at,
      mfa_setup_required: a.access.mfaSetupRequired,
    };
    const access_token = this.tokens.signEs256({
      ...claims,
      uid: a.member.user_id ?? a.member.employee_id,
      type: "member",
      member_id: a.member.id,
      user_id: a.member.user_id ?? undefined,
      employee_id: a.member.employee_id ?? undefined,
      email: who.email ?? undefined,
      sid: session.id,
    }, ACCESS_TTL_SECONDS);
    return {
      access_token,
      token_type: "Bearer" as const,
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: refresh,
      session_id: session.id,
      claims,
      member: { id: a.member.id, kind: a.member.user_id ? "person" : "employee", zolexora_id: who.zolexora_id, email: who.email, phone_number: who.phone_number },
      org: { zolexora_org_id: a.org.zolexora_org_id, name: a.org.name, role: a.access.orgRoleKey },
    };
  }
}
