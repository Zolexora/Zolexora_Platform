import { db } from "../../db.js";
import { resources } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";

export class ResourceService {
  async list(orgId: string, query: { branchId?: string; type?: string }) {
    const conditions = [eq(resources.orgId, orgId), eq(resources.isActive, true)];
    if (query.branchId) conditions.push(eq(resources.branchId, query.branchId));
    if (query.type) conditions.push(eq(resources.type, query.type as any));
    return db.query.resources.findMany({ where: and(...conditions) });
  }

  async create(orgId: string, data: Partial<typeof resources.$inferInsert>) {
    const [resource] = await db.insert(resources)
      .values({ orgId, name: data.name!, type: data.type!, ...data })
      .returning();
    return resource;
  }
}
