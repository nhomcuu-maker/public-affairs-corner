# Run in Windows PowerShell 5.1+ from the project root or with -File.
# Prompts for a REAL second reviewer person's distinct email and password locally.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$nodeScript = Join-Path $PSScriptRoot 'create-reviewer-sql.cjs'
$out = Join-Path $root 'sql\Tao_Tai_Khoan_Reviewer_Tam.sql'
if (Test-Path -LiteralPath $out) {
    throw 'The temporary SQL file already exists. Finish the previous attempt, then remove it before generating another.'
}
$name = Read-Host 'Ho va ten that cua nguoi kiem duyet (khac nguoi bien tap)'
$email = Read-Host 'Email rieng cua Reviewer'
$p1 = Read-Host 'Mat khau moi (12-128 ky tu, se khong hien)' -AsSecureString
$p2 = Read-Host 'Nhap lai mat khau' -AsSecureString
function Reveal($v) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($v)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$plain1 = Reveal $p1
$plain2 = Reveal $p2
if ($plain1 -cne $plain2) { throw 'Mat khau xac nhan khong khop.' }
# Encode non-ASCII as JSON \uXXXX so Windows PowerShell 5.1 pipeline encoding cannot corrupt Vietnamese characters.
$json = @{name=$name; email=$email; password=$plain1} | ConvertTo-Json -Compress
$json = [regex]::Replace($json, '[^\u0000-\u007F]', {
    param($match)
    '\u{0:x4}' -f [int][char]$match.Value[0]
})
$plain1 = $null
$plain2 = $null
$json | & node $nodeScript $out
if ($LASTEXITCODE -ne 0) { throw 'Node scrypt SQL generation failed.' }
Write-Host 'Open sql\Tao_Tai_Khoan_Reviewer_Tam.sql in SSMS. First @Apply=0, then @Apply=1 after database backup.'
Write-Host 'After successful login, DELETE this generated temporary SQL file from your PC.'
