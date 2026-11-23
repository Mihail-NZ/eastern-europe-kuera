// 기념품 데이터 빌드: _souvenir-data/seed-*.js + countries.js + souvenir-image-manifest.json (+ ref-check.json)
//   → _souvenir-data/souvenirs.json      전체 필드 데이터베이스(요청 스키마)
//   → _souvenir-data/souvenir-sources.json  사진·참고 출처 목록
//   → _souvenir-data/souvenir-report.md   국가별 집계·사진 누락·검토 대기 목록
//   → assets/js/data-souvenirs.js         사이트용 압축 데이터(window.SOUVENIRS)
// 실행: node _tools/build-souvenirs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, '_souvenir-data');
const require = createRequire(import.meta.url);
const items = [1, 2, 3, 4].flatMap(i => require(path.join(DATA, `seed-${i}.js`)));
const C = require(path.join(DATA, 'countries.js'));
const readJson = f => fs.existsSync(path.join(DATA, f)) ? JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')) : {};
const man = readJson('souvenir-image-manifest.json');
const refs = readJson('ref-check.json'); // { id: { wp: url|null, u: true|false } }
const today = new Date().toISOString().slice(0, 10);

const CATS = [['food', '먹거리·간식'], ['drinks', '와인·전통주·음료'], ['beauty', '뷰티·향기'], ['fashion', '패션·액세서리'], ['crafts', '전통 공예·생활용품'],
  ['design', '디자인·문구'], ['culture', '문화·예술·박물관'], ['sports', '축제·스포츠'], ['vintage', '빈티지·수집품']];
/* 한국 입국 시 유의사항(2026-11 기준 관세청·농림축산검역본부 안내 요약). 품목별 최종 판단은 입국 시 세관·검역관이 한다. */
const IMPORT = {
  alc: '주류는 1인 2병·합계 2L·합계 US$400 이하까지 면세이고, 넘으면 세관 신고 후 과세됩니다. 깨지지 않게 감싸 위탁 수하물로 부치세요.',
  liq: '100ml가 넘는 병·튜브(잼·소스·오일·꿀·화장품)는 기내에 들고 탈 수 없으니 위탁 수하물에 넣으세요.',
  fruit: '말린 과일·견과류는 식물검역 대상입니다. 세관신고서의 동식물 항목에 표시하고 검역을 받으세요.',
  plant: '말린 꽃·풀·짚 같은 식물성 소재는 식물검역 대상일 수 있습니다. 입국 때 신고하고 검역관 확인을 받으세요.',
  tea: '포장된 허브차는 대체로 반입할 수 있지만, 시장에서 파는 비포장 말린 허브는 식물검역 대상입니다. 밀봉 제품을 고르고 신고하세요.',
  seed: '양귀비씨가 들어간 식품은 국내에서 마약류 관리 대상이 될 수 있습니다. 호두 등 다른 소를 고르는 편이 안전합니다.',
  fish: '수산물 가공품입니다. 밀봉 통조림은 보통 반입할 수 있지만 기름이 든 제품이라 위탁 수하물로 보내고, 입국 때 검역 안내를 따르세요.',
  wood: '가공·도장된 목제품은 보통 문제없지만, 나무껍질이 붙은 생목재는 식물검역 대상입니다.'
};
const SCORE_W = [0.30, 0.25, 0.20, 0.15, 0.10];
const score = s => +[...s].reduce((a, d, i) => a + (+d) * SCORE_W[i], 0).toFixed(2);
const verifyLabel = { ok: 'verified', check: 'needs_detail_check' };
const imgOf = it => {
  const m = man[it.id];
  if (!m) return { status: 'missing', note: '아직 검색하지 않음' };
  return m;
};

