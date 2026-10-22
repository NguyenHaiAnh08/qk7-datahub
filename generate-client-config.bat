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

if not exist "config" mkdir config

(
    echo # ============================================================
    echo # QK7 CLIENT CONFIG — Sinh tu server .env
    echo # Generated: %DATE% %TIME%
    echo # Copy vao: C:\QK7Agent\config\client.info
    echo # ============================================================
    echo.
    echo SERVER_IP=%SERVER_IP%
    echo SERVER_DOMAIN=%SERVER_DOMAIN%
    echo USE_HTTPS=%USE_HTTPS%
    echo PORT_BACKEND=%PORT_BACKEND%
    echo PORT_CLIENT_AGENT=%PORT_CLIENT_AGENT%
    echo.
    echo BRIDGE_TOKEN=%FINGERPRINT_BRIDGE_TOKEN%
    echo.
    echo MATCH_SCORE_THRESHOLD=%MATCH_SCORE_THRESHOLD%
) > "config\client.info"

copy /Y "config\client.info" "config\client.info.example" >nul 2>&1

echo [OK] Da sinh: %~dp0config\client.info
echo.
echo Buoc tiep theo:
echo   1. Copy file nay qua share LAN
echo      Vi du: \\%SERVER_IP%\QK7Share\client.info
echo   2. Tren client: dat vao C:\QK7Agent\config\client.info
echo   3. Chay: s-agent.bat
echo.
pause