# 취업·인턴 데이터 빌드: _jobs-data/{jobs,sources,runs}.json → assets/js/data-jobs.js
#   powershell -ExecutionPolicy Bypass -File _tools/build-jobs.ps1      (저장소 루트에서 실행)
# 검사에 실패하면 data-jobs.js를 쓰지 않는다. 공개 파일에는 review_status가 published인 실제 공고만 들어간다.
# 같은 변환을 _tools/jobs-admin.html(관리자 화면)도 한다. 규칙을 바꾸면 두 곳을 함께 고친다.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding $false
# PowerShell 5.1의 ConvertFrom-Json은 배열을 한 덩어리로 넘기므로 원소별로 풀어서 돌려준다
function ReadJson($rel) { $o = [IO.File]::ReadAllText((Join-Path $root $rel), $utf8).TrimStart([char]0xFEFF) | ConvertFrom-Json; foreach ($i in $o) { $i } }

$jobs = @(ReadJson '_jobs-data/jobs.json')
$sources = @(ReadJson '_jobs-data/sources.json')
$runs = @(ReadJson '_jobs-data/runs.json')

$LOC = '해외', '국내', '원격', '미확인'
$STATUS = '모집중', '마감', '확인필요'
$REVIEW = 'draft', 'published', 'hidden'
$ELIG = '명시 가능', '조건부 검토', '명시 불가', '미확인'
$VISA = '명시 지원', '명시 미지원', '미확인'
$METHOD = '자동 수집', '수동 검토', '링크 안내', '미정'
$dateRe = '^\d{4}-\d{2}-\d{2}$'
$deadlineRe = '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z))?$'

$errs = New-Object Collections.Generic.List[string]
$warns = New-Object Collections.Generic.List[string]
$srcIds = @{}
foreach ($s in $sources) {
  if ($srcIds.ContainsKey($s.source_id)) { $errs.Add("source $($s.source_id): ID 중복") }
  $srcIds[$s.source_id] = $s
  if ($s.source_url -notmatch '^https?://') { $errs.Add("source $($s.source_id): 주소 이상") }
  if ($METHOD -notcontains $s.collection_method) { $errs.Add("source $($s.source_id): collection_method 값 이상") }
  # C 등급·재확인 소스를 연동 완료로 표시하지 않는다
  if ($s.collection_method -eq '자동 수집' -and ($s.priority -eq 'C' -or $s.verification_status -eq '재확인')) { $errs.Add("source $($s.source_id): 재확인 소스를 자동 수집으로 둘 수 없음") }
}

$ids = @{}; $keys = @{}
foreach ($j in $jobs) {
  $n = "job $($j.job_id)"
  if (-not $j.job_id) { $errs.Add('job: job_id 없음'); continue }
  if ($ids.ContainsKey($j.job_id)) { $errs.Add("${n}: job_id 중복") }; $ids[$j.job_id] = 1
  if (-not $srcIds.ContainsKey($j.source_id)) { $errs.Add("${n}: 모르는 source_id $($j.source_id)") }
  if ($j.original_url -notmatch '^https?://') { $errs.Add("${n}: 원문 주소 이상") }
  foreach ($f in 'title_ko', 'company_or_organization', 'work_country', 'relevance_reason', 'summary_ko') { if (-not $j.$f) { $errs.Add("${n}: $f 없음") } }
  if ($LOC -notcontains $j.work_location_group) { $errs.Add("${n}: work_location_group 값 이상") }
  if ($STATUS -notcontains $j.status) { $errs.Add("${n}: status 값 이상") }
  if ($REVIEW -notcontains $j.review_status) { $errs.Add("${n}: review_status 값 이상") }
  if ($ELIG -notcontains $j.eligibility_for_korean) { $errs.Add("${n}: eligibility_for_korean 값 이상") }
  if ($VISA -notcontains $j.visa_sponsorship) { $errs.Add("${n}: visa_sponsorship 값 이상") }
  # 한국인 지원 가능·비자 지원은 원문 근거가 있을 때만
  if (($j.eligibility_for_korean -ne '미확인' -or $j.visa_sponsorship -ne '미확인') -and -not $j.eligibility_evidence) { $errs.Add("${n}: 지원 자격·비자 표시에 eligibility_evidence(원문 근거) 필요") }
  foreach ($f in 'first_seen_at', 'last_verified_at') { if ("$($j.$f)" -notmatch $dateRe) { $errs.Add("${n}: $f 날짜 형식 이상") } }
  if ($j.published_at -and "$($j.published_at)" -notmatch $dateRe) { $errs.Add("${n}: published_at 날짜 형식 이상") }
  if ($j.deadline_at) {
    if ("$($j.deadline_at)" -notmatch $deadlineRe) { $errs.Add("${n}: deadline_at 형식 이상(날짜만, 또는 시각+시간대)") }
    elseif ("$($j.deadline_at)" -match 'T' -and -not $j.deadline_timezone) { $errs.Add("${n}: 마감 시각이 있으면 deadline_timezone 필요") }
  }
  if ($j.is_demo -and $j.review_status -eq 'published') { $errs.Add("${n}: 데모 공고는 게시할 수 없음") }
  # 인턴 프로그램 소스의 공고는 참가비·프로그램 자격 칸을 반드시 채운다(모르면 '미확인')
  $src = $srcIds[$j.source_id]
  if ($src -and $src.source_type -eq '인턴 프로그램' -and (-not $j.participation_fee -or -not $j.program_eligibility)) { $errs.Add("${n}: 인턴 프로그램 공고는 participation_fee·program_eligibility 필요") }
  # 중복: 고용주+직무+도시+채용번호
  $k = (@($j.company_or_organization, $j.title_ko, $j.work_city, $j.source_job_id) -join '|').ToLower()
  if ($keys.ContainsKey($k) -and -not $j.duplicate_group_id) { $errs.Add("${n}: $($keys[$k])와 중복(같은 고용주·직무·도시·채용번호)") }
  $keys[$k] = $j.job_id
}
if ($errs.Count) { $errs | ForEach-Object { Write-Output $_ }; Write-Output '검사 실패: data-jobs.js를 쓰지 않았습니다.'; exit 1 }

$hide = 'review_status', 'review_note', 'is_demo'
$pub = @($jobs | Where-Object { $_.review_status -eq 'published' -and -not $_.is_demo } | ForEach-Object { $_ | Select-Object -Property * -ExcludeProperty $hide })
$last = $runs | Sort-Object run_at -Descending | Select-Object -First 1
$updated = if ($last) { "$($last.run_at)".Substring(0, 10) } else { (Get-Date -Format 'yyyy-MM-dd') }
$out = [ordered]@{ updated = $updated; jobs = $pub; sources = $sources; last_run = $last }
$json = ConvertTo-Json -InputObject $out -Depth 8 -Compress
$text = "/* 원본: _jobs-data/*.json (_tools/build-jobs.ps1 또는 _tools/jobs-admin.html로 생성). 직접 고치지 마세요. */`nwindow.JOBS_DATA=$json;`n"
[IO.File]::WriteAllText((Join-Path $root 'assets/js/data-jobs.js'), $text, $utf8)
Write-Output "data-jobs.js: 게시 공고 $($pub.Count)건 / 전체 $($jobs.Count)건, 출처 $($sources.Count)개, 기준일 $updated"
