// Procedural audio: stream ambience, waterfall, birds, and sound effects (WebAudio, no assets)
export class AudioSys {
  constructor() { this.ctx = null; this.enabled = true; this.holds = new Set(); }

  // 広告の表示中・別アプリに切り替えた間は音を止める（理由ごとに止め、すべて外れたら再開）
  suspend(reason = 'ad') {
    this.holds.add(reason);
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }
  resume(reason = 'ad') {
    this.holds.delete(reason);
    if (this.ctx && !this.holds.size && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let ctx;
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
    this.ctx = ctx;
    // iOS などで中断された音声を、画面に戻ったとき・触れたときに再開する
    const resume = () => { if (!this.holds.size && ctx.state !== 'running') ctx.resume().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
    window.addEventListener('pointerdown', resume, { passive: true });
    window.addEventListener('keydown', resume);
    this.master = ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 3;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0), b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const r = Math.random() * 2 - 1;
      w[i] = r;
      last = (last + 0.02 * r) / 1.02; b[i] = last * 3.5;
    }
    // stream
    this.streamGain = this.loop(this.brown, 'lowpass', 750, 0.6, 0.45);
    this.babbleGain = this.loop(this.white, 'bandpass', 1900, 0.7, 0.05);
    this.fallGain = this.loop(this.brown, 'lowpass', 420, 0.5, 0.0);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.23;
    const lg = ctx.createGain(); lg.gain.value = 0.025;
    lfo.connect(lg); lg.connect(this.babbleGain.gain); lfo.start();
    this.scheduleBird();
  }

  loop(buf, type, freq, q, gain) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(0, Math.random() * 2);
    return g;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.1);
  }

  setAmbience(fallDist, riffle) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // 毎フレーム呼ばれるので、0.5秒に1回・値が変わった時だけ音量を更新する
    if (this._ambT && t - this._ambT < 0.5) return;
    this._ambT = t;
    const fall = Math.max(0, 1 - fallDist / 70);
    const fg = Math.round(fall * fall * 0.9 * 100) / 100, sg = Math.round((0.32 + riffle * 0.25) * 100) / 100;
    if (fg === this._fg && sg === this._sg) return;
    this._fg = fg; this._sg = sg;
    this.fallGain.gain.cancelScheduledValues(t);
    this.fallGain.gain.setTargetAtTime(fg, t, 0.5);
    this.streamGain.gain.cancelScheduledValues(t);
    this.streamGain.gain.setTargetAtTime(sg, t, 0.5);
  }

  noiseBurst(dur, type, freq, gain, q = 1, freqEnd = null, buf = null) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = buf || this.white;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 2); src.stop(t + dur + 0.05);
  }

  tone(freq, dur, type = 'sine', gain = 0.2, when = 0, freqEnd = null) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  plop(v = 1) { this.noiseBurst(0.25, 'bandpass', 900, 0.5 * v, 1.2, 300); this.tone(420, 0.12, 'sine', 0.15 * v, 0, 160); }
  splash(v = 1) { this.noiseBurst(0.5, 'bandpass', 1400, 0.6 * v, 0.6, 500); }
  swish() { this.noiseBurst(0.22, 'bandpass', 3200, 0.25, 2, 700); }
  tick(v = 1) { this.tone(2100, 0.04, 'square', 0.06 * v); this.noiseBurst(0.05, 'highpass', 3000, 0.12 * v); }
  snap() { this.tone(3200, 0.05, 'square', 0.15); this.noiseBurst(0.15, 'highpass', 2500, 0.35); }
  step() { this.noiseBurst(0.09, 'bandpass', 1300 + Math.random() * 500, 0.18, 0.8); }
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.16, i * 0.11)); }
  fail() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.12, i * 0.14)); }

  scheduleBird() {
    const next = 4000 + Math.random() * 9000;
    setTimeout(() => { this.bird(); this.scheduleBird(); }, next);
  }
  bird() {
    if (!this.ctx || !this.enabled) return;
    const kind = Math.random();
    if (kind < 0.5) {
      const n = 2 + ((Math.random() * 4) | 0), base = 2600 + Math.random() * 1500;
      for (let i = 0; i < n; i++) this.tone(base, 0.09, 'sine', 0.035, i * 0.14, base * 1.35);
    } else if (kind < 0.8) {
      this.tone(3800, 0.25, 'sine', 0.03, 0, 2400);
      this.tone(4200, 0.18, 'sine', 0.03, 0.3, 3000);
    } else {
      for (let i = 0; i < 6; i++) this.tone(5000 + Math.random() * 800, 0.04, 'sine', 0.02, i * 0.06);
    }
  }
}

// ---------------------------------------------------------------------------
// BGM: 琴（箏）と尺八風の和風BGMをその場で作曲・合成（陽音階）
// ---------------------------------------------------------------------------
const YO = [0, 2, 5, 7, 9]; // 陽音階（D E G A B）
const ROOT = 146.83;          // D3
const hz = (deg, oct = 0) => {
  const n = YO.length;
  const o = Math.floor(deg / n), d = ((deg % n) + n) % n;
  return ROOT * Math.pow(2, oct + o + YO[d] / 12);
};

export class BGM {
  constructor(audio) {
    this.audio = audio;
    this.on = true;
    try { this.on = localStorage.getItem('keiryu.bgm') !== 'off'; } catch (e) { /* ignore */ }
    this.mood = 'calm';
    this.started = false;
    this.deg = 5;
  }

