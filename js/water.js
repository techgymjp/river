// River surface (custom shader), waterfall, floating leaves, ripples, splashes, mist
import * as THREE from 'three';
import * as W from './world.js';
import { shared } from './shared.js';
import { mulberry32 } from './noise.js';

const VERT = /* glsl */`
attribute vec4 aInfo;   // depth, speed, foam, steep
attribute vec2 aFlow;
attribute vec2 aRUV;    // across (m), along arc-length (m)
uniform float uTime;
varying vec3 vWorld;
varying vec2 vRUV;
varying vec4 vInfo;
varying vec2 vFlow;
#include <fog_pars_vertex>
void main(){
  vec3 p = position;
  float sp = aInfo.y;
  float amp = (0.01 + 0.03 * clamp(sp - 0.6, 0.0, 1.5)) * (1.0 - aInfo.w);
  p.y += (sin(aRUV.y * 1.9 - uTime * (1.5 + sp * 2.0) + aRUV.x * 0.8)
        + 0.6 * sin(aRUV.x * 2.7 + aRUV.y * 1.1 - uTime * 2.3)) * amp;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vRUV = aRUV; vInfo = aInfo; vFlow = aFlow;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uForest;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uAmbient;
varying vec3 vWorld;
varying vec2 vRUV;
varying vec4 vInfo;
varying vec2 vFlow;
#include <fog_pars_fragment>

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
float surf(vec2 q, float sp){
  float t = uTime;
  float h = fbm(vec2(q.x * 1.3, q.y * 0.75 - t * sp * 0.9));
  h += 0.5 * fbm(vec2(q.x * 2.9 + 3.1, q.y * 2.1 - t * sp * 1.7));
  h += 0.25 * vnoise(vec2(q.x * 7.0, q.y * 6.0 - t * (sp * 2.5 + 0.5)));
  return h;
}
void main(){
  float depth = vInfo.x;
  float sp = vInfo.y;
  float foamMask = vInfo.z;
  float steep = vInfo.w;
  vec2 q = vRUV;
  float e = 0.05;
  float h0 = surf(q, sp);
  float hx = surf(q + vec2(e, 0.0), sp);
  float hy = surf(q + vec2(0.0, e), sp);
  float rough = 0.16 + 0.32 * clamp(sp / 1.8, 0.0, 1.0);
  vec2 g = vec2(hx - h0, hy - h0) / e * rough;
  vec3 T = normalize(vec3(vFlow.x, 0.0, vFlow.y));
  vec3 B = vec3(T.z, 0.0, -T.x);
  vec3 Ng = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (Ng.y < 0.0) Ng = -Ng;
  Ng = normalize(mix(vec3(0.0, 1.0, 0.0), Ng, steep));
  vec3 N = normalize(Ng - B * g.x - T * g.y * (1.0 - steep));

  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = max(dot(N, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uSkyHorizon, uSkyTop, pow(clamp(R.y, 0.0, 1.0), 0.5));
  vec3 refl = mix(uForest, sky, smoothstep(0.22, 0.6, R.y));
  float sd = max(dot(R, uSunDir), 0.0);
  float spec = pow(sd, 260.0) * 7.0 + pow(sd, 28.0) * 0.2;

  float dF = smoothstep(0.0, 1.7, depth);
  vec3 body = mix(uShallow, uDeep, dF);
  float diff = max(dot(N, uSunDir), 0.0);
  body *= (uAmbient + uSunColor * diff * 0.35);
  vec3 col = mix(body, refl, fres);
  col += uSunColor * spec * (1.0 - steep * 0.8);
  float alpha = mix(0.16, 0.93, smoothstep(0.02, 1.3, depth));
  alpha = max(alpha, fres * 0.9);

  // foam
  float shore = 1.0 - smoothstep(0.0, 0.08, depth);
  float fm = clamp(foamMask + shore * 0.45, 0.0, 1.0);
  float fn = fbm(vec2(q.x * 2.2, q.y * 1.1 - uTime * sp * 1.4));
  float fn2 = fbm(vec2(q.x * 5.0 + 7.0, q.y * 3.0 - uTime * sp * 2.2));
  float fv = fn * 0.75 + fn2 * 0.45;
  float foam = smoothstep(1.02 - fm * 0.75, 1.02 - fm * 0.75 + 0.18, fv) * min(1.0, fm * 1.6);
  // waterfall streaks
  float streak = fbm(vec2(q.x * 3.5, q.y * 0.35 - uTime * 3.5));
  float wf = steep * smoothstep(0.3, 0.6, streak + 0.15);
  foam = max(foam, wf);
  foam = max(foam, steep * 0.6);
  vec3 foamCol = (uAmbient * 1.3 + uSunColor * 0.6 * (0.5 + 0.5 * diff));
  col = mix(col, foamCol, foam);
  alpha = max(alpha, foam * 0.95);
  alpha *= smoothstep(-0.04, 0.02, depth);

  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function buildWater(rocks) {
  const dzs = 0.4;
  const z0 = W.Z_MIN + 1, z1 = W.Z_MAX - 1;
  const rows = Math.round((z1 - z0) / dzs) + 1;
  const cols = 28;
  const N = rows * cols;
  const pos = new Float32Array(N * 3), info = new Float32Array(N * 4), flow = new Float32Array(N * 2), ruv = new Float32Array(N * 2);
  const riverRocks = rocks.filter((r) => r.inRiver || Math.abs(r.x - W.riverCX(r.z)) < W.riverHW(r.z) + r.r);
  let v = 0, pcx = 0, pwl = 0;
  for (let i = 0; i < rows; i++) {
    const z = z0 + i * dzs;
    const cx = W.riverCX(z), hw = W.riverHW(z), wl = W.waterLevel(z);
    if (i > 0) v += Math.hypot(dzs, cx - pcx, wl - pwl);
    pcx = cx; pwl = wl;
    const ext = hw + 1.8;
    const fd = W.flowDir(z);
    const sp0 = W.flowSpeed(z);
    const slope = Math.abs(W.waterLevel(z + 0.2) - W.waterLevel(z - 0.2)) / 0.4;
    const steep = W.smoothstep(0.5, 2.0, slope);
    const pf = W.poolFactor(z);
    const nearRocks = riverRocks.filter((r) => Math.abs(r.z - z) < r.r + 5);
    for (let j = 0; j < cols; j++) {
      const k = i * cols + j;
      const s = (j / (cols - 1)) * 2 - 1;
      const x = cx + s * ext;
      pos[k * 3] = x; pos[k * 3 + 1] = wl; pos[k * 3 + 2] = z;
      const depth = wl - W.terrainHeight(x, z);
      let sp = sp0 * (1 - 0.5 * Math.min(1, s * s));
      sp = Math.max(sp, 3.2 * steep);
      let foam = (1 - pf) * 0.32 * W.smoothstep(0.6, 1.6, sp);
      for (const r of nearRocks) {
        if (r.top < wl - 0.3) continue;
        const dxr = x - r.x, dzr = z - r.z;
        const d = Math.hypot(dxr, dzr > 0 ? dzr / 2.4 : dzr * 1.3);
        const f = 1 - W.smoothstep(r.r * 0.85, r.r * 0.85 + 1.1, d);
        foam = Math.max(foam, f * (r.top > wl ? 0.9 : 0.5));
      }
      if (z > W.FALL_Z && z < W.FALL_Z + 12) foam = Math.max(foam, (1 - (z - W.FALL_Z) / 12) * 0.95);
      info[k * 4] = depth; info[k * 4 + 1] = sp; info[k * 4 + 2] = foam; info[k * 4 + 3] = steep;
      flow[k * 2] = fd.x; flow[k * 2 + 1] = fd.z;
      ruv[k * 2] = s * ext; ruv[k * 2 + 1] = v;
    }
  }
  const idx = new Uint32Array((rows - 1) * (cols - 1) * 6);
  let n = 0;
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  geo.setAttribute('aFlow', new THREE.BufferAttribute(flow, 2));
  geo.setAttribute('aRUV', new THREE.BufferAttribute(ruv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uSkyTop: { value: new THREE.Color() }, uSkyHorizon: { value: new THREE.Color() },
    uForest: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() },
    uShallow: { value: new THREE.Color() }, uAmbient: { value: new THREE.Color() },
  }]);
  uniforms.uTime = shared.uTime;
  uniforms.uSunDir = shared.uSunDir;
  uniforms.uSunColor = shared.uSunColor;
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, fog: true, depthWrite: true, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return { mesh, uniforms };
}

// ---------------------------------------------------------------- effects
function softSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function leafTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.beginPath(); x.moveTo(4, 32); x.quadraticCurveTo(28, 6, 60, 32); x.quadraticCurveTo(28, 58, 4, 32); x.fill();
  x.strokeStyle = 'rgba(120,100,80,0.8)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(4, 32); x.lineTo(58, 32); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(55);
    const sprite = softSprite();
    // splash particles
    this.SP = 400;
    this.sp = { pos: new Float32Array(this.SP * 3), vel: new Float32Array(this.SP * 3), life: new Float32Array(this.SP) };
    this.sp.pos.fill(-9999);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.sp.pos, 3));
    this.splashPts = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, map: sprite, transparent: true, opacity: 0.9, depthWrite: false }));
    this.splashPts.frustumCulled = false;
    this.splashPts.renderOrder = 3;
    scene.add(this.splashPts);
    this.spIdx = 0;

    // ripples
    this.ripples = [];
    const rg = new THREE.RingGeometry(0.92, 1, 40); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; m.renderOrder = 2;
      scene.add(m);
      this.ripples.push({ m, t: 0, life: 1, r: 1 });
    }

    // floating leaves
    this.LN = 70;
    const lg = new THREE.PlaneGeometry(0.11, 0.07); lg.rotateX(-Math.PI / 2);
    this.leafMesh = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }), this.LN);
    this.leafMesh.frustumCulled = false;
    this.leaves = [];
    for (let i = 0; i < this.LN; i++) {
      this.leaves.push({ x: 0, z: 9999, rot: this.rng() * 6.28, spin: (this.rng() - 0.5) * 0.6 });
      this.leafMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    scene.add(this.leafMesh);

    // waterfall mist
    this.MN = 160;
    this.mist = { pos: new Float32Array(this.MN * 3), vel: new Float32Array(this.MN * 3), life: new Float32Array(this.MN) };
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(this.mist.pos, 3));
    this.mistPts = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, map: sprite, transparent: true, opacity: 0.16, depthWrite: false }));
    this.mistPts.frustumCulled = false;
    scene.add(this.mistPts);
    for (let i = 0; i < this.MN; i++) this.respawnMist(i, this.rng() * 4);
    this._f = { x: 0, z: 0 };
    this._m4 = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this._e = new THREE.Euler();
  }

  setSeason(S) {
    const pal = S.leaf.map((c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace));
    for (let i = 0; i < this.LN; i++) this.leafMesh.setColorAt(i, pal[i % pal.length]);
    this.leafMesh.instanceColor.needsUpdate = true;
    this.leafCount = S.label === '紅葉' ? this.LN : 30;
  }

  respawnMist(i, age = 0) {
    const z = W.FALL_Z + 1 + this.rng() * 3;
    const cx = W.riverCX(z), hw = W.riverHW(z);
    const p = this.mist.pos, v = this.mist.vel;
    p[i * 3] = cx + (this.rng() * 2 - 1) * hw * 0.6;
    p[i * 3 + 1] = W.waterLevel(z) + this.rng() * 0.5;
    p[i * 3 + 2] = z;
    v[i * 3] = (this.rng() - 0.5) * 0.4; v[i * 3 + 1] = 0.3 + this.rng() * 0.6; v[i * 3 + 2] = 0.4 + this.rng() * 0.8;
    this.mist.life[i] = 3 + this.rng() * 2 - age;
  }

  splash(p, count = 12, power = 1) {
    const s = this.sp;
    for (let n = 0; n < count; n++) {
      const i = this.spIdx = (this.spIdx + 1) % this.SP;
      const a = this.rng() * Math.PI * 2, r = this.rng() * 0.6 + 0.4;
      s.pos[i * 3] = p.x + Math.cos(a) * 0.05; s.pos[i * 3 + 1] = p.y + 0.02; s.pos[i * 3 + 2] = p.z + Math.sin(a) * 0.05;
      s.vel[i * 3] = Math.cos(a) * r * power * 0.9;
      s.vel[i * 3 + 1] = (1.2 + this.rng() * 1.8) * power;
      s.vel[i * 3 + 2] = Math.sin(a) * r * power * 0.9;
      s.life[i] = 1.5;
    }
  }

  ripple(p, maxR = 0.8, life = 1.4) {
    const r = this.ripples.find((q) => !q.m.visible) || this.ripples[0];
    r.t = 0; r.life = life; r.r = maxR;
    r.m.position.set(p.x, W.waterLevel(p.z) + 0.03, p.z);
    r.m.visible = true;
  }

  update(dt, focusZ) {
    // splash
    const s = this.sp;
    for (let i = 0; i < this.SP; i++) {
      if (s.life[i] <= 0) continue;
      s.life[i] -= dt;
      s.vel[i * 3 + 1] -= 9.8 * dt;
      s.pos[i * 3] += s.vel[i * 3] * dt; s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt; s.pos[i * 3 + 2] += s.vel[i * 3 + 2] * dt;
      if (s.life[i] <= 0 || (s.vel[i * 3 + 1] < 0 && s.pos[i * 3 + 1] < W.waterLevel(s.pos[i * 3 + 2]))) {
        s.life[i] = 0; s.pos[i * 3 + 1] = -9999;
      }
    }
    this.splashPts.geometry.attributes.position.needsUpdate = true;
    // ripples
    for (const r of this.ripples) {
      if (!r.m.visible) continue;
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) { r.m.visible = false; continue; }
      const sc = 0.05 + r.r * Math.sqrt(k);
      r.m.scale.set(sc, 1, sc);
      r.m.material.opacity = (1 - k) * 0.45;
    }
    // leaves
    const f = this._f;
    const count = this.leafCount ?? this.LN;
    for (let i = 0; i < this.LN; i++) {
      const L = this.leaves[i];
      if (i >= count) { L.z = 9999; }
      else {
        if (L.z > focusZ + 40 || L.z < W.FALL_Z + 2 || L.z > W.Z_MAX - 6 || L.z < focusZ - 60) {
          L.z = Math.max(W.FALL_Z + 3, focusZ - 45 + this.rng() * 70);
          L.x = W.riverCX(L.z) + (this.rng() * 2 - 1) * W.riverHW(L.z) * 0.85;
        }
        W.flowVelocity(L.x, L.z, f);
        L.x += f.x * dt; L.z += f.z * dt;
        L.rot += L.spin * dt;
      }
      const y = L.z > 9000 ? -9999 : W.waterLevel(L.z) + 0.015;
      this._e.set(0, L.rot, 0);
      this._q.setFromEuler(this._e);
      this._v.set(L.x, y, L.z);
      this._m4.compose(this._v, this._q, this._s);
      this.leafMesh.setMatrixAt(i, this._m4);
    }
    this.leafMesh.instanceMatrix.needsUpdate = true;
    // mist
    const m = this.mist;
    for (let i = 0; i < this.MN; i++) {
      m.life[i] -= dt;
      if (m.life[i] <= 0) { this.respawnMist(i); continue; }
      m.pos[i * 3] += m.vel[i * 3] * dt; m.pos[i * 3 + 1] += m.vel[i * 3 + 1] * dt; m.pos[i * 3 + 2] += m.vel[i * 3 + 2] * dt;
    }
    this.mistPts.geometry.attributes.position.needsUpdate = true;
  }
}
