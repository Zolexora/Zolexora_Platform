import { db } from "../../db.js";
import { scheduleTemplates, scheduleOverrides, services, appointments } from "../../db/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";

export class ScheduleService {
  async listTemplates(orgId: string) {
    return db.query.scheduleTemplates.findMany({
      where: and(eq(scheduleTemplates.orgId, orgId), eq(scheduleTemplates.isActive, true)),
    });
  }

  async createTemplate(orgId: string, data: Partial<typeof scheduleTemplates.$inferInsert>) {
    const [template] = await db.insert(scheduleTemplates)
      .values({ orgId, name: data.name!, weeklyPattern: data.weeklyPattern!, effectiveFrom: data.effectiveFrom!, ...data })
      .returning();
    return template;
  }

  async createOverride(orgId: string, data: Partial<typeof scheduleOverrides.$inferInsert>) {
    const [override] = await db.insert(scheduleOverrides)
      .values({ orgId, date: data.date!, isAvailable: data.isAvailable ?? false, ...data })
      .returning();
    return override;
  }

  async getAvailableSlots(orgId: string, query: { professionalId?: string; serviceId: string; date: string; branchId?: string }) {
    // Basic slot computation — return booked slots for now; full scheduling engine is a future module
    const service = await db.query.services.findFirst({
      where: eq(services.id, query.serviceId),
    });
    if (!service) return { slots: [] };

    const dayStart = new Date(`${query.date}T00:00:00Z`);
    const dayEnd = new Date(`${query.date}T23:59:59Z`);

    const booked = await db.query.appointments.findMany({
      where: and(
        eq(appointments.orgId, orgId),
        query.professionalId ? eq(appointments.professionalId, query.professionalId) : undefined!,
        gte(appointments.startAt, dayStart),
        lte(appointments.endAt, dayEnd),
      ),
      columns: { startAt: true, endAt: true },
    });

    return {
      serviceId: query.serviceId,
      date: query.date,
      durationMinutes: service.durationMinutes,
      bookedSlots: booked.map((b) => ({ startAt: b.startAt, endAt: b.endAt })),
    };
  }
}
