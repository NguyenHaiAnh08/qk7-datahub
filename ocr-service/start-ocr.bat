@echo off
chcp 65001 >nul
title QK7 DataHub - OCR Service v2 (:8002)
cd /d "%~dp0"

echo ==========================================
echo   QK7 DataHub - OCR MICROSERVICE v2.0
echo   Engine: MonkeyOCRv2 / PaddleOCR
echo   Port  : 8002
echo ==========================================
echo.

REM --- 1. Kiem tra va kich hoat moi truong Python ---
set "PYTHON_EXE=python"

REM Kiem tra xem co Conda env 'MonkeyOCRv2Parsing' khong
where conda >nul 2>&1
if %ERRORLEVEL% equ 0 (
    call conda activate MonkeyOCRv2Parsing >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo [OK] Da kich hoat Conda env: MonkeyOCRv2Parsing
        set "PYTHON_EXE=python"
        goto :env_ready
    )
)

REM Kiem tra thu muc venv cuc bo
if exist "%~dp0venv\Scripts\python.exe" (
    echo [OK] Su dung virtualenv cuc bo: %~dp0venv
    set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
    goto :env_ready
)

echo [INFO] Su dung Python mac dinh tren he thong.

:env_ready

REM --- 2. Giai phong port 8002 neu bi chiem ---
echo.
echo [1/3] Kiem tra va giai phong port 8002...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { $pids = (Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction Stop).OwningProcess | Select-Object -Unique; if ($pids) { Write-Host ('[CANH BAO] Port 8002 dang bi chiem boi PID: ' + ($pids -join ', ') + '. Dang giai phong...'); Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 800; Write-Host '[OK] Da giai phong port 8002.' } else { Write-Host '[OK] Port 8002 san sang.' } } catch { Write-Host '[OK] Port 8002 san sang.' }; exit 0"

REM --- 3. Cau hinh engine va tham so ---
echo.
echo [2/3] Cau hinh OCR Engine...

REM OCR_ENGINE: "auto"      = thu MonkeyOCRv2 truoc, fallback PaddleOCR
REM             "monkey"    = chi MonkeyOCRv2
REM             "paddleocr" = chi PaddleOCR (hieu nang nhanh hon)
if not defined OCR_ENGINE set "OCR_ENGINE=auto"

REM Device: "auto" = tu dong chon CUDA neu co, nguoc lai CPU
REM         "cpu"  = ep CPU (an toan, luon chay duoc)
if not defined MONKEY_DEVICE set "MONKEY_DEVICE=cpu"

echo    OCR_ENGINE   = %OCR_ENGINE%
echo    MONKEY_DEVICE= %MONKEY_DEVICE%
echo    PORT         = 8002

REM --- 4. Khoi dong Microservice ---
echo.
echo [3/3] Khoi dong OCR Microservice tren cong 8002...
echo -------------------------------------------

"%PYTHON_EXE%" main.py

echo.
echo [EXIT] OCR Service da dung. Ma loi: %ERRORLEVEL%
echo Nhan phim bat ky de dong cua so...
pause >nul
