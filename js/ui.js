// DOM overlay: HUD, messages, result card (with 3D fish preview), catch log
import * as THREE from 'three';
import { SPECIES, createFishMesh } from './fish.js';

const $ = (id) => document.getElementById(id);

class FishPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
  }
  ensure() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 2, 0.01, 10);
    this.camera.position.set(0, 0.05, 1.25);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x55504a, 1.8));
    const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(1, 2, 2); this.scene.add(d);
  }
  show(key) {
    this.ensure();
    if (this.mesh) this.scene.remove(this.mesh);
    this.mesh = createFishMesh(key, false);
    this.scene.add(this.mesh);
    const r = this.canvas.getBoundingClientRect();
    this.renderer.setSize(r.width || 320, r.height || 160, false);
    this.camera.aspect = (r.width || 320) / (r.height || 160);
    this.camera.updateProjectionMatrix();
    this.running = true;
    const t0 = performance.now();
    const loop = () => {
      if (!this.running) return;
      const t = (performance.now() - t0) / 1000;
      this.mesh.rotation.set(0.1, Math.sin(t * 0.6) * 0.5, Math.sin(t * 3) * 0.04);
      this.mesh.userData.tail.rotation.y = Math.sin(t * 6) * 0.25;
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }
  stop() { this.running = false; }
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
  message(text, dur = 0) {
    this.msg.textContent = text;
    this.msg.classList.toggle('show', !!text);
    clearTimeout(this.msgTimer);
    if (dur > 0) this.msgTimer = setTimeout(() => this.message(this.baseMsg || ''), dur * 1000);
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
  bite(on) { this.biteEl.classList.toggle('show', on); }
  fight(on) { this.fightEl.classList.toggle('show', on); }
  setFight(tension, stamina) {
    const t = Math.min(1, tension / 1.2);
    this.tensionFill.style.width = (t * 100).toFixed(1) + '%';
    this.tensionFill.dataset.zone = tension > 1.0 ? 'danger' : tension < 0.15 ? 'slack' : tension > 0.85 ? 'warn' : 'ok';
    this.staminaFill.style.width = (Math.max(0, stamina) * 100).toFixed(1) + '%';
  }
  stats(count, score, timeLabel) {
    $('catchCount').textContent = count;
    $('score').textContent = score;
    if (timeLabel) $('timeLabel').textContent = timeLabel;
  }
  showResult(c, onClose) {
    const sp = SPECIES[c.key];
    $('resName').textContent = sp.name;
    $('resSize').textContent = c.size.toFixed(1) + ' cm';
    $('resWeight').textContent = '約 ' + c.weight + ' g';
    $('resPts').textContent = '+' + c.pts + ' pt';
    $('resDesc').textContent = sp.desc;
    $('resBadges').innerHTML = (c.shaku ? '<span class="badge gold">尺物！</span>' : '') + (c.isRecord ? '<span class="badge">自己記録更新</span>' : '');
    const modal = $('resultModal');
    modal.classList.add('show');
    this.preview.show(c.key);
    const done = (keep) => {
      modal.classList.remove('show');
      this.preview.stop();
      $('btnKeep').onclick = $('btnRelease').onclick = null;
      onClose(keep);
    };
    $('btnKeep').onclick = () => done(true);
    $('btnRelease').onclick = () => done(false);
  }
  showLog(catches, records) {
    const body = $('logBody');
    const rows = Object.keys(SPECIES).map((k) => {
      const n = catches.filter((c) => c.key === k).length;
      const best = records.best[k];
      return `<tr><td>${SPECIES[k].name}</td><td>${n} 尾</td><td>${best ? best.toFixed(1) + ' cm' : '—'}</td></tr>`;
    }).join('');
    const recent = catches.slice(-8).reverse().map((c) =>
      `<li>${c.clock} ${SPECIES[c.key].name} ${c.size.toFixed(1)}cm ${c.keep ? '（キープ）' : '（リリース）'}</li>`).join('') || '<li>まだ釣果はありません</li>';
    body.innerHTML = `<table><thead><tr><th>魚種</th><th>今回</th><th>自己記録</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="hi">ハイスコア: <b>${records.hiscore || 0}</b> pt ／ 通算 ${records.total || 0} 尾</p>
      <h3>今回の釣果</h3><ul>${recent}</ul>`;
    $('logModal').classList.add('show');
  }
}
