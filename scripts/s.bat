@echo off
chcp 65001 >nul
title QK7 DataHub - Khoi dong Server
cd /d "%~dp0.."
set "ROOT=%CD%\"
set "FRONTEND_BUILT=0"

REM Kiem tra xem frontend da build chua
if exist "%ROOT%backend\public\index.html" (
    set "FRONTEND_BUILT=1"
)

echo ==========================================
echo   QK7 DataHub - KHOI DONG SERVER
echo ==========================================
echo.

REM --- Kiem tra va giai phong port 8000, 8001, 8002 neu bi chiem ---
echo [0/3] Kiem tra va giai phong port 8000, 8001, 8002...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $pids = (Get-NetTCPConnection -LocalPort 8000,8001,8002 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique; if ($pids) { Write-Host ('[CANH BAO] Phat hien port dang bi chiem boi PID: ' + ($pids -join ', ') + '. Dang giai phong...'); Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 800; Write-Host '[OK] Da giai phong port thanh cong.' } else { Write-Host '[OK] Cac port dang san sang.' } } catch { Write-Host '[OK] Cac port dang san sang.' }; exit 0"
echo.

REM Kiem tra va khoi dong Ollama neu chua chay
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $null = Invoke-WebRequest -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 1 -UseBasicParsing; Write-Host '[OK] Ollama server dang chay.' } catch { if (Test-Path \"$env:LOCALAPPDATA\Programs\Ollama\ollama.exe\") { Write-Host '[INFO] Dang khoi dong Ollama serve...'; Start-Process \"$env:LOCALAPPDATA\Programs\Ollama\ollama.exe\" -ArgumentList 'serve' -WindowStyle Hidden; Start-Sleep -Seconds 2; Write-Host '[OK] Da khoi dong Ollama.' } else { Write-Host '[CANH BAO] Khong tim thay Ollama.' } }"
echo.

REM --- 1. Backend ---
if not exist "%ROOT%backend\node_modules" (
    echo [LOI] Chua cai dependencies backend.
    echo Chay: cd backend ^&^& npm install
    pause
    exit /b 1
)
echo [1/3] Khoi dong Backend (:8000)...
start "QK7 Backend" cmd /k "cd /d "%ROOT%backend" && npm start"

REM Doi backend khoi dong
timeout /t 4 >nul

REM --- 2. AI boxchat ---
echo [2/3] Khoi dong AI boxchat (:8001)...
start "QK7 AI" cmd /k "cd /d "%ROOT%boxchat" && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) && echo [QK7 AI] Luu y: Khong click chuot vao giua man hinh de tranh dong bang (pause) console! && python main.py"

REM --- 3. OCR Microservice (MonkeyOCRv2 / PaddleOCR) ---
echo [3/3] Khoi dong OCR Microservice (:8002)...
if exist "%ROOT%ocr-service\start-ocr.bat" (
    start "QK7 OCR" cmd /k "cd /d "%ROOT%ocr-service" && start-ocr.bat"
) else (
    echo [CANH BAO] Khong tim thay ocr-service\start-ocr.bat
)

echo.
echo ==========================================
if "%FRONTEND_BUILT%"=="1" (
    echo   Server da khoi dong!
    echo   Web:     http://localhost:8000
    echo.
    echo   [OK] Frontend da build san - khong can npm run dev
) else (
    echo   Server da khoi dong!
    echo   Web:     http://localhost:8000
    echo.
    echo   [CANH BAO] Chua build frontend!
    echo   Lan dau can chay: cd frontend ^&^& npm run build
    echo   Hoac dung s-dev.bat de chay dev mode
)
echo.
echo   Swagger: http://localhost:8000/api-docs
echo   AI API:  http://localhost:8001/docs
echo   OCR API: http://localhost:8002/docs
echo ==========================================
timeout /t 5 >nul
