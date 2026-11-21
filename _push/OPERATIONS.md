# CEE Side 운영 가이드

GitHub Pages에서 사이트를 제공하고 Cloudflare Workers와 D1에서 알림을 처리한다. iPhone에 설치하려면 Pages 배포가 필요하며, 알림 수신까지 확인하려면 Worker 배포와 실제 기기의 동의가 필요하다. 아래 절차는 라이브 환경에 적용하는 운영자용 안내다.

## 1. Windows에서 개발본 열기

Windows 11에 Git for Windows, Node.js 24 LTS와 npm을 설치한다. 아래 예시는 PowerShell 7 기준이다. 로컬 웹 서버 예시에는 Windows용 Python 3도 사용한다. Wrangler의 지원 환경은 [Cloudflare 설치 문서](https://developers.cloudflare.com/workers/wrangler/install-and-update/)에서 확인할 수 있다.

```powershell
git clone https://github.com/Mihail-NZ/eastern-europe-kuera.git
Set-Location eastern-europe-kuera
git fetch origin
git branch -r
git switch feature/cee-iphone-pwa-push
```

브랜치가 이미 병합·삭제되었다면 마지막 `git switch` 대신 `git switch main`과 `git pull --ff-only`로 최신 main을 사용한다. 기존 체크아웃을 사용할 때는 변경 사항을 보존한 상태에서 작업한다.

```powershell
node --version
npm.cmd --version
node --test _push/check.test.mjs
py -m http.server 8080 --bind 127.0.0.1 --directory ..
```

PC에서 <http://localhost:8080/eastern-europe-kuera/>를 연다. 저장소의 상위 디렉터리에서 서비스해야 실제 배포와 같은 하위 경로가 된다. 이 서버는 로컬 개발 전용이다. iPhone의 홈 화면·푸시 테스트에는 배포된 HTTPS 주소를 사용한다.

## 2. Cloudflare 무료 계정과 D1 준비

1. [Cloudflare 대시보드](https://dash.cloudflare.com/)에서 가입하고 이메일을 인증한다. Workers & Pages에서 Free 플랜을 유지한다. workers.dev 하위 도메인을 설정하라는 안내가 나오면 계정용 이름을 정한다.
2. 저장소에서 아래를 실행한다. 브라우저에서 사용할 계정을 확인하고 Wrangler의 권한 요청을 승인한다. 계정이 여러 개이면 D1과 Worker를 같은 계정에 생성한다.

```powershell
Set-Location _push
npx.cmd wrangler@4 login
npx.cmd wrangler@4 whoami
npx.cmd wrangler@4 d1 create cee-side-push
```

3. `wrangler.jsonc`의 `d1_databases` 항목에서 `binding`은 `DB`, `database_name`은 방금 사용한 이름, `database_id`는 출력된 실제 ID로 설정한다. 기존 바인딩이 있으면 그 항목을 수정한다. Wrangler가 자동으로 설정을 바꾼 경우 중복 항목이 없는지 확인한다. Worker 이름은 별도의 `name` 필드에 있다.
4. `migrations/0001.sql`을 로컬 DB에 먼저 적용한 뒤 운영 DB에 적용한다. `list` 결과에서 미적용 항목을 확인한다.

```powershell
npx.cmd wrangler@4 d1 migrations apply DB --local
npx.cmd wrangler@4 d1 migrations list DB --remote
npx.cmd wrangler@4 d1 migrations apply DB --remote
npx.cmd wrangler@4 deploy --dry-run
```

[D1 명령어](https://developers.cloudflare.com/d1/wrangler-commands/)

## 3. VAPID와 운영 키 설정

비밀정보를 기록하지 않는 개인 터미널에서 아래 명령을 한 번 실행한다. 출력된 두 키를 운영자 비밀번호 관리자에 함께 보관한다. 서비스 이전·재배포 때에도 같은 키를 사용한다. 키 쌍을 교체하면 기존 iPhone에서 구독을 다시 만들어야 할 수 있다.

```powershell
npx.cmd --yes --package=web-push@3 web-push generate-vapid-keys
```

| Worker 설정 | 입력할 값 |
| --- | --- |
| `VAPID_PUBLIC_KEY` | 위 명령에서 얻은 base64url 공개키 |
| `VAPID_PRIVATE_KEY` | 같은 쌍의 base64url 개인키 |
| `VAPID_SUBJECT` | 실제 운영 연락처를 담은 `mailto:` 주소 |
| `ADMIN_TOKEN` | 운영자 발송 인증용 무작위 값 |
| `RATE_SALT` | 사용량 제한에 쓰는 별도의 무작위 값 |

토큰과 솔트는 비밀번호 관리자의 생성기로 각각 독립적인 32바이트 이상의 난수를 만들거나, 개인 터미널에서 아래 명령을 각각 실행한다. 키·토큰이 담긴 화면이나 명령 출력을 공유하지 않는다.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Worker를 처음 생성할 때는 아래 `secret put`이 Worker 생성을 제안하면 프로젝트의 이름을 확인하고 생성한다. 각각의 입력 프롬프트에 값을 붙여 넣고, 전부 설정한 뒤 소스를 배포한다. 로컬 테스트용 별도 키가 필요하면 `.dev.vars`를 버전 관리 밖에 보관한다. 같은 이름을 Wrangler의 일반 `vars`와 Secret에 이중 등록하지 않는다.

```powershell
npx.cmd wrangler@4 secret put VAPID_PUBLIC_KEY
npx.cmd wrangler@4 secret put VAPID_PRIVATE_KEY
npx.cmd wrangler@4 secret put VAPID_SUBJECT
npx.cmd wrangler@4 secret put ADMIN_TOKEN
npx.cmd wrangler@4 secret put RATE_SALT
npx.cmd wrangler@4 secret list
npx.cmd wrangler@4 deploy
```

Worker의 발송 경로는 Web Crypto로 RFC 8291 본문 암호화와 RFC 8292 VAPID 서명을 처리한다. 위 npm 도구는 운영 키를 처음 생성할 때 사용한다. 실기기 수신은 6절에서 확인한다. [Web Crypto 지원](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) · [RFC 8291](https://www.rfc-editor.org/rfc/rfc8291) · [RFC 8292](https://www.rfc-editor.org/rfc/rfc8292) · [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## 4. 기존 GitHub Pages와 연결

Wrangler가 출력한 정확한 HTTPS Worker 주소를 복사하고 끝의 슬래시를 제거한다. 저장소의 `pwa/config.js`에 있는 `globalThis.CEE_PUSH_ORIGIN` 값으로 저장한다. 브라우저는 Worker의 `/key`에서 구독용 공개키를 가져온다. 프런트엔드에 배포할 운영 설정은 Worker 주소뿐이다.

```powershell
$workerOrigin = (Read-Host '배포된 HTTPS Worker 주소').TrimEnd('/')
Invoke-RestMethod "$workerOrigin/key" -Headers @{Origin='https://mihail-nz.github.io'}
```

GitHub의 Settings → Pages에서 현재 배포 소스와 최근 성공한 배포를 확인한다. PWA 변경과 설정을 개발 브랜치에 커밋하고 검토 후 기존 배포 브랜치에 병합한다. Pages 설정과 커스텀 도메인은 기존 값을 유지한다. Pages 배포가 성공하면 다음 세 주소의 상태와 형식을 확인한다.

- [홈](https://mihail-nz.github.io/eastern-europe-kuera/)
- [Manifest](https://mihail-nz.github.io/eastern-europe-kuera/manifest.webmanifest)
- [Service Worker](https://mihail-nz.github.io/eastern-europe-kuera/sw.js)

## 5. 운영자가 뉴스 보내기

운영 시작 전에는 등록한 본인 기기에서 설정 화면의 테스트 알림을 먼저 사용한다. 아래 관리자 발송 예시는 **전체 구독자**가 대상이다. 실제 공지를 발송할 때만 실행한다. `id`는 콘텐츠별로 한 번 정한다. 배치를 이어 보내거나 요청이 시간 초과되면 동일한 ID와 동일한 본문을 재사용한다. 새 ID를 만들면 별도 공지로 취급한다.

```powershell
$workerOrigin = (Read-Host 'HTTPS Worker 주소').TrimEnd('/')
# 이 PC에 보관한 Windows 사용자 암호화 토큰. 원문을 출력하지 않는다.
$secret = Import-Clixml -LiteralPath (Join-Path $env:LOCALAPPDATA 'CEESide/admin-token.clixml')
$credential = [pscredential]::new('operator', $secret)
$headers = @{Authorization = 'Bearer ' + $credential.GetNetworkCredential().Password}
$message = @{
  id = 'news-pl-industry-20261121-01'
  title = '폴란드 주요 산업 뉴스 🇵🇱'
  body = '이번 주 폴란드 산업 소식을 확인해 보세요.'
  url = 'https://mihail-nz.github.io/eastern-europe-kuera/news/index.html?country=%ED%8F%B4%EB%9E%80%EB%93%9C#daily'
  all = $true
}
$json = $message | ConvertTo-Json -Compress
try {
  do {
    $result = Invoke-RestMethod -Method Post -Uri "$workerOrigin/admin/send" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json)) -ErrorAction Stop
    $result | ConvertTo-Json -Depth 4
    if (!$result.done) { Start-Sleep -Seconds 2 }
  } until ($result.done)
} finally {
  Remove-Variable headers,credential,secret -ErrorAction SilentlyContinue
}
```

분야·국가 지정 발송 시 `all`을 `$false`로 바꾸고, `pwa/topics.mjs`에 있는 한국어 `country` 또는 `category` 값을 사용한다. 예를 들어 국가 값은 `폴란드`, 분야 값은 `산업·비즈니스`다. 429가 발생하면 즉시 반복을 중단하고 대기한 뒤 재개한다. 푸시 서비스의 성공 응답은 기기 표시 여부와 별개이므로 실제 잠금 화면에서 확인한다.

Worker는 호출당 최대 한 명에게 전송한다. 중간 응답은 `id`, `created`(공지 생성 시각, Unix 초), `done: false`, `cursor`를 반환한다. `done: true`이면 최종 집계를 확인한다. `attempted`는 처리 대상으로 기록된 수, `accepted`는 푸시 서비스 접수, `expired`는 404·410 만료, `failed`는 기타 실패, `errors`는 원인별 집계, `uncertain`은 전송과 결과 기록 사이에 처리가 끊겨 도달 여부를 확정할 수 없는 건이다. 같은 ID에 다른 내용으로 요청하면 409가 된다. 결과 미확정 건을 새 공지 ID로 전체 재발송하면 중복될 수 있다.

## 6. iPhone 인수 테스트

| 순서 | 실제 기기에서 수행할 작업 | 통과 기준 |
| --- | --- | --- |
| 1 | iOS 16.4 이상에서 Safari로 홈 주소를 연다. 공유 → 홈 화면에 추가를 선택한다. ‘웹 앱으로 열기’ 선택지가 보이면 켠다. | 올바른 이름과 아이콘 표시 |
| 2 | 홈 아이콘으로 실행하고 국가·뉴스·여행·취업, 메뉴, 뒤로 가기와 외부 링크를 연다. 세로·가로 방향을 바꾼다. | 주소창 없는 실행, 본문·메뉴 접근, 노치·가로 스크롤 문제 없음 |
| 3 | 설치된 앱에서 ‘뉴스 알림 받기’를 누르고 권한을 허용한다. | 버튼을 누른 뒤 권한 창이 뜨고 등록 성공 상태 표시 |
| 4 | 설정에서 ‘15초 뒤 이 기기만 테스트’를 누른다. 접수 안내 뒤 홈 화면으로 나가 기기를 잠근다. 도착한 알림을 탭한다. | 잠금 화면에 제목·본문 표시, 지정된 CEE Side 뉴스로 이동 |
| 5 | 중복 방지 자동 테스트 결과를 확인한다. 실기기 중복 시험은 별도 허가된 테스트 구독 환경에서만 수행한다. | 동일 공지에 대한 추가 알림 없음 |
| 6 | 앱의 설정에서 알림을 끄고 동일 기기에 새 테스트를 시도한다. | 해제 상태 표시 및 이후 발송 대상에서 제외 |
| 7 | 별도 테스트 기기에서 권한을 한 번 거절한 뒤 국가·뉴스 페이지를 이용한다. | 권한 상태 안내가 있고 콘텐츠 이용 가능 |
| 8 | 온라인에서 국가 가이드와 뉴스를 열고 비행기 모드로 재방문한다. 처음 보는 페이지와 지도·외부 링크도 확인한다. | 캐시된 콘텐츠와 오프라인 안내가 구분되고 온라인 복귀 시 최신 뉴스 표시 |

권한을 다시 허용할 때는 iPhone 설정 → 알림 → 설치된 앱의 이름을 확인한다. 잠금 화면 표시, 집중 모드와 알림 요약 설정도 함께 확인한다. APNs를 경유하는 표준 Web Push에는 Apple Developer Program 가입이 필요하지 않다. [WebKit의 iPhone 홈 화면 Web Push 설명](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## 7. 재설치 없는 업데이트 검증

1. 버전 A를 배포한 뒤 설치 앱으로 온라인 방문한다. 실제 사이트가 제공하는 즐겨찾기·일정 등 한두 개를 저장하고 알림 구독 상태를 기록한다.
2. 변경이 눈에 보이는 테스트 문구와 새 Service Worker 버전이 포함된 B를 배포한다. 앱 코드 또는 사전 캐시 목록을 배포할 때 `sw.js`의 `VERSION`을 이전 배포와 다른 값으로 올린다. 기존 앱을 열어 둔 상태와 홈 화면에서 재실행한 상태를 모두 시험한다.
3. ‘새 버전이 준비되었습니다’ 안내가 나온 뒤 현재 화면을 조작한다. ‘업데이트 적용’을 누르기 전 자동으로 재로딩되면 실패다. 다른 탭에서 작성 중인 내용도 확인한다.
4. 버튼을 한 번 누르고 B가 표시되는지 확인한다. 기존 저장 데이터와 알림 설정을 확인하고, 같은 기기에서 테스트 알림을 다시 받는다.
5. 뉴스 데이터만 바꿔 한 번 더 배포한다. 온라인에서 재방문해 새 내용이 표시되는지 확인한다. 업데이트 적용 과정에서는 홈 화면 아이콘 삭제나 Safari 웹사이트 데이터 지우기를 하지 않는다.

## 8. 장애 확인

| 증상 | 확인 순서 |
| --- | --- |
| 설치 후 404 | manifest의 id·scope·start_url, 현재 배포 경로, 아이콘의 요청 경로 |
| 구독 버튼이 설치 안내만 표시 | iOS 버전과 홈 아이콘으로 실행했는지 확인 |
| 연결 오류 | `pwa/config.js`의 Worker 주소, `GET /key`, Pages 출처, 원격 D1 마이그레이션 |
| 관리자 요청 401 또는 403 | 관리자 토큰과 환경 확인. 토큰을 새로 발급한 경우 예약 작업의 Secret도 교체 |
| 푸시 서비스에서 401 또는 403 | VAPID 공개·개인키 쌍, 실제 연락용 subject, 구독 시 사용한 키 확인 |
| 404 또는 410으로 만료 처리된 기기 | 해당 기기에서 알림 설정을 다시 열고 구독 |
| 알림 성공인데 잠금 화면이 조용함 | iOS 설정, 집중 모드, 네트워크, 같은 홈 아이콘의 구독인지 확인 |
| Worker 1102·1027, D1 한도 오류 | Workers의 CPU/요청 지표와 D1 Row Metrics 확인. 배치를 줄이거나 한도 초기화 이후 재개 |
| 구독 정보가 지워져야 함 | 앱의 ‘알림 끄기’로 서버 삭제 성공을 확인한 뒤 아이콘을 제거. 홈 아이콘만 제거한 구독은 발송 시 만료 응답으로 정리될 수 있음 |

Cloudflare Workers & Pages에서 해당 Worker의 Metrics를, D1에서 해당 DB의 Metrics → Row Metrics를 본다. 운영 기록에는 공지 ID, 발송 시각, 처리 건수와 HTTP 상태만 남긴다. 구독 객체, 인증 헤더, 비밀키, 엔드포인트 전체를 출력하거나 장애 신고에 첨부하지 않는다.

## 9. 활성화된 데일리 뉴스 자동 알림

사용자 요청으로 2026-11-21에 자동 알림을 활성화했다. **한국 시간 2026-11-22의 데일리 뉴스부터** 발송한다. 기존 뉴스 생성·GitHub Pages 배포 절차는 그대로 유지하며, 이 자동화가 뉴스를 작성하거나 게시하지는 않는다.

- 스케줄러: `cee-side-daily`, 설정 `_push/daily.wrangler.jsonc`, 코드 `_push/daily-worker.mjs`.
- Cloudflare Cron은 매시 03·13·23·33·43·53분에 실행한다. 모든 시간대에서 같은 10분 간격이며, 브리핑 날짜 비교는 한국 시간이다. PC가 꺼져 있어도 실행된다.
- 운영 사이트의 `assets/js/data-news.js`에서 **오늘 날짜**의 완성된 6개 권역 브리핑을 확인하고 뉴스 페이지 HTTP 200까지 확인한 뒤 발송한다. 오늘 데이터가 없거나 형식이 잘못됐거나 페이지가 공개되지 않았으면 발송하지 않는다. 늦은 배포는 다음 확인 때 처리하고 전날 뉴스를 소급 발송하지 않는다.
- 발송 ID는 `briefing-YYYY-MM-DD`이고 제목·본문·링크도 날짜별로 고정한다. 기존 D1 발송 기록으로 동일 기기에 중복 전송하지 않는다. 같은 날 기사 수정도 추가 알림을 만들지 않는다.
- 알림은 데일리 브리핑 전체 공지로 현재 구독자에게 발송하며 `news/index.html?date=YYYY-MM-DD#daily`로 열린다. 구독 해제한 기기는 대상에서 제외된다.
- 스케줄러는 서비스 바인딩 `PUSH`로 기존 `cee-side-push`를 호출한다. 원래 VAPID 키와 D1을 유지한다. ADMIN_TOKEN은 Secret으로만 공유하고 일반 설정·Git·로그에 기록하지 않는다.
- 무료 플랜의 호출당 CPU를 고려해 실제 암호화 발송은 기존 Worker에서 한 기기씩 수행한다. 한 번의 확인에서 최대 25개 기기를 처리하며, 더 남으면 같은 공지 ID로 다음 확인 때 이어 보낸다. 실패·결과 불확정은 자동 재발송으로 중복을 만들지 않고 실행 실패로 표시한다.
- `POST /preview`는 관리자 인증 후 운영 데이터와 발송 서버 인증만 확인하며 알림을 보내지 않는다. `POST /run`은 실제 Cron과 같은 현재 날짜 조건을 적용한다. 두 경로는 관리자 인증 없이는 401이다.
- 중지하려면 `AUTO_PUSH`를 `false`로 바꾸고 해당 설정 파일로 재배포한다. 날짜 기준 `START_AFTER=2026-11-21`은 유지한다. Cloudflare 스케줄 변경 전파는 최대 15분 걸릴 수 있다.

검사: `node --test _push/check.test.mjs _push/daily.test.mjs`.
스케줄러 배포: `npx.cmd wrangler@4 deploy --config _push/daily.wrangler.jsonc`.
기존 푸시 Worker 배포: `npx.cmd wrangler@4 deploy --config _push/wrangler.jsonc`.
두 설정 파일의 대상을 혼동하지 않는다. 실발송 상태는 기존 D1 jobs/deliveries와 Cloudflare Cron 실행 상태에서 확인한다.

공식 참고: [Cloudflare Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/) · [서비스 바인딩](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/).

## 10. 무료 플랜에서 확인할 수치

2026년 11월 21일 공식 문서 기준이다. GitHub Pages 정적 페이지 조회는 Worker를 거치는 API 요청과 별도로 집계된다.

| 자원 | 무료 한도 |
| --- | --- |
| Workers 계정 요청 | 일 100,000회, UTC 자정(한국 09시) 초기화 |
| Worker 호출당 CPU / 서브요청 / 동시 외부 연결 | 10ms / 50회 / 6개 |
| D1 읽은 행 / 쓴 행 | 일 500만 / 10만 |
| D1 데이터베이스 / 계정 저장 공간 | DB당 500MB / 계정 합계 5GB |
| D1 쿼리 | 무료 Worker 호출당 최대 50개 |

푸시 한 건에는 암호화, 외부 요청, 구독 조회와 결과 기록이 포함된다. 그러므로 일일 Worker 요청 수를 그대로 하루 발송 가능 건수로 환산할 수 없다. 인덱스와 구독 수에 따라 읽고 쓰는 행 수도 달라진다. 첫 소규모 운영 기간의 실제 CPU와 행 사용량을 기준으로 배치를 조정한다.

[Workers 한도](https://developers.cloudflare.com/workers/platform/limits/) · [D1 요금](https://developers.cloudflare.com/d1/platform/pricing/) · [D1 한도](https://developers.cloudflare.com/d1/platform/limits/)

## 현재 배포와 관리자 토큰 보관

- Worker: https://cee-side-push.cee-side-kuera.workers.dev
- 사이트: https://mihail-nz.github.io/eastern-europe-kuera/
- 기존 D1 ID와 VAPID 키를 유지한다. 별도 무료 Worker cee-side-daily의 Cron 자동 발송을 활성화했다(9절).
- 관리자 토큰은 이 PC의 `%LOCALAPPDATA%\CEESide\admin-token.clixml`에 Windows DPAPI로 암호화했다. 같은 Windows 사용자로 위 수동 발송 절차에서 읽으며, 원문을 복사하거나 채팅에 붙이지 않는다. 다른 PC/계정에서는 복호화할 수 없다.
- ‘15초 뒤 이 기기만 테스트’는 소유권을 검증한 구독 하나만 대상으로 한다. 서버가 요청을 접수한 뒤 기다리므로 앱을 닫아도 된다. 발송 직전에 구독 해제를 다시 확인하며 1분에 한 번만 요청할 수 있다.
- 지연 테스트는 [Cloudflare waitUntil](https://developers.cloudflare.com/workers/runtime-apis/context/)의 응답 후 최대 30초 실행 범위 안에서 15초 대기 후 발송을 시도한다. 영구 작업 큐가 아니므로 접수는 기기 도착을 보장하지 않는다. 도착하지 않으면 1분 뒤 재시도하고 수신 설정을 확인한다.
