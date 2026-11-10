#!/usr/bin/env bash
# ==============================================================
#      QK7 DATAHUB - THIẾT LẬP MÔI TRƯỜNG MONKEYOCRV2 (LINUX)
# ==============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================================="
echo "     QK7 DATAHUB - THIẾT LẬP MÔI TRƯỜNG MONKEYOCRV2"
echo "=============================================================="
echo "Script này sẽ tự động:"
echo "  1. Tạo môi trường Python 3.11 (Conda hoặc venv)"
echo "  2. Cài đặt PyTorch (Tùy chọn GPU CUDA 12.6 hoặc CPU)"
echo "  3. Cài đặt transformers, accelerate, qwen_vl_utils, v.v."
echo "  4. Tải trọng số mô hình MonkeyOCRv2 vào ./model_weight/"
echo "  5. Kiểm tra tính sẵn sàng của mô hình"
echo "=============================================================="
echo ""

# Kiểm tra Conda
if command -v conda &> /dev/null; then
    echo "[OK] Tìm thấy lệnh conda."
    HAS_CONDA=1
else
    echo "[INFO] Không tìm thấy conda. Sẽ sử dụng Python venv."
    HAS_CONDA=0
fi

if [ $HAS_CONDA -eq 1 ]; then
    read -p "Chọn môi trường [1: Conda MonkeyOCRv2Parsing (mặc định), 2: Python venv]: " ENV_CHOICE
    ENV_CHOICE=${ENV_CHOICE:-1}
else
    ENV_CHOICE=2
fi

if [ "$ENV_CHOICE" = "1" ]; then
    echo "--- Đang tạo Conda env 'MonkeyOCRv2Parsing' (Python 3.11) ---"
    conda create -n MonkeyOCRv2Parsing python=3.11 -y
    # Kích hoạt conda env trong subshell
    eval "$(conda shell.bash hook)"
    conda activate MonkeyOCRv2Parsing
else
    echo "--- Đang tạo thư mục virtual environment ./venv ---"
    python3 -m venv venv
    source venv/bin/activate
fi

echo ""
echo "=============================================================="
echo "Chọn phần cứng mục tiêu cho PyTorch:"
echo "  1: GPU NVIDIA (CUDA 12.6)"
echo "  2: CPU Only (Mặc định cho máy chủ không GPU rời)"
echo "=============================================================="
read -p "Nhập lựa chọn [1-2] (Mặc định: 2): " HW_CHOICE
HW_CHOICE=${HW_CHOICE:-2}

if [ "$HW_CHOICE" = "1" ]; then
    echo "[PyTorch] Đang cài đặt PyTorch cho GPU (CUDA 12.6)..."
    pip install torch==2.8.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu126
else
    echo "[PyTorch] Đang cài đặt PyTorch cho CPU..."
    pip install torch==2.5.1+cpu torchvision==0.20.1+cpu torchaudio==2.5.1+cpu --index-url https://download.pytorch.org/whl/cpu
fi

echo ""
echo "[Kiểm tra PyTorch]"
python -c "import torch; print('PyTorch version:', torch.__version__)" || echo "[CẢNH BÁO] Không thể nạp PyTorch."

echo ""
echo "--- Cài đặt các thư viện phụ thuộc cốt lõi cho MonkeyOCRv2 ---"
pip install transformers==4.57.1 accelerate==1.11.0 qwen_vl_utils==0.0.14
pip install opencv-python einops pypdfium2 gradio pillow sentencepiece huggingface_hub modelscope

echo ""
echo "--- Cài đặt các gói Microservice và Engine dự phòng ---"
pip install -r requirements.txt

if [ "$HW_CHOICE" = "1" ]; then
    read -p "Bạn có muốn cài đặt vLLM để tăng tốc suy luận GPU không? [y/N]: " VLLM_CHOICE
    if [[ "$VLLM_CHOICE" =~ ^[Yy]$ ]]; then
        echo "[vLLM] Đang cài đặt vLLM==0.11.2..."
        pip install vllm==0.11.2
    fi
fi

echo ""
echo "=============================================================="
echo "TẢI TRỌNG SỐ MÔ HÌNH MONKEYOCRV2 (~2.5 GB - 3.5 GB)"
echo "  1: Tải qua Hugging Face (Khuyến nghị)"
echo "  2: Tải qua ModelScope (Khuyến nghị cho mạng nội bộ/proxy)"
echo "  3: Tự động (Thử Hugging Face, fallback sang ModelScope)"
echo "  4: Bỏ qua (Đã có sẵn trong ./model_weight/ hoặc tải sau)"
echo "=============================================================="
read -p "Nhập lựa chọn [1-4] (Mặc định: 3): " DL_CHOICE
DL_CHOICE=${DL_CHOICE:-3}

if [ "$DL_CHOICE" = "1" ]; then
    python download_model.py -s huggingface --verify
elif [ "$DL_CHOICE" = "2" ]; then
    python download_model.py -s modelscope --verify
elif [ "$DL_CHOICE" = "3" ]; then
    python download_model.py -s auto --verify
else
    echo "Bỏ qua tải mô hình."
fi

echo ""
echo "=============================================================="
echo "[Kiểm tra toàn diện môi trường sau cài đặt]"
echo "=============================================================="
python check_environment.py

echo ""
echo "=============================================================="
echo "     HOÀN TẤT CÀI ĐẶT MÔI TRƯỜNG MONKEYOCRV2"
echo "=============================================================="
echo "Để khởi động Microservice OCR trên cổng 8002:"
echo "  Chạy lệnh: ./start-ocr.sh hoặc python main.py"
echo "=============================================================="

