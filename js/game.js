// Fishing game logic / state machine
import * as THREE from 'three';
import * as W from './world.js';
import { SPECIES } from './fish.js';
import { ROD_LEN } from './angler.js';
import { t, tt } from './i18n.js';

export const LINE_LEN = 6.5;
export const CAST_MIN = 2.2, CAST_MAX = 9.8;
const _flow = { x: 0, z: 0 };
const dampAngle = (a, b, k) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
};
const ease = (t) => t * t * (3 - 2 * t);

function loadRecords() {
  let r = null;
  try { r = JSON.parse(localStorage.getItem('keiryu.records')); } catch (e) { /* ignore */ }
  r = r || {};
  r.best = r.best || {}; r.count = r.count || {}; r.total = r.total || 0; r.hiscore = r.hiscore || 0;
  for (const k in r.best) if (!r.count[k]) r.count[k] = 1; // records from older versions
  return r;
}
function saveRecords(r) { try { localStorage.setItem('keiryu.records', JSON.stringify(r)); } catch (e) { /* ignore */ } }

const HINT = { idle: 'hint.idle', drift: 'hint.drift', fight: 'hint.fight', landing: 'hint.landing' };
const HINT_TOMO = { idle: 'hint.tomo.idle', drift: 'hint.tomo.drift' };
export const TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export class Game {
  constructor({ angler, line, fishMgr, effects, ui, audio }) {
    Object.assign(this, { angler, line, fishMgr, effects, ui, audio });
    this.state = 'title';
    this.stateT = 0;
    this.anglerZ = 14;
    this.pos = new THREE.Vector3();
    this.bodyYaw = Math.PI / 2;
    this.rodYaw = Math.PI / 2 - 0.3;
    this.rodPitch = 0.9;
    this.bendAmt = 0.06;
    this.bendDir = new THREE.Vector3(0, -1, 0);
    this.tip = new THREE.Vector3();
    this.bait = { pos: new THREE.Vector3(), natural: 1, dragT: 0 };
    this.aim = { point: new THREE.Vector3(), valid: false, has: false };
    this.castTarget = new THREE.Vector3();
    this.castFrom = null;
    this.walkDir = 0; this.walking = false; this.stepT = 0;
    this.pulling = false;
    this.timeMul = 1;
    this.clockMin = 0;
    this.score = 0; this.catches = [];
    this.records = loadRecords();
    this.lineSag = 0.9;
    this.netOut = 0;
    this.riseT = 4;
    this.time = 0;
    this.taut = 0;
    this.tomo = false;           // 友釣りモード
    this.decoyVigor = 1;         // おとりの元気
    this.decoyTarget = new THREE.Vector3();
    this.decoyVel = new THREE.Vector3();
    this.decoyHeading = 0;
    this.decoyMesh = null;
    this.updateAnglerPos();
  }

  setState(s) {
    this.state = s; this.stateT = 0;
    this.refreshHint();
  }

  refreshHint() {
    const k = (this.tomo && HINT_TOMO[this.state]) || HINT[this.state];
    if (!k) return;
    // タッチ操作のとき（スマホ・アプリ）は、キー名ではなくボタン名で案内する
    const touch = TOUCH && t(k + '.touch') !== k + '.touch';
    this.ui.hint(t(touch ? k + '.touch' : k));
  }

  start(timeMul, clockMin, tomo = false) {
    // 新しい釣行（セッション）を始める
    this.score = 0; this.catches = []; this.redoUsed = 0; this.lastLost = null;
    this.fight = null; this.pulling = false; this.netOut = 0;
    this.ui.fight(false); this.ui.bite(false);
    this.timeMul = timeMul;
    this.clockMin = clockMin;
    this.tomo = tomo;
    this.decoyVigor = 1;
    this.line.setBaitVisible(!tomo);
    this.ui.setStrikeMode(tomo);
    this.setState('idle');
    this.ui.stats(0, 0, this.clockLabel());
  }

  clockLabel() {
    const m = Math.floor(this.clockMin) % (24 * 60);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  updateAnglerPos() {
    const z = this.anglerZ;
    const x = W.anglerPathX(z);
    this.pos.set(x, W.terrainHeight(x, z), z);
  }

  // ---------------------------------------------------------- input
  setAim(p, valid) { this.aim.point.copy(p); this.aim.valid = valid; this.aim.has = true; }
  clearAim() { this.aim.has = false; this.aim.valid = false; }

  checkAim(p) {
    const cx = W.riverCX(p.z), hw = W.riverHW(p.z);
    if (Math.abs(p.x - cx) > hw - 0.3) return false;
    if (p.z < W.FALL_Z + 2) return false;
    const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    return d >= CAST_MIN && d <= CAST_MAX;
  }

  primaryAction() {
    if (this.state === 'bite') return this.strike();
    if (this.tomo && this.state === 'drift') {
      // 友釣り：クリックした所へおとりを泳がせる
      if (this.aim.has) this.decoyTarget.copy(this.aim.point);
      return;
    }
    if ((this.state === 'idle' || this.state === 'drift') && this.aim.valid) this.cast();
    else if (this.state === 'idle' && this.aim.has && !this.aim.valid) this.ui.flash(tt('msg.outOfReach'), 1.5);
  }

  setPulling(on) { this.pulling = on; }

  strike() {
    if (this.state === 'bite') {
      this.ui.bite(false);
      if (Math.random() < 0.08) {
        this.audio.swish();
        this.fishMgr.startFlee(this.biteFish, this.pos);
        this.retrieve();
        this.ui.flash(t('msg.pullOut'), 2);
        return;
      }
      this.startFight(this.biteFish);
    } else if (this.state === 'drift' && this.tomo) {
      this.audio.swish();
      this.retrieve();
      this.ui.flash(t('msg.tomo.retrieved'), 2);
    } else if (this.state === 'drift') {
      this.audio.swish();
      this.fishMgr.spookNear(this.bait.pos, 2.0, 0.8);
      this.rodPitch += 0.3;
      this.retrieve();
      this.ui.flash(tt('msg.whiff'), 2);
    }
  }

  retrieve() {
    this.ui.bite(false);
    this.setState('idle');
  }

  cast() {
    if (this.state === 'drift') this.fishMgr.spookNear(this.bait.pos, 1.0, 0.3);
    this.setState('casting');
    this.castTarget.copy(this.aim.point);
    this.castYaw = Math.atan2(this.castTarget.x - this.pos.x, this.castTarget.z - this.pos.z);
    this.castFrom = null;
    this.audio.swish();
  }

  // ---------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    this.stateT += dt;
    if (this.state !== 'title') this.clockMin += dt * (10 / 60); // 1s = 10 game seconds
    const st = this.state;

    // walking along the bank
    this.walking = false;
    // 流している間も歩ける（仕掛けは回収しない）。目印を追うときは、音を立てないようゆっくり歩く
    this.careful = st === 'drift';
    if (this.walkDir !== 0 && (st === 'idle' || st === 'drift')) {
      const speed = this.careful ? 0.75 : 1.5;
      const nz = W.clamp(this.anglerZ + this.walkDir * speed * dt, W.WALK_MIN, W.WALK_MAX);
      if (nz !== this.anglerZ) { this.anglerZ = nz; this.walking = true; }
    }
    this.updateAnglerPos();

    switch (this.state) {
      case 'title': case 'idle': case 'result': this.updateIdle(dt); break;
      case 'casting': this.updateCasting(dt); break;
      case 'drift': if (this.tomo) this.updateDecoy(dt); else this.updateDrift(dt); break;
      case 'bite': this.updateBite(dt); break;
      case 'fight': this.updateFight(dt); break;
      case 'landing': this.updateLanding(dt); break;
    }

    let wantYaw = this.rodYaw - 0.12;
    if (this.walking) {
      const f = W.flowDir(this.anglerZ);
      // 流している間は、仕掛けの方を向いたまま横歩きで追う
      if (!this.careful) wantYaw = Math.atan2(f.x * this.walkDir, f.z * this.walkDir);
      this.stepT += dt;
      if (this.stepT > (this.careful ? 0.75 : 0.4)) { this.stepT = 0; this.audio.step(); }
    }
    this.bodyYaw = dampAngle(this.bodyYaw, wantYaw, dt * 4);

    // fish
    this.bait.vigor = this.decoyVigor;
    const bite = this.fishMgr.update(dt, {
      bait: this.bait, baitActive: this.state === 'drift', tomo: this.tomo,
      anglerPos: this.pos, anglerMoving: this.walking, anglerCareful: this.careful, timeMul: this.timeMul,
    });
    if (bite && this.state === 'drift') { if (this.tomo) this.onAttackHit(bite); else this.onBite(bite); }
    else if (bite) bite.state = 'hold';
    if (this.tomo && this.state !== 'drift' && this.state !== 'fight' && this.state !== 'landing') {
      this.decoyVigor = Math.min(1, this.decoyVigor + dt * 0.02); // おとり缶で休ませると回復
      if (this.decoyVigor > 0.4) this.tiredShown = false;
    }

    if (this.state !== 'landing' && this.state !== 'result') this.netOut = Math.max(0, this.netOut - dt * 2);

    // angler
    const look = this.state === 'idle' || this.state === 'title' ? (this.aim.has ? this.aim.point : null) : this.bait.pos;
    this.angler.update(dt, {
      pos: this.pos, bodyYaw: this.bodyYaw, rodYaw: this.rodYaw, rodPitch: this.rodPitch,
      bendDir: this.bendDir, bendAmt: this.bendAmt, walking: this.walking, walkRate: this.careful ? 0.55 : 1, time: this.time,
      lookAt: look, netOut: this.netOut,
    });
    this.tip.copy(this.angler.tip);
    if (this.state === 'idle' || this.state === 'title' || this.state === 'result' || (this.state === 'casting' && !this.castFrom)) {
      this.bait.pos.copy(this.angler.leftHandWorld);
    }
    this.updateLine(dt);
    this.updateDecoyMesh(dt);
    this.ambientRises(dt);
    if (this.state !== 'title') this.ui.stats(this.catches.length, this.score, this.clockLabel());
  }

  updateIdle(dt) {
    let yaw = Math.PI / 2 + Math.atan2(W.flowDir(this.anglerZ).x, 1) - 0.25;
    if (this.aim.has) yaw = Math.atan2(this.aim.point.x - this.pos.x, this.aim.point.z - this.pos.z);
    this.rodYaw = dampAngle(this.rodYaw, yaw, dt * 3);
    this.rodPitch = THREE.MathUtils.damp(this.rodPitch, 0.95, 3, dt);
    this.bendAmt = THREE.MathUtils.damp(this.bendAmt, 0.07, 4, dt);
    this.bendDir.set(0, -1, 0);
  }

  updateCasting(dt) {
    const t = this.stateT;
    this.rodYaw = dampAngle(this.rodYaw, this.castYaw, dt * 10);
    if (t < 0.28) this.rodPitch = THREE.MathUtils.lerp(0.95, 1.3, ease(t / 0.28));
    else if (t < 0.52) {
      const k = (t - 0.28) / 0.24;
      this.rodPitch = THREE.MathUtils.lerp(1.3, 0.45, ease(k));
      if (!this.castFrom && k > 0.3) { this.castFrom = this.bait.pos.clone(); this.flightT = 0; }
    } else this.rodPitch = THREE.MathUtils.damp(this.rodPitch, 0.6, 4, dt);
    this.bendAmt = 0.15 + 0.25 * Math.sin(Math.min(1, t / 0.52) * Math.PI);
    this.bendDir.set(0, -1, 0);
    if (this.castFrom) {
      this.flightT += dt;
      const s = Math.min(1, this.flightT / 0.55);
      this.bait.pos.lerpVectors(this.castFrom, this.castTarget, s);
      this.bait.pos.y += 2.2 * 4 * s * (1 - s);
      if (s >= 1) this.land();
    }
  }

  land() {
    const p = this.castTarget;
    if (this.tomo) {
      this.bait.pos.copy(p);
      this.bait.natural = 1; this.bait.dragT = 0;
      this.decoyTarget.copy(p);
      this.setState('drift');
      this.effects.splash(p, 5, 0.5);
      this.effects.ripple(p, 0.5);
      this.audio.plop(0.4);
      return;
    }
    this.bait.pos.copy(p);
    this.bait.natural = 0.6; this.bait.dragT = 0;
    this.driftEndShown = false;
    this.setState('drift');
    this.effects.splash(p, 10, 0.8);
    this.effects.ripple(p, 0.7);
    this.audio.plop(0.7);
    this.fishMgr.spookNear(p, 0.8, 0.6);
  }

  // ---------------------------------------------------------- 友釣り
  updateDecoy(dt) {
    const b = this.bait, vig = this.decoyVigor;
    W.flowVelocity(b.pos.x, b.pos.z, _flow);
    const dx = this.decoyTarget.x - b.pos.x, dz = this.decoyTarget.z - b.pos.z, d = Math.hypot(dx, dz);
    const swim = 0.55 * (0.35 + 0.65 * vig);
    let vx = 0, vz = 0;
    if (d > 0.15) { const s = Math.min(swim, d * 1.5); vx = (dx / d) * s; vz = (dz / d) * s; }
    // 元気なおとりは流れに逆らって泳ぐ。弱ると流される
    const push = 0.12 + 0.55 * (1 - vig);
    vx += _flow.x * push + Math.sin(this.time * 2.3) * 0.05;
    vz += _flow.z * push;
    this.decoyVel.set(vx, 0, vz);
    b.pos.x += vx * dt; b.pos.z += vz * dt;
    const cx = W.riverCX(b.pos.z), hw = W.riverHW(b.pos.z), lim = hw - 0.3;
    b.pos.x = W.clamp(b.pos.x, cx - lim, cx + lim);
    if (b.pos.z < W.FALL_Z + 1.5) b.pos.z = W.FALL_Z + 1.5;
    const wl = W.waterLevel(b.pos.z), bed = W.terrainHeight(b.pos.x, b.pos.z);
    b.pos.y += (Math.max(bed + 0.08, wl - 0.3) - b.pos.y) * Math.min(1, dt * 2);
    if (b.pos.y > wl - 0.05) b.pos.y = wl - 0.05;
    // rod follows the decoy
    const ax = b.pos.x - this.pos.x, az = b.pos.z - this.pos.z, dh = Math.hypot(ax, az);
    this.rodYaw = dampAngle(this.rodYaw, Math.atan2(ax, az), dt * 3);
    const th = W.clamp(dh - 2.6, 1.6, 4.9);
    this.rodPitch = THREE.MathUtils.damp(this.rodPitch, Math.acos(th / ROD_LEN), 2, dt);
    const tdx = b.pos.x - this.tip.x, tdz = b.pos.z - this.tip.z, hd = Math.hypot(tdx, tdz);
    const maxH = Math.sqrt(Math.max(0.25, LINE_LEN * LINE_LEN - (this.tip.y - b.pos.y) ** 2));
    let drag = false;
    if (hd > maxH) { b.pos.x = this.tip.x + (tdx / hd) * maxH; b.pos.z = this.tip.z + (tdz / hd) * maxH; drag = true; }
    this.taut = Math.min(1, hd / maxH);
    b.natural = drag ? 0.2 : 1;
    // 疲れ：泳ぐほど・流れが速いほど・引きずるほど弱る
    this.decoyVigor = Math.max(0, vig - dt * (0.006 + 0.01 * W.flowSpeed(b.pos.z) + (drag ? 0.04 : 0)));
    if (this.decoyVigor < 0.25 && !this.tiredShown) { this.tiredShown = true; this.ui.flash(t('msg.tomo.tired'), 3.5); }
    const sp = Math.hypot(vx, vz);
    const upstream = Math.atan2(W.flowDir(b.pos.z).z, -W.flowDir(b.pos.z).x);
    this.decoyHeading = dampAngle(this.decoyHeading, sp > 0.25 && Math.hypot(dx, dz) > 0.3 ? Math.atan2(-vz, vx) : upstream, dt * 4);
    this.bendAmt = THREE.MathUtils.damp(this.bendAmt, 0.1 + 0.25 * this.taut * this.taut + 0.08 * vig, 4, dt);
    this.bendDir.subVectors(b.pos, this.tip).normalize();
  }

  onAttackHit(fish) {
    // 野アユが体当たりして掛け針に掛かる（合わせ不要）
    this.biteFish = fish;
    this.audio.splash(0.5);
    this.audio.tick(1);
    this.effects.splash(new THREE.Vector3(fish.pos.x, W.waterLevel(fish.pos.z), fish.pos.z), 10, 0.8);
    this.startFight(fish);
    this.ui.bite(true, 'hit');
    setTimeout(() => this.ui.bite(false), 700);
    this.ui.flash(t('msg.tomo.hit'), 2);
    this.vibe([120, 50, 180]);
  }

  updateDecoyMesh(dt) {
    this.ui.decoy(this.tomo && this.state !== 'title', this.decoyVigor);
    const m = this.decoyMesh;
    if (!m) return;
    const st = this.state;
    const show = this.tomo && (st === 'drift' || st === 'fight' || st === 'landing' || (st === 'casting' && this.castFrom));
    m.visible = !!show;
    if (!show) return;
    if (st === 'fight' || st === 'landing') {
      // おとりは掛かった鮎の前（竿側）にいる
      const f = this.fight.fish;
      const dir = new THREE.Vector3().subVectors(this.tip, f.pos).setY(0).normalize();
      m.position.copy(f.pos).addScaledVector(dir, 0.2);
      m.rotation.set(0, Math.atan2(-dir.z, dir.x), 0);
    } else {
      m.position.copy(this.bait.pos);
      m.rotation.set(0, this.decoyHeading, 0);
    }
    this.decoyTail = (this.decoyTail || 0) + dt * (6 + 6 * this.decoyVigor);
    m.userData.tail.rotation.y = Math.sin(this.decoyTail) * (0.15 + 0.25 * this.decoyVigor);
  }

  updateDrift(dt) {
    const b = this.bait;
    W.flowVelocity(b.pos.x, b.pos.z, _flow);
    b.pos.x += (_flow.x * 0.8 + Math.sin(this.stateT * 1.7) * 0.05) * dt;
    b.pos.z += _flow.z * 0.8 * dt;
    const cx = W.riverCX(b.pos.z), hw = W.riverHW(b.pos.z), lim = hw - 0.3;
    let snag = false;
    if (b.pos.x < cx - lim) { b.pos.x = cx - lim; snag = true; }
    if (b.pos.x > cx + lim) { b.pos.x = cx + lim; snag = true; }
    if (b.pos.z < W.FALL_Z + 1.5) b.pos.z = W.FALL_Z + 1.5;
    const wl = W.waterLevel(b.pos.z), bed = W.terrainHeight(b.pos.x, b.pos.z);
    const ty = Math.max(bed + 0.08, wl - 0.42);
    b.pos.y += (ty - b.pos.y) * Math.min(1, dt * 2);
    if (b.pos.y > wl - 0.02) b.pos.y = wl - 0.02;
    // rod follows the drift
    const dx = b.pos.x - this.pos.x, dz = b.pos.z - this.pos.z, dh = Math.hypot(dx, dz);
    this.rodYaw = dampAngle(this.rodYaw, Math.atan2(dx, dz), dt * 3);
    const th = W.clamp(dh - 2.6, 1.6, 4.9);
    this.rodPitch = THREE.MathUtils.damp(this.rodPitch, Math.acos(th / ROD_LEN), 2, dt);
    // line length constraint
    const tdx = b.pos.x - this.tip.x, tdz = b.pos.z - this.tip.z, hd = Math.hypot(tdx, tdz);
    const dy = this.tip.y - b.pos.y;
    const maxH = Math.sqrt(Math.max(0.25, LINE_LEN * LINE_LEN - dy * dy));
    let drag = false;
    if (hd > maxH) { b.pos.x = this.tip.x + (tdx / hd) * maxH; b.pos.z = this.tip.z + (tdz / hd) * maxH; drag = true; }
    this.taut = Math.min(1, hd / maxH);
    const want = drag || snag ? 0.1 : 1;
    b.natural += (want - b.natural) * Math.min(1, dt * (drag ? 4 : 1.2));
    b.dragT = drag || snag ? b.dragT + dt : Math.max(0, b.dragT - dt);
    if (b.dragT > 2.5 && !this.driftEndShown) {
      this.driftEndShown = true;
      this.ui.flash(tt('msg.driftEnd'), 3);
    }
    this.bendAmt = THREE.MathUtils.damp(this.bendAmt, 0.08 + 0.2 * this.taut * this.taut, 4, dt);
    this.bendDir.subVectors(b.pos, this.tip).normalize();
  }

  onBite(fish) {
    this.setState('bite');
    this.biteFish = fish;
    const sp = SPECIES[fish.key];
    this.biteWindow = sp.window * (0.9 + Math.random() * 0.3);
    this.biteOrigin = this.bait.pos.clone();
    const a = Math.random() * Math.PI * 2;
    this.bitePull = new THREE.Vector3(Math.cos(a) * 0.5, -0.45, Math.sin(a) * 0.5 + 0.5).normalize();
    this.tick2 = false;
    this.audio.tick();
    this.ui.bite(true);
    this.vibe(60);
  }

  updateBite(dt) {
    const t = this.stateT;
    const pulse = Math.sin(Math.min(1, t / 0.1) * Math.PI / 2) * (1 - 0.35 * Math.abs(Math.sin(t * 22)));
    this.bait.pos.copy(this.biteOrigin).addScaledVector(this.bitePull, 0.4 * pulse);
    this.bendAmt = THREE.MathUtils.damp(this.bendAmt, 0.3, 10, dt);
    this.bendDir.subVectors(this.bait.pos, this.tip).normalize();
    if (!this.tick2 && t > 0.17) { this.tick2 = true; this.audio.tick(0.7); }
    if (t > this.biteWindow) this.missBite();
  }

  missBite() {
    this.ui.bite(false);
    this.fishMgr.startFlee(this.biteFish, this.pos);
    if (Math.random() < 0.45) {
      this.retrieve();
      this.ui.flash(t('msg.baitStolen'), 2.5);
    } else {
      this.setState('drift');
      this.ui.flash(t('msg.late'), 1.5);
    }
  }

  // ---------------------------------------------------------- fight
  // スマホの振動（対応ブラウザのみ。iOS Safari は非対応）
  vibe(pattern) {
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ignore */ } }
  }

  startFight(fish) {
    const sp = SPECIES[fish.key];
    this.fight = {
      fish, sp, sizeF: (fish.size / 25) * (this.tomo ? 1.3 : 1), stamina: 1, tension: 0.55,
      runT: 0, runPow: 0.6, runDir: new THREE.Vector2(1, 0), high: 0, low: 0, jump: 0, splashT: 0, away: 0, vibT: 0.4,
    };
    fish.state = 'hooked';
    this.ui.bite(false);
    this.setState('fight');
    this.audio.swish();
    this.audio.splash(0.6);
    this.effects.splash(fish.pos.clone().setY(W.waterLevel(fish.pos.z)), 14, 1);
    this.ui.fight(true);
    this.vibe([90, 40, 140]); // 掛かった！
  }

  updateFight(dt) {
    const F = this.fight, f = F.fish;
    const wl = W.waterLevel(f.pos.z);
    const ax = f.pos.x - this.pos.x, az = f.pos.z - this.pos.z;
    const ad = Math.hypot(ax, az) || 1;
    const awayX = ax / ad, awayZ = az / ad;
    F.runT -= dt;
    if (F.runT <= 0) {
      F.runT = 0.7 + Math.random() * 1.6;
      const exhaust = 0.25 + 0.75 * F.stamina;
      F.runPow = (0.25 + 0.75 * Math.random()) * F.sp.power * Math.min(1.6, 0.6 + 0.5 * F.sizeF) * exhaust;
      const fd = W.flowDir(f.pos.z);
      const r = (Math.random() - 0.5) * 2.4;
      let rx = awayX * Math.cos(r) - awayZ * Math.sin(r), rz = awayX * Math.sin(r) + awayZ * Math.cos(r);
      if (Math.random() < 0.3) { rx = -rx; rz = -rz; } // sometimes charges toward the angler
      rx += fd.x * 0.5; rz += fd.z * 0.5;
      const l = Math.hypot(rx, rz) || 1;
      F.runDir.set(rx / l, rz / l);
      if (F.stamina > 0.2 && Math.random() < F.sp.jumpy * F.stamina) F.jump = 0.6;
      // 魚が走り出した瞬間：引きの強さに応じた長さで振動
      if (F.stamina > 0 && F.runPow > 0.45) { this.vibe(Math.round(40 + Math.min(1.5, F.runPow) * 110)); F.vibT = 0.35; }
    }
    let vx, vz;
    if (F.stamina > 0) {
      vx = F.runDir.x * F.runPow * 1.9; vz = F.runDir.y * F.runPow * 1.9;
      const pullSp = this.pulling ? 1.4 * (1 - Math.min(0.85, F.runPow * 0.55)) : 0.12;
      vx -= awayX * pullSp; vz -= awayZ * pullSp;
    } else {
      const sp = this.pulling ? 2.0 : 0.5;
      vx = -awayX * sp; vz = -awayZ * sp;
    }
    f.pos.x += vx * dt; f.pos.z += vz * dt;
    // keep inside river and within line reach
    const cx = W.riverCX(f.pos.z), hw = W.riverHW(f.pos.z);
    f.pos.x = W.clamp(f.pos.x, cx - hw + 0.25, cx + hw - 0.25);
    f.pos.z = W.clamp(f.pos.z, W.FALL_Z + 2, W.Z_MAX - 10);
    const tdx = f.pos.x - this.tip.x, tdz = f.pos.z - this.tip.z, hd = Math.hypot(tdx, tdz);
    const maxH = Math.sqrt(Math.max(0.25, LINE_LEN * LINE_LEN - (this.tip.y - f.pos.y) ** 2));
    let atLimit = false;
    if (hd > maxH) { f.pos.x = this.tip.x + (tdx / hd) * maxH; f.pos.z = this.tip.z + (tdz / hd) * maxH; atLimit = true; }
    // depth / jumping
    const bed = W.terrainHeight(f.pos.x, f.pos.z);
    if (F.jump > 0) {
      const k = 1 - F.jump / 0.6;
      if (k < 0.05 && !F.jumped) { F.jumped = true; this.vibe([30, 30, 160]); F.vibT = 0.4; this.effects.splash(new THREE.Vector3(f.pos.x, wl, f.pos.z), 18, 1.2); this.audio.splash(0.8); }
      F.jump -= dt;
      f.pos.y = wl + Math.sin(k * Math.PI) * 0.45 * Math.min(1.4, F.sizeF);
      f.pitch = (0.5 - k) * 1.6;
      if (F.jump <= 0) { F.jumped = false; f.pitch = 0; this.effects.splash(new THREE.Vector3(f.pos.x, wl, f.pos.z), 16, 1); this.effects.ripple(f.pos, 1.0); this.audio.splash(0.7); }
    } else {
      const ty = F.stamina > 0.3 ? wl - 0.45 : wl - 0.1;
      f.pos.y += (Math.max(bed + 0.08, ty) - f.pos.y) * Math.min(1, dt * 3);
      f.pitch = 0;
    }
    // heading
    const mv = Math.hypot(vx, vz);
    if (mv > 0.05) f.heading = dampAngle(f.heading, Math.atan2(-vz, vx), dt * 6);
    // surface splashes when fish is near the top
    F.splashT -= dt;
    if (f.pos.y > wl - 0.2 && F.splashT <= 0) {
      F.splashT = 0.35;
      this.effects.splash(new THREE.Vector3(f.pos.x, wl, f.pos.z), 5, 0.6);
      this.effects.ripple(f.pos, 0.5, 0.8);
    }
    // tension model
    const awayComp = (vx * awayX + vz * awayZ) / Math.max(0.3, mv);
    let target;
    if (F.stamina > 0) {
      target = 0.1 + F.runPow * 0.55 * (0.35 + 0.65 * W.clamp(awayComp, -1, 1)) + (atLimit ? 0.15 : 0);
      target = Math.min(target, 0.98);
      if (this.pulling) target += 0.4 + (F.jump > 0 ? 0.35 : 0);
    } else target = this.pulling ? 0.55 : 0.2;
    F.tension += (target - F.tension) * Math.min(1, dt * 5) + (Math.random() - 0.5) * 0.03;
    F.tension = Math.max(0, F.tension);
    if (F.tension > 1.0) F.high += dt; else F.high = Math.max(0, F.high - dt * 0.5);
    if (F.tension < 0.14 && F.stamina > 0) F.low += dt; else F.low = Math.max(0, F.low - dt);
    const good = F.tension > 0.35 && F.tension < 0.98 ? 1 : 0.3;
    F.stamina -= (dt * good * (this.pulling ? 0.17 : 0.05)) / Math.max(0.6, F.sizeF * 0.8 * F.sp.power);
    if (F.stamina < 0) F.stamina = 0;
    this.ui.setFight(F.tension, F.stamina);

    // 引きの振動：テンションが高いほど長く。赤ゾーンは糸切れ警告の連続振動
    F.vibT -= dt;
    if (F.vibT <= 0) {
      if (F.tension > 1.0) { this.vibe([50, 35, 50, 35, 50]); F.vibT = 0.32; }
      else if (F.tension > 0.45) { this.vibe(Math.round(15 + (F.tension - 0.45) * 110)); F.vibT = 0.28; }
      else F.vibT = 0.1;
    }

    // rod
    this.rodYaw = dampAngle(this.rodYaw, Math.atan2(f.pos.x - this.pos.x, f.pos.z - this.pos.z), dt * 4);
    this.rodPitch = THREE.MathUtils.damp(this.rodPitch, this.pulling ? 1.25 : 0.85, 4, dt);
    this.bendAmt = THREE.MathUtils.damp(this.bendAmt, 0.1 + F.tension * 1.25, 10, dt);
    this.bendDir.subVectors(f.pos, this.tip).normalize();
    this.bait.pos.copy(f.pos).add(new THREE.Vector3(Math.cos(f.heading), 0, -Math.sin(f.heading)).multiplyScalar(f.size / 200));
    this.fishMgr.list.includes(f) && (f.mesh.position.copy(f.pos));

    if (F.high > 0.4) return this.endFight('break');
    if (F.low > 1.8) return this.endFight('barashi');
    if (F.stamina <= 0 && ad < 2.6) this.startLanding();
  }

  endFight(kind) {
    const f = this.fight.fish;
    // リワード広告で「掛け直す」ために、逃がす直前の様子を覚えておく
    this.lastLost = {
      fish: f, pos: f.pos.clone(), heading: f.heading, fight: { ...this.fight, runDir: this.fight.runDir.clone() },
      decoyVigor: this.decoyVigor, kind,
    };
    f.state = 'hold';
    f.pitch = 0;
    this.fishMgr.startFlee(f, this.pos);
    this.ui.fight(false);
    this.retrieve();
    this.bendAmt = 0.05;
    if (kind === 'break') { this.audio.snap(); this.vibe(300); this.ui.flash(t('msg.break'), 3); if (this.tomo) { this.decoyVigor = 0.8; clearTimeout(this.lostMsgTimer); this.lostMsgTimer = setTimeout(() => this.ui.flash(t('msg.tomo.lostOtori'), 3), 3000); } }
    if (this.onFishLost) this.onFishLost(kind);
    else { this.audio.fail(); this.vibe([40, 90, 40]); this.ui.flash(t('msg.lost'), 3); }
  }

  // リワード広告を最後まで見たとき：逃がした魚を、逃がす直前の状態でもう一度掛ける
  redoFight() {
    const L = this.lastLost;
    if (!L || L.fish.state === 'gone') return false;
    clearTimeout(this.lostMsgTimer);
    const f = L.fish;
    f.pos.copy(L.pos); f.heading = L.heading; f.pitch = 0;
    f.state = 'hooked';
    this.fight = { ...L.fight, fish: f, tension: 0.5, high: 0, low: 0, jump: 0, jumped: false, runT: 0.8 };
    if (this.tomo) this.decoyVigor = L.decoyVigor;
    this.lastLost = null;
    this.redoUsed = (this.redoUsed || 0) + 1;
    this.pulling = false;
    this.ui.bite(false);
    this.setState('fight');
    this.ui.fight(true);
    this.ui.flash(t('msg.redo'), 2);
    this.audio.splash(0.6);
    this.effects.splash(new THREE.Vector3(f.pos.x, W.waterLevel(f.pos.z), f.pos.z), 12, 1);
    return true;
  }

  toTitle() {
    this.fight = null; this.pulling = false; this.walkDir = 0;
    this.ui.fight(false); this.ui.bite(false);
    this.state = 'title'; this.stateT = 0;
  }

  startLanding() {
    this.setState('landing');
    this.ui.fight(false);
  }

  updateLanding(dt) {
    const t = this.stateT, F = this.fight, f = F.fish;
    this.netOut = Math.min(1, t / 0.4);
    this.rodPitch = THREE.MathUtils.damp(this.rodPitch, 1.35, 4, dt);
    this.bendAmt = THREE.MathUtils.damp(this.bendAmt, 0.6, 4, dt);
    const target = this.angler.netWorld.clone();
    target.y += 0.06;
    f.pos.lerp(target, Math.min(1, dt * (t > 0.4 ? 5 : 1.5)));
    f.pitch = 0;
    f.heading = dampAngle(f.heading, this.bodyYaw - Math.PI / 2, dt * 4);
    this.bendDir.subVectors(f.pos, this.tip).normalize();
    this.bait.pos.copy(f.pos);
    if (t > 0.3 && !this.landSplash) { this.landSplash = true; this.audio.splash(0.5); this.effects.splash(f.pos, 10, 0.6); }
    if (t > 1.5) { this.landSplash = false; this.finishCatch(); }
  }

  finishCatch() {
    const f = this.fight.fish, sp = SPECIES[f.key];
    const size = f.size, shaku = size >= 30.3;
    const pts = Math.round(size * sp.points * 10 * (shaku ? 1.5 : 1));
    const weight = Math.round(0.0115 * Math.pow(size, 3));
    const isRecord = size > (this.records.best[f.key] || 0);
    const isNew = !(this.records.count[f.key] > 0);
    const c = { key: f.key, size, pts, shaku, isRecord, isNew, weight, clock: this.clockLabel() };
    this.setState('result');
    this.audio.fanfare();
    this.vibe([40, 60, 40, 60, 160]);
    this.fishMgr.caught(f);
    this.ui.showResult(c, (choice) => {
      const bonus = choice === 'release' ? Math.round(pts * 0.1) : 0;
      this.score += pts + bonus;
      c.choice = choice;
      this.catches.push(c);
      if (isRecord) this.records.best[f.key] = size;
      this.records.count[f.key] = (this.records.count[f.key] || 0) + 1;
      this.records.total = (this.records.total || 0) + 1;
      this.records.hiscore = Math.max(this.records.hiscore || 0, this.score);
      saveRecords(this.records);
      if (choice === 'release') { this.effects.splash(this.angler.netWorld, 8, 0.5); this.audio.plop(0.5); }
      if (choice === 'otori') { this.decoyVigor = 1; this.tiredShown = false; }
      this.ui.flash(t(choice === 'otori' ? 'msg.tomo.newOtori' : choice === 'keep' ? 'msg.kept' : 'msg.released'), 2);
      this.setState('idle');
    }, this.tomo);
  }

  // ---------------------------------------------------------- line & ambience
  updateLine(dt) {
    let sag;
    switch (this.state) {
      case 'casting': sag = this.castFrom ? 0.5 : 0.9; break;
      case 'drift': sag = 0.15 + 0.7 * (1 - this.taut); break;
      case 'bite': sag = 0.04; break;
      case 'fight': sag = 0.25 * Math.max(0, 1 - this.fight.tension); break;
      case 'landing': sag = 0.05; break;
      default: sag = 0.9;
    }
    this.lineSag += (sag - this.lineSag) * Math.min(1, dt * 6);
    this.line.update(this.tip, this.bait.pos, this.lineSag);
  }

  ambientRises(dt) {
    this.riseT -= dt;
    if (this.riseT > 0) return;
    this.riseT = 4 + Math.random() * 9 / this.timeMul;
    const f = this.fishMgr.nearbyHolding(this.pos, 28);
    if (!f) return;
    const p = new THREE.Vector3(f.pos.x, W.waterLevel(f.pos.z), f.pos.z);
    this.effects.ripple(p, 0.9, 1.8);
    this.effects.splash(p, 3, 0.4);
    this.audio.plop(0.15);
  }

  getFocus(out) {
    out.copy(this.pos); out.y += 1.4;
    if (this.state === 'drift' || this.state === 'bite') out.lerp(this.bait.pos, 0.4);
    else if (this.state === 'fight' || this.state === 'landing') out.lerp(this.fight.fish.pos, 0.4);
    else if (this.state === 'casting') out.lerp(this.castTarget, 0.3);
    return out;
  }
}
