// Fish species, procedural fish models, and fish behaviour
import * as THREE from 'three';
import * as W from './world.js';
import { patchMaterial } from './shared.js';
import { mulberry32 } from './noise.js';

export const SPECIES = {
  yamame: {
    name: 'ヤマメ', min: 14, max: 34, exp: 2.0, biteRate: 1.7, window: 0.5, power: 1.0, jumpy: 0.3, points: 1.4, interest: 0.55,
    fin: 0x6a6a55, desc: '渓流の女王。体側のパーマークが美しい。警戒心が強く、アタリは一瞬。',
  },
  iwana: {
    name: 'イワナ', min: 16, max: 45, exp: 2.2, biteRate: 1.3, window: 0.85, power: 1.15, jumpy: 0.05, points: 1.5, interest: 0.65,
    fin: 0x7a5a3a, desc: '源流の主。岩陰や滝壺に潜み、エサをしっかり咥える。',
  },
  niji: {
    name: 'ニジマス', min: 22, max: 52, exp: 1.7, biteRate: 1.5, window: 0.6, power: 1.35, jumpy: 0.5, points: 1.2, interest: 0.6,
    fin: 0x6d7060, desc: '強烈な引きとジャンプ。体側の虹色の帯が特徴。',
  },
  ayu: {
    name: 'アユ', min: 15, max: 28, exp: 1.6, biteRate: 0, window: 0, power: 1.15, jumpy: 0.15, points: 2.0, interest: 0,
    fin: 0xb59a48, tomo: true, desc: '清流の女王・香魚。瀬の苔を食み、縄張りに入ったおとりに体当たりする。友釣りでしか釣れない。',
  },
  ugui: {
    name: 'ウグイ', min: 12, max: 28, exp: 1.3, biteRate: 2.3, window: 0.55, power: 0.6, jumpy: 0.0, points: 0.5, interest: 0.8,
    fin: 0x8a8070, desc: '渓流の外道の代表格。よくエサをつつく。',
  },
};

const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function h2(i, j, s) {
  let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2147483647);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
// spot pattern: returns 0..1 coverage
function spots(along, phi, ka, kp, radius, seed, density = 1) {
  const gx = along * ka, gy = (phi / (Math.PI * 2)) * kp;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  let best = 0;
  for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
    const cx = ix + ox, cy = iy + oy;
    if (h2(cx, cy, seed + 7) > density) continue;
    const px = cx + 0.2 + 0.6 * h2(cx, cy, seed), py = cy + 0.2 + 0.6 * h2(cx, cy, seed + 1);
    const r = radius * (0.6 + 0.6 * h2(cx, cy, seed + 2));
    const d = Math.hypot(gx - px, gy - py);
    best = Math.max(best, 1 - sm(r * 0.7, r, d));
  }
  return best;
}

