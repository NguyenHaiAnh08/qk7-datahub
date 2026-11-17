@echo off
chcp 65001 >nul
title QK7 Fingerprint Agent - May con
cd /d "%~dp0"

echo ==========================================
echo   QK7 FINGERPRINT AGENT - CAI DAT MAY CON
echo ==========================================
echo.

if not exist "agent.py" (
    echo [LOI] Khong thay agent.py trong %CD%
    pause & exit /b 1
)
if not exist "rootCA.pem" (
    echo [LOI] Thieu rootCA.pem. Copy file rootCA.pem CONG KHAI tu may chu vao: %CD%
    echo       KHONG copy rootCA-key.pem.
    pause & exit /b 1
)

if exist ".env" (
    echo [OK] Da co .env - bo qua buoc cau hinh. Xoa .env neu muon cau hinh lai.
    goto run
)

set /p SERVER_HOST=Nhap IP hoac ten mien May chu (vd 192.168.1.229): 
set /p BRIDGE_TOKEN=Nhap FINGERPRINT_BRIDGE_TOKEN cua May chu: 
if "%SERVER_HOST%"=="" ( echo [LOI] Chua nhap May chu & pause & exit /b 1 )
if "%BRIDGE_TOKEN%"=="" ( echo [LOI] Chua nhap token & pause & exit /b 1 )

(
echo BACKEND_WS_URL=wss://%SERVER_HOST%:8000/ws/fingerprint
echo BRIDGE_TOKEN=%BRIDGE_TOKEN%
echo CA_CERT_PATH=rootCA.pem
echo DEVICE_SERVER_HOST=127.0.0.1
echo DEVICE_SERVER_PORT=9001
echo MATCH_SCORE_THRESHOLD=45
echo DEVICE_IDLE_TIMEOUT=60
echo DEVICE_FULL_RESET_ON_CLOSE=true
) > .env
echo [OK] Da tao .env

REM device_id rieng cho tung may - KHONG copy device_id.txt tu may khac
if exist "device_id.txt" echo [LUU Y] device_id.txt dang ton tai. Neu copy tu may khac, hay xoa de tao ID moi.

REM Cert HTTPS cho cong 9001 (127.0.0.1): can cert.pem + private-key.pem canh agent.py
if not exist "cert.pem" (
    echo [CANH BAO] Chua co cert.pem/private-key.pem - cong 9001 se chay HTTP.
    echo            Tao bang: mkcert 127.0.0.1 localhost  ^(doi ten thanh cert.pem / private-key.pem^)
)

:run
echo.
echo Dang khoi dong Fingerprint Agent...
python agent.py
pause
