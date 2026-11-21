# 여행 루트 대표 사진 수집: 도시마다 Wikimedia Commons에서 자유 라이선스 사진을 찾아 내려받는다.
#   - 1순위 "Quality images" 분류, 없으면 "Valued images", 그다음 일반 검색
#   - 가로 사진(가로 ≥ 세로×1.25)만, 지도·깃발·문장·로고 제외, 도시당 최대 3장
#   - assets/images/trip/<도시>-<n>.jpg (가로 500px) 와 assets/js/data-trip-webphotos.js(저작자·라이선스·원본 링크) 생성
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File _tools/fetch-trip-photos.ps1 [-Only prague,krakow] [-Force]
# (UTF-8 BOM으로 저장)
param([string]$Only = '', [switch]$Force)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding($false)
$data = [IO.File]::ReadAllText("$root\assets\js\data-trip.js", [Text.Encoding]::UTF8)
$outDir = "$root\assets\images\trip"; New-Item -ItemType Directory -Force $outDir | Out-Null
$ua = @{ 'User-Agent' = 'travel-route-site-photo-fetch/1.0 (static site build script)' }

# 검색어가 모호한 도시는 직접 지정
$override = @{
  'tatras' = 'High Tatras'; 'balaton' = 'Lake Balaton'; 'tara' = 'Tara National Park Serbia'; 'nis' = 'Niš fortress'; 'zabljak' = 'Durmitor';
  'maramures' = 'Maramureș wooden church'; 'bucovina' = 'Voroneț Monastery'; 'tulcea' = 'Danube Delta'; 'plitvice' = 'Plitvice Lakes';
  'kuressaare' = 'Kuressaare'; 'bovec' = 'Soča river'; 'heviz' = 'Hévíz lake'; 'hvar' = 'Hvar town'; 'korcula' = 'Korčula town';
  'piran' = 'Piran'; 'budva' = 'Budva'; 'theth' = 'Theth'; 'valbona' = 'Valbona valley'; 'himare' = 'Himarë'; 'vlore' = 'Vlorë';
  'sarande' = 'Sarandë Albania'; 'zlatibor' = 'Zlatibor'; 'kotor' = 'Kotor'; 'tokaj' = 'Tokaj'; 'eger' = 'Eger Hungary'; 'bled' = 'Lake Bled';
  'bohinj' = 'Lake Bohinj'; 'karlovy-vary' = 'Karlovy Vary'; 'cesky-krumlov' = 'Český Krumlov'; 'banska-stiavnica' = 'Banská Štiavnica';
  'veliko-tarnovo' = 'Veliko Tarnovo'; 'novi-sad' = 'Novi Sad'; 'podgorica' = 'Podgorica'; 'kosice' = 'Košice'; 'parnu' = 'Pärnu';
  'kuldiga' = 'Kuldīga'; 'liepaja' = 'Liepāja'; 'klaipeda' = 'Klaipėda'; 'gjirokaster' = 'Gjirokastër'; 'shkoder' = 'Shkodër'; 'zamosc' = 'Zamość';
  'poznan' = 'Poznań'; 'torun' = 'Toruń'; 'wroclaw' = 'Wrocław'; 'krakow' = 'Kraków'; 'gdansk' = 'Gdańsk'; 'brasov' = 'Brașov';
  'sighisoara' = 'Sighișoara'; 'cluj' = 'Cluj-Napoca'; 'bucharest' = 'Bucharest'; 'hallstatt' = 'Hallstatt'; 'corfu' = 'Corfu town'
}
$cities = [regex]::Matches($data, "(?m)^\s{4}'?([a-z-]+)'?: \{ ko: '[^']+', en: '([^']+)'") | ForEach-Object { [pscustomobject]@{ id = $_.Groups[1].Value; en = $_.Groups[2].Value } }
if ($Only) { $want = $Only.Split(','); $cities = $cities | Where-Object { $want -contains $_.id } }

