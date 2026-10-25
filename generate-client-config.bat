@echo off
chcp 65001 >nul
title QK7 - Sinh config cho client
cd /d "%~dp0"

call "%~dp0load-env.bat"
if errorlevel 1 (
    pause
    exit /b 1
)

if not defined SERVER_IP (
    echo [LOI] Khong doc duoc SERVER_IP tu .env
    pause
    exit /b 1
)

if not defined FINGERPRINT_BRIDGE_TOKEN (
    echo [LOI] Khong doc duoc FINGERPRINT_BRIDGE_TOKEN tu .env
    pause
    exit /b 1
)

if not defined PORT_BACKEND set "PORT_BACKEND=8000"
if not defined PORT_CLIENT_AGENT set "PORT_CLIENT_AGENT=9001"
if not defined MATCH_SCORE_THRESHOLD set "MATCH_SCORE_THRESHOLD=45"

REM Xac dinh protocol WebSocket
if /i "%USE_HTTPS%"=="true" (
    set "WS_PROTO=wss"
) else (
    set "WS_PROTO=ws"
)

if not exist "config" mkdir config

(
    echo # ============================================================
    echo # QK7 CLIENT CONFIG - Sinh tu server .env
    echo # Generated: %DATE% %TIME%
    echo # Copy vao: C:\QK7Agent\.env
    echo # ============================================================
    echo.
    echo BACKEND_WS_URL=%WS_PROTO%://%SERVER_IP%:%PORT_BACKEND%/ws/fingerprint
    echo BRIDGE_TOKEN=%FINGERPRINT_BRIDGE_TOKEN%
    echo DEVICE_SERVER_HOST=127.0.0.1
    echo DEVICE_SERVER_PORT=%PORT_CLIENT_AGENT%
    echo MATCH_SCORE_THRESHOLD=%MATCH_SCORE_THRESHOLD%
) > "config\client.info"

copy /Y "config\client.info" "config\client.info.example" >nul 2>&1

echo [OK] Da sinh: %~dp0config\client.info
echo.
echo --- NOI DUNG ---
type "config\client.info"
echo ----------------
echo.
echo Buoc tiep theo:
echo   1. Copy file client.info qua share LAN
echo      Vi du: \\%SERVER_IP%\QK7Share\client.info
echo   2. Tren client: copy vao C:\QK7Agent\.env
echo      (doi ten tu client.info thanh .env)
echo   3. Chay: C:\QK7Agent\s-agent.bat
echo.
pause