// Procedural audio: stream ambience, waterfall, birds, and sound effects (WebAudio, no assets)
export class AudioSys {
  constructor() { this.ctx = null; this.enabled = true; }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
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
    const fall = Math.max(0, 1 - fallDist / 70);
    this.fallGain.gain.setTargetAtTime(fall * fall * 0.9, t, 0.5);
    this.streamGain.gain.setTargetAtTime(0.32 + riffle * 0.25, t, 0.5);
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
