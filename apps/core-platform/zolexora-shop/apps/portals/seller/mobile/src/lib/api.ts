import {
  getApiClient,
  profile,
  products,
  sellerOrg,
  sellerCatalog,
  orders,
} from "@zolexora/shop-shared-api";

/** Resolved per call: configureApi runs in app/_layout.tsx with values from Infisical. */
const api = { post: (...args: Parameters<ReturnType<typeof getApiClient>["post"]>) => getApiClient().post(...args) };

export const authApi = profile;

export const productsApi = {
  ...products,
  uploadImage: async (id: string, uri: string) => {
    const fd = new FormData();
    fd.append("file", { uri, name: "image.jpg", type: "image/jpeg" } as any);
    return api.post(`/products/${id}/upload-image`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r: any) => r.data);
  },
};

export const sellerOrgApi = sellerOrg;
export const sellerCatalogApi = sellerCatalog;

export const ordersApi = orders;
