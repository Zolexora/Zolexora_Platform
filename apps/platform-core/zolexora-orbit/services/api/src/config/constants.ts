/**
 * Orbit product permission catalog.
 *
 * These are registered with the Auth Service on startup via
 * PUT /api/v1/catalog/orbit using the ORBIT_PRODUCT_KEY.
 *
 * Naming convention: <resource>:<action>[:<scope>]
 * Mirrors the Auth Service permission engine conventions.
 */
export const ORBIT_PRODUCT_ID = "orbit" as const;

export const ORBIT_PERMISSIONS = {
  // ── Organization operations ───────────────────────────────────────
  ORG_READ: "org:read",
  ORG_SETTINGS_WRITE: "org:settings:write",
  ORG_BRANCH_MANAGE: "org:branch:manage",
  ORG_DEPARTMENT_MANAGE: "org:department:manage",

  // ── Customer management ───────────────────────────────────────────
  CUSTOMER_READ: "customer:read",
  CUSTOMER_WRITE: "customer:write",
  CUSTOMER_DELETE: "customer:delete",

  // ── Professional management ───────────────────────────────────────
  PROFESSIONAL_READ: "professional:read",
  PROFESSIONAL_WRITE: "professional:write",

  // ── Service catalogue ─────────────────────────────────────────────
  SERVICE_READ: "service:read",
  SERVICE_WRITE: "service:write",
  SERVICE_DELETE: "service:delete",

  // ── Appointments ─────────────────────────────────────────────────
  APPOINTMENT_READ: "appointment:read",
  APPOINTMENT_WRITE: "appointment:write",
  APPOINTMENT_CANCEL: "appointment:cancel",
  APPOINTMENT_READ_ALL: "appointment:read:all",

  // ── Scheduling ────────────────────────────────────────────────────
  SCHEDULE_READ: "schedule:read",
  SCHEDULE_WRITE: "schedule:write",
  SCHEDULE_MANAGE_ALL: "schedule:manage:all",

  // ── Resources ────────────────────────────────────────────────────
  RESOURCE_READ: "resource:read",
  RESOURCE_WRITE: "resource:write",

  // ── Payments ─────────────────────────────────────────────────────
  PAYMENT_READ: "payment:read",
  PAYMENT_WRITE: "payment:write",
  PAYMENT_REFUND: "payment:refund",

  // ── Reporting ─────────────────────────────────────────────────────
  REPORT_READ: "report:read",
  REPORT_READ_FINANCIAL: "report:read:financial",

  // ── Admin / configuration ─────────────────────────────────────────
  ADMIN_MODULES: "admin:modules",
  ADMIN_INTEGRATIONS: "admin:integrations",
  ADMIN_AUDIT: "admin:audit",
} as const;

export type OrbitPermission =
  (typeof ORBIT_PERMISSIONS)[keyof typeof ORBIT_PERMISSIONS];

/** Roles built into Orbit — mapped from Auth Service built-in roles */
export const ORBIT_ROLE_MAP = {
  owner: "owner",
  admin: "admin",
  manager: "manager",
  receptionist: "receptionist",
  professional: "professional",
  accountant: "accountant",
  member: "member",
} as const;
