@echo off
chcp 65001 >nul
title QK7 Fingerprint Agent - Server
cd /d "%~dp0"

echo ==========================================
echo   QK7 FINGERPRINT AGENT - SERVER
echo ==========================================
echo.

if not exist "..\.env" (
    echo [LOI] Khong tim thay ..\.env
    echo File .env phai nam o thu muc goc qk7-datahub
    pause
    exit /b 1
)

REM ─── Doc .env root ───
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("..\.env") do (
    call set "%%a=%%b"
)

REM ─── Trim khoang trang thua (an toan) ───
for /f "tokens=* delims= " %%a in ("%SERVER_IP%") do set "SERVER_IP=%%a"
for /f "tokens=* delims= " %%a in ("%FINGERPRINT_BRIDGE_TOKEN%") do set "FINGERPRINT_BRIDGE_TOKEN=%%a"
for /f "tokens=* delims= " %%a in ("%USE_HTTPS%") do set "USE_HTTPS=%%a"

REM ─── Validate ───
if not defined SERVER_IP (
    echo [LOI] Khong doc duoc SERVER_IP tu ..\.env
    pause
    exit /b 1
)
if not defined FINGERPRINT_BRIDGE_TOKEN (
    echo [LOI] Khong doc duoc FINGERPRINT_BRIDGE_TOKEN tu ..\.env
    pause
    exit /b 1
)
if not defined PORT_BACKEND set "PORT_BACKEND=8000"
if not defined PORT_CLIENT_AGENT set "PORT_CLIENT_AGENT=9001"
if not defined MATCH_SCORE_THRESHOLD set "MATCH_SCORE_THRESHOLD=45"

REM ─── Xac dinh protocol ───
if /i "%USE_HTTPS%"=="true" (
    if defined SERVER_DOMAIN (
        set "WS_URL=wss://%SERVER_DOMAIN%/ws/fingerprint"
    ) else (
        set "WS_URL=wss://%SERVER_IP%:%PORT_BACKEND%/ws/fingerprint"
    )
    set "PROTO=WSS (TLS)"
) else (
    set "WS_URL=ws://%SERVER_IP%:%PORT_BACKEND%/ws/fingerprint"
    set "PROTO=WS (plaintext)"
)

REM ─── [FIX] Kiem tra CA cert khi bat HTTPS ───
set "CA_PATH="
if /i "%USE_HTTPS%"=="true" (
    if exist "rootCA.pem" (
        set "CA_PATH=rootCA.pem"
    ) else (
        echo [CANH BAO] USE_HTTPS=true nhung thieu rootCA.pem
        echo    Agent se dung Windows Trust Store ^(phai cai cert truoc^)
        echo    Hoac copy rootCA.pem vao: %CD%
    )
)

REM ─── Kiem tra file bat buoc ───
if not exist "agent.py" (
    echo [LOI] Khong tim thay agent.py trong %CD%
    pause
    exit /b 1
)
if not exist "zk_service.py" (
    echo [LOI] Khong tim thay zk_service.py trong %CD%
    pause
    exit /b 1
)
if not exist "libzkfp.dll" (
    echo [LOI] Khong tim thay libzkfp.dll
    echo Copy tu: C:\Windows\System32\libzkfp.dll
    pause
    exit /b 1
)

REM ─── Sinh .env cho agent ───
echo [INFO] Dang dong bo .env tu ..\.env...
(
    echo # Auto-generated tu s-agent.bat ^(SERVER^) - KHONG sua tay
    echo # Sinh luc: %DATE% %TIME%
    echo BACKEND_WS_URL=%WS_URL%
    echo BRIDGE_TOKEN=%FINGERPRINT_BRIDGE_TOKEN%
    echo DEVICE_SERVER_HOST=127.0.0.1
    echo DEVICE_SERVER_PORT=%PORT_CLIENT_AGENT%
    echo MATCH_SCORE_THRESHOLD=%MATCH_SCORE_THRESHOLD%
) > ".env"

if defined CA_PATH echo CA_CERT_PATH=%CA_PATH%>> ".env"

echo [OK] Da sinh .env

REM ─── Kiem tra Python + pyzkfp ───
where python >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Python trong PATH
    pause
    exit /b 1
)

python -c "import pyzkfp" >nul 2>&1
if errorlevel 1 (
    echo [LOI] Chua cai module pyzkfp
    echo Chay: pip install -r requirements.txt
    pause
    exit /b 1
)

REM ─── Hien thi cau hinh ───
set "T=%FINGERPRINT_BRIDGE_TOKEN:~0,16%"

echo.
echo --- Cau hinh hien tai ---
echo   Config root:   ..\.env
echo   Server IP:     %SERVER_IP%
if defined SERVER_DOMAIN echo   Server Domain: %SERVER_DOMAIN%
echo   WebSocket:     %WS_URL%
echo   Protocol:      %PROTO%
if defined CA_PATH (
    echo   CA Cert:       %CA_PATH%
) else (
    if /i "%USE_HTTPS%"=="true" echo   CA Cert:       ^(Windows Trust Store^)
)
echo   Device Port:   %PORT_CLIENT_AGENT%
echo   Bridge Token:  %T%...
echo.
echo   Tram kiem soat: http://127.0.0.1:%PORT_CLIENT_AGENT%/device-id
echo.

echo ==========================================
echo   Dang khoi dong Fingerprint Agent...
echo ==========================================
echo.

python agent.py

echo.
echo Agent da dung.
pause
exit /b 0