@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title QK7 DataHub - AI Boxchat (:8001)
cd /d "%~dp0"

echo ==========================================
echo   QK7 DataHub - AI BOXCHAT MICROSERVICE
echo ==========================================
echo.

REM --- 0. Cau hinh GPU/VRAM Guard cho Ollama (GTX 1650 4GB VRAM + 8GB RAM) ---
set "PORT=8001"
if not defined OLLAMA_HOST set "OLLAMA_HOST=127.0.0.1:11434"
if not defined OLLAMA_BASE_URL set "OLLAMA_BASE_URL=http://127.0.0.1:11434"
if not defined OLLAMA_MODEL set "OLLAMA_MODEL=qwen2.5:3b"
if not defined OLLAMA_EMBED_MODEL set "OLLAMA_EMBED_MODEL=bge-m3"
if not defined OLLAMA_FLASH_ATTENTION set "OLLAMA_FLASH_ATTENTION=1"
if not defined OLLAMA_KV_CACHE_TYPE set "OLLAMA_KV_CACHE_TYPE=q8_0"
if not defined OLLAMA_NUM_PARALLEL set "OLLAMA_NUM_PARALLEL=1"
if not defined OLLAMA_MAX_LOADED_MODELS set "OLLAMA_MAX_LOADED_MODELS=2"
if not defined OLLAMA_KEEP_ALIVE set "OLLAMA_KEEP_ALIVE=3m"
if not defined OLLAMA_NUM_CTX set "OLLAMA_NUM_CTX=4096"
if not defined OLLAMA_EMBED_NUM_CTX set "OLLAMA_EMBED_NUM_CTX=2048"
if not defined OLLAMA_NUM_GPU set "OLLAMA_NUM_GPU=99"

REM --- 1. Kiem tra va khoi dong Ollama GPU Server (127.0.0.1:11434) ---
echo [1/4] Kiem tra Ollama GPU Server (%OLLAMA_BASE_URL%)...
curl.exe -s %OLLAMA_BASE_URL%/api/tags >nul 2>&1
if errorlevel 1 (
    set "OLLAMA_BIN=ollama"
    where ollama >nul 2>&1
    if errorlevel 1 (
        if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
            set "OLLAMA_BIN=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
        )
    )
    echo [Thong bao] Ollama chua chay. Dang khoi dong headless Ollama GPU Server...
    echo   FLASH_ATTN=%OLLAMA_FLASH_ATTENTION% ^| KV_CACHE=%OLLAMA_KV_CACHE_TYPE% ^| MAX_MODELS=%OLLAMA_MAX_LOADED_MODELS% ^| KEEP_ALIVE=%OLLAMA_KEEP_ALIVE%
    start "QK7 Ollama GPU Server" /min "!OLLAMA_BIN!" serve
    set "OLLAMA_UP=0"
    for /l %%i in (1,1,15) do (
        if "!OLLAMA_UP!"=="0" (
            ping 127.0.0.1 -n 2 >nul
            curl.exe -s %OLLAMA_BASE_URL%/api/tags >nul 2>&1
            if not errorlevel 1 set "OLLAMA_UP=1"
        )
    )
    if "!OLLAMA_UP!"=="1" (
        echo [OK] Ollama GPU Server da san sang tren %OLLAMA_HOST%.
    ) else (
        echo [CANH BAO] Ollama chua phan hoi trong 15s, boxchat se khoi dong va tu ket noi lai.
    )
) else (
    echo [OK] Ollama dang chay truc tuyen tai %OLLAMA_BASE_URL%.
)

REM --- 2. Kiem tra va giai phong port 8001 ---
echo [2/4] Kiem tra va giai phong port 8001...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $pids = (Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue).OwningProcess | Where-Object { $_ -gt 0 } | Select-Object -Unique; if ($pids) { Write-Host ('[CANH BAO] Phat hien port 8001 dang bi chiem boi PID: ' + ($pids -join ', ') + '. Dang giai phong...'); Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 800; Write-Host '[OK] Da giai phong port 8001 thanh cong.' } else { Write-Host '[OK] Port 8001 dang san sang.' } } catch { Write-Host '[OK] Port 8001 dang san sang.' }; exit 0"

REM --- 3. Xoa lock Qdrant neu con sot ---
if exist "%~dp0local_storage\qdrant_data\.lock" (
    echo [3/4] Xoa file lock Qdrant...
    del /f /q "%~dp0local_storage\qdrant_data\.lock" >nul 2>&1
) else (
    echo [3/4] Qdrant storage da san sang.
)

REM --- 4. Khoi dong Microservice ---
echo.
echo [4/4] Khoi dong AI Boxchat (:8001) voi GPU Offload (num_gpu=%OLLAMA_NUM_GPU%, num_ctx=%OLLAMA_NUM_CTX%)...
if exist "%~dp0venv\Scripts\activate.bat" (
    call "%~dp0venv\Scripts\activate.bat"
)
python main.py


