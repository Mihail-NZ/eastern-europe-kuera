# 실험: 일부 루트의 대표 사진을 "3장 전환 슬라이드"로 보여 주기 위한 고화질 사진 준비.
#   루트마다 직접 고른 사진 3장(도시별 Commons 사진 경로 또는 국가 페이지 사진 키)을 적는다.
#   Commons 사진은 원본 페이지에서 가로 1280px 판을 다시 받아 assets/images/trip/hd/ 에 저장하고,
#   assets/js/data-trip-slides.js (경로·저작자·라이선스·원본·설명)를 만든다.
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File _tools/build-trip-slides.ps1   (UTF-8 BOM)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding($false)
$ua = @{ 'User-Agent' = 'travel-route-site-photo-fetch/1.0 (static site build script)' }
$slides = [ordered]@{
  'prague-vienna-budapest' = @('assets/images/trip/prague-3.jpg', 'assets/images/trip/vienna-3.jpg', 'assets/images/trip/budapest-1.jpg')
  'croatia-classic'        = @('croatia/plitvice', 'assets/images/trip/split-2.jpg', 'assets/images/trip/dubrovnik-3.jpg')
  'baltic-capitals'        = @('assets/images/trip/tallinn-2.jpg', 'assets/images/trip/riga-1.jpg', 'assets/images/trip/vilnius-1.jpg')
  'transylvania'           = @('assets/images/trip/brasov-1.jpg', 'assets/images/trip/sighisoara-1.jpg', 'romania/sibiu')
  'albania-riviera-corfu'  = @('assets/images/trip/himare-2.jpg', 'albania/p09', 'assets/images/trip/corfu-1.jpg')
}
function LoadJs($p, $var) { $t = [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8); ($t.Substring($t.IndexOf('{')).TrimEnd().TrimEnd(';') | ConvertFrom-Json) }
$web = LoadJs "$root\assets\js\data-trip-webphotos.js"
$loc = LoadJs "$root\assets\js\data-trip-photos.js"
$byPath = @{}; $web.PSObject.Properties | ForEach-Object { foreach ($p in $_.Value) { $byPath[$p[0]] = $p } }
New-Item -ItemType Directory -Force "$root\assets\images\trip\hd" | Out-Null
$out = [ordered]@{}
foreach ($rid in $slides.Keys) {
  $list = @()
  foreach ($k in $slides[$rid]) {
    if ($loc.$k) { $list += ,@($loc.$k); continue }          # 국가 페이지 사진(이미 1200px 안팎)
    $p = $byPath[$k]; if (-not $p) { throw "not found: $k" }
    $title = [uri]::UnescapeDataString(($p[3] -split '/wiki/')[1])
    $u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=1280&titles=' + [uri]::EscapeDataString($title)
    $r = Invoke-RestMethod -Uri $u -Headers $ua -TimeoutSec 40
    $thumb = ($r.query.pages.PSObject.Properties.Value | Select-Object -First 1).imageinfo[0].thumburl
    $name = [IO.Path]::GetFileName($k)
    Invoke-WebRequest -Uri $thumb -Headers $ua -OutFile "$root\assets\images\trip\hd\$name" -TimeoutSec 60 -UseBasicParsing
    $list += ,@("assets/images/trip/hd/$name", $p[1], $p[2], $p[3], $p[4])
    Start-Sleep -Milliseconds 400
  }
  $out[$rid] = $list
  "$rid : $($list.Count)"
}
$json = ($out | ConvertTo-Json -Depth 5 -Compress)
$json = [regex]::Replace($json, '\\u([0-9a-fA-F]{4})', { param($x) [string][char][Convert]::ToInt32($x.Groups[1].Value, 16) })
[IO.File]::WriteAllText("$root\assets\js\data-trip-slides.js", "/* build-trip-slides.ps1이 만든 파일(실험). 루트별 전환 슬라이드 사진 3장. */`nwindow.TRIP_SLIDES = $json;`n", $utf8)
