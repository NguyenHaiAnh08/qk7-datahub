@echo off
chcp 65001 >nul
title QK7 DataHub - Cài Đặt Môi Trường MonkeyOCRv2
cd /d "%~dp0"

echo ==============================================================
echo      QK7 DATAHUB - THIẾT LẬP MÔI TRƯỜNG MONKEYOCRV2
echo ==============================================================
echo.
echo Script này sẽ tự động:
echo   1. Tạo môi trường Python 3.11 (Conda hoặc venv)
echo   2. Cài đặt PyTorch (Tùy chọn GPU CUDA 12.6 hoặc CPU)
echo   3. Cài đặt transformers, accelerate, qwen_vl_utils, v.v.
echo   4. Tải trọng số mô hình MonkeyOCRv2 vào ./model_weight/
echo   5. Kiểm tra tính sẵn sàng của mô hình
echo ==============================================================
echo.

REM --- 1. Kiểm tra Conda hoặc Python ---
where conda >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] Tìm thấy Anaconda / Miniconda trên hệ thống.
    set USE_CONDA=1
) else (
    echo [INFO] Không tìm thấy lệnh conda. Sử dụng Python venv chuẩn.
    set USE_CONDA=0
)

echo.
echo Chọn loại môi trường cài đặt:
if %USE_CONDA% equ 1 (
    echo   [1] Conda Environment (Khuyến nghị: MonkeyOCRv2Parsing, Python 3.11)
    echo   [2] Python Virtualenv (Thư mục local ./venv)
    set /p ENV_CHOICE="Nhập lựa chọn [1-2] (Mặc định: 1): "
    if not defined ENV_CHOICE set ENV_CHOICE=1
) else (
    set ENV_CHOICE=2
)

if "%ENV_CHOICE%"=="1" (
    echo.
    echo --- Đang tạo Conda env 'MonkeyOCRv2Parsing' (Python 3.11) ---
    call conda create -n MonkeyOCRv2Parsing python=3.11 -y
    echo Kích hoạt môi trường MonkeyOCRv2Parsing...
    call conda activate MonkeyOCRv2Parsing
) else (
    echo.
    echo --- Đang tạo thư mục virtual environment ./venv ---
    python -m venv venv
    call "%~dp0venv\Scripts\activate.bat"
)

echo.
echo ==============================================================
echo Chọn phần cứng mục tiêu cho PyTorch:
echo   [1] GPU NVIDIA (CUDA 12.6) - Yêu cầu card RTX / Quadro / Tesla
echo   [2] CPU Only (Máy chủ thông thường, không card đồ họa rời)
echo ==============================================================
set /p HW_CHOICE="Nhập lựa chọn [1-2] (Mặc định: 2 cho CPU): "
if not defined HW_CHOICE set HW_CHOICE=2

if "%HW_CHOICE%"=="1" (
    echo.
    echo [PyTorch] Đang cài đặt PyTorch cho GPU (CUDA 12.6)...
    pip install torch==2.8.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu126
) else (
    echo.
    echo [PyTorch] Đang cài đặt PyTorch cho CPU...
    pip install torch==2.5.1+cpu torchvision==0.20.1+cpu torchaudio==2.5.1+cpu --index-url https://download.pytorch.org/whl/cpu
)

echo.
echo [Kiểm tra PyTorch]
python -c "import torch; print('PyTorch version:', torch.__version__)"
if %ERRORLEVEL% neq 0 (
    echo [CẢNH BÁO] Không thể nạp PyTorch. Vui lòng kiểm tra lại kết nối mạng hoặc chạy fix_torch.bat sau.
)

echo.
echo --- Cài đặt các thư viện phụ thuộc cốt lõi cho MonkeyOCRv2 ---
pip install transformers==4.57.1 accelerate==1.11.0 qwen_vl_utils==0.0.14
pip install opencv-python einops pypdfium2 gradio pillow sentencepiece huggingface_hub modelscope

echo.
echo --- Cài đặt các gói Microservice và Engine dự phòng ---
pip install -r requirements.txt

if "%HW_CHOICE%"=="1" (
    echo.
    set /p VLLM_CHOICE="Bạn có muốn cài đặt vLLM để tăng tốc suy luận GPU không? [y/N]: "
    if /i "%VLLM_CHOICE%"=="y" (
        echo [vLLM] Đang cài đặt vLLM==0.11.2...
        pip install vllm==0.11.2
    )
)

echo.
echo ==============================================================
echo TẢI TRỌNG SỐ MÔ HÌNH MONKEYOCRV2 (~2.5 GB - 3.5 GB)
echo   [1] Tải qua Hugging Face (Khuyến nghị nếu có Internet trực tiếp)
echo   [2] Tải qua ModelScope (Khuyến nghị cho mạng nội bộ/proxy)
echo   [3] Tự động (Thử Hugging Face, fallback sang ModelScope)
echo   [4] Bỏ qua (Đã có sẵn trong ./model_weight/ hoặc tải sau)
echo ==============================================================
set /p DL_CHOICE="Nhập lựa chọn [1-4] (Mặc định: 3): "
if not defined DL_CHOICE set DL_CHOICE=3

if "%DL_CHOICE%"=="1" (
    python download_model.py -s huggingface --verify
)
if "%DL_CHOICE%"=="2" (
    python download_model.py -s modelscope --verify
)
if "%DL_CHOICE%"=="3" (
    python download_model.py -s auto --verify
)
if "%DL_CHOICE%"=="4" (
    echo Bỏ qua tải mô hình.
)

echo.
echo ==============================================================
echo [Kiểm tra toàn diện môi trường sau cài đặt]
echo ==============================================================
python check_environment.py

echo.
echo ==============================================================
echo      HOÀN TẤT CÀI ĐẶT MÔI TRƯỜNG MONKEYOCRV2
echo ==============================================================
echo Để khởi động Microservice OCR trên cổng 8002:
echo   Chạy lệnh: start-ocr.bat
echo ==============================================================
echo.
pause

