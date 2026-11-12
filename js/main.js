import * as THREE from 'three';
import * as W from './world.js';
import { shared } from './shared.js';
import { buildTerrain, buildRocks, buildVegetation, SEASONS } from './terrain.js';
import { buildWater, Effects } from './water.js';
import { buildSky } from './sky.js';
import { Angler, FishingLine } from './angler.js';
import { FishManager } from './fish.js';
import { Game } from './game.js';
import { AudioSys, BGM } from './audio.js';
import { UI } from './ui.js';
import { createFishMesh } from './fish.js';
import { t, tt, setLang, getLang, applyStatic, onLangChange, fishName } from './i18n.js';
import { Ads, isNative, plugin } from './ads.js';
import { TOUCH } from './game.js';

applyStatic();

const $ = (id) => document.getElementById(id);
const lc = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.SRGBColorSpace);

const TIMES = {
  morning: {
    label: '朝マズメ', clock: 5 * 60 + 40, elev: 14, azim: -160, sun: [1.0, 0.8, 0.62], sunI: 3.6,
    hemiSky: [0.62, 0.7, 0.86], hemiGround: [0.36, 0.32, 0.24], hemiI: 2.0,
    top: [0.36, 0.53, 0.8], horizon: [0.96, 0.84, 0.74], fog: [0.8, 0.8, 0.82], fogD: 0.0095, exposure: 1.1, bite: 1.6,
  },
  noon: {
    label: '日中', clock: 12 * 60 + 10, elev: 58, azim: 150, sun: [1.0, 0.96, 0.9], sunI: 3.8,
    hemiSky: [0.66, 0.76, 0.95], hemiGround: [0.36, 0.33, 0.24], hemiI: 1.9,
    top: [0.22, 0.44, 0.86], horizon: [0.74, 0.84, 0.95], fog: [0.74, 0.81, 0.9], fogD: 0.006, exposure: 0.95, bite: 1.0,
  },
  evening: {
    label: '夕マズメ', clock: 17 * 60 + 20, elev: 11, azim: 25, sun: [1.0, 0.6, 0.34], sunI: 3.6,
    hemiSky: [0.62, 0.57, 0.72], hemiGround: [0.36, 0.28, 0.22], hemiI: 1.8,
    top: [0.3, 0.34, 0.62], horizon: [1.0, 0.64, 0.44], fog: [0.76, 0.62, 0.58], fogD: 0.009, exposure: 1.05, bite: 1.5,
  },
};

// ------------------------------------------------------------------ renderer
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const IS_MOBILE = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
scene.fog = new THREE.FogExp2(0xcccccc, 0.008);

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
const sc = sun.shadow.camera;
sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 1; sc.far = 260;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const setLoading = (t) => { $('loadingText').textContent = t; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

let world;

async function build() {
  const season = 'autumn';
  setLoading(t('load.terrain')); await nextFrame();
  const terrain = buildTerrain(season);
  scene.add(terrain.mesh);
  setLoading(t('load.rocks')); await nextFrame();
  const rocks = buildRocks();
  rocks.meshes.forEach((m) => scene.add(m));
  setLoading(t('load.forest')); await nextFrame();
  const veg = buildVegetation(season);
  veg.meshes.forEach((m) => scene.add(m));
  setLoading(t('load.river')); await nextFrame();
  const water = buildWater(rocks.list);
  scene.add(water.mesh);
  const sky = buildSky();
  scene.add(sky.mesh);
  const effects = new Effects(scene);
  setLoading(t('load.fish')); await nextFrame();
  const fishMgr = new FishManager(scene, rocks.list);
  const angler = new Angler();
  angler.addTo(scene);
  const line = new FishingLine(scene);
  const ui = new UI();
  const audio = new AudioSys();
  const bgm = new BGM(audio);
  const game = new Game({ angler, line, fishMgr, effects, ui, audio });
  // 友釣りのおとり（養殖アユ）
  game.decoyMesh = createFishMesh('ayu', true);
  game.decoyMesh.scale.setScalar(0.2);
  game.decoyMesh.visible = false;
  scene.add(game.decoyMesh);
  // aim marker
  const aimMesh = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.85, depthWrite: false }));
  aimMesh.renderOrder = 5;
  scene.add(aimMesh);
  world = { terrain, rocks, veg, water, sky, effects, fishMgr, angler, line, ui, audio, bgm, game, aimMesh };
  refreshButtons();
  applyPreset('morning', season);
  game.onFishLost = () => offerRedo();
  Ads.setSound(audio);
  window.__keiryu = world; // @web-only（テスト・撮影用）
}

