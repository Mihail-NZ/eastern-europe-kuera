# 여행(Travel) 카테고리 빌드: 루트 데이터를 고친 뒤 실행한다.
#   1) assets/js/data-trip-photos.js : 루트가 쓰는 도시 사진의 경로·저작자·라이선스(국가 상세 원고에서 가져옴)
#   2) travel/<route-id>/index.html  : 루트마다 상세 페이지 껍데기(본문은 trip.js가 그린다)
#   3) 데이터 점검 : 없는 도시·공항·사진, 이동 정보가 없는 구간을 경고로 출력
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File _tools/build-trip.ps1 [-V trip1]
# (Windows PowerShell 5.1에서 한글이 깨지지 않게 이 파일은 UTF-8 BOM으로 저장한다.)
param([string]$V = 'trip1')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding($false)
function ReadText($p) { [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) }

$data = ReadText "$root\assets\js\data-trip.js"
$routesJs = ReadText "$root\assets\js\data-trip-routes.js"

# ---- 1) 사진 색인 ----
$cpStart = $data.IndexOf('cityPhotos: {'); $cpBlock = if ($cpStart -ge 0) { $data.Substring($cpStart, $data.IndexOf("`n  },", $cpStart) - $cpStart) } else { '' }
$used = @([regex]::Matches($data, "img:\s*'([^']+)'") | ForEach-Object { $_.Groups[1].Value }) +
        @([regex]::Matches($cpBlock, "'([a-z-]+/[a-z0-9-]+)'") | ForEach-Object { $_.Groups[1].Value }) | Sort-Object -Unique
$photos = [ordered]@{}
$warn = @()
foreach ($key in $used) {
  $slug, $place = $key.Split('/')
  $txt = ReadText "$root\assets\js\data-deep-$slug.js"
  # 장소 객체 하나를 slug부터 다음 image_downloaded까지 잘라 필요한 값만 읽는다(원고 형식이 나라마다 조금 달라 JSON 전체를 풀지 않는다)
  $m = [regex]::Match($txt, '"slug":\s*"' + [regex]::Escape($place) + '"[\s\S]*?"image_downloaded":\s*(true|false)')
  if (-not $m.Success) { $warn += "photo: $key not found in data-deep-$slug.js"; continue }
  $blk = $m.Value
  function Field($name) { $x = [regex]::Match($blk, '"' + $name + '":\s*"((?:[^"\\]|\\.)*)"'); if ($x.Success) { [regex]::Unescape($x.Groups[1].Value) } else { '' } }
  $local = (Field 'image_local') -replace '^assets/', "assets/images/$slug/"
  if (-not $local -or -not (Test-Path "$root\$($local -replace '/', '\')")) { $warn += "photo: file missing for $key ($local)"; continue }
  $subject = Field 'image_subject'; if (-not $subject) { $subject = Field 'title' }
  $photos[$key] = @($local, (Field 'image_author'), (Field 'image_license'), (Field 'image_source'), $subject)
}
$json = ($photos | ConvertTo-Json -Compress -Depth 4)
$json = [regex]::Replace($json, '\\u([0-9a-fA-F]{4})', { param($x) [string][char][Convert]::ToInt32($x.Groups[1].Value, 16) })
$head = "/* build-trip.ps1이 만든 파일. 직접 고치지 말 것.`n * 키 = 국가/장소, 값 = [경로, 저작자, 라이선스, 원본(Wikimedia Commons), 설명] */`n"
[IO.File]::WriteAllText("$root\assets\js\data-trip-photos.js", $head + "window.TRIP_PHOTOS = $json;`n", $utf8)

