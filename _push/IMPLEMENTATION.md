# CEE Side 변경 및 검증 기록

## 기존 사이트

기준 커밋 `7a5a6bf8f4a26a87a916c0b3e52570a9156c6b8e`의 재귀 파일 목록에는 파일 1,370개, HTML 277개, 이미지 1,008개(244,580,924바이트)가 있다. 홈의 헤더는 국가·여행·뉴스·취업·게임·학회 소개로 연결된다. 국가 디렉터리에는 개요·여행·문화·음식·산업·언어·뉴스가 있고 여행 루트도 각각의 주소가 있다. 사이트는 정적 HTML과 data-page/data-root 속성, assets/js/site.js, assets/css/site.css를 공유한다. 여행 페이지는 trip.js와 별도 여행 데이터도 사용한다. 일부 화면은 _tools/prerender.ps1로 만든 본문과 JS 렌더링을 함께 사용한다.

국가 기본·상세 데이터와 홈 지도 도형은 data-countries.js, data-deep-*.js, data-map.js에 있다. 뉴스 생성기는 _news-data/YYYY-MM-DD.json의 기사·권역·출처·20개국 단신을 검사한 뒤 최근 30일을 data-news.js로 쓴다. 별도 주요 뉴스·채용·여행 생성 스크립트도 있다. 기존 트리에 Actions 워크플로, Manifest, 서비스 워커는 없었다. 공개 호스팅 주소는 GitHub Pages의 프로젝트 하위 경로다. 저장소 설정의 배포 브랜치와 디렉터리는 운영자가 Settings → Pages에서 확인한다.

홈에는 Google Analytics 4, canonical, Open Graph와 JSON-LD, 외부 Google Fonts가 있다. 헤더 로고는 즉시, 푸터 로고는 lazy 방식으로 불러온다. 홈 지도는 자체 JS 데이터를 사용하며 외부 출처·지도 링크는 연결이 필요하다. 가장 큰 PNG는 약 3.5 MB다. 사진 묶음은 사전 캐시에 포함하지 않았다. 주요 화면에 기존 탐색 메뉴가 있어 하단 탭을 추가하지 않고 공통 푸터 뒤에 알림 설정 링크를 넣었다.

## 변경 파일

| 파일 | 변경 |
| --- | --- |
| index.html, about/index.html, countries/index.html, games/index.html, jobs/index.html, news/index.html, travel/index.html | 기존 head에 설치·아이콘·화면 설정 추가 |
| assets/js/site.js | 기존 렌더링 후 별도 PWA 모듈 로딩 |
| .gitignore | 로컬 비밀값·Wrangler 상태 제외 |
| manifest.webmanifest, sw.js | 앱 식별, 설치, 네트워크 우선 캐시, 업데이트, 백그라운드 알림·클릭 |
| pwa/icon-180.png, icon-192.png, icon-512.png | 기존 KUERA 배지를 브랜드 배경에 배치. 512px는 192px 원본 확대 |
| pwa/app.js, app.css, offline.html | 설치 메타데이터, 업데이트 안내, 오프라인 상태·화면, Safe Area |
| pwa/config.js, settings.html, settings.js, topics.mjs | Worker 주소, 구독 UI·개인정보처리방침, 뉴스 관심 설정 |
| _push/worker.mjs, webpush.mjs | 구독 소유권 검증, 관리자 인증, 필터, 발송, Web Crypto |
| _push/wrangler.jsonc, migrations/0001.sql | Free Worker, 요청 제한, D1 테이블과 인덱스 |
| _push/check.test.mjs, browser-check.cjs | 암호·구독 API 테스트와 Edge 회귀 검사 |
| _push/OPERATIONS.md, IMPLEMENTATION.md | 운영 절차, 검증 및 파일 목록 |

## 검증 및 운영 범위

Node 24 내장 SQLite에 실제 마이그레이션을 적용하고 Worker의 fetch 핸들러에 HTTP 요청을 넣었다. 아웃바운드 푸시 서비스와 Cloudflare 요청 제한 바인딩은 모의 응답을 사용한다. 수신측 Node crypto로 한글 페이로드를 복호화하고 VAPID 서명과 대상 서버를 검사한다. 필터·거부·중복·구독 정리·테스트 요청 제한을 재현한다.

Windows Edge 검사는 Pages 하위 경로로 실제 페이지와 필요한 원본 JS/CSS를 제공하고 390px 화면에서 홈·국가·뉴스·여행·채용·폴란드 가이드를 연다. 방문한 가이드 오프라인 열기, 처음 방문한 주소의 대체 화면, 새 워커 안내와 명시적 적용, localStorage 유지, 데스크톱 GA 태그·canonical 존재를 검사한다. 외부 분석 서버의 수집과 전체 사진·외부 지도 로딩은 이 검사 범위 밖이다.