function applyPreset(timeKey, seasonKey) {
  const T = TIMES[timeKey];
  const el = THREE.MathUtils.degToRad(T.elev), az = THREE.MathUtils.degToRad(T.azim);
  shared.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  const sunC = lc(T.sun);
  sun.color.copy(sunC); sun.intensity = T.sunI;
  shared.uSunColor.value.copy(sunC).multiplyScalar(T.sunI * 0.55);
  hemi.color.copy(lc(T.hemiSky)); hemi.groundColor.copy(lc(T.hemiGround)); hemi.intensity = T.hemiI;
  scene.fog.color.copy(lc(T.fog)); scene.fog.density = T.fogD;
  renderer.toneMappingExposure = T.exposure;
  const sk = world.sky.uniforms;
  sk.uTop.value.copy(lc(T.top)); sk.uHorizon.value.copy(lc(T.fog).lerp(lc(T.horizon), 0.5));
  const wu = world.water.uniforms;
  wu.uSkyTop.value.copy(lc(T.top));
  wu.uSkyHorizon.value.copy(lc(T.horizon));
  wu.uForest.value.copy(lc([0.1, 0.14, 0.08])).multiply(lc(T.hemiSky)).multiplyScalar(T.hemiI * 0.8);
  wu.uDeep.value.copy(lc([0.03, 0.2, 0.17]));
  wu.uShallow.value.copy(lc([0.4, 0.6, 0.5]));
  wu.uAmbient.value.copy(lc(T.hemiSky)).multiplyScalar(T.hemiI * 0.45);
  world.terrain.recolor(seasonKey);
  world.veg.setSeason(seasonKey);
  world.effects.setSeason(SEASONS[seasonKey]);
  world.preset = T;
}

