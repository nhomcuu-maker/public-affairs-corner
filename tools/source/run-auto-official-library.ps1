#requires -Version 5.1
<#
  Windows runner for the PUBLIC ORIGINAL-SOURCE REFERENCE LIBRARY.
  Never updates knowledge_version, approval records, or legal validity.
  Requires the user's explicit review of https://congbao.chinhphu.vn/rss.htm.
#>
[CmdletBinding()]
param([int]$MaxPdfs = 12)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$ackPath = Join-Path $root 'data\source_sync\rss-terms-ack.txt'
if (-not (Test-Path -LiteralPath $ackPath -PathType Leaf)) {
  throw 'Chua xac nhan dieu kien RSS. Doc https://congbao.chinhphu.vn/rss.htm va ghi ro nguon; su dung lenh cai task sau khi da xac nhan.'
}
if ((Get-Content -LiteralPath $ackPath -Raw).Trim() -ne 'TERMS_REVIEWED_AND_PERMITTED') {
  throw 'Terms acknowledgement is not valid.'
}
if ($MaxPdfs -lt 0 -or $MaxPdfs -gt 50) { throw 'MaxPdfs must be 0..50' }
$env:GDS_OFFICIAL_RSS_PERMISSION_ACK = 'TERMS_REVIEWED_AND_PERMITTED'
$logDir = Join-Path $root 'data\source_sync\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ('public-library-{0}.log' -f (Get-Date -Format 'yyyyMMdd'))
$lock = Join-Path $root 'data\source_sync\public-library-run.lock'
$stream = $null
try {
  $stream = [System.IO.File]::Open($lock, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  Push-Location $root
  try {
    & node (Join-Path $root 'tools\source\sync-official-feed.cjs') --apply 2>&1 | Tee-Object -FilePath $log -Append
    if ($LASTEXITCODE -ne 0) { throw 'RSS collection failed: see log.' }
    & node (Join-Path $root 'tools\source\official-public-library.cjs') --apply --download-pdf --max-pdfs $MaxPdfs 2>&1 | Tee-Object -FilePath $log -Append
    if ($LASTEXITCODE -ne 0) { throw 'Public reference refresh failed: see log.' }
    $py = Join-Path $root '.venv-law\Scripts\python.exe'
    if (Test-Path -LiteralPath $py -PathType Leaf) {
      & $py (Join-Path $root 'tools\law_rag\stage_official_downloads.py') 2>&1 | Tee-Object -FilePath $log -Append
      if ($LASTEXITCODE -ne 0) { Write-Warning 'Private RAG staging failed; public original-reference catalog was updated. See log.' }
    } else { Write-Warning 'Python virtual environment missing; source link catalog updated, RAG staging skipped.' }
    Write-Host 'PUBLIC REFERENCE UPDATE OK. Legal advice publication remains separately gated.'
  } finally { Pop-Location }
} finally {
  if ($null -ne $stream) { $stream.Dispose(); Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue }
}
