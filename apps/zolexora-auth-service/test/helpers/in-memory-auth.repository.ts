// TEST ONLY. Never imported by src/.
// The production repository on PGlite: real PostgreSQL (WASM) in memory, loaded with the real schema files,
// so tests run the same SQL as production. The name is kept for existing imports.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PostgresAuthRepository } from "../../src/repositories/postgres-auth.repository.js";
import { Db } from "../../src/db.js";

export const TEST_PASSWORDS = {
  standard: "CorporateSecurePass123!",
  admin: "MasterSuperadminSecret2026!",
};

// scrypt hashes of TEST_PASSWORDS.
export const HASHES = {
  standard:
    "scrypt$32768$8$3$8e9d08c4a6de754cf9c41279172dd04e$8a411a1c5a21a5b30c450bf0602ab20887c2bbf27604bc15d838641cef713950d6096bc4d5d4f353bf75866b53440753b2797f16b39a2651ad77fe34da89f5d5",
  admin:
    "scrypt$32768$8$3$ee68b8d95b8a289b0e1bdfaf9a85d991$0397fb49a0ea2dcd502a8c0d9d5ed8a75382a852045071281f2c00c84f3d4f1688549f2fc500fa78d45334da420da24017184450e6a993005549275ed68bf89b",
};

export const SEED = {
  defaultOrg: "ZX-ORG-4B8T-9M2K-7Y4X",
  secondOrg: "ZX-ORG-9Z8Y-7X6W-5V4U",
  consumerZxId: "ZX-8K9M-4P2W-7Y3X",
  dispatcherZxId: "ZX-7K2M-9P4W-2Y8X",
  ids: {
    defaultOrg: "00000000-0000-4000-8000-00000000000a",
    secondOrg: "00000000-0000-4000-8000-00000000000b",
    consumer: "00000000-0000-4000-8000-000000000001",
    logisticsManager: "00000000-0000-4000-8000-000000000002",
    dispatcher: "00000000-0000-4000-8000-000000000101",
    admin: "00000000-0000-4000-8000-000000000201",
  },
};

const schema = (name: string) => readFileSync(new URL(`../../../../scripts/db/${name}`, import.meta.url), "utf8");

const SEED_SQL = `
INSERT INTO zolexora_organizations (id, zolexora_org_id, name, legal_name) VALUES
  ('${SEED.ids.defaultOrg}', '${SEED.defaultOrg}', 'Zolexora Logistics Ltd', 'Zolexora Logistics Ltd'),
  ('${SEED.ids.secondOrg}', '${SEED.secondOrg}', 'Zolexora Express Cargo', 'Zolexora Express Cargo');
INSERT INTO zolexora_auth_users (id, zolexora_id, email, phone_number, password_hash, email_verified_at, phone_verified_at) VALUES
  ('${SEED.ids.consumer}', '${SEED.consumerZxId}', 'consumer@clarityfi.app', '+919876543210', '${HASHES.standard}', now(), now()),
  ('${SEED.ids.logisticsManager}', 'ZX-9K3M-5P2W-2Y7X', 'logistics.manager@globalfreight.com', '+919876543211', '${HASHES.standard}', now(), now());
INSERT INTO zolexora_organization_memberships (id, organization_id, zolexora_id, email, password_hash, role, permissions) VALUES
  ('${SEED.ids.dispatcher}', '${SEED.ids.defaultOrg}', '${SEED.dispatcherZxId}', 'dispatcher@zolexora.com', '${HASHES.standard}', 'manager',
   '["dispatch:read", "dispatch:write"]');
INSERT INTO zolexora_org_members (organization_id, employee_id) VALUES ('${SEED.ids.defaultOrg}', '${SEED.ids.dispatcher}');
INSERT INTO zolexora_member_roles (member_id, scope, role_id)
  SELECT m.id, 'org', r.id FROM zolexora_org_members m
  JOIN zolexora_roles r ON r.organization_id = m.organization_id AND r.scope = 'org' AND r.key = 'manager'
  WHERE m.employee_id = '${SEED.ids.dispatcher}';
INSERT INTO platform_admin_users (id, zolexora_id, username, email, password_hash, role, permissions) VALUES
  ('${SEED.ids.admin}', 'ZX-0001-ADMIN-ROOT', 'superadmin', 'superadmin@zolexora.com', '${HASHES.admin}', 'superadmin', '["*"]');
`;

/** A fresh, seeded PostgreSQL database in memory. Ready after the first query resolves. */
export function testDb(): Db {
  const pg = new PGlite({ extensions: { pgcrypto } });
  const ready = (async () => {
    await pg.exec(schema("auth-service-schema.sql"));
    await pg.exec(schema("auth-service-upgrade-identity.sql"));
    await pg.exec(schema("auth-service-admin-schema.sql"));
    await pg.exec(SEED_SQL);
  })();
  const wrap = (q: { query: PGlite["query"] }): Db["query"] => async (sql, params) => {
    const r = await q.query<any>(sql, params as any[]);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  let inTx = false;
  const db: Db = {
    query: async (sql, params) => {
      await ready;
      return wrap(pg)(sql, params);
    },
    tx: async (fn) => {
      await ready;
      if (inTx) return fn(db); // PGlite runs one transaction at a time; nested calls join it
      return pg.transaction(async (t) => {
        inTx = true;
        try {
          return await fn({ query: wrap(t), tx: (f) => f(db), close: async () => {} });
        } finally {
          inTx = false;
        }
      });
    },
    // Tests close an app and then build another one on the same repository, so closing must not
    // destroy the data. Each repository has its own in-memory database, freed with the process.
    close: async () => {},
  };
  return db;
}

/** Production repository on a fresh seeded test database. */
export class InMemoryAuthRepository extends PostgresAuthRepository {
  constructor(db: Db = testDb()) {
    super(db, db);
  }
}
