// DOM overlay: HUD, messages, result card (with 3D fish preview), catch log, fish book (図鑑)
import * as THREE from 'three';
import { SPECIES, createFishMesh } from './fish.js';
import { t, fishName } from './i18n.js';

const $ = (id) => document.getElementById(id);

class FishPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
    this.images = {};
  }
  ensure() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 2, 0.01, 10);
    this.camera.position.set(0, 0.05, 1.25);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x55504a, 1.8));
    const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(1, 2, 2); this.scene.add(d);
  }
  setSize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  show(key) {
    this.ensure();
    if (this.mesh) this.scene.remove(this.mesh);
    this.mesh = createFishMesh(key, false);
    this.scene.add(this.mesh);
    const r = this.canvas.getBoundingClientRect();
    this.setSize(r.width || 320, r.height || 160);
    this.running = true;
    const t0 = performance.now();
    const loop = () => {
      if (!this.running) return;
      const tt = (performance.now() - t0) / 1000;
      this.mesh.rotation.set(0.1, Math.sin(tt * 0.6) * 0.5, Math.sin(tt * 3) * 0.04);
      this.mesh.userData.tail.rotation.y = Math.sin(tt * 6) * 0.25;
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }
  stop() { this.running = false; }
  // still image of a species for the fish book
  image(key) {
    if (this.images[key]) return this.images[key];
    this.ensure();
    const wasRunning = this.running;
    this.running = false;
    if (this.mesh) this.scene.remove(this.mesh);
    const m = createFishMesh(key, false);
    m.rotation.set(0.12, 0.25, 0);
    m.userData.tail.rotation.y = 0.2;
    this.scene.add(m);
    this.setSize(440, 180);
    this.renderer.render(this.scene, this.camera);
    this.images[key] = this.canvas.toDataURL('image/png');
    this.scene.remove(m);
    if (wasRunning) this.running = true;
    return this.images[key];
  }
}

