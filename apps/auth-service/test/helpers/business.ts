// Real business actors for tests: people with Track 1 tokens who are members of a seeded business.
import { InMemoryAuthRepository, SEED } from "./in-memory-auth.repository.js";
import { testTokens } from "./fakes.js";

export const PEOPLE = {
  consumer: { id: SEED.ids.consumer, zx: SEED.consumerZxId, email: "consumer@clarityfi.app" },
  manager: { id: SEED.ids.logisticsManager, zx: "ZX-9K3M-5P2W-2Y7X", email: "logistics.manager@globalfreight.com" },
};
type Person = (typeof PEOPLE)[keyof typeof PEOPLE];

export const userAuth = (p: Person) => ({ authorization: `Bearer ${testTokens().mintUserCustomToken(p.id, p.zx, p.email)}` });
export const adminAuth = () => ({ authorization: `Bearer ${testTokens().signJwt({ uid: SEED.ids.admin, is_platform_admin: true, type: "platform_admin" })}` });
/** A legacy employee token for the seeded dispatcher (a manager of the default business). */
export const dispatcherAuth = () => ({
  authorization: `Bearer ${testTokens().mintEmployeeCustomToken(SEED.ids.dispatcher, { zolexora_id: SEED.dispatcherZxId, org_id: SEED.defaultOrg, role: "manager", permissions: [] }, "dispatcher@zolexora.com")}`,
});

/** Adds a person to a seeded business with a built-in business role; returns the member id. */
export async function addPerson(repo: InMemoryAuthRepository, orgUuid: string, p: Person, role: "owner" | "admin" | "manager" | "member") {
  const m = await repo.authDb.query<{ id: string }>(
    "INSERT INTO zolexora_org_members (organization_id, user_id) VALUES ($1, $2) RETURNING id", [orgUuid, p.id],
  );
  await repo.authDb.query(
    `INSERT INTO zolexora_member_roles (member_id, scope, role_id)
     SELECT $1, 'org', id FROM zolexora_roles WHERE organization_id = $2 AND scope = 'org' AND key = $3`,
    [m.rows[0].id, orgUuid, role],
  );
  return m.rows[0].id;
}

export const memberIdOf = async (repo: InMemoryAuthRepository, employeeId: string) =>
  (await repo.authDb.query<{ id: string }>("SELECT id FROM zolexora_org_members WHERE employee_id = $1", [employeeId])).rows[0].id;
