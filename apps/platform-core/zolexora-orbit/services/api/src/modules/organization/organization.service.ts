import { db } from "../../db.js";
import { orgProfiles, branches } from "../../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import { notFound } from "../../plugins/error-handler.js";

export class OrganizationService {
  async getOrCreateProfile(orgId: string) {
    const existing = await db.query.orgProfiles.findFirst({
      where: eq(orgProfiles.orgId, orgId),
    });
    if (existing) return existing;
    // Create a minimal profile on first access
    const [created] = await db
      .insert(orgProfiles)
      .values({ orgId, displayName: orgId })
      .returning();
    return created;
  }

  async upsertProfile(orgId: string, data: Partial<typeof orgProfiles.$inferInsert>) {
    const existing = await db.query.orgProfiles.findFirst({
      where: eq(orgProfiles.orgId, orgId),
    });
    if (!existing) {
      const [created] = await db
        .insert(orgProfiles)
        .values({ orgId, displayName: orgId, ...data })
        .returning();
      return created;
    }
    const [updated] = await db
      .update(orgProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orgProfiles.orgId, orgId))
      .returning();
    return updated;
  }

  async listBranches(orgId: string) {
    return db.query.branches.findMany({
      where: and(eq(branches.orgId, orgId), isNull(branches.deletedAt)),
      orderBy: branches.name,
    });
  }

  async createBranch(orgId: string, data: Partial<typeof branches.$inferInsert>) {
    const [branch] = await db
      .insert(branches)
      .values({ orgId, name: data.name!, ...data })
      .returning();
    return branch;
  }

  async updateBranch(orgId: string, branchId: string, data: Partial<typeof branches.$inferInsert>) {
    const [updated] = await db
      .update(branches)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(branches.id, branchId), eq(branches.orgId, orgId)))
      .returning();
    if (!updated) throw notFound("Branch not found");
    return updated;
  }

  async deleteBranch(orgId: string, branchId: string) {
    const [deleted] = await db
      .update(branches)
      .set({ deletedAt: new Date() })
      .where(and(eq(branches.id, branchId), eq(branches.orgId, orgId)))
      .returning();
    if (!deleted) throw notFound("Branch not found");
  }
}
