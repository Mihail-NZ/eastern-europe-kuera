/* 동유럽 정보 사이트 공통 스크립트
 * 각 HTML의 <body data-page data-root data-slug>를 보고 헤더·지도·본문을 그린다.
 * 빌드 도구 없이 파일을 바로 열어도 동작하도록 데이터는 data-*.js 전역 변수로 읽는다. */
(function () {
  'use strict';

  const body = document.body;
  const ROOT = body.dataset.root || '';
  const PAGE = body.dataset.page || 'home';
  const COUNTRIES = (window.COUNTRY_DATA && window.COUNTRY_DATA.countries) || [];
  const MAP = window.MAP_DATA || {};
  const NEWS = window.NEWS_DATA || [];
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* 동유럽 국가: ISO3 → 한국어 이름, 국기 정의.
   * 국기는 지도 채색용 단순화 버전(문장·휘장 생략). h=가로 줄, v=세로 줄, w=줄 비율 */
  const EAST = {
    POL: { ko: '폴란드', en: 'Poland', flag: { h: ['#ffffff', '#dc143c'] } },
    CZE: { ko: '체코', en: 'Czechia', flag: { h: ['#ffffff', '#d7141a'], tri: '#11457e' } },
    SVK: { ko: '슬로바키아', en: 'Slovakia', flag: { h: ['#ffffff', '#0b4ea2', '#ee1c25'] } },
    HUN: { ko: '헝가리', en: 'Hungary', flag: { h: ['#ce2939', '#ffffff', '#477050'] } },
    SVN: { ko: '슬로베니아', en: 'Slovenia', flag: { h: ['#ffffff', '#005da4', '#ed1c24'] } },
    HRV: { ko: '크로아티아', en: 'Croatia', flag: { h: ['#ff0000', '#ffffff', '#171796'] } },
    BIH: { ko: '보스니아 헤르체고비나', en: 'Bosnia and Herzegovina', flag: { h: ['#002395'], bih: '#fecb00' } },
    SRB: { ko: '세르비아', en: 'Serbia', flag: { h: ['#c6363c', '#0c4076', '#ffffff'] } },
    KOS: { ko: '코소보', en: 'Kosovo', flag: { h: ['#244aa5'] } },
    MNE: { ko: '몬테네그로', en: 'Montenegro', flag: { h: ['#c40308'] } },
    MKD: { ko: '북마케도니아', en: 'North Macedonia', flag: { h: ['#d20000'] } },
    ALB: { ko: '알바니아', en: 'Albania', flag: { h: ['#e41e20'] } },
    BGR: { ko: '불가리아', en: 'Bulgaria', flag: { h: ['#ffffff', '#00966e', '#d62612'] } },
    ROU: { ko: '루마니아', en: 'Romania', flag: { v: ['#002b7f', '#fcd116', '#ce1126'] } },
    MDA: { ko: '몰도바', en: 'Moldova', flag: { v: ['#0046ae', '#ffd200', '#cc092f'] } },
    UKR: { ko: '우크라이나', en: 'Ukraine', flag: { h: ['#0057b7', '#ffd700'] } },
    BLR: { ko: '벨라루스', en: 'Belarus', flag: { h: ['#c8313e', '#4aa657'], w: [2, 1] } },
    LTU: { ko: '리투아니아', en: 'Lithuania', flag: { h: ['#fdb913', '#006a44', '#c1272d'] } },
    LVA: { ko: '라트비아', en: 'Latvia', flag: { h: ['#9e3039', '#ffffff', '#9e3039'], w: [2, 1, 2] } },
    EST: { ko: '에스토니아', en: 'Estonia', flag: { h: ['#0072ce', '#000000', '#ffffff'] } }
  };
  const SLUG_BY_ISO3 = { POL: 'poland', CZE: 'czechia', HUN: 'hungary', SVK: 'slovakia', SVN: 'slovenia',
    HRV: 'croatia', SRB: 'serbia', EST: 'estonia', MDA: 'moldova', BGR: 'bulgaria', ROU: 'romania', LVA: 'latvia', LTU: 'lithuania', UKR: 'ukraine', BLR: 'belarus', MKD: 'north-macedonia', ALB: 'albania' };
  const ISO3_BY_SLUG = { poland: 'POL', czechia: 'CZE', hungary: 'HUN', slovakia: 'SVK', slovenia: 'SVN',
    croatia: 'HRV', serbia: 'SRB', estonia: 'EST', moldova: 'MDA', bulgaria: 'BGR', romania: 'ROU', latvia: 'LVA', lithuania: 'LTU', ukraine: 'UKR', belarus: 'BLR', 'north-macedonia': 'MKD', albania: 'ALB' };
  const ISO3_BY_KO = {};
  Object.keys(EAST).forEach(k => { ISO3_BY_KO[EAST[k].ko] = k; });
  const SLUG_BY_KO = {};
  COUNTRIES.forEach(c => { SLUG_BY_KO[c.name_ko] = c.slug; });

  /* 지도 투영: _briefing_tool/make_map_data.ps1과 같은 식 (위도 48도 기준 등장방형, 1도=10단위) */
  const project = (lon, lat) => [(lon - 25) * Math.cos(48 * Math.PI / 180) * 10, -(lat - 48) * 10];
  /* 야간 불빛을 표시할 주요 도시 [경도, 위도, 밝기] */
  const CITIES = [
    [2.35, 48.86, 3], [4.35, 50.85, 2], [4.9, 52.37, 2.2], [4.48, 51.92, 1.6], [6.96, 50.94, 2], [8.68, 50.11, 2],
    [9.99, 53.55, 2.2], [13.4, 52.52, 2.6], [11.58, 48.14, 2], [8.54, 47.37, 1.6], [9.19, 45.46, 2.6], [7.69, 45.07, 1.6],
    [12.5, 41.9, 2.4], [14.27, 40.85, 1.8], [4.84, 45.76, 1.8], [5.37, 43.3, 1.8], [2.17, 41.39, 2.4], [16.37, 48.21, 2],
    [12.57, 55.68, 1.8], [18.07, 59.33, 1.8], [10.75, 59.91, 1.5], [24.94, 60.17, 1.5], [23.73, 37.98, 2.2],
    [22.94, 40.64, 1.4], [28.98, 41.01, 3], [32.86, 39.93, 2], [27.14, 38.42, 1.6], [37.62, 55.75, 3.2],
    [30.32, 59.94, 2.4], [39.2, 51.66, 1.4], [44.0, 56.3, 1.6], [39.7, 47.24, 1.6], [8.4, 49.0, 1.4], [6.78, 51.23, 2],
    [7.47, 51.51, 1.8], [9.73, 52.37, 1.4], [11.25, 43.77, 1.4], [11.34, 44.49, 1.5], [12.33, 45.44, 1.3]
  ];
  const CAPITALS = { POL: [21.01, 52.23], CZE: [14.42, 50.08], HUN: [19.04, 47.5] };

  /* 권역: 새 폴더/_briefing_tool/build_briefing.ps1의 $regions와 같은 구분·색 */
  const REGIONS = [
    { id: 'v4', label: 'V4 (비셰그라드 4개국)', short: 'Visegrád Group', color: '#1d4ed8', members: ['POL', 'CZE', 'SVK', 'HUN'] },
    { id: 'baltic', label: '발트 3국', short: 'Baltic States', color: '#0f766e', members: ['EST', 'LVA', 'LTU'] },
    { id: 'wbalkan', label: '서발칸', short: 'West Balkans', color: '#b45309', members: ['SVN', 'HRV', 'SRB', 'BIH'] },
    { id: 'sbalkan', label: '남발칸', short: 'South Balkans', color: '#be185d', members: ['MNE', 'KOS', 'ALB', 'MKD', 'BGR'] },
    { id: 'east', label: '동부권', short: 'Eastern Europe', color: '#6d28d9', members: ['UKR', 'BLR', 'MDA', 'ROU'] }
  ];

  /* ---------- 유틸 ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const host = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } };
  const countryUrl = slug => `${ROOT}countries/${slug}/index.html`;
  const bySlug = slug => COUNTRIES.find(c => c.slug === slug);
  const fmtDate = iso => { const [, m, d] = iso.split('-'); return `${+m}월 ${+d}일`; };
  let uidCounter = 0;

  /* 실제 국기를 로컬 SVG로 제공해 문장·문양까지 표시한다. */
  const FLAG_CODES = {"POL":"pl","CZE":"cz","SVK":"sk","HUN":"hu","SVN":"si","HRV":"hr","BIH":"ba","SRB":"rs","KOS":"xk","MNE":"me","MKD":"mk","ALB":"al","BGR":"bg","ROU":"ro","MDA":"md","UKR":"ua","BLR":"by","LTU":"lt","LVA":"lv","EST":"ee"};
  const flagUrl = iso3 => ROOT + 'assets/images/flags/' + FLAG_CODES[iso3] + '.svg';
  function flagIcon(iso3, cls) {
    const e = EAST[iso3];
    if (!e || !FLAG_CODES[iso3]) return '';
    return `<img class="${cls || 'flag'}" src="${flagUrl(iso3)}" alt="${esc(e.ko)} 국기" decoding="async">`;
  }
  /* 국기 색을 CSS 띠로: 카드 상단 장식선에 쓴다 */
  function flagBand(iso3) {
    const f = EAST[iso3].flag, list = f.h || f.v;
    const step = 100 / list.length;
    return `linear-gradient(90deg, ${list.map((c, i) => `${c} ${i * step}%, ${c} ${(i + 1) * step}%`).join(', ')})`;
  }

  /* ---------- 헤더 / 푸터 ---------- */
  function header() {
    const nav = [
      ['home', 'Home', 'index.html'], ['countries', 'Countries', 'countries/index.html'],
      ['news', 'Daily News', 'news/index.html'], ['games', 'Mini Game', 'games/index.html'], ['about', 'About', 'about/index.html']
    ];
    const current = PAGE === 'country' || PAGE === 'section' ? 'countries' : PAGE;
    return `<a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${ROOT}index.html" aria-label="Eastern Europe by KUERA, 고려대학교 동유럽지역 전략학회 아카이브 홈">
      <img class="brand-logo" src="${ROOT}assets/images/kuera/kuera-badge.png" alt="" width="44" height="44" decoding="async">
      <span class="brand-text"><span class="brand-en">Eastern Europe<span class="brand-by">by KUERA</span></span><span class="brand-ko">고려대학교 동유럽지역 전략학회</span></span>
    </a>
    <nav aria-label="주 메뉴"><ul>${nav.map(([id, label, href]) =>
      `<li><a href="${ROOT}${href}"${id === current ? ' aria-current="page"' : ''}>${label}</a></li>`).join('')}</ul></nav>
  </div>
</header>`;
  }
  function footer() {
    return `<footer class="site-footer"><div class="wrap footer-inner">
  <div class="footer-id">
    <img class="footer-logo" src="${ROOT}assets/images/kuera/kuera-badge.png" alt="KUERA 로고" width="56" height="56" loading="lazy" decoding="async">
    <div><p class="footer-brand">Eastern Europe <span class="brand-by">by KUERA</span></p>
    <p class="footer-org">고려대학교 동유럽지역 전략학회<span lang="en"> · Korea University Eastern Europe Research Association</span></p></div>
  </div>
  <p>동유럽 학회원을 위한 국가 정보 아카이브. 국가 정보는 2026년 10월 기준으로 정리했으며, 각 항목 아래 출처를 함께 적었습니다. 운영시간·가격·통계는 바뀔 수 있으니 방문 전 공식 안내를 확인하세요.</p>
  <p>지도 경계: Natural Earth · 국기: <a href="https://flagpedia.net/" target="_blank" rel="noopener">Flagpedia</a> · 사진: <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener">Wikimedia Commons</a>(저작자와 라이선스는 사진마다 표시)</p>
</div></footer>`;
  }

  /* ---------- 지도 ----------
   * mode 'hero'   : 홈 화면. 동유럽 전체를 국기로 채우고 경계에 빛, 서유럽에 도시 불빛
   * mode 'locator': 국가 페이지. focus 나라만 선명하게, 이웃은 흐리게(열린 나라는 링크)
   * mode 'thumb'  : 뉴스 카드 썸네일. 링크·툴팁 없음 */
  function buildMap(container, opts) {
    const mode = opts.mode || 'hero';
    const focus = new Set(opts.focus || []);
    const u = 'm' + (++uidCounter);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', `map-svg map-${mode}`);
    svg.setAttribute('viewBox', opts.viewBox);
    svg.setAttribute('preserveAspectRatio', opts.aspect || 'xMidYMid meet');
    if (mode === 'thumb') svg.setAttribute('aria-hidden', 'true');
    else { svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', opts.label || '동유럽 지도'); }

    let defs = '<defs>';
    Object.keys(EAST).forEach(k => {
      defs += `<pattern id="${u}-${k}" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1" preserveAspectRatio="none"><image href="${flagUrl(k)}" x="0" y="0" width="1" height="1" preserveAspectRatio="none"/></pattern>`;
    });
    if (mode !== 'thumb') {
      defs += `
<filter id="${u}-halo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${mode === 'hero' ? 1.1 : 0.8}"/></filter>
<filter id="${u}-cloth" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="3" seed="4" result="t"/>
  <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 0.52" result="shade"/>
  <feComposite in="shade" in2="SourceGraphic" operator="in" result="s"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="s"/></feMerge>
</filter>
<filter id="${u}-lights" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 0.78  0 0 0 0 0.4  22 0 0 0 -15" result="dots"/>
  <feComposite in="dots" in2="SourceAlpha" operator="in" result="d"/>
  <feGaussianBlur in="d" stdDeviation="0.35" result="dg"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="dg"/><feMergeNode in="d"/></feMerge>
</filter>
<radialGradient id="${u}-city"><stop offset="0" stop-color="#fff6d8"/><stop offset="0.25" stop-color="#ffd27a" stop-opacity="0.85"/><stop offset="1" stop-color="#ff9d2e" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}-cap"><stop offset="0" stop-color="#ffffff"/><stop offset="0.3" stop-color="#9fd0ff" stop-opacity="0.9"/><stop offset="1" stop-color="#4a8dff" stop-opacity="0"/></radialGradient>`;
    }
    defs += '</defs>';

    let base = '', halo = '', east = '', live = '';
    Object.keys(MAP).forEach(code => {
      const d = MAP[code].d;
      if (!d || d.length < 20) return;
      const e = EAST[code];
      if (!e) { base += `<path class="land" d="${d}"/>`; return; }
      const vivid = mode === 'hero' || focus.has(code);
      const slug = SLUG_BY_ISO3[code];
      const fill = `url(#${u}-${code})`;
      if (vivid && mode !== 'thumb') halo += `<path d="${d}"/>`;
      const cls = `country${vivid ? ' is-vivid' : ' is-dim'}${focus.has(code) ? ' is-focus' : ''}`;
      if (slug && mode !== 'thumb' && !(mode === 'locator' && focus.has(code))) {
        live += `<a class="${cls} is-live" href="${countryUrl(slug)}" data-code="${code}" aria-label="${e.ko} 페이지 열기"><path d="${d}" fill="${fill}"/></a>`;
      } else {
        east += `<g class="${cls}" data-code="${code}"><path d="${d}" fill="${fill}"/></g>`;
      }
    });

    let cities = '', marks = '';
    if (mode === 'hero') {
      cities = CITIES.map(([lon, lat, s]) => {
        const [x, y] = project(lon, lat);
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s}" fill="url(#${u}-city)"/>`;
      }).join('');
    }
    if (mode !== 'thumb') {
      Object.keys(CAPITALS).forEach(code => {
        if (mode === 'locator' && !focus.has(code)) return;
        const [x, y] = project(CAPITALS[code][0], CAPITALS[code][1]);
        marks += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${mode === 'hero' ? 4.2 : 3.4}" fill="url(#${u}-cap)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.9" fill="#fff"/>`;
      });
    }

    svg.innerHTML = defs +
      `<g class="layer-base"${mode === 'thumb' ? '' : ` filter="url(#${u}-lights)"`}>${base}</g>` +
      `<g class="layer-cities">${cities}</g>` +
      `<g class="layer-halo" filter="url(#${u}-halo)">${halo}</g>` +
      `<g class="layer-east"${mode === 'thumb' ? '' : ` filter="url(#${u}-cloth)"`}>${east}${live}</g>` +
      `<g class="layer-marks">${marks}</g>`;
    container.appendChild(svg);
    if (opts.tooltip) attachTooltip(container, svg);
    return svg;
  }

  /* 나라 여러 개의 경계 상자를 합쳐 썸네일·위치 지도의 viewBox를 만든다 */
  function fitView(codes, pad, ratio) {
    const boxes = codes.map(c => MAP[c] && MAP[c].bbox).filter(Boolean);
    if (!boxes.length) return '-95 -125 200 210';
    const b = boxes.reduce((a, x) => [Math.min(a[0], x[0]), Math.min(a[1], x[1]), Math.max(a[2], x[2]), Math.max(a[3], x[3])]);
    let w = b[2] - b[0] + pad * 2, h = b[3] - b[1] + pad * 2;
    if (w / h < ratio) w = h * ratio; else h = w / ratio;
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    return `${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  }

  function attachTooltip(container, svg) {
    const tip = document.createElement('div');
    tip.className = 'map-tip';
    tip.setAttribute('aria-hidden', 'true');
    container.appendChild(tip);
    let active = null;

    function show(el, x, y) {
      const code = el.dataset.code;
      const e = EAST[code];
      const isLive = el.classList.contains('is-live');
      tip.innerHTML = `${flagIcon(code, 'flag flag-tip')}<span class="tip-name">${esc(e.ko)}</span><span class="tip-en">${esc(e.en)}</span>` +
        (isLive ? '<span class="tip-go">페이지 열기</span>' : (el.classList.contains('is-focus') && PAGE === 'country' ? '' : '<span class="tip-soon">준비 중</span>'));
      const box = container.getBoundingClientRect();
      tip.style.left = (x - box.left) + 'px';
      tip.style.top = (y - box.top) + 'px';
      tip.classList.add('is-on');
      if (active !== el) {
        if (active) active.classList.remove('is-hover');
        el.classList.add('is-hover');
        el.parentNode.appendChild(el); // 강조된 경계가 이웃 나라에 가려지지 않게 맨 위로
        active = el;
      }
    }
    function hide() {
      tip.classList.remove('is-on');
      if (active) active.classList.remove('is-hover');
      active = null;
    }
    svg.addEventListener('pointermove', ev => {
      if (ev.pointerType === 'touch') return;
      const el = ev.target.closest('.country');
      if (el) show(el, ev.clientX, ev.clientY - 16); else hide();
    });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('focusin', ev => {
      const el = ev.target.closest('.country');
      if (!el) return;
      const r = el.getBoundingClientRect();
      show(el, r.left + r.width / 2, r.top + r.height / 2);
    });
    svg.addEventListener('focusout', hide);
  }

  /* ---------- 뉴스 ---------- */
  function allStories() {
    const out = [];
    NEWS.forEach(day => (day.stories || []).forEach(s => out.push(Object.assign({ date: day.date }, s))));
    return out;
  }
  function storyTags(s) {
    return (s.countries || []).map(name => {
      const slug = SLUG_BY_KO[name];
      return slug ? `<a class="tag is-live" href="${countryUrl(slug)}">${esc(name)}</a>` : `<span class="tag">${esc(name)}</span>`;
    }).join('');
  }
  function storySource(s) {
    const src = (s.sources || [])[0];
    return src ? `<p class="story-src">원문 <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.name)}</a>${s.sources.length > 1 ? ` 외 ${s.sources.length - 1}건` : ''}</p>` : '';
  }
  /* 카드형: 이야기에 나온 나라를 강조한 작은 지도를 사진 대신 쓴다 */
  function storyCard(s, i) {
    return `<li class="story-card">
  <div class="story-thumb" data-thumb="${i}"></div>
  <div class="story-text">
    <div class="story-tags">${storyTags(s)}</div>
    <h3 class="story-title">${esc(s.title)}</h3>
    ${s.points && s.points[0] ? `<p class="story-lead">${esc(s.points[0])}</p>` : ''}
    <div class="story-foot"><time datetime="${esc(s.date)}">${fmtDate(s.date)} 브리핑</time>${storySource(s)}</div>
  </div>
</li>`;
  }
  function mountThumbs(root, stories) {
    root.querySelectorAll('[data-thumb]').forEach(el => {
      const s = stories[+el.dataset.thumb];
      const codes = (s.countries || []).map(n => ISO3_BY_KO[n]).filter(Boolean);
      buildMap(el, { mode: 'thumb', focus: codes, viewBox: fitView(codes.length ? codes : ['POL', 'UKR', 'ROU'], 26, 1), aspect: 'xMidYMid slice' });
    });
  }

  /* ---------- 페이지: 홈 ---------- */

  // Geometry is shared by the land, flag fills, highlights and click targets.
  // No image-derived border tracing or independently positioned country patches.
  function geographicHero(stage, narrow) {
    const svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','map-svg map-art final-image-map');
    svg.setAttribute('viewBox',narrow?'1050 0 720 760':'45 10 1745 780');
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    svg.setAttribute('role','group');
    svg.setAttribute('aria-label','동유럽 야경 지도. 폴란드, 체코, 헝가리, 슬로바키아, 슬로베니아를 비롯한 17개국 페이지로 이동할 수 있습니다.');
    svg.innerHTML='<image href="'+ROOT+'assets/images/hero-clean-flags.png" width="1883" height="835" preserveAspectRatio="none"/>'+
      '<g transform="translate(1370 355) scale(2.65)">'+Object.entries(SLUG_BY_ISO3).map(([code,slug])=>'<a class="country is-live art-area" data-code="'+code+'" href="'+countryUrl(slug)+'" aria-label="'+EAST[code].ko+' 페이지 열기"><path d="'+MAP[code].d+'"/></a>').join('')+'</g>';
    stage.appendChild(svg);attachTooltip(stage,svg);return svg;
  }

  function renderHome(main) {
    const latest = NEWS[0];
    const stories = latest ? (latest.stories || []).slice(0, 3).map(s => Object.assign({ date: latest.date }, s)) : [];
    main.innerHTML = `
<section class="hero-map night" aria-labelledby="hero-title">
  <div class="map-stage" id="home-map"></div>
  <div class="hero-copy wrap">
    <h1 id="hero-title"><span class="h-line">Discover</span><span class="h-line h-glow">Eastern Europe</span></h1>
    <p>지도에서 나라를 선택해 사람과 문화, 언어, 음식, 산업을 살펴보세요.</p>
  </div>

</section>
<section class="home-news wrap" aria-labelledby="news-title">
  <div class="section-head">
    <div><p class="kicker">Latest updates</p><h2 id="news-title">Daily News</h2></div>
    <a class="more" href="${ROOT}news/index.html">브리핑 전체 보기</a>
  </div>
  ${latest ? `<p class="news-overview"><strong>${fmtDate(latest.date)}의 흐름</strong>${esc(latest.overview)}</p>
  <ul class="card-list">${stories.map(storyCard).join('')}</ul>`
    : '<p class="empty">아직 올라온 브리핑이 없습니다.</p>'}
</section>`;
    mountThumbs(main, stories);

    // 홈과 국가 페이지는 동일한 Natural Earth 국경을 사용한다.
    const stage = main.querySelector('#home-map');
    const narrow = window.matchMedia('(max-width: 760px)');
    let svg = null;
    const draw = () => {
      if (svg) svg.remove();
      stage.querySelectorAll('.map-tip').forEach(t => t.remove());
      svg = geographicHero(stage, narrow.matches);
    };
    draw();
    narrow.addEventListener('change', draw);
  }

  /* ---------- 페이지: 국가 목록 ---------- */
  /* 뉴스 브리핑과 같은 5개 권역으로 나누고, 나라마다 가장 최근 브리핑의 동향 한 줄을 붙인다 */
  /* 주차 이름: 월요일 날짜(YYYY-MM-DD)로 "10월 3주차"를 만든다. 그 주 목요일이 속한 달의 몇 번째 주인지로 센다 */
  function weekLabel(mondayIso) {
    const [y, m, d] = mondayIso.split('-').map(Number);
    const thu = new Date(Date.UTC(y, m - 1, d + 3));
    return `${thu.getUTCMonth() + 1}월 ${Math.floor((thu.getUTCDate() - 1) / 7) + 1}주차`;
  }
  /* 나라마다 가장 최근 주차의 대표 뉴스 제목 한 줄(data-weekly.js)을 붙인다 */
  function renderCountries(main) {
    const week = (window.WEEKLY_NEWS || [])[0];
    const picks = (week && week.countries) || {};
    const card = code => {
      const e = EAST[code], slug = SLUG_BY_ISO3[code];
      const pick = picks[e.ko];
      const body = !week || !pick ? ''
        : pick.title ? `${esc(pick.title)}${pick.source ? `<span class="cc-src"> · ${esc(pick.source)}</span>` : ''}`
        : '<span class="cc-none">이번 주 확인된 주요 보도 없음</span>';
      const inner = `<span class="cc-head">${flagIcon(code, 'flag flag-md')}<span class="cc-name">${esc(e.ko)}<span class="cc-en">${esc(e.en)}</span></span>
          <span class="cc-state">${slug ? '상세 보기' : '준비 중'}</span></span>
        ${body ? `<span class="cc-note"><span class="cc-date">${weekLabel(week.week_start)} 뉴스</span>${body}</span>` : ''}`;
      return slug
        ? `<li><a class="cc is-live" href="${countryUrl(slug)}">${inner}</a></li>`
        : `<li><div class="cc is-soon">${inner}</div></li>`;
    };
    main.innerHTML = `
<section class="page-head night">
  <div class="wrap"><p class="kicker">Countries</p><h1>국가</h1>
  <p>동유럽 20개국의 국가 정보와 소식을 권역별로 살펴보세요.</p>
  <nav class="region-jump" aria-label="권역 바로가기"><ul>${REGIONS.map(r =>
    `<li><a href="#r-${r.id}" style="--rc:${r.color}">${esc(r.label)}</a></li>`).join('')}</ul></nav></div>
</section>
<div class="wrap list-wrap">${REGIONS.map(r => `
  <section class="region" id="r-${r.id}" style="--rc:${r.color}" aria-labelledby="rh-${r.id}">
    <div class="region-head"><h2 id="rh-${r.id}">${esc(r.label)}</h2><span class="region-en">${esc(r.short)}</span><span class="region-count">${r.members.length}개국</span></div>
    <ul class="cc-list">${r.members.map(card).join('')}</ul>
  </section>`).join('')}
</div>`;
  }

  /* ---------- 페이지: 국가 상세(허브)와 항목별 하위 페이지 ----------
   * 국가 첫 화면은 항목 카드만 보여 주고, 각 항목은 countries/{slug}/{항목}/ 독립 페이지로 연다.
   * 폴란드처럼 상세 원고(window.COUNTRY_DEEP)가 있으면 그 마크다운·카드 데이터를 쓰고,
   * 없으면 countries.json의 기본 정보로 같은 틀을 채운다. */
  function sourceLink(url) {
    return url ? `<a class="src" href="${esc(url)}" target="_blank" rel="noopener">출처 ${esc(host(url))}</a>` : '';
  }
  function entryList(items) {
    return `<dl class="entries">${items.map(it => `
      <div class="entry"><dt>${esc(it.title)}${it.local ? `<span class="local" lang="und">${esc(it.local)}</span>` : ''}</dt>
      <dd><p>${esc(it.body)}</p>${sourceLink(it.source)}</dd></div>`).join('')}</dl>`;
  }

  /* --- 마크다운 원고 → HTML (원고에 쓰인 문법만 지원: 제목, 문단, 목록, 표, 인용, 굵게/기울임/코드, 링크) --- */
  // 독자용이 아닌 제작 메모 섹션과 문장
  const DEV_SECTION = /개발|인터랙티브 콘텐츠|대시보드|심화 콘텐츠로 추천|데이터 필드|갱신·검수|연결 페이지 추천|첫 화면 소개 카피/;
  const DROP_LINE = /^\*\*(페이지 카드 제안|편집 주의)/;
  const TEXT_FIX = [
    [/\s*\*?\(국경 그림을 만들 때 칼리닌그라드는 러시아의 월경지라는 점을 구별\)\*?/, ' (칼리닌그라드는 러시아의 월경지)'],
    [/웹사이트 해설 포인트/g, '의미']
  ];
  const cleanHeading = t => t.trim()
    .replace(/^\d+\.\s*/, '').replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
    .replace(/자주 묻는 질문\(FAQ\) 문안|FAQ 예시|권장 사용자 질문\(FAQ\)|추천 FAQ/, '자주 묻는 질문')
    .replace('출처·면책 표시 문구', '출처와 면책').replace('뉴스 페이지 역할', '이 페이지에서 다루는 것')
    .replace(/\s*\d+개 (상세 )?카드$/, '').replace(/ 소개 카드 후보$/, '').replace(/^기본 정보 표$/, '기본 정보').replace(/^‘(.*)’$/, '$1');

  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(（])(https?:\/\/[^\s<)]+[^\s<).,])/g, (m, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener">${host(url.replace(/&amp;/g, '&'))}</a>`);
  }

  function mdParse(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const out = { title: '', lead: '', intro: [], sections: [] };
    let cur = null, drop = false;
    for (let i = 0; i < lines.length; i++) {
      let l = lines[i];
      const h = l.match(/^(#{1,3})\s+(.*)$/);
      if (h && h[1] === '#') { out.title = h[2].trim(); continue; }
      // 맨 앞의 제작 메모 인용(URL 제안, 구성 안내)은 버리고 '한 줄 소개'만 리드 문장으로 쓴다
      if (/^>\s*(URL 제안|권장 구성|콘텐츠 구성|구성:|한 줄 소개)/.test(l)) {
        i--;
        while (i + 1 < lines.length && /^>/.test(lines[i + 1])) {
          i++;
          const m = lines[i].match(/한 줄 소개:\s*(.*?)\s*$/);
          if (m) out.lead = m[1];
        }
        continue;
      }
      if (h && h[1] === '##') {
        drop = DEV_SECTION.test(h[2]);
        cur = { title: cleanHeading(h[2]), raw: h[2], lines: [] };
        if (!drop) out.sections.push(cur);
        continue;
      }
      // 출처 목록은 독립 섹션으로 올린다(앞 섹션이 제작 메모라 빠지더라도 출처는 남긴다)
      if (h && h[1] === '###' && /출처/.test(h[2])) {
        drop = false;
        cur = { title: cleanHeading(h[2]), raw: h[2], lines: [] };
        out.sections.push(cur);
        continue;
      }
      if (drop || DROP_LINE.test(l)) continue;
      TEXT_FIX.forEach(([re, to]) => { l = l.replace(re, to); });
      (cur ? cur.lines : out.intro).push(l);
    }
    return out;
  }

  const LIST_RE = /^\s*([-*]|\d+\.)\s+/;
  function mdBlocks(lines) {
    let html = '', i = 0, m;
    const n = lines.length;
    while (i < n) {
      const l = lines[i];
      if (!l.trim() || /^!\[/.test(l)) { i++; continue; }
      if ((m = l.match(/^#{3,4}\s+(.*)$/))) { html += `<h3>${inline(cleanHeading(m[1]))}</h3>`; i++; continue; }
      if (/^\|/.test(l)) {
        const rows = [];
        while (i < n && /^\|/.test(lines[i])) rows.push(lines[i++]);
        const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const head = cells(rows[0]);
        html += `<div class="md-table"><table><thead><tr>${head.map(c => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${
          rows.slice(2).map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        continue;
      }
      if (/^>/.test(l)) {
        const q = [];
        while (i < n && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, '').trim());
        html += `<blockquote>${q.map(inline).join('<br>')}</blockquote>`;
        continue;
      }
      if ((m = l.match(LIST_RE))) {
        const tag = /\d/.test(m[1]) ? 'ol' : 'ul', items = [];
        while (i < n && LIST_RE.test(lines[i])) items.push(lines[i++].replace(LIST_RE, ''));
        html += `<${tag}>${items.map(x => `<li>${inline(x.trim())}</li>`).join('')}</${tag}>`;
        continue;
      }
      const para = [];
      while (i < n && lines[i].trim() && !/^(\||>|#{1,4}\s|!\[)/.test(lines[i]) && !LIST_RE.test(lines[i])) para.push(lines[i++]);
      html += `<p>${para.map((x, k) => inline(x.trim()) + (k < para.length - 1 ? (/\s{2,}$/.test(x) ? '<br>' : ' ') : '')).join('')}</p>`;
    }
    return html;
  }

  /* ### 소제목으로 나뉜 섹션을 쪼갠다: [{ title, lines }] (첫 소제목 앞 내용은 title 없음) */
  function splitH3(lines) {
    const parts = [{ title: '', lines: [] }];
    lines.forEach(l => {
      const m = l.match(/^###\s+(.*)$/);
      if (m) parts.push({ title: cleanHeading(m[1]), lines: [] }); else parts[parts.length - 1].lines.push(l);
    });
    return parts;
  }
  /* "한국어 — 원어" 또는 "한국어 | English" 제목을 두 줄로 */
  function splitTitle(t) {
    const m = t.split(/\s+[—|]\s+/);
    return m.length > 1 ? `${inline(m[0])}<span class="local" lang="und">${inline(m.slice(1).join(' '))}</span>` : inline(t);
  }
  function topicCards(lines) {
    const [head, ...parts] = splitH3(lines);
    return mdBlocks(head.lines) + `<div class="topic-grid">${parts.map(p =>
      `<article class="topic"><h3>${splitTitle(p.title)}</h3>${mdBlocks(p.lines)}</article>`).join('')}</div>`;
  }
  function accordion(lines) {
    const [head, ...parts] = splitH3(lines);
    return mdBlocks(head.lines) + `<div class="acc-list">${parts.map((p, i) =>
      `<details class="acc"${i === 0 ? ' open' : ''}><summary>${splitTitle(p.title)}</summary><div class="acc-body">${mdBlocks(p.lines)}</div></details>`).join('')}</div>`;
  }
  /* 원고의 "문제 6개" 목록과 정답 줄을 펼쳐 보는 퀴즈로 */
  function quiz(lines) {
    const qs = lines.filter(l => /^\d+\.\s+/.test(l)).map(l => l.replace(/^\d+\.\s+/, ''));
    let ans;
    // "질문 → 답" 형식(체코·헝가리 원고)이면 한 줄에서 질문과 정답을 나눈다
    if (qs.length && qs.every(q => q.includes(' → '))) {
      ans = qs.map(q => q.split(' → ').slice(1).join(' → '));
      qs.forEach((q, i) => { qs[i] = q.split(' → ')[0]; });
    } else {
      const line = (lines.find(l => /정답/.test(l)) || '').replace(/^\*\*정답:\*\*\s*/, '').replace(/\.\s*$/, '');
      ans = line.split(/,\s*(?=\d+\s)/).map(a => a.replace(/^\d+\s+/, ''));
    }
    return `<p>질문을 누르면 정답이 보입니다.</p><ol class="quiz">${qs.map((q, i) =>
      `<li><details><summary>${inline(q)}</summary><p class="quiz-a">정답: ${inline(ans[i] || '')}</p></details></li>`).join('')}</ol>`;
  }

  /* 실제 사진(Wikimedia Commons). 서버에 저장한 파일(image_local, image_downloaded)이 있으면 그것을 먼저 쓰고,
   * 없거나 열리지 않으면 원격 링크(image_remote)로 대신한다. 사진 아래에 저작자·라이선스·원본 링크를 표시한다. */
  function photoUrls(p, slug) {
    const local = p.image_local ? ROOT + p.image_local.replace(/^assets\//, `assets/images/${slug}/`) : '';
    const remote = p.image_remote || '';
    return p.image_downloaded && local ? [local, remote] : [remote, ''];
  }
  function photoCredit(p) {
    if (!p.image_author) return '';
    const link = (u, t) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t);
    return `사진: ${link(p.image_source, p.image_author)} · ${link(p.image_license_url, p.image_license)} · Wikimedia Commons`;
  }
  function placePhoto(p, slug) {
    const [src, alt] = photoUrls(p, slug);
    // 라이선스를 확인한 실제 사진이 아직 없는 항목은 다른 사진으로 대신하지 않고 빈 상태로 둔다
    if (!src) return `<figure class="place-img is-empty"><div class="place-photo"><span>사진 준비 중</span></div>
    <figcaption>맞는 사진을 구하는 대로 채웁니다. 다른 사진으로 대신하지 않습니다.</figcaption></figure>`;
    return `<figure class="place-img"><div class="place-photo"><img src="${esc(src)}" alt="${esc(p.image_subject || p.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"${alt ? ` data-alt="${esc(alt)}" onerror="this.onerror=null;this.src=this.dataset.alt"` : ''}></div>
    <figcaption>${photoCredit(p)}</figcaption></figure>`;
  }

  /* 관광지·음식 카드 (상세 원고 JSON의 places / foods) */
  function placeCards(items, kind, slug, sources) {
    const fields = kind === 'travel'
      ? [['추천 체험', 'experience'], ['시기', 'season'], ['방문 유의사항', 'caution']]
      : [['주재료', 'ingredients'], ['맛과 식감', 'taste'], ['현지 식문화', 'context'], ['어디서 먹나', 'where'], ['알레르기 정보', 'allergens'], ['참고', 'notes']];
    const lang = { czechia: 'cs', hungary: 'hu', slovakia: 'sk', slovenia: 'sl', croatia: 'hr', serbia: 'sr', estonia: 'et', moldova: 'ro', bulgaria: 'bg',
      romania: 'ro', latvia: 'lv', lithuania: 'lt', ukraine: 'uk', belarus: 'be', 'north-macedonia': 'mk', albania: 'sq' }[slug] || 'pl';
    const noPhoto = items.filter(p => !photoUrls(p, slug)[0]).length;
    return `<p class="img-note">사진은 Wikimedia Commons에 공개된 실제 촬영본이며, 저작자와 라이선스를 각 사진 아래에 적었습니다. 촬영한 ${kind === 'travel' ? '날씨·시기·구도' : '식당·지역·조리법'}에 따라 실제 모습은 다를 수 있습니다.${noPhoto ? ` 맞는 사진을 아직 찾지 못한 ${noPhoto}곳은 비워 두었습니다.` : ''}</p>
<ul class="place-grid">${items.map(p => {
      const tags = kind === 'travel' ? [p.type, p.region] : [p.category];
      const src = (p.sources || []).map(k => sources[k]).filter(Boolean);
      if (p.source_url) src.push({ url: p.source_url, title: host(p.source_url) });
      return `<li class="place" id="${esc(p.slug)}">
  ${placePhoto(p, slug)}
  <div class="place-text">
    <div class="place-tags">${tags.filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <h3>${esc(p.title)}<span class="local" lang="${lang}">${esc(p.pl)}</span></h3>
    <p class="place-sum">${esc(p.summary)}</p>
    <details class="place-more"><summary>자세히 보기</summary>
      ${p.body ? `<p>${esc(p.body)}</p>` : ''}
      <dl>${fields.filter(([, k]) => p[k]).map(([label, k]) => `<div><dt>${k === 'experience' && p.experience_label ? p.experience_label : label}</dt><dd>${esc(p[k])}</dd></div>`).join('')}</dl>
      ${src.length ? `<p class="place-src">출처: ${src.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(', ')}</p>` : ''}
    </details>
  </div>
</li>`;
    }).join('')}</ul>`;
  }

  /* 한 나라의 하위 페이지 목록. 관광은 상세 원고가 있는 나라만 */
  const DEEP = window.COUNTRY_DEEP || {};
  const SECTION_DEFS = [
    { id: 'overview', ko: '개요', en: 'Overview' }, { id: 'travel', ko: '관광', en: 'Travel' },
    { id: 'food', ko: '음식', en: 'Food' }, { id: 'language', ko: '언어', en: 'Language' },
    { id: 'culture', ko: '문화', en: 'Culture' }, { id: 'industry', ko: '산업', en: 'Industry' },
    { id: 'news', ko: '뉴스', en: 'News' }
  ];
  const sectionsFor = slug => SECTION_DEFS.filter(s => s.id !== 'travel' || (DEEP[slug] && DEEP[slug].places));
  const sectionUrl = (slug, id) => `${ROOT}countries/${slug}/${id}/index.html`;

  /* 하위 페이지 본문: [{ id, title, html, tab }] */
  function deepSections(slug, id) {
    const deep = DEEP[slug];
    const doc = mdParse(deep.md[id]);
    const secs = doc.sections.map((s, i) => {
      const hasH3 = s.lines.filter(l => /^###\s/.test(l)).length;
      let html;
      if (id === 'travel' && /관광 명소/.test(s.raw)) html = placeCards(deep.places, 'travel', slug, deep.sources);
      else if (id === 'food' && /대표 음식/.test(s.raw)) html = placeCards(deep.foods, 'food', slug, deep.sources);
      else if (id === 'language' && /문제/.test(s.raw)) html = quiz(s.lines);
      else if (id === 'industry' && hasH3 >= 3) html = accordion(s.lines);
      else if (hasH3 >= 3) html = topicCards(s.lines);
      else html = mdBlocks(s.lines);
      return { id: `s${i + 1}`, title: s.title, html, tab: id === 'language' && /인사말|여행 회화|^(인사·기본|자기소개|식당·쇼핑|교통·긴급|인사·예절|소개·기초|길·교통·숙소)$/.test(s.raw) };
    });
    return { title: doc.title, lead: doc.lead, intro: mdBlocks(doc.intro), secs };
  }
  function basicSections(c, id) {
    const f = c.fact;
    const S = (title, html) => ({ id: 'b-' + title, title, html });
    switch (id) {
      case 'overview': return [
        S('처음 보는 ' + c.name_ko, `<p class="intro">${esc(c.intro)}</p><ul class="highlights">${c.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>`),
        S('기본 정보', `<div class="md-table"><table><tbody>${[
          ['수도', f.capital], ['공식 언어', f.official_language], ['통화', f.currency],
          ['인구', `${f.population} (${f.population_year}년 기준)`], ['면적', f.area], ['EU 가입', f.eu], ['솅겐 참여', f.schengen]
        ].map(([k, v]) => `<tr><th scope="row">${k}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>`),
        S('출처', `<ul>${c.official_sources.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a></li>`).join('')}</ul>`)];
      case 'culture': return [S('주요 문화 주제', entryList(c.culture))];
      case 'food': return [S('대표 음식', entryList(c.food))];
      case 'language': return [
        S('언어의 특징', `<p>${esc(c.language_note)}</p>`),
        S('기본 표현', `<table class="phrases"><thead><tr><th scope="col">${esc(f.official_language)}</th><th scope="col">뜻</th></tr></thead>
          <tbody>${c.language.map(p => `<tr><td lang="und">${esc(p.local)}</td><td>${esc(p.ko)}</td></tr>`).join('')}</tbody></table>${sourceLink(c.language_source)}`)];
      case 'industry': return [
        S('산업 개요', `<p>${esc(c.industry_intro)}</p>`),
        S('주요 산업', `<ul class="industry">${c.industry.map(it => `<li><h3>${esc(it.title)}</h3><p>${esc(it.body)}</p>${sourceLink(it.source)}</li>`).join('')}</ul>`)];
      default: return [];
    }
  }
  function newsSections(c) {
    const stories = allStories().filter(s => (s.countries || []).includes(c.name_ko));
    return [
      { id: 'n-brief', title: '학회 브리핑', html: stories.length
        ? `<ul class="card-list is-stack">${stories.map(storyCard).join('')}</ul>`
        : `<p class="empty">최근 학회 브리핑에 ${esc(c.name_ko)} 관련 기사가 없습니다. 아래 매체에서 최신 소식을 확인할 수 있습니다.</p>`, stories },
      { id: 'n-outlets', title: '참고 매체', html: `<ul class="outlets">${c.news.map(n => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.name)}</a><span>${esc(n.description)}</span></li>`).join('')}</ul>` }
    ];
  }

  /* 국가 첫 화면의 명소 영상(사진 3장을 천천히 확대하며 교차 전환하는 5초 남짓의 반복 클립).
   * 사진: Wikimedia Commons, 2026-10-18 내려받아 960px로 줄임. CC 라이선스 조건에 따라 작가·라이선스를 클립 아래에 표시한다. */
  const REEL = {
    // pos: 4:3 칸에 잘려 들어갈 때 사진의 어느 부분을 중심에 둘지(object-position)
    poland: { title: 'Poland', shots: [
      { src: 'warsaw-castle-square.jpg', ko: '바르샤바 왕궁광장', en: 'Castle Square, Warsaw', author: 'Rhododendrites', license: 'CC BY-SA 4.0', file: 'Castle_Square_(22346p).jpg' },
      { src: 'malbork.jpg', ko: '말보르크 성', en: 'Malbork Castle', author: 'DerHexer; derivative: Carschten', license: 'CC BY-SA 3.0', file: 'Panorama_of_Malbork_Castle,_part_4.jpg' },
      { src: 'morskie-oko.jpg', ko: '타트라산맥 모르스키에 오코', en: 'Morskie Oko, Tatra Mountains', author: 'Aneta Pawska', license: 'CC BY 3.0', file: 'Morskie_Oko_o_poranku.jpg' }] },
    czechia: { title: 'Czech Republic', shots: [
      { src: 'prague-castle-night.jpg', ko: '프라하성과 카를교', en: 'Prague Castle & Charles Bridge', author: 'Diego Delso', license: 'CC BY-SA 4.0', file: 'Castillo_de_Praga_y_puente_Carlos,_Praga,_República_Checa,_2022-07-01,_DD_14-16_HDR.jpg', pos: '30% 60%' },
      { src: 'old-town.jpg', ko: '프라하 구시가지', en: 'Old Town, Prague', author: 'A.Savin', license: 'FAL', file: 'Prague_07-2016_View_from_Old_Town_Hall_Tower_img3.jpg' },
      { src: 'cesky-krumlov-castle.jpg', ko: '체스키크룸로프', en: 'Český Krumlov', author: 'Scotch Mist', license: 'CC BY-SA 4.0', file: 'Cesky_Krumlov_25.JPG' }] },
    hungary: { title: 'Hungary', shots: [
      { src: 'parliament.jpg', ko: '도나우강과 국회의사당', en: 'Parliament on the Danube', author: 'Florian Fèvre', license: 'CC BY-SA 4.0', file: 'Danube_and_Hungarian_Parliament_Building_by_night.jpg' },
      { src: 'chain-bridge.jpg', ko: '세체니 다리', en: 'Széchenyi Chain Bridge', author: 'Wilfredor', license: 'CC0', file: 'Széchenyi_Chain_Bridge_in_Budapest_at_night.jpg' },
      { src: 'szechenyi-baths.jpg', ko: '세체니 온천', en: 'Széchenyi Baths', author: 'Marc Ryckaert (MJJR)', license: 'CC BY 3.0', file: 'Budapest_Széchenyi_Baths_R01.jpg' }] },
    // 슬로바키아·슬로베니아는 관광 카드와 같은 사진(2026-10-19 사용자 승인 후 다운로드)을 960px로 줄여 쓴다
    slovakia: { title: 'Slovakia', shots: [
      { src: 'strbske-pleso.jpg', ko: '하이 타트라 슈트르브스케 플레소', en: 'Štrbské pleso, High Tatras', author: 'Adrian Tync', license: 'CC BY-SA 4.0', file: 'Štrbské_pleso_&_Hotel_Patria_2022.jpg' },
      { src: 'spis-castle.jpg', ko: '스피시 성', en: 'Spiš Castle', author: 'Govisity / Tip na Trip / kosice.guide', license: 'CC BY 2.0', file: 'Spis_Castle.jpg' },
      { src: 'orava-castle.jpg', ko: '오라바 성', en: 'Orava Castle', author: 'Lynx1211', license: 'CC BY-SA 4.0', file: 'Oravský_hrad_(celkový_pohled).jpg' }] },
    slovenia: { title: 'Slovenia', shots: [
      { src: 'bled.jpg', ko: '블레드 호수', en: 'Lake Bled', author: 'Martin McBrien', license: 'CC BY-SA 3.0', file: 'Lake_Bled_view.jpg' },
      { src: 'piran.jpg', ko: '피란 구시가지', en: 'Piran Old Town', author: 'Isiwal', license: 'CC BY-SA 4.0', file: 'Piran_old_town.jpg' },
      { src: 'predjama.jpg', ko: '프레드야마 성', en: 'Predjama Castle', author: 'Dickelbers', license: 'CC BY-SA 3.0', file: 'Predjama_castle.jpg' }] }
  };
  const LICENSE_URL = { 'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/', 'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/', 'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
    'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/', 'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'FAL': 'https://artlibre.org/licence/lal/en/' };
  function reelHtml(c) {
    const r = REEL[c.slug];
    if (!r) return '';
    return `<figure class="reel" style="--shots:${r.shots.length}">
  <div class="reel-stage">
    ${r.shots.map((s, i) => `<div class="reel-shot" style="--i:${i}">
      <img src="${ROOT}assets/images/landmarks/${c.slug}/${s.src}" alt="${esc(s.ko)}" decoding="async"${s.pos ? ` style="object-position:${s.pos};transform-origin:${s.pos}"` : ''}>
      <span class="reel-cap">${esc(s.ko)}<span lang="und">${esc(s.en)}</span></span>
    </div>`).join('')}
    <p class="reel-title" aria-hidden="true">${esc(r.title)}</p>
    <button class="reel-toggle" type="button" aria-pressed="false" aria-label="영상 일시정지"><span aria-hidden="true"></span></button>
  </div>
  <figcaption class="reel-credit">사진: ${r.shots.map(s => `<a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(s.file.replace(/ /g, '_'))}" target="_blank" rel="noopener">${esc(s.author)}</a> (<a href="${LICENSE_URL[s.license]}" target="_blank" rel="noopener">${esc(s.license)}</a>)`).join(', ')} / Wikimedia Commons, 크기 조정</figcaption>
</figure>`;
  }

  function countryHero(c, iso3, inner) {
    return `<section class="country-hero night" style="--band:${flagBand(iso3)}">
  <div class="globe" aria-hidden="true"></div>
  <div class="wrap country-hero-inner">${inner}</div>
</section>`;
  }
  function crumbs(items) {
    return `<nav class="crumbs" aria-label="현재 위치">${items.map(([label, href], i) => (i ? '<span aria-hidden="true">/</span>' : '') +
      (href ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`)).join('')}</nav>`;
  }
  function countryTabs(c, current) {
    return `<nav class="section-nav" aria-label="${esc(c.name_ko)} 페이지"><div class="wrap"><ul>
  <li><a href="${countryUrl(c.slug)}"${current ? '' : ' aria-current="page"'}>${esc(c.name_ko)} 홈</a></li>
  ${sectionsFor(c.slug).map(s => `<li><a href="${sectionUrl(c.slug, s.id)}"${s.id === current ? ' aria-current="page"' : ''}>${s.ko}</a></li>`).join('')}
</ul></div></nav>`;
  }

  function renderCountry(main, slug) {
    const c = bySlug(slug);
    const iso3 = ISO3_BY_SLUG[slug];
    if (!c) { main.innerHTML = '<section class="page-head wrap"><h1>페이지를 찾을 수 없습니다</h1><p><a href="../index.html">국가 목록으로 돌아가기</a></p></section>'; return; }
    document.title = `${c.name_ko} | Eastern Europe`;
    const f = c.fact, deep = DEEP[slug];
    const band = flagBand(iso3);
    const stories = allStories().filter(s => (s.countries || []).includes(c.name_ko));

    // 항목 카드 설명: 상세 원고가 있으면 그 페이지의 섹션 제목을, 없으면 기본 정보를 요약한다
    const desc = id => {
      if (deep && deep.md[id]) {
        if (id === 'travel') return deep.places.map(p => p.title).slice(0, 5).join(', ') + ` 등 ${deep.places.length}곳`;
        if (id === 'food') return deep.foods.map(p => p.title).slice(0, 5).join(', ') + ` 등 ${deep.foods.length}가지`;
        return mdParse(deep.md[id]).sections.filter(s => !/출처/.test(s.title)).slice(0, 4).map(s => s.title).join(', ');
      }
      return { overview: '기본 정보와 소개', culture: c.culture.map(x => x.title).join(', '), food: c.food.map(x => x.title).join(', '),
        language: `기본 표현 ${c.language.length}가지와 언어의 특징`, industry: c.industry.map(x => x.title).join(', '),
        news: stories.length ? `학회 브리핑 ${stories.length}건과 참고 매체` : '참고 매체 모음' }[id];
    };
    const art = id => {
      const pick = deep && { travel: deep.places && deep.places[0], food: deep.foods && deep.foods[0] }[id];
      if (pick && photoUrls(pick, slug)[0]) {
        const [src, alt] = photoUrls(pick, slug);
        return `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"${alt ? ` data-alt="${esc(alt)}" onerror="this.onerror=null;this.src=this.dataset.alt"` : ''}>` +
          (pick.image_author ? `<span class="ai-badge">사진 ${esc(pick.image_author)} · ${esc(pick.image_license)}</span>` : '');
      }
      const word = { overview: c.name_local, culture: c.culture[0].local, food: c.food[0].local, language: c.language[0].local,
        industry: c.industry[0].title, news: c.name_local }[id] || c.name_local;
      return `<span class="disc-word" lang="und">${esc(word)}</span>`;
    };

    main.innerHTML = countryHero(c, iso3, `
    <div class="country-id">
      ${crumbs([['Home', ROOT + 'index.html'], ['Countries', ROOT + 'countries/index.html'], [c.name_en]])}
      <div class="country-title">${flagIcon(iso3, 'flag flag-lg')}
        <h1><span class="t-en">${esc(c.name_en)}</span><span class="t-ko">${esc(c.name_ko)} <span lang="und">${esc(c.name_local)}</span></span></h1></div>
      <p class="country-sub">${esc(c.subtitle)}</p>
      <dl class="facts">
        <div><dt>Capital</dt><dd>${esc(f.capital)}</dd></div>
        <div><dt>Language</dt><dd>${esc(f.official_language)}</dd></div>
        <div><dt>Currency</dt><dd>${esc(f.currency)}</dd></div>
      </dl>
    </div>
    ${reelHtml(c) || '<div class="locator" id="locator"></div>'}`) + `
${countryTabs(c, '')}
<section class="discover wrap" aria-labelledby="disc-title">
  <p class="kicker">Explore ${esc(c.name_en)}</p>
  <h2 id="disc-title">${esc(c.name_ko)} 더 알아보기</h2>
  <p class="hub-intro">${esc(c.intro)}</p>
  <ul class="disc-list">${sectionsFor(slug).map(s => `
    <li><a href="${sectionUrl(slug, s.id)}" style="--band:${band}">
      <span class="disc-art" aria-hidden="true">${art(s.id)}</span>
      <span class="disc-text"><span class="disc-label">${s.ko}<span class="disc-en">${s.en}</span></span><span class="disc-desc">${esc(desc(s.id))}</span></span>
    </a></li>`).join('')}
  </ul>
  ${deep ? '' : `<p class="hub-note">${esc(c.name_ko)}는 기본 정보만 정리되어 있습니다. 상세 원고가 준비되면 각 항목 페이지가 더 풍부해집니다.</p>`}
</section>
${stories.length ? `<section class="hub-news wrap" aria-labelledby="hub-news-title">
  <div class="section-head"><div><p class="kicker">Latest updates</p><h2 id="hub-news-title">${esc(c.name_ko)} 관련 브리핑</h2></div>
  <a class="more" href="${sectionUrl(slug, 'news')}">뉴스 페이지에서 모두 보기</a></div>
  <ul class="card-list">${stories.slice(0, 3).map(storyCard).join('')}</ul>
</section>` : ''}`;
    if (stories.length) mountThumbs(main.querySelector('.hub-news'), stories);

    // 명소 영상: 일시정지/재생 버튼. 명소 사진이 없는 나라는 예전처럼 위치 지도를 그린다
    const reel = main.querySelector('.reel');
    if (reel) {
      const btn = reel.querySelector('.reel-toggle');
      btn.addEventListener('click', () => {
        const paused = reel.classList.toggle('is-paused');
        btn.setAttribute('aria-pressed', paused);
        btn.setAttribute('aria-label', paused ? '영상 재생' : '영상 일시정지');
      });
    } else {
      buildMap(main.querySelector('#locator'), {
        mode: 'locator', focus: [iso3],
        viewBox: fitView([iso3], 35, 1.15), tooltip: true,
        label: `${c.name_ko} 위치 지도. 주변의 다른 국가 페이지로 이동할 수 있습니다.`
      });
    }
  }

  function renderSection(main, slug, id) {
    const c = bySlug(slug);
    const iso3 = ISO3_BY_SLUG[slug];
    const list = c ? sectionsFor(slug) : [];
    const def = list.find(s => s.id === id);
    if (!c || !def) { main.innerHTML = '<section class="page-head wrap"><h1>페이지를 찾을 수 없습니다</h1><p><a href="../../index.html">국가 목록으로 돌아가기</a></p></section>'; return; }
    const deep = DEEP[slug] && DEEP[slug].md && DEEP[slug].md[id];
    let title = `${c.name_ko} ${def.ko}`, local = def.en, lead = '', intro = '', secs;
    if (deep) {
      const d = deepSections(slug, id);
      const parts = d.title.split(/\s*\|\s*/);
      if (parts[0]) title = parts[0];
      if (parts[1]) local = parts[1];
      lead = d.lead; intro = d.intro; secs = d.secs;
    } else {
      secs = basicSections(c, id);
    }
    let newsStories = [];
    if (id === 'news') {
      const ns = newsSections(c);
      newsStories = ns[0].stories;
      secs = deep ? [ns[0], ...secs] : ns;
    }
    document.title = `${title} | ${c.name_ko} | Eastern Europe`;

    // 연달아 오는 탭 섹션(폴란드어의 인사말·여행 회화)은 한 섹션 안의 탭으로 묶는다
    const blocks = [];
    secs.forEach(s => {
      const last = blocks[blocks.length - 1];
      if (s.tab && last && last.tabs) last.tabs.push(s);
      else if (s.tab) blocks.push({ id: s.id, title: '기본 회화', tabs: [s] });
      else blocks.push(s);
    });
    const blockHtml = b => b.tabs
      ? `<div class="tabs" data-tabs><div class="tab-bar" role="tablist" aria-label="${esc(b.title)}">${b.tabs.map((t, i) =>
          `<button type="button" role="tab" id="tab-${t.id}" aria-controls="panel-${t.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(t.title.replace(/\s*\(.*\)$/, ''))}</button>`).join('')}</div>${
          b.tabs.map((t, i) => `<div class="tab-panel" role="tabpanel" id="panel-${t.id}" aria-labelledby="tab-${t.id}"${i ? ' hidden' : ''}>${t.html}</div>`).join('')}</div>`
      : b.html;

    const idx = list.indexOf(def), prev = list[idx - 1], next = list[idx + 1];
    main.innerHTML = `
<section class="sub-hero night" style="--band:${flagBand(iso3)}">
  <div class="wrap">
    ${crumbs([['Home', ROOT + 'index.html'], ['Countries', ROOT + 'countries/index.html'], [c.name_en, countryUrl(slug)], [def.ko]])}
    <p class="sub-country">${flagIcon(iso3, 'flag flag-sm')}<span>${esc(c.name_ko)}</span><span class="sub-cat">${def.en}</span></p>
    <h1>${esc(title)}<span class="sub-local" lang="und">${esc(local)}</span></h1>
    ${lead ? `<p class="sub-lead">${esc(lead)}</p>` : ''}
  </div>
</section>
${countryTabs(c, id)}
<div class="wrap sub-body">
  <aside class="toc" aria-label="이 페이지의 목차"><p class="toc-title">이 페이지</p>
    <ol>${blocks.map(b => `<li><a href="#${b.id}">${esc(b.title)}</a></li>`).join('')}</ol></aside>
  <article class="sub-article">
    ${intro}
    ${blocks.map(b => `<section class="md-sec" id="${b.id}"><h2>${esc(b.title)}</h2>${blockHtml(b)}</section>`).join('')}
    ${deep ? '' : `<p class="hub-note">${esc(c.name_ko)}는 기본 정보만 정리되어 있습니다. 상세 원고가 준비되면 이 페이지를 확장합니다.</p>`}
  </article>
</div>
<nav class="sub-pager wrap" aria-label="이전·다음 항목">
  ${prev ? `<a class="pg-prev" href="${sectionUrl(slug, prev.id)}"><span>이전</span>${prev.ko}</a>` : `<a class="pg-prev" href="${countryUrl(slug)}"><span>이전</span>${esc(c.name_ko)} 홈</a>`}
  ${next ? `<a class="pg-next" href="${sectionUrl(slug, next.id)}"><span>다음</span>${next.ko}</a>` : ''}
</nav>`;
    if (newsStories.length) mountThumbs(main.querySelector('#n-brief'), newsStories);

    // 탭: 클릭과 좌우 화살표로 전환
    main.querySelectorAll('[data-tabs]').forEach(box => {
      const tabs = [...box.querySelectorAll('[role="tab"]')];
      const select = t => tabs.forEach(x => {
        const on = x === t;
        x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
        box.querySelector('#' + x.getAttribute('aria-controls')).hidden = !on;
      });
      tabs.forEach((t, i) => {
        t.addEventListener('click', () => select(t));
        t.addEventListener('keydown', e => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          select(n); n.focus();
        });
      });
    });

    // 목차에 현재 읽는 섹션 표시
    const links = main.querySelectorAll('.toc a');
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) links.forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + en.target.id));
    }), { rootMargin: '-25% 0px -65% 0px' });
    main.querySelectorAll('.md-sec').forEach(s => io.observe(s));
  }

  /* ---------- 페이지: 뉴스 ---------- */
  function renderNews(main) {
    let all = [];
    main.innerHTML = `
<section class="page-head night">
  <div class="wrap"><p class="kicker">Daily News</p><h1>데일리 뉴스</h1>
  <p>학회 데일리 브리핑을 날짜별로 모았습니다. 기사 본문은 옮기지 않고 요약과 원문 링크만 싣습니다.</p></div>
</section>
<div class="wrap news-wrap">${NEWS.length ? NEWS.map(day => {
      const list = (day.stories || []).map(s => Object.assign({ date: day.date }, s));
      const start = all.length; all = all.concat(list);
      return `
  <section class="news-day" aria-labelledby="d-${day.date}">
    <h2 id="d-${day.date}">${fmtDate(day.date)}</h2>
    <p class="news-overview">${esc(day.overview)}</p>
    <ul class="card-list">${list.map((s, i) => storyCard(s, start + i)).join('')}</ul>
  </section>`;
    }).join('') : '<p class="empty">아직 올라온 브리핑이 없습니다.</p>'}
</div>`;
    mountThumbs(main, all);
  }

  /* ---------- 페이지: 미니 게임 (games/* 의 게임을 iframe으로) ---------- */
  const GAMES = [
    { id: 'flag-battle', title: 'Flag Battle Royale', ko: '국기 서바이벌',
      lead: '동유럽 20개국의 국기가 원 안에서 튕기다가, 돌아가는 틈으로 빠져나가면 탈락합니다. 마지막까지 남는 한 나라가 우승입니다.',
      rules: [['랜덤 이벤트', '틈이 두 개로 늘거나, 중력이 뒤집히거나, 한 나라가 거대해지는 변수가 수시로 일어납니다.'],
              ['총격전', '약 15초마다 무작위 나라가 총을 들고 다른 나라를 쏩니다. 방패가 있으면 막아냅니다.'],
              ['조작', '화면을 누르면 시작합니다. 아래 버튼으로 다시 시작, 일시정지, 소리, 배속을 바꿀 수 있습니다.']] },
    { id: 'clockwork-drop', title: 'Clockwork Drop', ko: '톱니바퀴 낙하',
      lead: '20개국의 국기가 한꺼번에 떨어져 빛나는 톱니바퀴 사이를 지나갑니다. 맨 아래 시간의 틈에 닿으면 탈락하고, 마지막까지 버틴 나라가 우승입니다.',
      rules: [['매번 다른 배치', '톱니바퀴의 크기·개수·맞물림이 판마다 새로 정해집니다. 톱니 사이 골이 맞을 때만 빠져나갈 수 있습니다.'],
              ['시간의 비틀림', '10여 초마다 모든 톱니가 방향을 바꾸고, 한동안 아무도 떨어지지 않으면 톱니가 점점 빨라집니다.'],
              ['조작', '화면을 누르면 시작합니다. 아래 버튼으로 다시 시작, 일시정지, 소리, 째깍 소리, 배속을 바꿀 수 있습니다.']] },
  ];
  function renderGames(main) {
    main.innerHTML = `
<section class="page-head night">
  <div class="wrap"><p class="kicker">Mini Game</p><h1>미니 게임</h1>
  <p>동유럽 20개국 국기로 즐기는 짧은 서바이벌 게임입니다. 한 판에 1~2분 정도 걸리고, 우승국은 매번 달라집니다.</p></div>
</section>
<div class="games-wrap">${GAMES.map((g, i) => `
<section class="game-item wrap${i % 2 ? ' is-flip' : ''}" id="${g.id}" aria-labelledby="g-${g.id}">
  <div class="game-copy">
    <p class="kicker">Game ${i + 1} · ${g.ko}</p>
    <h2 id="g-${g.id}">${g.title}</h2>
    <p>${g.lead}</p>
    <ul class="game-rules">${g.rules.map(([t, d]) => `<li><strong>${t}</strong> ${d}</li>`).join('')}</ul>
    <a class="more" href="${ROOT}games/${g.id}/index.html" target="_blank" rel="noopener">새 창에서 크게 보기</a>
  </div>
  <div class="game-frame">
    <iframe src="${ROOT}games/${g.id}/index.html?embed" title="${g.title} ${g.ko} 게임" loading="lazy"></iframe>
  </div>
</section>`).join('')}
</div>`;
  }

  /* ---------- 페이지: 소개 ---------- */
  function renderAbout(main) {
    main.innerHTML = `
<section class="page-head night">
  <div class="wrap"><p class="kicker">About</p><h1>소개</h1>
  <p>동유럽 학회원이 수업과 연구, 답사 준비에 참고할 수 있도록 국가별 기초 정보와 최신 브리핑을 한곳에 정리하는 사이트입니다.</p></div>
</section>
<section class="wrap prose">
  <div class="about-org">
    <img src="${ROOT}assets/images/kuera/kuera-badge.png" alt="KUERA 로고" width="96" height="96" decoding="async">
    <div><p class="about-org-ko">고려대학교 동유럽지역 전략학회</p>
    <p class="about-org-en" lang="en">Korea University Eastern Europe Research Association (KUERA)</p></div>
  </div>
  <h2>자료 원칙</h2>
  <ul>
    <li>국가 정보는 EU, 각국 관광청, 투자진흥기관 같은 공식 출처를 우선하고 항목마다 출처를 적습니다.</li>
    <li>뉴스는 기사 본문을 옮기지 않고 요약과 원문 링크만 싣습니다.</li>
    <li>사진은 Wikimedia Commons에 공개된 사진을 쓰며, 저작자와 라이선스를 사진마다 표시합니다. 맞는 사진을 찾지 못한 곳은 다른 사진으로 대신하지 않고 "사진 준비 중"으로 비워 둡니다.</li>
    <li>운영시간·입장료·통계는 바뀔 수 있습니다. 방문이나 인용 전에 각 항목의 출처를 다시 확인하세요.</li>
    <li>우크라이나·벨라루스 페이지는 문화유산과 역사를 소개하는 자료이며, 현재 방문을 권유하지 않습니다.</li>
  </ul>
</section>`;
  }

  /* ---------- 시작 ---------- */
  // 브라우저 탭 아이콘: KUERA 로고
  if (!document.querySelector('link[rel~="icon"]')) {
    const ic = document.createElement('link');
    ic.rel = 'icon'; ic.type = 'image/png'; ic.href = ROOT + 'assets/images/kuera/kuera-icon.png';
    document.head.appendChild(ic);
  }
  document.getElementById('site-header').outerHTML = header();
  document.getElementById('site-footer').outerHTML = footer();
  const main = document.getElementById('main');
  ({ home: renderHome, countries: renderCountries, news: renderNews, games: renderGames, about: renderAbout,
     country: m => renderCountry(m, body.dataset.slug),
     section: m => renderSection(m, body.dataset.slug, body.dataset.section) }[PAGE] || renderHome)(main);
})();
