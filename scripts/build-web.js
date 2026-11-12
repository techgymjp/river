// Web 版とアプリ（Android）に使うファイルを www/ にまとめる。アプリ用は --app を付ける
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
for (const item of ['index.html', 'css', 'js', '.nojekyll']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}
// Google Play 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'js', 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'js', 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
// アプリに入れるときは、Web 版だけの要素（テスト・撮影用の window.__keiryu など）をファイルから取り除く。
// 非表示にするだけだと「審査で見えない機能」が入ったままになる（App Store Guideline 5.6）ため
const app = process.argv.includes('--app');
if (app) {
  const strip = (file, marker) => {
    const f = path.join(out, file);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    const kept = lines.filter((l) => !l.includes(marker));
    if (kept.length === lines.length) throw new Error(`${marker} not found in ${file}`);
    fs.writeFileSync(f, kept.join('\n'));
  };
  strip('js/main.js', '@web-only');
  strip('js/shared.js', '@web-only');
}
console.log(`built web assets into www/ (${app ? 'app' : 'web'}, ads: ${mode}, version: ${version})`);
