$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
if (!(Test-Path (Join-Path $root 'public\index.html'))) { throw 'Run this script in the GocDanSinh project root.' }
$src = Join-Path $PSScriptRoot 'gds-fixed-files'
if (!(Test-Path $src)) { throw 'Missing gds-fixed-files folder. Extract the entire ZIP first.' }
$backup = Join-Path $root ('backup-search-unified-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup | Out-Null
$names = @('gds-library.js','gds-live.js','gds-home-search.js','index.html','phap-luat-quyen-loi.html','thu-tuc-hanh-chinh.html')
foreach ($name in $names) {
  if ($name.EndsWith('.js')) { $target = Join-Path $root ('public\js\' + $name) } else { $target = Join-Path $root ('public\' + $name) }
  if (!(Test-Path $target)) { throw ('Missing project file: ' + $target) }
  Copy-Item $target (Join-Path $backup $name) -Force
}
foreach ($name in $names) {
  if ($name.EndsWith('.js')) { $target = Join-Path $root ('public\js\' + $name) } else { $target = Join-Path $root ('public\' + $name) }
  Copy-Item (Join-Path $src $name) $target -Force
}
$curatedTarget = Join-Path $root 'public\curated-official-catalog.json'
if (!(Test-Path $curatedTarget)) { Copy-Item (Join-Path $src 'curated-official-catalog.json') $curatedTarget }
Write-Host ('PATCH COMPLETED. Backup: ' + $backup) -ForegroundColor Green
Write-Host 'Check JavaScript with node --check, then Ctrl+F5.'
