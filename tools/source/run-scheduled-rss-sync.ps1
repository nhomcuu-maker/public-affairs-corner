#requires -Version 5.1
<#
  GocDanSinh: scheduled collection + pending-only SQL import.
  Default is a read-only preview. Explicit -Apply is required for writes.
  The runner is intended for Windows PowerShell 5.1 / Task Scheduler.
  It never approves, verifies, or publishes legal content.
#>
[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$NodeExe = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$dataDir = Join-Path $root 'data\source_sync'
$logDir = Join-Path $dataDir 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = Join-Path $logDir ('rss-scheduler-{0}.log' -f (Get-Date -Format 'yyyy-MM-dd'))
$lockFile = Join-Path $dataDir 'rss-scheduler.lock'
$termsFile = Join-Path $dataDir 'rss-terms-ack.txt'
$collector = Join-Path $root 'tools\source\sync-official-feed.cjs'
$importer = Join-Path $root 'tools\source\import-official-feed.cjs'
$lockStream = $null
$phase = 'SETUP'
$exitCode = 50

function Write-RunLog {
    param([string]$Level, [string]$Message)
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
    $line = '{0} [{1}] {2}' -f $stamp, $Level, $Message
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
    Write-Host $line
}

function Invoke-NodeStep {
    param([string]$Name, [string]$ScriptFile, [switch]$WriteMode)
    $stdout = Join-Path $logDir ('rss-{0}-{1}-stdout.tmp' -f $PID, $Name)
    $stderr = Join-Path $logDir ('rss-{0}-{1}-stderr.tmp' -f $PID, $Name)
    $arguments = '"{0}"' -f $ScriptFile
    if ($WriteMode) { $arguments += ' --apply' }
    Write-RunLog 'INFO' ('START {0}; apply={1}' -f $Name, [bool]$WriteMode)
    try {
        $proc = Start-Process -FilePath $NodeExe -ArgumentList $arguments `
            -WorkingDirectory $root -Wait -PassThru -WindowStyle Hidden `
            -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        if (Test-Path -LiteralPath $stdout) {
            foreach ($line in (Get-Content -LiteralPath $stdout -Encoding UTF8)) {
                if (-not [string]::IsNullOrWhiteSpace($line)) { Write-RunLog 'OUT' ([string]$line) }
            }
        }
        if (Test-Path -LiteralPath $stderr) {
            foreach ($line in (Get-Content -LiteralPath $stderr -Encoding UTF8)) {
                if (-not [string]::IsNullOrWhiteSpace($line)) { Write-RunLog 'ERR' ([string]$line) }
            }
        }
        if ($proc.ExitCode -ne 0) {
            throw ('{0} failed with process exit code {1}' -f $Name, $proc.ExitCode)
        }
        Write-RunLog 'INFO' ('PASS {0}' -f $Name)
    }
    finally {
        Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
    }
}

try {
    # A real OS file lock, not just a marker. It is automatically released
    # on process exit or crash; the lock file itself can remain on disk.
    $phase = 'LOCK'
    $lockStream = [System.IO.File]::Open(
        $lockFile,
        [System.IO.FileMode]::OpenOrCreate,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )

    Write-RunLog 'INFO' ('BEGIN mode={0}; user={1}; root={2}' -f `
        $(if ($Apply) { 'APPLY' } else { 'PREVIEW' }), `
        [System.Security.Principal.WindowsIdentity]::GetCurrent().Name, $root)

    $phase = 'SETUP'
    if (-not (Test-Path -LiteralPath $collector -PathType Leaf)) { throw 'Collector script not found' }
    if (-not (Test-Path -LiteralPath $importer -PathType Leaf)) { throw 'SQL importer script not found' }

    if ([string]::IsNullOrWhiteSpace($NodeExe)) {
        $node = Get-Command -Name 'node.exe' -CommandType Application -ErrorAction Stop
        $NodeExe = $node.Source
    }
    if (-not (Test-Path -LiteralPath $NodeExe -PathType Leaf)) { throw 'node.exe was not found' }

    # A local acknowledgment is an operator control, not government approval.
    # Both preview and apply make a live network request, so both require it.
    if (-not (Test-Path -LiteralPath $termsFile -PathType Leaf)) {
        throw 'RSS terms acknowledgment missing. Do not access live RSS yet.'
    }
    $termsAck = (Get-Content -LiteralPath $termsFile -Raw -Encoding UTF8).Trim()
    if ($termsAck -ne 'TERMS_REVIEWED_AND_PERMITTED') {
        throw 'Invalid RSS terms acknowledgment'
    }
    $env:GDS_OFFICIAL_RSS_PERMISSION_ACK = 'TERMS_REVIEWED_AND_PERMITTED'
    if ($Apply) {
        $env:GDS_OFFICIAL_RSS_DB_IMPORT = 'PENDING_ONLY_CONFIRMED'
    }
    else {
        Remove-Item Env:GDS_OFFICIAL_RSS_DB_IMPORT -ErrorAction SilentlyContinue
    }

    $phase = 'COLLECT'
    Invoke-NodeStep -Name 'rss-collect' -ScriptFile $collector -WriteMode:$Apply

    $phase = 'VALIDATE'
    Invoke-NodeStep -Name 'sql-preview' -ScriptFile $importer

    if ($Apply) {
        $phase = 'IMPORT'
        Invoke-NodeStep -Name 'sql-import' -ScriptFile $importer -WriteMode
    }

    $exitCode = 0
    Write-RunLog 'INFO' ('SUCCESS mode={0}; no approval or publication' -f $(if ($Apply) { 'APPLY' } else { 'PREVIEW' }))
}
catch {
    if ($phase -eq 'LOCK' -and $_.Exception -is [System.IO.IOException]) { $exitCode = 20 }
    elseif ($phase -eq 'LOCK' -or $phase -eq 'SETUP') { $exitCode = 10 }
    elseif ($phase -eq 'COLLECT') { $exitCode = 30 }
    elseif ($phase -eq 'VALIDATE' -or $phase -eq 'IMPORT') { $exitCode = 40 }
    else { $exitCode = 50 }
    if ($exitCode -eq 20) {
        Write-RunLog 'WARN' 'SKIP_ALREADY_RUNNING: another sync has the scheduler lock'
    }
    else {
        Write-RunLog 'ERROR' ('FAILED phase={0}; exit={1}; {2}' -f $phase, $exitCode, $_.Exception.Message)
    }
}
finally {
    if ($null -ne $lockStream) { $lockStream.Dispose() }
    Write-RunLog 'INFO' ('END exit={0}' -f $exitCode)
}
exit $exitCode
