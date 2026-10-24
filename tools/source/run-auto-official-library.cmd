@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM Use the trusted Windows task runner without changing PowerShell execution policy.
cd /d "%~dp0..\.."
if errorlevel 1 exit /b 10
if not exist "data\source_sync\rss-terms-ack.txt" (
  echo Missing RSS terms acknowledgement. Read https://congbao.chinhphu.vn/rss.htm
  exit /b 11
)
findstr /X /C:"TERMS_REVIEWED_AND_PERMITTED" "data\source_sync\rss-terms-ack.txt" >nul
if errorlevel 1 (
  echo Invalid RSS terms acknowledgement.
  exit /b 12
)
set "GDS_OFFICIAL_RSS_PERMISSION_ACK=TERMS_REVIEWED_AND_PERMITTED"
if not exist "data\source_sync\logs" mkdir "data\source_sync\logs"
if not exist "data\source_sync\logs" exit /b 13
set "LOG=data\source_sync\logs\official-library-latest.log"
REM Reject simultaneous runs: never force-remove a lock left by an active process.
mkdir "data\source_sync\official-auto-task.lock" >nul 2>&1
if errorlevel 1 (
  echo Another run may be active. Inspect data\source_sync\official-auto-task.lock
  exit /b 14
)
>>"%LOG%" echo ===== OFFICIAL LIBRARY SYNC START =====
node "tools\source\sync-official-feed.cjs" --apply >>"%LOG%" 2>&1
if errorlevel 1 goto :failed
node "tools\source\official-public-library.cjs" --apply --download-pdf >>"%LOG%" 2>&1
if errorlevel 1 goto :failed
if exist ".venv-law\Scripts\python.exe" (
  ".venv-law\Scripts\python.exe" "tools\law_rag\stage_official_downloads.py" >>"%LOG%" 2>&1
  if errorlevel 1 >>"%LOG%" echo WARNING: private RAG staging failed; source catalog is still available.
)
>>"%LOG%" echo ===== OFFICIAL LIBRARY SYNC DONE =====
rmdir "data\source_sync\official-auto-task.lock" >nul 2>&1
exit /b 0
:failed
>>"%LOG%" echo ERROR: official-library synchronization failed. Check previous log entries.
rmdir "data\source_sync\official-auto-task.lock" >nul 2>&1
exit /b 1
