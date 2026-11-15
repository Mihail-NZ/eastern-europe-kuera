# 검색 노출용 사전 렌더링 + SEO 태그 생성
#   powershell -ExecutionPolicy Bypass -File _tools/prerender.ps1          (저장소 루트에서 실행, 약 10분)
#
# 하는 일
#  1) serve.ps1로 사이트를 띄우고, 모든 페이지를 헤드리스 크롬(또는 Edge)으로 열어 완성된 메뉴·본문·푸터를
#     HTML 파일 안 <!--pr--> ... <!--/pr--> 사이에 써 넣는다. 네이버·AI 검색 수집기처럼 자바스크립트를 실행하지 않는
#     수집기도 본문을 읽게 하기 위함이다. 방문자 화면은 site.js가 곧바로 다시 그리므로 달라지지 않는다.
#  2) 페이지마다 <title>, description, canonical, Open Graph(카톡·SNS 미리보기), JSON-LD를 <!--seo--> 구역에 쓴다.
#  3) sitemap.xml, robots.txt, llms.txt를 만든다.
#
# 언제 다시 돌리나: 국가·여행·소개 내용이나 사이트 이름을 바꾼 뒤 공개하기 전에. 데일리 뉴스는 매일 바뀌어도
#   다시 돌릴 필요 없다(화면은 자바스크립트가 최신으로 그리고, 미리 써 둔 본문에는 날짜가 함께 남는다).
# 사이트 이름을 바꿀 때: 아래 $Brand와 $Tagline만 고친 뒤 다시 실행한다.
param(
  [string]$Brand = '동유럽 산책',
  [string]$BrandEn = 'CEE Side',
  [string]$Tagline = '동유럽 20개국 여행·문화·뉴스·취업 정보',
  [string]$Base = 'https://mihail-nz.github.io/eastern-europe-kuera/',
  [int]$Port = 8099,
  [string]$Only = ''   # 시험용: 이 정규식에 맞는 페이지만 처리(사이트맵·robots·llms는 만들지 않음)
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding $false
$today = (Get-Date).ToString('yyyy-MM-dd')

$browser = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw '크롬이나 Edge를 찾지 못했습니다.' }