// ------------------------------------------------------------------ camera
const cam = { yaw: -0.32, pitch: 0.28, dist: 8.5, pos: new THREE.Vector3(), focus: new THREE.Vector3(), init: false };
const _f = new THREE.Vector3();
function updateCamera(dt, titleMode) {
  const game = world.game;
  game.getFocus(_f);
  if (!cam.init) { cam.focus.copy(_f); }
  cam.focus.lerp(_f, Math.min(1, dt * 2.5));
  let yaw = cam.yaw, pitch = cam.pitch, dist = cam.dist;
  if (titleMode) { yaw = -0.32 + Math.sin(performance.now() * 0.00008) * 0.22; pitch = 0.34; dist = 11; }
  const desired = new THREE.Vector3(
    cam.focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    cam.focus.y + Math.sin(pitch) * dist,
    cam.focus.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  const ground = W.terrainHeight(desired.x, desired.z) + 0.8;
  if (desired.y < ground) desired.y = ground;
  if (!cam.init) { cam.pos.copy(desired); cam.init = true; }
  cam.pos.lerp(desired, Math.min(1, dt * 4));
  camera.position.copy(cam.pos);
  camera.lookAt(cam.focus);
}

// ------------------------------------------------------------------ input
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function aimAt(clientX, clientY) {
  if (!world) return;
  const game = world.game;
  ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  // intersect with the sloped water plane y = -WL_SLOPE * z
  const den = d.y + W.WL_SLOPE * d.z;
  if (Math.abs(den) < 1e-6) return;
  const t = (-W.WL_SLOPE * o.z - o.y) / den;
  if (t <= 0 || t > 200) { game.clearAim(); return; }
  const p = new THREE.Vector3().copy(o).addScaledVector(d, t);
  p.y = W.waterLevel(p.z);
  game.setAim(p, game.checkAim(p));
}

const pointers = new Map();
let rotating = false, pinch = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (!world || screen !== 'play') return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: e.pointerType });
  const game = world.game;
  if (e.button === 2 || e.button === 1) { rotating = true; return; }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    game.setPulling(false);
    return;
  }
  aimAt(e.clientX, e.clientY);
  if (game.state === 'fight') { game.setPulling(true); return; }
  if (game.state === 'bite') { game.strike(); return; }
  if (e.pointerType === 'mouse') game.primaryAction();
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (p) {
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (rotating) { cam.yaw -= dx * 0.005; cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, 0.05, 1.3); return; }
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      cam.dist = THREE.MathUtils.clamp(cam.dist * (pinch.d / Math.max(1, d)), 3, 20);
      cam.yaw -= (mx - pinch.mx) * 0.006;
      cam.pitch = THREE.MathUtils.clamp(cam.pitch + (my - pinch.my) * 0.004, 0.05, 1.3);
      pinch = { d, mx, my };
      return;
    }
  }
  if (e.pointerType === 'mouse' || p) aimAt(e.clientX, e.clientY);
});
const endPointer = (e) => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (!world) return;
  const game = world.game;
  if (rotating && pointers.size === 0) { rotating = false; return; }
  if (pinch) { if (pointers.size < 2) pinch = pointers.size === 0 ? null : pinch; if (pointers.size === 0) pinch = null; return; }
  if (game.state === 'fight') game.setPulling(false);
  if (p && p.type !== 'mouse' && e.type === 'pointerup' && Math.hypot(p.x - p.sx, p.y - p.sy) < 14 && (game.state === 'idle' || game.state === 'drift')) {
    game.primaryAction();
  }
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + e.deltaY * 0.001), 3, 20);
}, { passive: false });

const keys = new Set();
function updateWalk() {
  if (!world) return;
  const up = keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('btnUp');
  const down = keys.has('KeyD') || keys.has('ArrowRight') || keys.has('btnDown');
  world.game.walkDir = up && !down ? -1 : down && !up ? 1 : 0;
}
window.addEventListener('keydown', (e) => {
  if (!world) return;
  if (e.code === 'Escape') {
    const open = [...document.querySelectorAll('.modal.closable.show')];
    if (open.length) { open.forEach((m) => m.classList.remove('show')); if (open.some((m) => m.id === 'helpModal')) onHelpClosed(); }
    else if (screen === 'play') pauseGame();
    else if (screen === 'paused') resumeGame();
    return;
  }
  if (screen !== 'play') return;
  if (e.repeat && e.code === 'Space') { e.preventDefault(); return; }
  keys.add(e.code);
  const game = world.game;
  if (e.code === 'Space') {
    e.preventDefault();
    if (game.state === 'fight') game.setPulling(true);
    else game.strike();
  }
  if (e.code === 'KeyQ') cam.yaw += 0.15;
  if (e.code === 'KeyE') cam.yaw -= 0.15;
  updateWalk();
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (world && e.code === 'Space') world.game.setPulling(false);
  updateWalk();
});
window.addEventListener('blur', () => { keys.clear(); updateWalk(); if (world) world.game.setPulling(false); });

function holdButton(id, onDown, onUp) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); onDown(); });
  el.addEventListener('pointerup', () => onUp());
  el.addEventListener('pointercancel', () => onUp());
}
holdButton('btnUp', () => { keys.add('btnUp'); updateWalk(); }, () => { keys.delete('btnUp'); updateWalk(); });
holdButton('btnDown', () => { keys.add('btnDown'); updateWalk(); }, () => { keys.delete('btnDown'); updateWalk(); });
holdButton('btnStrike', () => {
  const g = world.game;
  if (g.state === 'fight') g.setPulling(true); else g.strike();
}, () => world.game.setPulling(false));

