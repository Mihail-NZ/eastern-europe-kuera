/* 여행(Travel) 카테고리: 맞춤 루트 추천 · 결과 카드 · 루트 상세.
 * 데이터: data-trip.js(TRIP_DATA) · data-trip-routes.js(TRIP_ROUTES) · data-trip-photos.js(TRIP_PHOTOS)
 * site.js보다 먼저 읽히며, site.js가 <body data-page="trip | trip-route">일 때 window.TRIP_RENDER를 부른다.
 * 서버·유료 API 없이 브라우저에서만 계산한다. 점수는 사이트가 정리한 데이터에 따른 참고값이다.
 * 기간은 1박 단위: 루트의 stops(최소·최대 박수)를 고른 박수에 맞춰 배분해 그 박수 그대로의 일정을 만든다. */
(function () {
  'use strict';
  const D = window.TRIP_DATA, ROUTES = window.TRIP_ROUTES || [], PHOTOS = window.TRIP_PHOTOS || {};
  if (!D) return;
  const ROOT = document.body.dataset.root || '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const C = D.cities, G = D.gateways, N = D.countries, REFS = D.refs || {};
  Object.keys(G).forEach(k => { G[k].iata = k; });

  /* 사용자에게 보이는 선택지는 6개 목적 · 4개 분위기로 묶는다. 루트 데이터의 세부 태그(art, local, classic…)는 그대로 두고
   * [선택지 id, 이름, 묶이는 세부 태그] 로 연결한다. 묶음 점수 = 세부 태그 중 가장 높은 값. */
  const THEMES = [['history', '역사·건축', ['history', 'art']], ['nature', '자연·산', ['nature']], ['beach', '바다·휴양', ['beach']], ['local', '미식·로컬', ['food', 'local']], ['night', '야경·도시', ['night', 'shopping']], ['winter', '겨울·크리스마스', ['winter']]];
  const MOODS = [['romantic', '낭만·고풍', ['romantic', 'classic']], ['quiet', '조용·자연', ['quiet', 'natural']], ['lively', '활기·도시', ['lively', 'urban']], ['adventure', '이국·모험', ['exotic', 'adventure']]];
  const groupOf = (list, raw) => list.find(g => g[2].includes(raw));
  const themeScore = (route, gid) => Math.max(0, ...THEMES.find(g => g[0] === gid)[2].map(t => route.themes[t] || 0));
  const themeNames = route => THEMES.filter(g => themeScore(route, g[0]) >= 3).map(g => g[1]);
  const moodNames = route => [...new Set(route.moods.map(m => (groupOf(MOODS, m) || [])[1]).filter(Boolean))];
  const MUSTS = [['castle', '성·궁전'], ['beach', '해변'], ['museum', '박물관'], ['spa', '온천'], ['mountain', '산'], ['lake', '호수'], ['xmas', '크리스마스 마켓']];
  const REGIONS = [['central', '중부유럽'], ['poland', '폴란드'], ['baltic', '발트 3국'], ['balkan', '발칸'], ['adriatic', '아드리아해'], ['robg', '루마니아·불가리아'], ['hidden', '숨겨진 소도시']];
  const TAGS = [['first', '처음 가는 유럽여행'], ['solo', '혼자 떠나는 여행'], ['budget', '배낭여행'], ['couple', '커플 여행'], ['history', '역사·문화 탐방'], ['nature', '자연·트레킹'], ['beach', '해변·휴양'], ['smalltown', '소도시 중심 여행'], ['train', '기차 여행'], ['xmas', '크리스마스 마켓'], ['car', '렌터카 로드트립']];
  const SEASONS = [['spring', '봄(3~5월)', [3, 4, 5]], ['summer', '여름(6~8월)', [6, 7, 8]], ['autumn', '가을(9~11월)', [9, 10, 11]], ['winter', '겨울(12~2월)', [12, 1, 2]]];
  const BROWSE_SEASONS = SEASONS.map(s => [s[0], s[1].replace(/\(.*/, ' 여행'), s[2]]).concat([['xmas', '크리스마스 마켓', [12]], ['resort', '여름 휴양', [6, 7, 8, 9]], ['ski', '겨울 스포츠', [1, 2, 3]]]);
  const MODE = { train: '기차', bus: '버스', ferry: '배', car: '렌터카', shuttle: '셔틀', walk: '도보 트레킹' };
  const VLABEL = { c: ['확인', '2026-11 조사에서 소요시간·운행을 확인한 구간'], g: ['일반', '정기 노선으로 알려진 구간. 날짜별 시간표는 확인하지 않음'], v: ['확인 필요', '편수가 적거나 계절 운행이거나 자료마다 값이 다른 구간'] };
  const DIFF = ['', '초보자도 무난', '보통', '여행 경험자 추천'];
  const label = (list, id) => (list.find(x => x[0] === id) || [])[1] || id;
  const dur = min => { if (min == null) return '확인 필요'; const h = Math.floor(min / 60), m = Math.round((min % 60) / 5) * 5; return '약 ' + (h ? h + '시간' : '') + (m ? (h ? ' ' : '') + m + '분' : ''); };
  const flagImg = code => (N[code] && N[code].flag ? `<img class="tp-flag" src="${ROOT}assets/images/flags/${N[code].flag}.svg" alt="" width="20" height="14" loading="lazy">` : '');
  const monthsText = m => m.slice().sort((a, b) => ((a + 9) % 12) - ((b + 9) % 12)).join('·') + '월';
  const routeUrl = (id, n) => `${ROOT}travel/${id}/index.html${n ? '?n=' + n : ''}`;

  /* ---------- 모델: 박수 N → 도시 배분 → 구간·일정·비용 ---------- */
  function legFor(route, a, b) {
    const ov = route.legOverride && (route.legOverride[`${a}>${b}`] || route.legOverride[`${b}>${a}`]);
    let row = Array.isArray(ov) ? [a, b].concat(ov) : null;
    if (!row) {
      const all = D.legs.filter(l => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a));
      const wantCar = route.car === 'required';
      row = all.find(l => (l[2] === 'car') === wantCar) || all[0];
    }
    if (!row) return { a, b, missing: true, mode: 'bus', min: null, chg: 0, v: 'v', op: '교통편 정보 없음', url: '', note: '이 구간은 사이트에 정리된 교통 정보가 없습니다. 직접 확인하세요.' };
    return { a, b, mode: row[2], min: row[3], chg: row[4], v: row[5], op: row[6], url: row[7], note: row[8] };
  }
  /* 박수 배분: 최소 박수부터 채우고, 남은 박수는 (배정 ÷ 최대)가 가장 낮은 도시에 하나씩 */
  function allocate(route, n) {
    const st = route.stops.filter(s => s[3] == null || n >= s[3]);
    const alloc = st.map(s => s[1]);
    let left = n - alloc.reduce((a, b) => a + b, 0);
    if (left < 0) return null;
    while (left > 0) {
      let best = -1;
      st.forEach((s, i) => { if (alloc[i] < s[2] && (best < 0 || alloc[i] / s[2] < alloc[best] / st[best][2] - 1e-9)) best = i; });
      if (best < 0) return null;
      alloc[best]++; left--;
    }
    return st.map((s, i) => [s[0], alloc[i]]);
  }
  const rangeCache = {};
  function rangeOf(route) {
    if (rangeCache[route.id]) return rangeCache[route.id];
    // 도시 배분이 가능한 박수 가운데, 근거 자료가 권한 기간(ideal)의 앞뒤 1박까지만 연다.
    // 범위를 넓게 열면 어떤 박수를 골라도 대부분의 루트가 남기 때문이다.
    const ok = []; for (let n = 1; n <= 30; n++) if (allocate(route, n)) ok.push(n);
    const min = Math.max(ok[0], route.ideal[0] - 1), max = Math.min(ok[ok.length - 1], route.ideal[1] + 1);
    return (rangeCache[route.id] = { min, max });
  }
  const idealMid = route => Math.round((route.ideal[0] + route.ideal[1]) / 2);
  const BUCKETS = [['short', '단기', '2~4박', [2, 4]], ['mid', '중기', '5~7박', [5, 7]], ['long', '장기', '8~10박', [8, 10]], ['xlong', '초장기', '11박 이상', [11, 40]]];
  const inBucket = (route, b) => route.ideal[0] <= b[3][1] && route.ideal[1] >= b[3][0];
  const bucketsOf = route => BUCKETS.filter(b => inBucket(route, b));
  const nightsIn = (route, b) => Math.max(Math.max(b[3][0], route.ideal[0]), Math.min(Math.min(b[3][1], route.ideal[1]), idealMid(route)));
  const bucketOfN = n => BUCKETS.find(b => n >= b[3][0] && n <= b[3][1]) || BUCKETS[0];
  const idealText = route => (route.ideal[0] === route.ideal[1] ? `${route.ideal[0]}박` : `${route.ideal[0]}~${route.ideal[1]}박`);
  const cache = {};
  function plan(route, n) {
    const r = rangeOf(route); n = Math.max(r.min, Math.min(r.max, n || idealMid(route)));
    const ck = route.id + ':' + n;
    if (cache[ck]) return cache[ck];
    const stops = allocate(route, n).map(([id, k]) => ({ id, n: k, city: C[id] }));
    const legs = stops.slice(1).map((s, i) => legFor(route, stops[i].id, s.id));
    const gin = G[route.in], gout = G[route.out];
    const inLeg = gin.city && gin.city !== stops[0].id ? legFor(route, gin.city, stops[0].id) : null;
    const last = stops[stops.length - 1].id;
    const outLeg = gout.city && gout.city !== last ? legFor(route, last, gout.city) : null;
    const days = []; let d = 1;
    const usedTrips = {};
    stops.forEach((s, i) => {
      for (let k = 0; k < s.n; k++) {
        let block = s.city.days[k];
        if (!block) {
          const t = (route.trips || []).find(x => x[0] === s.id && !usedTrips[x[1]]);
          if (t) { usedTrips[t[1]] = 1; block = [`근교 당일치기: ${t[1]}`, `${s.city.ko}에서 ${t[4]}. 다녀온 뒤 저녁은 숙소 근처에서 여유 있게.`, '']; }
          else block = ['자유 일정', `${s.city.ko}에서 못 본 곳을 다시 찾거나 카페·시장에서 쉬어 가는 날.`, ''];
        }
        days.push({ n: d++, stay: s.id, move: k === 0 ? (i === 0 ? inLeg : legs[i - 1]) : null, arrive: i === 0 && k === 0, block });
      }
    });
    days.push({ n: d, depart: true, stay: null, from: last, move: outLeg });
    const countries = [...new Set(stops.map(s => s.city.c))];
    const coreN = stops.filter(s => N[s.city.c].core).reduce((a, s) => a + s.n, 0);
    const must = new Set(); stops.forEach(s => (s.city.must || []).forEach(m => must.add(m)));
    const moving = legs.concat(inLeg || [], outLeg || []);
    const timed = legs.filter(l => l.min != null);
    const out = { nights: n, stops, legs, inLeg, outLeg, days, countries, coreShare: coreN / n, must, moving,
      avgMin: timed.length ? timed.reduce((a, l) => a + l.min, 0) / timed.length : 0,
      maxLeg: timed.reduce((m, l) => (!m || l.min > m.min ? l : m), null),
      unsure: legs.filter(l => l.v === 'v'), density: stops.length / n };
    cache[ck] = out; return out;
  }
  /* 대표 사진(최대 3장 콜라주): 사진 후보 = 국가 페이지 사진(cityPhotos) + 도시별 Commons 사진(TRIP_WEBPHOTOS).
   * 루트마다 서로 다른 나라 → 오래 머무는 도시 순으로 최대 3곳을 고르고(도시가 적으면 같은 도시에서 여러 장),
   * 각 자리에 지금까지 가장 적게 쓰인 사진을 넣는다. 루트 순서대로 한 번만 계산하므로 항상 같은 결과가 나온다. */
  const WEB = window.TRIP_WEBPHOTOS || {};
  const photoPool = cid => (WEB[cid] || []).map(p => ({ key: p[0], p })).concat(
    (D.cityPhotos && D.cityPhotos[cid] ? D.cityPhotos[cid] : []).concat(C[cid].img ? [C[cid].img] : []).filter(k => PHOTOS[k]).map(k => ({ key: k, p: PHOTOS[k] })));
  const photoPick = {};
  (function assignPhotos() {
    const used = {};
    ROUTES.forEach(route => {
      const st = route.stops.map((s, i) => ({ id: s[0], c: C[s[0]].c, stay: s[2], i, core: N[C[s[0]].c].core }));
      const byStay = st.slice().sort((a, b) => b.core - a.core || b.stay - a.stay || a.i - b.i);
      const slots = [], seenC = new Set();
      byStay.forEach(s => { if (!seenC.has(s.c) && slots.length < 3) { slots.push(s); seenC.add(s.c); } });
      byStay.forEach(s => { if (slots.length < 3 && !slots.includes(s)) slots.push(s); });
      for (let k = 0; slots.length < 3 && k < 3; k++) byStay.forEach(s => { if (slots.length < 3) slots.push(s); });
      const pick = [];
      slots.forEach(s => {
        const cand = photoPool(s.id).filter(x => !pick.some(y => y.key === x.key)).map((x, ki) => Object.assign({ uses: used[x.key] || 0, ki }, x));
        cand.sort((a, b) => a.uses - b.uses || a.ki - b.ki);
        if (cand.length) { pick.push(cand[0]); used[cand[0].key] = (used[cand[0].key] || 0) + 1; }
      });
      photoPick[route.id] = pick.sort((a, b) => route.stops.findIndex(s => photoPool(s[0]).some(x => x.key === a.key)) - route.stops.findIndex(s => photoPool(s[0]).some(x => x.key === b.key))).map(x => x.p);
    });
  })();
  const toPh = p => ({ src: ROOT + p[0], author: p[1], license: p[2], source: p[3], alt: p[4] });
  const photosOf = route => (photoPick[route.id] || []).map(toPh);
  const photoOf = route => photosOf(route)[0] || null;
  const credit = phs => phs.map(ph => `<a href="${esc(ph.source)}" target="_blank" rel="noopener">${esc(ph.author)}</a> · ${esc(ph.license)}`).join(' / ');
  const collage = (phs, cls) => `<div class="tp-collage n${phs.length} ${cls || ''}">${phs.map(ph => `<img src="${esc(ph.src)}" alt="${esc(ph.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`).join('')}</div>`;
  const evOf = route => (route.ev || []).map(k => REFS[k] && { k, type: REFS[k][0], t: REFS[k][1], u: REFS[k][2] }).filter(Boolean);
  const evSummary = route => { const c = {}; evOf(route).forEach(e => { c[e.type] = (c[e.type] || 0) + 1; }); return ['국내', '해외', '교통', '통계'].filter(t => c[t]).map(t => `${t} ${c[t]}`).join(' · '); };

  /* ---------- 추천 엔진 ---------- */
  function gatewayValue(g, months, pref) {
    let v;
    if (g.status === 'direct') v = 1;
    else if (g.status === 'seasonal') v = !months.length ? 0.65 : months.some(m => g.months.includes(m)) ? 0.9 : 0.45;
    else v = /^(TIV|TGD|SKP|LJU|CLJ)$/.test(g.iata) ? 0.35 : 0.5;
    if (pref === 'any') v = Math.max(v, 0.7);
    if (pref === 'price') v = 0.75 + 0.25 * v;
    return v;
  }
  const isDirect = (g, months) => g.status === 'direct' || (g.status === 'seasonal' && months.length && months.every(m => g.months.includes(m)));
  /* 기간은 단기·중기·장기 세 구간. 루트의 권장 기간(ideal)이 구간과 겹치면 그 구간에 속하고,
   * 일정은 겹치는 범위 안에서 권장 기간 가운데에 가장 가까운 박수로 짠다. */
  function chooseNights(route, p) {
    if (!p.dur) return { n: p.pace === 'slow' ? route.ideal[1] : p.pace === 'fast' ? route.ideal[0] : idealMid(route), fits: true };
    return inBucket(route, p.dur) ? { n: nightsIn(route, p.dur), fits: true } : { n: idealMid(route), fits: false };
  }
  function evaluate(route, p, skip) {
    skip = skip || {};
    const months = p.months || [], r = rangeOf(route);
    const ch = chooseNights(route, p);
    const vr = plan(route, ch.n);
    const out = { route, vr, excluded: null, parts: {}, good: [], warn: [] };
    const ex = (key, why) => { if (!out.excluded && !skip[key]) out.excluded = { key, why }; };
    const names = codes => codes.map(c => N[c].ko).join('·');
    // 1단계: 필수 조건
    if (!ch.fits) ex('nights', `${p.dur[1]}(${p.dur[2]})에 맞지 않음 · 권장 ${idealText(route)}`);
    if (months.length) {
      const hit = months.filter(m => route.months.includes(m));
      if (!hit.length) ex('season', `추천 월(${monthsText(route.months)})이 아님`);
    }
    const hitX = (p.excl || []).filter(c => vr.countries.includes(c));
    if (hitX.length) ex('excl', `제외한 나라 포함(${names(hitX)})`);
    if ((p.incl || []).length && !p.incl.some(c => vr.countries.includes(c))) ex('incl', '선택한 나라를 지나지 않음');
    if (p.transit === 'public' && route.car === 'required') ex('transit', '렌터카가 필요한 루트');
    const gin = G[route.in], gout = G[route.out];
    if (p.flight === 'must' && !(isDirect(gin, months) && isDirect(gout, months))) {
      const seasonal = [gin, gout].some(g => g.status === 'seasonal');
      ex('flight', seasonal && !months.length ? '계절 직항 구간 포함(여행 달을 고르면 판단 가능)' : '입출국 공항 중 직항이 확인되지 않은 곳이 있음');
    }
    (p.musts || []).forEach(m => {
      const ok = m === 'xmas' ? vr.must.has('xmas') && route.months.includes(12) : vr.must.has(m);
      if (!ok) ex('musts', `필수 요소 없음(${label(MUSTS, m)})`);
    });
    if (p.level === 'beginner' && route.diff === 3) ex('level', '여행 경험자에게 맞는 난이도');

    // 2단계: 점수
    // 배점(예산 제외): 목적·분위기 30 · 기간 25 · 시기 20 · 항공 15 · 이동 10
    const selT = p.themes || [], selM = p.moods || [];
    const th = {}; selT.forEach(t => { th[t] = themeScore(route, t); });
    const moodHit = m => MOODS.find(g => g[0] === m)[2].some(x => route.moods.includes(x));
    const tHit = selT.filter(t => th[t] >= 2), mHit = selM.filter(moodHit);
    const tMiss = selT.filter(t => th[t] < 1);
    const tRate = selT.length ? selT.reduce((a, t) => a + [0, 0.25, 0.7, 1][Math.round(th[t])], 0) / selT.length * (tMiss.length ? 0.7 : 1) : null;
    const mRate = selM.length ? mHit.length / selM.length : null;
    let taste = tRate == null && mRate == null ? 18 : tRate != null && mRate != null ? tRate * 20 + mRate * 10 : (tRate != null ? tRate : mRate) * 30;
    if (p.comp && !route.comp.includes(p.comp)) { taste -= 3; out.warn.push(`${{ solo: '혼자', couple: '커플', friends: '친구', family: '가족' }[p.comp]} 여행에는 덜 맞는 편입니다`); }
    if (p.level === 'beginner' && route.diff === 2) taste -= 1.5;
    out.parts.taste = Math.max(0, Math.min(30, taste));
    if (tHit.length) out.good.push(`${tHit.map(t => label(THEMES, t)).join(', ')} 취향과 잘 맞습니다`);
    if (mHit.length >= 2 || (mHit.length && !tHit.length)) out.good.push(`${mHit.map(m => label(MOODS, m)).join(', ')} 분위기입니다`);
    if (tMiss.length && tHit.length) out.warn.push(`${tMiss.map(t => label(THEMES, t)).join(', ')} 요소는 이 루트에 거의 없습니다`);
    else if (selT.length && !tHit.length) out.warn.push('고른 여행 목적과는 거리가 있습니다');

    const n = vr.nights;
    out.parts.duration = p.dur ? 25 : 19;
    if (p.dur) out.good.push(`${p.dur[1]} 일정(${n}박)으로 자료에서 권하는 기간에 들어갑니다`);

    if (months.length) {
      const k = months.filter(m => route.months.includes(m)).length;
      out.parts.season = !k ? 0 : months.length === 1 || k >= 2 || route.months.length === 1 ? 20 : 16;
      if (k) out.good.push(`${months.length === 1 ? months[0] + '월' : '이 계절'}은 추천 월(${monthsText(route.months)})에 들어갑니다`);
    } else out.parts.season = 13;

    out.parts.flight = (gatewayValue(gin, months, p.flight) + gatewayValue(gout, months, p.flight)) / 2 * 15;
    const dIn = isDirect(gin, months), dOut = isDirect(gout, months);
    if (dIn && dOut) out.good.push('입출국 모두 인천 직항 공항입니다');
    else if (dIn || dOut) out.good.push(`${dIn ? '입국' : '출국'}은 직항(${(dIn ? gin : gout).ko}), ${dIn ? '출국' : '입국'}은 경유입니다`);
    else out.warn.push('입출국 모두 경유가 필요합니다');

    // 3단계: 현실성
    let mob = 10;
    if (vr.avgMin > 240) mob -= 2.5; else if (vr.avgMin > 180) mob -= 1;
    if (vr.maxLeg && vr.maxLeg.min > 480) mob -= 3; else if (vr.maxLeg && vr.maxLeg.min > 330) mob -= 2;
    mob -= Math.min(2.5, vr.unsure.length * 0.8);
    mob -= vr.legs.reduce((a, l) => a + l.chg, 0) * 0.4;
    const dens = vr.density, tol = p.pace === 'fast' || p.moves === 'many' ? 0.12 : p.pace === 'slow' || p.moves === 'few' ? -0.1 : 0;
    if (dens > 0.65 + tol) mob -= 3; else if (dens > 0.5 + tol) mob -= 1.5;
    if (p.moves === 'few' && vr.stops.length > 3) mob -= 1.5;
    if (p.transit === 'public' && route.car === 'optional') { mob -= 1; out.warn.push('일부 구간은 렌터카가 없으면 불편합니다'); }
    if (p.transit === 'car' && route.car !== 'no') mob += 1;
    out.parts.move = Math.max(0, Math.min(10, mob));
    if (vr.legs.length && vr.avgMin <= 180 && !vr.unsure.length) out.good.push(`도시 간 이동이 평균 ${dur(vr.avgMin).replace('약 ', '')}로 편합니다`);
    if (vr.maxLeg && vr.maxLeg.min > 330) out.warn.push(`${C[vr.maxLeg.a].ko} → ${C[vr.maxLeg.b].ko} 구간이 ${dur(vr.maxLeg.min)}으로 깁니다`);
    if (vr.unsure.length) out.warn.push(`${vr.unsure.map(l => `${C[l.a].ko}–${C[l.b].ko}`).join(', ')} 구간은 편수가 적어 시간표 확인이 필요합니다`);
    if (dens > 0.5 + tol) out.warn.push(`${n}박에 ${vr.stops.length}곳을 옮겨 다녀 숙소 이동이 잦습니다`);
    if (route.car === 'required') out.warn.push('렌터카가 필요합니다');

    out.score = Math.round(Object.values(out.parts).reduce((a, b) => a + b, 0));
    return out;
  }
  const SORTS = [['fit', '나에게 가장 적합한 순', (a, b) => b.score - a.score], ['evidence', '근거 자료가 많은 순', (a, b) => (b.route.ev || []).length - (a.route.ev || []).length || b.score - a.score],
    ['move', '이동이 편리한 순', (a, b) => b.parts.move - a.parts.move || a.vr.avgMin - b.vr.avgMin], ['slow', '여유로운 순', (a, b) => a.vr.density - b.vr.density],
    ['multi', '많은 국가를 방문하는 순', (a, b) => b.vr.countries.length - a.vr.countries.length || b.score - a.score]];
  const HARD = { nightsNear: '권장 기간 정확히 일치', excl: '제외한 나라', incl: '꼭 가고 싶은 나라', transit: '대중교통만', nights: '여행 기간', flight: '직항 필수', musts: '필수 요소', level: '초보자 난이도', season: '여행 시기' };

  /* ---------- 저장(브라우저 로컬) ---------- */
  const KEY = 'kuera-trip-saved', PKEY = 'kuera-trip-prefs4';
  const load = (k, d) => { try { return JSON.parse((k === PKEY ? sessionStorage : localStorage).getItem(k)) || d; } catch (e) { return d; } };
  const store = (k, v) => { try { (k === PKEY ? sessionStorage : localStorage).setItem(k, JSON.stringify(v)); } catch (e) { /* 저장이 막힌 브라우저에서는 그냥 넘어간다 */ } };
  const saved = () => load(KEY, []);
  function toggleSave(id) { const s = saved(), i = s.indexOf(id); if (i < 0) s.push(id); else s.splice(i, 1); store(KEY, s); return i < 0; }

  /* ---------- 공통 조각 ---------- */
  function sketch(vr, big) {
    const pts = vr.stops.map(s => [s.city.lon, s.city.lat]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, k = Math.cos(cy * Math.PI / 180);
    const span = Math.max((Math.max(...xs) - Math.min(...xs)) * k, Math.max(...ys) - Math.min(...ys), 0.6);
    const W = big ? 640 : 200, H = big ? 360 : 120, pad = big ? 60 : 22, sc = Math.min(W - pad * 2, H - pad * 2) / span;
    const xy = p => [W / 2 + (p[0] - cx) * k * sc, H / 2 - (p[1] - cy) * sc];
    const P = pts.map(xy);
    return `<svg class="tp-sketch" viewBox="0 0 ${W} ${H}" role="img" aria-label="방문 순서: ${esc(vr.stops.map(s => s.city.ko).join(' → '))}">
<polyline points="${P.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="${big ? 2.5 : 2}" stroke-dasharray="1 6" stroke-linecap="round"/>
${P.map((p, i) => `<g transform="translate(${p[0].toFixed(1)},${p[1].toFixed(1)})"><circle r="${big ? 13 : 9}"/><text text-anchor="middle" dy=".35em">${i + 1}</text>${big ? `<text class="nm" x="18" dy=".35em">${esc(vr.stops[i].city.ko)}</text>` : ''}</g>`).join('')}</svg>`;
  }
  const chain = vr => vr.stops.map(s => `<span>${esc(s.city.ko)}<i>${s.n}박</i></span>`).join('<b aria-hidden="true">→</b>');
  const countryList = vr => vr.countries.map(c => `<span class="tp-country${N[c].core ? '' : ' is-adj'}">${flagImg(c)}${esc(N[c].ko)}${N[c].core ? '' : '<small>연계</small>'}</span>`).join('');
  const monthBar = (months, sel) => `<ol class="tp-months" aria-label="추천 월: ${monthsText(months)}">${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<li class="${months.includes(m) ? 's3' : 's0'}${sel && sel.includes(m) ? ' is-sel' : ''}" title="${m}월${months.includes(m) ? ': 추천' : ''}"><span>${m}</span></li>`).join('')}</ol>`;
  function flightLine(route) {
    const one = g => `${esc(g.ko)}(${g.iata}) ${g.status === 'direct' ? '<em class="ok">직항</em>' : g.status === 'seasonal' ? `<em class="mid">계절 직항 ${g.months[0]}~${g.months[g.months.length - 1]}월</em>` : '<em>경유</em>'}`;
    return route.in === route.out ? `${one(G[route.in])} 왕복` : `입국 ${one(G[route.in])} · 출국 ${one(G[route.out])}`;
  }
  const photoFig = (phs, cls) => (phs.length ? `<figure class="${cls}">${collage(phs)}<figcaption>사진: ${credit(phs)} · Wikimedia Commons</figcaption></figure>` : '');
  const saveBtn = id => { const on = saved().includes(id); return `<button type="button" class="tp-save" data-save="${id}" aria-pressed="${on}"><span aria-hidden="true">${on ? '★' : '☆'}</span> ${on ? '저장됨' : '저장'}</button>`; };
  function bindSave(root, after) {
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-save]'); if (!b) return;
      const on = toggleSave(b.dataset.save);
      root.querySelectorAll(`[data-save="${b.dataset.save}"]`).forEach(x => { x.setAttribute('aria-pressed', String(on)); x.innerHTML = `<span aria-hidden="true">${on ? '★' : '☆'}</span> ${on ? '저장됨' : '저장'}`; });
      if (after) after();
    });
  }
  function miniCard(route, sub) {
    const vr = plan(route), phs = photosOf(route);
    return `<li class="tp-mini"><a href="${routeUrl(route.id)}">
  <div class="tp-mini-img">${phs.length ? collage(phs) : sketch(vr)}</div>
  <div class="tp-mini-txt"><h4>${esc(route.ko)}</h4><p>${bucketsOf(route).map(b => b[1]).join('·')}(${idealText(route)}) · ${vr.countries.length}개국 · 추천 ${monthsText(route.months)}</p>${sub ? `<p class="tp-mini-sub">${esc(sub)}</p>` : ''}</div></a></li>`;
  }

  /* ---------- 여행 메인 ---------- */
  const CORE = Object.keys(N).filter(c => N[c].core);
  const DEFAULTS = { dur: '', when: '', themes: [], moods: [], pace: '', incl: [], excl: [], flight: 'prefer', transit: '', comp: '', moves: '', musts: [], level: '', sort: 'fit' };
  function toPrefs(s) {
    const p = { themes: s.themes, moods: s.moods, pace: s.pace, incl: s.incl, excl: s.excl, flight: s.flight, transit: s.transit, comp: s.comp, moves: s.moves, musts: s.musts, level: s.level };
    if (s.dur) p.dur = BUCKETS.find(b => b[0] === s.dur);
    const season = SEASONS.find(x => x[0] === s.when);
    p.months = season ? season[2] : s.when ? [+s.when] : [];
    return p;
  }

  function renderTrip(main) {
    const state = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), load(PKEY, {}));
    const chips = (name, opts, multi) => `<div class="tp-chips" role="group" data-name="${name}"${multi ? ' data-multi' : ''}>${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="false">${l}</button>`).join('')}</div>`;
    const field = (title, hint, body, id) => `<fieldset class="tp-field"${id ? ` id="${id}"` : ''}><legend>${title}${hint ? `<small>${hint}</small>` : ''}</legend>${body}</fieldset>`;
    const coreOpts = CORE.map(c => [c, N[c].ko]);
    const direct = Object.values(G).filter(g => g.status !== 'via');
    const monthOpts = Array.from({ length: 12 }, (_, i) => [String(i + 1), `${i + 1}월`]);
    const statRows = (D.stats || []).map(s => `<li><span class="tp-stat-k">${esc(s.k)}</span><strong>${esc(s.v)}</strong><span class="tp-stat-n">${esc(s.n)} ${(s.refs || []).filter(k => REFS[k]).map(k => `<a href="${esc(REFS[k][2])}" target="_blank" rel="noopener">출처</a>`).join(' ')}</span></li>`).join('');
    main.innerHTML = `
<section class="page-head night tp-head">
  <div class="wrap"><p class="kicker">Travel</p><h1>동유럽 여행 루트 찾기</h1>
  <p>여행 기간(단기·중기·장기·초장기)과 달을 고르면 그 조건에 정말 맞는 루트만 남깁니다. ${ROUTES.length}개 루트는 국내 여행사·블로그와 해외 일정 가이드, 교통 자료, 방문 통계를 근거로 골랐고, 루트마다 근거 링크를 붙였습니다.</p>
  <p class="jobs-edition">중동부유럽·발칸·발트 및 인접 연계 여행지 · 루트 ${ROUTES.length}개 · 도시 ${Object.keys(C).length}곳 · ${D.checked} 확인</p>
  <nav class="tp-jump" aria-label="여행 페이지 안에서 이동"><a href="#finder">맞춤 루트 찾기</a><a href="#season">계절별</a><a href="#region">지역별</a><a href="#theme">테마별</a><a href="#prep">여행 준비</a></nav></div>
</section>
<div class="wrap tp-wrap">
  <section class="tp-finder" id="finder" aria-labelledby="finder-h">
    <h2 id="finder-h">맞춤 여행 루트 찾기</h2>
    <p class="tp-lead">기간과 달은 꼭 맞는 루트만 남기는 조건입니다. 나머지 조건은 순위에 반영하고, 비워 둔 항목은 중립으로 봅니다.</p>
    <form class="tp-form" onsubmit="return false">
      <div class="tp-grid">
        ${field('여행 기간', '현지 숙박 기준', `<div class="tp-chips tp-dur" role="group" data-name="dur">${BUCKETS.map(b => `<button type="button" data-v="${b[0]}" aria-pressed="false"><strong>${b[1]}</strong><small>${b[2]}</small></button>`).join('')}</div>
          <p class="tp-hint">인천 출발부터 귀국까지는 현지 숙박에 약 2일을 더합니다(단기 4~6일, 중기 7~9일, 장기 10~12일, 초장기 13일 이상). 고른 구간에 권장 기간이 들어가는 루트만 남깁니다.</p>`, 'f-nights')}
        ${field('여행 시기', '추천 월이 맞는 루트만', `<div class="tp-month-grid">${chips('when', monthOpts)}</div>${chips('when', SEASONS.map(s => [s[0], s[1]]))}<p class="tp-hint">루트마다 정말 추천하는 달만 1~4개 골라 두었습니다. 그 달이 아닌 루트는 결과에서 빠집니다.</p>`, 'f-when')}
        ${field('여행 속도', '', chips('pace', [['slow', '여유로운 여행'], ['mid', '적당한 관광'], ['fast', '최대한 많은 곳']]))}
        ${field('여행 목적', '여러 개 선택', chips('themes', THEMES, true), 'f-themes')}
        ${field('여행 분위기', '여러 개 선택', chips('moods', MOODS, true), 'f-moods')}
      </div>
      <details class="tp-more"><summary>상세 조건 <span class="tp-more-n"></span></summary>
        <div class="tp-grid">
          ${field('꼭 가고 싶은 나라', '하나 이상 포함', chips('incl', coreOpts, true))}
          ${field('제외할 나라', '이미 다녀온 나라 등', chips('excl', coreOpts, true))}
          ${field('항공편', '인천 출발 기준', chips('flight', [['must', '직항 필수'], ['prefer', '직항 우선'], ['any', '경유 허용']]))}
          ${field('현지 교통', '', chips('transit', [['public', '대중교통만'], ['car', '렌터카 가능']]) + '<p class="tp-hint">현재 등록된 루트는 모두 육로·배 이동이며 현지 항공 구간은 없습니다.</p>')}
          ${field('동행', '', chips('comp', [['solo', '혼자'], ['couple', '커플'], ['friends', '친구'], ['family', '가족']]))}
          ${field('도시 이동', '', chips('moves', [['few', '적게'], ['mid', '보통'], ['many', '많아도 괜찮음']]))}
          ${field('여행 난이도', '', chips('level', [['beginner', '초보자'], ['mid', '보통'], ['expert', '경험자']]))}
          ${field('필수 요소', '모두 있는 루트만', chips('musts', MUSTS, true))}
        </div>
      </details>
      <div class="tp-actions"><a class="tp-go" href="#results">추천 루트 보기 <span class="tp-go-n"></span></a><button type="button" class="tp-reset">조건 초기화</button></div>
    </form>
  </section>

  <section class="tp-results" id="results" aria-labelledby="results-h">
    <div class="tp-results-head"><h2 id="results-h">추천 결과</h2>
      <label class="tp-sort">정렬 <select data-in="sort">${SORTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label></div>
    <p class="tp-count" aria-live="polite"></p>
    <div class="tp-saved"></div>
    <ol class="tp-list"></ol>
    <div class="tp-after"></div>
    <p class="tp-disclaimer">추천 점수는 사이트가 정리한 루트 데이터(${D.checked} 확인)와 고른 조건을 견준 참고값입니다. 실시간 항공권·시간표·숙박 요금을 반영하지 않으며, 같은 조건이면 언제나 같은 결과가 나옵니다. 배점: 목적·분위기 30 · 기간 25 · 시기 20 · 항공 접근성 15 · 이동 편의 10.</p>
  </section>

  <section class="tp-browse" id="season" aria-labelledby="season-h"><h2 id="season-h">계절별 추천 여행</h2>
    <p class="tp-lead">루트마다 정한 추천 월이 그 계절에 들어가는 루트만 보여 줍니다.</p>
    ${chips('season', BROWSE_SEASONS.map(s => [s[0], s[1]]))}<ul class="tp-minis" data-out="season"></ul></section>
  <section class="tp-browse" id="region" aria-labelledby="region-h"><h2 id="region-h">지역별 여행 루트</h2>
    ${chips('region', REGIONS)}<ul class="tp-minis" data-out="region"></ul></section>
  <section class="tp-browse" id="theme" aria-labelledby="theme-h"><h2 id="theme-h">테마별 추천</h2>
    ${chips('tag', TAGS)}<ul class="tp-minis" data-out="tag"></ul></section>

  <section class="tp-prep" id="prep" aria-labelledby="prep-h"><h2 id="prep-h">여행 준비 가이드</h2>
    <div class="tp-prep-grid">
      <article class="tp-prep-wide"><h3>숫자로 보는 한국인의 동유럽 여행</h3>
        <ul class="tp-stats">${statRows}</ul>
        <p class="tp-hint">각국 통계청·관광청 수치를 인용한 기사와 자료입니다. 집계 기준(도착객·숙박객)이 나라마다 달라 서로 직접 비교하기는 어렵습니다.</p></article>
      <article><h3>한국 출발 항공 접근성</h3>
        <p>인천에서 직항으로 닿는 공항입니다(${D.checked} 확인). 운항 요일과 횟수는 3월 말·10월 말 시즌 교체 때 바뀌므로 예약 전에 항공사에서 날짜를 넣어 확인하세요.</p>
        <table class="tp-table"><thead><tr><th>공항</th><th>구분</th><th>항공사</th></tr></thead><tbody>${direct.map(g => `<tr><td>${esc(g.ko)} <span class="tp-code">${g.iata}</span></td><td>${g.status === 'direct' ? '직항' : `계절 직항(${g.months[0]}~${g.months[g.months.length - 1]}월)`}</td><td>${g.src ? `<a href="${esc(g.src)}" target="_blank" rel="noopener">${esc(g.by)}</a>` : esc(g.by)}</td></tr>`).join('')}</tbody></table>
        <p class="tp-hint">그 밖의 도시는 위 공항이나 프랑크푸르트·뮌헨·도하 등에서 1회 경유합니다. 들어가는 도시와 나오는 도시가 다른 다구간(오픈조) 항공권을 쓰면 되돌아가는 이동을 줄일 수 있습니다. 항공료는 싣지 않습니다.</p></article>
      <article><h3>도시 간 버스·기차</h3>
        <p>중부유럽은 직행 열차가 촘촘하고, 발트 3국과 발칸은 버스가 중심입니다. 발칸의 국제 버스는 편수가 적고 시간표가 자주 바뀌니 전날 터미널에서 확인하세요.</p>
        <ul class="tp-links">${[['체코 ČD', 'https://www.cd.cz/en/'], ['오스트리아 ÖBB', 'https://www.oebb.at/en/'], ['헝가리 MÁV', 'https://jegy.mav.hu/'], ['폴란드 PKP Intercity', 'https://www.intercity.pl/en/'], ['발트 Lux Express', 'https://luxexpress.eu/'], ['리투아니아 LTG Link', 'https://ltglink.lt/en'], ['RegioJet', 'https://regiojet.com/'], ['FlixBus', 'https://global.flixbus.com/'], ['크로아티아 Jadrolinija(배)', 'https://www.jadrolinija.hr/en'], ['루마니아 CFR', 'https://www.cfrcalatori.ro/en/'], ['세르비아 Srbijavoz', 'https://www.srbijavoz.rs/']].map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a></li>`).join('')}</ul></article>
      <article><h3>입국·국경</h3>
        <p>한국 여권은 이 사이트가 다루는 나라에 단기 무비자로 들어갈 수 있습니다. 솅겐 지역(폴란드·체코·슬로바키아·헝가리·발트 3국·슬로베니아·크로아티아·루마니아·불가리아 등)은 합산 180일 중 90일이며, 세르비아·보스니아·몬테네그로·알바니아·북마케도니아는 나라별 규정을 따로 적용합니다.</p>
        <p>EU 출입국 시스템(EES)과 사전 여행허가(ETIAS)는 시행 일정이 여러 번 바뀌었습니다. 출발 전에 공식 안내로 현재 적용 여부를 확인하세요.</p>
        <ul class="tp-links">${D.official.map(o => `<li><a href="${o.u}" target="_blank" rel="noopener">${esc(o.t)}</a></li>`).join('')}</ul></article>
      <article class="tp-prep-wide"><h3>국가별 여행 정보</h3>
        <p>관광지·음식·문화는 국가 페이지에서 볼 수 있습니다. 폴란드·체코·헝가리는 직항·계절·물가를 정리한 여행 실전 정보가 있습니다.</p>
        <ul class="tp-country-links">${CORE.map(c => `<li><a href="${ROOT}countries/${N[c].slug}/travel/index.html">${flagImg(c)}${esc(N[c].ko)}</a></li>`).join('')}</ul>
        <p class="tp-hint">숙소 검색은 아직 사이트에 없습니다. 루트 상세의 숙박 도시·숙박 수를 예약 사이트에서 그대로 검색해 쓰세요.</p></article>
      <article class="tp-prep-wide"><h3>이 페이지의 정보는 어떻게 확인했나</h3>
        <p>루트는 국내 여행사 상품·블로그와 해외 일정 가이드에서 되풀이해 추천되는 동선을 2026년 11월에 검색으로 확인해 골랐고, 루트마다 근거 링크(국내·해외·교통·통계)를 붙였습니다. 구간마다 <span class="tp-v vc">확인</span> <span class="tp-v vg">일반</span> <span class="tp-v vv">확인 필요</span> 등급을 달았고, 운행하지 않는 노선이나 확인하지 못한 가격은 싣지 않았습니다.</p>
        <details class="tp-src"><summary>참고한 자료 ${Object.keys(REFS).length + D.sources.length}건</summary><ul>${Object.values(REFS).map(r => `<li><span class="tp-ev-t">${esc(r[0])}</span> <a href="${esc(r[2])}" target="_blank" rel="noopener">${esc(r[1])}</a></li>`).join('')}${D.sources.map(s => `<li><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a></li>`).join('')}</ul></details></article>
    </div>
  </section>