  start() {
    const a = this.audio;
    if (!a.ctx || this.started) return;
    this.started = true;
    const ctx = a.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = this.on ? 0.32 : 0;
    // simple reverb (generated impulse response)
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.mobile = mobile;
    const len = Math.floor(ctx.sampleRate * (mobile ? 1.4 : 3));
    const ch = mobile ? 1 : 2;
    const ir = ctx.createBuffer(ch, len, ctx.sampleRate);
    for (let c = 0; c < ch; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.45;
    this.dry = ctx.createGain(); this.dry.gain.value = 1;
    this.dry.connect(this.out); this.dry.connect(this.rev); this.rev.connect(wet); wet.connect(this.out);
    this.out.connect(a.master);
    this.startDrone();
    this.next(ctx.currentTime + 0.5);
  }

  setOn(on) {
    this.on = on;
    try { localStorage.setItem('keiryu.bgm', on ? 'on' : 'off'); } catch (e) { /* ignore */ }
    if (this.out) this.out.gain.setTargetAtTime(on ? 0.32 : 0, this.audio.ctx.currentTime, 0.4);
  }

  setMood(m) {
    if (m === this.mood) return;
    this.mood = m;
    if (!this.started) return;
    this.droneGain.gain.setTargetAtTime(m === 'fight' ? 0.05 : 0.035, this.audio.ctx.currentTime, 1);
    if (m === 'fight') { clearTimeout(this.timer); this.next(this.audio.ctx.currentTime + 0.15); }
  }

  startDrone() {
    const ctx = this.audio.ctx;
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0.035;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    for (const [f, det] of [[ROOT / 2, -4], [ROOT / 2, 4], [ROOT * 0.75, 0]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start();
    }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.015;
    lfo.connect(lg); lg.connect(this.droneGain.gain); lfo.start();
    lp.connect(this.droneGain); this.droneGain.connect(this.dry);
  }

  // 箏（琴）: 撥弦の減衰音
  koto(f, t, vel = 1, dur = 2.2) {
    const ctx = this.audio.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 9, t); lp.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.6);
    const parts = this.mobile ? [['triangle', 1, 1], ['sine', 2, 0.35]] : [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 3.01, 0.12]];
    for (const [type, mul, amp] of parts) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f * mul, t);
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    }
    lp.connect(g); g.connect(this.dry);
  }

  // 尺八風: ゆっくり立ち上がり、下からしゃくり上げ、遅れてビブラート＋息の音
  flute(f, t, dur) {
    const ctx = this.audio.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.35);
    g.gain.setValueAtTime(0.09, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.3);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f;
    const o2g = ctx.createGain(); o2g.gain.value = 0.25;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(0, t + dur * 0.4); vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.75);
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    // breath noise
    const n = ctx.createBufferSource(); n.buffer = this.audio.white; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2;
    const ng = ctx.createGain(); ng.gain.value = 0.18;
    n.connect(bp); bp.connect(ng); ng.connect(g);
    o.connect(g); o2.connect(o2g); o2g.connect(g); g.connect(this.dry);
    for (const s of [o, o2, vib, n]) { s.start(t); s.stop(t + dur + 0.1); }
  }

  // 太鼓風の低い打音（ファイト中）
  drum(t, vel = 1) {
    const ctx = this.audio.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28 * vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(this.dry); o.start(t); o.stop(t + 0.55);
  }

  step(d) { this.deg = Math.max(2, Math.min(12, this.deg + d)); return this.deg; }

  // 1フレーズ分をまとめて予約し、終わる頃に次を予約する
  next(t0) {
    const a = this.audio;
    if (!a.ctx) return;
    const fight = this.mood === 'fight';
    const beat = fight ? 0.32 : 0.62;
    let t = t0, len;
    const r = Math.random();
    if (fight) {
      // 速い琴のリズム＋太鼓
      for (let i = 0; i < 16; i++) {
        if (i % 4 === 0) this.drum(t + i * beat * 0.5, i % 8 === 0 ? 1 : 0.6);
        if (Math.random() < 0.75) {
          const d = this.step([-1, 1, 1, -2, 2][(Math.random() * 5) | 0]);
          this.koto(hz(d), t + i * beat * 0.5, 0.6 + Math.random() * 0.3, 1.2);
        }
      }
      len = 16 * beat * 0.5;
    } else if (r < 0.55) {
      // 琴のフレーズ（ゆったり、間をとる）
      const n = 6 + ((Math.random() * 5) | 0);
      let k = 0;
      for (let i = 0; i < n; i++) {
        const d = this.step([-1, 1, -2, 2, 1, -1, 3][(Math.random() * 7) | 0]);
        const at = t + k * beat;
        this.koto(hz(d), at, 0.7 + Math.random() * 0.3);
        if (Math.random() < 0.25) this.koto(hz(d + 2), at + beat * 0.5, 0.5); // 合わせ爪風
        k += Math.random() < 0.3 ? 2 : 1;
      }
      this.koto(hz(0), t + k * beat, 0.6, 3.5); // 終止（主音）
      len = (k + 4) * beat;
    } else if (r < 0.85) {
      // 尺八の長い音
      const n = 2 + ((Math.random() * 3) | 0);
      let at = t;
      for (let i = 0; i < n; i++) {
        const d = this.step([-1, 1, -2, 2][(Math.random() * 4) | 0]);
        const dur = 1.6 + Math.random() * 2.2;
        this.flute(hz(d, 1), at, dur);
        if (i === 0) this.koto(hz(d - 5), at, 0.5, 3);
        at += dur + 0.15;
      }
      len = at - t + 2.5;
    } else {
      len = 4 + Math.random() * 4; // 静寂（川の音だけ）
    }
    const ms = Math.max(300, (t0 + len - a.ctx.currentTime - 1.0) * 1000); // 1秒前に次を予約（描画が重くても途切れない）
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.next(Math.max(a.ctx.currentTime + 0.1, t0 + len)), ms);
  }
}
