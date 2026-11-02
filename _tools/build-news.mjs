// _news-data/*.json(날짜별 브리핑) → assets/js/data-news.js (최신순, 최근 KEEP개). 형식을 검사하고 문제가 있으면 쓰지 않는다.
//   node _tools/build-news.mjs            (저장소 루트에서 실행)
import fs from 'node:fs';
import path from 'node:path';

const DATA = '_news-data';
const OUT = 'assets/js/data-news.js';
const KEEP = 30;

const COUNTRIES = ['폴란드', '체코', '슬로바키아', '헝가리', '슬로베니아', '크로아티아', '세르비아', '보스니아 헤르체고비나', '코소보', '몬테네그로', '북마케도니아', '알바니아', '불가리아', '루마니아', '몰도바', '우크라이나', '벨라루스', '리투아니아', '라트비아', '에스토니아'];
const REGIONS = ['top', 'v4', 'baltic', 'wbalkan', 'sbalkan', 'east'];

// 날짜별 브리핑 하나(day, 파일 기본 이름 name)를 검사해 문제 목록을 돌려준다.
function validateDay(day, name) {
  const errs = [];
  const stories = Array.isArray(day.stories) ? day.stories : [];
  if (day.date !== name) errs.push(`${name}: date 값이 파일명과 다름`);
  if (stories.length !== 6) errs.push(`${name}: stories가 6개가 아님`);
  for (const r of REGIONS) if (!stories.some(s => s.region === r)) errs.push(`${name}: region ${r} 없음`);
  for (const s of stories) {
    if (!s.title || !Array.isArray(s.points) || s.points.length < 3 || !Array.isArray(s.sources) || !s.sources.length) errs.push(`${name}: 기사 항목 부족(${s.title})`);
    for (const src of (s.sources || [])) if (!/^https?:\/\//.test(src.url || '')) errs.push(`${name}: 출처 주소 이상(${src.name})`);
  }
  if (Object.prototype.hasOwnProperty.call(day, 'home')) {
    const h = day.home;
    const ok = Array.isArray(h) && h.length === 3 && new Set(h).size === 3 && h.every(i => Number.isInteger(i) && i >= 0 && i < stories.length);
    if (!ok) errs.push(`${name}: home은 서로 다른 기사 번호 3개여야 함`);
    else {
      const seen = new Set();
      for (const i of h) for (const c of (stories[i].countries || [])) { if (seen.has(c)) errs.push(`${name}: home 3건에 같은 나라 중복(${c})`); seen.add(c); }
      if (new Set(h.map(i => stories[i].region)).size !== 3) errs.push(`${name}: home 3건은 서로 다른 권역이어야 함`);
    }
  }
  for (const c of COUNTRIES) if (!day.countries || !Object.prototype.hasOwnProperty.call(day.countries, c)) errs.push(`${name}: 국가 단신 없음(${c})`);
  return errs;
}

const files = fs.readdirSync(DATA).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().slice(0, KEEP);
const items = [];
const errs = [];
for (const f of files) {
  let day;
  try { day = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8').replace(/^\uFEFF/, '')); }
  catch (e) { errs.push(`${f}: JSON 형식 오류 (${e.message})`); continue; }
  errs.push(...validateDay(day, f.replace(/\.json$/, '')));
  items.push(day);
}
if (errs.length) { console.error(errs.join('\n')); console.error('검사 실패: data-news.js를 쓰지 않았습니다.'); process.exit(1); }
const out = '/* 원본: _news-data/*.json (최신순, _tools/build-news.mjs로 생성) */\nwindow.NEWS_DATA=' + JSON.stringify(items, null, 4) + ';\n';
fs.writeFileSync(OUT, out, 'utf8');
console.log(`data-news.js: ${items.length}개 브리핑 (${items.map(d => d.date).join(', ')})`);