$('btnSound').addEventListener('click', () => {
  const a = world.audio;
  a.setEnabled(!a.enabled);
  refreshButtons();
});
$('btnBgm').addEventListener('click', () => {
  const b = world.bgm;
  b.setOn(!b.on);
  refreshButtons();
});
function refreshButtons() {
  if (!world) return;
  $('btnSound').textContent = t(world.audio.enabled ? 'btn.sound.on' : 'btn.sound.off');
  $('btnBgm').textContent = t(world.bgm.on ? 'btn.bgm.on' : 'btn.bgm.off');
}
const toggleLang = () => setLang(getLang() === 'ja' ? 'en' : 'ja');
$('btnLang').addEventListener('click', toggleLang);
$('btnLang2').addEventListener('click', toggleLang);
onLangChange(() => {
  refreshButtons();
  updateTitleTip();
  if (world) { world.game.refreshHint(); world.ui.setStrikeMode(world.game.tomo); }
});
$('btnZukan').addEventListener('click', () => world.ui.showZukan(world.game.records));
$('btnLog').addEventListener('click', () => world.ui.showLog(world.game.catches, world.game.records));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
  const m = b.closest('.modal');
  m.classList.remove('show');
  if (m.id === 'helpModal') onHelpClosed();
}));

// ------------------------------------------------------------------ 画面の流れ
// title（トップ）→ setup（釣りの準備）→ play ⇄ paused → over（本日の釣果）→ title / play
let screen = 'loading';
let helpFrom = null;          // あそびかたをどこから開いたか（'title' | 'pause'）
let adBusy = false;
const isPlaying = () => screen === 'play';

function showScreen(name) {
  screen = name;
  $('titleScreen').classList.toggle('show', name === 'title');
  $('setupScreen').classList.toggle('show', name === 'setup');
  $('pauseScreen').classList.toggle('show', name === 'paused' && !adBusy);
  $('overScreen').classList.toggle('show', name === 'over');
  document.body.classList.toggle('playing', name === 'play' || name === 'paused');
  if (name === 'title') updateTitleBest();
  updateBanner();
}

// 全画面広告（アプリのみ）：プレイ開始・トップに戻る・ポーズからの再開・もう一度 のたびに毎回出す
async function withInterstitial(next) {
  if (adBusy) return;
  if (Ads.available) {
    adBusy = true;
    $('pauseScreen').classList.remove('show');
    updateBanner();
    await Ads.showInterstitial(3000);
    adBusy = false;
  }
  next();
}

// バナー（アプリのみ）：トップ・あそびかた・ポーズ・結果画面だけ（プレイ中は操作ボタンと重なるので出さない）
function updateBanner() {
  const helpOpen = $('helpModal').classList.contains('show');
  const want = screen === 'title' || screen === 'setup' || screen === 'paused' || screen === 'over' || helpOpen;
  Ads.setBanner(want && !adBusy);
  document.body.classList.toggle('bannerSpace', want && Ads.bannerOn);
}

function updateTitleBest() {
  if (!world) return;
  const r = world.game.records, keys = Object.keys(world.game.records.count || {});
  const n = keys.filter((k) => r.count[k] > 0).length;
  $('titleBest').textContent = t('title.best', { s: r.hiscore || 0, n, total: 5 });
}

function openHelp(from) {
  helpFrom = from;
  $('helpKeys').innerHTML = t(TOUCH ? 'help.keys.touch' : 'help.keys');
  $('helpBody').innerHTML = tt('help.body');
  $('helpModal').classList.add('show');
  updateBanner();
}
function onHelpClosed() {
  const from = helpFrom;
  helpFrom = null;
  updateBanner();
  // トップ画面に戻るときは全画面広告
  if (from === 'title') withInterstitial(() => showScreen('title'));
}