function speciesColor(key, along, dn, phi) {
  const top = sm(0.05, 0.75, dn), bot = sm(-0.05, -0.7, dn);
  let c;
  if (key === 'yamame') {
    c = mix([0.8, 0.8, 0.74], [0.34, 0.37, 0.25], top);
    c = mix(c, [0.96, 0.95, 0.93], bot);
    const band = sm(0.22, 0.0, Math.abs(dn + 0.08)) * 0.3;
    c = mix(c, [0.92, 0.66, 0.66], band);
    for (let k = 0; k < 9; k++) {
      const ac = 0.6 - k * 0.145;
      const e = ((along - ac) / 0.052) ** 2 + ((dn - 0.04) / 0.3) ** 2;
      if (e < 1.4) c = mix(c, [0.38, 0.42, 0.52], (1 - sm(0.6, 1.4, e)) * 0.8);
    }
    if (dn > 0.15) c = mix(c, [0.08, 0.08, 0.07], spots(along, phi, 26, 40, 0.18, 3, 0.5) * sm(0.15, 0.4, dn));
  } else if (key === 'iwana') {
    c = mix([0.47, 0.44, 0.33], [0.24, 0.25, 0.17], top);
    c = mix(c, [0.95, 0.78, 0.5], bot);
    const sp = spots(along, phi, 20, 34, 0.26, 11, 0.85);
    if (dn > -0.4) c = mix(c, [0.94, 0.9, 0.78], sp * sm(-0.4, -0.15, dn) * 0.9);
    if (dn < -0.05 && dn > -0.5) c = mix(c, [0.96, 0.58, 0.28], spots(along, phi, 28, 40, 0.18, 21, 0.5) * 0.8);
  } else if (key === 'niji') {
    c = mix([0.82, 0.84, 0.82], [0.3, 0.38, 0.32], top);
    c = mix(c, [0.97, 0.97, 0.95], bot);
    const band = sm(0.24, 0.0, Math.abs(dn + 0.02));
    c = mix(c, [0.88, 0.42, 0.48], band * 0.7);
    if (dn > -0.35) c = mix(c, [0.06, 0.06, 0.06], spots(along, phi, 34, 52, 0.17, 5, 0.75) * sm(-0.35, -0.1, dn));
  } else if (key === 'ayu') {
    c = mix([0.82, 0.8, 0.66], [0.4, 0.42, 0.32], top);
    c = mix(c, [0.96, 0.95, 0.9], bot);
    // 追星（えらの後ろの黄色い斑紋）
    const e = ((along - 0.45) / 0.09) ** 2 + ((dn - 0.18) / 0.22) ** 2;
    if (e < 1.3) c = mix(c, [0.98, 0.82, 0.2], (1 - sm(0.5, 1.3, e)) * 0.9);
    c = mix(c, [0.9, 0.85, 0.55], sm(0.18, 0.0, Math.abs(dn + 0.05)) * 0.25);
  } else {
    c = mix([0.8, 0.82, 0.8], [0.3, 0.32, 0.27], top);
    c = mix(c, [0.96, 0.96, 0.95], bot);
    c = mix(c, [0.93, 0.56, 0.3], sm(0.12, 0.0, Math.abs(dn + 0.42)) * 0.35);
  }
  // gill cover & head shading
  if (along > 0.58 && along < 0.63 && dn > -0.6) c = mix(c, [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6], 0.7);
  if (along > 0.62) c = mix(c, [c[0] * 0.85, c[1] * 0.85, c[2] * 0.85], 0.5);
  return c;
}

const texCache = {};
function fishTexture(key) {
  if (texCache[key]) return texCache[key];
  const Wd = 512, Ht = 256;
  const cv = document.createElement('canvas'); cv.width = Wd; cv.height = Ht;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(Wd, Ht);
  for (let py = 0; py < Ht; py++) {
    const theta = ((py + 0.5) / Ht) * Math.PI;
    const along = Math.cos(theta);
    for (let px = 0; px < Wd; px++) {
      const phi = ((px + 0.5) / Wd) * Math.PI * 2;
      const dn = Math.sin(phi);
      const c = speciesColor(key, along, dn, phi);
      const k = (py * Wd + px) * 4;
      img.data[k] = Math.min(255, c[0] * 255); img.data[k + 1] = Math.min(255, c[1] * 255); img.data[k + 2] = Math.min(255, c[2] * 255); img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache[key] = t;
  return t;
}

let bodyGeo = null;
function bodyGeometry() {
  if (bodyGeo) return bodyGeo;
  const g = new THREE.SphereGeometry(1, 40, 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), along = p.getY(i), z = p.getZ(i);
    const g1 = 0.3 + 0.7 * sm(-0.98, 0.0, along);
    const head = 1 - 0.12 * sm(0.7, 1.0, along);
    const Y = z * 0.112 * g1 * head * (z < 0 ? 1.06 : 1);
    const Z = x * 0.055 * g1 * head;
    p.setXYZ(i, along * 0.5, Y, Z);
  }
  g.computeVertexNormals();
  bodyGeo = g;
  return g;
}

const matCache = {};
function fishMaterials(key, underwater) {
  const ck = key + (underwater ? 'u' : 'p');
  if (matCache[ck]) return matCache[ck];
  const body = new THREE.MeshStandardMaterial({ map: fishTexture(key), roughness: 0.35, metalness: 0.18 });
  const fin = new THREE.MeshStandardMaterial({ color: SPECIES[key].fin, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  if (underwater) { patchMaterial(body, { underwater: true }); patchMaterial(fin, { underwater: true }); }
  const eye = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.15, metalness: 0.3 });
  const iris = new THREE.MeshStandardMaterial({ color: 0xd8c27a, roughness: 0.4 });
  return (matCache[ck] = { body, fin, eye, iris });
}

function finShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  return new THREE.ShapeGeometry(s);
}
const FIN = {};
function fins() {
  if (FIN.tail) return FIN;
  const tail = new THREE.Shape();
  tail.moveTo(0, 0); tail.lineTo(-0.11, 0.09); tail.quadraticCurveTo(-0.08, 0, -0.11, -0.09); tail.lineTo(0, 0);
  FIN.tail = new THREE.ShapeGeometry(tail);
  FIN.dorsal = finShape([[0.06, 0], [-0.02, 0.075], [-0.08, 0.055], [-0.07, 0]]);
  FIN.adipose = finShape([[0, 0], [-0.025, 0.025], [-0.05, 0]]);
  FIN.anal = finShape([[0, 0], [-0.04, -0.05], [-0.08, -0.04], [-0.07, 0]]);
  FIN.pect = finShape([[0, 0], [-0.07, -0.025], [-0.06, 0.005]]);
  FIN.eye = new THREE.SphereGeometry(0.016, 10, 8);
  FIN.irisG = new THREE.SphereGeometry(0.02, 10, 8);
  return FIN;
}

