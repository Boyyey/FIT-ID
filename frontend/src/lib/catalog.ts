import { getMerchantProductFeed } from "@/lib/merchant-integration";

export type CatalogGender = "male" | "female";

export type CatalogItem = {
  sku: string;
  merchant: "gap" | "levis";
  brand: string;
  title: string;
  category: "shirts" | "tshirts" | "pants" | "jackets" | "hoodies" | "formal";
  gender: CatalogGender;
  material: string;
  fitProfile: "slim" | "regular" | "relaxed" | "oversized";
  color: string;
  priceAed: number;
  imageUrl: string;
  productUrl: string;
};

export function buildCatalog(): CatalogItem[] {
  return getMerchantProductFeed();
}
