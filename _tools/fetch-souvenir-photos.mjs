// 기념품 사진 수집 — Wikimedia Commons API만 사용(재사용 허락된 자유 라이선스 사진).
//
//   node _tools/fetch-souvenir-photos.mjs search [id,id…]   검색 → _souvenir-data/photo-candidates.json
//   node _tools/fetch-souvenir-photos.mjs download [id,id…] 채택 사진 내려받기 → assets/images/souvenirs/<cc>/<id>.webp
//
// 채택 규칙: 파일 제목(또는 설명)에 상품별 정규식 n 이 맞고, 라이선스가 CC0·PD·CC BY·CC BY-SA 인 사진 중 첫 번째.
// 내려받기는 사람이 검토해 _souvenir-data/photo-overrides.json 에 { id: "File:…" | null } 로 적은 것만 쓴다(null = 맞는 사진 없음).
// artifact:true 상품(유물 복제품)은 원본 유물 사진을 쓰지 않도록 제목에 replica/souvenir 류 단어가 있어야 한다.
// WebP 변환에 sharp가 필요하다: SHARP_DIR 환경변수에 sharp가 설치된 폴더를 주거나 이 저장소에서 `npm i sharp`.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, '_souvenir-data');
const require = createRequire(import.meta.url);
const items = [1, 2, 3, 4].flatMap(i => require(path.join(DATA, `seed-${i}.js`)));
const [mode = 'search', only] = process.argv.slice(2);
const RQ = fs.existsSync(path.join(DATA, 'photo-requery.js')) ? require(path.join(DATA, 'photo-requery.js')) : {};
const pick = only ? items.filter(x => only.split(',').includes(x.id)) : items;
const UA = 'CEE-Side-souvenir-photos/1.0 (educational non-commercial travel guide; contact via site)';
const API = 'https://commons.wikimedia.org/w/api.php';
// Node fetch가 일부 PC에서 인증서 체인을 못 찾아 curl로 받는다(HTTP 상태는 마지막 줄).
function get(url) {
  const r = spawnSync('curl', ['-sL', '--max-time', '60', '-A', UA, '-w', '\n%{http_code}', url], { maxBuffer: 64 << 20 });
  const buf = r.stdout || Buffer.alloc(0), cut = buf.lastIndexOf(10);
  return { status: +buf.slice(cut + 1).toString() || 0, body: buf.slice(0, cut) };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FREE = /^(cc0|cc[ -]?by(-sa)?[ -]?\d|cc[ -]?by(-sa)?$|public domain|pd\b|pd-|attribution|gfdl|cc-by)/i;
const BAD_LIC = /\b(nc|nd)\b|non-?commercial|no derivatives|fair use/i;
const JUNK = /\b(logo|coat of arms|map|flag|diagram|chart|signature|icon|svg)\b/i;
const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function api(params) {
  const u = new URL(API);
  Object.entries({ format: 'json', formatversion: '2', origin: '*', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  for (let t = 0; t < 20; t++) {
    const r = get(u.href);
    if (r.status === 200) { try { return JSON.parse(r.body.toString('utf8')); } catch { /* 재시도 */ } }
    // 429(요청 과다)는 길게 쉬었다가 다시 시도한다
    await sleep(r.status === 429 ? 60000 : 3000 * (t + 1));
  }
  throw new Error('Commons API 실패: ' + u);
}
const infoProps = { prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1000',
  iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription|Credit|AttributionRequired|DateTimeOriginal' };
const toCand = p => {
  const ii = (p.imageinfo || [])[0]; if (!ii) return null;
  const m = ii.extmetadata || {}, v = k => (m[k] && m[k].value) || '';
  return { title: p.title, w: ii.width, h: ii.height, mime: ii.mime, thumb: ii.thumburl, page: ii.descriptionurl,
    license: strip(v('LicenseShortName')), licenseUrl: strip(v('LicenseUrl')) || null, author: strip(v('Artist')) || strip(v('Credit')) || null,
    desc: strip(v('ImageDescription')).slice(0, 300) };
};
const licOk = c => c && FREE.test(c.license) && !BAD_LIC.test(c.license);

async function search() {
  const outFile = path.join(DATA, 'photo-candidates.json');
  const out = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
  for (const it of pick) {
    if (!only && out[it.id]) continue; // 이어서 실행: 이미 찾은 상품은 건너뜀(특정 id를 주면 다시 찾음)
    const rq = (only && RQ[it.id]) || {}; // 2차 검색: photo-requery.js의 검색어·조건
    const qs = rq.q || it.q, need = rq.n || it.n;
    const re = new RegExp(need, 'iu');
    // 1) 가벼운 제목 검색 → 2) 제목에 정규식이 맞는 파일만 라이선스·크기 정보를 한 번에 조회(요청 수를 줄여 429를 피한다)
    const hits = new Map();
    let total = 0;
    for (const q of qs) {
      if (hits.size >= 3) break; // 제목이 맞는 파일이 이미 충분하면 다음 검색어는 건너뜀
      const j = await api({ action: 'query', list: 'search', srsearch: `${q} filetype:bitmap`, srnamespace: '6', srlimit: '30', srprop: '' });
      const rows = (j.query && j.query.search) || [];
      total += rows.length;
      rows.forEach((r, i) => { const name = r.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''); if (re.test(name) && !JUNK.test(name) && !hits.has(r.title)) hits.set(r.title, { q, rank: i }); });
      await sleep(2000);
    }
    const seen = new Map();
    const titles = [...hits.keys()].slice(0, 40);
    if (titles.length) {
      const j = await api({ action: 'query', titles: titles.join('|'), ...infoProps });
      for (const p of (j.query && j.query.pages) || []) { const c = toCand(p); if (c) seen.set(p.title, { ...c, ...hits.get(p.title) }); }
      await sleep(2000);
    }
    const cands = [...seen.values()].filter(Boolean).map(c => {
      const name = c.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '');
      const titleHit = re.test(name), descHit = re.test(c.desc);
      const replicaOk = !it.artifact || /replic|replik|kopj|souvenir|suvenir/i.test(name + ' ' + c.desc);
      return { ...c, titleHit, descHit, ok: licOk(c) && (titleHit || descHit) && replicaOk && !JUNK.test(name) && c.w >= 500 };
    }).sort((a, b) => (b.ok - a.ok) || (b.titleHit - a.titleHit) || ((b.w >= 800) - (a.w >= 800)) || a.rank - b.rank);
    const prev = (out[it.id] && out[it.id].cands || []).filter(c => c.ok && !cands.some(x => x.title === c.title));
    cands.push(...prev); // 다시 찾을 때 이전 후보도 남긴다
    out[it.id] = { queries: qs, need, searchedAt: new Date().toISOString().slice(0, 10), found: total, titleMatches: cands.length,
      auto: (cands.find(c => c.ok) || {}).title || null, cands: cands.slice(0, 8) };
    fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
    console.log(`${it.id.padEnd(30)} ${String(cands.filter(c => c.ok).length).padStart(2)} ok  → ${out[it.id].auto || '— 없음'}`);
  }
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
}

async function download() {
  const sharp = require(process.env.SHARP_DIR ? path.join(process.env.SHARP_DIR, 'node_modules', 'sharp') : 'sharp');
  const cand = JSON.parse(fs.readFileSync(path.join(DATA, 'photo-candidates.json'), 'utf8'));
  const ovFile = path.join(DATA, 'photo-overrides.json');
  const ov = fs.existsSync(ovFile) ? JSON.parse(fs.readFileSync(ovFile, 'utf8')) : {};
  const manFile = path.join(DATA, 'souvenir-image-manifest.json');
  const man = fs.existsSync(manFile) ? JSON.parse(fs.readFileSync(manFile, 'utf8')) : {};
  const hashes = new Map();
  for (const it of pick) {
    const c = cand[it.id] || {};
    // 사람이 검토해 photo-overrides.json에 적은 파일만 쓴다(자동 후보 c.auto는 검토 참고용)
    const title = ov[it.id] || null;
    const base = { searchQueries: it.q, candidatesFound: c.found || 0 };
    if (!title) { man[it.id] = { ...base, status: 'missing', note: it.id in ov ? '검토 결과 정확히 일치하는 자유 라이선스 사진 없음' : c.auto ? '후보는 있으나 검토에서 채택하지 않음' : '자동 검색에서 조건에 맞는 사진 없음' }; console.log('missing ', it.id); continue; }
    let info = (c.cands || []).find(x => x.title === title);
    if (!info || !info.thumb) {
      const j = await api({ action: 'query', titles: title, ...infoProps });
      info = toCand(((j.query && j.query.pages) || [])[0] || {});
    }
    if (!licOk(info)) { man[it.id] = { ...base, status: 'permission_pending', sourceUrl: info && info.page, note: '라이선스 확인 필요: ' + (info && info.license) }; console.log('license ', it.id, info && info.license); continue; }
    const dir = path.join(ROOT, 'assets', 'images', 'souvenirs', it.cc.toLowerCase());
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${it.id}.webp`);
    try {
      // 이미 같은 id로 받아 둔 파일이 온전하면 다시 받지 않는다(요청 수 절약)
      let buf = null, meta = null;
      if (fs.existsSync(file) && man[it.id] && (man[it.id].sourceTitle === info.title || man[it.id].sourceUrl === info.page)) {
        try { meta = await sharp(file).metadata(); buf = fs.readFileSync(file); } catch { meta = null; }
      }
      if (!meta) {
        for (let t = 0; t < 10 && !buf; t++) {
          const r = get(info.thumb);
          if (r.status === 200) { try { await sharp(r.body).metadata(); await sharp(r.body).stats(); buf = r.body; break; } catch { /* 잘린 파일: 다시 받기 */ } }
          await sleep(r.status === 429 ? 120000 : 5000);
        }
        if (!buf) throw new Error('썸네일을 받지 못함(429·잘림)');
        meta = await sharp(buf).rotate().resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(file);
      }
      const h = (await sharp(buf).resize(8, 8, { fit: 'fill' }).greyscale().raw().toBuffer()).toString('hex');
      const dup = hashes.get(h); hashes.set(h, it.id);
      man[it.id] = { ...base, status: 'verified', file: path.relative(ROOT, file).replace(/\\/g, '/'), width: meta.width, height: meta.height,
        sourceTitle: info.title, sourceUrl: info.page, author: info.author, license: info.license, licenseUrl: info.licenseUrl,
        modified: '크기 축소·WebP 변환', verifiedAt: new Date().toISOString().slice(0, 10), duplicateOf: dup || undefined };
      console.log('ok      ', it.id, meta.width + 'x' + meta.height, dup ? 'DUP of ' + dup : '');
    } catch (e) { man[it.id] = { ...base, status: 'missing', sourceUrl: info.page, note: '내려받기 실패: ' + e.message }; console.log('fail    ', it.id, e.message); }
    await sleep(300);
  }
  fs.writeFileSync(manFile, JSON.stringify(man, null, 1));
}

await (mode === 'download' ? download() : search());
