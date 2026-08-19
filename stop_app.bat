@echo off
setlocal enabledelayedexpansion
title RBL Research Tool - Stop All

cd /d "%~dp0"

echo =====================================================================
echo          RBL RESEARCH TOOL - 1-CLICK GRACEFUL SHUTDOWN               
echo =====================================================================
echo.

echo [INFO] Stopping all backend and frontend services...

powershell -NoProfile -Command ^
    "$ports = @(8000, 5173, 5174, 5175); " ^
    "foreach ($port in $ports) { " ^
    "    $pids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; " ^
    "    foreach ($p in $pids) { " ^
    "        if ($p -and $p -ne 0) { " ^
    "            Write-Host '  [SHUTDOWN] Releasing port' $port '(PID:' $p ')'; " ^
    "            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; " ^
    "        } " ^
    "    } " ^
    "}"

taskkill /FI "WINDOWTITLE eq RBL_Backend_Server*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq RBL_Frontend_Server*" /T /F >nul 2>&1
wmic process where "commandline like '%%app.main:app%%' or commandline like '%%vite%%'" delete >nul 2>&1

echo.
echo [SUCCESS] Everything has been shut down cleanly.
timeout /t 2 >nul
exit /b 0