export function createFishMesh(key, underwater = true) {
  const m = fishMaterials(key, underwater);
  const F = fins();
  const g = new THREE.Group();
  const body = new THREE.Mesh(bodyGeometry(), m.body);
  if (key === 'ayu') body.scale.set(1, 0.84, 0.9); // スリムな体形
  g.add(body);
  const tail = new THREE.Group(); tail.position.set(-0.47, 0, 0); g.add(tail);
  tail.add(new THREE.Mesh(F.tail, m.fin));
  const d = new THREE.Mesh(F.dorsal, m.fin); d.position.set(0.06, 0.09, 0); g.add(d);
  const ad = new THREE.Mesh(F.adipose, m.fin); ad.position.set(-0.28, 0.055, 0); g.add(ad);
  const an = new THREE.Mesh(F.anal, m.fin); an.position.set(-0.2, -0.06, 0); g.add(an);
  for (const s of [-1, 1]) {
    const pf = new THREE.Mesh(F.pect, m.fin); pf.position.set(0.3, -0.05, 0.04 * s); pf.rotation.x = s * 0.6; g.add(pf);
    const ir = new THREE.Mesh(F.irisG, m.iris); ir.position.set(0.39, 0.025, 0.03 * s); ir.scale.set(1, 1, 0.5); g.add(ir);
    const e = new THREE.Mesh(F.eye, m.eye); e.position.set(0.395, 0.025, 0.036 * s); e.scale.set(1, 1, 0.5); g.add(e);
  }
  g.userData.tail = tail;
  return g;
}

// ------------------------------------------------------------- manager
const dampAngle = (a, b, k) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
};

export class FishManager {
  constructor(scene, rocks, count = 46, ayuCount = 34) {
    this.scene = scene;
    this.rocks = rocks.filter((r) => r.inRiver);
    this.rng = mulberry32(4242);
    this.list = [];
    this.t = 0;
    for (let i = 0; i < count; i++) this.list.push(this.spawn());
    for (let i = 0; i < ayuCount; i++) this.list.push(this.spawn(true));
  }

  // 鮎は瀬（浅く流れの速い所）に縄張りを持つ
  pickAyuSpot() {
    const r = this.rng;
    for (let tries = 0; tries < 120; tries++) {
      const z = W.lerp(W.FALL_Z + 15, W.WALK_MAX + 14, r());
      if (W.poolFactor(z) > 0.55) continue;
      const cx = W.riverCX(z), hw = W.riverHW(z);
      const x = cx + (r() * 2 - 1) * hw * 0.75;
      const depth = W.waterLevel(z) - W.terrainHeight(x, z);
      if (depth < 0.22 || depth > 1.0) continue;
      return { x, z, depth };
    }
    return this.pickSpot();
  }

