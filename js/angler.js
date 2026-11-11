// The angler (釣り人): procedural model, 2-bone arm IK, bending rod, line with marks (目印)
import * as THREE from 'three';

export const ROD_LEN = 5.3;
const UP = new THREE.Vector3(0, 1, 0);

function mat(color, r = 0.85, m = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...extra });
}

function placeLimb(mesh, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  if (len > 1e-5) mesh.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
  mesh.scale.set(1, len, 1);
}

function solveIK(S, T, a, b, pole, outElbow, outHand) {
  const d0 = new THREE.Vector3().subVectors(T, S);
  let d = d0.length();
  const maxD = (a + b) * 0.999;
  if (d > maxD) { d0.multiplyScalar(maxD / d); d = maxD; }
  outHand.copy(S).add(d0);
  const n = d0.clone().normalize();
  const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const pp = pole.clone().addScaledVector(n, -pole.dot(n)).normalize();
  outElbow.copy(S).addScaledVector(n, a * cosA).addScaledVector(pp, a * sinA);
}

// ------------------------------------------------------------- rod mesh
class Rod {
  constructor() {
    this.seg = 30; this.rad = 7;
    const nv = (this.seg + 1) * this.rad;
    this.pos = new Float32Array(nv * 3);
    this.nrm = new Float32Array(nv * 3);
    const col = new Float32Array(nv * 3);
    const cork = new THREE.Color(0xb48a58), blank = new THREE.Color(0x1d2b22), gold = new THREE.Color(0xc9a14a);
    for (let i = 0; i <= this.seg; i++) {
      const c = i < 3 ? cork : (i === 3 || i === 12 || i === 20) ? gold : blank;
      for (let j = 0; j < this.rad; j++) { const k = (i * this.rad + j) * 3; col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; }
    }
    const idx = [];
    for (let i = 0; i < this.seg; i++) for (let j = 0; j < this.rad; j++) {
      const a = i * this.rad + j, b = i * this.rad + (j + 1) % this.rad, c = (i + 1) * this.rad + j, d = (i + 1) * this.rad + (j + 1) % this.rad;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.35, side: THREE.DoubleSide }));
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.points = Array.from({ length: this.seg + 1 }, () => new THREE.Vector3());
    this._d = new THREE.Vector3(); this._perp = new THREE.Vector3(); this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3();
  }
  update(base, dir, bendDir, bendAmt) {
    const butt = 0.35;
    const L = (ROD_LEN + butt) / this.seg;
    const perp = this._perp.copy(bendDir).addScaledVector(dir, -bendDir.dot(dir));
    if (perp.lengthSq() < 1e-6) perp.set(0, -1, 0).addScaledVector(dir, dir.y);
    perp.normalize();
    const p = this.points;
    p[0].copy(base).addScaledVector(dir, -butt);
    for (let i = 0; i < this.seg; i++) {
      const t = i / this.seg;
      const a = bendAmt * Math.pow(t, 2.2);
      this._d.copy(dir).multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a));
      p[i + 1].copy(p[i]).addScaledVector(this._d, L);
    }
    for (let i = 0; i <= this.seg; i++) {
      const t = i / this.seg;
      const r = i < 3 ? 0.019 : 0.014 * (1 - t) + 0.0025 * t;
      const tg = this._t.subVectors(p[Math.min(this.seg, i + 1)], p[Math.max(0, i - 1)]).normalize();
      const n = this._n.set(0, 1, 0);
      if (Math.abs(tg.y) > 0.95) n.set(1, 0, 0);
      const b = this._b.crossVectors(tg, n).normalize();
      n.crossVectors(b, tg).normalize();
      for (let j = 0; j < this.rad; j++) {
        const th = (j / this.rad) * Math.PI * 2;
        const cx = Math.cos(th), sy = Math.sin(th);
        const k = (i * this.rad + j) * 3;
        const nx = n.x * cx + b.x * sy, ny = n.y * cx + b.y * sy, nz = n.z * cx + b.z * sy;
        this.pos[k] = p[i].x + nx * r; this.pos[k + 1] = p[i].y + ny * r; this.pos[k + 2] = p[i].z + nz * r;
        this.nrm[k] = nx; this.nrm[k + 1] = ny; this.nrm[k + 2] = nz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    return p[this.seg];
  }
}

