// Terrain, rocks and vegetation
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as W from './world.js';
import { noise2, mulberry32 } from './noise.js';
import { patchMaterial } from './shared.js';

const lc = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const arr = (c) => [c.r, c.g, c.b];
const mixA = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const SEASONS = {
  spring: {
    label: '新緑',
    grass: [0.45, 0.56, 0.22],
    broad: [[0.52, 0.7, 0.26], [0.44, 0.62, 0.21], [0.6, 0.74, 0.33], [0.38, 0.55, 0.19], [0.66, 0.76, 0.4]],
    leaf: [[0.45, 0.62, 0.25], [0.55, 0.6, 0.3]],
  },
  summer: {
    label: '盛夏',
    grass: [0.3, 0.42, 0.15],
    broad: [[0.21, 0.37, 0.12], [0.25, 0.43, 0.15], [0.18, 0.31, 0.1], [0.29, 0.45, 0.17]],
    leaf: [[0.3, 0.42, 0.15], [0.45, 0.4, 0.2]],
  },
  autumn: {
    label: '紅葉',
    grass: [0.52, 0.46, 0.24],
    broad: [[0.8, 0.27, 0.08], [0.9, 0.56, 0.12], [0.66, 0.17, 0.07], [0.82, 0.7, 0.2], [0.34, 0.4, 0.15], [0.92, 0.42, 0.1]],
    leaf: [[0.85, 0.3, 0.08], [0.92, 0.6, 0.12], [0.7, 0.2, 0.08], [0.8, 0.7, 0.25]],
  },
};

const C = {
  gravelA: arr(lc(0.66, 0.64, 0.59)), gravelB: arr(lc(0.5, 0.48, 0.44)), sand: arr(lc(0.72, 0.66, 0.53)),
  bed: arr(lc(0.5, 0.45, 0.36)), algae: arr(lc(0.36, 0.36, 0.22)),
  forest: arr(lc(0.27, 0.27, 0.15)), moss: arr(lc(0.24, 0.35, 0.13)),
  rockA: arr(lc(0.46, 0.45, 0.42)), rockB: arr(lc(0.34, 0.34, 0.32)),
};

