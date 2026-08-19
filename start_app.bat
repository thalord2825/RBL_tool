@echo off
setlocal enabledelayedexpansion
title RBL Research Tool - Master Launcher

cd /d "%~dp0"

echo =====================================================================
echo       RBL RESEARCH INTELLIGENCE WEB APP - SELF-HEALING LAUNCHER      
echo =====================================================================
echo.

:: =====================================================================
:: STAGE 1: PRE-FLIGHT ENVIRONMENT VERIFICATION
:: =====================================================================
echo [INFO] Stage 1/5: Checking system dependencies...

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not found in system PATH.
    echo Please download and install Python 3.10+ from: https://www.python.org/downloads/
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in system PATH.
    echo Please download and install Node.js LTS from: https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in system PATH.
    pause
    exit /b 1
)

echo [SUCCESS] Python and Node.js are available.
echo.

:: =====================================================================
:: STAGE 2: SELF-HEALING PORT CLEANUP (PORTS 8000 & 5173/5174)
:: =====================================================================
echo [INFO] Stage 2/5: Scanning and cleaning conflicting ports (8000, 5173, 5174)...

powershell -NoProfile -Command ^
    "$ports = @(8000, 5173, 5174); " ^
    "foreach ($port in $ports) { " ^
    "    $pids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; " ^
    "    foreach ($p in $pids) { " ^
    "        if ($p -and $p -ne 0) { " ^
    "            Write-Host '[HEALING] Terminating lingering PID' $p 'on port' $port; " ^
    "            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; " ^
    "        } " ^
    "    } " ^
    "}"

echo [SUCCESS] Ports 8000 and 5173/5174 are clear and ready.
echo.

:: =====================================================================
:: STAGE 3: AUTOMATED DEPENDENCY SYNCHRONIZATION
:: =====================================================================
echo [INFO] Stage 3/5: Verifying backend and frontend dependencies...

if exist "backend\requirements.txt" (
    echo [INFO] Checking Python packages...
    python -m pip install -r backend\requirements.txt --quiet --disable-pip-version-check
    if %errorlevel% neq 0 (
        echo [WARNING] Some pip dependencies failed to install. Continuing anyway...
    )
)

if not exist "node_modules\" (
    echo [INFO] Installing frontend packages (node_modules not found)...
    call npm install --no-audit --silent
) else (
    echo [SUCCESS] Frontend packages already installed.
)
echo.

:: =====================================================================
:: STAGE 4: RESILIENT DUAL-SERVICE ORCHESTRATION
:: =====================================================================
echo [INFO] Stage 4/5: Launching FastAPI Backend and Vite Frontend...

:: Start Backend in dedicated window
start "RBL_Backend_Server" /min cmd /c "cd /d \"%~dp0backend\" && python run.py"

:: Start Frontend in dedicated window
start "RBL_Frontend_Server" /min cmd /c "cd /d \"%~dp0\" && npm run dev"

echo [SUCCESS] Services spawned in background.
echo.

:: =====================================================================
:: STAGE 5: ACTIVE HEALTH-CHECK POLLING & AUTO-BROWSER LAUNCH
:: =====================================================================
echo [INFO] Stage 5/5: Waiting for services to become healthy...

powershell -NoProfile -Command ^
    "$maxRetries = 30; $backendReady = $false; $frontendReady = $false; " ^
    "for ($i = 1; $i -le $maxRetries; $i++) { " ^
    "    Write-Host -NoNewline '.'; " ^
    "    if (-not $backendReady) { " ^
    "        try { $res = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/' -TimeoutSec 1 -UseBasicParsing; if ($res.StatusCode -eq 200) { $backendReady = $true } } catch {} " ^
    "    } " ^
    "    if (-not $frontendReady) { " ^
    "        try { $res = Invoke-WebRequest -Uri 'http://localhost:5173/' -TimeoutSec 1 -UseBasicParsing; if ($res.StatusCode -eq 200) { $frontendReady = $true } } catch {} " ^
    "    } " ^
    "    if ($backendReady -and $frontendReady) { break; } " ^
    "    Start-Sleep -Seconds 1; " ^
    "} " ^
    "Write-Host ''; " ^
    "if ($backendReady -and $frontendReady) { " ^
    "    Write-Host '[SUCCESS] All services are HEALTHY and ONLINE!' -ForegroundColor Green; " ^
    "    exit 0; " ^
    "} else { " ^
    "    Write-Host '[WARNING] Timed out waiting for full health-check, opening browser anyway...' -ForegroundColor Yellow; " ^
    "    exit 1; " ^
    "}"

echo.
echo =====================================================================
echo   RBL RESEARCH TOOL IS LIVE: http://localhost:5173/
echo   BACKEND API IS LIVE:       http://127.0.0.1:8000/
echo =====================================================================
echo.
echo [INFO] Opening default browser...
start http://localhost:5173/

echo.
echo [TIP] Keep this terminal open, or double-click 'stop_app.bat' when you wish to shut down.
echo Press any key to close this launcher window (servers will remain running).
pause >nul
exit /b 0
