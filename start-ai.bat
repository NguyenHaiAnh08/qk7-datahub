@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title QK7 DataHub - Khoi dong AI Boxchat 8001
cd /d "%~dp0"

set "ROOT=%~dp0"

REM --- Load .env goc neu ton tai ---
if exist "%ROOT%load-env.bat" (
    call "%ROOT%load-env.bat" >nul 2>&1
)

cd /d "%ROOT%boxchat"

echo ==========================================
echo   QK7 DataHub - KHOI DONG AI BOXCHAT 8001
echo ==========================================
echo.

REM --- 1. Kiem tra va Khoi dong Ollama ---
echo [1/4] Kiem tra dich vu Ollama (http://127.0.0.1:11434)...
curl.exe -s http://127.0.0.1:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo [Thong bao] Ollama chua chay, dang khoi dong Ollama service...
    start "QK7 Ollama Server" cmd /c "ollama serve"
    echo Dang cho Ollama san sang...
    set "OLLAMA_UP=0"
    for /l %%i in (1,1,10) do (
        if "!OLLAMA_UP!"=="0" (
            ping 127.0.0.1 -n 2 >nul
            curl.exe -s http://127.0.0.1:11434/api/tags >nul 2>&1
            if not errorlevel 1 set "OLLAMA_UP=1"
        )
    )
    if "!OLLAMA_UP!"=="1" (
        echo [OK] Ollama da khoi dong thanh cong tren cong 11434.
    ) else (
        echo [CANH BAO] Ollama phan hoi cham, tiep tuc khoi dong boxchat voi che do fallback an toan.
    )
) else (
    echo [OK] Ollama dang chay truc tuyen tren cong 11434.
)

REM --- 2. Kiem tra Thu vien Python ---
echo [2/4] Kiem tra thu vien Python...
python -c "import fastapi, uvicorn, qdrant_client, requests" >nul 2>&1
if errorlevel 1 (
    echo [Thong bao] Dang cai dat cac thu vien Python con thieu...
    python -m pip install -r requirements.txt
) else (
    echo [OK] Thu vien Python da san sang.
)

REM --- 3. Giai phong triet de cong 8001 va khoa Qdrant ---
echo [3/4] Kiem tra va giai phong cong 8001...
if exist "%ROOT%boxchat\free-port.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%boxchat\free-port.ps1"
) else (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":8001[ ]" ^| findstr LISTENING') do (
        if not "%%a"=="0" taskkill /f /t /pid %%a >nul 2>&1
    )
    if exist "%ROOT%boxchat\local_storage\qdrant_data\.lock" (
        del /f /q "%ROOT%boxchat\local_storage\qdrant_data\.lock" >nul 2>&1
    )
)
ping 127.0.0.1 -n 2 >nul
echo [OK] Cong 8001 va Qdrant da san sang.

REM --- 4. Khoi dong FastAPI Boxchat ---
echo [4/4] Khoi dong Microservice AI Boxchat...
echo.
echo ==========================================
echo   TRANG THAI AI BOXCHAT:
echo   - Local API: http://127.0.0.1:8001
echo   - Swagger:   http://127.0.0.1:8001/docs
echo   - Health:    http://127.0.0.1:8001/ai/health
echo ==========================================
echo.

python main.py

pause