@echo off
chcp 65001 >nul
title QK7 Fingerprint Agent - Client
cd /d "%~dp0"

echo ==========================================
echo   QK7 FINGERPRINT AGENT - CLIENT
echo ==========================================
echo.

if not exist "agent.py" (
    echo [LOI] Khong tim thay agent.py trong thu muc nay.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [LOI] Khong tim thay file .env.
    echo Vui long tao file .env voi noi dung:
    echo   BACKEND_WS_URL=ws://191.168.1.1:8000/ws/fingerprint
    echo   BRIDGE_TOKEN=qk7_bridge_2026_secret_xyz9876543210abcdef
    pause
    exit /b 1
)

echo --- KIEM TRA FILE .ENV CUA BAN ---
type .env
echo ----------------------------------
echo.

echo Dang khoi dong Fingerprint Agent...
python agent.py

pause