function pauseGame() {
  if (screen !== 'play') return;
  world.game.setPulling(false);
  keys.clear(); updateWalk();
  showScreen('paused');
}
function resumeGame() { withInterstitial(() => { if (screen === 'paused') showScreen('play'); }); }
function goTitle() {
  withInterstitial(() => {
    closeRedo();
    world.game.toTitle();
    document.querySelectorAll('.modal.show').forEach((m) => m.classList.remove('show'));
    showScreen('title');
  });
}

function startFishing() {
  world.audio.init();
  world.bgm.start();
  applyPreset(choice.time, choice.season);
  const T = TIMES[choice.time];
  const tomo = choice.method === 'tomo';
  world.game.start(T.bite, T.clock, tomo);
  showScreen('play');
  world.ui.flash(t(tomo ? 'msg.tomo.start' : 'msg.start', { season: t('season.' + choice.season), time: t('time.' + choice.time) }), tomo ? 5 : 3);
}

// 釣行を終えて結果画面へ
function endSession() {
  closeRedo();
  const g = world.game;
  g.toTitle();
  const counts = {}, best = {};
  for (const c of g.catches) { counts[c.key] = (counts[c.key] || 0) + 1; best[c.key] = Math.max(best[c.key] || 0, c.size); }
  $('overScore').textContent = g.score;
  $('overCount').textContent = t('over.count', { n: g.catches.length });
  $('overBody').innerHTML = g.catches.length
    ? `<table><thead><tr><th>${t('over.species')}</th><th>${t('over.num')}</th><th>${t('over.best')}</th></tr></thead><tbody>`
      + Object.keys(counts).map((k) => `<tr><td>${fishName(k)}</td><td>${counts[k]}</td><td>${best[k].toFixed(1)} cm</td></tr>`).join('') + '</tbody></table>'
    : `<p>${t('over.none')}</p>`;
  $('overRedo').textContent = g.redoUsed ? t('over.redo', { n: g.redoUsed }) : '';
  showScreen('over');
}

// シェア：アプリは Android の共有メニュー、ブラウザは共有メニュー（なければ X の投稿画面）
const SHARE_URL = 'https://techgym.jp/column/claude-code-game-river/';
async function share(text) {
  const native = plugin('Share');
  try {
    if (native) await native.share({ title: t('title'), text, url: SHARE_URL, dialogTitle: t('share.dialog') });
    else if (navigator.share) await navigator.share({ title: t('title'), text, url: SHARE_URL });
    else window.open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SHARE_URL), '_blank', 'noopener');
  } catch (e) { /* キャンセル */ }
}
function catchShareText(c) {
  return t('share.catch', { fish: fishName(c.key), size: c.size.toFixed(1), extra: c.shaku ? t('share.shaku') : '' }) + t('share.tag');
}
$('btnResShare').addEventListener('click', () => { if (world.ui.currentCatch) share(catchShareText(world.ui.currentCatch)); });

function shareText() {
  const g = world.game;
  if (!g.catches.length) return t('share.text0') + t('share.tag');
  let top = null;
  for (const c of g.catches) if (!top || c.size > top.size) top = c;
  const bestTxt = top ? t('share.best', { fish: fishName(top.key), size: top.size.toFixed(1) }) : '';
  return t('share.text', { n: g.catches.length, s: g.score, best: bestTxt })
    + (g.redoUsed ? t('share.redo', { r: g.redoUsed }) : '') + t('share.tag');
}
$('btnShare').addEventListener('click', () => share(shareText()));

