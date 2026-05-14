/**
 * Procedural fabric maps for try-on (no external assets).
 * Each preset differs in scale/pattern so categories read visually distinct.
 */

import * as THREE from "three";

export type FabricPresetId = "jersey" | "knit_hoodie" | "denim" | "woven_jacket" | "dress_shirt";

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, cw: number, ch: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) {
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Fine knit / tee — tight irregular loops */
export function makeJerseyTexture(): THREE.CanvasTexture {
  return canvasTexture(320, 320, (ctx, cw, ch) => {
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = "rgba(0,0,0,0.045)";
    ctx.lineWidth = 1;
    const step = 6;
    for (let y = 0; y < ch; y += step) {
      for (let x = 0; x < cw; x += step) {
        const ox = (y / step) % 2 ? step / 2 : 0;
        ctx.strokeRect(x + ox, y, step - 1, step - 1);
      }
    }
  });
}

/** Hoodie weight — larger waffle / fleece loops */
export function makeKnitHoodieTexture(): THREE.CanvasTexture {
  return canvasTexture(384, 384, (ctx, cw, ch) => {
    ctx.fillStyle = "#ececec";
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1.5;
    const gx = 14;
    const gy = 12;
    for (let y = 0; y < ch; y += gy) {
      for (let x = 0; x < cw; x += gx) {
        ctx.beginPath();
        ctx.arc(x + gx * 0.5, y + gy * 0.45, gx * 0.38, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    for (let i = 0; i < 800; i++) {
      ctx.fillRect(Math.random() * cw, Math.random() * ch, 1, 1);
    }
  });
}

/** Denim-style diagonal rib */
export function makeDenimTexture(): THREE.CanvasTexture {
  return canvasTexture(384, 384, (ctx, cw, ch) => {
    ctx.fillStyle = "#d8dce4";
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = "rgba(30,40,60,0.12)";
    ctx.lineWidth = 1;
    for (let i = -ch; i < cw + ch; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + ch * 0.55, ch);
      ctx.stroke();
    }
    /* Avoid light “weft” strokes — under directional lights they read as vertical specular streaks. */
    ctx.strokeStyle = "rgba(45,55,75,0.04)";
    for (let i = -ch; i < cw + ch; i += 11) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + ch * 0.52, ch);
      ctx.stroke();
    }
  });
}

/** Jacket shell — tight cross weave + slight variation */
export function makeWovenJacketTexture(): THREE.CanvasTexture {
  return canvasTexture(320, 320, (ctx, cw, ch) => {
    ctx.fillStyle = "#e8e8ea";
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = "rgba(0,0,0,0.065)";
    ctx.lineWidth = 1;
    for (let x = 0; x < cw; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = 0; y < ch; y += 5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }
  });
}

/** Formal shirt — very fine pinstripe grid */
export function makeDressShirtTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, cw, ch) => {
    ctx.fillStyle = "#f8f8fa";
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = "rgba(0,0,0,0.028)";
    ctx.lineWidth = 1;
    for (let x = 0; x < cw; x += 3) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = 0; y < ch; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }
  });
}

export function presetForGarment(category: string, title?: string): FabricPresetId {
  const t = (title ?? "").toLowerCase();
  if (t.includes("hoodie") || t.includes("hoody")) return "knit_hoodie";
  const c = category.toLowerCase();
  if (c === "pants") return "denim";
  if (c === "hoodies") return "knit_hoodie";
  if (c === "jackets") return "woven_jacket";
  if (c === "formal") return "dress_shirt";
  return "jersey";
}

export function createFabricMaterial(preset: FabricPresetId): {
  map: THREE.CanvasTexture;
  roughness: number;
  metalness: number;
  repeat: [number, number];
} {
  let map: THREE.CanvasTexture;
  let roughness = 0.82;
  let metalness = 0.02;
  let repeat: [number, number] = [5, 5];

  switch (preset) {
    case "jersey":
      map = makeJerseyTexture();
      roughness = 0.88;
      repeat = [12, 12];
      break;
    case "knit_hoodie":
      map = makeKnitHoodieTexture();
      roughness = 0.92;
      repeat = [6, 7];
      break;
    case "denim":
      map = makeDenimTexture();
      roughness = 0.94;
      metalness = 0;
      repeat = [8, 9];
      break;
    case "woven_jacket":
      map = makeWovenJacketTexture();
      roughness = 0.9;
      metalness = 0;
      repeat = [10, 10];
      break;
    case "dress_shirt":
      map = makeDressShirtTexture();
      roughness = 0.9;
      metalness = 0;
      repeat = [18, 18];
      break;
    default:
      map = makeJerseyTexture();
      repeat = [12, 12];
      break;
  }

  map.repeat.set(repeat[0], repeat[1]);
  map.needsUpdate = true;

  return { map, roughness, metalness, repeat };
}
