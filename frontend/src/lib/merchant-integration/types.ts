export type MerchantId = "gap" | "levis";

export type MerchantGender = "male" | "female";

export type MerchantCategory = "shirts" | "tshirts" | "pants" | "jackets" | "hoodies" | "formal";

export type MerchantProduct = {
  sku: string;
  merchant: MerchantId;
  brand: string;
  title: string;
  category: MerchantCategory;
  gender: MerchantGender;
  material: string;
  fitProfile: "slim" | "regular" | "relaxed" | "oversized";
  color: string;
  priceAed: number;
  /** Direct product photography from the merchant CDN (same SKU as the storefront). */
  imageUrl: string;
  /** Canonical PDP or search URL on the merchant’s own site. */
  productUrl: string;
};
