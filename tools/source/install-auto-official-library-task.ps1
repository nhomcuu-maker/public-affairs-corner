#requires -Version 5.1
[CmdletBinding()]
param([switch]$AcknowledgeTerms,[int]$AtHour=8,[int]$AtMinute=15,[switch]$ReplaceExisting)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if (-not $AcknowledgeTerms) {throw 'Doc https://congbao.chinhphu.vn/rss.htm va xac nhan dieu kien su dung bang -AcknowledgeTerms.'}
if ($AtHour -lt 0 -or $AtHour -gt 23 -or $AtMinute -lt 0 -or $AtMinute -gt 59) {throw 'Invalid task time.'}
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$termsFile=Join-Path $root 'data\source_sync\rss-terms-ack.txt'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $termsFile) | Out-Null
[System.IO.File]::WriteAllText($termsFile,"TERMS_REVIEWED_AND_PERMITTED`r`n",(New-Object System.Text.UTF8Encoding($false)))
$taskName='GocDanSinh-PublicOfficialLibrary'
$existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($null -ne $existing -and -not $ReplaceExisting) {throw 'Task exists. Use -ReplaceExisting after inspection.'}
$psExe=Join-Path $PSHOME 'powershell.exe'
$runner=Join-Path $PSScriptRoot 'run-auto-official-library.ps1'
$action=New-ScheduledTaskAction -Execute $psExe -Argument ('-NoProfile -NonInteractive -File "{0}"' -f $runner) -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -Daily -At (Get-Date -Hour $AtHour -Minute $AtMinute -Second 0)
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 50)
$principal=New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force:$ReplaceExisting | Out-Null
Disable-ScheduledTask -TaskName $taskName | Out-Null
Write-Host "Created DISABLED scheduled task: $taskName"
Write-Host 'Review RSS terms, run manually and inspect the log BEFORE enabling the task.'