// ボタン
$('btnPlay').addEventListener('click', () => { world.audio.init(); showScreen('setup'); });
$('btnHowto').addEventListener('click', () => openHelp('title'));
$('btnSetupBack').addEventListener('click', () => showScreen('title'));
$('btnStart').addEventListener('click', () => withInterstitial(startFishing));
$('btnPause').addEventListener('click', pauseGame);
$('btnResume').addEventListener('click', resumeGame);
$('btnPauseHelp').addEventListener('click', () => openHelp('pause'));
$('btnEnd').addEventListener('click', endSession);
$('btnPauseTitle').addEventListener('click', goTitle);
$('btnAgain').addEventListener('click', () => withInterstitial(startFishing));
$('btnOverTitle').addEventListener('click', goTitle);

// Android の戻るボタン：プレイ中はポーズ（ポーズ中なら再開）、開いている画面があれば閉じる。トップ・結果画面ではアプリを終了
if (plugin('App')) {
  plugin('App').addListener('backButton', () => {
    const open = [...document.querySelectorAll('.modal.closable.show')];
    if (open.length) { open.forEach((m) => m.classList.remove('show')); if (open.some((m) => m.id === 'helpModal')) onHelpClosed(); return; }
    if ($('resultModal').classList.contains('show')) return;
    if (screen === 'title' || screen === 'over') plugin('App').exitApp();
    else if (screen === 'setup') showScreen('title');
    else if (screen === 'paused') resumeGame();
    else if (screen === 'play') pauseGame();
  });
}

// 別のアプリに切り替えたら一時停止して音を止める（広告の表示中は広告側が音を止めている）
document.addEventListener('visibilitychange', () => {
  if (!world) return;
  if (document.hidden) {
    if (screen === 'play' && !Ads.showing) pauseGame();
    world.audio.suspend('hidden');
  } else {
    world.audio.resume('hidden');
  }
});

// ---------- リワード広告：逃がした魚を「掛け直す」（アプリのみ・1 回の釣行で 5 回まで） ----------
// 糸切れ・バラシのあと、魚が逃げていく様子を見届けられるよう少し待ってから案内を出し、数秒で自動的に消す
const REDO_DELAY = 3, REDO_WAIT = 6, REDO_MAX = 5;
const redo = { active: false, busy: false, t: 0, pending: 0 };
function offerRedo() {
  if (!Ads.canReward || (world.game.redoUsed || 0) >= REDO_MAX) return;
  redo.pending = REDO_DELAY;
}
function showRedo() {
  Object.assign(redo, { active: true, busy: false, t: REDO_WAIT, pending: 0 });
  $('redoWatch').disabled = false;
  $('redoWatch').textContent = t('redo.watch');
  $('redoNote').textContent = t('redo.note', { n: REDO_MAX - (world.game.redoUsed || 0), max: REDO_MAX });
  $('redo').hidden = false;
}
function closeRedo() { redo.active = false; redo.pending = 0; $('redo').hidden = true; }
function updateRedo(dt) {
  if (screen !== 'play') return;
  if (redo.pending > 0) {
    redo.pending -= dt;
    const st = world.game.state;
    if (st === 'fight' || st === 'landing' || st === 'result') { redo.pending = 0; return; } // 別の魚が掛かったら出さない
    if (redo.pending <= 0) showRedo();
    return;
  }
  if (!redo.active || redo.busy) return;
  redo.t -= dt;
  $('redoNext').textContent = t('redo.next', { s: Math.max(0, Math.ceil(redo.t)) });
  if (redo.t <= 0) closeRedo();
}
$('redoNext').addEventListener('click', closeRedo);
$('redoWatch').addEventListener('click', async () => {
  if (!redo.active || redo.busy) return;
  redo.busy = true;
  $('redoWatch').disabled = true;
  $('redoWatch').textContent = t('redo.loading');
  const result = await Ads.showRewarded();
  if (!redo.active) return;
  if (result === 'unavailable') {
    $('redoNote').textContent = t('redo.fail');
    setTimeout(closeRedo, 2000);
    return;
  }
  closeRedo();
  if (result === 'rewarded' && screen === 'play') world.game.redoFight();
});
for (const ev of ['pointerdown', 'pointerup']) $('redo').addEventListener(ev, (e) => e.stopPropagation());

