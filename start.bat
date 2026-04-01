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

:: ---------------------------------------------------
:: 1. Kill anything already on ports 3000 and 8787
:: ---------------------------------------------------
echo [1/5] Clearing ports 3000 and 8787...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8787 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo    Ports cleared.
echo.

:: ---------------------------------------------------
:: 2. Install frontend dependencies
:: ---------------------------------------------------
echo [2/5] Installing frontend dependencies...
cd /d "%ROOT%"
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo    ERROR: Frontend npm install failed!
    pause
    exit /b 1
)
echo    Frontend dependencies installed.
echo.

:: ---------------------------------------------------
:: 3. Install worker dependencies
:: ---------------------------------------------------
echo [3/5] Installing worker dependencies...
cd /d "%ROOT%worker"
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo    ERROR: Worker npm install failed!
    pause
    exit /b 1
)
echo    Worker dependencies installed.
echo.

:: ---------------------------------------------------
:: 4. Start the Cloudflare Worker in its own window
:: ---------------------------------------------------
echo [4/5] Starting Cloudflare Worker (port 8787)...
cd /d "%ROOT%worker"
start "Deck - Worker (port 8787)" cmd /k "color 0B && echo ========== DECK WORKER ========== && echo. && npx wrangler dev"

:: Give the worker a moment to boot
timeout /t 3 /nobreak >nul

:: ---------------------------------------------------
:: 5. Start the Next.js frontend in its own window
:: ---------------------------------------------------
echo [5/5] Starting Next.js frontend (port 3000)...
cd /d "%ROOT%"
start "Deck - Frontend (port 3000)" cmd /k "color 0E && echo ========== DECK FRONTEND ========== && echo. && npx next dev"

:: Wait for the frontend to be ready
echo.
echo    Waiting for frontend to start...
timeout /t 5 /nobreak >nul

:: ---------------------------------------------------
:: 6. Open browser
:: ---------------------------------------------------
echo.
echo    Opening browser...
start http://localhost:3000

echo.
echo ============================================
echo    Deck is running!
echo.
echo    Frontend : http://localhost:3000
echo    Worker   : http://localhost:8787
echo.
echo    Each server has its own console window
echo    so you can see errors in real time.
echo.
echo    Close this window or press any key to
echo    keep it open as a reference.
echo ============================================
echo.
pause
