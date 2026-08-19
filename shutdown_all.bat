@echo off
setlocal enabledelayedexpansion
title RBL Research Tool - Emergency Kill & Shutdown All

cd /d "%~dp0"

echo =====================================================================
echo       RBL RESEARCH TOOL - FORCE SHUTDOWN & CLEANUP ALL SERVERS       
echo =====================================================================
echo.

echo [1/3] Scanning and terminating all processes on Ports (8000, 5173, 5174, 5175)...

powershell -NoProfile -Command ^
    "$ports = @(8000, 5173, 5174, 5175); " ^
    "foreach ($port in $ports) { " ^
    "    $pids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; " ^
    "    foreach ($p in $pids) { " ^
    "        if ($p -and $p -ne 0) { " ^
    "            Write-Host '  [KILL] Terminating process' $p 'on port' $port; " ^
    "            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; " ^
    "        } " ^
    "    } " ^
    "}"

echo.
echo [2/3] Closing background console windows (RBL_Backend, RBL_Frontend)...
taskkill /FI "WINDOWTITLE eq RBL_Backend_Server*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq RBL_Frontend_Server*" /T /F >nul 2>&1

echo.
echo [3/3] Terminating any orphan Uvicorn or Vite processes...
wmic process where "commandline like '%%app.main:app%%' or commandline like '%%vite%%'" delete >nul 2>&1

echo.
echo =====================================================================
echo [SUCCESS] ALL RBL SERVERS AND BACKGROUND PROCESSES HAVE BEEN KILLED!
echo All network ports (8000, 5173, 5174) are completely freed.
echo =====================================================================
echo.
timeout /t 3
exit /b 0
