@echo off
chcp 65001 >nul
title QK7 Fingerprint Agent - Client

cd /d "%~dp0"

REM Kiem tra .env da cau hinh dung chua
findstr /C:"BACKEND_WS_URL=wss://192.168.1.229:8000" .env >nul
if errorlevel 1 (
    echo [CANH BAO] BACKEND_WS_URL trong .env chua tro ve 192.168.1.229
    echo Mo file .env va sua:
    echo   BACKEND_WS_URL=ws://192.168.1.229:8000/ws/fingerprint
    pause
    exit /b 1
)

echo Khoi dong Fingerprint Agent tren may client...
echo Web: http://192.168.1.229:8000
echo.

python agent.py
pause