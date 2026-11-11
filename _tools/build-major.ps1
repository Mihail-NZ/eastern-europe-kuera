# 주요 뉴스(Major News) 빌드: _major-data/major.json → assets/js/data-major.js
#   powershell -ExecutionPolicy Bypass -File _tools/build-major.ps1      (저장소 루트에서 실행)
# 검사에 실패하면 data-major.js를 쓰지 않는다. 공개 파일에는 status가 published·archived인 기사만 들어가고, review(검토 상태)는 빠진다.
# 같은 변환을 _tools/news-admin.html(관리자 화면)도 한다. 규칙을 바꾸면 두 곳을 함께 고친다.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding $false
$data = [IO.File]::ReadAllText((Join-Path $root '_major-data/major.json'), $utf8).TrimStart([char]0xFEFF) | ConvertFrom-Json

$COUNTRIES = '폴란드', '체코', '슬로바키아', '헝가리', '슬로베니아', '크로아티아', '세르비아', '보스니아 헤르체고비나', '코소보', '몬테네그로', '북마케도니아', '알바니아', '불가리아', '루마니아', '몰도바', '우크라이나', '벨라루스', '리투아니아', '라트비아', '에스토니아'
$STATUS = 'draft', 'published', 'archived'
$REVIEW = 'ai', 'checked'
$dateRe = '^\d{4}-\d{2}-\d{2}$'
$errs = New-Object Collections.Generic.List[string]

$cats = @{}
foreach ($c in @($data.categories)) {
  if (-not $c.id -or -not $c.ko) { $errs.Add('category: id·ko 필요') ; continue }
  if ($cats.ContainsKey($c.id)) { $errs.Add("category $($c.id): ID 중복") }
  $cats[$c.id] = @(@($c.subs) | Where-Object { $_ } | ForEach-Object { $_.id })
}

$ids = @{}; $urls = @{}; $refs = @{}
foreach ($it in @($data.items)) {
  $n = "item $($it.id)"
  if (-not $it.id) { $errs.Add('item: id 없음'); continue }
  if ($ids.ContainsKey($it.id)) { $errs.Add("${n}: id 중복") }; $ids[$it.id] = 1
  foreach ($f in 'title', 'summary') { if (-not $it.$f) { $errs.Add("${n}: $f 없음") } }
  if ($STATUS -notcontains $it.status) { $errs.Add("${n}: status 값 이상(draft/published/archived)") }
  if ($it.review -and $REVIEW -notcontains $it.review) { $errs.Add("${n}: review 값 이상(ai/checked)") }
  if (-not $cats.ContainsKey($it.category)) { $errs.Add("${n}: 모르는 category $($it.category)") }
  else {
    $subs = $cats[$it.category]
    if ($subs.Count -and $subs -notcontains $it.sub) { $errs.Add("${n}: 하위 분야(sub)가 필요하거나 값이 이상함") }
    if (-not $subs.Count -and $it.sub) { $errs.Add("${n}: 이 분야에는 하위 분야가 없음") }
  }
  foreach ($c in @($it.countries)) { if ($c -and $COUNTRIES -notcontains $c) { $errs.Add("${n}: 모르는 나라 $c") } }
  foreach ($f in 'published', 'added') { if ("$($it.$f)" -notmatch $dateRe) { $errs.Add("${n}: $f 날짜 형식 이상") } }
  if ("$($it.published)" -match $dateRe -and "$($it.added)" -match $dateRe -and $it.published -gt $it.added) { $errs.Add("${n}: 원문 발행일이 등록일보다 늦음") }
  $src = @(@($it.sources) | Where-Object { $_ })
  if (-not $src.Count) { $errs.Add("${n}: 출처 없음") }
  foreach ($s in $src) {
    if ("$($s.url)" -notmatch '^https?://') { $errs.Add("${n}: 출처 주소 이상($($s.name))") }
    $key = "$($s.url)".ToLower().TrimEnd('/')
    if ($urls.ContainsKey($key) -and $urls[$key] -ne $it.id) { $errs.Add("${n}: 같은 원문이 $($urls[$key])에도 있음(중복 등록)") }
    $urls[$key] = $it.id
  }
  if ($it.daily_ref) {
    if ("$($it.daily_ref)" -notmatch '^\d{4}-\d{2}-\d{2}#\d+$') { $errs.Add("${n}: daily_ref 형식 이상(YYYY-MM-DD#번호)") }
    if ($refs.ContainsKey($it.daily_ref)) { $errs.Add("${n}: 같은 데일리 기사가 $($refs[$it.daily_ref])에도 연결됨") }
    $refs[$it.daily_ref] = $it.id
  }
}
if ($errs.Count) { $errs | ForEach-Object { Write-Output $_ }; Write-Output '검사 실패: data-major.js를 쓰지 않았습니다.'; exit 1 }

$pub = @($data.items | Where-Object { $_.status -ne 'draft' } | Sort-Object published -Descending | ForEach-Object { $_ | Select-Object -Property * -ExcludeProperty review })
$out = [ordered]@{ updated = $data.updated; categories = @($data.categories); items = $pub }
$json = ConvertTo-Json $out -Depth 10
$text = "/* 원본: _major-data/major.json (_tools/build-major.ps1 또는 _tools/news-admin.html로 생성). 직접 고치지 마세요. */`nwindow.MAJOR_NEWS=" + $json + ";`n"
[IO.File]::WriteAllText((Join-Path $root 'assets/js/data-major.js'), $text, $utf8)
Write-Output "data-major.js: 공개 $($pub.Count)건 / 전체 $(@($data.items).Count)건"
