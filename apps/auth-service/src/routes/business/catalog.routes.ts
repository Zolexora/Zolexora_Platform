import { timingSafeEqual } from "node:crypto";
import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { createAuthMiddleware } from "../../middleware/auth.middleware.js";
import { AppError } from "../../plugins/error-handler.js";
import { COMMON_PERMISSIONS, ORG_PERMISSIONS, isPermissionKey, permissionPrefix } from "../../rbac/permissions.js";
import { audit, badRequest, BusinessDeps, denied, notFound, parse } from "./context.js";

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Permission catalog (ADR 0005 §2): products register their keys; removals wait for a platform admin. */
export async function catalogRoutes(app: FastifyInstance, d: BusinessDeps) {
  const authenticate = createAuthMiddleware({ tokenService: d.tokens, repo: d.repo });
  const adminOnly = (req: FastifyRequest) => {
    if (!req.user?.is_platform_admin) throw denied("Platform admins only.");
    return `admin:${req.user.uid}`;
  };

  /** Called by each product on deploy with its full list, using its own key (X-Product-Key). */
  app.put<{ Params: { product: string } }>("/api/v1/catalog/:product", async (req, reply) => {
    const product = req.params.product;
    const secret = d.productKeys[product];
    const given = req.headers["x-product-key"];
    if (!secret || typeof given !== "string" || !sameSecret(given, secret)) {
      throw new AppError({ statusCode: 401, code: "CATALOG_UNAUTHORIZED", message: "Unknown product or wrong product key." });
    }
    const { permissions } = parse(z.object({
      permissions: z.array(z.object({ key: z.string(), description: z.string().trim().min(1).max(200) }).strict()).max(1000),
    }).strict(), req.body);
    const seen = new Set<string>();
    for (const p of permissions) {
      if (!isPermissionKey(p.key) || permissionPrefix(p.key) !== product) {
        throw badRequest(`${p.key}: keys must look like ${product}:<area>:<action>.`, "CATALOG_BAD_KEY");
      }
      if (seen.has(p.key)) throw badRequest(`${p.key} is listed twice.`, "CATALOG_BAD_KEY");
      seen.add(p.key);
    }
    const v = await d.catalog.register(product, permissions);
    await audit(d, req, `product:${product}`, "catalog.registered", v.id, { version: v.version, added: v.added, removed: v.removed });
    return reply.status(v.status === "applied" ? 200 : 202).send({
      success: true,
      version: v.version,
      status: v.status,
      added: v.added,
      pending_removal: v.removed, // still live until a platform admin approves
    });
  });

  /** Everything a role editor can pick from. */
  app.get<{ Querystring: { product?: string } }>("/api/v1/catalog", { preHandler: [authenticate] }, async (req) => {
    const product = typeof req.query.product === "string" ? req.query.product : undefined;
    return {
      success: true,
      org: Object.entries(ORG_PERMISSIONS).map(([key, description]) => ({ key, description })),
      common: Object.entries(COMMON_PERMISSIONS).map(([key, description]) => ({ key, description })),
      products: await d.catalog.list(product),
    };
  });

  app.get<{ Querystring: { product?: string; status?: string } }>("/api/v1/admin/catalog/versions", { preHandler: [authenticate] }, async (req) => {
    adminOnly(req);
    return { success: true, versions: await d.catalog.listVersions(req.query.product, req.query.status) };
  });

  for (const action of ["approve", "reject"] as const) {
    app.post<{ Params: { id: string } }>(`/api/v1/admin/catalog/versions/:id/${action}`, { preHandler: [authenticate] }, async (req) => {
      const by = adminOnly(req);
      const v = await d.catalog.decide(req.params.id, action === "approve", by);
      if (!v) throw notFound("No pending change with that id.");
      await audit(d, req, by, `catalog.${action}d`, v.id, { product: v.product, version: v.version, removed: v.removed });
      return { success: true, version: v };
    });
  }

  /** Roll back = register that version's list again (removals in it wait for approval as usual). */
  app.post<{ Params: { id: string } }>("/api/v1/admin/catalog/versions/:id/rollback", { preHandler: [authenticate] }, async (req) => {
    const by = adminOnly(req);
    const old = await d.catalog.getVersion(req.params.id);
    if (!old) throw notFound("Version not found.");
    const v = await d.catalog.register(old.product, old.permissions, by);
    await audit(d, req, by, "catalog.rolled_back", v.id, { product: v.product, to_version: old.version, new_version: v.version });
    return { success: true, version: v };
  });
}