let _detail = null;
export function detailTexture() {
  if (_detail) return _detail;
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = 'rgb(205,205,205)'; x.fillRect(0, 0, S, S);
  const rnd = mulberry32(99);
  for (let i = 0; i < 5200; i++) {
    const px = rnd() * S, py = rnd() * S, r = 2 + rnd() * rnd() * 13;
    const v = (165 + rnd() * 90) | 0;
    x.fillStyle = `rgb(${v},${v},${v})`;
    const ry = r * (0.6 + rnd() * 0.4), rot = rnd() * Math.PI;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      if (px + ox < -r || px + ox > S + r || py + oy < -r || py + oy > S + r) continue;
      x.beginPath(); x.ellipse(px + ox, py + oy, r, ry, rot, 0, Math.PI * 2); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  _detail = t;
  return t;
}

// ---------------------------------------------------------------- terrain
export function buildTerrain(season) {
  const step = 1;
  const nx = Math.round((2 * W.X_HALF) / step) + 1;
  const nz = Math.round((W.Z_MAX - W.Z_MIN) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  const uv = new Float32Array(nx * nz * 2);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      const x = -W.X_HALF + ix * step, z = W.Z_MIN + iz * step;
      pos[i * 3] = x; pos[i * 3 + 1] = W.terrainHeight(x, z); pos[i * 3 + 2] = z;
      uv[i * 2] = x * 0.5; uv[i * 2 + 1] = z * 0.5;
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let k = 0;
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b;
      idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nx * nz * 3), 3));

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTexture(), roughness: 0.95, metalness: 0 });
  patchMaterial(mat, { underwater: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;

  function recolor(seasonKey) {
    const S = SEASONS[seasonKey];
    const grass = arr(lc(...S.grass));
    const col = geo.attributes.color.array, nrm = geo.attributes.normal.array;
    for (let i = 0; i < nx * nz; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const ny = nrm[i * 3 + 1];
      const cx = W.riverCX(z), hw = W.riverHW(z), wl = W.waterLevel(z);
      const dx = x - cx, dd = Math.abs(dx) - hw, left = dx < 0;
      const bw = W.barWidth(z, left);
      const n1 = noise2(x * 0.3, z * 0.3), n2 = noise2(x * 0.07 + 5, z * 0.07 - 3), n3 = noise2(x * 1.3, z * 1.3);
      let g = mixA(C.gravelA, C.gravelB, 0.5 + 0.5 * n1);
      g = mixA(g, C.sand, W.smoothstep(0.3, 0.7, n2) * 0.5);
      if (y < wl + 0.04) { g = mixA(g, C.bed, 0.5); g = mixA(g, C.algae, 0.35 * (0.5 + 0.5 * n2)); }
      const vegT = W.smoothstep(bw - 0.3 + n1 * 0.6, bw + 1.4, dd);
      let v = mixA(grass, C.forest, W.smoothstep(bw + 2, bw + 14, dd + n2 * 4));
      v = mixA(v, C.moss, 0.3 * (0.5 + 0.5 * n3));
      let c = mixA(g, v, vegT);
      const vegPatch = W.smoothstep(-0.1, 0.4, noise2(x * 0.09 + 11, z * 0.05 + y * 0.08));
      const rockT = W.smoothstep(0.62, 0.42, ny + n3 * 0.05) * (1 - 0.65 * vegPatch * vegT);
      c = mixA(c, mixA(C.rockA, C.rockB, 0.5 + 0.5 * n1), rockT);
      const b = 0.9 + 0.1 * n3;
      col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
    }
    geo.attributes.color.needsUpdate = true;
  }
  recolor(season);
  return { mesh, recolor };
}

// ---------------------------------------------------------------- rocks
function rockGeometry(seed) {
  let g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const sy = 0.7 + (seed % 3) * 0.08;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let r = 1 + 0.22 * noise2(v.x * 1.3 + seed * 7.1, v.y * 1.3 + v.z * 0.9 + seed)
      + 0.08 * noise2(v.x * 3.1 - seed, v.z * 3.1 + v.y * 2.0);
    v.multiplyScalar(r);
    v.y *= sy;
    if (v.y > 0.5 * sy) v.y = 0.5 * sy + (v.y - 0.5 * sy) * 0.6; // slightly flattened top
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  const base = seed % 2 === 0 ? [0.56, 0.55, 0.51] : [0.47, 0.46, 0.44];
  const moss = arr(lc(0.3, 0.38, 0.14));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const sp = noise2(x * 9 + seed, z * 9 + y * 5) * 0.5 + 0.5;
    const b = 0.78 + 0.22 * sp + 0.08 * noise2(x * 2 + seed, y * 2 + z);
    let c = arr(lc(base[0] * b, base[1] * b, base[2] * b));
    const mt = W.smoothstep(0.5, 0.85, n.getY(i)) * W.smoothstep(-0.3, 0.3, noise2(x * 2.5 + seed, z * 2.5)) * 0.75;
    c = mixA(c, moss, mt);
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function buildRocks() {
  const rng = mulberry32(2024);
  const NV = 8;
  const variants = [];
  for (let v = 0; v < NV; v++) variants.push(rockGeometry(v + 1));
  const list = [];
  const onPath = (x, z, r) => z > W.WALK_MIN - 3 && z < W.WALK_MAX + 3 && Math.abs(x - W.anglerPathX(z)) < r * 1.25 + 0.7;
  const place = (x, z, r, inRiver) => {
    if (onPath(x, z, r)) return;
    const bed = W.terrainHeight(x, z);
    const sy = 0.6 + rng() * 0.35;
    const y = bed - r * sy * 0.2;
    list.push({ x, z, y, r, sy, top: y + r * sy * 0.55, v: (rng() * NV) | 0, rot: rng() * 6.28,
      sx: 0.85 + rng() * 0.35, sz: 0.85 + rng() * 0.35, inRiver });
  };
  for (let i = 0; i < 120; i++) {
    const z = W.lerp(W.Z_MIN + 10, W.Z_MAX - 20, rng());
    const s = (rng() * 2 - 1) * 0.95;
    const x = W.riverCX(z) + s * W.riverHW(z);
    place(x, z, 0.3 + 1.3 * rng() ** 1.7, true);
  }
  // waterfall rocks
  for (let i = 0; i < 12; i++) {
    const z = W.FALL_Z + (rng() * 2 - 1) * 2.5;
    const side = rng() < 0.5 ? -1 : 1;
    const x = W.riverCX(z) + side * W.riverHW(z) * (0.85 + rng() * 0.9);
    place(x, z, 1.2 + rng() * 1.6, false);
  }
  for (let i = 0; i < 7; i++) {
    const z = W.FALL_Z + 5 + rng() * 10;
    const side = rng() < 0.5 ? -1 : 1;
    const x = W.riverCX(z) + side * W.riverHW(z) * (0.6 + rng() * 0.4);
    place(x, z, 0.8 + rng() * 1.2, true);
  }
  // bank rocks
  for (let i = 0; i < 230; i++) {
    const z = W.lerp(W.Z_MIN + 5, W.Z_MAX - 10, rng());
    const left = rng() < 0.5;
    const dd = rng() * (W.barWidth(z, left) + 9);
    const x = W.riverCX(z) + (left ? -1 : 1) * (W.riverHW(z) + dd);
    place(x, z, 0.25 + 1.7 * rng() ** 2.2, false);
  }

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  patchMaterial(mat, { underwater: true });
  const meshes = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  for (let v = 0; v < NV; v++) {
    const items = list.filter((r) => r.v === v);
    if (!items.length) continue;
    const im = new THREE.InstancedMesh(variants[v], mat, items.length);
    items.forEach((r, i) => {
      e.set((rng() - 0.5) * 0.15, r.rot, (rng() - 0.5) * 0.15);
      q.setFromEuler(e);
      sc.set(r.r * r.sx, r.r * r.sy / 0.75, r.r * r.sz);
      ps.set(r.x, r.y, r.z);
      m4.compose(ps, q, sc);
      im.setMatrixAt(i, m4);
    });
    im.castShadow = true; im.receiveShadow = true;
    meshes.push(im);
  }
  return { meshes, list };
}

// ---------------------------------------------------------------- vegetation
function colorize(geo, fn) {
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = fn(p.getX(i), p.getY(i), p.getZ(i));
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function jitter(geo, amt, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i,
      x + noise2(x * 3 + seed, y * 3) * amt,
      y + noise2(y * 3 + seed, z * 3) * amt * 0.6,
      z + noise2(z * 3 - seed, x * 3) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}

function cedarGeometry() {
  const parts = [];
  const trunkC = arr(lc(0.33, 0.22, 0.15));
  const trunk = new THREE.CylinderGeometry(0.13, 0.3, 7, 7); trunk.translate(0, 3.5, 0);
  parts.push(colorize(trunk, () => trunkC));
  const layers = 7;
  for (let k = 0; k < layers; k++) {
    const r = 2.5 * (1 - k / (layers + 0.6));
    const cone = new THREE.ConeGeometry(r, 3.6, 9, 2);
    cone.translate(0, 4.6 + k * 1.75, 0);
    jitter(cone, 0.28, k * 3.1);
    parts.push(colorize(cone, (x, y, z) => {
      const rr = Math.hypot(x, z) / Math.max(0.3, r);
      const sh = 0.55 + 0.45 * Math.min(1, rr) + 0.08 * noise2(x * 2, y * 2 + z);
      return arr(lc(0.14 * sh, 0.24 * sh, 0.12 * sh));
    }));
  }
  return mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
}

function broadGeometry() {
  const parts = [];
  const trunkC = arr(lc(0.42, 0.36, 0.3));
  const trunk = new THREE.CylinderGeometry(0.12, 0.26, 5.5, 6); trunk.translate(0, 2.75, 0);
  parts.push(colorize(trunk, () => trunkC));
  const rnd = mulberry32(5);
  for (let k = 0; k < 7; k++) {
    const r = 1.4 + rnd() * 1.1;
    const s = new THREE.IcosahedronGeometry(r, 1);
    const a = rnd() * Math.PI * 2, d = k === 0 ? 0 : 1.2 + rnd() * 1.3;
    s.translate(Math.cos(a) * d, 5.2 + rnd() * 2.6 + (k === 0 ? 1.2 : 0), Math.sin(a) * d);
    jitter(s, 0.35, k * 1.7);
    parts.push(colorize(s, (x, y, z) => {
      const sh = 0.6 + 0.4 * W.smoothstep(4.0, 9.0, y) + 0.1 * noise2(x * 2, z * 2 + y);
      return [sh, sh, sh];
    }));
  }
  return mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
}

function shrubGeometry() {
  const parts = [];
  const rnd = mulberry32(17);
  for (let k = 0; k < 4; k++) {
    const s = new THREE.IcosahedronGeometry(0.45 + rnd() * 0.3, 1);
    s.translate((rnd() - 0.5) * 0.8, 0.35 + rnd() * 0.3, (rnd() - 0.5) * 0.8);
    jitter(s, 0.12, k);
    parts.push(colorize(s, (x, y) => { const sh = 0.55 + 0.45 * W.smoothstep(0, 1, y); return [sh, sh, sh]; }));
  }
  return mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
}

function grassTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  const rnd = mulberry32(3);
  for (let i = 0; i < 46; i++) {
    const bx = 10 + rnd() * 108, h = 50 + rnd() * 75, lean = (rnd() - 0.5) * 50;
    const g = (130 + rnd() * 110) | 0;
    x.strokeStyle = `rgb(${g},${g},${(g * 0.85) | 0})`;
    x.lineWidth = 1.5 + rnd() * 2.5;
    x.beginPath(); x.moveTo(bx, 128);
    x.quadraticCurveTo(bx + lean * 0.3, 128 - h * 0.6, bx + lean, 128 - h);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function grassGeometry() {
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const p = new THREE.PlaneGeometry(0.8, 0.6);
    p.translate(0, 0.3, 0);
    p.rotateY((k * Math.PI) / 3);
    parts.push(p);
  }
  const g = mergeGeometries(parts);
  // normals pointing up for soft lighting
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

export function buildVegetation(seasonKey) {
  const rng = mulberry32(777);
  const slopeAt = (x, z) => {
    const h = W.terrainHeight;
    return Math.hypot(h(x + 1, z) - h(x - 1, z), h(x, z + 1) - h(x, z - 1)) / 2;
  };
  const info = (x, z) => {
    const cx = W.riverCX(z), hw = W.riverHW(z), dx = x - cx, left = dx < 0;
    return { dd: Math.abs(dx) - hw, bw: W.barWidth(z, left), left };
  };
  const cedars = [], broads = [], shrubs = [], grass = [];
  for (let i = 0; i < 14000 && (cedars.length < 1300 || broads.length < 800); i++) {
    const x = (rng() * 2 - 1) * (W.X_HALF - 2), z = W.lerp(W.Z_MIN + 2, W.Z_MAX - 2, rng());
    const { dd, bw, left } = info(x, z);
    if (dd < bw + 1.2) continue;
    if (slopeAt(x, z) > 3.0) continue;
    const y = W.terrainHeight(x, z);
    const nearRiver = Math.exp(-(dd - bw) / 18);
    if (rng() < 0.55 * nearRiver + 0.12) {
      if (broads.length < 800) broads.push({ x, y, z, s: 0.75 + rng() * 0.55, lean: dd < bw + 6 ? (left ? 1 : -1) : 0 });
    } else if (dd > bw + 3 && cedars.length < 1300) {
      cedars.push({ x, y, z, s: 0.65 + rng() * 0.6 });
    }
  }
  for (let i = 0; i < 4000 && shrubs.length < 700; i++) {
    const z = W.lerp(W.Z_MIN + 2, W.Z_MAX - 2, rng());
    const left = rng() < 0.5;
    const bw = W.barWidth(z, left);
    const dd = bw + 0.3 + rng() * 14;
    const x = W.riverCX(z) + (left ? -1 : 1) * (W.riverHW(z) + dd);
    shrubs.push({ x, y: W.terrainHeight(x, z), z, s: 0.55 + rng() * 0.65 });
  }
  for (let i = 0; i < 16000 && grass.length < 7500; i++) {
    const z = W.lerp(W.Z_MIN + 2, W.Z_MAX - 2, rng());
    const left = rng() < 0.5;
    const bw = W.barWidth(z, left);
    const dd = bw + 0.2 + rng() * 12;
    const x = W.riverCX(z) + (left ? -1 : 1) * (W.riverHW(z) + dd);
    const y = W.terrainHeight(x, z);
    if (y < W.waterLevel(z) + 0.1) continue;
    if (left && Math.abs(x - W.anglerPathX(z)) < 0.6) continue;
    grass.push({ x, y, z, s: 0.5 + rng() * 0.6 });
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  const makeIM = (geo, mat, items, opts = {}) => {
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((t, i) => {
      e.set(opts.tilt ? (rng() - 0.5) * 0.08 : 0, rng() * Math.PI * 2, (opts.tilt ? (rng() - 0.5) * 0.08 : 0) + (t.lean ? -t.lean * 0.18 : 0));
      e.order = 'ZYX';
      q.setFromEuler(e);
      sc.setScalar(t.s);
      ps.set(t.x, t.y - 0.2, t.z);
      m4.compose(ps, q, sc);
      im.setMatrixAt(i, m4);
      im.setColorAt(i, new THREE.Color(1, 1, 1));
    });
    im.castShadow = !!opts.cast;
    im.receiveShadow = true;
    return im;
  };

  const cedarMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { wind: { height: 16, amp: 0.22 } });
  const broadMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { wind: { height: 9, amp: 0.2 } });
  const shrubMat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { wind: { height: 1.2, amp: 0.06 } });
  const grassMat = patchMaterial(new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95 }), { wind: { height: 0.6, amp: 0.1 } });

  const cedarIM = makeIM(cedarGeometry(), cedarMat, cedars, { cast: true, tilt: true });
  const broadIM = makeIM(broadGeometry(), broadMat, broads, { cast: true, tilt: true });
  const shrubIM = makeIM(shrubGeometry(), shrubMat, shrubs, { cast: false });
  const grassIM = makeIM(grassGeometry(), grassMat, grass, {});
  const rc = mulberry32(31);
  cedars.forEach((_, i) => { const v = 0.8 + rc() * 0.3; cedarIM.setColorAt(i, new THREE.Color(v, v, v)); });

  function setSeason(key) {
    const S = SEASONS[key];
    const r = mulberry32(42);
    const pal = S.broad.map((c) => lc(...c));
    broads.forEach((_, i) => {
      const c = pal[(r() * pal.length) | 0].clone().multiplyScalar(0.85 + r() * 0.3);
      broadIM.setColorAt(i, c);
    });
    shrubs.forEach((_, i) => {
      const c = pal[(r() * pal.length) | 0].clone().lerp(lc(...S.grass), 0.5).multiplyScalar(0.8 + r() * 0.3);
      shrubIM.setColorAt(i, c);
    });
    const g = lc(...S.grass);
    grass.forEach((_, i) => {
      grassIM.setColorAt(i, g.clone().multiplyScalar(1.1 + r() * 0.5));
    });
    broadIM.instanceColor.needsUpdate = true;
    shrubIM.instanceColor.needsUpdate = true;
    grassIM.instanceColor.needsUpdate = true;
  }
  setSeason(seasonKey);
  return { meshes: [cedarIM, broadIM, shrubIM, grassIM], setSeason };
}
