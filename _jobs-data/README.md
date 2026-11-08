# 취업·인턴 데이터 (Careers 페이지)

공개 페이지: `jobs/index.html` (그리는 코드: `assets/js/site.js`의 `renderJobs`). 이 폴더는 GitHub Pages로 공개되지 않습니다.

| 파일 | 내용 |
|---|---|
| `jobs.json` | 공고. `review_status`가 `published`인 실제 공고만 공개 파일에 들어갑니다. `draft`=검수 대기, `hidden`=비공개 |
| `sources.json` | 출처 58곳(조사 문서의 56곳 + 몬테네그로 Zaposli.me, Visegrad Fund). `collection_method`: 수동 검토 / 링크 안내 / 미정. 자동 수집 연결은 아직 없음 |
| `runs.json` | 수집 기록(출처별 ok·partial·blocked·error) |

## 고치는 방법

- 관리자 화면: 사이트 폴더에서 `serve.ps1` 실행 → Chrome·Edge로 `http://localhost:8080/_tools/jobs-admin.html` → '사이트 폴더 열기' → 검수·수정·등록·출처 관리 → '저장'. 저장하면 `assets/js/data-jobs.js`도 함께 만들어집니다.
- 명령으로 빌드: `powershell -ExecutionPolicy Bypass -File _tools/build-jobs.ps1` (검사 실패 시 쓰지 않음).
- 주간 갱신: 데스크톱 앱 예약 작업 `east-europe-weekly-jobs`(매주 월 09:00 한국 시간, 앱이 켜져 있어야 실행). 새 공고는 검수 대기로 들어옵니다.

## 지키는 규칙 (빌드 검사에 들어 있음)

- 한국 국적 지원 가능·비자 지원은 원문 근거(`eligibility_evidence`)가 있을 때만 '미확인' 외의 값을 씁니다.
- 마감 시각이 있으면 시간대(`deadline_timezone`)가 필요합니다. 날짜만 있으면 남은 일수를 세지 않습니다.
- 데모 공고(`is_demo`)는 게시할 수 없습니다. 같은 고용주·직무·도시·채용번호는 중복으로 막습니다.
- 인턴 프로그램 출처의 공고는 참가비·프로그램 자격 칸이 필요합니다.
- 원문 접속 오류는 '마감'이 아니라 '확인필요'로 둡니다.
