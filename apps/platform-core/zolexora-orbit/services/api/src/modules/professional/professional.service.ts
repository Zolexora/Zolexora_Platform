import { db } from "../../db.js";
import { professionalProfiles } from "../../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import { notFound } from "../../plugins/error-handler.js";

export class ProfessionalService {
  async list(orgId: string, query: { branchId?: string; serviceId?: string; isActive?: boolean }) {
    const conditions = [eq(professionalProfiles.orgId, orgId), isNull(professionalProfiles.deletedAt)];
    if (query.branchId) conditions.push(eq(professionalProfiles.branchId, query.branchId));
    if (query.isActive !== undefined) conditions.push(eq(professionalProfiles.isActive, query.isActive));
    return db.query.professionalProfiles.findMany({ where: and(...conditions) });
  }

  async getById(orgId: string, id: string) {
    const row = await db.query.professionalProfiles.findFirst({
      where: and(eq(professionalProfiles.id, id), eq(professionalProfiles.orgId, orgId)),
    });
    if (!row) throw notFound("Professional not found");
    return row;
  }

  async update(orgId: string, id: string, data: Partial<typeof professionalProfiles.$inferInsert>) {
    const [updated] = await db.update(professionalProfiles).set({ ...data, updatedAt: new Date() })
      .where(and(eq(professionalProfiles.id, id), eq(professionalProfiles.orgId, orgId))).returning();
    if (!updated) throw notFound("Professional not found");
    return updated;
  }
}
