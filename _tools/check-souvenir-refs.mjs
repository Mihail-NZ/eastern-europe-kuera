// 기념품 참고 링크 확인 → _souvenir-data/ref-check.json
//   wp: 영어 위키백과 문서가 실제로 있으면 그 URL(넘겨주기 반영), 없으면 null
//   u : 공식·관련 사이트가 응답(2xx/3xx, 일부 사이트의 403 봇 차단 포함)하면 true, 응답이 없거나 404면 false
// 실행: node _tools/check-souvenir-refs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const items = [1, 2, 3, 4].flatMap(i => require(path.join(ROOT, '_souvenir-data', `seed-${i}.js`)));
const UA = 'CEE-Side-souvenir-refs/1.0 (educational travel guide)';
const curl = (args) => spawnSync('curl', ['-s', '--max-time', '25', '-A', UA, ...args], { maxBuffer: 16 << 20 }).stdout.toString();
const out = {};

const wpItems = items.filter(x => x.wp);
for (let i = 0; i < wpItems.length; i += 40) {
  const batch = wpItems.slice(i, i + 40);
  const u = 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&titles=' + encodeURIComponent(batch.map(x => x.wp).join('|'));
  const j = JSON.parse(curl([u]));
  const norm = Object.fromEntries((j.query.normalized || []).map(n => [n.from, n.to]));
  const redir = Object.fromEntries((j.query.redirects || []).map(n => [n.from, n.to]));
  const pages = Object.fromEntries(j.query.pages.map(p => [p.title, p]));
  for (const x of batch) {
    let t = norm[x.wp] || x.wp; t = redir[t] || t;
    const p = pages[t];
    out[x.id] = { wp: p && !p.missing ? 'https://en.wikipedia.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_')).replace(/%2C/g, ',') : null };
    if (!out[x.id].wp) console.log('wp missing:', x.id, x.wp);
  }
}
for (const x of items.filter(x => x.u)) {
  const code = +curl(['-o', '/dev/null', '-L', '-w', '%{http_code}', x.u]) || 0;
  const ok = (code >= 200 && code < 400) || code === 403;
  (out[x.id] = out[x.id] || {}).u = ok;
  console.log(String(code).padEnd(4), ok ? 'ok ' : 'BAD', x.id, x.u);
}
fs.writeFileSync(path.join(ROOT, '_souvenir-data', 'ref-check.json'), JSON.stringify(out, null, 1));
console.log('wp ok', Object.values(out).filter(v => v.wp).length, '/', wpItems.length);
