@echo off
chcp 65001 >nul
title QK7 DataHub - Development

cd /d "%~dp0"
set "ROOT=%~dp0"

echo ==========================================
echo   QK7 DATAHUB - CHE DO DEVELOPMENT
echo ==========================================
echo.

REM --- 1. Backend (:8000) ---
echo [1/3] Khoi dong Backend (:8000)...
start "QK7 Backend" cmd /k "cd /d "%ROOT%backend" && npm start"

timeout /t 4 >nul

REM --- 2. Frontend Vite dev (:5173) ---
echo [2/3] Khoi dong Frontend Vite dev (:5173)...
start "QK7 Frontend Dev" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

REM --- 3. AI boxchat (:8001) ---
echo [3/3] Khoi dong AI boxchat (:8001)...
start "QK7 AI" cmd /k "cd /d "%ROOT%boxchat" && python main.py"

echo.
echo ==========================================
echo   Dev mode san sang!
echo.
echo   Frontend:  http://localhost:5173  ^(hot reload^)
echo   Backend:   http://localhost:8000
echo   AI API:    http://localhost:8001/docs
echo.
echo   Luu y: Dev mode CHI truy cap tu may nay.
echo   Muon share LAN phai dung s.bat (production).
echo ==========================================
timeout /t 5 >nul