</div>`;
    const $ = s => main.querySelector(s), $$ = s => [...main.querySelectorAll(s)];

    /* 조건 입력 ↔ state */
    function syncForm() {
      $$('.tp-form .tp-chips').forEach(g => {
        const v = state[g.dataset.name];
        g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Array.isArray(v) ? v.includes(b.dataset.v) : v === b.dataset.v)));
      });
      $$('[data-in]').forEach(el => { if (el.type === 'checkbox') el.checked = !!state[el.dataset.in]; else el.value = state[el.dataset.in]; });
      $$('[data-show]').forEach(el => { const [k, v] = el.dataset.show.split('='); el.hidden = v ? state[k] !== v : !state[k]; });
      const cnt = ['incl', 'excl', 'musts'].reduce((a, k) => a + state[k].length, 0) + ['transit', 'comp', 'moves', 'level'].filter(k => state[k]).length + (state.flight !== 'prefer' ? 1 : 0);
      $('.tp-more-n').textContent = cnt ? `${cnt}개 적용 중` : '';
    }
    main.querySelector('.tp-form').addEventListener('click', e => {
      const b = e.target.closest('.tp-chips button'); if (!b) return;
      const g = b.parentNode, name = g.dataset.name;
      if (g.hasAttribute('data-multi')) { const i = state[name].indexOf(b.dataset.v); if (i < 0) state[name].push(b.dataset.v); else state[name].splice(i, 1); }
      else state[name] = state[name] === b.dataset.v && name !== 'flight' && name !== 'basis' ? '' : b.dataset.v;
      if (name === 'incl') state.excl = state.excl.filter(c => !state.incl.includes(c));
      if (name === 'excl') state.incl = state.incl.filter(c => !state.excl.includes(c));
      update();
    });
    $$('[data-in]').forEach(el => el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => { state[el.dataset.in] = el.type === 'checkbox' ? el.checked : el.value; update(el); }));
    $('.tp-reset').addEventListener('click', () => { Object.assign(state, JSON.parse(JSON.stringify(DEFAULTS))); update(); });

    /* 결과 카드 */
    function card(r, i, p) {
      const { route, vr } = r, phs = photosOf(route), ph = phs[0];
      const parts = [['taste', '취향', 30], ['duration', '기간', 25], ['season', '시기', 20], ['flight', '항공', 15], ['move', '이동', 10]];
      const facts = [['여행 기간', `${bucketOfN(vr.nights)[1]} · 현지 ${vr.nights}박(총 ${vr.nights + 2}일) <small>권장 ${idealText(route)} · ${bucketsOf(route).map(b => b[1]).join('·')}</small>`],
        ['추천 월', `${monthsText(route.months)}`], ['여행 스타일', themeNames(route).join(' · ') + ` <small>${moodNames(route).join(' · ')}</small>`],
        ['도시 간 이동', vr.legs.length ? `평균 ${dur(vr.avgMin).replace('약 ', '')}${vr.maxLeg ? ` <small>가장 긴 구간 ${esc(C[vr.maxLeg.a].ko)}→${esc(C[vr.maxLeg.b].ko)} ${dur(vr.maxLeg.min).replace('약 ', '')}</small>` : ''}` : '숙소 이동 없음'],
        ['난이도', DIFF[route.diff] + (route.car === 'required' ? ' · 렌터카 필요' : route.car === 'optional' ? ' · 렌터카 있으면 편함' : ' · 대중교통 가능')],
        ['항공 접근성', flightLine(route)]];
      const ev = evSummary(route);
      return `<li class="tp-card${i < 3 ? ' is-top' : ''}">
  <div class="tp-card-media">${ph ? collage(phs) : `<div class="tp-card-noimg">${sketch(vr)}</div>`}
    <span class="tp-rank">추천 ${i + 1}위</span>${ph ? `<span class="tp-credit">사진: ${credit(phs)}</span>` : ''}</div>
  <div class="tp-card-body">
    <div class="tp-card-top"><div><h3><a href="${routeUrl(route.id, vr.nights)}">${esc(route.ko)}</a></h3><p class="tp-en" lang="en">${esc(route.en)}</p></div>
      <div class="tp-score" title="100점 만점 참고 점수"><strong>${r.score}</strong><span>점</span></div></div>
    <div class="tp-countries">${countryList(vr)}</div>
    <p class="tp-chain">${chain(vr)}</p>
    <dl class="tp-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <div class="tp-why"><h4>왜 이 코스인가</h4><p>${r.good.length ? esc(r.good.slice(0, 4).join('. ')) + '.' : '고른 조건과 뚜렷하게 맞는 점은 적지만 무난한 루트입니다.'}</p>
      ${r.warn.length ? `<p class="tp-warn"><strong>주의</strong> ${esc(r.warn.slice(0, 3).join('. '))}.</p>` : ''}
      ${ev ? `<p class="tp-evline"><a href="${routeUrl(route.id, vr.nights)}#evidence">추천 근거 ${evOf(route).length}건</a> <span>${esc(ev)}</span></p>` : ''}</div>
    <div class="tp-bars" aria-label="점수 내역">${parts.map(([k, l, max]) => `<span title="${l} ${r.parts[k].toFixed(1)} / ${max}"><i>${l}</i><b><u style="width:${Math.round(r.parts[k] / max * 100)}%"></u></b><em>${Math.round(r.parts[k])}/${max}</em></span>`).join('')}</div>
    <div class="tp-card-foot"><div class="tp-mapmini">${sketch(vr)}</div>${monthBar(route.months, p.months)}
      <div class="tp-btns">${saveBtn(route.id)}<a class="tp-detail" href="${routeUrl(route.id, vr.nights)}">${bucketOfN(vr.nights)[1]} 일정 보기</a></div></div>
  </div></li>`;
    }
    function compareTable(ids) {
      const rs = ids.map(id => ROUTES.find(r => r.id === id)).filter(Boolean).slice(0, 4);
      const rows = [['방문 도시', r => plan(r).stops.map(s => s.city.ko).join(' → ')], ['기간', r => `${bucketsOf(r).map(b => b[1]).join('·')} (권장 ${idealText(r)})`], ['방문 국가', r => plan(r).countries.map(c => N[c].ko).join(', ')],
        ['추천 월', r => monthsText(r.months)], ['이동', r => { const v = plan(r); return `평균 ${dur(v.avgMin).replace('약 ', '')}${v.maxLeg ? ` · 최장 ${dur(v.maxLeg.min).replace('약 ', '')}` : ''}`; }],
        ['항공', r => flightLine(r)], ['난이도', r => DIFF[r.diff]], ['렌터카', r => ({ no: '필요 없음', optional: '있으면 편함', required: '필요' }[r.car])]];
      return `<div class="tp-compare" tabindex="0"><table class="tp-table"><thead><tr><th></th>${rs.map(r => `<th><a href="${routeUrl(r.id)}">${esc(r.ko)}</a></th>`).join('')}</tr></thead>
