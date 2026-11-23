/* 나라별 쇼핑 안내: why = 현지 쇼핑을 권하는 이유(2~3문장), top = 대표 TOP 3 상품 id, warn = 여행경보 안내(있으면 구매 안내 대신 표시) */
module.exports = {
  EE: { slug: 'estonia', why: '에스토니아 기념품은 숲과 섬에서 나온 소재가 많습니다. 곡물 가루 카마, 주니퍼 나무 소품, 무후섬 자수처럼 이웃 나라에서도 보기 어려운 물건이 많고, 탈린 구시가와 대형 슈퍼만 들러도 대부분 살 수 있습니다.', top: ['ee-vana-tallinn', 'ee-kalev-kama-chocolate', 'ee-juniper-wood'] },
  LV: { slug: 'latvia', why: '라트비아는 리가 한 도시에서 쇼핑이 거의 끝납니다. 블랙 발삼과 라이마 초콜릿 같은 오래된 브랜드부터 MÁDARA·the MUNIO 같은 새 디자인 브랜드까지 고를 수 있고, 리가 중앙시장은 먹거리를 사기 좋습니다.', top: ['lv-black-balsam', 'lv-laima', 'lv-munio-candle'] },
  LT: { slug: 'lithuania', why: '리투아니아는 호박과 리넨, 그리고 모양이 독특한 전통 과자가 강합니다. 3월 초 빌뉴스 카지우카스 장터에 맞춰 가면 베르바·도자기 같은 수공예품을 한자리에서 볼 수 있습니다.', top: ['lt-amber', 'lt-sakotis', 'lt-linen'] },
  PL: { slug: 'poland', why: '폴란드는 슈퍼마켓 과자만으로도 선물이 넉넉할 만큼 국민 간식이 다양하고 물가도 부담이 적습니다. 크라쿠프 시좁카, 워비치 종이 오리기, 포스터 아트처럼 디자인이 뛰어난 문화상품도 많습니다.', top: ['pl-torun-pierniki', 'pl-ptasie-mleczko', 'pl-poster-prints'] },
  CZ: { slug: 'czechia', why: '체코는 보헤미아 유리와 마리오네트 같은 고전 공예에 더해, 지역 이름이 붙은 EU 지리적 표시 과자가 유난히 많습니다. 관광지 가게보다 지역 제과점·슈퍼에서 진짜 명물을 싸게 살 수 있습니다.', top: ['cz-spa-wafers', 'cz-bohemian-glass', 'cz-krtek'] },
  SK: { slug: 'slovakia', why: '슬로바키아 기념품은 체코와 겹치는 것도 있지만 원조를 찾는 재미가 있습니다. 트르델니크의 고향 스칼리차, 모드라 도자기, 타트라티처럼 이 나라에서 시작된 것을 고르세요.', top: ['sk-tatratea', 'sk-modra-majolica', 'sk-bratislavske-rozky'] },
  HU: { slug: 'hungary', why: '헝가리는 부다페스트 중앙시장 한 곳에서 파프리카·팔린카·자수를 모두 볼 수 있습니다. 졸너이 도자기와 티서 운동화, 부다페스트 디자인숍까지 더하면 먹거리와 디자인 선물을 고루 챙길 수 있습니다.', top: ['hu-paprika', 'hu-unicum', 'hu-matyo'] },
  SI: { slug: 'slovenia', why: '슬로베니아는 작은 나라지만 소금·꿀·올리브유·호박씨 오일처럼 EU 원산지 보호를 받는 먹거리가 많습니다. 양봉 문화와 레이스 같은 유네스코 공예도 슬로베니아만의 이야기를 담고 있습니다.', top: ['si-piran-salt', 'si-pumpkin-oil', 'si-panjske-koncnice'] },
  HR: { slug: 'croatia', why: '크로아티아는 해안 도시마다 특산이 다릅니다. 자다르의 마라스키노, 파그의 소금과 레이스, 두브로브니크의 오렌지 당절임처럼 지나는 도시에서 하나씩 고르면 겹치지 않는 선물이 됩니다.', top: ['hr-licitar', 'hr-maraschino', 'hr-croata-tie'] },
  BA: { slug: 'bosnia-herzegovina', why: '보스니아 헤르체고비나 쇼핑의 중심은 커피 문화입니다. 사라예보 바슈차르시야에서 동 커피포트와 로쿰을, 모스타르에서 토착 품종 와인과 무화과를 사면 두 도시의 분위기를 함께 담아 올 수 있습니다.', top: ['ba-copper-dzezva', 'ba-zlatna-dzezva', 'ba-zilavka'] },
  RS: { slug: 'serbia', why: '세르비아는 손님에게 슬라트코와 라키야를 내는 환대 문화가 기념품에도 이어집니다. 국민 과자 플라즈마·스모키는 값이 싸고, 피로트 킬림과 즐라쿠사 토기는 다른 나라에 없는 수공예입니다.', top: ['rs-sljivovica', 'rs-plazma', 'rs-pirot-kilim'] },
  ME: { slug: 'montenegro', why: '몬테네그로는 해안의 올리브·무화과와 산악 지방의 꿀이 대표 먹거리입니다. 코토르에서는 고양이 그림과 레이스처럼 도시 이야기가 담긴 작은 기념품을 고르기 좋습니다.', top: ['me-vranac', 'me-kotor-prints', 'me-bar-olive'] },
  XK: { slug: 'kosovo', why: '코소보는 프리즈렌 구시가의 은세공과 모자 공방이 볼거리이자 쇼핑 거리입니다. 라호베츠 와인과 샤르산맥 꿀처럼 해외에 거의 알려지지 않은 먹거리도 있습니다.', top: ['xk-prizren-filigree', 'xk-plis', 'xk-rahovec-wine'] },
  MK: { slug: 'north-macedonia', why: '북마케도니아는 오흐리드에서 쇼핑이 가장 즐겁습니다. 몇몇 가문만 만드는 오흐리드 펄, 눈앞에서 떠 주는 수제 종이가 대표적이고, 스코페 구시장에서는 아이바르와 과자를 싸게 살 수 있습니다.', top: ['mk-ohrid-pearl', 'mk-ohrid-paper', 'mk-tikves-vranec'] },
  AL: { slug: 'albania', why: '알바니아는 산에서 나는 허브차·꿀·과일 당절임이 일상 먹거리이자 좋은 선물입니다. 크루여 바자르와 지로카스터르 구시가에서는 흰 펠트 모자와 돌집 모형 같은 전통 상품을 흥정하며 살 수 있습니다.', top: ['al-permet-gliko', 'al-caj-mali', 'al-qeleshe'] },
  RO: { slug: 'romania', why: '루마니아는 호레주 도자기와 이에 블라우스처럼 유네스코에 오른 공예가 많고, ROM 초콜릿·게로비탈 화장품 같은 현지 브랜드는 값이 저렴합니다. 시비우·브라쇼브 구시가와 부쿠레슈티 농민박물관 숍이 쇼핑하기 좋습니다.', top: ['ro-horezu', 'ro-ie', 'ro-magiun-topoloveni'] },
  BG: { slug: 'bulgaria', why: '불가리아는 장미의 나라답게 장미 화장품과 잼이 어디에나 있고 값도 쌉니다. 트로얀 도자기와 쿠케리 가면, 스트란자 꿀처럼 지역색이 뚜렷한 상품도 함께 챙겨 보세요.', top: ['bg-rose-cosmetics', 'bg-troyan-pottery', 'bg-mavrud'] },
  MD: { slug: 'moldova', why: '몰도바는 세계적으로 포도밭 비중이 큰 와인 국가라 와인과 디빈 브랜디가 가장 좋은 선물입니다. 키시너우 중앙시장에서는 호두·말린 과일·꿀을 저렴하게 살 수 있습니다.', top: ['md-cricova', 'md-bucuria', 'md-carpet'] },
  BY: { slug: 'belarus', warn: '벨라루스는 외교부 여행경보 지역입니다. 이 페이지는 벨라루스의 대표 상품과 공예 문화를 소개할 뿐 현지 방문·구매를 권하지 않습니다. 여행 전 외교부 해외안전여행 사이트에서 최신 경보를 확인하세요.', why: '벨라루스의 대표 상품은 코무나르카 초콜릿, 밀짚 공예, 리넨, 슬루츠크 벨트 문양처럼 제과·섬유 산업과 민속 공예에 뿌리를 두고 있습니다.', top: ['by-straw', 'by-slutsk-belt', 'by-kommunarka'] },
  UA: { slug: 'ukraine', warn: '우크라이나 전 지역은 외교부 여행금지 국가입니다. 이 페이지는 우크라이나의 대표 상품과 공예 문화를 소개하는 내용이며 현지 여행·구매를 안내하지 않습니다. 일부 브랜드는 공식 온라인 판매를 하고 있습니다.', why: '우크라이나는 피산카·페트리키우카 같은 민속 예술과 리비우의 초콜릿·진저브레드 문화로 유명합니다. 전통을 현대 디자인으로 바꾼 독립 브랜드도 많습니다.', top: ['ua-pysanka', 'ua-petrykivka', 'ua-yurashky'] }
};
