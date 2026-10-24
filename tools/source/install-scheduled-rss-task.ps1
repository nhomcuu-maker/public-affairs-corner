#requires -Version 5.1
<#
  Register the daily 08:00 Hanoi-time task for the CURRENT Windows user.
  Registration is intentionally DISABLED until the operator tests and
  explicitly enables it. No database writes are made by this installer.
#>
[CmdletBinding()]
param(
    [switch]$AcknowledgeTerms,
    [switch]$ReplaceExisting
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$taskName = 'GocDanSinh-CongBao-RSS-0800'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$runner = Join-Path $PSScriptRoot 'run-scheduled-rss-sync.ps1'
$termsFile = Join-Path $root 'data\source_sync\rss-terms-ack.txt'

if (-not $AcknowledgeTerms) {
    throw 'Read the official RSS terms, fulfill the required information request, then use -AcknowledgeTerms.'
}
if ((Get-TimeZone).Id -ne 'SE Asia Standard Time') {
    throw 'Set the Windows time zone to (UTC+07:00) Bangkok, Hanoi, Jakarta before scheduling 08:00.'
}
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw 'Runner not found' }
if (-not (Test-Path -LiteralPath (Join-Path $root 'tools\source\sync-official-feed.cjs'))) { throw 'Missing RSS collector' }
if (-not (Test-Path -LiteralPath (Join-Path $root 'tools\source\import-official-feed.cjs'))) { throw 'Missing SQL importer' }
$nodeExe = (Get-Command -Name 'node.exe' -CommandType Application -ErrorAction Stop).Source

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($null -ne $existing -and -not $ReplaceExisting) {
    throw ('Task already exists: {0}. Use -ReplaceExisting only after reviewing the old task.' -f $taskName)
}

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$psExe = Join-Path $PSHOME 'powershell.exe'
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -Apply -NodeExe "{1}"' -f $runner, $nodeExe
$action = New-ScheduledTaskAction -Execute $psExe -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At (Get-Date -Hour 8 -Minute 0 -Second 0)
$settings = New-ScheduledTaskSettingsSet -Disable -MultipleInstances IgnoreNew `
    -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 45) `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited

# Only the acknowledged terms token is stored. This is NOT a claim that
# the feed owner has formally approved use of the RSS channel.
New-Item -ItemType Directory -Path (Split-Path -Parent $termsFile) -Force | Out-Null
[System.IO.File]::WriteAllText($termsFile, "TERMS_REVIEWED_AND_PERMITTED`r`n", (New-Object System.Text.UTF8Encoding($false)))

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Description `
    'GocDanSinh: collect official RSS metadata and import pending-only snapshots daily at 08:00.' `
    -Force:$ReplaceExisting | Out-Null
Disable-ScheduledTask -TaskName $taskName | Out-Null

Write-Host ('TASK CREATED DISABLED: {0}' -f $taskName)
Write-Host ('Current user: {0}' -f $identity)
Write-Host 'Trigger: 08:00 every day, Windows SE Asia Standard Time (UTC+07:00).'
Write-Host 'Logon: Interactive (only when this Windows user is signed in).'
Write-Host 'Next: run the runner manually with -Apply, inspect the logs, then Enable-ScheduledTask.'
