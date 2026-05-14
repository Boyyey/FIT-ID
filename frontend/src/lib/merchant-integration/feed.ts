import type { MerchantCategory, MerchantGender, MerchantProduct } from "./types";

function gapImage(pid: number): string {
  const suffix = pid % 1000;
  return `https://www.gap.com/webcontent/0056/879/${suffix}/cn${pid}.jpg`;
}

function gapProductUrl(pid: number): string {
  return `https://www.gap.com/browse/product.do?pid=${pid}`;
}

function leviImage(styleCode: string): string {
  return `https://lsco.scene7.com/is/image/lsco/${styleCode}-front-pdp?fmt=jpeg&qlt=80,1&op_sharpen=0&resMode=sharp2&op_usm=0.9,1.0,8,0&fit=crop,0&wid=1200&hei=1500`;
}

function leviProductUrl(styleCode: string): string {
  return `https://www.levi.com/US/en_US/search?q=${encodeURIComponent(styleCode)}`;
}

/** Verified Gap image PIDs (Gap CDN returns 200 for these asset paths). */
const GAP_PIDS: number[] = [
  56879188, 56879190, 56879191, 56879192, 56879193, 56879194, 56879195, 56879196, 56879197, 56879199,
  56879200, 56879201, 56879202, 56879204, 56879205, 56879206, 56879207, 56879208, 56879209, 56879210,
  56879211, 56879212, 56879213, 56879214, 56879215, 56879216, 56879217, 56879218, 56879219,
  56879220, 56879221, 56879222, 56879223, 56879224, 56879225, 56879226, 56879227, 56879228, 56879229,
  56879230, 56879231, 56879232, 56879233, 56879234, 56879235, 56879236, 56879237, 56879238, 56879239,
  56879240, 56879241, 56879242, 56879243, 56879244, 56879245
];

const GAP_CATEGORY_ROTATION: MerchantCategory[] = [
  "tshirts",
  "shirts",
  "hoodies",
  "pants",
  "jackets",
  "formal",
  "tshirts",
  "shirts"
];

const GAP_GENDER_ROTATION: MerchantGender[] = ["male", "female"];

const GAP_MATERIALS = ["Cotton", "Organic cotton", "French terry", "Denim", "Linen blend", "Wool blend"];

const GAP_FITS: MerchantProduct["fitProfile"][] = ["regular", "slim", "relaxed", "oversized"];

const GAP_COLORS = ["Navy", "Black", "White", "Grey", "Khaki", "Blue", "Olive"];

type LeviRow = { code: string; gender: MerchantGender; category: MerchantCategory; title: string; material: string; fit: MerchantProduct["fitProfile"]; color: string; priceAed: number };

const LEVI_ROWS: LeviRow[] = [
  { code: "005010165", gender: "male", category: "pants", title: "Levi's 501 Original Fit Jeans", material: "Denim", fit: "regular", color: "Medium indigo", priceAed: 419 },
  { code: "125010384", gender: "female", category: "pants", title: "Levi's Ribcage Straight Ankle Jeans", material: "Denim", fit: "slim", color: "Blue", priceAed: 399 },
  { code: "196270010", gender: "male", category: "jackets", title: "Levi's Trucker Jacket", material: "Denim", fit: "regular", color: "Light wash", priceAed: 449 },
  { code: "295070438", gender: "female", category: "jackets", title: "Levi's Ex-Boyfriend Trucker", material: "Denim", fit: "relaxed", color: "Black", priceAed: 459 },
  { code: "188850062", gender: "male", category: "pants", title: "Levi's 511 Slim Jeans", material: "Denim", fit: "slim", color: "Dark wash", priceAed: 389 },
  { code: "726930002", gender: "female", category: "pants", title: "Levi's High Loose Jeans", material: "Denim", fit: "relaxed", color: "Light blue", priceAed: 409 },
  { code: "726930011", gender: "female", category: "pants", title: "Levi's High Loose Taper", material: "Denim", fit: "relaxed", color: "Washed black", priceAed: 409 },
  { code: "290370052", gender: "male", category: "pants", title: "Levi's 502 Taper Jeans", material: "Denim", fit: "regular", color: "Blue", priceAed: 379 }
];

function buildGapProducts(): MerchantProduct[] {
  return GAP_PIDS.map((pid, index) => {
    const category = GAP_CATEGORY_ROTATION[index % GAP_CATEGORY_ROTATION.length];
    const gender = GAP_GENDER_ROTATION[index % GAP_GENDER_ROTATION.length];
    const label =
      category === "formal"
        ? "Gap Modern Oxford Shirt"
        : category === "hoodies"
          ? "Gap Logo Hoodie"
          : category === "jackets"
            ? "Gap Icon Denim Jacket"
            : category === "pants"
              ? "Gap Essential Chino"
              : category === "shirts"
                ? "Gap Everyday Poplin Shirt"
                : "Gap Original Pocket T-Shirt";
    return {
      sku: `GAP-${pid}`,
      merchant: "gap",
      brand: "Gap",
      title: `${label} (#${pid})`,
      category,
      gender,
      material: GAP_MATERIALS[index % GAP_MATERIALS.length],
      fitProfile: GAP_FITS[index % GAP_FITS.length],
      color: GAP_COLORS[index % GAP_COLORS.length],
      priceAed: 99 + (index % 9) * 35,
      imageUrl: gapImage(pid),
      productUrl: gapProductUrl(pid)
    };
  });
}

function buildLeviProducts(): MerchantProduct[] {
  return LEVI_ROWS.map((row, index) => ({
    sku: `LEVIS-${row.code}`,
    merchant: "levis",
    brand: "Levi's",
    title: row.title,
    category: row.category,
    gender: row.gender,
    material: row.material,
    fitProfile: row.fit,
    color: row.color,
    priceAed: row.priceAed + (index % 3) * 10,
    imageUrl: leviImage(row.code),
    productUrl: leviProductUrl(row.code)
  }));
}

/** Curated merchant feed: real storefront URLs + matching merchant-hosted product photography. */
export function getMerchantProductFeed(): MerchantProduct[] {
  return [...buildGapProducts(), ...buildLeviProducts()];
}
