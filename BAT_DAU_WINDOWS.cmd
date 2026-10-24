@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Khong tim thay Node.js trong PATH. Cai Node.js va khoi dong lai Terminal.
  pause
  exit /b 1
)
if not exist ".env" (
  echo Dang tao cau hinh .env cho GocDanSinh...
)
call node tools\setup.cjs
if errorlevel 1 (pause & exit /b 1)
if not exist "node_modules\@nestjs\core" (
  echo Dang cai thu vien Backend...
  call npm install
  if errorlevel 1 (pause & exit /b 1)
)
echo Mo website tai http://127.0.0.1:3001/ khi NestJS khoi dong thanh cong.
call npm run dev
pause
