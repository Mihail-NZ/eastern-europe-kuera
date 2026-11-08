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
    HRV: 'croatia', SRB: 'serbia', EST: 'estonia', MDA: 'moldova', BGR: 'bulgaria', ROU: 'romania', LVA: 'latvia', LTU: 'lithuania', UKR: 'ukraine', BLR: 'belarus', MKD: 'north-macedonia', ALB: 'albania', BIH: 'bosnia-herzegovina', MNE: 'montenegro', KOS: 'kosovo' };
  const ISO3_BY_SLUG = { poland: 'POL', czechia: 'CZE', hungary: 'HUN', slovakia: 'SVK', slovenia: 'SVN',
    croatia: 'HRV', serbia: 'SRB', estonia: 'EST', moldova: 'MDA', bulgaria: 'BGR', romania: 'ROU', latvia: 'LVA', lithuania: 'LTU', ukraine: 'UKR', belarus: 'BLR', 'north-macedonia': 'MKD', albania: 'ALB', 'bosnia-herzegovina': 'BIH', montenegro: 'MNE', kosovo: 'KOS' };
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
      ['news', 'Daily News', 'news/index.html'], ['jobs', 'Careers', 'jobs/index.html'], ['games', 'Mini Game', 'games/index.html'], ['about', 'About KUERA', 'about/index.html']
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
    const mode = opts.mode || 'locator';
    const codes = (opts.focus || []).filter(code => MAP[code]);
    const focus = new Set(codes);
    const u = 'm' + (++uidCounter);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'map-svg map-art map-' + mode + ' cover-country-map');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (mode === 'thumb') svg.setAttribute('aria-hidden', 'true');
    else {
      svg.setAttribute('role', 'group');
      svg.setAttribute('aria-label', opts.label || '동유럽 지도');
    }
    // Reuse the cover pixels and its exact geographic coordinate transform.
    const image = '<image style="filter:brightness(.87) saturate(.88) contrast(.96)" href="' + ROOT + 'assets/images/hero-clean-flags-era.png" x="' + (-1370 / 2.65) + '" y="' + (-355 / 2.65) + '" width="' + (1883 / 2.65) + '" height="' + (835 / 2.65) + '" preserveAspectRatio="none"/>';
    const paths = codes.map(code => '<path d="' + MAP[code].d + '"/>').join('');
    const links = mode === 'thumb' ? '' : Object.entries(SLUG_BY_ISO3).map(([code, slug]) =>
      '<a class="country art-area' + (focus.has(code) ? ' is-focus' : ' is-live') + '" data-code="' + code + '" href="' + countryUrl(slug) + '" aria-label="' + EAST[code].ko + ' 페이지 열기"><path d="' + MAP[code].d + '"/></a>').join('');
    svg.innerHTML = '<defs><clipPath id="' + u + '-focus">' + paths + '</clipPath></defs>' +
      image + '<rect x="-520" y="-140" width="720" height="330" fill="#030818" opacity=".58"/>' +
      '<g clip-path="url(#' + u + '-focus)">' + image + '</g>' + links;
    svg.style.background = '#030818';
    container.appendChild(svg);
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const ratio = rect.width && rect.height ? rect.width / rect.height : 1.8;
      svg.setAttribute('viewBox', fitView(codes.length ? codes : ['POL', 'UKR', 'ROU'], mode === 'thumb' ? 9 : 20, ratio));
    };
    resize();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (!container.isConnected) { observer.disconnect(); return; }
        resize();
      });
      observer.observe(container);
    }
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
    svg.setAttribute('aria-label','동유럽 야경 지도. 폴란드, 체코, 헝가리, 슬로바키아, 슬로베니아를 비롯한 20개국 페이지로 이동할 수 있습니다.');
    svg.innerHTML='<image href="'+ROOT+'assets/images/hero-clean-flags-era.png" width="1883" height="835" preserveAspectRatio="none"/>'+
      '<g transform="translate(1370 355) scale(2.65)">'+Object.entries(SLUG_BY_ISO3).map(([code,slug])=>'<a class="country is-live art-area" data-code="'+code+'" href="'+countryUrl(slug)+'" aria-label="'+EAST[code].ko+' 페이지 열기"><path d="'+MAP[code].d+'"/></a>').join('')+'</g>';
    stage.appendChild(svg);attachTooltip(stage,svg);return svg;
  }

  function renderHome(main) {
    const latest = NEWS[0];
    const stories = latest ? (latest.home && latest.home.length === 3 ? latest.home.map(i => (latest.stories || [])[i]).filter(Boolean) : (latest.stories || []).slice(0, 3)).map(s => Object.assign({ date: latest.date }, s)) : [];
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
</section>
${window.REPORTS ? `<section class="home-reports wrap" aria-labelledby="reports-title">
  <div class="section-head"><div><p class="kicker">Reports &amp; data</p><h2 id="reports-title">국가별 대표 보고서·자료</h2></div></div>
  <ul class="outlets">${window.REPORTS.common.map(r => `<li><a href="${esc(r.u)}" target="_blank" rel="noopener">${esc(r.n)}</a><span>${esc(r.d)}</span></li>`).join('')}</ul>
  <p class="reports-note">나라를 골라 KOTRA·외교부·세계은행·IMF·현지 공식 기관의 자료로 바로 이동하세요.</p>
  <ul class="report-chips">${COUNTRIES.filter(c => window.REPORTS.countries[c.slug]).map(c => `<li><a href="${countryUrl(c.slug)}">${esc(c.name_ko)}</a></li>`).join('')}</ul>
</section>` : ''}`;
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
      romania: 'ro', latvia: 'lv', lithuania: 'lt', ukraine: 'uk', belarus: 'be', 'north-macedonia': 'mk', albania: 'sq', 'bosnia-herzegovina': 'bs', montenegro: 'sr', kosovo: 'sq' }[slug] || 'pl';
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
  /* ---------- 대표 보고서·자료 (data-reports.js) ---------- */
  function reportGroups(slug) {
    const R = window.REPORTS, r = R && R.countries[slug];
    if (!r) return [];
    const eu = r.eu === 'eu' ? ['EU 회원국 소개 (유럽연합 공식 사이트)', 'EU 공식 사이트의 국가 소개와 EU 내 위치', `https://european-union.europa.eu/principles-countries-history/eu-countries/${slug}_en`]
      : ['EU 확대·이웃정책 국가 페이지', 'EU 집행위원회가 다루는 가입·협력 현황과 연례 보고서', slug === 'moldova' || slug === 'ukraine' || slug === 'belarus' ? `https://enlargement.ec.europa.eu/countries/${slug}_en` : `https://enlargement.ec.europa.eu/enlargement-policy/${slug === 'bosnia-herzegovina' ? 'bosnia-and-herzegovina' : slug}_en`];
    const kr = [];
    if (r.k) kr.push(['KOTRA 해외시장뉴스 국가정보', 'KOTRA 무역관의 경제·무역·투자 개황과 최신 보고서', `https://dream.kotra.or.kr/kotranews/cms/nation/actionNatIemList.do?pageNo=&pagePerCnt=10&SITE_NO=3&MENU_ID=220&CONTENTS_NO=1&pRegnCd=03&pNatCd=${r.k}`]);
    kr.push(['외교부 국가·지역 정보', '개황, 정치·경제, 한국과의 관계', `https://www.mofa.go.kr/www/nation/m_3458/view.do?seq=${r.m}`]);
    const intl = [];
    if (r.wb) intl.push(['세계은행 국가 개요', '경제 전망과 개발 과제 요약', `https://www.worldbank.org/en/country/${r.wb}/overview`]);
    intl.push(['세계은행 국가 데이터', 'GDP·인구 등 핵심 지표', `https://data.worldbank.org/country/${r.i}`]);
    intl.push(['IMF 국가 페이지', '경제 전망과 연례 점검(Article IV) 보고서', `https://www.imf.org/en/Countries/${r.i3}`]);
    if (r.tg) intl.push(['미국 상무부 Country Commercial Guide', '시장 개요와 산업별 진출 분석(영문)', `https://www.trade.gov/country-commercial-guides/${r.tg}-market-overview`]);
    intl.push(eu);
    intl.push(['CIA World Factbook', '지리·인구·경제 기본 정보(영문)', `https://www.cia.gov/the-world-factbook/countries/${r.cia}/`]);
    return [['한국 기관 자료', kr], ['국제기구·해외 기관 자료', intl], ['현지 공식 기관', r.local]];
  }
  function reportListHtml(slug) {
    return reportGroups(slug).map(([title, items]) => `<h3 class="outlets-title">${esc(title)}</h3><ul class="outlets">${items.map(([n, d, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a><span>${esc(d)}</span></li>`).join('')}</ul>`).join('')
      + '<p class="img-note">외부 사이트로 연결됩니다. 보고서 목록과 수치는 해당 기관이 갱신하므로 최신 판은 각 사이트에서 확인하세요.</p>';
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
        S('대표 보고서·자료', reportListHtml(c.slug)),
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

  /* 국가 첫 화면의 명소 영상: 사진 4장을 천천히 확대하며 교차 전환하는 반복 클립(CSS 애니메이션, 첫 장면 2.5초·나머지 2초).
   * 한 나라 안에서 요새·성·구시가지처럼 같은 종류의 명소는 한 장면만 넣는다.
   * 동영상 파일로 만들면 확대할 때 픽셀 단위로 끊겨 흔들려 보여서, 모든 나라를 브라우저가 부드럽게 그리는 이 방식으로 통일했다.
   * 사진: Wikimedia Commons(2026-10-18~21, 사용자 승인 후 내려받음). 작가·라이선스를 클립 아래에 표시한다.
   * pos: 4:3 칸에 잘려 들어갈 때 사진의 중심(object-position과 확대 중심) */
  const REEL = {
    poland: { title: 'Poland', shots: [
      { src: 'warsaw-castle-square.jpg', ko: '바르샤바 왕궁광장', en: 'Castle Square, Warsaw', author: 'Rhododendrites', license: 'CC BY-SA 4.0', file: 'Castle_Square_(22346p).jpg' },
      { src: 'wieliczka.jpg', ko: '비엘리치카 소금광산 킹가 예배당', en: "St. Kinga's Chapel, Wieliczka Salt Mine", author: 'Андрей Романенко', license: 'CC BY-SA 4.0', file: 'Saint Kinga Chapel in Wieliczka Salt Mine.jpg' },
      { src: 'morskie-oko-winter.jpg', ko: '겨울의 모르스키에 오코', en: 'Morskie Oko in winter, Tatras', author: 'kallerna', license: 'CC BY-SA 4.0', file: 'Frozen_Morskie_Oko_2019.jpg' },
      { src: 'wawel-night.jpg', ko: '크라쿠프 바벨성 야경', en: 'Wawel Castle by night, Kraków', author: 'Michał Bulsa', license: 'CC0', file: 'Wawel_by_night_(03).jpg' }] },
    czechia: { title: 'Czech Republic', shots: [
      { src: 'prague-castle-night.jpg', ko: '프라하성과 카를교', en: 'Prague Castle & Charles Bridge', author: 'Diego Delso', license: 'CC BY-SA 4.0', file: 'Castillo_de_Praga_y_puente_Carlos,_Praga,_República_Checa,_2022-07-01,_DD_14-16_HDR.jpg', pos: '30% 60%' },
      { src: 'sedlec.jpg', ko: '쿠트나호라 세들레츠 해골 성당', en: 'Sedlec Ossuary, Kutná Hora', author: 'BrokenSphere', license: 'CC BY-SA 3.0', file: 'Sedlec Ossuary chandelier.JPG' },
      { src: 'pravcicka-brana.jpg', ko: '프라우치츠카 브라나', en: 'Pravčická brána, Bohemian Switzerland', author: 'Pudelek', license: 'CC BY-SA 4.0', file: 'Pravčická_brána_(Prebischtor)_-_by_Pudelek.jpg' },
      { src: 'cesky-krumlov-castle.jpg', ko: '체스키크룸로프', en: 'Český Krumlov', author: 'Scotch Mist', license: 'CC BY-SA 4.0', file: 'Cesky_Krumlov_25.JPG' }] },
    hungary: { title: 'Hungary', shots: [
      { src: 'parliament.jpg', ko: '도나우강과 국회의사당', en: 'Parliament on the Danube', author: 'Florian Fèvre', license: 'CC BY-SA 4.0', file: 'Danube_and_Hungarian_Parliament_Building_by_night.jpg' },
      { src: 'balaton.jpg', ko: '발라톤 호수 티하니 반도', en: 'Tihany Peninsula, Lake Balaton', author: 'Civertan', license: 'CC BY-SA 4.0', file: 'A Tihanyi-félsziget látképe madártávlatból.jpg' },
      { src: 'szechenyi-baths.jpg', ko: '세체니 온천', en: 'Széchenyi Baths', author: 'Marc Ryckaert (MJJR)', license: 'CC BY 3.0', file: 'Budapest_Széchenyi_Baths_R01.jpg' },
      { src: 'tokaj.jpg', ko: '토카이 와인 산지', en: 'Tokaj wine region', author: 'Civertan', license: 'CC BY-SA 3.0', file: 'Tokajcivertanlegi1.jpg' }] },
    slovakia: { title: 'Slovakia', shots: [
      { src: 'strbske-pleso.jpg', ko: '하이 타트라 슈트르브스케 플레소', en: 'Štrbské pleso, High Tatras', author: 'Adrian Tync', license: 'CC BY-SA 4.0', file: 'Štrbské_pleso_&_Hotel_Patria_2022.jpg' },
      { src: 'spis-castle.jpg', ko: '스피시 성', en: 'Spiš Castle', author: 'Govisity / Tip na Trip / kosice.guide', license: 'CC BY 2.0', file: 'Spis_Castle.jpg' },
      { src: 'bratislava.jpg', ko: '브라티슬라바 구시가지 중앙광장', en: 'Main Square, Bratislava', author: 'Pudelek (Marcin Szala)', license: 'CC BY-SA 3.0', file: 'Bratislava - Hlavné námestie (radnica).jpg' },
      { src: 'slovak-paradise.jpg', ko: '슬로바키아 파라다이스 협곡 사다리길', en: 'Piecky gorge, Slovak Paradise', author: 'Rudolphs no uno', license: 'CC0', file: 'Slovensky raj Piecky4.jpg' }] },
    slovenia: { title: 'Slovenia', shots: [
      { src: 'bled.jpg', ko: '블레드 호수', en: 'Lake Bled', author: 'Martin McBrien', license: 'CC BY-SA 3.0', file: 'Lake_Bled_view.jpg' },
      { src: 'soca.jpg', ko: '소차강 계곡', en: 'Soča River valley', author: 'MarcusObal', license: 'CC BY-SA 3.0', file: 'Soča_River_Panorama.jpg' },
      { src: 'piran.jpg', ko: '피란 구시가지', en: 'Piran Old Town', author: 'Isiwal', license: 'CC BY-SA 4.0', file: 'Piran_old_town.jpg' },
      { src: 'predjama.jpg', ko: '프레드야마 성', en: 'Predjama Castle', author: 'Dickelbers', license: 'CC BY-SA 3.0', file: 'Predjama_castle.jpg' }] },
    lithuania: { title: 'Lithuania', shots: [
      { src: 'vilnius.jpg', ko: '빌뉴스 구시가지', en: 'Vilnius Old Town', author: 'BigHead', license: 'CC BY-SA 4.0', file: 'Vilnius_old_town_by_Augustas_Didzgalvis.jpg' },
      { src: 'trakai.jpg', ko: '트라카이 호수성', en: 'Trakai Island Castle', author: 'Scotch Mist', license: 'CC BY-SA 4.0', file: 'Trakai_Island_11.jpg' },
      { src: 'curonian-spit.jpg', ko: '쿠로니아 사구', en: 'Curonian Spit dunes', author: 'A.Savin', license: 'FAL', file: 'Curonian_Spit_NP_05-2017_img17_aerial_view_at_Epha_Dune.jpg' },
      { src: 'hill-crosses.jpg', ko: '십자가 언덕', en: 'Hill of Crosses', author: 'Alet123', license: 'CC BY-SA 4.0', file: 'Hill_of_crosses_in_Lithuania.jpg' }] },
    latvia: { title: 'Latvia', shots: [
      { src: 'riga-aerial.jpg', ko: '리가 구시가지', en: 'Riga Old Town', author: 'Diego Delso', license: 'CC BY-SA 3.0', file: 'Vistas_desde_la_iglesia_de_San_Pedro,_Riga,_Letonia,_2012-08-07,_DD_12.JPG' },
      { src: 'venta-rapid.jpg', ko: '쿨디가 벤타 폭포', en: 'Venta Rapid, Kuldīga', author: 'Ymblanter', license: 'CC BY-SA 4.0', file: 'Venta Rapid from the left bank.jpg' },
      { src: 'rundale.jpg', ko: '룬달레 궁전', en: 'Rundāle Palace', author: 'Scotch Mist', license: 'CC BY-SA 4.0', file: 'Rundāle_Palace_27.jpg' },
      { src: 'turaida.jpg', ko: '시굴다 투라이다 성', en: 'Turaida Castle, Sigulda', author: 'Pudelek (Marcin Szala)', license: 'CC BY-SA 3.0', file: 'Turaida_Castle.JPG' }] },
    estonia: { title: 'Estonia', shots: [
      { src: 'tallinn.jpg', ko: '탈린 구시가지', en: 'Tallinn Old Town', author: 'Ivar Leidus (Iifar)', license: 'CC BY-SA 3.0 ee', file: 'Old_town_of_Tallinn_06-03-2012.jpg' },
      { src: 'jagala-winter.jpg', ko: '얼어붙은 예갈라 폭포', en: 'Jägala Waterfall in winter', author: 'Ivar Leidus', license: 'CC BY-SA 3.0 ee', file: 'Jägala_juga_22-03-2013.JPG' },
      { src: 'bog.jpg', ko: '라헤마 비루 습지', en: 'Viru Bog, Lahemaa', author: 'Diego Delso', license: 'CC BY-SA 3.0', file: 'Viru_Bog,_Parque_Nacional_Lahemaa,_Estonia,_2012-08-12,_DD_60.JPG' },
      { src: 'kuressaare.jpg', ko: '쿠레사레 성', en: 'Kuressaare Castle, Saaremaa', author: 'Ivo Kruusamägi', license: 'CC BY-SA 3.0 ee', file: 'Kuressaare_linnus_(2010).JPG' }] },
    croatia: { title: 'Croatia', shots: [
      { src: 'dubrovnik.jpg', ko: '두브로브니크 구시가지', en: 'Old Town of Dubrovnik', author: 'Akira Takiguchi', license: 'CC BY 2.0', file: 'Aerial view of the Old Town of Dubrovnik - Croatia.jpg' },
      { src: 'plitvice.jpg', ko: '플리트비체 호수 국립공원', en: 'Plitvice Lakes National Park', author: 'OrionCro', license: 'CC BY-SA 4.0', file: 'Waterfalls at Plitvice Lakes.jpg' },
      { src: 'split.jpg', ko: '스플리트 디오클레티아누스 궁전', en: "Diocletian's Palace, Split", author: 'Bernard Gagnon', license: 'CC BY-SA 4.0', file: "View of Diocletian's Palace, Split 01.jpg" },
      { src: 'zlatni-rat.jpg', ko: '브라치섬 즐라트니 라트 해변', en: 'Zlatni Rat beach, Brač', author: 'Marin0110', license: 'CC BY-SA 4.0', file: 'Zlatni rat beach seen from Vidova gora mountain.jpg' }] },
    bulgaria: { title: 'Bulgaria', shots: [
      { src: 'rila.jpg', ko: '릴라 수도원', en: 'Rila Monastery', author: 'King of Rona', license: 'CC BY-SA 4.0', file: 'Rila Monastery 17.jpg' },
      { src: 'rila-lakes.jpg', ko: '릴라 7호수', en: 'Seven Rila Lakes', author: 'Untravelled', license: 'CC BY-SA 4.0', file: 'Rila Lakes.jpg' },
      { src: 'plovdiv.jpg', ko: '플로브디프 로마 극장', en: 'Roman Theatre, Plovdiv', author: 'Ymblanter', license: 'CC BY-SA 4.0', file: 'Roman Theatre Philippopolis.jpg' },
      { src: 'nessebar.jpg', ko: '네세버르 구시가지', en: 'Old Nessebar', author: 'Hristina Bumbarova', license: 'CC BY-SA 4.0', file: 'Nessebar, Old town 3.jpg' }] },
    serbia: { title: 'Serbia', shots: [
      { src: 'belgrade-fortress.jpg', ko: '베오그라드 칼레메그단 요새', en: 'Belgrade Fortress, Kalemegdan', author: 'Zcvetkovic', license: 'CC BY-SA 4.0', file: 'Belgrade Fortress Kalemegdan-9878.NEF.jpg' },
      { src: 'saint-sava.jpg', ko: '성 사바 성당', en: 'Church of Saint Sava, Belgrade', author: 'Petar Milošević', license: 'CC BY-SA 4.0', file: 'Church of Saint Sava (Belgrade, Serbia).jpg' },
      { src: 'uvac.jpg', ko: '우바츠 협곡의 굽이치는 강', en: 'Uvac River meanders', author: 'Fabian Vendrig', license: 'CC BY-SA 4.0', file: 'Uvac rivier, Servië.jpg' },
      { src: 'devils-town.jpg', ko: '악마의 도시 돌기둥', en: "Đavolja Varoš (Devil's Town)", author: 'Dimo Dimov', license: 'CC BY-SA 2.0', file: 'Đavolja Varoš.jpg' }] },
    'bosnia-herzegovina': { title: 'Bosnia and Herzegovina', shots: [
      { src: 'mostar.jpg', ko: '모스타르 스타리 모스트', en: 'Stari Most, Mostar', author: 'Berthold Werner', license: 'CC BY-SA 4.0', file: 'Mostar Stari Most BW 2024-10-01 12-58-38.jpg' },
      { src: 'blagaj.jpg', ko: '블라가이 테케(부나강 수원)', en: 'Blagaj Tekke, Buna spring', author: 'Julian Nyča', license: 'CC BY-SA 3.0', file: 'Blagaj – Vrelo Bune 3.jpg' },
      { src: 'kravica.jpg', ko: '크라비차 폭포', en: 'Kravica Waterfall', author: 'old_s', license: 'CC0', file: 'Kravica waterfall july 2012.jpg' },
      { src: 'trebevic.jpg', ko: '트레베비치 1984 올림픽 봅슬레이 트랙', en: 'Trebević 1984 Olympic bobsleigh track', author: 'spacebirdy', license: 'CC BY-SA 3.0', file: 'Olympische Bobbahn von 1984 - Trebević - 03.jpg' }] },
    romania: { title: 'Romania', shots: [
      { src: 'bran.jpg', ko: '브란 성(드라큘라 성)', en: 'Bran Castle', author: 'Todor Bozhinov', license: 'CC BY-SA 4.0', file: 'Bran Castle TB1.jpg' },
      { src: 'transfagarasan.jpg', ko: '트란스파가라산 산악도로', en: 'Transfăgărășan road', author: 'Pudelek (Marcin Szala)', license: 'CC BY-SA 4.0', file: 'Transfăgărășan road (by Pudelek) 01.jpg' },
      { src: 'salina-turda.jpg', ko: '투르다 소금광산', en: 'Salina Turda salt mine', author: '7oanna', license: 'CC BY-SA 4.0', file: 'Salina Turda, Romania.jpg' },
      { src: 'brasov.jpg', ko: '브라쇼브 구시가지 광장', en: 'Council Square, Brașov', author: 'Andrei Stroe', license: 'CC BY-SA 4.0', file: 'RO BV Council Square from Tampa.jpg' }] },
    ukraine: { title: 'Ukraine', shots: [
      { src: 'lavra.jpg', ko: '안개 속 키이우 페체르스크 라브라', en: 'Kyiv Pechersk Lavra in the fog', author: 'KyivMax', license: 'CC BY-SA 4.0', file: 'Києво-Печерська Лавра в ранковому тумані.jpg' },
      { src: 'lviv.jpg', ko: '르비우 구시가지 시장광장', en: 'Market Square, Lviv', author: 'Petar Milošević', license: 'CC BY-SA 3.0', file: 'Лвов Галиција.jpg' },
      { src: 'tunnel-of-love.jpg', ko: '클레반 사랑의 터널', en: 'Tunnel of Love, Klevan', author: 'Myroslava Rakovets', license: 'CC BY-SA 3.0', file: 'Осінь у Тунелі кохання.JPG' },
      { src: 'odesa-opera.jpg', ko: '오데사 오페라 극장', en: 'Odesa Opera and Ballet Theatre', author: 'Konstantin Brizhnichenko', license: 'CC BY-SA 4.0', file: 'Одеський національний академічний театр опери та балету DJI 0112.jpg' }] },
    belarus: { title: 'Belarus', shots: [
      { src: 'mir.jpg', ko: '미르 성', en: 'Mir Castle', author: 'Вадзім Новикаў', license: 'CC BY-SA 3.0', file: 'Комплекс Мирского замка.JPG' },
      { src: 'bison.jpg', ko: '벨라베자 숲의 유럽들소', en: 'European bison, Białowieża Forest', author: 'Charles J. Sharp', license: 'CC BY-SA 4.0', file: 'European bison (Bison bonasus) male Białowieza.jpg' },
      { src: 'library.jpg', ko: '민스크 국립도서관', en: 'National Library of Belarus, Minsk', author: 'Agbarto', license: 'CC BY-SA 4.0', file: '2024.04.11 National Library of Belarus Building Minsk.jpg' },
      { src: 'braslav.jpg', ko: '브라슬라우 호수', en: 'Braslaw Lakes', author: 'Chystakhvalau Uladzimir', license: 'CC BY-SA 4.0', file: 'Belarus, Braslav lakes, Strusto 4.jpg' }] },
    moldova: { title: 'Moldova', shots: [
      { src: 'orheiul-vechi.jpg', ko: '오르헤이울 베키 동굴수도원', en: 'Orheiul Vechi', author: 'Julian Nyča', license: 'CC BY-SA 4.0', file: 'Orhei Vechi 08.JPG' },
      { src: 'cricova.jpg', ko: '크리코바 지하 와인 저장고', en: 'Cricova underground winery', author: 'Visem', license: 'CC BY 4.0', file: 'Cricova winery (Oct 2025) 1.jpg' },
      { src: 'soroca.jpg', ko: '소로카 요새', en: 'Soroca Fortress', author: 'Diego Delso', license: 'CC BY-SA 4.0', file: 'Fuerte de Soroca, Soroca, Moldavia, 2023-11-01, DD 01.jpg' },
      { src: 'chisinau.jpg', ko: '키시너우 예수탄생 대성당', en: 'Nativity Cathedral, Chișinău', author: 'Pudelek', license: 'CC BY-SA 4.0', file: 'Nativity Cathedral, Chișinău.jpg' }] },
    montenegro: { title: 'Montenegro', shots: [
      { src: 'kotor.jpg', ko: '코토르 만과 구시가지', en: 'Bay of Kotor', author: 'Jocelyn Erskine-Kellie', license: 'CC BY 2.0', file: 'View of Kotor (40711294340).jpg' },
      { src: 'durmitor.jpg', ko: '두르미토르 검은 호수', en: 'Black Lake, Durmitor', author: 'Ad Meskens', license: 'CC BY-SA 4.0', file: 'Montenegro NP Durmitor Black Lake 01.jpg' },
      { src: 'ostrog.jpg', ko: '절벽 속 오스트로그 수도원', en: 'Ostrog Monastery', author: 'Gavinevans', license: 'CC BY-SA 3.0', file: 'Ostrog Monastery, Montenegro.jpg' },
      { src: 'tara-bridge.jpg', ko: '타라 협곡 주르제비차 다리', en: 'Đurđevića Tara Bridge', author: 'Followyourheartmarkomaodus', license: 'CC BY-SA 4.0', file: 'Đurđevića Tara.jpg' }] },
    albania: { title: 'Albania', shots: [
      { src: 'berat.jpg', ko: '천 개의 창문 도시 베라트', en: 'Berat, city of a thousand windows', author: 'Arianit', license: 'CC BY-SA 4.0', file: '141 Berat panorama Mangalem and Gorica.jpg' },
      { src: 'blue-eye.jpg', ko: '블루 아이 샘', en: 'The Blue Eye spring', author: 'Calistemon', license: 'CC BY-SA 4.0', file: 'Syri i kalter (The Blue Eye), Albania, September 2022 02.jpg' },
      { src: 'ksamil.jpg', ko: '크사밀 해변의 섬들', en: 'Ksamil islands', author: 'Q.marjola', license: 'CC BY-SA 3.0', file: 'Ksamil, Saranda , Albania.JPG' },
      { src: 'theth.jpg', ko: '알바니아 알프스 테스 계곡', en: 'Theth Valley, Albanian Alps', author: 'Tom.whitehead337', license: 'CC BY-SA 4.0', file: 'Theth Valley, June 2024.jpg' }] },
    'north-macedonia': { title: 'North Macedonia', shots: [
      { src: 'ohrid.jpg', ko: '오흐리드 호수 카네오 성 요한 교회', en: 'St. John at Kaneo, Lake Ohrid', author: 'kallerna', license: 'CC BY-SA 4.0', file: 'Church of St. John at Kaneo 6.jpg' },
      { src: 'matka.jpg', ko: '마트카 협곡', en: 'Matka Canyon', author: 'kallerna', license: 'CC BY-SA 4.0', file: 'Matka Canyon Skopje 3.jpg' },
      { src: 'skopje.jpg', ko: '스코페 마케도니아 광장', en: 'Macedonia Square, Skopje', author: 'kallerna', license: 'CC BY-SA 4.0', file: 'Stone Bridge Skopje 4.jpg' },
      { src: 'heraclea.jpg', ko: '헤라클레아 링케스티스 고대 극장', en: 'Theatre of Heraclea Lyncestis', author: 'Petar Milošević', license: 'CC BY-SA 4.0', file: 'Theatre in Heraclea Lyncestis, Bitola.jpg' }] },
    kosovo: { title: 'Kosovo', shots: [
      { src: 'prizren.jpg', ko: '프리즈렌 구시가지', en: 'Prizren', author: 'Janusz Recław', license: 'CC BY-SA 4.0', file: 'Prizren panorama.jpg' },
      { src: 'decani.jpg', ko: '비소키 데차니 수도원', en: 'Visoki Dečani Monastery', author: 'Julian Nyča', license: 'CC BY-SA 4.0', file: 'Visoki Dečani, exterior view (Julian Nyča).jpg' },
      { src: 'rugova.jpg', ko: '루고바 협곡', en: 'Rugova Canyon', author: 'Ardianlumi', license: 'CC BY-SA 3.0', file: 'Rugova Canyon.jpg' },
      { src: 'library.jpg', ko: '프리슈티나 국립도서관', en: 'National Library of Kosovo, Prishtina', author: 'Arben Llapashtica', license: 'CC BY-SA 4.0', file: 'National Library of Kosovo photo Arben Llapashtica.jpg' }] }
  };
  const LICENSE_URL = { 'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/', 'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/', 'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
    'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
    'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/',
    'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/', 'CC BY-SA 3.0 ee': 'https://creativecommons.org/licenses/by-sa/3.0/ee/', 'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'FAL': 'https://artlibre.org/licence/lal/en/' };  function reelHtml(c) {
    const r = REEL[c.slug];
    if (!r) return '';
    return `<figure class="reel is-loading">
  <div class="reel-stage">
    ${r.shots.map(s => `<div class="reel-shot">
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
  /* 국가 홈 '더 알아보기' 카드 사진(관광·음식 제외): 개요=수도 풍경, 언어=자체 제작한 알파벳표(SVG), 문화=첫 문화 주제, 산업=대표 산업, 뉴스=그 나라 언어의 신문·방송(신문 가판대, 공영방송 스튜디오·사옥).
   * Wikimedia Commons(2026-11-02, 가로 960px로 크기 조정). a: 작가, l: 라이선스, f: Commons 파일명 */
  const CARD_ART = {
    'poland': {
      overview: { a: 'Quintin Soloviev', l: 'CC BY 4.0', f: 'Skyline of Warsaw, Poland.jpg' },
      language: { svg: true },
      culture: { a: 'Jorge Lascar', l: 'CC BY-SA 3.0', f: 'Old Town Market Place-Warsaw-Poland.JPG' },
      industry: { a: 'Marek Ślusarczyk (Tupungato)', l: 'CC BY 3.0', f: '001 Car factory assembly line - Opel factory in Gliwice, Poland.jpg' },
      news: { a: 'Monika (Flickr)', l: 'CC BY-SA 2.0', f: '2009 kiosk Warsaw 3455204738.jpg' } },
    'czechia': {
      overview: { a: 'Uoaei1', l: 'CC BY-SA 4.0', f: 'Praha Panorama from Petřín 20170430.jpg' },
      language: { svg: true },
      culture: { a: 'A.Savin', l: 'FAL', f: 'Prague 07-2016 View from Old Town Hall Tower img3.jpg' },
      industry: { a: 'Zdeněk Fiedler', l: 'CC BY-SA 4.0', f: 'Škoda Auto Mladá Boleslav.jpg' },
      news: { a: 'Rybicka11', l: 'CC BY-SA 4.0', f: 'Česká televize Hradec Králové - studio A.jpg' } },
    'hungary': {
      overview: { a: 'Furkan Akkurt', l: 'CC BY-SA 4.0', f: 'Danube panorama at dusk Budapest 2025.jpeg' },
      language: { svg: true },
      culture: { a: 'Wilfredor', l: 'CC0', f: 'Széchenyi Chain Bridge in Budapest at night.jpg' },
      industry: { a: 'Globetrotter19', l: 'CC BY-SA 3.0', f: 'Mercedes-Benz plant, 2019 Kecskemét.jpg' },
      news: { a: 'Veronika.szappanos', l: 'CC BY-SA 4.0', f: 'Magyar Nemzet utolsó, last editon.jpg' } },
    'slovakia': {
      overview: { a: 'Marc Ryckaert (MJJR)', l: 'CC BY 3.0', f: 'Bratislava Panorama R01.jpg' },
      language: { svg: true },
      culture: { a: 'Krzysiu', l: 'CC BY 4.0', f: 'Jano Adamek Slovakian pipe player.jpg' },
      industry: { a: 'Pedant01', l: 'CC BY-SA 3.0', f: 'Volkswagen Bratislava Plant 2021.jpg' },
      news: { a: 'Jorge Franganillo', l: 'CC BY 2.0', f: 'Bratislava- Slovenský rozhlas - 52049313578.jpg' } },
    'slovenia': {
      overview: { a: 'Tiia Monto', l: 'CC BY-SA 3.0', f: 'Ljubljana panorama 3.jpg' },
      language: { svg: true },
      culture: { a: 'Petar Milošević', l: 'CC BY-SA 4.0', f: 'Ljubljana, triple bridge with flower shop-tempietto to the right.jpg' },
      industry: { a: 'Andrejj', l: 'CC BY-SA 4.0', f: 'Krka, podjetje 1.jpg' },
      news: { a: 'Yerpo', l: 'CC BY-SA 3.0', f: 'Radio Slovenia studio.JPG' } },
    'croatia': {
      overview: { a: 'Vojtěch Dočkal', l: 'CC BY-SA 4.0', f: 'Zagreb, Panorama 001.jpg' },
      language: { svg: true },
      culture: { a: 'Klapa Kartolina', l: 'CC BY-SA 4.0', f: 'Klapa Kartolina in Omiš, Croatia.jpg' },
      industry: { a: 'Alex Proimos', l: 'CC BY 2.0', f: 'Hvar Town through the Yachts (5969965094).jpg' },
      news: { a: 'Ronald Eikelenboom', l: 'CC BY-SA 2.0', f: '2011 news kiosk Croatia 6262630943.jpg' } },
    'serbia': {
      overview: { a: 'Vlada Marinković', l: 'CC BY-SA 3.0', f: 'Belgrade iz balona.jpg' },
      language: { svg: true },
      culture: { a: 'Laslovarga', l: 'CC BY-SA 4.0', f: 'Slavski kolač - Laslovarga.jpg' },
      industry: { a: 'Bjoertvedt', l: 'CC BY-SA 4.0', f: 'Kragujevac FIAT IMG 7811.JPG' },
      news: { a: 'LukaP', l: 'CC BY-SA 3.0', f: 'Radio Television of Serbia headquarters in Tašmajdan Park.jpg' } },
    'estonia': {
      overview: { a: 'Sander Valdre', l: 'CC BY 4.0', f: 'Tallinn skyline 2025.jpg' },
      language: { svg: true },
      culture: { a: 'Diego Delso', l: 'CC BY-SA 3.0', f: 'Tallinn Song Festival Grounds, Tallinn, Estonia, 2012-08-12, DD 13.JPG' },
      industry: { a: 'Erko', l: 'CC BY-SA 4.0', f: 'Ülemiste City.jpg' },
      news: { a: 'Makingstopsense', l: 'CC0', f: 'SirpNov2025.jpg' } },
    'moldova': {
      overview: { a: 'Myrabella', l: 'CC BY-SA 3.0', f: 'Chisinau Stefan cel Mare park fountain.jpg' },
      language: { svg: true },
      culture: { a: 'Avital Brodski', l: 'CC BY-SA 4.0', f: 'Martisor Seller.jpg' },
      industry: { a: 'Nixalsverdrus', l: 'CC BY-SA 3.0', f: 'Vineyard, Anenii Noi District.JPG' },
      news: { a: 'Ion Chibzii', l: 'CC BY-SA 2.0', f: 'Preparing for the TV show Village Hour (2002). (50921586923).jpg' } },
    'bulgaria': {
      overview: { a: 'Luca Volpi', l: 'CC BY-SA 2.0', f: 'Sofia skyline 3.jpg' },
      language: { svg: true },
      culture: { a: 'Dimitǎr Boevski', l: 'CC BY-SA 4.0', f: 'Martenitsa tree in Botevgrad, Bulgaria.jpg' },
      industry: { a: 'Kremister', l: 'CC BY-SA 4.0', f: 'Sensata-20150513- MG 4026.jpg' },
      news: { a: 'Konstantin Pavlov', l: 'CC BY-SA 3.0', f: 'Studio 1, Bulgarian National Radio.JPG' } },
    'romania': {
      overview: { a: 'seisdeagosto', l: 'CC BY-SA 2.0', f: 'Bucharest-Skyline-01.jpg' },
      language: { svg: true },
      culture: { a: 'Babu', l: 'CC BY-SA 4.0', f: 'Martisoare la Muzeul Satului (1).jpg' },
      industry: { a: 'Alexander-93', l: 'CC BY-SA 4.0', f: 'Dacia Duster III IMG 8961.jpg' },
      news: { a: 'Dimitris Kamaras', l: 'CC BY 2.0', f: 'Piața Charles de Gaulle, Bucharest (44658633210).jpg' } },
    'latvia': {
      overview: { a: 'Ymblanter', l: 'CC BY-SA 4.0', f: 'Panorama of Riga from the Stone Bridge.jpg' },
      language: { svg: true },
      culture: { a: 'Kārlis Dambrāns', l: 'CC BY 2.0', f: 'Midsummer market.jpg' },
      industry: { a: 'Ignat Gorazd', l: 'CC BY-SA 2.0', f: 'Lumber mill in Kuldīga, Latvia (18996889756).jpg' },
      news: { a: 'Tony Webster', l: 'CC BY 2.0', f: 'Latvijas Televīzija (LTV) - Latvian Television - Ukraine Flag - Riga.jpg' } },
    'lithuania': {
      overview: { a: 'Karmen media', l: 'CC BY-SA 3.0', f: 'Vilnius old town 8.JPG' },
      language: { svg: true },
      culture: { a: 'Pofka', l: 'CC BY-SA 4.0', f: 'Palace of the Grand Dukes of Lithuania and Gediminas Monument in Vilnius in winter in 2022.jpg' },
      industry: { a: 'Y1337', l: 'CC BY-SA 4.0', f: 'Vilnius CBD.jpg' },
      news: { a: 'Bdx', l: 'CC0', f: 'Lithuanian newspapers in the Kaunas City Library (Ąžuolyno biblioteka).jpg' } },
    'ukraine': {
      overview: { a: 'spoilt.exile', l: 'CC BY-SA 2.0', f: 'Панорама на Днепр и Подол - Panorama of the Dnieper and Podol (9644947002).jpg' },
      language: { svg: true },
      culture: { a: 'Yevtushuk Victor', l: 'CC BY-SA 4.0', f: 'Pysanka Eggs.jpg' },
      industry: { a: 'Eugenereed1984', l: 'CC BY-SA 3.0', f: 'Sunflower field in Ukraine, 23 July 2013.jpg' },
      news: { a: 'Goo3', l: 'CC BY-SA 4.0', f: 'В студії skrypin.ua.jpg' } },
    'belarus': {
      overview: { a: 'Denis Faustinelli', l: 'CC BY 3.0', f: 'Panorama Minsk - panoramio (1).jpg' },
      language: { svg: true },
      culture: { a: 'Tatiana Markina', l: 'CC BY-SA 4.0', f: '2026.03.11 Heritage Crafts Center in Hrodna, Belarusian Traditional Ornaments Vytinanka Vycynanka.jpg' },
      industry: { a: 'Homoatrox', l: 'CC BY-SA 4.0', f: 'Salihorsk (Soligorsk) otvaly.jpg' },
      news: { a: 'Чаховіч Уладзіслаў', l: 'CC BY-SA 3.0', f: 'Мінск. Вуліца Макаёнка. Белтэлерадыёкампанія (01).jpg' } },
    'north-macedonia': {
      overview: { a: 'kallerna', l: 'CC BY-SA 4.0', f: 'Skopje panorama 3.jpg' },
      language: { svg: true },
      culture: { a: 'Diego Delso', l: 'CC BY-SA 3.0', f: 'Sitio arqueológico de Plaosnik, Ohrid, Macedonia, 2014-04-17, DD 28.JPG' },
      industry: { a: 'Ildar Sagdejev (Specious)', l: 'CC BY-SA 4.0', f: '2008-04-17 Geo Storm instrument cluster wiring harness.jpg' },
      news: { a: 'kallerna', l: 'CC BY-SA 4.0', f: 'MRT Center Skopje 1.jpg' } },
    'albania': {
      overview: { a: 'Thomas Quine', l: 'CC BY 2.0', f: 'Tirana panorama (7246584338).jpg' },
      language: { svg: true },
      culture: { a: 'Pudelek', l: 'CC BY-SA 4.0', f: 'Tirana - Skanderbeg Square (Sheshi Skënderbej) - by Pudelek.jpg' },
      industry: { a: 'BBB2021', l: 'CC BY-SA 4.0', f: 'Saranda Promenade.jpg' },
      news: { a: 'TorbjørnS', l: 'CC BY-SA 4.0', f: 'RTSH Main Building Tirana.JPG' } },
    'bosnia-herzegovina': {
      overview: { a: 'Felky', l: 'CC BY 4.0', f: 'Sarajevo Panorama 2022.jpg' },
      language: { svg: true },
      culture: { a: 'Rossum1950', l: 'CC BY-SA 3.0', f: 'Mostar Sevdah Reunion.jpg' },
      industry: { a: 'Manfred Kopka', l: 'CC BY-SA 4.0', f: 'Zenica (Stahlwerk).jpg' },
      news: { a: 'Irmela Cero', l: 'CC BY-SA 4.0', f: 'Sjediste lista Oslobodjenje.jpg' } },
    'montenegro': {
      overview: { a: 'Janusz Recław', l: 'CC BY-SA 4.0', f: 'Podgorica panorama.jpg' },
      language: { svg: true },
      culture: { a: 'Ivan Petrović Poljak', l: 'CC BY-SA 4.0', f: 'Bokeljska Mornarica 01 (Tripundan 2023).jpg' },
      industry: { a: 'Falk2', l: 'CC BY-SA 4.0', f: 'D02.30 Budva, Stadtstrand und Zitadelle.jpg' },
      news: { a: 'Savo Prelevic', l: 'CC BY 4.0', f: 'Visit of Marta Kos, to Montenegro (P-070783-00-18).jpg' } },
    'kosovo': {
      overview: { a: 'Bdx', l: 'CC0', f: 'Pristina, view of city centre, direction North-East, 2025.jpg' },
      language: { svg: true },
      culture: { a: 'GentiBehramaj', l: 'CC BY-SA 4.0', f: 'Sheshi Shadervan.jpg' },
      industry: { a: 'Arianit', l: 'CC BY-SA 4.0', f: 'Innovation and Training Park Prizren from the drone 01.jpg' },
      news: { a: 'Arianit', l: 'CC BY-SA 4.0', f: 'RTK Studio morning show.jpg' } }
  };
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
      const ca = (CARD_ART[slug] || {})[id];
      if (ca) return `<img src="${ROOT}assets/images/cards/${slug}/${id}.${ca.svg ? 'svg' : 'jpg'}" alt="" loading="lazy" decoding="async">` +
        (ca.a ? `<span class="ai-badge">사진 ${esc(ca.a)} · ${esc(ca.l)}</span>` : '');
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
      const video = reel.querySelector('video');
      if (video) {
        const sync = () => {
          reel.classList.toggle('is-paused', video.paused);
          btn.setAttribute('aria-pressed', String(video.paused));
          btn.setAttribute('aria-label', video.paused ? '영상 재생' : '영상 일시정지');
        };
        video.addEventListener('play', sync);
        video.addEventListener('pause', sync);
        const play = () => video.play().catch(sync);
        btn.addEventListener('click', () => video.paused ? play() : video.pause());
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        if (!motion.matches) play();
        motion.addEventListener('change', e => { if (e.matches) video.pause(); });
        let resume = false;
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) { resume = !video.paused; video.pause(); }
          else if (resume && !motion.matches) play();
        });
        video.addEventListener('error', () => { btn.hidden = true; });
        video.querySelector('source').addEventListener('error', () => { btn.hidden = true; });
      } else {
        // 첫 사진이 그려진 뒤에 재생을 시작해야 첫 장면이 온전히 보인다(느린 연결에서도 최대 4초 뒤에는 시작)
        const first = reel.querySelector('.reel-shot img');
        const start = () => reel.classList.remove('is-loading');
        if (first.complete) start(); else { first.addEventListener('load', start); first.addEventListener('error', start); setTimeout(start, 4000); }
        btn.addEventListener('click', () => {
          const paused = reel.classList.toggle('is-paused');
          btn.setAttribute('aria-pressed', paused);
          btn.setAttribute('aria-label', paused ? '영상 재생' : '영상 일시정지');
        });
      }
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
    if (id === 'overview' && deep && window.REPORTS && window.REPORTS.countries[slug]) {
      const rs = { id: 'b-reports', title: '대표 보고서·자료', html: reportListHtml(slug) };
      const at = secs.findIndex(s => /출처/.test(s.title));
      if (at >= 0) secs.splice(at, 0, rs); else secs.push(rs);
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
              ['총격전', '10초마다 무작위 나라가 총을 들고 다른 나라를 쏩니다. 방패가 있으면 막아냅니다.'],
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
<div class="wrap"><p class="kicker">Mini Game</p><h1>미니 게임</h1></div></section><div class="games-wrap wrap">${GAMES.map((g, i) => `<section class="game-card" id="${g.id}" aria-labelledby="g-${g.id}">  <header class="game-head">    <p class="kicker">Game ${i + 1} · ${g.ko}</p>    <h2 id="g-${g.id}">${g.title}</h2>  </header>  <div class="game-frame">    <iframe src="${ROOT}games/${g.id}/index.html?embed" title="${g.title} ${g.ko} 게임" loading="lazy"></iframe>  </div>  <a class="more" href="${ROOT}games/${g.id}/index.html" target="_blank" rel="noopener">새 창에서 크게 보기</a></section>`).join('')}</div>`;
  }

  /* ---------- 페이지: 소개 ---------- */
  /* About KUERA: 학회 소개(사용자가 준 소개글 그대로) + 아래쪽에 이 아카이브 사이트의 자료 원칙 */
  function renderAbout(main) {
    main.innerHTML = `
<section class="page-head night kuera-head">
  <div class="wrap kuera-head-inner">
    <img class="kuera-badge" src="${ROOT}assets/images/kuera/kuera-badge.png" alt="KUERA 로고" width="120" height="120" decoding="async">
    <div>
      <p class="kicker">About KUERA</p>
      <h1>고려대학교 동유럽지역 전략학회</h1>
      <p class="kuera-en" lang="en">Korea University Eastern Europe Research Association</p>
    </div>
  </div>
</section>
<section class="wrap prose kuera">
  <p class="kuera-lead">KUERA(Korea University Eastern Europe Research Association)는 2026년 9월 출범한 고려대학교 노어노문학과 산하의 학술단체로, 국내 대학생 학술단체 중 유일하게 동유럽(중동부유럽)을 중점적으로 연구하는 학회입니다.</p>

  <h2>왜 동유럽인가?</h2>
  <p>동유럽(중동부유럽)은 한국에 아직 충분히 알려지지 않았지만, 고유한 역사와 문화, 다양한 경제적 가능성을 지닌 지역입니다. KUERA는 이러한 동유럽에 대한 관심을 바탕으로 각국의 특성과 지역적 현안을 살펴보고, 지역에 대한 이해를 넓히고자 합니다.</p>

  <h2>활동</h2>
  <div class="kuera-acts">
    <article class="kuera-act">
      <h3>정규 세션</h3>
      <p>매주 진행되는 정규 세션에서는 동유럽의 경제·산업 및 지역적 특성을 학습하고, 한국 기업의 동유럽 시장 진출과 확대 전략을 주제로 프로젝트를 진행합니다.</p>
    </article>
    <article class="kuera-act">
      <h3>비정규 활동</h3>
      <p>전문가 초청 강연, 동유럽 지역 스터디, 대사관 방문 등 동유럽을 보다 폭넓게 이해할 수 있는 다양한 활동을 진행합니다.</p>
    </article>
  </div>

  <h2>연락처</h2>
  <ul class="kuera-contact">
    <li><span class="kc-label">인스타그램</span><a href="https://www.instagram.com/kuera_official/" target="_blank" rel="noopener">@kuera_official</a></li>
    <li><span class="kc-label">이메일</span><a href="mailto:ku.easteurope@gmail.com">ku.easteurope@gmail.com</a></li>
  </ul>
  <h2 class="kuera-site-h">이 사이트에 대해</h2>
  <p>Eastern Europe by KUERA는 학회원이 세션과 프로젝트, 지역 스터디를 준비하며 참고할 수 있도록 동유럽 20개국의 기초 정보와 최신 브리핑을 한곳에 정리한 아카이브입니다.</p>
  <ul>
    <li>국가 정보는 EU, 각국 관광청, 투자진흥기관 같은 공식 출처를 우선하고 항목마다 출처를 적습니다.</li>
    <li>뉴스는 기사 본문을 옮기지 않고 요약과 원문 링크만 싣습니다.</li>
    <li>사진은 Wikimedia Commons에 공개된 사진을 쓰며, 저작자와 라이선스를 사진마다 표시합니다. 맞는 사진을 찾지 못한 곳은 다른 사진으로 대신하지 않고 "사진 준비 중"으로 비워 둡니다.</li>
    <li>운영시간·입장료·통계는 바뀔 수 있습니다. 방문이나 인용 전에 각 항목의 출처를 다시 확인하세요.</li>
    <li>우크라이나·벨라루스 페이지는 문화유산과 역사를 소개하는 자료이며, 현재 방문을 권유하지 않습니다.</li>
  </ul>
</section>`;
  }
  /* ---------- 페이지: 취업·인턴 ----------
   * 데이터: data-jobs.js (원본 _jobs-data/*.json, _tools/build-jobs.ps1로 생성). 검수 후 게시(published)된 실제 공고만 들어 있다.
   * 근무지 탭(해외/국내)과 인턴 탭, 보기(전체/이번 주 신규/마감 임박), 조건 필터를 조합해 목록을 그린다. */
  const JOBS = window.JOBS_DATA || { updated: null, jobs: [], sources: [], last_run: null };
  const DAY = 864e5;
  const isIntern = j => /인턴|intern|trainee|traineeship|실습|stáž|staż|praktyk/i.test(`${j.employment_type || ''} ${j.title_ko || ''} ${j.title_original || ''}`);
  const fmtLong = iso => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${y}년 ${+m}월 ${+d}일`; };
  const seoulDate = t => new Date(t + 9 * 36e5).toISOString().slice(0, 10); // 날짜만 있는 마감일은 한국 날짜로 비교
  /* 마감 정보: 시각+시간대가 있을 때만 남은 일수를 정확히 센다 */
  function deadlineInfo(j, now) {
    if (!j.deadline_at) return { label: j.deadline_note || '마감일 미기재', passed: false, days: null };
    if (/T/.test(j.deadline_at)) {
      const t = Date.parse(j.deadline_at), hm = j.deadline_at.slice(11, 16);
      return { label: `${fmtDate(j.deadline_at.slice(0, 10))} ${hm}${j.deadline_timezone === 'Asia/Seoul' ? ' (한국 시간)' : ` (${j.deadline_timezone})`}`,
        passed: now > t, days: Math.ceil((t - now) / DAY) };
    }
    const today = seoulDate(now), days = Math.round((Date.parse(j.deadline_at) - Date.parse(today)) / DAY);
    return { label: `${fmtDate(j.deadline_at)} (시각 미기재)`, passed: days < 0, days: null, approx: days };
  }
  const effStatus = (j, dl) => (j.status === '모집중' && dl.passed ? '마감' : j.status);
  /* 이번 주 신규: 이번 호 기준일 전 7일 안에 게시된 공고(게시일이 없으면 처음 발견한 날로 대신하고 그렇게 표시) */
  function isNewJob(j) {
    if (!JOBS.updated) return false;
    const ref = Date.parse(JOBS.updated), d = Date.parse(j.published_at || j.first_seen_at);
    return ref - d >= 0 && ref - d < 7 * DAY;
  }
  const soonJob = (j, dl) => !dl.passed && j.status === '모집중' && ((dl.days != null && dl.days <= 7) || (dl.approx != null && dl.approx <= 7));
  const ENTRY = '신입 지원 가능', EXP = '경력 필요';
  const JOB_FILTERS = [
    ['country', '국가', j => [j.work_country]],
    ['city', '도시', j => [j.work_city ? j.work_city.replace(/\s*\(.*\)$/, '') : '도시 미기재']],
    ['cat', '직무', j => [j.job_category || '미분류']],
    ['type', '고용 형태', j => [(j.employment_type || '미기재').replace(/\s*\(.*\)$/, '')]],
    ['level', '경력', j => [j.entry_level ? ENTRY : EXP]],
    ['lang', '요구 언어', j => (j.required_languages && j.required_languages.length ? j.required_languages : ['언어 조건 미기재'])]
  ];
  const STATUS_OPTS = [['open', '모집중·확인 필요'], ['모집중', '모집중'], ['확인필요', '확인 필요'], ['마감', '마감'], ['all', '전체']];
  const TABS = [['abroad', '해외 근무'], ['domestic', '국내 근무'], ['intern', '인턴']];
  const inTab = (j, tab) => (tab === 'intern' ? isIntern(j) : tab === 'domestic' ? j.work_location_group === '국내' : j.work_location_group !== '국내');

  function jobCard(j, now) {
    const dl = deadlineInfo(j, now), st = effStatus(j, dl), iso3 = ISO3_BY_KO[j.work_country];
    const un = t => `<span class="unk">${esc(t)}</span>`;
    const badges = [
      isNewJob(j) ? `<span class="jb is-new">${j.published_at ? '이번 주 신규' : '이번 주 발견'}</span>` : '',
      st === '마감' ? '<span class="jb is-closed">마감</span>' : st === '확인필요' ? '<span class="jb is-check">확인 필요</span>' : '',
      st === '모집중' && soonJob(j, dl) ? `<span class="jb is-soon">${dl.days != null ? (dl.days <= 0 ? '오늘 마감' : `D-${dl.days}`) : '마감 임박'}</span>` : '',
      j.entry_level ? '<span class="jb">신입 가능</span>' : '',
      j.work_location_group === '원격' ? '<span class="jb">원격</span>' : j.work_location_group === '미확인' ? '<span class="jb is-check">근무지 미확인</span>' : ''
    ].join('');
    const langs = (j.required_languages || []).length ? esc(j.required_languages.join(', ')) : un('미기재');
    const pref = (j.preferred_languages || []).length ? ` <span class="pref">우대: ${esc(j.preferred_languages.join(', '))}</span>` : '';
    const pay = j.compensation_type === '미공개' || !j.salary_original ? `비공개${j.salary_original ? ` <span class="pref">(${esc(j.salary_original)})</span>` : ''}`
      : `${esc(j.salary_original)}${j.salary_is_estimate ? ' <span class="pref">(추정치)</span>' : ''}${j.gross_or_net ? ` · ${esc(j.gross_or_net)}` : ''}`;
    const src = JOBS.sources.find(s => s.source_id === j.source_id);
    const fact = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    const prog = j.participation_fee || j.program_eligibility || j.internship_duration
      ? `<dl class="job-facts job-prog">${fact('인턴 기간', j.internship_duration ? esc(j.internship_duration) : un('미기재'))}${fact('참가비', j.participation_fee ? esc(j.participation_fee) : un('미확인'))}${fact('프로그램 자격', j.program_eligibility ? esc(j.program_eligibility) : un('미확인'))}</dl>` : '';
    const elig = j.eligibility_for_korean === '미확인' ? un('미확인') : `<strong>${esc(j.eligibility_for_korean)}</strong>`;
    const visa = j.visa_sponsorship === '미확인' ? un('미확인') : `<strong>${esc(j.visa_sponsorship)}</strong>`;
    return `<li class="job-card${st === '마감' ? ' is-closed' : ''}"${iso3 ? ` style="--band:${flagBand(iso3)}"` : ''}>
  <div class="job-top"><span class="job-place">${iso3 ? flagIcon(iso3, 'flag') : ''}${esc(j.work_country)}${j.work_city ? ` · ${esc(j.work_city)}` : ''}</span><span class="job-badges">${badges}</span></div>
  <h3 class="job-title"><a href="${esc(j.original_url)}" target="_blank" rel="noopener">${esc(j.title_ko)}</a></h3>
  <p class="job-org">${esc(j.company_or_organization)}</p>
  <dl class="job-facts">
    ${fact('고용 형태', esc(j.employment_type || '미기재'))}${fact('경력', esc(j.seniority || '미기재'))}${fact('직무', esc(j.job_category || '미분류'))}
    ${fact('요구 언어', langs + pref)}${fact('급여', pay)}${fact('마감', `${esc(dl.label)}`)}
  </dl>${prog}
  <p class="job-sum">${esc(j.summary_ko)}</p>
  ${j.work_location_group === '국내' ? `<p class="job-rel"><span>동유럽 관련성</span>${esc(j.relevance_reason)}</p>` : ''}
  <p class="job-elig"><span>한국 국적 지원: ${elig}</span><span>비자 지원: ${visa}</span>${j.eligibility_evidence ? `<span class="ev">근거: “${esc(j.eligibility_evidence)}”</span>` : ''}${j.work_authorization_requirement ? `<span class="ev">체류·취업 조건 — ${esc(j.work_authorization_requirement)}</span>` : ''}</p>
  <div class="job-foot">
    <p><span>출처 ${esc(src ? src.source_name : j.source_id)}</span><span>게시 ${j.published_at ? fmtDate(j.published_at) : '미기재'} · 마지막 확인 ${fmtDate(j.last_verified_at)}</span></p>
    <a class="job-apply" href="${esc(j.original_url)}" target="_blank" rel="noopener">원문에서 지원<span aria-hidden="true"> ↗</span></a>
  </div>
</li>`;
  }

  /* 출처 목록: 실제로 어떻게 확인하는지(수동 검토/링크 안내/비활성)를 그대로 보여 준다 */
  const SRC_GROUPS = [
    ['국내 채용 사이트·기관', s => s.source_group === '국내'],
    ['동유럽 현지 채용 사이트', s => s.source_type === '현지 종합'],
    ['외국어·IT·연구 채용', s => ['외국어·전문', 'IT', '공공 고용망', '연구'].includes(s.source_type)],
    ['인턴 프로그램', s => s.source_type === '인턴 프로그램'],
    ['국제기구·국제기관', s => s.source_group === '해외' && ['국제기구', '기관 직접'].includes(s.source_type)]
  ];
  function sourceRow(s) {
    const m = s.active ? s.collection_method : '검토 대기';
    const cls = { '자동 수집': 'is-auto', '수동 검토': 'is-manual', '링크 안내': 'is-link' }[m] || 'is-off';
    return `<li class="src-row">
  <div class="src-name"><a href="${esc(s.source_url)}" target="_blank" rel="noopener">${esc(s.source_name)}</a><span class="src-cov">${esc((s.coverage_countries || []).join(', '))}</span></div>
  <div class="src-meta"><span class="src-m ${cls}">${esc(m)}</span><span class="src-v">${esc(s.verification_status)}${s.last_source_checked_at ? ` · ${fmtDate(s.last_source_checked_at)} 확인` : ''}</span></div>
  ${s.access_notes ? `<p class="src-note">${esc(s.access_notes)}</p>` : ''}
  ${s.program ? `<p class="src-note src-prog">급여: ${esc(s.program.pay)} · 참가비: ${esc(s.program.fee)} · 자격: ${esc(s.program.eligibility)}</p>` : ''}
</li>`;
  }
  function sourcesSection() {
    const all = JOBS.sources, act = all.filter(s => s.active), off = all.filter(s => !s.active);
    const count = m => act.filter(s => s.collection_method === m).length;
    return `<section class="jobs-sources" id="sources" aria-labelledby="src-h">
  <div class="section-head"><h2 id="src-h">출처 목록</h2></div>
  <p class="src-summary">출처 ${all.length}곳 — 수동 검토 ${count('수동 검토')} · 링크 안내 ${count('링크 안내')} · 검토 대기 ${off.length} · <strong>자동 수집 연결 ${count('자동 수집')}</strong></p>
  <p class="src-lead">'수동 검토'는 운영자가 매주 목록을 열어 공고를 고르는 출처, '링크 안내'는 자동 접근이 막혀 있거나 이용 조건을 확인하지 못해 직접 찾아보도록 안내하는 출처입니다. 공식 API·RSS를 확인한 곳은 아직 없어 자동 수집으로 연결된 출처는 없습니다.</p>
  ${SRC_GROUPS.map(([label, fn]) => { const list = act.filter(fn); return list.length ? `<h3 class="src-h3">${esc(label)} <span>${list.length}</span></h3><ul class="src-list">${list.map(sourceRow).join('')}</ul>` : ''; }).join('')}
  ${off.length ? `<details class="src-off"><summary>검토 대기·비활성 출처 ${off.length}곳</summary><ul class="src-list">${off.map(sourceRow).join('')}</ul></details>` : ''}
</section>`;
  }

  function renderJobs(main) {
    const now = Date.now();
    const jobs = JOBS.jobs.map(j => { const dl = deadlineInfo(j, now); return Object.assign({ _dl: dl, _st: effStatus(j, dl) }, j); });
    const tabFromHash = () => (TABS.some(t => t[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'abroad');
    const state = { tab: tabFromHash(), view: 'all', status: 'open' };
    const run = JOBS.last_run;
    main.innerHTML = `
<section class="page-head night">
  <div class="wrap"><p class="kicker">Careers</p><h1>취업·인턴</h1>
  <p>동유럽에서 일하거나 동유럽 시장을 맡는 채용·인턴 공고를 매주 월요일 모아 확인합니다. 공고 본문은 옮기지 않고 핵심 조건과 원문 링크만 싣습니다.</p>
  <p class="jobs-edition">${JOBS.updated ? `${fmtLong(JOBS.updated)} 기준 · 공고 ${jobs.length}건${run ? ` · ${esc(run.kind)}` : ''}` : '아직 발행된 공고가 없습니다'}</p></div>
</section>
<div class="wrap jobs-wrap">
  <div class="jobs-note">
    <p><strong>읽는 법.</strong> 한국 국적 지원 가능 여부와 비자 지원은 공고 원문에 근거가 있을 때만 표시합니다. 한국 기업 공고나 영어 공고라는 이유만으로 지원 가능하다고 보지 않으니, '미확인'은 원문과 회사에 직접 확인하세요. '주재원'은 보통 본사 채용 후 파견, '현지 채용'은 현지 법인 직접 고용이라 체류·취업 조건이 다를 수 있습니다. 마감일은 기업 사정으로 바뀔 수 있습니다.</p>
  </div>
  <div class="tab-bar jobs-tabs" role="tablist" aria-label="근무지 구분">${TABS.map(([id, label]) =>
    `<button type="button" role="tab" id="jt-${id}" aria-controls="jobs-panel" data-tab="${id}">${label} <span class="n"></span></button>`).join('')}</div>
  <div class="jobs-views" role="group" aria-label="보기">${[['all', '전체'], ['new', '이번 주 신규'], ['soon', '마감 임박 (7일 이내)']].map(([id, label]) =>
    `<button type="button" data-view="${id}" aria-pressed="false">${label}</button>`).join('')}</div>
  <details class="jobs-filter" open>
    <summary>조건 필터</summary>
    <form class="jf-grid" onsubmit="return false">
      ${JOB_FILTERS.map(([k, label]) => `<label><span>${label}</span><select data-f="${k}"></select></label>`).join('')}
      <label><span>모집 상태</span><select data-f="status">${STATUS_OPTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <button type="button" class="jf-reset">조건 초기화</button>
    </form>
  </details>
  <div id="jobs-panel" role="tabpanel">
    <p class="jobs-count" aria-live="polite"></p>
    <ul class="jobs-list"></ul>
    <div class="jobs-extra"></div>
  </div>
  ${sourcesSection()}
</div>`;
    const $ = s => main.querySelector(s);
    const selects = [...main.querySelectorAll('select[data-f]')];
    const statusOk = j => (state.status === 'all' ? true : state.status === 'open' ? j._st !== '마감' : j._st === state.status);
    const viewOk = j => (state.view === 'new' ? isNewJob(j) : state.view === 'soon' ? soonJob(j, j._dl) : true);
    function fill() {
      const base = jobs.filter(j => inTab(j, state.tab));
      JOB_FILTERS.forEach(([k, label, get]) => {
        const sel = main.querySelector(`select[data-f="${k}"]`), cur = state[k] || '';
        const vals = [...new Set(base.flatMap(get))].sort((a, b) => a.localeCompare(b, 'ko'));
        sel.innerHTML = `<option value="">전체</option>` + vals.map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
        if (cur && !vals.includes(cur)) state[k] = '';
      });
    }
    function draw() {
      TABS.forEach(([id]) => {
        const b = main.querySelector(`[data-tab="${id}"]`);
        b.setAttribute('aria-selected', String(id === state.tab)); b.tabIndex = id === state.tab ? 0 : -1;
        b.querySelector('.n').textContent = jobs.filter(j => inTab(j, id) && j._st !== '마감').length;
      });
      $('#jobs-panel').setAttribute('aria-labelledby', `jt-${state.tab}`);
      main.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
      const list = jobs.filter(j => inTab(j, state.tab) && statusOk(j) && viewOk(j) &&
        JOB_FILTERS.every(([k, , get]) => !state[k] || get(j).includes(state[k])))
        .sort((a, b) => (a._st === '마감') - (b._st === '마감') || (b.published_at || b.first_seen_at).localeCompare(a.published_at || a.first_seen_at));
      $('.jobs-count').textContent = list.length ? `${list.length}건` : '';
      $('.jobs-list').innerHTML = list.map(j => jobCard(j, now)).join('');
      const tabLabel = TABS.find(t => t[0] === state.tab)[1];
      const empty = !list.length ? `<p class="empty jobs-empty">${!jobs.length ? '아직 게시된 공고가 없습니다.'
        : state.view === 'new' ? '이번 주 신규 공고 없음.' : state.view === 'soon' ? '7일 안에 마감되는 공고가 없습니다.'
        : `조건에 맞는 ${tabLabel} 공고가 없습니다.`} 아래 출처 목록에서 직접 찾아볼 수도 있습니다.</p>` : '';
      const progs = state.tab === 'intern' ? `<section class="intern-progs" aria-labelledby="ip-h"><h3 id="ip-h">인턴 프로그램 바로가기</h3>
  <p>교환·실습 프로그램은 일반 채용과 조건이 다릅니다. 참가비, 급여, 재학 국가·학교 협약 같은 자격을 프로그램마다 확인하세요. 봉사(Global Volunteer 등)와 교육 모집은 인턴 공고로 넣지 않습니다.</p>
  <ul class="src-list">${JOBS.sources.filter(s => s.active && (s.source_type === '인턴 프로그램' || s.source_type === '인턴')).map(sourceRow).join('')}</ul></section>` : '';
      $('.jobs-extra').innerHTML = empty + progs;
    }
    main.querySelectorAll('[data-tab]').forEach(b => {
      b.addEventListener('click', () => { state.tab = b.dataset.tab; history.replaceState(null, '', '#' + state.tab); fill(); draw(); });
      b.addEventListener('keydown', e => {
        const i = TABS.findIndex(t => t[0] === state.tab), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault(); const next = main.querySelector(`[data-tab="${TABS[(i + d + TABS.length) % TABS.length][0]}"]`); next.click(); next.focus();
      });
    });
    main.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; draw(); }));
    selects.forEach(s => s.addEventListener('change', () => { state[s.dataset.f] = s.value; draw(); }));
    $('.jf-reset').addEventListener('click', () => {
      JOB_FILTERS.forEach(([k]) => { state[k] = ''; }); state.status = 'open'; state.view = 'all';
      $('select[data-f="status"]').value = 'open'; fill(); draw();
    });
    window.addEventListener('hashchange', () => { state.tab = tabFromHash(); fill(); draw(); });
    if (matchMedia('(max-width: 760px)').matches) $('.jobs-filter').open = false;
    fill(); draw();
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
  ({ home: renderHome, countries: renderCountries, news: renderNews, jobs: renderJobs, games: renderGames, about: renderAbout,
     country: m => renderCountry(m, body.dataset.slug),
     section: m => renderSection(m, body.dataset.slug, body.dataset.section) }[PAGE] || renderHome)(main);
})();
