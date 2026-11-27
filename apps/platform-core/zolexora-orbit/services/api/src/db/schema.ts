/**
 * Drizzle ORM schema for Zolexora Orbit.
 *
 * Design principles:
 * - All org-scoped tables carry org_id referencing Auth Service zolexora_org_id.
 *   Orbit does NOT own org identity — it only holds operational extensions.
 * - Row-level security must be enabled in Postgres; Orbit enforces it here too.
 * - Soft deletes: deleted_at timestamp instead of hard DELETE where appropriate.
 * - UUID primary keys.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Shared helpers ────────────────────────────────────────────────────────────

const id = () => uuid("id").defaultRandom().primaryKey();
const orgId = () => text("org_id").notNull(); // References auth service org
const now = () =>
  timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`);
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`);
const deletedAt = () => timestamp("deleted_at", { withTimezone: true });

// ── Enums ────────────────────────────────────────────────────────────────────

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);

export const bookingChannelEnum = pgEnum("booking_channel", [
  "walk_in",
  "phone",
  "online",
  "app",
  "reception",
]);

export const resourceTypeEnum = pgEnum("resource_type", [
  "room",
  "equipment",
  "vehicle",
  "other",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "partial",
  "refunded",
  "failed",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "upi",
  "online",
  "wallet",
  "other",
]);

// ── Organization Extensions ───────────────────────────────────────────────────
// Orbit operational extension of an Auth-managed org.

export const orgProfiles = pgTable(
  "org_profiles",
  {
    id: id(),
    orgId: orgId(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    phone: text("phone"),
    email: text("email"),
    websiteUrl: text("website_url"),
    logoUrl: text("logo_url"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    locale: text("locale").notNull().default("en-IN"),
    currency: text("currency").notNull().default("INR"),
    /** Industry/profession codes active for this org, e.g. ["healthcare.general", "aesthetics.salon"] */
    activeModules: jsonb("active_modules").$type<string[]>().default([]),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("org_profiles_org_id_idx").on(t.orgId)],
);

// ── Branches ─────────────────────────────────────────────────────────────────

