// River / valley shape definitions (pure math, shared by everything)
import { noise2, fbm2 } from './noise.js';

export const FALL_Z = -120;      // waterfall position (z)
export const FALL_H = 4.5;       // waterfall height
export const WL_SLOPE = 0.03;    // river gradient
export const Z_MIN = -215, Z_MAX = 175, X_HALF = 95;
export const WALK_MIN = FALL_Z + 13, WALK_MAX = 75;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

// River centre line (x as a function of z). Water flows toward +z.
export function riverCX(z) {
  let x = 7 * Math.sin(z * 0.032) + 3 * Math.sin(z * 0.011 + 1.3) + 1.2 * Math.sin(z * 0.09 + 0.5);
  if (z > 105) x += (z - 105) ** 2 * 0.02;      // bend away at both ends to hide the world edge
  if (z < -165) x -= (-165 - z) ** 2 * 0.02;
  return x;
}
export function riverSlope(z) { return (riverCX(z + 0.25) - riverCX(z - 0.25)) / 0.5; }

export function riverHW(z) {
  let w = 5.2 + 1.5 * Math.sin(z * 0.047 + 2.0) + 0.8 * Math.sin(z * 0.13 + 0.4);
  w *= 1 - 0.4 * Math.exp(-(((z - FALL_Z) / 5) ** 2));
  return Math.max(3.0, w);
}

export function fallStep(z) { return 1 - smoothstep(FALL_Z - 1.5, FALL_Z, z); }
export function waterLevel(z) { return -WL_SLOPE * z + FALL_H * fallStep(z); }

// 0 = riffle (瀬), 1 = pool (淵)
export function poolFactor(z) {
  let p = 0.5 + 0.5 * Math.sin(z * 0.075 + 0.7);
  p = p * p * (3 - 2 * p);
  p = Math.max(p, Math.exp(-(((z - (FALL_Z + 7)) / 6) ** 2))); // plunge pool (滝壺)
  if (z < FALL_Z) p *= 0.6;
  return p;
}
export function maxDepth(z) { return 0.35 + 1.55 * poolFactor(z); }
export function flowSpeed(z) {
  const hw = riverHW(z);
  return (0.5 + 1.25 * (1 - poolFactor(z))) * Math.sqrt(5.2 / hw);
}
export function flowDir(z) {
  const s = riverSlope(z);
  const l = Math.hypot(s, 1);
  return { x: s / l, z: 1 / l };
}
export function flowVelocity(x, z, out) {
  const cx = riverCX(z), hw = riverHW(z);
  const d = clamp((x - cx) / hw, -1, 1);
  const sp = flowSpeed(z) * (1 - 0.6 * d * d);
  const f = flowDir(z);
  out.x = f.x * sp; out.z = f.z * sp;
  return out;
}

// Width of the flat gravel bar (河原) on each bank
export function barWidth(z, left) {
  if (left) return Math.max(1.6, 3.4 + 2.0 * Math.sin(z * 0.032 + 0.4) + 1.0 * noise2(z * 0.04, 3.3));
  return Math.max(0.6, 1.4 + 1.2 * Math.sin(z * 0.032 + 3.5) + 0.6 * noise2(z * 0.05, 7.7));
}

export function terrainHeight(x, z) {
  const cx = riverCX(z), hw = riverHW(z), wl = waterLevel(z);
  const dx = x - cx, ad = Math.abs(dx), left = dx < 0;
  const fine = noise2(x * 0.35, z * 0.35);
  if (ad < hw) {
    const d = ad / hw;
    const prof = left ? (1 - d * d) : Math.pow(1 - d * d, 0.55);
    return wl - maxDepth(z) * prof * (0.85 + 0.15 * noise2(x * 0.08, z * 0.08)) - 0.02 + fine * 0.06;
  }
  const dd = ad - hw;
  const bw = barWidth(z, left);
  let h = wl - 0.02 + fine * 0.06 + Math.min(dd, bw) * 0.1;
  h += 0.15 * noise2(x * 0.15, z * 0.15) * smoothstep(0, 2, dd);
  if (dd > bw) {
    const s = dd - bw;
    const steep = left ? 1 : 1.25;
    h += 42 * (1 - Math.exp(-s * steep / 30)) + s * 0.22;
    h += fbm2(x * 0.025, z * 0.025, 4) * 14 * smoothstep(0, 15, s);
    h += fbm2(x * 0.12, z * 0.12, 2) * 1.2 * smoothstep(0, 4, s);
  }
  return h;
}

export function anglerPathX(z) { return riverCX(z) - riverHW(z) - 0.75; }
