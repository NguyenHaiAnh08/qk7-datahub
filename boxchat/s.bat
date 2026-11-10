@echo off
chcp 65001 >nul
title QK7 DataHub - AI Boxchat (:8001)
cd /d "%~dp0"

echo ==========================================
echo   QK7 DataHub - AI BOXCHAT MICROSERVICE
echo ==========================================
echo.

REM --- 1. Kiem tra va giai phong port 8001 ---
echo [1/3] Kiem tra va giai phong port 8001...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $pids = (Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction Stop).OwningProcess | Select-Object -Unique; if ($pids) { Write-Host ('[CANH BAO] Phat hien port 8001 dang bi chiem boi PID: ' + ($pids -join ', ') + '. Dang giai phong...'); Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 800; Write-Host '[OK] Da giai phong port 8001 thanh cong.' } else { Write-Host '[OK] Port 8001 dang san sang.' } } catch { Write-Host '[OK] Port 8001 dang san sang.' }; exit 0"

REM --- 2. Xoa lock Qdrant neu con sot ---
if exist "%~dp0local_storage\qdrant_data\.lock" (
    echo [2/3] Xoa file lock Qdrant...
    del /f /q "%~dp0local_storage\qdrant_data\.lock" >nul 2>&1
) else (
    echo [2/3] Qdrant storage da san sang.
)

REM --- 3. Khoi dong Microservice ---
echo.
echo [3/3] Khoi dong AI Boxchat (:8001)...
python main.py

