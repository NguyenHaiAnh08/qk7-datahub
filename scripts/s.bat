@echo off
chcp 65001 >nul
title QK7 DataHub - Khoi dong Server
cd /d "%~dp0.."
set "ROOT=%CD%\"
set "FRONTEND_BUILT=0"

REM Doc cau hinh tu .env root (neu co)
if exist "%ROOT%.env" call "%~dp0load-env.bat" >nul 2>&1
if not defined PORT_BACKEND set "PORT_BACKEND=8000"
if not defined SERVER_DOMAIN set "SERVER_DOMAIN=trungtamdulieuso.tqsqk7.edu"
if not defined USE_HTTPS set "USE_HTTPS=true"

if /i "%USE_HTTPS%"=="true" (
    set "PROTO=https"
) else (
    set "PROTO=http"
)

REM Kiem tra xem frontend da build chua
if exist "%ROOT%backend\public\index.html" (
    set "FRONTEND_BUILT=1"
)

echo ==========================================
echo   QK7 DataHub - KHOI DONG SERVER
echo ==========================================
echo.

REM --- Kiem tra va giai phong port 8000, 8001, 8002 neu bi chiem ---
echo [0/3] Kiem tra va giai phong port %PORT_BACKEND%, 8001, 8002...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $pids = (Get-NetTCPConnection -LocalPort %PORT_BACKEND%,8001,8002 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique; if ($pids) { Write-Host ('[CANH BAO] Phat hien port dang bi chiem boi PID: ' + ($pids -join ', ') + '. Dang giai phong...'); Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 800; Write-Host '[OK] Da giai phong port thanh cong.' } else { Write-Host '[OK] Cac port dang san sang.' } } catch { Write-Host '[OK] Cac port dang san sang.' }; exit 0"
echo.

REM --- 1. Backend ---
if not exist "%ROOT%backend\node_modules" (
    echo [LOI] Chua cai dependencies backend.
    echo Chay: cd backend ^&^& npm install
    pause
    exit /b 1
)
echo [1/3] Khoi dong Backend (:%PORT_BACKEND% + HTTPS :443)...
start "QK7 Backend" cmd /k "cd /d "%ROOT%backend" && npm start"

REM Doi backend khoi dong
timeout /t 4 >nul

REM --- 2. AI boxchat ---
echo [2/3] Khoi dong AI boxchat (:8001)...
if exist "%ROOT%boxchat\s.bat" (
    start "QK7 AI" cmd /k "cd /d "%ROOT%boxchat" && s.bat"
) else (
    start "QK7 AI" cmd /k "cd /d "%ROOT%boxchat" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) & python main.py"
)

REM --- 3. OCR Microservice (MonkeyOCRv2 / PaddleOCR) ---
echo [3/3] Khoi dong OCR Microservice (:8002)...
if exist "%ROOT%ocr-service\start-ocr.bat" (
    start "QK7 OCR" cmd /k "cd /d "%ROOT%ocr-service" && start-ocr.bat"
) else (
    echo [CANH BAO] Khong tim thay ocr-service\start-ocr.bat
)

REM --- 4. DNS noi bo (:53) - may con khong can sua hosts. start-dns.bat tu xin quyen Admin (UAC) ---
echo [4/4] Khoi dong DNS noi bo (:53)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetUDPEndpoint -LocalPort 53 -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 (
    echo [OK] Port 53 da co dich vu DNS dang chay - bo qua.
) else if exist "%~dp0start-dns.bat" (
    start "QK7 DNS" cmd /c ""%~dp0start-dns.bat""
    echo [OK] Da goi DNS noi bo - bam Yes o hop thoai Administrator neu duoc hoi.
) else (
    echo [CANH BAO] Khong tim thay scripts\start-dns.bat
)

echo.
echo ==========================================================
echo   Server da khoi dong!
if /i "%USE_HTTPS%"=="true" (
    echo   Web ^(Chuan 443^):   https://%SERVER_DOMAIN%
    echo   Web ^(Port %PORT_BACKEND%^):    https://%SERVER_DOMAIN%:%PORT_BACKEND%
    echo   Cai chung chi LAN: http://%SERVER_DOMAIN%/ca  ^(iPad Air M4 ^& Windows PC^)
) else (
    echo   Web:               http://localhost:%PORT_BACKEND%
)
echo   DNS Noi bo (:53):  Tu dong khoi dong (cua so "QK7 DNS"), may con khong can sua hosts
if "%FRONTEND_BUILT%"=="1" (
    echo.
    echo   [OK] Frontend da build san - khong can npm run dev
) else (
    echo.
    echo   [CANH BAO] Chua build frontend!
    echo   Lan dau can chay: cd frontend ^&^& npm run build
    echo   Hoac dung s-dev.bat de chay dev mode
)
echo.
echo   Swagger: %PROTO%://localhost:%PORT_BACKEND%/api-docs
echo   AI API:  http://localhost:8001/docs
echo   OCR API: http://localhost:8002/docs
echo ==========================================================
timeout /t 5 >nul
