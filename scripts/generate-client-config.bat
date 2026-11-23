@echo off
chcp 65001 >nul
title QK7 - Sinh config cho client
cd /d "%~dp0.."

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
if not defined PUBLIC_HTTPS_PORT set "PUBLIC_HTTPS_PORT=443"

REM Xac dinh protocol & URL WebSocket (Uu tien ten mien noi bo khi co SERVER_DOMAIN)
if /i "%USE_HTTPS%"=="true" (
    set "WS_PROTO=wss"
    if defined SERVER_DOMAIN (
        if "%PUBLIC_HTTPS_PORT%"=="443" (
            set "WS_URL=wss://%SERVER_DOMAIN%/ws/fingerprint"
        ) else (
            set "WS_URL=wss://%SERVER_DOMAIN%:%PORT_BACKEND%/ws/fingerprint"
        )
    ) else (
        set "WS_URL=wss://%SERVER_IP%:%PORT_BACKEND%/ws/fingerprint"
    )
) else (
    set "WS_PROTO=ws"
    set "WS_URL=ws://%SERVER_IP%:%PORT_BACKEND%/ws/fingerprint"
)

if not exist "config" mkdir config

(
    echo # ============================================================
    echo # QK7 CLIENT CONFIG - Sinh tu server .env
    echo # Generated: %DATE% %TIME%
    echo # Copy vao: C:\QK7Agent\.env
    echo # Luu y: Dung ten mien noi bo de 1.000.000+ may tram khong can
    echo #        sua cau hinh khi doi IP may chu!
    echo # ============================================================
    echo.
    echo BACKEND_WS_URL=%WS_URL%
    echo # Fallback theo IP truc tiep: %WS_PROTO%://%SERVER_IP%:%PORT_BACKEND%/ws/fingerprint
    echo BRIDGE_TOKEN=%FINGERPRINT_BRIDGE_TOKEN%
    echo DEVICE_SERVER_HOST=127.0.0.1
    echo DEVICE_SERVER_PORT=%PORT_CLIENT_AGENT%
    echo MATCH_SCORE_THRESHOLD=%MATCH_SCORE_THRESHOLD%
) > "config\client.info"

echo [OK] Da sinh: %CD%\config\client.info
echo.
echo --- NOI DUNG ---
type "config\client.info"
echo ----------------
echo.
echo Buoc tiep theo:
echo   1. Copy file client.info qua share LAN
echo      Vi du: \\%SERVER_IP%\QK7Share\client.info
echo   2. Tren client: copy vao C:\QK7Agent\.env
echo      ^(doi ten tu client.info thanh .env^)
echo   3. Chay: C:\QK7Agent\s-agent.bat
echo.
if /i not "%QK7_NON_INTERACTIVE%"=="1" pause
