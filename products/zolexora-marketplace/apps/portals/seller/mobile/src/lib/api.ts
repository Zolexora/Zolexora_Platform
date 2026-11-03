import {
  getApiClient,
  profile,
  products,
  sellerOrg,
  sellerCatalog,
  reels,
  orders,
  coins
} from "@zolexora/marketplace-shared-api";

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

export const reelsApi = {
  ...reels,
  uploadMedia: async (id: string, uri: string, type = "image/jpeg") => {
    const fd = new FormData();
    fd.append("file", { uri, name: type.startsWith("video") ? "video.mp4" : "image.jpg", type } as any);
    return api.post(`/reels/${id}/upload`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r: any) => r.data);
  },
};

export const ordersApi = orders;
export const coinsApi = coins;
