# Windows PowerShell 5.1+, run from project root. Inputs never written in cleartext.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$nodeScript = Join-Path $PSScriptRoot 'create-staff-accounts-sql.cjs'
$output = Join-Path $root 'sql\Tao_Tai_Khoan_Nhan_Su_Tam.sql'
if (Test-Path -LiteralPath $output) {
    throw 'SQL tam da ton tai. Neu da dung xong, xoa no truoc khi tao dot moi.'
}
Write-Host 'GOC DAN SINH - TAO TAI KHOAN NHAN SU 1 LAN'
Write-Host 'Admin: da co -> khong tao lai. Reviewer #6: da co -> mac dinh bo qua.'
Write-Host 'Nhan ENTER de dung mac dinh. Y tao tai khoan moi, N bo qua.'
Write-Host 'Can 3 nguoi thuc su doc lap cho bien tap, kiem duyet va cong bo.'
function Plain([Security.SecureString]$value) {
    $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }
}
$accounts = @()
foreach ($entry in @(
    @{role='editor'; prompt='Tao Editor moi? [y/N]'; default='n'},
    @{role='reviewer'; prompt='Tao Reviewer moi? (tai khoan #6 da co) [y/N]'; default='n'},
    @{role='publisher'; prompt='Tao Publisher moi? [Y/n]'; default='y'}
)) {
    $answer=(Read-Host $entry.prompt).Trim().ToLowerInvariant()
    if ($answer -eq '') { $answer=$entry.default }
    if ($answer -notin @('y','n')) { throw 'Nhap Y hoac N.' }
    if ($answer -eq 'n') { continue }
    Write-Host ('Thong tin nguoi that su nhan vai tro '+$entry.role)
    $name = Read-Host 'Ho ten nguoi su dung tai khoan'
    $email = Read-Host 'Email rieng chua dang ky'
    $s1 = Read-Host 'Mat khau moi (12-128 ky tu; an khi nhap)' -AsSecureString
    $s2 = Read-Host 'Nhap lai mat khau' -AsSecureString
    $p1 = Plain $s1
    $p2 = Plain $s2
    if ($p1 -cne $p2) { throw 'Mat khau nhap lai khong khop.' }
    $accounts += @{ role=$entry.role; name=$name; email=$email; password=$p1 }
    $p1=$null; $p2=$null; $s1=$null; $s2=$null
}
if ($accounts.Count -eq 0) {
    Write-Host 'Khong co tai khoan moi can tao. Ban co the dung cac tai khoan da co.'
    exit 0
}
# Escape non-ASCII for reliable pipes on Windows PowerShell 5.1.
$json = ConvertTo-Json -InputObject @{ accounts=@($accounts) } -Compress -Depth 5
$json = [regex]::Replace($json,'[^\u0000-\u007F]',{
    param($match)
    '\u{0:x4}' -f [int][char]$match.Value[0]
})
$accounts=$null
$json | & node $nodeScript $output
$json=$null
if ($LASTEXITCODE -ne 0) { throw 'Tao SQL that bai, database chua thay doi.' }
Write-Host 'Mo file sql\Tao_Tai_Khoan_Nhan_Su_Tam.sql trong SSMS. Chay @Apply=0 truoc.'
Write-Host 'Sau khi sao luu database va xac nhan email, doi @Apply=1. Dang nhap thu tung nguoi.'
Write-Host 'XOA FILE SQL TAM NGAY SAU KHI TAO XONG; KHONG DAY LEN GIT/DRIVE.'