// ------------------------------------------------------------- line + marks
export class FishingLine {
  constructor(scene) {
    this.N = 48;
    this.arr = new Float32Array(this.N * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.arr, 3));
    this.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xf2f0e6, transparent: true, opacity: 0.75 }));
    this.line.frustumCulled = false;
    scene.add(this.line);
    this.pts = Array.from({ length: this.N }, () => new THREE.Vector3());
    const mg = new THREE.CylinderGeometry(0.022, 0.022, 0.13, 8);
    this.marks = [0xfff200, 0xff7a00, 0xff2d78].map((c) => {
      const m = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, roughness: 0.6 }));
      scene.add(m);
      return m;
    });
    this.markDist = [0.95, 1.2, 1.45];
    this.bait = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff6a3a, roughness: 0.3, emissive: 0x401000 }));
    this.sinker = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.6, roughness: 0.4 }));
    scene.add(this.bait, this.sinker);
    this._c = new THREE.Vector3();
  }
  update(tip, bait, sag) {
    const c = this._c.addVectors(tip, bait).multiplyScalar(0.5);
    c.y -= sag;
    const N = this.N;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1), u = 1 - t;
      const p = this.pts[i];
      p.set(u * u * tip.x + 2 * u * t * c.x + t * t * bait.x,
        u * u * tip.y + 2 * u * t * c.y + t * t * bait.y,
        u * u * tip.z + 2 * u * t * c.z + t * t * bait.z);
      this.arr[i * 3] = p.x; this.arr[i * 3 + 1] = p.y; this.arr[i * 3 + 2] = p.z;
    }
    this.line.geometry.attributes.position.needsUpdate = true;
    // marks: measured from the bait end
    let mi = 0, acc = 0;
    for (let i = N - 1; i > 0 && mi < 3; i--) {
      const a = this.pts[i], b = this.pts[i - 1];
      const seg = a.distanceTo(b);
      while (mi < 3 && acc + seg >= this.markDist[mi]) {
        const k = (this.markDist[mi] - acc) / Math.max(seg, 1e-6);
        const m = this.marks[mi];
        m.position.lerpVectors(a, b, k);
        const d = new THREE.Vector3().subVectors(b, a).normalize();
        m.quaternion.setFromUnitVectors(UP, d);
        m.visible = true;
        mi++;
      }
      acc += seg;
    }
    for (; mi < 3; mi++) this.marks[mi].visible = false;
    this.bait.position.copy(bait);
    this.sinker.position.lerpVectors(bait, this.pts[N - 4], 0.6);
  }
  setVisible(v) {
    this.line.visible = v; this.bait.visible = v; this.sinker.visible = v;
    if (!v) this.marks.forEach((m) => (m.visible = false));
  }
}

