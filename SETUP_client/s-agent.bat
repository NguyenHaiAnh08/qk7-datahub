@echo off
chcp 65001 >nul
title QK7 Fingerprint Agent - Client
cd /d "%~dp0"

echo ==========================================
echo   QK7 FINGERPRINT AGENT - CLIENT
echo ==========================================
echo.

if not exist "agent.py" (
    echo [LOI] Khong tim thay agent.py
    pause
    exit /b 1
)
if not exist "zk_service.py" (
    echo [LOI] Khong tim thay zk_service.py
    pause
    exit /b 1
)
if not exist "libzkfp.dll" (
    echo [LOI] Khong tim thay libzkfp.dll
    echo Copy tu: C:\Windows\System32\libzkfp.dll
    pause
    exit /b 1
)
if not exist ".env" (
    echo [LOI] Khong tim thay file .env
    echo Copy file client.info tu server, doi ten thanh .env
    pause
    exit /b 1
)

echo --- CAU HINH (.env) ---
type .env
echo ------------------------
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Python trong PATH
    pause
    exit /b 1
)

python -c "import pyzkfp" >nul 2>&1
if errorlevel 1 (
    echo [LOI] Chua cai pyzkfp
    echo Chay: pip install -r requirements.txt
    pause
    exit /b 1
)

echo Tram kiem soat: http://127.0.0.1:9001/device-id
echo Dang khoi dong...
echo.

python agent.py

echo.
echo Agent da dung.
pause
exit /b 0