import { Db } from "../db.js";

export interface CatalogEntry {
  key: string;
  description: string;
}

export interface CatalogVersionRow {
  id: string;
  product: string;
  version: number;
  permissions: CatalogEntry[];
  added: string[];
  removed: string[];
  status: "applied" | "pending_approval" | "approved" | "rejected";
  decided_by: string | null;
  decided_at: Date | null;
  created_at: Date;
}

const VERSION_COLS = "id, product, version, permissions, added, removed, status, decided_by, decided_at, created_at";

/**
 * Product permission catalog (ADR 0005 §2). Each product sends its full list:
 * new keys go live at once; keys left out wait for a platform admin (they stay live until approved).
 */
export class CatalogStore {
  constructor(private readonly db: Db) {}

  /** Live keys (active or awaiting removal), optionally for one product. */
  async liveKeys(product?: string): Promise<Set<string>> {
    const r = await this.db.query<{ key: string }>(
      "SELECT key FROM zolexora_permission_catalog WHERE status <> 'retired' AND ($1::text IS NULL OR product = $1)", [product ?? null],
    );
    return new Set(r.rows.map((x) => x.key));
  }

  async list(product?: string) {
    return (await this.db.query<CatalogEntry & { product: string; status: string; version: number }>(
      `SELECT key, product, description, status, version FROM zolexora_permission_catalog
       WHERE status <> 'retired' AND ($1::text IS NULL OR product = $1) ORDER BY key`,
      [product ?? null],
    )).rows;
  }

  async register(product: string, entries: CatalogEntry[], decidedBy: string | null = null): Promise<CatalogVersionRow> {
    return this.db.tx(async (tx) => {
      // One registration at a time per product.
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('zolexora_catalog:' || $1))", [product]);
      const current = (await tx.query<{ key: string; status: string }>(
        "SELECT key, status FROM zolexora_permission_catalog WHERE product = $1", [product],
      )).rows;
      const live = new Set(current.filter((c) => c.status !== "retired").map((c) => c.key));
      const wanted = new Map(entries.map((e) => [e.key, e.description]));
      const added = [...wanted.keys()].filter((k) => !live.has(k));
      const removed = [...live].filter((k) => !wanted.has(k));
      const version = (await tx.query<{ v: number }>(
        "SELECT COALESCE(max(version), 0) + 1 AS v FROM zolexora_catalog_versions WHERE product = $1", [product],
      )).rows[0].v;

      for (const [key, description] of wanted) {
        await tx.query(
          `INSERT INTO zolexora_permission_catalog (key, product, description, status, version) VALUES ($1, $2, $3, 'active', $4)
           ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description, status = 'active', version = EXCLUDED.version, updated_at = now()`,
          [key, product, description, version],
        );
      }
      // Earlier pending removals are superseded by this list.
      await tx.query(
        `UPDATE zolexora_catalog_versions SET status = 'rejected', decided_by = 'superseded', decided_at = now()
         WHERE product = $1 AND status = 'pending_approval'`,
        [product],
      );
      if (removed.length) {
        await tx.query(
          "UPDATE zolexora_permission_catalog SET status = 'pending_removal', updated_at = now() WHERE product = $1 AND key = ANY($2)",
          [product, removed],
        );
      }
      return (await tx.query<CatalogVersionRow>(
        `INSERT INTO zolexora_catalog_versions (product, version, permissions, added, removed, status, decided_by, decided_at)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, CASE WHEN $6 = 'applied' THEN now() END) RETURNING ${VERSION_COLS}`,
        [product, version, JSON.stringify(entries), JSON.stringify(added), JSON.stringify(removed),
          removed.length ? "pending_approval" : "applied", decidedBy],
      )).rows[0];
    });
  }

  async listVersions(product?: string, status?: string): Promise<CatalogVersionRow[]> {
    return (await this.db.query<CatalogVersionRow>(
      `SELECT ${VERSION_COLS} FROM zolexora_catalog_versions
       WHERE ($1::text IS NULL OR product = $1) AND ($2::text IS NULL OR status = $2) ORDER BY created_at DESC LIMIT 200`,
      [product ?? null, status ?? null],
    )).rows;
  }

  async getVersion(id: string): Promise<CatalogVersionRow | null> {
    return (await this.db.query<CatalogVersionRow>(`SELECT ${VERSION_COLS} FROM zolexora_catalog_versions WHERE id::text = $1`, [id])).rows[0] ?? null;
  }

  /** Approve: the removed keys stop working everywhere. Reject: they stay. */
  async decide(id: string, approve: boolean, by: string): Promise<CatalogVersionRow | null> {
    return this.db.tx(async (tx) => {
      const v = (await tx.query<CatalogVersionRow>(
        `UPDATE zolexora_catalog_versions SET status = $2, decided_by = $3, decided_at = now()
         WHERE id::text = $1 AND status = 'pending_approval' RETURNING ${VERSION_COLS}`,
        [id, approve ? "approved" : "rejected", by],
      )).rows[0];
      if (!v) return null;
      await tx.query(
        `UPDATE zolexora_permission_catalog SET status = $3, updated_at = now()
         WHERE product = $1 AND key = ANY($2) AND status = 'pending_removal'`,
        [v.product, v.removed, approve ? "retired" : "active"],
      );
      if (approve) {
        await tx.query("DELETE FROM zolexora_role_permissions WHERE permission_key = ANY($1)", [v.removed]);
        await tx.query("DELETE FROM zolexora_member_overrides WHERE permission_key = ANY($1)", [v.removed]);
      }
      return v;
    });
  }
}