/* ---------- 전체 데이터베이스 ---------- */
const db = items.map(it => {
  const m = imgOf(it), r = refs[it.id] || {};
  const country = C[it.cc];
  const referenceUrls = [r.wp, it.u && r.u !== false ? it.u : null].filter(Boolean);
  return {
    id: it.id, countryCode: it.cc, countrySlug: country.slug,
    titleKo: it.ko, titleLocal: it.lo || null, titleEn: it.en,
    category: it.c, tags: it.t || [], concept: it.k,
    descriptionKo: it.d, reasonToBuy: it.w, region: it.rg || null,
    buyingLocations: country.warn ? null : (it.b || null), routeCities: it.ci || [],
    brand: it.br || null, madeIn: country.slug,
    imagePath: m.status === 'verified' ? m.file : null,
    imageAlt: m.status === 'verified' ? `${it.ko} (${it.en})` : null,
    imageSourceUrl: m.sourceUrl || null, imageSourceTitle: m.sourceTitle || null, imageAuthor: m.author || null,
    imageLicense: m.license || null, imageLicenseUrl: m.licenseUrl || null, imageModified: m.modified || null,
    imageStatus: m.status, imageNote: m.note || null, imageVerifiedAt: m.verifiedAt || null,
    imageSearchQueries: it.q, imageCandidatesFound: m.candidatesFound ?? null,
    officialUrl: it.u && r.u !== false ? it.u : null, referenceUrls,
    priceMin: null, priceMax: null, currency: null, priceCheckedAt: null, priceNote: '확인 필요(검증된 가격 자료 없음)',
    koreanAvailability: it.kr || '확인 필요', importNotice: it.im ? IMPORT[it.im] : null, importCode: it.im || null,
    priority: score(it.s), priorityBreakdown: { uniqueness: +it.s[0], rarityInKorea: +it.s[1], giftPracticality: +it.s[2], designCulture: +it.s[3], portability: +it.s[4] },
    top3: country.top.includes(it.id), verificationStatus: verifyLabel[it.v] || it.v,
    mergedFrom: it.merged || null, editorNote: it.note || null, travelAdvisory: !!country.warn
  };
});
fs.writeFileSync(path.join(DATA, 'souvenirs.json'), JSON.stringify({ generatedAt: today, count: db.length, categories: Object.fromEntries(CATS), importNotices: IMPORT, items: db }, null, 1));

/* ---------- 출처 목록 ---------- */
fs.writeFileSync(path.join(DATA, 'souvenir-sources.json'), JSON.stringify(db.map(x => ({
  id: x.id, image: x.imageStatus === 'verified' ? { file: x.imagePath, source: x.imageSourceUrl, title: x.imageSourceTitle, author: x.imageAuthor, license: x.imageLicense, licenseUrl: x.imageLicenseUrl, modified: x.imageModified } : { status: x.imageStatus, note: x.imageNote, searchQueries: x.imageSearchQueries },
  references: x.referenceUrls
})), null, 1));

/* ---------- 사이트용 압축 데이터 ---------- */
const short = s => (s || '').replace(/\s+/g, ' ').trim();
const site = {
  checked: today, cats: CATS, imports: IMPORT,
  countries: Object.fromEntries(Object.entries(C).map(([cc, c]) => [cc, { slug: c.slug, why: c.why, top: c.top, warn: c.warn || null }])),
  items: db.map(x => {
    const o = { id: x.id, cc: x.countryCode, c: x.category, ko: x.titleKo, lo: x.titleLocal, en: x.titleEn, d: x.descriptionKo, w: x.reasonToBuy,
      rg: x.region, b: x.buyingLocations, br: x.brand, ci: x.routeCities, k: x.concept, p: x.priority, t: x.tags, v: x.verificationStatus === 'verified' ? 1 : 0 };
    if (x.importCode) o.im = x.importCode;
    if (x.koreanAvailability !== '확인 필요') o.kr = x.koreanAvailability;
    if (x.officialUrl) o.u = x.officialUrl;
    const wp = x.referenceUrls.filter(u => u !== x.officialUrl);
    if (wp.length) o.r = wp;
    if (x.imageStatus === 'verified') { const m = man[x.id]; o.img = [x.imagePath, m.width, m.height, short(x.imageAuthor).slice(0, 80) || '저작자 표기 없음', x.imageLicense, x.imageLicenseUrl, x.imageSourceUrl]; }
    else o.ist = x.imageStatus;
    return o;
  })
};
fs.writeFileSync(path.join(ROOT, 'assets', 'js', 'data-souvenirs.js'),
  `/* 나라별 쇼핑·기념품 데이터 — _tools/build-souvenirs.mjs가 _souvenir-data/에서 생성합니다. 직접 고치지 마세요. */\nwindow.SOUVENIRS = ${JSON.stringify(site)};\n`);

