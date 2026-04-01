@echo off
title Deck - Launcher
color 0A

echo ============================================
echo           DECK - Game Server Launcher
echo ============================================
echo.

:: Get the directory this script lives in
set "ROOT=%~dp0"
cd /d "%ROOT%"

:: ─── Kill anything on ports 3000 / 8787 ──────────
echo [1/4] Clearing ports 3000 and 8787...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8787 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo    Ports cleared.
echo.

:: ─── Install dependencies ─────────────────────────
echo [2/4] Installing dependencies...
cd /d "%ROOT%"
call npm install --silent
if %errorlevel% neq 0 (
    color 0C
    echo    ERROR: Frontend npm install failed!
    pause
    exit /b 1
)

cd /d "%ROOT%worker"
call npm install --silent
if %errorlevel% neq 0 (
    color 0C
    echo    ERROR: Worker npm install failed!
    pause
    exit /b 1
)
echo    Dependencies installed.
echo.

:: ─── Start worker in its own window ───────────────
echo [3/4] Starting Cloudflare Worker on port 8787...
cd /d "%ROOT%worker"
start "Deck - Worker" cmd /k "title Deck Worker (port 8787) && color 0B && npx wrangler dev --ip 0.0.0.0 --port 8787"

timeout /t 4 /nobreak >nul
echo    Worker started.
echo.

:: ─── Start frontend in its own window ─────────────
echo [4/4] Starting Next.js frontend on port 3000...
cd /d "%ROOT%"
start "Deck - Frontend" cmd /k "title Deck Frontend (port 3000) && color 0E && npx next dev --port 3000"

timeout /t 5 /nobreak >nul

:: ─── Open browser ─────────────────────────────────
start http://localhost:3000

echo.
echo ============================================
echo    Deck is running!
echo.
echo    Frontend : http://localhost:3000
echo    Worker   : http://localhost:8787
echo.
echo    Worker and Frontend each have their own
echo    console window. Close them to stop.
echo ============================================
echo.
pause
