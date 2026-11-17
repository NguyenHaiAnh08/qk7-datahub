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
    echo   BACKEND_WS_URL=wss://127.0.0.1:8000/ws/fingerprint
    echo   BRIDGE_TOKEN=REPLACE_WITH_YOUR_FINGERPRINT_BRIDGE_TOKEN
    pause
    exit /b 1
)

echo [OK] Da tim thay file .env cau hinh ket noi agent.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $c = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -WarningAction SilentlyContinue; if (!$c.TcpTestSucceeded) { Write-Host '[CANH BAO] Backend Gateway (:8000) chua bat. Hay khoi dong Backend truoc (chay s.bat o thu muc goc).' -ForegroundColor Yellow } else { Write-Host '[OK] Da phat hien Backend Gateway (:8000) dang hoat dong.' -ForegroundColor Green } } catch {}"
echo.

echo Dang khoi dong Fingerprint Agent...
python agent.py

pause