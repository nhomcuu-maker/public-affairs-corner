@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is missing & exit /b 1)
node tools\test-source-readiness-http.cjs
exit /b %ERRORLEVEL%