# --- 로컬 서버 ---
$server = Start-Process powershell -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$root\serve.ps1`"", '-Port', $Port -WindowStyle Hidden -PassThru
$ok = $false
for ($i = 0; $i -lt 40 -and -not $ok; $i++) { Start-Sleep -Milliseconds 500; try { Invoke-WebRequest "http://localhost:$Port/index.html" -UseBasicParsing -TimeoutSec 3 | Out-Null; $ok = $true } catch {} }
if (-not $ok) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue; throw "로컬 서버($Port)가 뜨지 않았습니다." }

function Strip($s) { [Net.WebUtility]::HtmlDecode(($s -replace '(?s)<[^>]+>', ' ' -replace '\s+', ' ').Trim()) }
function Attr($s) { "$s".Replace('&', '&amp;').Replace('"', '&quot;').Replace('<', '&lt;').Replace('>', '&gt;') }
# 고정 페이지의 검색용 제목(핵심어를 앞에)
$FIXED = @{
  'countries/index.html' = '동유럽 20개국 국가 정보'
  'news/index.html'      = '동유럽 뉴스 - 데일리 뉴스·주요 뉴스'
  'jobs/index.html'      = '동유럽 취업·인턴 공고'
  'about/index.html'     = 'KUERA 소개 - 고려대학교 동유럽지역 전략학회'
  'games/index.html'     = '동유럽 국기 미니 게임'
}
function Cut($s, $n) { if ($s.Length -le $n) { $s } else { $s.Substring(0, $n - 1).TrimEnd() + '…' } }
function Grab($html, $pattern) { $m = [regex]::Match($html, $pattern); if ($m.Success) { $m.Groups[1].Value } else { '' } }
function CleanBody($s) {
  foreach ($p in '(?s)<svg\b.*?</svg>', '(?s)<script\b.*?</script>', '(?s)<video\b.*?</video>', '(?s)<iframe\b.*?</iframe>', '(?s)<noscript\b.*?</noscript>', '(?s)<dialog\b.*?</dialog>', '<!--/?pr-->') { $s = [regex]::Replace($s, $p, '') }
  $s
}

$pages = Get-ChildItem $root -Recurse -Filter index.html | Where-Object {
  $r = $_.FullName.Substring($root.Length + 1) -replace '\\', '/'
  $r -notmatch '^(_|\.git/)' -and $r -notmatch '^games/[^/]+/'
} | ForEach-Object { $_.FullName.Substring($root.Length + 1) -replace '\\', '/' } | Sort-Object
if ($Only) { $pages = @($pages | Where-Object { $_ -match $Only }) }
$sitemap = New-Object Collections.Generic.List[string]
$tmp = Join-Path $env:TEMP "prerender-$PID.html"
$n = 0
try {
  foreach ($rel in $pages) {
    $n++
    $path = Join-Path $root $rel
    $src = [IO.File]::ReadAllText($path, $utf8)
    $dir = $rel -replace 'index\.html$', ''
    $url = $Base + $dir
    $depth = ($dir.ToCharArray() | Where-Object { $_ -eq '/' }).Count
    $up = '../' * $depth

    # 예전 국가 뉴스 주소: 뉴스 페이지로 넘어가는 페이지라 검색 결과에서 뺀다
    $isRedirect = $rel -match '^countries/[^/]+/news/index\.html$'

    # 애니메이션이 계속 도는 페이지(게임 등)는 가상 시간이 끝나지 않아 멈출 수 있다: 30초 넘으면 끄고 가상 시간 없이 다시 찍는다
    $args0 = @('--headless=new', '--disable-gpu', '--no-first-run', '--log-level=3', '--virtual-time-budget=6000', '--dump-dom', "http://localhost:$Port/$rel")
    $out = "$tmp.$n.html"
    $pr = Start-Process $browser -ArgumentList $args0 -RedirectStandardOutput $out -RedirectStandardError "$out.err" -PassThru -WindowStyle Hidden
    if (-not $pr.WaitForExit(30000)) {
      & taskkill /F /T /PID $pr.Id 2>&1 | Out-Null
      Start-Sleep -Milliseconds 500
      $out = "$tmp.$n.b.html"
      $pr = Start-Process $browser -ArgumentList ($args0 | Where-Object { $_ -notmatch 'virtual-time' }) -RedirectStandardOutput $out -RedirectStandardError "$out.err" -PassThru -WindowStyle Hidden
      if (-not $pr.WaitForExit(30000)) { & taskkill /F /T /PID $pr.Id 2>&1 | Out-Null; Write-Output "건너뜀(시간 초과): $rel"; continue }
    }
    $pr.WaitForExit()
    # 크롬 자식 프로세스가 출력 파일을 잠시 더 잡고 있을 수 있어 풀릴 때까지 기다린다(최대 40초)
    $dom = $null
    for ($try = 0; $try -lt 80 -and $null -eq $dom; $try++) {
      try { $dom = [IO.File]::ReadAllText($out, $utf8) } catch { Start-Sleep -Milliseconds 500 }
    }
    if ($null -eq $dom) { Write-Output "건너뜀(출력 파일 잠김): $rel"; continue }
    Remove-Item $out, "$out.err" -ErrorAction SilentlyContinue
    $main = Grab $dom '(?s)<main id="main"[^>]*>(.*)</main>'
    if (-not $isRedirect -and $main.Length -lt 200) { Write-Output "건너뜀(본문 없음): $rel"; continue }
    $hdr = Grab $dom '(?s)(<header class="site-header">.*?</header>)'
    $ftr = Grab $dom '(?s)(<footer class="site-footer">.*?</footer>)'

    # 제목·설명
    $rtTitle = Strip (Grab $dom '(?s)<title>(.*?)</title>')
    # 런타임 제목 끝의 사이트 이름(예전 이름 포함)을 모두 떼어 낸 핵심 제목
    $brandRe = '(Eastern Europe|동유럽 산책|CEE Side|' + [regex]::Escape($Brand) + ')'
    $core = $rtTitle
    while ($core -match ('\s*\|\s*' + $brandRe + '$')) { $core = $core -replace ('\s*\|\s*' + $brandRe + '$'), '' }
    if ($core -match ('^' + $brandRe + '(\s*\||$)')) { $core = '' }
    $core = $core.Trim()
    if ($FIXED.ContainsKey($rel)) { $core = $FIXED[$rel] }
    $isHome = $rel -eq 'index.html'
    $title = if ($isHome -or -not $core) { "$Brand · $BrandEn | $Tagline" } else { "$core | $Brand" }
    $lead = @(
      (Grab $main '(?s)<p class="sub-lead">(.*?)</p>'),
      (Grab $main '(?s)<p class="country-sub">(.*?)</p>'),
      (Grab $main '(?s)<p class="hub-intro">(.*?)</p>'),
      (Grab $main '(?s)<section class="page-head[^"]*">.*?<h1[^>]*>.*?</h1>\s*<p>(.*?)</p>'),
      (Grab $main '(?s)<div class="hero-copy[^"]*">.*?<p>(.*?)</p>'),
      ([regex]::Matches((Grab $main '(?s)<article class="sub-article">(.*)</article>'), '(?s)<p[^>]*>(.*?)</p>') | ForEach-Object { Strip $_.Groups[1].Value } | Where-Object { $_.Length -gt 40 } | Select-Object -First 1)
    ) | ForEach-Object { Strip $_ } | Where-Object { $_ } | Select-Object -First 2
    $lead = @($lead) | ForEach-Object { Cut $_ 110 }
    $heads = [regex]::Matches($main, '(?s)<h2[^>]*>(.*?)</h2>') | ForEach-Object { Strip $_.Groups[1].Value } | Where-Object { $_ -and $_.Length -lt 40 } | Select-Object -First 6
    $desc = (@($lead) -join ' ')
    if ($heads) { $desc = ($desc + ' 주요 내용: ' + (@($heads) -join ', ') + '.').Trim() }
    if ($isHome) { $desc = '동유럽 20개국(폴란드·체코·헝가리·발트 3국·발칸 등)의 국가 정보, 여행·음식·언어·문화·산업 가이드, 매일 업데이트되는 동유럽 뉴스와 취업·인턴 정보를 한국어로 정리했습니다.' }
    if (-not $desc) { $desc = $Tagline }
    $desc = Cut $desc 158

    # 미리보기 이미지: 본문 첫 사진(국기·로고 제외), 없으면 사이트 대표 이미지
    $img = $Base + 'assets/images/og-image.jpg'
    $first = [regex]::Matches($main, '<img[^>]+src="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -notmatch '/(flags|kuera)/|^data:|^https?:' } | Select-Object -First 1
    if ($first) { $img = $Base + (($first -replace '^(\.\./)+', '') -replace '^\./', '') }

    $ld = if ($isHome) {
      '{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"' + $Brand + '","alternateName":["' + $BrandEn + '","' + $Tagline + '"],"url":"' + $Base + '","inLanguage":"ko","publisher":{"@id":"' + $Base + '#org"}},{"@type":"Organization","@id":"' + $Base + '#org","name":"KUERA","alternateName":["고려대학교 동유럽지역 전략학회","Korea University Eastern Europe Research Association"],"url":"' + $Base + 'about/","logo":"' + $Base + 'assets/images/kuera/kuera-badge.png"}]}'
    } else {
      $crumbs = [regex]::Matches((Grab $main '(?s)<nav class="crumbs"[^>]*>(.*?)</nav>'), '(?s)<a href="([^"]+)"[^>]*>(.*?)</a>')
      $items = @(); $pos = 1
      foreach ($c in $crumbs) { $h = $c.Groups[1].Value -replace '^(\.\./)+', '' -replace 'index\.html$', ''; $items += '{"@type":"ListItem","position":' + $pos + ',"name":"' + (Strip $c.Groups[2].Value) + '","item":"' + $Base + $h + '"}'; $pos++ }
      $items += '{"@type":"ListItem","position":' + $pos + ',"name":"' + ($core -replace '"', '') + '","item":"' + $url + '"}'
      '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[' + ($items -join ',') + ']}'
    }

    $robots = if ($isRedirect) { "`n<meta name=`"robots`" content=`"noindex, follow`">" } else { '' }
    $canon = if ($isRedirect) { $Base + 'news/' } else { $url }
    $seo = @"
<!--seo--><meta name="description" content="$(Attr $desc)">$robots
<link rel="canonical" href="$canon">
<meta property="og:type" content="$(if ($isHome) { 'website' } else { 'article' })">
<meta property="og:site_name" content="$(Attr "$Brand · $BrandEn")">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="$(Attr $title)">
<meta property="og:description" content="$(Attr $desc)">
<meta property="og:url" content="$canon">
<meta property="og:image" content="$img">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">$ld</script><!--/seo-->
"@

    # 파일에 반영 (여러 번 돌려도 같은 결과)
    $out = $src
    $out = [regex]::Replace($out, '(?s)<title>.*?</title>', '<title>' + (Attr $title) + '</title>')
    $out = [regex]::Replace($out, '(?s)<!--seo-->.*?<!--/seo-->\r?\n?', '')
    $out = [regex]::Replace($out, '<meta name="description"[^>]*>\r?\n?', '')
    $out = $out -replace '(<title>[^<]*</title>\r?\n)', ('$1' + $seo.Replace('$', '$$') + "`n")
    if (-not $isRedirect) {
      $out = [regex]::Replace($out, '(?s)<div id="site-header">.*?</div>(?=\s*<main)', { param($m) '<div id="site-header"><!--pr-->' + $hdr + '<!--/pr--></div>' })
      $out = [regex]::Replace($out, '(?s)(<main id="main"[^>]*>)(<noscript>.*?</noscript>).*?</main>', { param($m) $m.Groups[1].Value + $m.Groups[2].Value + '<!--pr-->' + (CleanBody $main) + '<!--/pr--></main>' })
      $out = [regex]::Replace($out, '(?s)<div id="site-footer">.*?</div>(?=\s*<script)', { param($m) '<div id="site-footer"><!--pr-->' + $ftr + '<!--/pr--></div>' })
      $sitemap.Add("  <url><loc>$url</loc><lastmod>$today</lastmod></url>")
    }
    if ($out -ne $src) { [IO.File]::WriteAllText($path, $out, $utf8) }
    Write-Output ("[{0}/{1}] {2}  ·  {3}" -f $n, $pages.Count, $rel, $title)
  }
} finally {
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  Remove-Item $tmp, "$tmp.err" -ErrorAction SilentlyContinue
}