/* ---------- 보고서 ---------- */
const by = cc => db.filter(x => x.countryCode === cc);
const n = f => db.filter(f).length;
let md = `# 쇼핑·기념품 데이터 보고서 (${today})\n\n`;
md += `| 항목 | 수 |\n|---|---|\n| 원 후보 | 285 |\n| 최종 상품 | ${db.length} |\n| 통합(중복) | ${n(x => x.mergedFrom)}건 (후보 ${n(x => x.mergedFrom) * 2}개 → ${n(x => x.mergedFrom)}개) |\n| 제외(존재 확인 실패) | 4 (Piparmētra 문구, Da Figura 돌 그림, Luštica 비누, DHE 도자기) |\n| 추가 | 1 (불가리아 장미 화장품) |\n| 이름·범위 수정 | ${n(x => x.editorNote && !/추가/.test(x.editorNote))} |\n`;
md += `| 상품 정보 확인(ok) | ${n(x => x.verificationStatus === 'verified')} |\n| 세부 확인 필요(check) | ${n(x => x.verificationStatus !== 'verified')} |\n| 사진 확보(자유 라이선스, 로컬 저장) | ${n(x => x.imageStatus === 'verified')} |\n| 사진 라이선스 확인 대기 | ${n(x => x.imageStatus === 'permission_pending')} |\n| 사진 없음 | ${n(x => x.imageStatus === 'missing')} |\n`;
md += `| 현지 구매처 기재(BY·UA 제외) | ${n(x => x.buyingLocations)} |\n| 한국 유통 여부 확인 | ${n(x => x.koreanAvailability !== '확인 필요')} |\n| 가격 검증 | 0 (모두 '확인 필요') |\n\n`;
md += `## 국가별\n\n| 국가 | 상품 | 사진 | 사진 없음 | 확인(ok) |\n|---|---|---|---|---|\n`;
for (const cc of Object.keys(C)) { const a = by(cc); md += `| ${cc} ${C[cc].slug} | ${a.length} | ${a.filter(x => x.imageStatus === 'verified').length} | ${a.filter(x => x.imageStatus !== 'verified').length} | ${a.filter(x => x.verificationStatus === 'verified').length} |\n`; }
md += `\n## 사진 누락·검토 대기 목록\n\n| id | 상품 | 상태 | 메모 | 검색어 |\n|---|---|---|---|---|\n`;
for (const x of db.filter(x => x.imageStatus !== 'verified')) md += `| ${x.id} | ${x.titleKo} | ${x.imageStatus} | ${x.imageNote || ''} | ${x.imageSearchQueries.join(' / ')} |\n`;
md += `\n## 통합·수정 내역\n\n`;
for (const x of db.filter(x => x.mergedFrom || x.editorNote)) md += `- ${x.id}: ${x.mergedFrom || ''}${x.mergedFrom && x.editorNote ? ' · ' : ''}${x.editorNote || ''}\n`;
fs.writeFileSync(path.join(DATA, 'souvenir-report.md'), md);
console.log(`items ${db.length} · photos ${n(x => x.imageStatus === 'verified')} · missing ${n(x => x.imageStatus === 'missing')} · pending ${n(x => x.imageStatus === 'permission_pending')}`);
