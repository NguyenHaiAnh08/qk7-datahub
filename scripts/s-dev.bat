@echo off
chcp 65001 >nul
title QK7 DataHub - Development
cd /d "%~dp0.."
set "ROOT=%CD%\"

REM ─── Đọc .env root ───
call "%~dp0load-env.bat"
if errorlevel 1 (
    pause
    exit /b 1
)

if not defined PORT_BACKEND set "PORT_BACKEND=8000"
if not defined PORT_AI set "PORT_AI=8001"
if not defined PORT_OCR set "PORT_OCR=8002"

echo ==========================================
echo   QK7 DATAHUB - CHE DO DEVELOPMENT
echo ==========================================
echo.
echo   Config: %ROOT%.env
echo.

REM --- Kiem tra va giai phong port backend, AI & OCR neu bi chiem ---
echo [Kiem tra] Giai phong port %PORT_BACKEND%, %PORT_AI%, %PORT_OCR% neu bi chiem...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $pids = (Get-NetTCPConnection -LocalPort %PORT_BACKEND%,%PORT_AI%,%PORT_OCR% -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique; if ($pids) { Write-Host ('[CANH BAO] Phat hien port dang bi chiem boi PID: ' + ($pids -join ', ') + '. Dang giai phong...'); Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 800; Write-Host '[OK] Da giai phong port thanh cong.' } else { Write-Host '[OK] Cac port dang san sang.' } } catch { Write-Host '[OK] Cac port dang san sang.' }; exit 0"
echo.

REM --- 1. Backend ---
echo [1/4] Khoi dong Backend (:%PORT_BACKEND%)...
start "QK7 Backend" cmd /k "cd /d "%ROOT%backend" && npm start"

timeout /t 4 >nul

REM --- 2. Frontend Vite dev ---
echo [2/4] Khoi dong Frontend Vite dev (:5173)...
start "QK7 Frontend Dev" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

REM --- 3. AI boxchat ---
echo [3/4] Khoi dong AI boxchat (:%PORT_AI%)...
if exist "%ROOT%boxchat\s.bat" (
    start "QK7 AI" cmd /k "cd /d "%ROOT%boxchat" && s.bat"
) else (
    start "QK7 AI" cmd /k "cd /d "%ROOT%boxchat" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) & python main.py"
)

REM --- 4. OCR Microservice ---
echo [4/4] Khoi dong OCR Microservice (:%PORT_OCR%)...
if exist "%ROOT%ocr-service\start-ocr.bat" (
    start "QK7 OCR" cmd /k "cd /d "%ROOT%ocr-service" && start-ocr.bat"
) else (
    echo [CANH BAO] Khong tim thay ocr-service\start-ocr.bat
)

echo.
echo ==========================================
echo   Dev mode san sang!
echo.
echo   Frontend:  http://localhost:5173  ^(hot reload^)
echo   Backend:   http://localhost:%PORT_BACKEND%
echo   AI API:    http://localhost:%PORT_AI%/docs
echo   OCR API:   http://localhost:%PORT_OCR%/docs
echo.
echo   Luu y: Dev mode CHI truy cap tu may nay.
echo   Muon share LAN phai dung s.bat (production).
echo ==========================================
timeout /t 5 >nul
