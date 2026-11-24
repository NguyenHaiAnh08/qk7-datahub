@echo off
chcp 65001 >nul
title QK7 DataHub - May Chu DNS Noi Bo Tu Chu (Port 53)
cd /d "%~dp0.."

REM ==============================================================================
REM scripts\start-dns.bat - Khoi dong May chu DNS Noi bo (Phuong An 2)
REM Giup moi PC Windows & iPad Air M4 trong mang LAN/Wi-Fi tu dong hieu ten mien
REM https://trungtamdulieuso.tqsqk7.edu ma KHONG can sua file hosts tren may con!
REM ==============================================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ADMIN] Dang xin quyen Administrator de mo cong DNS 53 va Firewall...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

REM Tu dong mo tuong lua cong DNS 53 (UDP + TCP) cho mang LAN noi bo (bo qua neu dich vu Windows Firewall dang tat)
powershell -NoProfile -ExecutionPolicy Bypass -Command "if ((Get-Service MpsSvc -ErrorAction SilentlyContinue).Status -ne 'Running') { Write-Host '[DNS] Windows Firewall dang tat - khong can mo cong 53.'; exit 0 }; if (-not (Get-NetFirewallRule -DisplayName 'QK7 Internal DNS 53 UDP' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName 'QK7 Internal DNS 53 UDP' -Direction Inbound -LocalPort 53 -Protocol UDP -Action Allow -Profile Any | Out-Null }; if (-not (Get-NetFirewallRule -DisplayName 'QK7 Internal DNS 53 TCP' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName 'QK7 Internal DNS 53 TCP' -Direction Inbound -LocalPort 53 -Protocol TCP -Action Allow -Profile Any | Out-Null }"

echo [DNS] Dang khoi dong QK7 Internal Authoritative DNS Server (:53)...
node "%~dp0dns-server.js"
pause