export const branches = pgTable(
  "branches",
  {
    id: id(),
    orgId: orgId(),
    name: text("name").notNull(),
    code: text("code"), // Short code, e.g. "BRANCH-001"
    phone: text("phone"),
    email: text("email"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    country: text("country").default("IN"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    isActive: boolean("is_active").notNull().default(true),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
    createdAt: now(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("branches_org_id_idx").on(t.orgId),
    index("branches_org_active_idx").on(t.orgId, t.isActive),
  ],
);

// ── Departments ───────────────────────────────────────────────────────────────

export const departments = pgTable(
  "departments",
  {
    id: id(),
    orgId: orgId(),
    branchId: uuid("branch_id").references(() => branches.id),
    name: text("name").notNull(),
    code: text("code"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: now(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("departments_org_id_idx").on(t.orgId)],
);

// ── Customer Profiles ─────────────────────────────────────────────────────────
// Orbit's operational customer record. References Auth user identity.

export const customerProfiles = pgTable(
  "customer_profiles",
  {
    id: id(),
    orgId: orgId(),
    /** Auth Service zolexora_id — the linked user account (may be null for walk-ins) */
    zolexoraUserId: text("zolexora_user_id"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    phone: text("phone"),
    email: text("email"),
    dateOfBirth: text("date_of_birth"), // YYYY-MM-DD
    gender: text("gender"),
    photoUrl: text("photo_url"),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().default([]),
    customFields: jsonb("custom_fields")
      .$type<Record<string, unknown>>()
      .default({}),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: now(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("customer_profiles_org_id_idx").on(t.orgId),
    index("customer_profiles_user_id_idx").on(t.orgId, t.zolexoraUserId),
    index("customer_profiles_phone_idx").on(t.orgId, t.phone),
  ],
);

// ── Professional Profiles ─────────────────────────────────────────────────────
// References Auth Service employee/member identity.

export const professionalProfiles = pgTable(
  "professional_profiles",
  {
    id: id(),
    orgId: orgId(),
    /** Auth Service zolexora_id of the employee */
    zolexoraMemberId: text("zolexora_member_id").notNull(),
    branchId: uuid("branch_id").references(() => branches.id),
    departmentId: uuid("department_id").references(() => departments.id),
    displayName: text("display_name").notNull(),
    title: text("title"), // e.g. "Dr.", "Prof."
    specializations: jsonb("specializations").$type<string[]>().default([]),
    qualifications: jsonb("qualifications").$type<string[]>().default([]),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    color: text("color"), // Calendar display colour
    isActive: boolean("is_active").notNull().default(true),
    acceptsOnlineBooking: boolean("accepts_online_booking")
      .notNull()
      .default(true),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
    createdAt: now(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("professional_profiles_org_id_idx").on(t.orgId),
    uniqueIndex("professional_profiles_member_org_idx").on(
      t.orgId,
      t.zolexoraMemberId,
    ),
  ],
);

// ── Service Catalogue ─────────────────────────────────────────────────────────

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: id(),
    orgId: orgId(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [index("service_categories_org_id_idx").on(t.orgId)],
);

export const services = pgTable(
  "services",
  {
    id: id(),
    orgId: orgId(),
    categoryId: uuid("category_id").references(() => serviceCategories.id),
    name: text("name").notNull(),
    description: text("description"),
    code: text("code"),
    /** Duration in minutes */
    durationMinutes: integer("duration_minutes").notNull().default(30),
    /** Buffer time in minutes after the service */
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    /** Price in smallest currency unit (paise for INR) */
    priceAmount: integer("price_amount"),
    currency: text("currency").notNull().default("INR"),
    isActive: boolean("is_active").notNull().default(true),
    acceptsOnlineBooking: boolean("accepts_online_booking")
      .notNull()
      .default(true),
    requiresConfirmation: boolean("requires_confirmation")
      .notNull()
      .default(false),
    maxAdvanceBookingDays: integer("max_advance_booking_days").default(90),
    minAdvanceBookingHours: integer("min_advance_booking_hours").default(1),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
    createdAt: now(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("services_org_id_idx").on(t.orgId),
    index("services_org_active_idx").on(t.orgId, t.isActive),
  ],
);

/** Which professionals can deliver which services */
export const serviceProfessionals = pgTable(
  "service_professionals",
  {
    id: id(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id),
    orgId: orgId(),
  },
  (t) => [
    uniqueIndex("service_professionals_unique_idx").on(
      t.serviceId,
      t.professionalId,
    ),
    index("service_professionals_org_idx").on(t.orgId),
  ],
);

// ── Resources ─────────────────────────────────────────────────────────────────

export const resources = pgTable(
  "resources",
  {
    id: id(),
    orgId: orgId(),
    branchId: uuid("branch_id").references(() => branches.id),
    type: resourceTypeEnum("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    capacity: integer("capacity").default(1),
    isActive: boolean("is_active").notNull().default(true),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [index("resources_org_id_idx").on(t.orgId)],
);

// ── Schedules ─────────────────────────────────────────────────────────────────

export const scheduleTemplates = pgTable(
  "schedule_templates",
  {
    id: id(),
    orgId: orgId(),
    professionalId: uuid("professional_id").references(
      () => professionalProfiles.id,
    ),
    branchId: uuid("branch_id").references(() => branches.id),
    name: text("name").notNull(),
    /** JSON: Array of day-of-week availability blocks */
    weeklyPattern: jsonb("weekly_pattern")
      .$type<
        {
          dayOfWeek: number; // 0=Sun..6=Sat
          startTime: string; // HH:mm
          endTime: string; // HH:mm
          isAvailable: boolean;
        }[]
      >()
      .notNull(),
    effectiveFrom: text("effective_from").notNull(), // YYYY-MM-DD
    effectiveUntil: text("effective_until"), // YYYY-MM-DD, null = indefinite
    isActive: boolean("is_active").notNull().default(true),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [index("schedule_templates_org_id_idx").on(t.orgId)],
);

/** One-off overrides: holidays, special hours, blocked time */
export const scheduleOverrides = pgTable(
  "schedule_overrides",
  {
    id: id(),
    orgId: orgId(),
    professionalId: uuid("professional_id").references(
      () => professionalProfiles.id,
    ),
    branchId: uuid("branch_id").references(() => branches.id),
    date: text("date").notNull(), // YYYY-MM-DD
    isAvailable: boolean("is_available").notNull().default(false),
    startTime: text("start_time"), // HH:mm, null = full day
    endTime: text("end_time"),
    reason: text("reason"),
    createdAt: now(),
  },
  (t) => [
    index("schedule_overrides_org_date_idx").on(t.orgId, t.date),
    index("schedule_overrides_professional_date_idx").on(
      t.professionalId,
      t.date,
    ),
  ],
);

// ── Appointments ─────────────────────────────────────────────────────────────

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    orgId: orgId(),
    branchId: uuid("branch_id").references(() => branches.id),
    customerId: uuid("customer_id").references(() => customerProfiles.id),
    professionalId: uuid("professional_id").references(
      () => professionalProfiles.id,
    ),
    serviceId: uuid("service_id").references(() => services.id),
    resourceId: uuid("resource_id").references(() => resources.id),
    status: appointmentStatusEnum("status").notNull().default("pending"),
    channel: bookingChannelEnum("channel").notNull().default("online"),
    /** ISO 8601 datetime with timezone */
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    /** Who created this appointment: Auth zolexora_id or null for customer self-booking */
    createdBy: text("created_by"),
    /** Who last updated this appointment */
    updatedBy: text("updated_by"),
    cancellationReason: text("cancellation_reason"),
    customFields: jsonb("custom_fields")
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("appointments_org_id_idx").on(t.orgId),
    index("appointments_org_start_idx").on(t.orgId, t.startAt),
    index("appointments_professional_start_idx").on(
      t.professionalId,
      t.startAt,
    ),
    index("appointments_customer_idx").on(t.customerId),
    index("appointments_status_idx").on(t.orgId, t.status),
  ],
);

// ── Payments ──────────────────────────────────────────────────────────────────

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orgId: orgId(),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    customerId: uuid("customer_id").references(() => customerProfiles.id),
    amount: integer("amount").notNull(), // smallest currency unit
    currency: text("currency").notNull().default("INR"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    method: paymentMethodEnum("method"),
    /** Gateway-specific transaction ID */
    gatewayTransactionId: text("gateway_transaction_id"),
    gatewayProvider: text("gateway_provider"),
    gatewayResponse: jsonb("gateway_response"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("payments_org_id_idx").on(t.orgId),
    index("payments_appointment_idx").on(t.appointmentId),
  ],
);

// ── Audit Log ─────────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    orgId: orgId(),
    /** Auth zolexora_id of the actor */
    actorId: text("actor_id"),
    action: text("action").notNull(), // e.g. "appointment.created"
    entityType: text("entity_type").notNull(), // e.g. "appointment"
    entityId: text("entity_id"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: now(),
  },
  (t) => [
    index("audit_log_org_id_idx").on(t.orgId),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_actor_idx").on(t.actorId),
  ],
);

// ── Module Registry ───────────────────────────────────────────────────────────
// Tracks which modules/professions are enabled per org.

export const orgModules = pgTable(
  "org_modules",
  {
    id: id(),
    orgId: orgId(),
    moduleId: text("module_id").notNull(), // e.g. "healthcare.general"
    isEnabled: boolean("is_enabled").notNull().default(true),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
    enabledAt: now(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("org_modules_unique_idx").on(t.orgId, t.moduleId),
    index("org_modules_org_idx").on(t.orgId),
  ],
);
