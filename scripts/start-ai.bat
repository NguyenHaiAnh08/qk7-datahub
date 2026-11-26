@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title QK7 DataHub - Khoi dong AI Boxchat 8001
cd /d "%~dp0.."
set "ROOT=%CD%\"

REM --- Tu dong bo sung Python 3.13 vao PATH ---
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python313;%LOCALAPPDATA%\Programs\Python\Python313\Scripts;%PATH%"
)

REM --- Load .env goc neu ton tai ---
if exist "%~dp0load-env.bat" (
    call "%~dp0load-env.bat" >nul 2>&1
)

cd /d "%ROOT%boxchat"

echo ==========================================
echo   QK7 DataHub - KHOI DONG AI BOXCHAT 8001
echo ==========================================
echo.

REM --- 1. Cau hinh GPU/VRAM Guard va Khoi dong Ollama ---
set "PORT=8001"
if not defined OLLAMA_HOST set "OLLAMA_HOST=127.0.0.1:11434"
if not defined OLLAMA_FLASH_ATTENTION set "OLLAMA_FLASH_ATTENTION=1"
if not defined OLLAMA_KV_CACHE_TYPE set "OLLAMA_KV_CACHE_TYPE=q8_0"
if not defined OLLAMA_NUM_PARALLEL set "OLLAMA_NUM_PARALLEL=1"
if not defined OLLAMA_MAX_LOADED_MODELS set "OLLAMA_MAX_LOADED_MODELS=2"
if not defined OLLAMA_KEEP_ALIVE set "OLLAMA_KEEP_ALIVE=3m"
if not defined OLLAMA_NUM_CTX set "OLLAMA_NUM_CTX=4096"
if not defined OLLAMA_EMBED_NUM_CTX set "OLLAMA_EMBED_NUM_CTX=2048"
if not defined OLLAMA_NUM_GPU set "OLLAMA_NUM_GPU=99"

echo [1/4] Kiem tra dich vu Ollama (http://127.0.0.1:11434)...
curl.exe -s http://127.0.0.1:11434/api/tags >nul 2>&1
if errorlevel 1 (
    set "OLLAMA_BIN=ollama"
    where ollama >nul 2>&1
    if errorlevel 1 (
        if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
            set "OLLAMA_BIN=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
        )
    )
    echo [Thong bao] Ollama chua chay, dang khoi dong Ollama GPU service...
    start "QK7 Ollama GPU Server" /min "!OLLAMA_BIN!" serve
    echo Dang cho Ollama san sang...
    set "OLLAMA_UP=0"
    for /l %%i in (1,1,15) do (
        if "!OLLAMA_UP!"=="0" (
            ping 127.0.0.1 -n 2 >nul
            curl.exe -s http://127.0.0.1:11434/api/tags >nul 2>&1
            if not errorlevel 1 set "OLLAMA_UP=1"
        )
    )
    if "!OLLAMA_UP!"=="1" (
        echo [OK] Ollama GPU Server da khoi dong thanh cong tren cong 11434.
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