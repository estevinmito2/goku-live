@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Instale o Node.js 22 ou superior. & pause & exit /b 1)
if not exist node_modules call npm ci --no-audit --no-fund
start "" http://127.0.0.1:3210
call npm start
pause