  pickSpot() {
    const r = this.rng;
    for (let tries = 0; tries < 80; tries++) {
      const z = W.lerp(W.FALL_Z + 3, W.WALK_MAX + 14, r());
      const cx = W.riverCX(z), hw = W.riverHW(z);
      const x = cx + (r() * 2 - 1) * hw * 0.8;
      const depth = W.waterLevel(z) - W.terrainHeight(x, z);
      if (depth < 0.3) continue;
      let rockBonus = 0;
      for (const k of this.rocks) {
        const dz = z - k.z, dx = Math.abs(x - k.x);
        if (dz > 0 && dz < k.r + 2.5 && dx < k.r + 0.5) { rockBonus = 0.45; break; }
      }
      const score = W.smoothstep(0.3, 1.4, depth) * 0.55 + rockBonus + 0.12;
      if (r() < score) return { x, z, depth };
    }
    const z = W.lerp(W.FALL_Z + 5, W.WALK_MAX, r());
    return { x: W.riverCX(z), z, depth: W.waterLevel(z) - W.terrainHeight(W.riverCX(z), z) };
  }

  chooseSpecies(z) {
    const r = this.rng(), pf = W.poolFactor(z);
    let w;
    if (z < W.FALL_Z + 40) w = { iwana: 0.6, yamame: 0.3, niji: 0.05, ugui: 0.05 };
    else if (pf > 0.6) w = { niji: 0.25, yamame: 0.35, iwana: 0.2, ugui: 0.2 };
    else w = { yamame: 0.55, ugui: 0.3, iwana: 0.1, niji: 0.05 };
    let acc = 0;
    for (const k in w) { acc += w[k]; if (r < acc) return k; }
    return 'yamame';
  }

  spawn(isAyu = false) {
    const spot = isAyu ? this.pickAyuSpot() : this.pickSpot();
    const key = isAyu ? 'ayu' : this.chooseSpecies(spot.z);
    const sp = SPECIES[key];
    const size = Math.round((sp.min + (sp.max - sp.min) * Math.pow(this.rng(), sp.exp)) * 10) / 10;
    const mesh = createFishMesh(key, true);
    mesh.scale.setScalar(size / 100);
    this.scene.add(mesh);
    const wl = W.waterLevel(spot.z), bed = W.terrainHeight(spot.x, spot.z);
    const homeY = Math.max(bed + 0.08, wl - Math.min(Math.max(spot.depth * 0.5, 0.12), 0.8));
    const f = {
      key, size, mesh,
      home: new THREE.Vector3(spot.x, homeY, spot.z),
      pos: new THREE.Vector3(spot.x, homeY, spot.z),
      heading: 0, state: 'hold', timer: 0, cool: 0, ph: this.rng() * 100, tailPh: this.rng() * 6, speed: 0,
      flee: new THREE.Vector3(), natLow: 0,
      isAyu, terrR: 1.0 + this.rng() * 0.7, aggr: 0.5 + this.rng() * 0.5,
    };
    if (isAyu) f.home.y = Math.max(bed + 0.06, wl - Math.min(spot.depth * 0.6, 0.35));
    if (isAyu) f.pos.y = f.home.y;
    const fd = W.flowDir(spot.z);
    f.heading = Math.atan2(fd.z, -fd.x);
    return f;
  }

  respawn(f) {
    this.scene.remove(f.mesh);
    const nf = this.spawn(f.isAyu);
    Object.assign(f, nf);
  }

  caught(f) {
    f.state = 'gone';
    f.timer = 30 + this.rng() * 30;
    f.mesh.visible = false;
  }

  startFlee(f, from) {
    const fd = W.flowDir(f.pos.z);
    const dx = f.pos.x - from.x, dz = f.pos.z - from.z;
    const l = Math.hypot(dx, dz) || 1;
    let tx = f.pos.x + (dx / l) * 2 - fd.x * 3, tz = f.pos.z + (dz / l) * 2 - fd.z * 3;
    const cx = W.riverCX(tz), hw = W.riverHW(tz);
    tx = W.clamp(tx, cx - hw * 0.7, cx + hw * 0.7);
    f.flee.set(tx, 0, tz);
    f.state = 'flee';
    f.timer = 0;
  }

