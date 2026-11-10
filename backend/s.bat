@echo off
chcp 65001 >nul
title QK7 DataHub - Backend Gateway (:8000)
cd /d "%~dp0"

echo ==========================================
echo   QK7 DataHub - BACKEND GATEWAY
echo ==========================================
echo.

echo [1/2] Kiem tra va giai phong port 8000 neu dang bi chiem dung...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $pids = (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction Stop).OwningProcess | Select-Object -Unique; if ($pids) { Write-Host ('[CANH BAO] Phat hien port 8000 dang bi chiem boi PID: ' + ($pids -join ', ') + '. Dang giai phong...'); Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 800; Write-Host '[OK] Da giai phong port 8000 thanh cong.' } else { Write-Host '[OK] Port 8000 dang san sang.' } } catch { Write-Host '[OK] Port 8000 dang san sang.' }; exit 0"

echo.
echo [2/2] Khoi dong Backend Gateway (:8000)...
npm start

