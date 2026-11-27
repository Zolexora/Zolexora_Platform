import { db } from "../../db.js";
import { payments } from "../../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "../../plugins/error-handler.js";

export class PaymentService {
  async list(orgId: string, query: { appointmentId?: string; customerId?: string; status?: string; page: number; limit: number }) {
    const conditions = [eq(payments.orgId, orgId)];
    if (query.appointmentId) conditions.push(eq(payments.appointmentId, query.appointmentId));
    if (query.customerId) conditions.push(eq(payments.customerId, query.customerId));
    if (query.status) conditions.push(eq(payments.status, query.status as any));
    const offset = (query.page - 1) * query.limit;
    const rows = await db.query.payments.findMany({
      where: and(...conditions),
      orderBy: [desc(payments.createdAt)],
      limit: query.limit,
      offset,
    });
    return { data: rows, page: query.page, limit: query.limit };
  }

  async record(orgId: string, data: Partial<typeof payments.$inferInsert>) {
    const [payment] = await db.insert(payments)
      .values({ orgId, amount: data.amount!, currency: data.currency!, status: "paid", paidAt: new Date(), ...data })
      .returning();
    return payment;
  }

  async refund(orgId: string, id: string, reason?: string) {
    const [updated] = await db.update(payments)
      .set({ status: "refunded", updatedAt: new Date(), ...(reason ? { notes: reason } : {}) })
      .where(and(eq(payments.id, id), eq(payments.orgId, orgId)))
      .returning();
    if (!updated) throw notFound("Payment not found");
    return updated;
  }
}
