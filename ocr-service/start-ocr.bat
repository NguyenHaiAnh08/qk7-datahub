@echo off
chcp 65001 >nul
title QK7 DataHub - OCR Service (:8002)
cd /d "%~dp0"

echo ==========================================
echo   QK7 DataHub - OCR MICROSERVICE (:8002)
echo ==========================================
echo.

REM --- 1. Kiem tra va giai phong port 8002 ---
echo [1/2] Kiem tra va giai phong port 8002...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $pids = (Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction Stop).OwningProcess | Select-Object -Unique; if ($pids) { Write-Host ('[CANH BAO] Phat hien port 8002 dang bi chiem boi PID: ' + ($pids -join ', ') + '. Dang giai phong...'); Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 800; Write-Host '[OK] Da giai phong port 8002 thanh cong.' } else { Write-Host '[OK] Port 8002 dang san sang.' } } catch { Write-Host '[OK] Port 8002 dang san sang.' }; exit 0"

REM --- 2. Khoi dong Microservice ---
echo.
echo [2/2] Khoi dong OCR Microservice (:8002)...
if exist "%~dp0venv\Scripts\python.exe" (
    "%~dp0venv\Scripts\python.exe" main.py
) else (
    python main.py
)