// トップ画面の下に、バージョン（アプリ版）・プライバシーポリシー・広告の設定（EU など）
if (window.APP_VERSION && window.APP_VERSION !== 'dev') $('buildInfo').textContent = window.APP_VERSION + '｜';
Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) $('adPrivacy').hidden = false; });
$('adPrivacyLink').addEventListener('click', (e) => { e.preventDefault(); Ads.showPrivacyOptions(); });
const updatePrivacyLink = () => { $('privacyLink').href = t('url.privacy'); };
updatePrivacyLink();
onLangChange(() => { updatePrivacyLink(); updateTitleBest(); if (helpFrom) { $('helpKeys').innerHTML = t(TOUCH ? 'help.keys.touch' : 'help.keys'); $('helpBody').innerHTML = tt('help.body'); } });

// option chips on the setup screen
const choice = { method: 'bait', time: 'morning', season: 'autumn' };
function selectChip(key, val) {
  choice[key] = val;
  document.querySelectorAll(`.chips[data-key="${key}"] button`).forEach((x) => x.classList.toggle('on', x.dataset.val === val));
}
function updateTitleTip() {
  $('titleTip').textContent = t(choice.method === 'tomo' ? 'title.tomoNote' : 'title.tip');
}
document.querySelectorAll('.chips').forEach((group) => {
  group.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.classList.contains('disabled')) return;
    selectChip(group.dataset.key, b.dataset.val);
    if (group.dataset.key === 'method') {
      // 友釣りはアユの季節（新緑・盛夏）のみ
      const autumn = document.querySelector('.chips[data-key="season"] [data-val="autumn"]');
      autumn.classList.toggle('disabled', choice.method === 'tomo');
      if (choice.method === 'tomo' && choice.season === 'autumn') selectChip('season', 'summer');
      updateTitleTip();
    }
    if (world) applyPreset(choice.time, choice.season);
  });
});
updateTitleTip();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------------ loop
const DT_MAX = 0.05;
let dtMax = DT_MAX;
dtMax = parseFloat(new URLSearchParams(location.search).get('dtmax')) || DT_MAX; // @web-only（テスト用）
let last = performance.now();
function frame(now) {
  const dt = Math.min(dtMax, (now - last) / 1000);
  last = now;
  shared.uTime.value += dt;
  const { game, effects, aimMesh, sky, audio } = world;
  if (screen !== 'paused') {
    game.update(dt);
    effects.update(dt, game.anglerZ);
    updateRedo(dt);
  }
  // aim marker
  const showAim = game.aim.has && (game.state === 'idle' || game.state === 'drift');
  aimMesh.visible = showAim;
  if (showAim) {
    aimMesh.position.copy(game.aim.point); aimMesh.position.y += 0.04;
    aimMesh.material.color.set(game.aim.valid ? 0x7dffb0 : 0xff6b6b);
    const s = 1 + Math.sin(now * 0.006) * 0.08; aimMesh.scale.set(s, 1, s);
  }
  updateCamera(dt, game.state === 'title');
  sky.mesh.position.copy(camera.position);
  // sun + shadow follow the angler
  sun.target.position.copy(game.pos);
  sun.position.copy(game.pos).addScaledVector(shared.uSunDir.value, 120);
  world.bgm.setMood(game.state === 'fight' || game.state === 'landing' ? 'fight' : 'calm');
  audio.setAmbience(Math.abs(game.anglerZ - W.FALL_Z), 1 - W.poolFactor(game.anglerZ));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

build().then(() => {
  $('loading').classList.remove('show');
  showScreen('title');
  last = performance.now();
  requestAnimationFrame(frame);
}).catch((err) => {
  console.error(err);
  setLoading(t('load.fail', { msg: err.message }));
});
