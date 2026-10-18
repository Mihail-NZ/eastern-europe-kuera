/* 국가 목록 카드에 보여 주는 '주차별 대표 뉴스'. 최신 주차가 맨 앞.
 * 매주 1회 예약 작업(east-europe-weekly-headlines)이 새 주차를 맨 앞에 추가한다. 형식과 규칙은 HANDOFF.md "주간 뉴스" 참고.
 * week_start = 그 주 월요일, week_end = 일요일. 화면의 "10월 3주차"는 week_start에서 계산한다(그 주 목요일이 속한 달 기준).
 * countries[국가 한글명] = { title: 한국어 뉴스 제목, source: 매체명, url: 원문 링크(없으면 생략) }
 * title이 null이면 그 주에 확인된 주요 보도가 없다는 뜻이다. */
window.WEEKLY_NEWS = [
  {
    week_start: '2026-10-12', week_end: '2026-10-18', updated: '2026-10-18',
    note: '학회 브리핑(10/17·10/18)과 웹 검색으로 확인한 보도를 바탕으로 골랐습니다. 링크가 없는 항목은 브리핑 정리 문장에서 가져왔습니다.',
    countries: {
      '폴란드': { title: '폴란드, 제2원전 역할 분담 협약 체결', source: 'Notes from Poland', url: 'https://notesfrompoland.com/2026/10/15/poland-signs-agreement-on-planned-second-nuclear-plant/' },
      '체코': { title: '바비시 총리, EU 정상회의서 트럼프의 러시아산 경유 합의 비판', source: 'Expats.cz', url: 'https://www.expats.cz/czech-news/article/trump-betrayed-us-babis-criticizes-russian-diesel-deal-at-eu-summit' },
      '슬로바키아': { title: '피초 총리, 우크라이나 700억 유로 지원 패키지 불참 선언', source: 'Kyiv Independent', url: 'https://kyivindependent.com/slovakia-hungary-wont-join-70-billion-euro-eu-package-sought-by-ukraine-fico-says/' },
      '헝가리': { title: '머저르 총리, 브뤼셀에서 젤렌스키와 첫 1대1 회담', source: 'European Pravda', url: 'https://www.pravda.com.ua/eng/news/2026/10/16/8058333/' },
      '슬로베니아': { title: 'RTV 수신료 폐지 국민투표, 692표 차 초박빙…비공식 개표 결과 부결 우세', source: 'STA', url: 'https://tax-fin-lex.si/home/novica/37574' },
      '크로아티아': { title: '크로아티아, 몬테네그로 EU 가입 조건 담은 문서를 회원국에 회람', source: 'European Western Balkans', url: 'https://europeanwesternbalkans.com/2026/10/14/croatia-circulates-document-to-eu-member-states-outlining-demands-for-montenegros-accession/' },
      '세르비아': { title: '세르비아 총선 D-7…여당 ‘폭력배 동원’ 내부 폭로, 친정부 방송 편향 논란', source: 'Balkan Insight', url: 'https://balkaninsight.com/2026/10/14/insider-blows-lid-on-serbian-ruling-partys-use-of-hired-thugs/bi/' },
      '보스니아 헤르체고비나': { title: null },
      '코소보': { title: '이탈리아 베르고리 소장, KFOR 신임 사령관 취임', source: 'European Western Balkans', url: 'https://europeanwesternbalkans.com/2026/10/14/italian-general-roberto-vergori-becomes-new-kfor-commander/' },
      '몬테네그로': { title: 'EU 정상들, 몬테네그로 가입조약 초안 작업 환영…‘연내 협상 종료’ 지지는 빠져', source: 'European Western Balkans', url: 'https://europeanwesternbalkans.com/2026/10/16/eu-leaders-welcome-the-ongoing-work-on-drafting-the-accession-treaty-with-montenegro/' },
      '북마케도니아': { title: '북마케도니아, 이중국적자 이바 미하일로바 사건 두고 불가리아와 갈등', source: '학회 브리핑' },
      '알바니아': { title: '알바니아 학생 반정부 시위 닷새째 격화…라마 총리는 사퇴 거부', source: 'Balkan Insight', url: 'https://balkaninsight.com/2026/10/16/albania-pm-defiant-as-protests-spread-to-provincial-cities/bi/' },
      '불가리아': { title: '흑해 상선 드론 피격…불가리아, NATO에 전투기·대드론 체계 지원 공식 요청', source: '해운의소리', url: 'https://www.shippingvoice.kr/news/articleView.html?idxno=11405' },
      '루마니아': { title: '루마니아 F-16, 영공 침범 러시아 제트 드론 2기 격추', source: 'Kyiv Independent', url: 'https://kyivindependent.com/romanian-f-16s-down-two-jet-powered-drones-after-airspace-incursion/' },
      '몰도바': { title: '러시아 드론 영공 침범…돈두셰니 지역에 추락해 폭발', source: 'European Pravda', url: 'https://www.pravda.com.ua/eng/news/2026/10/16/8058394/' },
      '우크라이나': { title: '트럼프, 대러 ‘그레이엄 제재법’ 대부분 면제…젤렌스키 “침략자에 대한 보상”', source: '파이낸셜뉴스', url: 'https://www.fnnews.com/news/202610171917052225' },
      '벨라루스': { title: '젤렌스키, 러시아의 벨라루스 내 미사일 위협 확대 경고', source: 'Kyiv Independent', url: 'https://kyivindependent.com/zelensky-warns-russia-may-expand-missile-threats-from-belarus-against-western-ukraine/' },
      '리투아니아': { title: '리투아니아 2027년 예산안, 국방비 GDP 5% 유지·재정적자 확대', source: 'LRT', url: 'https://www.lrt.lt/en/news-in-english/19/3084074/lithuania-s-2027-budget-5-for-defence-growing-government-deficit' },
      '라트비아': { title: '라트비아 총선 결과 확정…통합명단 41석 중심 새 정부 구성', source: 'LSM', url: 'https://eng.lsm.lv/article/politics/election/16.10.2026-election-results-confirmed-in-latvia.a667913/' },
      '에스토니아': { title: '에스토니아, 러시아산 가스의 발트 경유 영구 차단 추진', source: 'ERR', url: 'https://news.err.ee/1610168398/estonia-wants-to-block-russian-gas-transit-through-baltics-for-good' }
    }
  }
];
