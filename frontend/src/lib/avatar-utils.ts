/** Normalize profile `body_measurements` for the parametric 3D avatar (free, on-device). */

export type AvatarMeasurements = {
  height_cm: number;
  weight_kg: number;
  shoulder_width_cm: number;
  chest_cm: number;
  waist_cm: number;
  hip_cm: number;
  inseam_cm: number;
  torso_length_cm: number;
  avatar_model?: {
    model_type?: string;
    model_url?: string;
    scale?: { shoulders?: number; torso?: number; hips?: number };
  };
};

const DEF: AvatarMeasurements = {
  height_cm: 175,
  weight_kg: 72,
  shoulder_width_cm: 42,
  chest_cm: 96,
  waist_cm: 82,
  hip_cm: 98,
  inseam_cm: 81,
  torso_length_cm: 56
};

export function measurementsFromProfile(body: Record<string, unknown> | null | undefined): AvatarMeasurements {
  if (!body || typeof body !== "object") return { ...DEF };
  const n = (k: string, fallback: number) => {
    const v = body[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const p = Number(v);
      if (Number.isFinite(p)) return p;
    }
    return fallback;
  };
  const base = {
    height_cm: n("height_cm", DEF.height_cm),
    weight_kg: n("weight_kg", DEF.weight_kg),
    shoulder_width_cm: n("shoulder_width_cm", DEF.shoulder_width_cm),
    chest_cm: n("chest_cm", DEF.chest_cm),
    waist_cm: n("waist_cm", DEF.waist_cm),
    hip_cm: n("hip_cm", DEF.hip_cm),
    inseam_cm: n("inseam_cm", DEF.inseam_cm),
    torso_length_cm: n("torso_length_cm", DEF.torso_length_cm)
  };
  const am = body.avatar_model;
  if (am && typeof am === "object" && am !== null) {
    return {
      ...base,
      avatar_model: {
        model_type: typeof (am as { model_type?: string }).model_type === "string" ? (am as { model_type?: string }).model_type : undefined,
        model_url:
          typeof (am as { model_url?: string }).model_url === "string"
            ? (am as { model_url?: string }).model_url
            : typeof (am as { obj_url?: string }).obj_url === "string"
              ? (am as { obj_url?: string }).obj_url
              : typeof (am as { url?: string }).url === "string"
                ? (am as { url?: string }).url
                : undefined,
        scale:
          (am as { scale?: { shoulders?: number; torso?: number; hips?: number } }).scale &&
          typeof (am as { scale?: unknown }).scale === "object"
            ? (am as { scale: { shoulders?: number; torso?: number; hips?: number } }).scale
            : undefined
      }
    };
  }
  return { ...base };
}

export function skinToneFromProfile(skin_tone: string | null | undefined): string {
  if (skin_tone && /^#[0-9A-Fa-f]{6}$/.test(skin_tone)) return skin_tone;
  return "#c9a689";
}

/** Map catalog color names to garment hex (try-on overlay). */
export function garmentColorHex(colorName: string | undefined): string {
  const c = (colorName ?? "grey").toLowerCase();
  const map: Record<string, string> = {
    navy: "#1e3a5f",
    black: "#1a1a1a",
    white: "#e8e8e8",
    grey: "#6b7280",
    gray: "#6b7280",
    blue: "#2563eb",
    olive: "#4d5c2e",
    beige: "#d4c4a8",
    denim: "#3d4f6f",
    red: "#b91c1c",
    green: "#15803d"
  };
  return map[c] ?? "#64748b";
}

export function normalizeGarmentCategory(raw: string | undefined): string {
  const s = (raw ?? "shirts").toLowerCase();
  if (["tshirts", "tshirt", "tee"].includes(s)) return "tshirts";
  if (s === "shirt" || s === "shirts") return "shirts";
  if (s === "pants" || s === "jeans") return "pants";
  if (s === "jackets" || s === "jacket") return "jackets";
  if (s === "hoodies" || s === "hoodie") return "hoodies";
  if (s === "formal") return "formal";
  return "shirts";
}

export function avatarMeshUrlFromProfile(body: Record<string, unknown> | null | undefined): string {
  const fallback = "/models/human/FinalBaseMesh.obj";
  if (!body || typeof body !== "object") return fallback;
  const am = body.avatar_model;
  if (!am || typeof am !== "object") return fallback;
  const modelUrl = (am as { model_url?: unknown; obj_url?: unknown; url?: unknown }).model_url
    ?? (am as { obj_url?: unknown }).obj_url
    ?? (am as { url?: unknown }).url;
  if (typeof modelUrl === "string" && modelUrl.trim().length > 0) return modelUrl;
  const modelType = (am as { model_type?: unknown }).model_type;
  if (typeof modelType === "string") {
    const t = modelType.toLowerCase();
    if (t.includes("male")) return "/models/human/Male.obj";
    if (t.includes("final") || t.includes("base")) return "/models/human/FinalBaseMesh.obj";
  }
  return fallback;
}
