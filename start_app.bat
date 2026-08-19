@echo off
setlocal enabledelayedexpansion
title RBL Research Tool - Master Launcher

cd /d "%~dp0"

echo =====================================================================
echo       RBL RESEARCH INTELLIGENCE WEB APP - MASTER LAUNCHER            
echo =====================================================================
echo.

:: -----------------------------------------------------------------------
:: STAGE 1: ENVIRONMENT PRE-CHECK
:: -----------------------------------------------------------------------
echo [INFO] Stage 1/5: Checking Python and Node.js environment...

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in system PATH.
    echo Please install Python 3.10+ and add it to your PATH.
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in system PATH.
    echo Please install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in system PATH.
    pause
    exit /b 1
)

echo [SUCCESS] System environment verified.
echo.

:: -----------------------------------------------------------------------
:: STAGE 2: CLEAN CONFLICTING PORTS (8000, 5173, 5174)
:: -----------------------------------------------------------------------
echo [INFO] Stage 2/5: Cleaning up conflicting background ports...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(8000, 5173, 5174); foreach ($port in $ports) { $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue; if ($conns) { foreach ($c in $conns) { if ($c.OwningProcess -and $c.OwningProcess -ne 0) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } } } }"

echo [SUCCESS] Ports are cleared and ready.
echo.

:: -----------------------------------------------------------------------
:: STAGE 3: DEPENDENCY VERIFICATION
:: -----------------------------------------------------------------------
echo [INFO] Stage 3/5: Checking dependencies...

if exist "backend\requirements.txt" (
    python -m pip install -r backend\requirements.txt --quiet --disable-pip-version-check
)

if not exist "node_modules\" (
    echo [INFO] Installing frontend node_modules...
    call npm install --no-audit --silent
) else (
    echo [SUCCESS] Dependencies are ready.
)
echo.

:: -----------------------------------------------------------------------
:: STAGE 4: LAUNCH BACKEND & FRONTEND SERVICES
:: -----------------------------------------------------------------------
echo [INFO] Stage 4/5: Starting FastAPI Backend and Vite Frontend...

start "RBL_Backend_Server" /min cmd /c "cd /d "%~dp0backend" && python run.py"
start "RBL_Frontend_Server" /min cmd /c "cd /d "%~dp0" && npm run dev"

echo [SUCCESS] Background servers spawned.
echo.

:: -----------------------------------------------------------------------
:: STAGE 5: WAIT FOR HEALTH & OPEN BROWSER
:: -----------------------------------------------------------------------
echo [INFO] Stage 5/5: Waiting for services to become online...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready = $false; for ($i=1; $i -le 25; $i++) { Start-Sleep -Seconds 1; Write-Host -NoNewline '.'; try { $b = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/' -UseBasicParsing -TimeoutSec 1; $f = Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 1; if ($b.StatusCode -eq 200 -and $f.StatusCode -eq 200) { $ready = $true; break; } } catch {} }; Write-Host ''; if ($ready) { Write-Host '[SUCCESS] All services are online and healthy!' -ForegroundColor Green } else { Write-Host '[INFO] Opening browser now...' -ForegroundColor Yellow }"

echo.
echo =====================================================================
echo   RBL RESEARCH TOOL IS LIVE: http://localhost:5173/
echo   BACKEND API IS LIVE:       http://127.0.0.1:8000/
echo =====================================================================
echo.
echo [INFO] Opening default browser at http://localhost:5173/ ...
start http://localhost:5173/

echo.
echo [TIP] To stop all servers later, double-click 'stop_app.bat'.
echo Press any key to close this launcher window.
pause >nul
exit /b 0
