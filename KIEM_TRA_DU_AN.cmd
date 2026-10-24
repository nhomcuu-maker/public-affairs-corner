@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is missing & exit /b 1)
if not exist "node_modules\typescript" (echo Run npm ci first & exit /b 1)
call npm run test:offline || exit /b 1
call npm run build || exit /b 1
echo PASS: Offline tests and TypeScript build completed.
echo NOTE: SQL Server and live HTTP checks require a running local backend.
exit /b 0
