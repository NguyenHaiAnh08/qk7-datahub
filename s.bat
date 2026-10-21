@echo off
chcp 65001 >nul
title QK7 DataHub - Khoi dong Server
cd /d "%~dp0"

set "ROOT=%~dp0"
set "FRONTEND_BUILT=0"

REM Kiem tra xem frontend da build chua
if exist "%ROOT%backend\public\index.html" (
    set "FRONTEND_BUILT=1"
)

echo ==========================================
echo   QK7 DataHub - KHOI DONG SERVER
echo ==========================================
echo.

REM --- Backend ---
if not exist "%ROOT%backend\node_modules" (
    echo [LOI] Chua cai dependencies backend.
    echo Chay: cd backend ^&^& npm install
    pause
    exit /b 1
)
echo [1/2] Khoi dong Backend (:8000)...
start "QK7 Backend" cmd /k "cd /d "%ROOT%backend" && npm start"

REM Doi backend khoi dong
timeout /t 4 >nul

REM --- AI boxchat ---
echo [2/2] Khoi dong AI boxchat (:8001)...
start "QK7 AI" cmd /k "cd /d "%ROOT%boxchat" && python main.py"

echo.
echo ==========================================
if "%FRONTEND_BUILT%"=="1" (
    echo   Server da khoi dong!
    echo   Web:   http://191.168.1.1:8000
    echo.
    echo   [OK] Frontend da build san - khong can npm run dev
) else (
    echo   Server da khoi dong!
    echo   Web:   http://191.168.1.1:8000
    echo.
    echo   [CANH BAO] Chua build frontend!
    echo   Lan dau can chay: cd frontend ^&^& npm run build
    echo   Hoac dung start-dev.bat de chay dev mode
)
echo.
echo   Swagger: http://191.168.1.1:8000/api-docs
echo   AI API:  http://191.168.1.1:8001/docs
echo ==========================================
timeout /t 5 >nul