  spookNear(p, radius, chance = 0.7) {
    for (const f of this.list) {
      if (f.state === 'gone' || f.state === 'hooked' || f.state === 'bite') continue;
      const d = Math.hypot(f.pos.x - p.x, f.pos.z - p.z);
      if (d < radius && this.rng() < chance * (f.key === 'iwana' ? 0.5 : 1)) this.startFlee(f, p);
    }
  }

  nearbyHolding(p, maxD) {
    const c = this.list.filter((f) => f.state === 'hold' && Math.hypot(f.pos.x - p.x, f.pos.z - p.z) < maxD);
    return c.length ? c[(this.rng() * c.length) | 0] : null;
  }

  _move(f, tx, ty, tz, speed, dt) {
    const dx = tx - f.pos.x, dz = tz - f.pos.z;
    const d = Math.hypot(dx, dz);
    const step = Math.min(d, speed * dt);
    if (d > 1e-4) { f.pos.x += (dx / d) * step; f.pos.z += (dz / d) * step; }
    f.pos.y += (ty - f.pos.y) * Math.min(1, dt * 2);
    f.speed = THREE.MathUtils.damp(f.speed, step / Math.max(dt, 1e-4), 6, dt);
    if (step > speed * dt * 0.3 && d > 0.05) f.moveHeading = Math.atan2(-dz, dx);
    else f.moveHeading = null;
    return d;
  }

  _constrain(f) {
    const cx = W.riverCX(f.pos.z), hw = W.riverHW(f.pos.z);
    f.pos.x = W.clamp(f.pos.x, cx - hw + 0.3, cx + hw - 0.3);
    const wl = W.waterLevel(f.pos.z), bed = W.terrainHeight(f.pos.x, f.pos.z);
    if (f.state !== 'hooked') f.pos.y = W.clamp(f.pos.y, bed + 0.06, wl - 0.07);
  }