export class UI {
  constructor() {
    this.msg = $('message');
    this.biteEl = $('biteAlert');
    this.fightEl = $('fightHud');
    this.tensionFill = $('tensionFill');
    this.staminaFill = $('staminaFill');
    this.preview = new FishPreview($('fishPreview'));
    this.msgTimer = null;
  }
  hint(text) {
    this.baseMsg = text;
    if (this._busy) return;
    this.msg.textContent = text;
    this.msg.classList.toggle('show', !!text);
  }
  flash(text, dur = 2) {
    this._busy = true;
    this.msg.textContent = text; this.msg.classList.add('show');
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { this._busy = false; this.msg.textContent = this.baseMsg || ''; this.msg.classList.toggle('show', !!this.baseMsg); }, dur * 1000);
  }
  bite(on, key = 'bite') { if (on) this.biteEl.textContent = t(key); this.biteEl.classList.toggle('show', on); }
  fight(on) { this.fightEl.classList.toggle('show', on); document.body.classList.toggle('fighting', on); }
  decoy(on, vigor = 1) {
    $('decoyHud').classList.toggle('show', on);
    $('vigorFill').style.width = (Math.max(0, vigor) * 100).toFixed(1) + '%';
  }
  setStrikeMode(tomo) {
    $('strikeLabel').dataset.i18n = tomo ? 'btn.strike.tomo' : 'btn.strike';
    $('strikeLabel').textContent = t($('strikeLabel').dataset.i18n);
  }
  setFight(tension, stamina) {
    const tt = Math.min(1, tension / 1.2);
    this.tensionFill.style.width = (tt * 100).toFixed(1) + '%';
    this.tensionFill.dataset.zone = tension > 1.0 ? 'danger' : tension < 0.15 ? 'slack' : tension > 0.85 ? 'warn' : 'ok';
    this.staminaFill.style.width = (Math.max(0, stamina) * 100).toFixed(1) + '%';
  }
  stats(count, score, timeLabel) {
    $('catchCount').textContent = count;
    $('score').textContent = score;
    if (timeLabel) $('timeLabel').textContent = timeLabel;
  }
  /** onClose(choice): choice = 'release' | 'keep' | 'otori' */
  showResult(c, onClose, tomo = false) {
    this.currentCatch = c;
    $('resName').textContent = fishName(c.key);
    $('resSize').textContent = c.size.toFixed(1) + ' cm';
    $('resWeight').textContent = t('res.weight', { g: c.weight });
    $('resPts').textContent = '+' + c.pts + ' pt';
    $('resDesc').textContent = t('fish.' + c.key + '.desc');
    $('resBadges').innerHTML = (c.isNew ? `<span class="badge">${t('res.new')}</span>` : '')
      + (c.shaku ? `<span class="badge gold">${t('res.shaku')}</span>` : '')
      + (c.isRecord && !c.isNew ? `<span class="badge">${t('res.record')}</span>` : '');
    const keepBtn = $('btnKeep');
    const keepChoice = tomo && c.key === 'ayu' ? 'otori' : 'keep';
    keepBtn.textContent = t(keepChoice === 'otori' ? 'res.otori' : 'res.keep');
    const modal = $('resultModal');
    modal.classList.add('show');
    this.preview.show(c.key);
    const done = (choice) => {
      modal.classList.remove('show');
      this.preview.stop();
      keepBtn.onclick = $('btnRelease').onclick = null;
      onClose(choice);
    };
    keepBtn.onclick = () => done(keepChoice);
    $('btnRelease').onclick = () => done('release');
  }
  showLog(catches, records) {
    const rows = Object.keys(SPECIES).map((k) => {
      const n = catches.filter((c) => c.key === k).length;
      const best = records.best[k];
      return `<tr><td>${fishName(k)}</td><td>${t('log.count', { n })}</td><td>${best ? best.toFixed(1) + ' cm' : '—'}</td></tr>`;
    }).join('');
    const tag = { keep: t('log.keep'), release: t('log.release'), otori: t('log.otori') };
    const recent = catches.slice(-8).reverse().map((c) =>
      `<li>${c.clock} ${fishName(c.key)} ${c.size.toFixed(1)}cm ${tag[c.choice] || ''}</li>`).join('') || `<li>${t('log.none')}</li>`;
    $('logBody').innerHTML = `<table><thead><tr><th>${t('log.species')}</th><th>${t('log.now')}</th><th>${t('log.best')}</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="hi">${t('log.hiscore', { s: records.hiscore || 0, n: records.total || 0 })}</p>
      <h3>${t('log.recent')}</h3><ul>${recent}</ul>`;
    $('logModal').classList.add('show');
  }
  showZukan(records) {
    const keys = Object.keys(SPECIES);
    const counts = records.count || {};
    const found = keys.filter((k) => counts[k] > 0 || records.best[k]);
    $('zukanProgress').textContent = t('zukan.progress', { n: found.length, total: keys.length });
    $('zukanBody').innerHTML = keys.map((k) => {
      const sp = SPECIES[k];
      const known = found.includes(k);
      const img = this.preview.image(k);
      if (!known) {
        return `<div class="zcard unknown"><div class="zimg"><img src="${img}" alt=""></div><div class="zn">${t('zukan.unknown')}</div>
          <div class="zd">${t(sp.tomo ? 'zukan.hint.tomo' : 'zukan.hint.bait')}</div>
          <table><tr><td>${t('zukan.where')}</td><td>${t('fish.' + k + '.where')}</td></tr></table></div>`;
      }
      return `<div class="zcard"><div class="zimg"><img src="${img}" alt="${fishName(k)}"></div><div class="zn">${fishName(k)}</div>
        <div class="zd">${t('fish.' + k + '.desc')}</div>
        <table>
          <tr><td>${t('zukan.size')}</td><td>${sp.min}–${sp.max} cm</td></tr>
          <tr><td>${t('zukan.where')}</td><td>${t('fish.' + k + '.where')}</td></tr>
          <tr><td>${t('zukan.best')}</td><td>${records.best[k] ? records.best[k].toFixed(1) + ' cm' : '—'}</td></tr>
          <tr><td>${t('zukan.total')}</td><td>${counts[k] || 1}</td></tr>
        </table></div>`;
    }).join('');
    $('zukanModal').classList.add('show');
  }
}
