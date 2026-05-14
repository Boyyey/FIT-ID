import type { MerchantProduct } from "./types";

export type { MerchantCategory, MerchantGender, MerchantId, MerchantProduct } from "./types";
export { getMerchantProductFeed } from "./feed";

/** Shape partners can poll (e.g. FitID “merchant integration” demo). */
export function toPartnerCatalogPayload(products: MerchantProduct[]) {
  return products.map((p) => ({
    sku: p.sku,
    merchant: p.merchant,
    brand: p.brand,
    title: p.title,
    category: p.category,
    gender: p.gender,
    image_url: p.imageUrl,
    product_url: p.productUrl,
    price_aed: p.priceAed
  }));
}