# ---- 2) 루트 상세 페이지 ----
$ga = @'
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-3BFHDYZW12"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-3BFHDYZW12');
</script>
'@
$fonts = @'
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600&family=Noto+Serif:wght@400;600&family=Noto+Serif+KR:wght@400;600&display=swap" rel="stylesheet">
'@
function Esc($s) { $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;') }
function Page($rel, $page, $attr, $title, $desc) {
  @"
<!doctype html>
<html lang="ko">
<head>
$ga
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$(Esc $title) | Eastern Europe</title>
<meta name="description" content="$(Esc $desc)">
$fonts
<link rel="stylesheet" href="${rel}assets/css/site.css?v=$V">
<link rel="stylesheet" href="${rel}assets/css/trip.css?v=$V">
</head>
<body data-page="$page" data-root="$rel"$attr>
<div id="site-header"></div>
<main id="main" tabindex="-1"><noscript><p class="wrap">이 페이지는 여행 루트와 지도를 그리기 위해 자바스크립트가 필요합니다.</p></noscript></main>
<div id="site-footer"></div>
<script src="${rel}assets/js/data-map.js?v=$V"></script>
<script src="${rel}assets/js/data-countries.js?v=$V"></script>
<script src="${rel}assets/js/data-trip.js?v=$V"></script>
<script src="${rel}assets/js/data-trip-routes.js?v=$V"></script>
<script src="${rel}assets/js/data-trip-photos.js?v=$V"></script>
<script src="${rel}assets/js/data-trip-webphotos.js?v=$V"></script>
<script src="${rel}assets/js/data-trip-slides.js?v=$V"></script>
<script src="${rel}assets/js/trip.js?v=$V"></script>
<script src="${rel}assets/js/site.js?v=$V"></script>
</body>
</html>
"@
}
$rx = [regex]"\{ id: '([a-z0-9-]+)', ko: '([^']+)', en: '([^']+)'[\s\S]*?intro: '([^']+)'"
$routes = $rx.Matches($routesJs)
New-Item -ItemType Directory -Force "$root\travel" | Out-Null
[IO.File]::WriteAllText("$root\travel\index.html", (Page '../' 'trip' '' '동유럽 여행 루트 찾기' "기간·시기·예산·취향을 고르면 중동부유럽·발칸·발트 여행 루트 $($routes.Count)개 가운데 맞는 코스를 순위로 추천합니다. 한국 출발 직항 공항, 도시 간 이동, 현지 예산 비교."), $utf8)
# 베스트 10 페이지(travel/best/). 'best'는 루트 id로 쓰지 않는다.
New-Item -ItemType Directory -Force "$root\travel\best" | Out-Null
[IO.File]::WriteAllText("$root\travel\best\index.html", (Page '../../' 'trip-best' '' '많이 다녀온 동유럽 루트 베스트 10' '국내 패키지 후기 수·일정 글과 해외 방문 통계·일정 가이드·여행 포럼 언급을 함께 보고 정한 동유럽·발칸·발트 여행 루트 베스트 10.'), $utf8)
# 루트 시뮬레이터 페이지(travel/sim/). 'sim'도 루트 id로 쓰지 않는다.
New-Item -ItemType Directory -Force "$root\travel\sim" | Out-Null
[IO.File]::WriteAllText("$root\travel\sim\index.html", (Page '../../' 'trip-sim' '' '동유럽 루트 시뮬레이터' '기간·시기·동행·이동 방법·취향·대중픽/힙스터픽 질문에 하나씩 답하면 동유럽·발칸·발트 루트 가운데 나에게 맞는 여행을 골라 주는 시뮬레이터.'), $utf8)
$ids = @()
foreach ($r in $routes) {
  $id = $r.Groups[1].Value; $ids += $id
  New-Item -ItemType Directory -Force "$root\travel\$id" | Out-Null
  [IO.File]::WriteAllText("$root\travel\$id\index.html", (Page '../../' 'trip-route' " data-route=`"$id`"" "$($r.Groups[2].Value) 여행 루트" $r.Groups[4].Value), $utf8)
}
# 데이터에서 빠진 루트의 옛 페이지는 지운다
Get-ChildItem "$root\travel" -Directory | Where-Object { $ids -notcontains $_.Name -and @('best', 'sim') -notcontains $_.Name } | ForEach-Object { Remove-Item $_.FullName -Recurse -Force -Confirm:$false; $warn += "removed stale page travel/$($_.Name)" }

# ---- 3) 점검 ----
$cityIds = [regex]::Matches($data, "(?m)^\s{4}'?([a-z-]+)'?: \{ ko: '") | ForEach-Object { $_.Groups[1].Value }
$gwIds = [regex]::Matches($data, "(?m)^\s{4}([A-Z]{3}): \{ ko: '") | ForEach-Object { $_.Groups[1].Value }
foreach ($m in [regex]::Matches($routesJs, "(?<=stops: [^\n]*)\['([a-z-]+)', \d+, \d+")) { if ($cityIds -notcontains $m.Groups[1].Value) { $warn += "route stop without city data: $($m.Groups[1].Value)" } }
foreach ($m in [regex]::Matches($routesJs, "(?:in|out): '([A-Z]{3})'")) { if ($gwIds -notcontains $m.Groups[1].Value) { $warn += "unknown gateway: $($m.Groups[1].Value)" } }
if ($ids -contains 'best' -or $ids -contains 'sim') { $warn += "route ids 'best' and 'sim' are reserved for the Best 10 / simulator pages" }
if (($ids | Sort-Object -Unique).Count -ne $ids.Count) { $warn += 'duplicate route id' }

"routes: $($ids.Count) | cities: $($cityIds.Count) | gateways: $($gwIds.Count) | photos: $($photos.Count)/$($used.Count)"
if ($warn.Count) { $warn | ForEach-Object { "WARN  $_" } } else { 'no warnings' }
