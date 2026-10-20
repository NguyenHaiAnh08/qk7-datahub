@echo off
chcp 65001 >nul
title Khoi dong he thong

echo ========================================
echo   DANG KHOI DONG CAC SERVICE...
echo ========================================
echo.

REM %~dp0 = thu muc chua file .bat nay (tu dong lay duong dan tuyet doi)
set "ROOT=%~dp0"

REM --- 1. Backend (Node.js) ---
echo [1/3] Khoi dong Backend...
start "Backend - npm start" cmd /k "cd /d "%ROOT%backend" && npm start"

REM --- 2. Frontend (Vite/Next...) ---
echo [2/3] Khoi dong Frontend...
start "Frontend - npm run dev" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

REM --- 3. Fingerprint Service (Python) ---
echo [3/3] Khoi dong Fingerprint Service...
start "Fingerprint Service - python agent.py" cmd /k "cd /d "%ROOT%fingerprint-service" && python agent.py"

echo.
echo ========================================
echo   DA KHOI DONG TAT CA SERVICE!
echo   (Moi service chay trong 1 cua so rieng)
echo ========================================
timeout /t 3 >nul
exit