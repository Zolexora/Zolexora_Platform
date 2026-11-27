import { db } from "../../db.js";
import { services } from "../../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import { notFound } from "../../plugins/error-handler.js";

export class ServiceCatalogueService {
  async list(orgId: string, query: { categoryId?: string; isActive?: boolean; page: number; limit: number }) {
    const conditions = [eq(services.orgId, orgId), isNull(services.deletedAt)];
    if (query.categoryId) conditions.push(eq(services.categoryId, query.categoryId));
    if (query.isActive !== undefined) conditions.push(eq(services.isActive, query.isActive));
    const offset = (query.page - 1) * query.limit;
    const rows = await db.query.services.findMany({
      where: and(...conditions),
      limit: query.limit,
      offset,
    });
    return { data: rows, page: query.page, limit: query.limit };
  }

  async create(orgId: string, data: Partial<typeof services.$inferInsert>) {
    const [service] = await db.insert(services).values({ orgId, name: data.name!, ...data }).returning();
    return service;
  }

  async getById(orgId: string, id: string) {
    const row = await db.query.services.findFirst({
      where: and(eq(services.id, id), eq(services.orgId, orgId), isNull(services.deletedAt)),
    });
    if (!row) throw notFound("Service not found");
    return row;
  }

  async update(orgId: string, id: string, data: Partial<typeof services.$inferInsert>) {
    const [updated] = await db.update(services).set({ ...data, updatedAt: new Date() })
      .where(and(eq(services.id, id), eq(services.orgId, orgId))).returning();
    if (!updated) throw notFound("Service not found");
    return updated;
  }

  async softDelete(orgId: string, id: string) {
    const [deleted] = await db.update(services).set({ deletedAt: new Date() })
      .where(and(eq(services.id, id), eq(services.orgId, orgId))).returning();
    if (!deleted) throw notFound("Service not found");
  }
}
