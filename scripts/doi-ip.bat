@echo off
chcp 65001 >nul
title QK7 DataHub - Doi IP May Chu 1 Dong Lenh
cd /d "%~dp0.."

REM ==============================================================================
REM scripts\doi-ip.bat - Chuyen doi IP may chu QK7 DataHub chi bang 1 dong lenh
REM
REM Cach dung:
REM   1) Truyen IP bat ky (vd 192.168.1.150, 10.20.30.40...):
REM        scripts\doi-ip.bat 192.168.1.150
REM   2) Khong truyen gi -> Tu dong do IP mang LAN cua may chu moi:
REM        scripts\doi-ip.bat
REM   3) Doi ca IP lan ten mien noi bo:
REM        scripts\doi-ip.bat 192.168.1.150 trungtamdulieuso.tqsqk7.edu
REM ==============================================================================

set "TARGET_IP=%~1"
set "TARGET_HOST=%~2"
if "%TARGET_HOST%"=="" set "TARGET_HOST=trungtamdulieuso.tqsqk7.edu"

REM Kiem tra quyen Administrator (can thiet de sua hosts & mo Firewall 443/80/8000)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ADMIN] Dang xin quyen Administrator de cap nhat hosts, chung chi SSL va Firewall...
    if "%TARGET_IP%"=="" (
        powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    ) else (
        powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%TARGET_IP% %TARGET_HOST%' -Verb RunAs"
    )
    exit /b
)

if "%TARGET_IP%"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch-ip.ps1" -Hostname "%TARGET_HOST%"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch-ip.ps1" -NewIP "%TARGET_IP%" -Hostname "%TARGET_HOST%"
)

echo.
if /i not "%QK7_NON_INTERACTIVE%"=="1" pause
exit /b %errorlevel%