if ($Only) { Write-Output "시험 실행: $($pages.Count)쪽만 처리했습니다."; return }
# --- sitemap.xml / robots.txt / llms.txt ---
$xml = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n<urlset xmlns=`"http://www.sitemaps.org/schemas/sitemap/0.9`">`n" + ($sitemap -join "`n") + "`n</urlset>`n"
[IO.File]::WriteAllText((Join-Path $root 'sitemap.xml'), $xml, $utf8)
$robotsTxt = @"
# 검색엔진과 AI 검색 수집기 모두 허용
User-agent: *
Allow: /

Sitemap: ${Base}sitemap.xml
"@
[IO.File]::WriteAllText((Join-Path $root 'robots.txt'), $robotsTxt, $utf8)

$cdata = [IO.File]::ReadAllText((Join-Path $root 'assets/js/data-countries.js'), $utf8)
$countryLines = [regex]::Matches($cdata, '"slug":\s*"([^"]+)"[^{}]*?"name_ko":\s*"([^"]+)"') | ForEach-Object { "- [$($_.Groups[2].Value)](${Base}countries/$($_.Groups[1].Value)/): 개요·여행·음식·언어·문화·산업" } | Select-Object -Unique
$llms = @"
# $Brand ($BrandEn)
> $Tagline. 고려대학교 동유럽지역 전략학회(KUERA)가 만들고 관리하는 한국어 사이트입니다. 동유럽 20개국의 국가 정보와 매일 업데이트되는 뉴스, 최근 5년 주요 이슈, 취업·인턴 정보를 다룹니다. 모든 항목에 원문 출처 링크를 함께 적습니다.

## 주요 페이지
- [홈]($Base): 동유럽 지도와 오늘의 뉴스
- [국가 목록](${Base}countries/): 20개국을 권역별(비셰그라드·발트·서발칸·남발칸·동부권)로 정리
- [뉴스](${Base}news/): 데일리 뉴스(매일 저녁 갱신)와 주요 뉴스(분야·국가별 아카이브)
- [취업·인턴](${Base}jobs/): 동유럽 근무·동유럽 관련 채용 공고(매주 확인)
- [소개](${Base}about/): KUERA 소개와 자료 원칙

## 국가별 페이지
$($countryLines -join "`n")
"@
[IO.File]::WriteAllText((Join-Path $root 'llms.txt'), $llms, $utf8)
Write-Output "완료: 페이지 $($sitemap.Count)개 사이트맵, robots.txt, llms.txt"
