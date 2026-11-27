import { db } from "../../db.js";
import { customerProfiles } from "../../db/schema.js";
import { eq, and, isNull, or, ilike } from "drizzle-orm";
import { notFound } from "../../plugins/error-handler.js";

export class CustomerService {
  async list(orgId: string, query: { search?: string; page: number; limit: number }) {
    const offset = (query.page - 1) * query.limit;
    const baseCondition = and(eq(customerProfiles.orgId, orgId), isNull(customerProfiles.deletedAt));
    const rows = await db.query.customerProfiles.findMany({
      where: query.search
        ? and(baseCondition, or(
            ilike(customerProfiles.firstName, `%${query.search}%`),
            ilike(customerProfiles.phone, `%${query.search}%`),
            ilike(customerProfiles.email, `%${query.search}%`),
          ))
        : baseCondition,
      orderBy: customerProfiles.firstName,
      limit: query.limit,
      offset,
    });
    return { data: rows, page: query.page, limit: query.limit };
  }

  async create(orgId: string, data: Partial<typeof customerProfiles.$inferInsert>) {
    const [customer] = await db
      .insert(customerProfiles)
      .values({ orgId, firstName: data.firstName!, ...data })
      .returning();
    return customer;
  }

  async getById(orgId: string, id: string) {
    const row = await db.query.customerProfiles.findFirst({
      where: and(eq(customerProfiles.id, id), eq(customerProfiles.orgId, orgId), isNull(customerProfiles.deletedAt)),
    });
    if (!row) throw notFound("Customer not found");
    return row;
  }

  async update(orgId: string, id: string, data: Partial<typeof customerProfiles.$inferInsert>) {
    const [updated] = await db
      .update(customerProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(customerProfiles.id, id), eq(customerProfiles.orgId, orgId)))
      .returning();
    if (!updated) throw notFound("Customer not found");
    return updated;
  }

  async softDelete(orgId: string, id: string) {
    const [deleted] = await db
      .update(customerProfiles)
      .set({ deletedAt: new Date() })
      .where(and(eq(customerProfiles.id, id), eq(customerProfiles.orgId, orgId)))
      .returning();
    if (!deleted) throw notFound("Customer not found");
  }
}
