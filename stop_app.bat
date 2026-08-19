@echo off
setlocal enabledelayedexpansion
title RBL Research Tool - Stop All

cd /d "%~dp0"

echo =====================================================================
echo          RBL RESEARCH TOOL - 1-CLICK GRACEFUL SHUTDOWN               
echo =====================================================================
echo.

echo [INFO] Stopping all backend and frontend services...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(8000, 5173, 5174, 5175); foreach ($port in $ports) { $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue; if ($conns) { foreach ($c in $conns) { if ($c.OwningProcess -and $c.OwningProcess -ne 0) { Write-Host '  [SHUTDOWN] Terminating process on port' $port '(PID:' $c.OwningProcess ')'; Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } } } }"

taskkill /FI "WINDOWTITLE eq RBL_Backend_Server*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq RBL_Frontend_Server*" /T /F >nul 2>&1

echo.
echo [SUCCESS] Everything has been shut down cleanly.
timeout /t 2 >nul
exit /b 0