```powershell
node --test _push/check.test.mjs
# Windows Edge + Playwright가 있는 개발 환경에서
Set-Location _push
npm.cmd install --no-save --package-lock=false playwright
node browser-check.cjs
```

운영 Worker, D1 원격 배포, 실제 APNs 및 iPhone 잠금/앱 종료 수신, 실기기 업데이트는 OPERATIONS.md의 인수 테스트를 따른다. 발송 접수와 실기기 표시는 별개다. 네트워크 중단 등으로 발송 여부가 불확실하면 중복을 피하려고 같은 발송 ID·기기의 자동 재전송을 생략한다. 통계에서 상태 0은 불확실, -1은 네트워크 또는 암호화 오류다. 새 버전은 이 사이트의 캐시만 교체한다. 네트워크 연결 시 뉴스·국가 데이터는 방문할 때 새로 확인한다.

Capacitor에서도 기존 콘텐츠, 관심 설정 규격, 운영자 발송 API와 D1 설계를 재사용할 수 있다. 네이티브 푸시로 옮길 때는 기기 등록·발송 전송 계층을 APNs/FCM 토큰용으로 추가한다. React Native/Expo는 같은 콘텐츠·설정 규격과 발송 정책을 사용할 수 있고 앱 UI와 알림 등록은 해당 런타임에 맞춰 구현한다.

## Windows 운영 배포 확인 (2026-11-21)

- 최신 main `cd48ce8`을 병합하고 여행 페이지의 최신 본문·SEO·데이터를 유지하며 PWA 메타데이터를 보존했다.
- 실제 D1 ID와 기존 VAPID Secrets를 유지했다. 원격 미적용 마이그레이션 없음, ADMIN_TOKEN/RATE_SALT만 추가 등록했다. 관리자 토큰은 저장소 밖 Windows 사용자 DPAPI 암호화 파일에 보관했다.
- Worker `https://cee-side-push.cee-side-kuera.workers.dev` 배포 버전: `58404ee3-e7d5-42c0-831a-9ee617097dcf`. 무료 workers.dev 주소를 등록했으며 자동 알림 발송은 비활성이다.
- 운영 /key HTTP 200, 유효한 P-256 공개키, Pages Origin CORS/사전 요청 통과. 무인증 관리자 요청 401, 다른 Origin 403을 확인했다.
- 실제 원격 D1에서 임시 구독 등록·소유권·조회·삭제 검증 통과. 임시 구독은 제거했고 실제 푸시 및 전체 발송은 실행하지 않았다.
- Node 백엔드 테스트 5개 통과: 암호화 복호화, VAPID 서명, 대상 제한, 구독 소유권·발송 중복·만료, 기기 한정 지연 테스트 및 구독 해제 후 취소.
- Edge 390px에서 6개 주요 화면 가로 넘침 없음. 오프라인/대체 화면, 사용자 승인 전 새로고침 없음, 승인 후 업데이트·캐시 정리·저장 데이터 유지 통과.
- 실제 Worker 주소가 설정된 프런트엔드로 구독·관심 설정·15초 지연 테스트·해제 UI 회귀 검사 통과. 브라우저 권한/PushManager/API는 해당 자동 테스트에서 모의 처리했다.
- 실제 iPhone 설치·APNs 수신·잠금 화면·알림 클릭·실기기 업데이트는 사용자와 운영 배포 후 확인할 항목이다. 자동 테스트로 대체하지 않는다.

병합 직전 추가된 main `29fd504`도 통합했다. 최신 뉴스·여행 Best 10 별도 페이지와 전체 재생성 본문을 유지하고 7개 최상위 페이지에 설치 메타데이터만 추가했다. 통합 뒤 Edge 회귀 검사를 다시 실행했다.

## 실제 iPhone 발송 오류 수정

Cloudflare Workers는 fetch의 redirect:error를 지원하지 않아 Apple 요청 전에 TypeError가 발생했다. redirect:manual로 바꾸어 리디렉션을 따라가지 않으면서 실제 발송이 가능하게 했다. Node 모의 테스트만으로 런타임 차이를 발견하지 못했으므로 manual 옵션과 302 미추적 회귀 검사를 추가했다.

관리자 인증이 필요한 /admin/test는 필수 subscriptionId로 한 기기만 선택하고 상태 코드·제한된 오류 분류만 반환한다. 전체 발송 요청은 받지 않는다. VAPID와 구독 키는 응답이나 로그에 출력하지 않는다. 수정 Worker에서 해당 iPhone에만 발송한 요청은 Apple HTTP 201로 접수됐고 사용자가 실제 알림 도착을 확인했다. 잠금 상태 수신과 클릭 후 뉴스 페이지 열기는 별도 확인이 필요하다.

공식 근거: https://developers.cloudflare.com/workers/runtime-apis/request/
