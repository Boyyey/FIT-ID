export const JOURNEY_STAGES = [
  "Sign In",
  "60s Body Scan",
  "3D Avatar",
  "Sensitivity Profile",
  "FitID Creation",
  "Partner Sign-In",
  "Virtual Try-On",
  "Smart Recommendations"
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export const ALLERGY_OPTIONS = [
  "Polyester",
  "Nylon",
  "Latex",
  "Wool",
  "Silk",
  "Cotton dyes",
  "Nickel (zippers)",
  "Spandex",
  "Leather",
  "Rayon"
];