  /** ctx: {bait, baitActive, tomo, anglerPos, anglerMoving, timeMul} -> fish that bites (or hits the decoy), or null */
  update(dt, ctx) {
    this.t += dt;
    let biter = null;
    const bait = ctx.bait;
    for (const f of this.list) {
      const sp = SPECIES[f.key];
      f.cool = Math.max(0, f.cool - dt);
      if (f.state === 'gone') {
        f.timer -= dt;
        if (f.timer <= 0) this.respawn(f);
        continue;
      }
      const fd = W.flowDir(f.pos.z);
      const upstream = Math.atan2(fd.z, -fd.x);
      const sense = 2.3 * (0.75 + 0.25 * ctx.timeMul);
      switch (f.state) {
        case 'hold': {
          if (f.isAyu) {
            // 縄張りの中を苔を食みながら動き回る
            const tx = f.home.x + Math.sin(this.t * 0.7 + f.ph) * f.terrR * 0.5;
            const tz = f.home.z + Math.cos(this.t * 0.53 + f.ph * 1.3) * f.terrR * 0.6;
            this._move(f, tx, f.home.y, tz, 0.55, dt);
            f.moveHeading = null;
            if (ctx.tomo && ctx.baitActive && f.cool <= 0) {
              const d = Math.hypot(bait.pos.x - f.home.x, bait.pos.z - f.home.z);
              if (d < f.terrR + 0.4 && this.rng() < f.aggr * ctx.timeMul * (0.3 + 0.7 * bait.vigor) * dt * 3) { f.state = 'attack'; f.timer = 0; }
            }
            if (ctx.anglerMoving && Math.hypot(ctx.anglerPos.x - f.pos.x, ctx.anglerPos.z - f.pos.z) < 2.5 * (ctx.anglerCareful ? 0.75 : 1)) this.startFlee(f, ctx.anglerPos);
            break;
          }
          const tx = f.home.x + Math.sin(this.t * 0.3 + f.ph) * 0.25;
          const tz = f.home.z + Math.cos(this.t * 0.23 + f.ph) * 0.35;
          this._move(f, tx, f.home.y, tz, 0.3, dt);
          f.moveHeading = null;
          if (ctx.baitActive && !ctx.tomo && f.cool <= 0 && bait.natural > 0.4) {
            const d = Math.hypot(bait.pos.x - f.pos.x, bait.pos.z - f.pos.z);
            if (d < sense) {
              if (this.rng() < sp.interest * Math.min(1.3, ctx.timeMul)) { f.state = 'approach'; f.natLow = 0; }
              else f.cool = 7;
            }
          }
          if (ctx.anglerMoving && Math.hypot(ctx.anglerPos.x - f.pos.x, ctx.anglerPos.z - f.pos.z) < 3.2 * (ctx.anglerCareful ? 0.75 : 1)) this.startFlee(f, ctx.anglerPos);
          break;
        }
        case 'approach': {
          if (!ctx.baitActive) { f.state = 'hold'; f.cool = 3; break; }
          const tx = bait.pos.x - fd.x * 0.14, tz = bait.pos.z - fd.z * 0.14;
          const d = this._move(f, tx, bait.pos.y, tz, 1.1, dt);
          if (d < 0.3) f.moveHeading = upstream;
          if (bait.natural < 0.3) f.natLow += dt; else f.natLow = Math.max(0, f.natLow - dt);
          if (d < 0.3 && !biter && this.rng() < sp.biteRate * ctx.timeMul * bait.natural * dt) {
            f.state = 'bite'; biter = f;
          } else if (d > sense * 1.7 || f.natLow > 1.0) {
            f.state = 'hold'; f.cool = 6;
          }
          break;
        }
        case 'flee': {
          const d = this._move(f, f.flee.x, f.home.y, f.flee.z, 2.8, dt);
          f.timer += dt;
          if (d < 0.2 || f.timer > 4) { f.state = 'hide'; f.timer = 15 + this.rng() * 15; }
          break;
        }
        case 'hide': {
          f.timer -= dt;
          this._move(f, f.flee.x, f.home.y, f.flee.z, 0.3, dt);
          f.moveHeading = null;
          if (f.timer <= 0) f.state = 'return';
          break;
        }
        case 'return': {
          const d = this._move(f, f.home.x, f.home.y, f.home.z, 0.6, dt);
          if (d < 0.2) f.state = 'hold';
          break;
        }
        case 'attack': {
          // おとりへ体当たり。掛け針に触れれば掛かる
          if (!ctx.tomo || !ctx.baitActive) { f.state = 'hold'; break; }
          f.timer += dt;
          const d = this._move(f, bait.pos.x, bait.pos.y, bait.pos.z, 2.8, dt);
          if (d < 0.18 && !biter) {
            if (this.rng() < 0.45 + 0.4 * bait.vigor) { f.state = 'bite'; biter = f; }
            else { f.state = 'hold'; f.cool = 1.5 + this.rng() * 2; }
          } else if (f.timer > 2.5 || Math.hypot(bait.pos.x - f.home.x, bait.pos.z - f.home.z) > f.terrR + 1.2) {
            f.state = 'hold'; f.cool = 2;
          }
          break;
        }
        case 'bite': {
          this._move(f, bait.pos.x - fd.x * 0.1, bait.pos.y, bait.pos.z - fd.z * 0.1, 2.0, dt);
          f.moveHeading = null;
          break;
        }
        case 'hooked': break; // driven by the game
      }
      if (f.state !== 'hooked') {
        this._constrain(f);
        f.heading = dampAngle(f.heading, f.moveHeading ?? upstream, dt * 5);
      }
      const amp = f.state === 'hooked' ? 0.6 : 0.25 + Math.min(0.4, f.speed * 0.25);
      f.tailPh += dt * (5 + f.speed * 9 + (f.state === 'hooked' ? 10 : 0));
      f.mesh.position.copy(f.pos);
      f.mesh.rotation.set(Math.sin(f.tailPh * 0.5) * 0.05, f.heading + Math.sin(f.tailPh) * 0.06, f.pitch || 0);
      f.mesh.userData.tail.rotation.y = Math.sin(f.tailPh) * amp;
    }
    return biter;
  }
}
