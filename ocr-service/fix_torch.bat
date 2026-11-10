@echo off
chcp 65001 >nul
title QK7 DataHub - Cai dat PyTorch & Transformers cho MonkeyOCRv2
cd /d "%~dp0"

echo =================================================================
echo   QK7 DataHub - CÀI ĐẶT PYTORCH & TRANSFORMERS (MONKEYOCRV2)
echo =================================================================
echo.

REM --- 1. Kich hoat moi truong Python (Conda hoac venv) ---
set "PYTHON_EXE=python"
set "PIP_EXE=pip"

where conda >nul 2>&1
if %ERRORLEVEL% equ 0 (
    call conda activate MonkeyOCRv2Parsing >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo [OK] Đã kích hoạt Conda env: MonkeyOCRv2Parsing
        set "PYTHON_EXE=python"
        set "PIP_EXE=pip"
        goto :env_ready
    )
)

if exist "%~dp0venv\Scripts\python.exe" (
    echo [OK] Sử dụng môi trường ảo venv: %~dp0venv
    call "%~dp0venv\Scripts\activate.bat"
    set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
    set "PIP_EXE=%~dp0venv\Scripts\pip.exe"
    goto :env_ready
)

echo [INFO] Sử dụng Python mặc định trên hệ thống.

:env_ready
echo.
echo [1/3] Đang cài đặt PyTorch CPU (phiên bản ổn định 2.5.1+cpu)...
echo       (Quá trình tải có thể mất vài phút tùy tốc độ mạng)
echo -----------------------------------------------------------------
"%PIP_EXE%" install torch==2.5.1+cpu torchvision==0.20.1+cpu torchaudio==2.5.1+cpu --index-url https://download.pytorch.org/whl/cpu
if %ERRORLEVEL% neq 0 (
    echo [CẢNH BÁO] Không tải được từ download.pytorch.org. Thử cài đặt torch từ PyPI...
    "%PIP_EXE%" install torch torchvision torchaudio
)

echo.
echo [2/3] Đang cài đặt Transformers, Accelerate & Qwen-VL-Utils...
echo -----------------------------------------------------------------
"%PIP_EXE%" install transformers==4.57.1 accelerate==1.11.0 qwen_vl_utils==0.0.14

echo.
echo [3/3] Kiểm tra lại môi trường sau khi cài đặt...
echo -----------------------------------------------------------------
"%PYTHON_EXE%" check_environment.py

echo.
echo =================================================================
echo   HOÀN TẤT QUÁ TRÌNH THIẾT LẬP PYTORCH!
echo   Bây giờ bạn có thể khởi động lại server bằng:
echo     - ocr-service\start-ocr.bat (chỉ OCR)
echo     - s.bat (toàn bộ hệ thống QK7 DataHub)
echo =================================================================
pause

