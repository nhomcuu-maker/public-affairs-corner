param([string]$ProjectDir = 'D:\trường\Đồ án\GocDanSinh')
$ErrorActionPreference = 'Stop'
$SourceDir = $PSScriptRoot
$ProjectDir = (Resolve-Path -LiteralPath $ProjectDir).Path
if (-not (Test-Path -LiteralPath (Join-Path $ProjectDir 'src\content\content.service.ts'))) {
    throw 'Thu muc du an khong dung: khong co src\content\content.service.ts'
}
$Files = @(
    'public\phap-luat-quyen-loi.html',
    'public\thu-tuc-hanh-chinh.html',
    'public\canh-bao-lua-dao.html',
    'public\kho-van-ban.html',
    'public\css\gds-topic-browser.css',
    'public\js\gds-taxonomy.js',
    'public\js\gds-topic-browser.js',
    'src\content\content.controller.ts',
    'src\content\content.service.ts',
    'tools\catalog\sync-official.cjs',
    'tools\catalog\test-category.cjs',
    'tools\test-three-domains.cjs',
    'tools\test-scam-categories.cjs',
    'tools\test-scam-article-flow.cjs',
    'tools\test-scam-handbook.cjs',
    'sql\checks\09_PhanLoai_3x3_READ_ONLY.sql'
)
$Backup = Join-Path (Split-Path $ProjectDir -Parent) ('GDS_BACKUP_3X3_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $Backup -Force | Out-Null
foreach ($Relative in @($Files + 'public\category-index.json')) {
    $Path = Join-Path $ProjectDir $Relative
    if (Test-Path -LiteralPath $Path) {
        $To = Join-Path $Backup $Relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $To) -Force | Out-Null
        Copy-Item -LiteralPath $Path -Destination $To -Force
    }
}
foreach ($Relative in $Files) {
    $From = Join-Path $SourceDir $Relative
    if (-not (Test-Path -LiteralPath $From)) { throw "Ban va thieu file $Relative" }
    $To = Join-Path $ProjectDir $Relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $To) -Force | Out-Null
    Copy-Item -LiteralPath $From -Destination $To -Force
}
Write-Host "Da sao luu vao: $Backup" -ForegroundColor Yellow
Push-Location -LiteralPath $ProjectDir
try {
    # Keep RSS previously indexed. This command does not contact the internet.
    & node tools/catalog/sync-official.cjs --offline
    if ($LASTEXITCODE -ne 0) { throw 'Dong bo danh muc that bai' }
    & node tools/catalog/test-category.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Kiem tra chi muc that bai' }
    & node tools/test-three-domains.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Kiem tra loc danh muc that bai' }
    & node tools/test-scam-categories.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Kiem tra 3 nhom lua dao that bai' }
    Write-Host 'DA AP DUNG VA KIEM TRA DANH MUC 3X3 THANH CONG.' -ForegroundColor Green
    Write-Host 'Tiep theo: chay npm run build va khoi dong lai website.' -ForegroundColor Cyan
} finally { Pop-Location }
