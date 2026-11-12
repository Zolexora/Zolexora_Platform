import {
  getApiClient,
  profile,
  products,
  sellerOrg,
  sellerCatalog,
  orders,
  admin,
} from "@zolexora/shop-shared-api";

export const api = {
  get: (...args: Parameters<ReturnType<typeof getApiClient>["get"]>) => getApiClient().get(...args),
  post: (...args: Parameters<ReturnType<typeof getApiClient>["post"]>) => getApiClient().post(...args),
  put: (...args: Parameters<ReturnType<typeof getApiClient>["put"]>) => getApiClient().put(...args),
  delete: (...args: Parameters<ReturnType<typeof getApiClient>["delete"]>) => getApiClient().delete(...args),
};

/** Marketplace profile + seller checks. Sign-in itself is the Zolexora auth service. */
export const authApi = {
  ...profile,
  verifyGstin: (gstin: string) => api.get(`/seller/verification/gst/${encodeURIComponent(gstin)}`).then((r: any) => r.data),
};

export const productsApi = {
  ...products,
  bulkCreate: (data: any[]) => api.post("/products/bulk", data).then((r: any) => r.data),
};

export const sellerOrgApi = sellerOrg;
export const sellerCatalogApi = sellerCatalog;

export const ordersApi = orders;

export const analyticsApi = {
  stats: () => admin.stats(),
};