<tbody>${rows.map(([k, f]) => `<tr><th>${k}</th>${rs.map(r => `<td>${f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    let showCompare = false;
    function drawSaved() {
      const ids = saved().filter(id => ROUTES.some(r => r.id === id));
      $('.tp-saved').innerHTML = ids.length ? `<div class="tp-saved-bar"><p><strong>저장한 루트 ${ids.length}개</strong> ${ids.map(id => `<a href="${routeUrl(id)}">${esc(ROUTES.find(r => r.id === id).ko)}</a>`).join(' · ')}</p>
  <button type="button" class="tp-cmp-btn" aria-expanded="${showCompare}">${showCompare ? '비교 닫기' : ids.length > 1 ? '나란히 비교' : '요약 보기'}</button></div>${showCompare ? compareTable(ids) + (ids.length > 4 ? '<p class="tp-hint">비교표는 먼저 저장한 4개까지 보여 줍니다.</p>' : '') : ''}<p class="tp-hint">저장 목록은 이 브라우저에만 보관됩니다.</p>` : '';
    }
    $('.tp-saved').addEventListener('click', e => { if (e.target.closest('.tp-cmp-btn')) { showCompare = !showCompare; drawSaved(); } });
    bindSave(main, drawSaved);

    function draw() {
      const p = toPrefs(state);
      const all = ROUTES.map(r => evaluate(r, p));
      const sorter = SORTS.find(s => s[0] === state.sort)[2];
      const ok = all.filter(r => !r.excluded).sort(sorter);
      const out = all.filter(r => r.excluded);
      const any = Object.keys(DEFAULTS).some(k => k !== 'sort' && JSON.stringify(state[k]) !== JSON.stringify(DEFAULTS[k]));
      $('.tp-go-n').textContent = `${ok.length}개`;
      $('.tp-count').textContent = ok.length ? `조건에 맞는 루트 ${ok.length}개${out.length ? ` · 제외 ${out.length}개` : ''}${any ? '' : ' · 기간과 달을 고르면 맞는 루트만 남습니다'}` : '';
      $('.tp-list').innerHTML = ok.map((r, i) => card(r, i, p)).join('');
      let after = '';
      if (ok.length < 4 && out.length) {
        const keys = [...new Set(out.map(r => r.excluded.key))];
        const tips = keys.map(k => { const s = {}; s[k] = 1; return [k, ROUTES.filter(r => !evaluate(r, p, s).excluded).length - ok.length]; }).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
        const near = p.dur ? BUCKETS.filter(b => b !== p.dur).map(b => [b, ROUTES.filter(r => !evaluate(r, Object.assign({}, p, { dur: b })).excluded).length]).filter(x => x[1] > ok.length) : [];
        after += `<div class="tp-empty"><h3>${ok.length ? '맞는 루트가 적습니다' : '조건을 모두 만족하는 루트가 없습니다'}</h3>
  <p>점수를 억지로 올려 보여 주지 않습니다. 아래처럼 바꾸면 더 많은 루트가 나옵니다.</p>
  <ul>${near.map(([b, c]) => `<li><button type="button" data-setd="${b[0]}">${b[1]}(${b[2]})로 바꾸기</button> <span>루트 ${c}개</span></li>`).join('')}${tips.map(([k, c]) => `<li><button type="button" data-relax="${k}">‘${HARD[k]}’ 조건 풀기</button> <span>루트 ${c}개 추가</span></li>`).join('')}${!near.length && !tips.length ? '<li>조건 하나만 풀어서는 늘지 않습니다. 조건 초기화 후 꼭 필요한 것부터 다시 골라 보세요.</li>' : ''}</ul></div>`;
      }
      if (out.length) after += `<details class="tp-excluded"><summary>제외된 루트 ${out.length}개와 이유</summary><ul>${out.map(r => `<li><a href="${routeUrl(r.route.id)}">${esc(r.route.ko)}</a> <span>${esc(r.excluded.why)}</span></li>`).join('')}</ul></details>`;
      $('.tp-after').innerHTML = after;
    }
    $('.tp-after').addEventListener('click', e => {
      const s = e.target.closest('[data-setd]'); if (s) { state.dur = s.dataset.setd; update(); return; }
      const b = e.target.closest('[data-relax]'); if (!b) return;
      const k = b.dataset.relax;
      if (k === 'excl' || k === 'incl' || k === 'musts') state[k] = []; else if (k === 'transit') state.transit = ''; else if (k === 'nights') state.dur = '';
      else if (k === 'flight') state.flight = 'prefer'; else if (k === 'level') state.level = ''; else if (k === 'season') state.when = '';
      update();
    });
    function update(skipEl) { store(PKEY, state); if (!skipEl) syncForm(); else $$('[data-show]').forEach(el => { const [k, v] = el.dataset.show.split('='); el.hidden = v ? state[k] !== v : !state[k]; }); draw(); }

    /* 계절·지역·테마 둘러보기 */
    const mm = new Date().getMonth() + 1;
    const browse = { season: (SEASONS.find(s => s[2].includes(mm)) || SEASONS[0])[0], region: 'central', tag: 'first' };
    function pickBrowse(kind, v) {
      if (kind === 'season') {
        const s = BROWSE_SEASONS.find(x => x[0] === v);
        let list = ROUTES.map(r => [r, s[2].filter(m => r.months.includes(m)).length]).filter(x => x[1] > 0);
        if (v === 'xmas') list = list.filter(x => x[0].tags.includes('xmas') || (x[0].themes.winter || 0) >= 3);
        if (v === 'resort') list = list.filter(x => (x[0].themes.beach || 0) >= 3);
        if (v === 'ski') list = list.filter(x => plan(x[0]).must.has('mountain') && (x[0].themes.winter || 0) >= 3);
        return list.sort((a, b) => b[1] - a[1] || a[0].months.length - b[0].months.length).map(x => miniCard(x[0], `추천 월 ${monthsText(x[0].months)} · ${x[0].seasonNote}`));
      }
      return ROUTES.filter(r => (kind === 'region' ? r.region : r.tags).includes(v)).map(r => miniCard(r, r.intro));
    }
    function drawBrowse(kind) {
      $(`.tp-chips[data-name="${kind}"]`).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === browse[kind])));
      const items = pickBrowse(kind, browse[kind]);
      $(`[data-out="${kind}"]`).innerHTML = items.length ? items.join('') : '<li class="tp-none">이 조건에 맞는 루트가 아직 없습니다.</li>';
    }
    ['season', 'region', 'tag'].forEach(kind => {
      $(`.tp-chips[data-name="${kind}"]`).addEventListener('click', e => { const b = e.target.closest('button'); if (b) { browse[kind] = b.dataset.v; drawBrowse(kind); } });
      drawBrowse(kind);
    });
    if (!matchMedia('(max-width: 760px)').matches && ['incl', 'excl', 'musts'].some(k => state[k].length)) $('.tp-more').open = true;
    syncForm(); draw(); drawSaved();
  }

  /* ---------- 루트 상세 ---------- */
  function loadLeaflet(cb) {
    if (window.L) return cb(true);
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => cb(true); js.onerror = () => cb(false); document.head.appendChild(js);
  }
  function renderRoute(main, id) {
    const route = ROUTES.find(r => r.id === id);
    if (!route) { main.innerHTML = `<section class="page-head night"><div class="wrap"><h1>루트를 찾을 수 없습니다</h1><p><a href="${ROOT}travel/index.html" style="color:#fff">여행 루트 목록으로</a></p></div></section>`; return; }
    document.title = `${route.ko} | 여행 루트 | ` + (document.title.split('|').pop() || '').trim();
    // 기간 탭: 이 루트가 속하는 구간(단기·중기·장기)마다 하나. URL의 ?n= 박수가 속한 구간 탭을 연다.
    const tabs = bucketsOf(route).map(b => [b, nightsIn(route, b)]);
    const want = parseInt(new URLSearchParams(location.search).get('n'), 10);
    let nights = (tabs.find(t => t[1] === want) || tabs.find(t => want >= t[0][3][0] && want <= t[0][3][1]) || tabs.find(t => t[1] === idealMid(route)) || tabs[0])[1];
    let map = null, layer = null;
    const phs = photosOf(route), gin = G[route.in], gout = G[route.out];
    const themeTop = themeNames(route);
    const related = ROUTES.filter(r => r.id !== route.id && r.region.some(x => route.region.includes(x))).slice(0, 4);
    const ev = evOf(route);
    const gwBlock = (g, role) => `<div class="tp-gw"><h4>${role} · ${esc(g.ko)} <span class="tp-code">${g.iata}</span> <span class="tp-v ${g.status === 'direct' ? 'vc' : g.status === 'seasonal' ? 'vg' : 'vv'}">${g.status === 'direct' ? '인천 직항' : g.status === 'seasonal' ? `계절 직항 ${g.months[0]}~${g.months[g.months.length - 1]}월` : '경유'}</span></h4>
  ${g.by ? `<p class="tp-gw-by">${g.src ? `<a href="${esc(g.src)}" target="_blank" rel="noopener">${esc(g.by)}</a>` : esc(g.by)}</p>` : ''}<p>${esc(g.note)}</p></div>`;
    const nightBtns = tabs.map(([b, n]) => `<button type="button" role="tab" data-nn="${n}">${b[1]}<small>${b[2]} · 이 루트는 ${n}박</small></button>`);
    main.innerHTML = `
<section class="page-head night tp-route-head">
  <div class="wrap"><nav class="crumbs" aria-label="현재 위치"><a href="${ROOT}index.html">Home</a><span aria-hidden="true">/</span><a href="${ROOT}travel/index.html">Travel</a><span aria-hidden="true">/</span><span aria-current="page">${esc(route.ko)}</span></nav>
  <p class="kicker">${route.region.map(r => label(REGIONS, r)).join(' · ')}</p><h1>${esc(route.ko)}</h1><p class="tp-en" lang="en">${esc(route.en)}</p>
  <p>${esc(route.intro)}</p>
  <div class="tp-head-btns">${saveBtn(route.id)}<a href="${ROOT}travel/index.html#finder">다른 루트 찾기</a></div></div>
</section>
<div class="wrap tp-wrap tp-route">
  <div class="tp-variant" role="tablist" aria-label="여행 기간(현지 숙박)">${nightBtns.join('')}</div>
  <section class="tp-sec" id="overview"><h2>여행 개요</h2>
    <div class="tp-over">${photoFig(phs, 'tp-photo')}
      <div><p class="tp-desc">${esc(route.desc)}</p>
      <dl class="tp-facts tp-facts-wide" data-out="facts"></dl>
      <div class="tp-proscons"><div><h3>이 코스의 장점</h3><ul>${route.pros.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h3>알아 둘 점</h3><ul>${route.cons.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div></div></div>
  </section>
  <section class="tp-sec" id="map"><h2>지도</h2>
    <div class="tp-map" id="tp-map" role="application" aria-label="루트 지도"></div>
    <ul class="tp-legend"><li><i class="lg-stop">1</i>숙박 도시(방문 순서)</li><li><i class="lg-trip"></i>추천 당일치기</li><li><i class="lg-air">✈</i>입출국 공항</li><li><i class="lg-line"></i>정기 교통편이 있는 구간</li><li><i class="lg-line is-v"></i>편수·운행 확인이 필요한 구간</li></ul>
    <p class="tp-hint">선은 도시를 잇는 순서만 나타낸 직선이며 실제 철도·도로 경로가 아닙니다. 지도: © OpenStreetMap 기여자.</p>
  </section>
  <section class="tp-sec" id="days"><h2>일자별 일정</h2><p class="tp-lead" data-out="days-lead"></p><ol class="tp-days" data-out="days"></ol></section>
  <section class="tp-sec" id="transport"><h2>도시 간 교통</h2><div class="tp-legs" data-out="legs"></div>
    <p class="tp-hint">소요시간은 ${D.checked}에 확인한 일반적인 범위입니다. <span class="tp-v vc">확인</span> ${VLABEL.c[1]} · <span class="tp-v vg">일반</span> ${VLABEL.g[1]} · <span class="tp-v vv">확인 필요</span> ${VLABEL.v[1]}.</p>
    ${route.border ? `<p class="tp-note"><strong>국경</strong> ${esc(route.border)}</p>` : ''}</section>
  <section class="tp-sec" id="flight"><h2>한국 출발 항공 접근성</h2>
    <p class="tp-lead">인천공항 출발 기준 · ${route.in === route.out ? '같은 공항으로 왕복' : '들어가는 공항과 나오는 공항이 다른 다구간(오픈조) 항공권 추천'}</p>
    <div class="tp-gws">${gwBlock(gin, '입국')}${route.in === route.out ? '' : gwBlock(gout, '출국')}</div>
    <ul class="tp-tips">${route.in !== route.out ? '<li>다구간 항공권은 항공사·여행사 사이트의 "다구간" 검색으로 한 번에 발권합니다. 편도 두 장보다 저렴한 경우가 많습니다.</li>' : '<li>왕복 항공권이라 마지막 날 출국 공항까지 돌아오는 이동 시간을 일정에 넣었습니다.</li>'}
      <li>직항 여부와 운항 요일은 ${D.checked}에 확인한 내용이며 시즌마다 바뀝니다. 항공료는 실시간 정보가 없어 싣지 않았습니다. 예약 전 항공사에서 날짜를 넣어 확인하세요.</li>
      <li>유럽행은 러시아 영공을 우회해 갈 때 13시간 안팎, 올 때 11시간 안팎이 걸리고, 귀국편은 대부분 다음 날 한국에 도착합니다.</li></ul></section>
  <section class="tp-sec" id="tips"><h2>여행 팁과 주의사항</h2>
    <div class="tp-season"><div><h3>추천 월</h3><p>${monthsText(route.months)}</p></div><div><h3>피할 시기</h3><p>${esc(route.avoid)}</p></div><div class="tp-season-wide"><h3>월별</h3>${monthBar(route.months)}<p class="tp-hint">진한 칸이 추천 월입니다 · ${esc(route.seasonNote)}</p></div></div>
    <ul class="tp-tips">${route.tips.map(t => `<li>${esc(t)}</li>`).join('')}<li>이런 분께: ${esc(route.who)}</li><li>현지 통화: <span data-out="cur"></span></li></ul>
    <h3>여행 전 확인할 공식 정보</h3><ul class="tp-links">${D.official.map(o => `<li><a href="${o.u}" target="_blank" rel="noopener">${esc(o.t)}</a></li>`).join('')}</ul></section>
  ${ev.length ? `<section class="tp-sec" id="evidence"><h2>추천 근거</h2>
    <p class="tp-lead">이 루트를 고르고 기간·추천 월을 정할 때 참고한 자료입니다(2026년 11월 확인). 여행사 상품 가격·일정은 출발일마다 다릅니다.</p>
    <ul class="tp-evlist">${ev.map(e => `<li><span class="tp-ev-t t-${{ 국내: 'ko', 해외: 'en', 교통: 'tr', 통계: 'st' }[e.type] || 'en'}">${esc(e.type)}</span><a href="${esc(e.u)}" target="_blank" rel="noopener">${esc(e.t)}</a></li>`).join('')}</ul></section>` : ''}
  <section class="tp-sec" id="more"><h2>관련 콘텐츠</h2>
    <h3>이 루트의 국가 페이지</h3><ul class="tp-country-links" data-out="countries"></ul>
    ${related.length ? `<h3>비슷한 지역의 다른 루트</h3><ul class="tp-minis">${related.map(r => miniCard(r, r.intro)).join('')}</ul>` : ''}
    <p class="tp-updated">정보 확인일 ${D.checked} · 루트·교통·항공 정보는 바뀔 수 있습니다. 잘못된 내용을 발견하면 학회로 알려 주세요.</p></section>
</div>`;
    const $ = s => main.querySelector(s), out = k => main.querySelector(`[data-out="${k}"]`);
    const legHtml = (l, extra) => `<article class="tp-leg${l.v === 'v' ? ' is-v' : ''}"><header><h3>${esc(C[l.a].ko)} <span aria-hidden="true">→</span> ${esc(C[l.b].ko)}</h3><span class="tp-v v${l.v}" title="${VLABEL[l.v][1]}">${VLABEL[l.v][0]}</span></header>
  <dl><div><dt>수단</dt><dd>${MODE[l.mode]} · ${esc(l.op)}</dd></div><div><dt>소요</dt><dd>${dur(l.min)}${l.min > 330 ? ' <em class="tp-long">장거리</em>' : ''}</dd></div><div><dt>환승</dt><dd>${l.chg ? `${l.chg}회` : l.mode === 'car' || l.mode === 'walk' ? '—' : '직행'}</dd></div></dl>
  ${l.note ? `<p>${esc(l.note)}</p>` : ''}${extra ? `<p>${extra}</p>` : ''}${l.url ? `<p class="tp-leg-link"><a href="${esc(l.url)}" target="_blank" rel="noopener">시간표·예매 확인</a></p>` : ''}</article>`;
    function drawMap(vr) {
      if (!map) return;
      if (layer) layer.remove();
      const L = window.L; layer = L.layerGroup().addTo(map);
      const pt = cid => [C[cid].lat, C[cid].lon], bounds = [];
      const seg = l => L.polyline([pt(l.a), pt(l.b)], { color: l.v === 'v' ? '#c2410c' : '#2457b3', weight: 3, opacity: .85, dashArray: l.v === 'v' ? '4 8' : null })
        .bindTooltip(`${C[l.a].ko} → ${C[l.b].ko} · ${MODE[l.mode]} ${dur(l.min)} (${VLABEL[l.v][0]})`, { sticky: true }).addTo(layer);
      vr.legs.forEach(seg); [vr.inLeg, vr.outLeg].filter(Boolean).forEach(seg);
      (route.trips || []).filter(t => vr.stops.some(s => s.id === t[0])).forEach(t => {
        L.polyline([pt(t[0]), [t[2], t[3]]], { color: '#64748b', weight: 1.5, dashArray: '2 5' }).addTo(layer);
        L.circleMarker([t[2], t[3]], { radius: 6, color: '#0f766e', weight: 2, fillColor: '#fff', fillOpacity: 1 }).bindPopup(`<strong>${esc(t[1])}</strong><br>당일치기 · ${esc(C[t[0]].ko)}에서 ${esc(t[4])}`).addTo(layer);
      });
      [[gin, '입국'], [gout, '출국']].filter((x, i) => i === 0 || gin !== gout).forEach(([g, role]) => {
        L.marker([g.lat, g.lon], { icon: L.divIcon({ className: 'tp-pin-air', html: '✈', iconSize: [26, 26] }), zIndexOffset: -10 }).bindPopup(`<strong>${esc(g.ko)} 공항 (${g.iata})</strong><br>${gin === gout ? '입출국' : role} · ${g.status === 'via' ? '경유' : g.status === 'seasonal' ? '계절 직항' : '인천 직항'}`).addTo(layer);
        bounds.push([g.lat, g.lon]);
      });
      vr.stops.forEach((s, i) => {
        L.marker(pt(s.id), { icon: L.divIcon({ className: 'tp-pin', html: String(i + 1), iconSize: [30, 30] }), zIndexOffset: 100 }).bindPopup(`<strong>${i + 1}. ${esc(s.city.ko)}</strong> (${esc(s.city.en)})<br>${esc(N[s.city.c].ko)} · ${s.n}박`).addTo(layer);
        bounds.push(pt(s.id));
      });
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 9 });
    }
    function draw() {
      const vr = plan(route, nights);
      main.querySelectorAll('[data-nn]').forEach(b => b.setAttribute('aria-selected', String(+b.dataset.nn === nights)));
      out('facts').innerHTML = [['방문 국가', `<span class="tp-countries">${countryList(vr)}</span>`], ['방문 도시', `<span class="tp-chain">${chain(vr)}</span>`],
        ['여행 기간', `${bucketOfN(vr.nights)[1]} · 현지 ${vr.nights}박 ${vr.nights + 1}일 <small>인천 출발~귀국 약 ${vr.nights + 2}일 · 자료에서 권하는 기간 ${idealText(route)}</small>`],
        ['추천 월', `${monthsText(route.months)} <small>${esc(route.seasonNote)}</small>`],
        ['여행 성격', themeTop.join(' · ') + ` <small>${moodNames(route).join(' · ')}</small>`],
        ['난이도', `${DIFF[route.diff]} <small>${{ no: '대중교통으로 충분', optional: '렌터카가 있으면 편함', required: '렌터카 필요' }[route.car]}</small>`],
        ['추천 대상', esc(route.who)], ['핵심 지역 숙박 비율', `${Math.round(vr.coreShare * 100)}% <small>중동부유럽·발칸·발트 기준</small>`]]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      out('days-lead').textContent = `현지 ${vr.nights}박 ${vr.nights + 1}일 · ${vr.stops.map(s => `${s.city.ko} ${s.n}박`).join(' → ')}. 위의 기간 탭이 여럿이면 눌러서 일정을 바꿔 볼 수 있습니다.`;
      out('days').innerHTML = vr.days.map(d => {
        const mv = d.move ? `<p class="tp-move"><span>이동</span> ${esc(C[d.move.a].ko)} → ${esc(C[d.move.b].ko)} · ${MODE[d.move.mode]} ${dur(d.move.min)} <span class="tp-v v${d.move.v}">${VLABEL[d.move.v][0]}</span></p>` : '';
        if (d.depart) return `<li class="tp-day is-end"><div class="tp-day-n">Day ${d.n}</div><div class="tp-day-body"><h3>출국 · ${esc(gout.ko)} 공항</h3>${mv}<p>${d.move ? `${esc(C[d.from].ko)}에서 ${esc(gout.ko)}(으)로 이동해 출국합니다. 이동 시간에 공항 수속 2~3시간을 더해 항공편을 고르세요.` : '오전에 못 본 곳을 둘러보고 공항으로 이동합니다.'} 귀국편은 대부분 다음 날 한국에 도착합니다.</p></div></li>`;
        const city = C[d.stay];
        return `<li class="tp-day"><div class="tp-day-n">Day ${d.n}</div><div class="tp-day-body"><h3>${esc(city.ko)} <small>${esc(d.block[0])}</small></h3>
  ${d.arrive ? `<p class="tp-move"><span>도착</span> 인천 → ${esc(gin.ko)} 공항${d.move ? ` → ${esc(city.ko)} (${MODE[d.move.mode]} ${dur(d.move.min)})` : ''}. 도착일은 숙소 주변 위주로 가볍게.</p>` : mv}
  <p>${esc(d.block[1])}</p>${d.block[2] ? `<p class="tp-tip">${esc(d.block[2])}</p>` : ''}<p class="tp-sleep">숙박: ${esc(city.ko)}</p></div></li>`;
      }).join('');
      out('legs').innerHTML = (vr.inLeg ? legHtml(vr.inLeg, '공항 도시에서 첫 숙박지까지의 이동입니다.') : '') + vr.legs.map(l => legHtml(l)).join('') + (vr.outLeg ? legHtml(vr.outLeg, '마지막 숙박지에서 출국 공항 도시까지의 이동입니다.') : '') || '<p>도시를 옮기지 않는 일정입니다.</p>';
      out('cur').textContent = vr.countries.map(x => `${N[x].ko} ${N[x].cur}`).join(' · ');
      out('countries').innerHTML = vr.countries.map(x => (N[x].slug ? `<li><a href="${ROOT}countries/${N[x].slug}/travel/index.html">${flagImg(x)}${esc(N[x].ko)} 관광·여행 정보</a></li>` : `<li class="is-adj">${esc(N[x].ko)} <small>인접 연계 여행지 · 사이트 국가 페이지 없음</small></li>`)).join('');
      drawMap(vr);
    }
    main.addEventListener('click', e => {
      const v = e.target.closest('[data-nn]');
      if (v) { nights = +v.dataset.nn; history.replaceState(null, '', `?n=${nights}${location.hash}`); draw(); }
    });
    bindSave(main);
    draw();
    loadLeaflet(ok => {
      const box = $('#tp-map');
      if (!ok || !window.L) { box.classList.add('is-fallback'); box.removeAttribute('role'); box.innerHTML = sketch(plan(route, nights), true) + '<p class="tp-hint">지도 라이브러리를 불러오지 못해 방문 순서만 표시했습니다.</p>'; return; }
      map = window.L.map(box, { scrollWheelZoom: false });
      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 14, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자' }).addTo(map);
      drawMap(plan(route, nights));
    });
  }

  window.TRIP_RENDER = { main: renderTrip, route: renderRoute, _debug: { evaluate, plan, rangeOf, allocate, toPrefs, DEFAULTS, photoPick, BUCKETS } };
})();