// ------------------------------------------------------------- angler
export class Angler {
  constructor() {
    const g = this.group = new THREE.Group();
    const M = this.M = {
      wader: mat(0x4a5237, 0.7), boot: mat(0x2a2925, 0.6), shirt: mat(0x37506b), vest: mat(0x8d7e58),
      vestDark: mat(0x6f6345), skin: mat(0xd29f7b, 0.6), hat: mat(0xc2b285), dark: mat(0x121416, 0.25, 0.5),
      strap: mat(0x2c3122), glove: mat(0x3b3a33, 0.8), wood: mat(0x8a5a32, 0.5),
      net: new THREE.MeshStandardMaterial({ color: 0xdedbd0, wireframe: true, transparent: true, opacity: 0.55 }),
    };
    M.vest.side = THREE.DoubleSide;
    const add = (geo, m, parent, p, r, s) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = true; mesh.receiveShadow = true;
      if (p) mesh.position.set(...p);
      if (r) mesh.rotation.set(...r);
      if (s) mesh.scale.set(...s);
      parent.add(mesh);
      return mesh;
    };
    this.hips = new THREE.Group(); this.hips.position.set(0, 0.93, 0); g.add(this.hips);
    add(new THREE.CapsuleGeometry(0.14, 0.12, 4, 10), M.wader, this.hips, [0, 0.02, 0], [0, 0, Math.PI / 2], [1, 1, 0.8]);
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(0.1 * s, 0, 0); this.hips.add(hip);
      add(new THREE.CapsuleGeometry(0.075, 0.32, 4, 8), M.wader, hip, [0, -0.22, 0]);
      const knee = new THREE.Group(); knee.position.set(0, -0.45, 0); hip.add(knee);
      add(new THREE.CapsuleGeometry(0.066, 0.32, 4, 8), M.wader, knee, [0, -0.22, 0]);
      add(new THREE.BoxGeometry(0.13, 0.1, 0.27), M.boot, knee, [0, -0.43, 0.04]);
      this.legs.push({ hip, knee, s });
    }
    // torso
    const T = this.torso = new THREE.Group(); this.hips.add(T);
    add(new THREE.CapsuleGeometry(0.155, 0.22, 4, 12), M.wader, T, [0, 0.2, 0], null, [1, 1, 0.75]);
    add(new THREE.CapsuleGeometry(0.16, 0.2, 4, 12), M.shirt, T, [0, 0.43, 0], null, [1.05, 1, 0.78]);
    add(new THREE.CylinderGeometry(0.195, 0.185, 0.34, 16, 1, true), M.vest, T, [0, 0.41, 0], null, [1, 1, 0.82]);
    for (const [px, py] of [[-0.09, 0.35], [0.09, 0.35], [-0.09, 0.47], [0.09, 0.47]]) {
      add(new THREE.BoxGeometry(0.085, 0.075, 0.03), M.vestDark, T, [px, py, 0.155]);
    }
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.035, 0.36, 0.012), M.strap, T, [0.09 * s, 0.4, 0.152], [0.06, 0, 0]);
    add(new THREE.CylinderGeometry(0.05, 0.055, 0.09, 10), M.skin, T, [0, 0.64, 0]);
    // head
    const H = this.head = new THREE.Group(); H.position.set(0, 0.74, 0); T.add(H);
    add(new THREE.SphereGeometry(0.105, 18, 14), M.skin, H, [0, 0, 0], null, [0.95, 1.05, 1]);
    add(new THREE.SphereGeometry(0.02, 8, 6), M.skin, H, [0, -0.01, 0.105]);
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.025, 8, 6), M.skin, H, [0.1 * s, 0, 0], null, [0.5, 1, 0.8]);
    add(new THREE.BoxGeometry(0.17, 0.036, 0.02), M.dark, H, [0, 0.018, 0.095]);
    add(new THREE.CylinderGeometry(0.098, 0.112, 0.1, 18), M.hat, H, [0, 0.08, 0]);
    add(new THREE.LatheGeometry([new THREE.Vector2(0.105, 0.045), new THREE.Vector2(0.16, 0.03), new THREE.Vector2(0.205, -0.0)], 24),
      new THREE.MeshStandardMaterial({ color: 0xc2b285, roughness: 0.85, side: THREE.DoubleSide }), H, [0, 0.0, 0]);
    // arms (positioned by IK each frame, in torso space)
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.arms = [-1, 1].map((s) => ({
      s,
      upper: add(cyl, M.shirt, T, null, null, [0.052, 1, 0.052]),
      fore: add(cyl, M.shirt, T, null, null, [0.044, 1, 0.044]),
      shoulder: add(new THREE.SphereGeometry(0.065, 10, 8), M.vest, T, [0.205 * s, 0.56, 0]),
      elbow: add(new THREE.SphereGeometry(0.05, 8, 6), M.shirt, T),
      hand: add(new THREE.SphereGeometry(0.046, 8, 6), M.glove, T),
      S: new THREE.Vector3(0.205 * s, 0.56, 0),
      pole: new THREE.Vector3(0.6 * s, -1, -0.5).normalize(),
    }));
    this.arms.forEach((a) => { a.upper.scale.set(0.052, 1, 0.052); a.fore.scale.set(0.044, 1, 0.044); a.upperR = 0.052; a.foreR = 0.044; });
    // landing net (タモ)
    const net = this.net = new THREE.Group();
    add(new THREE.TorusGeometry(0.17, 0.008, 6, 28), M.wood, net);
    add(new THREE.CylinderGeometry(0.012, 0.014, 0.32, 6), M.wood, net, [0, -0.33, 0]);
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.net);
    bag.rotation.x = Math.PI / 2; bag.scale.set(1, 1.3, 1);
    net.add(bag);
    T.add(net);
    this.netBack = { p: new THREE.Vector3(0, 0.36, -0.2), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, Math.PI, 0)) };
    this.netFront = { p: new THREE.Vector3(-0.22, 0.05, 0.75), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.25, 0, 0)) };
    this.netGrip = new THREE.Vector3(0, -0.45, 0);
    // rod
    this.rod = new Rod();
    this.walkPhase = 0;
    this.leftHandWorld = new THREE.Vector3();
    this.netWorld = new THREE.Vector3();
    this.tip = new THREE.Vector3();
    this._v = new THREE.Vector3(); this._e = new THREE.Vector3(); this._h = new THREE.Vector3();
    this._base = new THREE.Vector3(); this._dir = new THREE.Vector3(); this._tgt = new THREE.Vector3();
  }

  addTo(scene) { scene.add(this.group); scene.add(this.rod.mesh); }

  update(dt, st) {
    const g = this.group;
    g.position.copy(st.pos);
    g.rotation.y = st.bodyYaw;
    // legs
    const walk = st.walking ? 1 : 0;
    this.walkAmt = THREE.MathUtils.damp(this.walkAmt ?? 0, walk, 8, dt);
    this.walkPhase += dt * 7.5 * this.walkAmt;
    const wa = this.walkAmt;
    for (const L of this.legs) {
      const ph = this.walkPhase + (L.s > 0 ? Math.PI : 0);
      L.hip.rotation.x = -0.1 + Math.sin(ph) * 0.45 * wa;
      L.knee.rotation.x = 0.2 + Math.max(0, Math.sin(ph + 1.3)) * 0.7 * wa;
    }
    this.hips.position.y = 0.92 + Math.abs(Math.sin(this.walkPhase)) * 0.025 * wa + Math.sin(st.time * 1.6) * 0.004;
    const relYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(st.rodYaw - st.bodyYaw), Math.cos(st.rodYaw - st.bodyYaw)), -0.7, 0.7);
    this.torso.rotation.y = relYaw * 0.55;
    this.torso.rotation.x = 0.06 - Math.max(0, st.rodPitch - 0.9) * 0.15 + Math.sin(st.time * 1.6) * 0.008;
    // head look
    g.updateMatrixWorld(true);
    if (st.lookAt) {
      const lp = this.torso.worldToLocal(this._v.copy(st.lookAt));
      lp.sub(this.head.position);
      const yaw = Math.atan2(lp.x, lp.z), pitch = Math.atan2(-lp.y, Math.hypot(lp.x, lp.z));
      this.head.rotation.y = THREE.MathUtils.damp(this.head.rotation.y, THREE.MathUtils.clamp(yaw, -0.9, 0.9), 6, dt);
      this.head.rotation.x = THREE.MathUtils.damp(this.head.rotation.x, THREE.MathUtils.clamp(pitch, -0.5, 0.7), 6, dt);
    }
    // rod
    const p = st.rodPitch;
    const base = this.torso.localToWorld(this._base.set(0.06, 0.25 + 0.22 * Math.sin(p), 0.22));
    const dir = this._dir.set(Math.sin(st.rodYaw) * Math.cos(p), Math.sin(p), Math.cos(st.rodYaw) * Math.cos(p));
    const tip = this.rod.update(base, dir, st.bendDir, st.bendAmt);
    this.tip.copy(tip);
    // net
    const k = THREE.MathUtils.smoothstep(st.netOut, 0, 1);
    this.net.position.lerpVectors(this.netBack.p, this.netFront.p, k);
    this.net.quaternion.slerpQuaternions(this.netBack.q, this.netFront.q, k);
    this.net.updateMatrixWorld(true);
    this.netWorld.setFromMatrixPosition(this.net.matrixWorld);
    // arms IK
    for (const A of this.arms) {
      let target;
      if (A.s > 0) {
        target = this.torso.worldToLocal(this._tgt.copy(base));
      } else if (k > 0.5) {
        target = this.torso.worldToLocal(this.net.localToWorld(this._tgt.copy(this.netGrip)));
      } else {
        target = this.torso.worldToLocal(this._tgt.copy(base).addScaledVector(dir, 0.24));
      }
      solveIK(A.S, target, 0.29, 0.28, A.pole, this._e, this._h);
      placeLimb(A.upper, A.S, this._e); A.upper.scale.x = A.upper.scale.z = A.upperR;
      placeLimb(A.fore, this._e, this._h); A.fore.scale.x = A.fore.scale.z = A.foreR;
      A.elbow.position.copy(this._e);
      A.hand.position.copy(this._h);
      if (A.s < 0) this.torso.localToWorld(this.leftHandWorld.copy(this._h));
    }
    return this.tip;
  }
}
