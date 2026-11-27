import { db } from "../../db.js";
import { appointments } from "../../db/schema.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { notFound } from "../../plugins/error-handler.js";

export class AppointmentService {
  async list(orgId: string, query: { professionalId?: string; customerId?: string; status?: string; date?: string; from?: string; to?: string; page: number; limit: number }) {
    // Build where conditions
    const conditions = [eq(appointments.orgId, orgId)];
    if (query.professionalId) conditions.push(eq(appointments.professionalId, query.professionalId));
    if (query.customerId) conditions.push(eq(appointments.customerId, query.customerId));
    if (query.status) conditions.push(eq(appointments.status, query.status as any));
    if (query.date) {
      const start = new Date(`${query.date}T00:00:00Z`);
      const end = new Date(`${query.date}T23:59:59Z`);
      conditions.push(gte(appointments.startAt, start), lte(appointments.startAt, end));
    } else {
      if (query.from) conditions.push(gte(appointments.startAt, new Date(query.from)));
      if (query.to) conditions.push(lte(appointments.endAt, new Date(query.to)));
    }

    const offset = (query.page - 1) * query.limit;
    const rows = await db.query.appointments.findMany({
      where: and(...conditions),
      orderBy: [desc(appointments.startAt)],
      limit: query.limit,
      offset,
    });
    return { data: rows, page: query.page, limit: query.limit };
  }

  async create(orgId: string, createdBy: string, data: Partial<typeof appointments.$inferInsert>) {
    const [appointment] = await db
      .insert(appointments)
      .values({
        orgId,
        createdBy,
        serviceId: data.serviceId!,
        startAt: new Date(data.startAt as unknown as string),
        endAt: new Date(data.endAt as unknown as string),
        ...data,
      })
      .returning();
    return appointment;
  }

  async getById(orgId: string, id: string) {
    const row = await db.query.appointments.findFirst({
      where: and(eq(appointments.id, id), eq(appointments.orgId, orgId)),
    });
    if (!row) throw notFound("Appointment not found");
    return row;
  }

  async updateStatus(orgId: string, id: string, status: typeof appointments.$inferSelect["status"], updatedBy: string, reason?: string) {
    const [updated] = await db
      .update(appointments)
      .set({
        status,
        updatedBy,
        updatedAt: new Date(),
        ...(status === "cancelled" && reason ? { cancellationReason: reason } : {}),
      })
      .where(and(eq(appointments.id, id), eq(appointments.orgId, orgId)))
      .returning();
    if (!updated) throw notFound("Appointment not found");
    return updated;
  }

  async cancel(orgId: string, id: string, cancelledBy: string, reason?: string) {
    return this.updateStatus(orgId, id, "cancelled", cancelledBy, reason);
  }
}