$jsPath = "$root\assets\js\data-trip-webphotos.js"
$result = [ordered]@{}
if (Test-Path $jsPath) {  # 기존 결과는 항상 유지하고, 고른 도시만 다시 받는다
  $old = [IO.File]::ReadAllText($jsPath, [Text.Encoding]::UTF8)
  $j = $old.Substring($old.IndexOf('{')).TrimEnd().TrimEnd(';')
  ($j | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $result[$_.Name] = @($_.Value) }
}
function StripHtml($s) { if (-not $s) { return '' }; $t = [regex]::Replace($s, '<[^>]+>', ''); $t = [Net.WebUtility]::HtmlDecode($t).Trim(); if ($t.Length -gt 60) { $t = $t.Substring(0, 57) + '…' }; $t }
function Search($q) {
  $u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=25&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=500&iiextmetadatafilter=Artist|LicenseShortName|ImageDescription&gsrsearch=' + [uri]::EscapeDataString($q)
  $r = Invoke-RestMethod -Uri $u -Headers $ua -TimeoutSec 40
  if (-not $r.query) { return @() }
  $r.query.pages.PSObject.Properties.Value | Sort-Object index | ForEach-Object {
    $ii = $_.imageinfo[0]
    [pscustomobject]@{ title = $_.title; w = $ii.width; h = $ii.height; thumb = $ii.thumburl; page = $ii.descriptionurl
      artist = StripHtml $ii.extmetadata.Artist.value; lic = $ii.extmetadata.LicenseShortName.value }
  }
}
# 대표 사진으로 어울리지 않는 것(실내·천장·교통수단·행사·스포츠·묘지·동물 표본 등)은 뺀다
$bad = 'map|flag|coat of arms|logo|diagram|plan\b|stamp|coin|banknote|poster|portrait|interior|ceiling|altar|detail|usazen|tram|tatra kt|railway station|train station|hauptbahnhof|bus station|rally|protest|demonstration|grave|cemetery|tomb of|street sign|\bfc\b|stadium|football|mhnt|gymnocephalus|cuculus|clanga|aupark|padlock|\.svg|\.tif'
# 사진 제목에 이 말이 있어야 그 도시 사진으로 인정한다(악센트 무시). 기본값은 검색어의 첫 단어.
$need = @{
  'bovec' = 'soca|trenta|bovec|kobarid'; 'tulcea' = 'danube|delta|pelican|tulcea|heron'; 'tatras' = 'tatr'; 'zabljak' = 'durmitor|zabljak|crno';
  'maramures' = 'maramure|wooden church|breb|sapanta|biserica'; 'bucovina' = 'voronet|sucevita|moldovita|humor'; 'balaton' = 'balaton';
  'plitvice' = 'plitvic'; 'tara' = 'tara|drina|perucac|mokra'; 'nis' = '\bnis\b|nish'; 'sarande' = 'sarand'; 'vlore' = 'vlor|vlora';
  'himare' = 'himar|dhermi|livadh'; 'burgas' = '\bburgas\b'; 'novi-sad' = 'petrovaradin|novi sad danube|novi sad, serbia|novi sad old'; 'klaipeda' = 'klaip';
  'liepaja' = 'liepaj'; 'parnu' = 'parnu'; 'nessebar' = 'nesse|nesebar'; 'bucharest' = 'bucharest|bucuresti|athenaeum|parliament'; 'heviz' = 'heviz'
}
$landmarks = @{
  'brno' = @('Špilberk Castle', 'Cathedral of St. Peter and Paul Brno', 'Náměstí Svobody Brno');
  'eger' = @('Eger Castle', 'Eger Minaret', 'Basilica of Eger');
  'burgas' = @('Burgas Sea Garden', 'Burgas beach', 'Cathedral Saints Cyril and Methodius Burgas');
  'bucharest' = @('Romanian Athenaeum', 'Palace of the Parliament Bucharest', 'Stavropoleos Monastery');
  'krakow' = @('Wawel', 'Sukiennice', 'Kraków Rynek');
  'liepaja' = @('Liepāja beach', 'Karosta Naval Cathedral', 'Holy Trinity Cathedral Liepāja');
  'wroclaw' = @('Wrocław Market Square', 'Ostrów Tumski Wrocław', 'Old Town Hall Wrocław');
  'kosice' = @('St. Elisabeth Cathedral Košice', 'Hlavná ulica Košice', 'State Theatre Košice');
  'sofia' = @('Alexander Nevsky Cathedral Sofia', 'Boyana Church', 'Vitosha Boulevard');
  'ljubljana' = @('Ljubljana Castle', 'Triple Bridge Ljubljana', 'Ljubljanica river Ljubljana');
  'trieste' = @('Piazza Unità d''Italia Trieste', 'Miramare Castle', 'Canal Grande Trieste');
  'nessebar' = @('Nessebar old town', 'Christ Pantocrator Nessebar', 'Nessebar windmill');
  'novi-sad' = @('Petrovaradin Fortress', 'Freedom Square Novi Sad', 'Name of Mary Church Novi Sad');
  'brasov' = @('Black Church Brașov', 'Council Square Brașov', 'Brașov Tâmpa');
  'kuldiga' = @('Venta Rapid', 'Kuldīga old town', 'Alekšupīte Kuldīga')
}
# 명소 검색 결과 제목에 있어야 할 말(악센트 무시)
$lmNeed = @{}
foreach ($k in $landmarks.Keys) { foreach ($lm in $landmarks[$k]) { $lmNeed[$lm] = 'x' } }
$lmNeed['Špilberk Castle'] = 'spilberk'; $lmNeed['Cathedral of St. Peter and Paul Brno'] = 'petrov|peter and paul'; $lmNeed['Náměstí Svobody Brno'] = 'namesti svobody|freedom square'
$lmNeed['Eger Castle'] = 'eger'; $lmNeed['Eger Minaret'] = 'minaret'; $lmNeed['Basilica of Eger'] = 'eger'
$lmNeed['Burgas Sea Garden'] = 'burgas'; $lmNeed['Burgas beach'] = 'burgas'; $lmNeed['Cathedral Saints Cyril and Methodius Burgas'] = 'burgas'
$lmNeed['Romanian Athenaeum'] = 'athenaeum|ateneul'; $lmNeed['Palace of the Parliament Bucharest'] = 'parliament|palatul'; $lmNeed['Stavropoleos Monastery'] = 'stavropoleos'
$lmNeed['Wawel'] = 'wawel'; $lmNeed['Sukiennice'] = 'sukiennice|cloth hall'; $lmNeed['Kraków Rynek'] = 'rynek|market square'
$lmNeed['Liepāja beach'] = 'liepaj'; $lmNeed['Karosta Naval Cathedral'] = 'karosta'; $lmNeed['Holy Trinity Cathedral Liepāja'] = 'liepaj'
$lmNeed['Wrocław Market Square'] = 'wroclaw|rynek'; $lmNeed['Ostrów Tumski Wrocław'] = 'ostrow tumski'; $lmNeed['Old Town Hall Wrocław'] = 'town hall|ratusz'
$lmNeed['St. Elisabeth Cathedral Košice'] = 'elisabeth|alzbet'; $lmNeed['Hlavná ulica Košice'] = 'hlavna|kosice'; $lmNeed['State Theatre Košice'] = 'theatre|divadlo'
$lmNeed['Alexander Nevsky Cathedral Sofia'] = 'nevsky'; $lmNeed['Boyana Church'] = 'boyana'; $lmNeed['Vitosha Boulevard'] = 'vitosha'
$lmNeed['Ljubljana Castle'] = 'ljubljana castle|ljubljanski grad'; $lmNeed['Triple Bridge Ljubljana'] = 'triple bridge|tromostovje'; $lmNeed['Ljubljanica river Ljubljana'] = 'ljubljanica'
$lmNeed['Piazza Unità d''Italia Trieste'] = 'unita'; $lmNeed['Miramare Castle'] = 'miramare'; $lmNeed['Canal Grande Trieste'] = 'canal grande.*trieste|trieste.*canal'
$lmNeed['Nessebar old town'] = 'nese|nesse'; $lmNeed['Christ Pantocrator Nessebar'] = 'pantocrator'; $lmNeed['Nessebar windmill'] = 'windmill'
$lmNeed['Petrovaradin Fortress'] = 'petrovaradin'; $lmNeed['Freedom Square Novi Sad'] = 'novi sad'; $lmNeed['Name of Mary Church Novi Sad'] = 'novi sad'
$lmNeed['Black Church Brașov'] = 'black church|biserica neagra'; $lmNeed['Council Square Brașov'] = 'council square|piata sfatului'; $lmNeed['Brașov Tâmpa'] = 'brasov'
$lmNeed['Venta Rapid'] = 'venta'; $lmNeed['Kuldīga old town'] = 'kuldiga'; $lmNeed['Alekšupīte Kuldīga'] = 'aleksupite|kuldiga'
function Norm($s) { ([string]$s).Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '' -replace 'ł', 'l' -replace 'Ł', 'L' | ForEach-Object { $_.ToLower() } }
foreach ($c in $cities) {
  if ($result.Contains($c.id) -and -not $Force -and $result[$c.id].Count -ge 2) { continue }
  $term = if ($override[$c.id]) { $override[$c.id] } else { $c.en }
  $needRx = if ($need[$c.id]) { $need[$c.id] } else { [regex]::Escape((Norm (($term -split '[ ,]')[0]))) }
  $picked = @()
  # 도시 이름 검색이 엉뚱한 사진을 내는 곳은 대표 명소 이름으로 한 장씩 찾는다
  if ($landmarks[$c.id]) {
    foreach ($lm in $landmarks[$c.id]) {
      foreach ($q in @("$lm incategory:Quality_images filetype:bitmap", "$lm incategory:Valued_images filetype:bitmap", "$lm filetype:bitmap")) {
        try { $hits = Search $q } catch { Start-Sleep 3; continue }
        $h = $hits | Where-Object { $_.thumb -and $_.w -ge $_.h * 1.25 -and $_.w -ge 1200 -and (Norm $_.title) -notmatch $bad -and (Norm $_.title) -match $lmNeed[$lm] -and $_.lic -and $_.lic -notmatch 'fair use|copyrighted|non-free' } | Where-Object { $t = $_.title; -not ($picked | Where-Object { $_.title -eq $t }) } | Select-Object -First 1
        Start-Sleep -Milliseconds 400
        if ($h) { $picked += $h; break }
      }
    }
  }
  foreach ($q in @("$term incategory:Quality_images filetype:bitmap", "$term incategory:Valued_images filetype:bitmap", "intitle:`"$term`" filetype:bitmap")) {
    if ($landmarks[$c.id]) { break }
    if ($picked.Count -ge 3) { break }
    try { $hits = Search $q } catch { Write-Output "WARN search failed $($c.id): $($_.Exception.Message)"; Start-Sleep 2; continue }
    foreach ($h in $hits) {
      if ($picked.Count -ge 3) { break }
      if (-not $h.thumb -or $h.w -lt $h.h * 1.25 -or $h.w -lt 1200) { continue }
      if ((Norm $h.title) -match $bad) { continue }
      if ((Norm $h.title) -notmatch $needRx) { continue }
      if (-not $h.lic -or $h.lic -match 'fair use|copyrighted|non-free') { continue }
      if ($picked | Where-Object { $_.title -eq $h.title }) { continue }
      $picked += $h
    }
    Start-Sleep -Milliseconds 400
  }
  $list = @(); $i = 0
  foreach ($p in $picked) {
    $i++; $file = "$($c.id)-$i.jpg"
    try { Invoke-WebRequest -Uri $p.thumb -Headers $ua -OutFile "$outDir\$file" -TimeoutSec 60 -UseBasicParsing } catch { Write-Output "WARN download $file"; continue }
    $alt = ($p.title -replace '^File:', '' -replace '\.[a-zA-Z]+$', '' -replace '_', ' ')
    $list += ,@("assets/images/trip/$file", $(if ($p.artist) { $p.artist } else { 'Wikimedia Commons' }), $p.lic, $p.page, $alt)
    Start-Sleep -Milliseconds 300
  }
  $result[$c.id] = $list
  Write-Output ("{0,-18} {1} photos  ({2})" -f $c.id, $list.Count, $term)
}
$json = ($result | ConvertTo-Json -Depth 5 -Compress)
$json = [regex]::Replace($json, '\\u([0-9a-fA-F]{4})', { param($x) [string][char][Convert]::ToInt32($x.Groups[1].Value, 16) })
$head = "/* fetch-trip-photos.ps1이 만든 파일. 도시별 Wikimedia Commons 자유 라이선스 사진. 값 = [경로, 저작자, 라이선스, 원본, 설명] */`n"
[IO.File]::WriteAllText($jsPath, $head + "window.TRIP_WEBPHOTOS = $json;`n", $utf8)
"cities: $($result.Count) | photos: $(($result.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum)"
