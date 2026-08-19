@echo off
setlocal
title Build Standalone EXE Launcher

cd /d "%~dp0"

echo =====================================================================
echo       BUILDING STANDALONE EXECUTABLE (RBL_Research_Tool.exe)         
echo =====================================================================
echo.

echo [1/3] Checking PyInstaller...
python -m pip install pyinstaller --quiet

echo [2/3] Compiling launcher.py into standalone EXE...
pyinstaller --noconfirm --onefile --console --name "RBL_Research_Tool" "launcher.py"

if %errorlevel% equ 0 (
    echo.
    echo =====================================================================
    echo [SUCCESS] Build Complete!
    echo Output executable: dist\RBL_Research_Tool.exe
    echo You can now move or double-click dist\RBL_Research_Tool.exe to run the entire app!
    echo =====================================================================
) else (
    echo.
    echo [ERROR] PyInstaller build failed.
)

pause
