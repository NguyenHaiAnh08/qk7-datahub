@echo off
chcp 65001 >nul
title QK7 DataHub - Development
cd /d "%~dp0"

set "ROOT=%~dp0"

REM ─── Đọc .env root ───
call "%ROOT%load-env.bat"
if errorlevel 1 (
    pause
    exit /b 1
)

if not defined PORT_BACKEND set "PORT_BACKEND=8000"
if not defined PORT_AI set "PORT_AI=8001"

echo ==========================================
echo   QK7 DATAHUB - CHE DO DEVELOPMENT
echo ==========================================
echo.
echo   Config: %ROOT%.env
echo.

REM --- 1. Backend ---
echo [1/3] Khoi dong Backend (:%PORT_BACKEND%)...
start "QK7 Backend" cmd /k "cd /d "%ROOT%backend" && npm start"

timeout /t 4 >nul

REM --- 2. Frontend Vite dev ---
echo [2/3] Khoi dong Frontend Vite dev (:5173)...
start "QK7 Frontend Dev" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

REM --- 3. AI boxchat ---
echo [3/3] Khoi dong AI boxchat (:%PORT_AI%)...
start "QK7 AI" cmd /k "cd /d "%ROOT%boxchat" && python main.py"

echo.
echo ==========================================
echo   Dev mode san sang!
echo.
echo   Frontend:  http://localhost:5173  ^(hot reload^)
echo   Backend:   http://localhost:%PORT_BACKEND%
echo   AI API:    http://localhost:%PORT_AI%/docs
echo.
echo   Luu y: Dev mode CHI truy cap tu may nay.
echo   Muon share LAN phai dung s.bat (production).
echo ==========================================
timeout /t 5 >nul