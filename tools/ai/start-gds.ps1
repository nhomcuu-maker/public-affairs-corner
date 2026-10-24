# Requires PowerShell 5.1+ on Windows; invoke from ANY directory.
# No SQL approval, source verification or publication is performed.
param(
  [ValidateSet('Ollama','OpenAI')][string]$Provider = 'Ollama',
  [string]$Model = '',
  [switch]$PullModel,
  [switch]$StagePending,
  [switch]$NoBrowser,
  [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $root
$env:NODE_ENV = 'development'  # local-only listener; do not expose draft preview to LAN
Write-Host ('Goc Dan Sinh | ' + $root) -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath '.env')) { throw 'Khong tim thay .env: can cau hinh SQL Server hien tai truoc.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Can cai Node.js 20+.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Can cai npm.' }

# Set environment only for the launched backend process. Never persist a cloud API key in project files.
if ($Provider -eq 'Ollama') {
  if (-not $Model) { $Model = 'llama3.2:3b' }
  # Windows installer may not update PATH in a PowerShell session that is already open.
  # Detect the official per-user installation before claiming Ollama is missing.
  if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    if ($env:LOCALAPPDATA) {
      $candidate = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
      if (Test-Path -LiteralPath $candidate) {
        $env:Path = (Split-Path -Parent $candidate) + ';' + $env:Path
      }
    }
  }
  if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    throw 'Khong tim thay ollama.exe. Kiem tra Ollama da cai va PATH, hoac dung -Provider OpenAI.'
  }
  $env:AI_PROVIDER='ollama'
  $env:AI_BASE_URL='http://127.0.0.1:11434/v1'
  $env:AI_MODEL=$Model
  $env:AI_API_KEY='ollama' # Local Ollama ignores this value
  $env:AI_ALLOW_STAFF_DRAFTS='true' # Authenticated staff-only demo of pending sources
  try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5 | Out-Null }
  catch {
    Write-Host 'Dang khoi dong Ollama...' -ForegroundColor Yellow
    Start-Process -FilePath (Get-Command ollama).Source -ArgumentList @('serve') -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 4
  }
  if ($PullModel) {
    Write-Host ('Tai model ' + $Model + ' (co the mat vai GB)') -ForegroundColor Yellow
    & ollama pull $Model
    if ($LASTEXITCODE -ne 0) { throw 'Tai model Ollama that bai.' }
  }
} else {
  if (-not $Model) { $Model = 'gpt-4.1-mini' }
  $env:AI_PROVIDER='openai'
  $env:AI_BASE_URL='https://api.openai.com/v1'
  $env:AI_MODEL=$Model
  $env:AI_ALLOW_STAFF_DRAFTS='false' # Do NOT upload pending legal PDFs to cloud by default
  if (-not $env:AI_API_KEY) {
    $secret = Read-Host 'Nhap OpenAI API key (khong luu vao file)' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try { $env:AI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  }
  if (-not $env:AI_API_KEY) { throw 'Chua co AI_API_KEY. Khong the goi API cloud.' }
}

# Diagnose real provider BEFORE attempting to boot the server.
node tools/ai/doctor.cjs
if ($LASTEXITCODE -ne 0) { throw 'AI provider chua san sang. Xem thong bao phia tren.' }
if ($Provider -eq 'Ollama') {
  node tools/ai/doctor.cjs --model-test
  if ($LASTEXITCODE -ne 0) { Write-Warning 'Ollama installed, but direct model inference failed. Website may still run in retrieval-only mode.' }
}

# These are idempotent staging/audit routines; neither confers approval nor publishes.
if ($StagePending) {
  $env:GDS_BULK_STAGE_ACK='PENDING_ONLY_CONFIRMED'
  node tools/bulk/stage-all-existing.cjs --apply
  if ($LASTEXITCODE -ne 0) { throw 'Nap staging that bai. Can xu ly SQL truoc khi chay lai.' }
}
node tools/bulk/stage-all-existing.cjs --audit
if ($LASTEXITCODE -ne 0) { throw 'Audit SQL that bai.' }
node tools/test-assistant.cjs
if ($LASTEXITCODE -ne 0) { throw 'Unit test AI that bai.' }
# Mock tests isolate their own provider settings; safe even when the launcher uses Ollama.
node tools/test-assistant-ai-mock.cjs
if ($LASTEXITCODE -ne 0) { throw 'Mock test AI that bai.' }
node tools/ai/test-local-provider-mock.cjs
if ($LASTEXITCODE -ne 0) { throw 'Ollama mock test that bai.' }
node tools/ai/test-ai-setup.cjs
if ($LASTEXITCODE -ne 0) { throw 'Cau hinh AI that bai.' }
if (-not $SkipBuild) {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'NestJS build that bai.' }
}

# Nest CLI may report a successful compile while incremental build metadata prevents
# dist/main.js from being emitted. Never start an unusable backend in that case.
$entryPoint = Join-Path $root 'dist\main.js'
if (-not (Test-Path -LiteralPath $entryPoint -PathType Leaf)) {
  throw 'BUILD ENTRYPOINT MISSING: dist/main.js. Delete dist and run npm run build; check tsBuildInfoFile is inside dist.'
}
Write-Host 'BUILD ENTRYPOINT: PASS (dist/main.js)' -ForegroundColor Green

# An already running server won't inherit newly set environment variables.
try {
  $running=Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/health' -TimeoutSec 3
  if ($null -ne $running) {
    throw 'Cong 3001 dang co website chay VOI CAU HINH CU. Dong cua so npm run dev cu roi chay lai tools/ai/start-gds.ps1.'
  }
} catch {
  if ($_.Exception.Message -like '*VOI CAU HINH CU*') { throw }
}
Write-Host 'Dang mo NestJS trong mot cua so CMD rieng...' -ForegroundColor Green
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k','npm run dev') -WorkingDirectory $root | Out-Null
$ready=$false
for ($i=0;$i -lt 35;$i++) {
  Start-Sleep -Seconds 1
  try { $null=Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/health' -TimeoutSec 2; $ready=$true; break } catch { }
}
if (-not $ready) { throw 'Backend chua san sang. Kiem tra cua so CMD vua mo.' }
Write-Host 'Backend da khoi dong. Dang kiem tra tro ly tren API...' -ForegroundColor Cyan
node tools/ai/doctor.cjs --api
if ($LASTEXITCODE -ne 0) {
  Write-Warning 'BACKEND RUNNING; AI END TO END NOT READY. Check AI DOCTOR FAIL / AI DIAG and NestJS CMD log.'
}
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:3001/tro-ly-ai.html' }
Write-Host 'Xong: mo http://127.0.0.1:3001/tro-ly-ai.html' -ForegroundColor Green
Write-Host 'De thu nhap ban nhap: dang nhap nhan su va chon che do Noi bo tren trang tro ly.'
Write-Host 'Khong bai nao duoc tu dong phe duyet hoac cong bo.'
