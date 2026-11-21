# 계절 사진 수집: 겨울에 추천하는 루트의 도시마다 크리스마스 마켓·눈 내린 풍경 사진을 Wikimedia Commons에서 찾는다.
#   - 자유 라이선스만, 가로 사진(가로 ≥ 세로×1.2, 원본 가로 ≥ 1200px)
#   - 제목에 도시 이름과 크리스마스/겨울을 뜻하는 말(여러 언어)이 함께 있어야 인정
#   - assets/images/trip/season/<도시>-x<n>.jpg(크리스마스), -s<n>.jpg(눈·겨울), 가로 1280px
#   - assets/js/data-trip-season.js : { 도시: [[경로, 저작자, 라이선스, 원본, 설명, 'xmas'|'snow'], ...] }
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File _tools/fetch-trip-season.ps1 [-Only prague,vienna]
#   검수에서 뺀 사진(원본 제목)은 아래 $dropped 에 적어 두면 다시 고르지 않는다.
# (UTF-8 BOM으로 저장)
param([string]$Only = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding($false)
$outDir = "$root\assets\images\trip\season"; New-Item -ItemType Directory -Force $outDir | Out-Null
$ua = @{ 'User-Agent' = 'travel-route-site-photo-fetch/1.0 (static site build script)' }

# 도시 id = [검색 이름, 제목에 있어야 할 말(악센트 무시)]
$cities = [ordered]@{
  'prague' = @('Prague', 'prague|praha|prag\b'); 'krakow' = @('Kraków', 'krakow|cracow'); 'budapest' = @('Budapest', 'budapest');
  'tallinn' = @('Tallinn', 'tallinn'); 'vienna' = @('Vienna', 'vienna|wien'); 'wroclaw' = @('Wrocław', 'wroclaw|breslau');
  'riga' = @('Riga', '\briga\b|\brigas\b'); 'warsaw' = @('Warsaw', 'warsaw|warszaw'); 'zakopane' = @('Zakopane', 'zakopane|gubalowka|tatr');
  'vilnius' = @('Vilnius', 'vilnius|vilniaus'); 'ljubljana' = @('Ljubljana', 'ljubljan'); 'zagreb' = @('Zagreb', 'zagreb');
  'brasov' = @('Brașov', 'brasov'); 'sofia' = @('Sofia Bulgaria', '\bsofia\b|sofiya'); 'bansko' = @('Bansko', 'bansko|pirin');
  'brno' = @('Brno', '\bbrno\b'); 'bratislava' = @('Bratislava', 'bratislav'); 'helsinki' = @('Helsinki', 'helsinki|helsingin');
  'bled' = @('Bled', '\bbled\b'); 'bucharest' = @('Bucharest', 'bucharest|bucuresti'); 'sighisoara' = @('Sighișoara', 'sighisoara');
  'graz' = @('Graz', '\bgraz\b'); 'cesky-krumlov' = @('Český Krumlov', 'krumlov'); 'dresden' = @('Dresden', 'dresden|striezelmarkt');
  'plitvice' = @('Plitvice', 'plitvic'); 'sibiu' = @('Sibiu', 'sibiu')
}
$xmasRx = 'christmas|xmas|advent|weihnacht|christkind|striezel|vanoc|karacsony|jarmark|bozonarodzen|joulu|kaled|ziemassvetk|bozic|craciun|vianoc|navidad|noel|kerst'
$snowRx = 'snow|winter|zima|zimi|\btel\b|teli|schnee|talv|ziem|iarna|sneh|snijeg|sneg|havas|lumi|frost|frozen|ice\b'
$bad = 'map|flag|logo|poster|portrait|interior|inside|ceiling|altar|\bfc\b|stadium|football|hockey|ski jump|\.svg|\.tif|tram|bus\b|train|car\b|traffic|parking|sale|stall [0-9]|food|mulled|gingerbread|cookie|bauble|ornament|decoration|crib|nativity|santa|zoo|sciurus|loxodonta|bison|animal|bird|trophy|race|smog|arena|locomotive|museum|snow ?church|our lady of the snow|painting|friedrich|station|tree lot|rain|construction|rebuilding|\d+ in |\b\d{1,3}[a-z]?, |platz \d|street \d'
# 도시 이름 검색이 엉뚱한 사진을 내는 곳은 명소 이름으로 찾는다. 항목 = "검색어||제목에 있어야 할 말"
$snowQ = @{
  'prague' = @('Charles Bridge snow||charles bridge|karluv most', 'Prague Castle winter||prague|hradcan', 'Old Town Square Prague snow||prague|praha')
  'krakow' = @('Wawel snow||wawel', 'Kraków Main Market Square winter||krakow|rynek')
  'budapest' = @('Hungarian Parliament snow||parliament|orszaghaz', 'Fisherman''s Bastion snow||bastion|halaszbastya', 'Chain Bridge Budapest winter||chain bridge|lanchid')
  'tallinn' = @('Tallinn Old Town winter||tallinn', 'Toompea snow||toompea|tallinn')
  'vienna' = @('Schönbrunn snow||schonbrunn', 'Belvedere Vienna winter||belvedere', 'Stephansdom Schnee||stephansdom|stephan')
  'riga' = @('Riga Old Town winter||riga', 'Riga Cathedral snow||riga')
  'warsaw' = @('Warsaw Old Town winter||warsaw|warszaw|stare miasto', 'Castle Square Warsaw snow||warsaw|warszaw|plac zamkowy')
  'zakopane' = @('Zakopane winter||zakopane', 'Gubałówka snow||gubalowka', 'Morskie Oko winter||morskie oko')
  'zagreb' = @('Zagreb Cathedral snow||zagreb', 'Zagreb Upper Town winter||zagreb|gornji grad')
  'brasov' = @('Brașov winter||brasov', 'Black Church Brașov snow||black church|biserica neagra|brasov')
  'bansko' = @('Bansko ski resort||bansko', 'Pirin winter||pirin')
  'brno' = @('Špilberk snow||spilberk', 'Brno winter||brno')
  'helsinki' = @('Helsinki Cathedral snow||helsinki|tuomiokirkko', 'Senate Square Helsinki winter||helsinki|senate')
  'sighisoara' = @('Sighișoara winter||sighisoara', 'Sighișoara snow||sighisoara')
  'graz' = @('Graz Schlossberg snow||graz|schlossberg', 'Graz winter||graz')
  'cesky-krumlov' = @('Český Krumlov winter||krumlov', 'Krumlov snow||krumlov')
  'dresden' = @('Frauenkirche Dresden snow||frauenkirche|dresden', 'Zwinger winter||zwinger', 'Dresden Altstadt Schnee||dresden')
  'sibiu' = @('Sibiu snow||sibiu|hermannstadt', 'Sibiu Large Square winter||sibiu|piata mare')
}
$xmasQ = @{
  'warsaw' = @('Warsaw Old Town Christmas||warsaw|warszaw', 'Warsaw Christmas lights||warsaw|warszaw', 'Warsaw Christmas market||warsaw|warszaw')
  'zakopane' = @('Zakopane Christmas||zakopane')
  'brasov' = @('Brașov Christmas market||brasov', 'Brașov Christmas||brasov')
  'graz' = @('Graz Christmas market||graz', 'Graz Advent||graz', 'Grazer Christkindlmarkt||graz')
  'cesky-krumlov' = @('Český Krumlov Christmas||krumlov', 'Krumlov advent||krumlov')
  'vilnius' = @('Vilnius Christmas tree||vilnius|vilniaus', 'Vilnius Christmas||vilnius')
  'sighisoara' = @('Sighișoara Christmas||sighisoara')
}
# 검수에서 빼기로 한 사진(원본 제목). 다시 받을 때 고르지 않는다.
$dropped = @('File:Prague_winter_smog_-_panoramio.jpg', 'File:Prague_in_winter,_c1927.jpg', 'File:Snow-covered_Tartu_mnt_in_Tallinn_28_February_2010.jpg', 'File:Snow-covered_Sidewalk_Tartu_mnt_Tallinn_28_February_2010.jpg', 'File:Tab%C3%A1n,_Erzs%C3%A9bet_kir%C3%A1lyn%C3%A9_(Zala_Gy%C3%B6rgy),_2026_Snowy_Budapest_(22).jpg', 'File:Songs_of_the_season-_Dogface_Soldiers_Perform_at_Krakow_Christmas_Market_(8158298).jpg', 'File:Homeless_Jesus_sculpture_covered_in_snow_Warsaw.jpg', 'File:Christmas_night_lights_in_Bled_(8314422551).jpg', 'File:Christmas_night_lights_in_Bled_(8315468786).jpg', 'File:First_snow_in_September_2015_Bled,_Slovenija_-_panoramio.jpg', 'File:Bosquito_at_Bucharest_Christmas_Market_2025.jpg', 'File:Bucharest_Christmas_Market_2014_-_08_(16015890571).jpg', 'File:Snow_in_Bucharest_(2164798799).jpg', 'File:Einweihung_Advent_in_Graz_2023.jpg', 'File:Einweihung_Advent_in_Graz_2023.2.jpg', 'File:Dresden,_Striezelmarkt_--_2023_--_9361.jpg', 'File:Rotary_snow_plough_Sibiu_2018.jpg', 'File:Christmas_night_lights_in_Bled_(8315470918).jpg')

function Norm($s) { ([string]$s).Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '' -replace 'ł', 'l' -replace 'Ł', 'L' | ForEach-Object { $_.ToLower() } }
function StripHtml($s) { if (-not $s) { return '' }; $t = [regex]::Replace($s, '<[^>]+>', ''); $t = [Net.WebUtility]::HtmlDecode($t).Trim(); if ($t.Length -gt 60) { $t = $t.Substring(0, 57) + '…' }; $t }
function Search($q) {
  $u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=40&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1280&iiextmetadatafilter=Artist|LicenseShortName&gsrsearch=' + [uri]::EscapeDataString($q)
  $r = Invoke-RestMethod -Uri $u -Headers $ua -TimeoutSec 40
  if (-not $r.query) { return @() }
  $r.query.pages.PSObject.Properties.Value | Sort-Object index | ForEach-Object {
    $ii = $_.imageinfo[0]
    [pscustomobject]@{ title = $_.title; w = $ii.width; h = $ii.height; thumb = $ii.thumburl; page = $ii.descriptionurl; artist = StripHtml $ii.extmetadata.Artist.value; lic = $ii.extmetadata.LicenseShortName.value }
  }
}
function Pick($id, $name, $cityRx, $kindRx, $queries, $max) {
  $picked = @()
  foreach ($q in $queries) {
    if ($picked.Count -ge $max) { break }
    $query, $need = $q -split '\|\|'; if (-not $need) { $need = $cityRx }
    $hits = $null
    foreach ($try in 1..3) { try { $hits = Search "$query filetype:bitmap"; break } catch { Write-Host "WARN search $id ($try): $($_.Exception.Message)"; Start-Sleep 12 } }
    foreach ($h in @($hits)) {
      if (-not $h -or $picked.Count -ge $max) { break }
      $t = Norm $h.title
      if (-not $h.thumb -or $h.w -lt $h.h * 1.2 -or $h.w -lt 1200) { continue }
      if ($t -match $bad -or $t -notmatch $need -or $t -notmatch $kindRx) { continue }
      if (-not $h.lic -or $h.lic -match 'fair use|copyrighted|non-free') { continue }
      if ($dropped -contains ($h.page -replace '^.*/wiki/', '') -or $dropped -contains $h.title -or ($picked | Where-Object { $_.title -eq $h.title })) { continue }
      $picked += $h
    }
    Start-Sleep -Milliseconds 1500
  }
  ,@($picked | Where-Object { $_ -and $_.thumb })
}

$jsPath = "$root\assets\js\data-trip-season.js"
$result = [ordered]@{}
if (Test-Path $jsPath) {
  $old = [IO.File]::ReadAllText($jsPath, [Text.Encoding]::UTF8)
  ($old.Substring($old.IndexOf('{')).TrimEnd().TrimEnd(';') | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $result[$_.Name] = @($_.Value) }
}
$ids = if ($Only) { $Only.Split(',') } else { @($cities.Keys) }
foreach ($id in $ids) {
  $name, $cityRx = $cities[$id]
  $xq = @("$name Christmas market incategory:Quality_images", "$name Christmas market", "$name Christmas", "$name advent"); if ($xmasQ[$id]) { $xq = @($xmasQ[$id]) + $xq }
  $sq = @("$name winter snow incategory:Quality_images", "$name snow", "$name winter"); if ($snowQ[$id]) { $sq = @($snowQ[$id]) + $sq }
  $x = Pick $id $name $cityRx $xmasRx $xq 2
  $s = Pick $id $name $cityRx $snowRx $sq 2
  $list = @(); $i = 0
  foreach ($p in @(@($x) | ForEach-Object { ,@($_, 'xmas') }) + @(@($s) | ForEach-Object { ,@($_, 'snow') })) {
    $h, $kind = $p; $i++
    $file = "$id-$($kind.Substring(0,1))$i.jpg"
    try { Invoke-WebRequest -Uri $h.thumb -Headers $ua -OutFile "$outDir\$file" -TimeoutSec 60 -UseBasicParsing } catch { Write-Output "WARN download $file"; continue }
    $alt = ($h.title -replace '^File:', '' -replace '\.[a-zA-Z]+$', '' -replace '_', ' ')
    $list += ,@("assets/images/trip/season/$file", $(if ($h.artist) { $h.artist } else { 'Wikimedia Commons' }), $h.lic, $h.page, $alt, $kind)
    Start-Sleep -Milliseconds 300
  }
  $result[$id] = $list
  Write-Output ("{0,-14} xmas {1} · snow {2}" -f $id, @($x).Count, @($s).Count)
}
$json = ($result | ConvertTo-Json -Depth 5 -Compress)
$json = [regex]::Replace($json, '\\u([0-9a-fA-F]{4})', { param($m) [string][char][Convert]::ToInt32($m.Groups[1].Value, 16) })
$head = "/* fetch-trip-season.ps1이 만든 파일. 겨울 추천 루트 도시의 크리스마스·눈 사진(Wikimedia Commons 자유 라이선스). 값 = [경로, 저작자, 라이선스, 원본, 설명, 종류] */`n"
[IO.File]::WriteAllText($jsPath, $head + "window.TRIP_SEASON = $json;`n", $utf8)
"cities: $($result.Count) | photos: $(($result.Values | ForEach-Object { @($_).Count } | Measure-Object -Sum).Sum)"
