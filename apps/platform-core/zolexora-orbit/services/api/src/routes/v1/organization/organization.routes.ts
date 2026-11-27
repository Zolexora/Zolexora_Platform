/**
 * Organization routes — Orbit operational extension of an Auth-managed org.
 *
 * Auth Service owns: org identity, members, roles.
 * Orbit owns: org settings, branches, departments, active modules.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../../../middleware/auth.middleware.js";
import { ORBIT_PERMISSIONS } from "../../../config/constants.js";
import { OrganizationService } from "../../../modules/organization/organization.service.js";

const orgProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  websiteUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  timezone: z.string().default("Asia/Kolkata"),
  locale: z.string().default("en-IN"),
  currency: z.string().length(3).default("INR"),
});

const branchSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  timezone: z.string().default("Asia/Kolkata"),
});

export async function organizationRoutes(server: FastifyInstance) {
  const svc = new OrganizationService();

  // ── Org Profile ───────────────────────────────────────────────────

  server.get(
    "/:orgId/profile",
    {
      preHandler: [requireAuth({ enforceOrg: true }), requirePermissions(ORBIT_PERMISSIONS.ORG_READ)],
      schema: { tags: ["organization"], summary: "Get organization Orbit profile" },
    },
    async (req) => {
      const { orgId } = req.params as { orgId: string };
      return svc.getOrCreateProfile(orgId);
    },
  );

  server.put(
    "/:orgId/profile",
    {
      preHandler: [requireAuth({ enforceOrg: true }), requirePermissions(ORBIT_PERMISSIONS.ORG_SETTINGS_WRITE)],
      schema: { tags: ["organization"], summary: "Update organization Orbit profile" },
    },
    async (req) => {
      const { orgId } = req.params as { orgId: string };
      const body = orgProfileSchema.parse(req.body);
      return svc.upsertProfile(orgId, body);
    },
  );

  // ── Branches ──────────────────────────────────────────────────────

  server.get(
    "/:orgId/branches",
    {
      preHandler: [requireAuth({ enforceOrg: true }), requirePermissions(ORBIT_PERMISSIONS.ORG_READ)],
      schema: { tags: ["organization"], summary: "List branches" },
    },
    async (req) => {
      const { orgId } = req.params as { orgId: string };
      return svc.listBranches(orgId);
    },
  );

  server.post(
    "/:orgId/branches",
    {
      preHandler: [requireAuth({ enforceOrg: true }), requirePermissions(ORBIT_PERMISSIONS.ORG_BRANCH_MANAGE)],
      schema: { tags: ["organization"], summary: "Create branch" },
    },
    async (req, reply) => {
      const { orgId } = req.params as { orgId: string };
      const body = branchSchema.parse(req.body);
      const branch = await svc.createBranch(orgId, body);
      return reply.status(201).send(branch);
    },
  );

  server.put(
    "/:orgId/branches/:branchId",
    {
      preHandler: [requireAuth({ enforceOrg: true }), requirePermissions(ORBIT_PERMISSIONS.ORG_BRANCH_MANAGE)],
      schema: { tags: ["organization"], summary: "Update branch" },
    },
    async (req) => {
      const { orgId, branchId } = req.params as { orgId: string; branchId: string };
      const body = branchSchema.partial().parse(req.body);
      return svc.updateBranch(orgId, branchId, body);
    },
  );

  server.delete(
    "/:orgId/branches/:branchId",
    {
      preHandler: [requireAuth({ enforceOrg: true }), requirePermissions(ORBIT_PERMISSIONS.ORG_BRANCH_MANAGE)],
      schema: { tags: ["organization"], summary: "Delete branch" },
    },
    async (req, reply) => {
      const { orgId, branchId } = req.params as { orgId: string; branchId: string };
      await svc.deleteBranch(orgId, branchId);
      return reply.status(204).send();
    },
  );
}
