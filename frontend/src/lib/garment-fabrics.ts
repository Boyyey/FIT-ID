import { normalizeGarmentCategory } from "@/lib/avatar-utils";

export type FabricPackKey =
  | "jeans-blue"
  | "leather"
  | "black-fabric"
  | "white-fabric"
  | "stripe-like-fabric"
  | "wool";

type FabricPack = {
  key: FabricPackKey;
  color: string;
  normal: string;
  roughness: string;
  displacement: string;
};

const FABRIC_PACKS: Record<FabricPackKey, FabricPack> = {
  "jeans-blue": {
    key: "jeans-blue",
    color: "/textures/fabrics/jeans-blue/Fabric069_1K-JPG_Color.jpg",
    normal: "/textures/fabrics/jeans-blue/Fabric069_1K-JPG_NormalGL.jpg",
    roughness: "/textures/fabrics/jeans-blue/Fabric069_1K-JPG_Roughness.jpg",
    displacement: "/textures/fabrics/jeans-blue/Fabric069_1K-JPG_Displacement.jpg"
  },
  leather: {
    key: "leather",
    color: "/textures/fabrics/leather/Leather037_1K-JPG_Color.jpg",
    normal: "/textures/fabrics/leather/Leather037_1K-JPG_NormalGL.jpg",
    roughness: "/textures/fabrics/leather/Leather037_1K-JPG_Roughness.jpg",
    displacement: "/textures/fabrics/leather/Leather037_1K-JPG_Displacement.jpg"
  },
  "black-fabric": {
    key: "black-fabric",
    color: "/textures/fabrics/black-fabric/Fabric039_1K-JPG_Color.jpg",
    normal: "/textures/fabrics/black-fabric/Fabric039_1K-JPG_NormalGL.jpg",
    roughness: "/textures/fabrics/black-fabric/Fabric039_1K-JPG_Roughness.jpg",
    displacement: "/textures/fabrics/black-fabric/Fabric039_1K-JPG_Displacement.jpg"
  },
  "white-fabric": {
    key: "white-fabric",
    color: "/textures/fabrics/white-fabric/Fabric032_1K-JPG_Color.jpg",
    normal: "/textures/fabrics/white-fabric/Fabric032_1K-JPG_NormalGL.jpg",
    roughness: "/textures/fabrics/white-fabric/Fabric032_1K-JPG_Roughness.jpg",
    displacement: "/textures/fabrics/white-fabric/Fabric032_1K-JPG_Displacement.jpg"
  },
  "stripe-like-fabric": {
    key: "stripe-like-fabric",
    color: "/textures/fabrics/stripe-like-fabric/Fabric080_1K-JPG_Color.jpg",
    normal: "/textures/fabrics/stripe-like-fabric/Fabric080_1K-JPG_NormalGL.jpg",
    roughness: "/textures/fabrics/stripe-like-fabric/Fabric080_1K-JPG_Roughness.jpg",
    displacement: "/textures/fabrics/stripe-like-fabric/Fabric080_1K-JPG_Displacement.jpg"
  },
  wool: {
    key: "wool",
    color: "/textures/fabrics/wool/Carpet016_1K-JPG_Color.jpg",
    normal: "/textures/fabrics/wool/Carpet016_1K-JPG_NormalGL.jpg",
    roughness: "/textures/fabrics/wool/Carpet016_1K-JPG_Roughness.jpg",
    displacement: "/textures/fabrics/wool/Carpet016_1K-JPG_Displacement.jpg"
  }
};

/** Unique category->pack mapping so no fabric is reused across apparel types. */
const CATEGORY_PACK: Record<string, FabricPackKey> = {
  pants: "jeans-blue",
  jackets: "leather",
  hoodies: "wool",
  formal: "white-fabric",
  shirts: "stripe-like-fabric",
  tshirts: "black-fabric"
};

export function fabricPackForGarment(category: string): FabricPack {
  const cat = normalizeGarmentCategory(category);
  const key = CATEGORY_PACK[cat] ?? "white-fabric";
  return FABRIC_PACKS[key];
}

