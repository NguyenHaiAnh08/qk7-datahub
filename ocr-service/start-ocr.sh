#!/usr/bin/env bash
# ==============================================================
#   QK7 DataHub - Khởi Động OCR 
#   Port: 8002
# ==============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  QK7 DataHub - OCR "
echo "  Engine: MonkeyOCRv2 / PaddleOCR"
echo "  Port  : 8002"
echo "=========================================="

# 1. Giải phóng port 8002 nếu đang bị chiếm
if command -v fuser &> /dev/null; then
    fuser -k 8002/tcp 2>/dev/null || true
elif command -v lsof &> /dev/null; then
    PID=$(lsof -ti:8002 2>/dev/null || true)
    if [ -n "$PID" ]; then
        kill -9 $PID 2>/dev/null || true
    fi
fi

# 2. Kích hoạt môi trường (Conda hoặc venv)
if [ -d "$SCRIPT_DIR/venv" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
elif command -v conda &> /dev/null; then
    eval "$(conda shell.bash hook)"
    conda activate MonkeyOCRv2Parsing 2>/dev/null || true
fi

# 3. Cấu hình biến môi trường
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export HF_DATASETS_OFFLINE=1
export HF_HUB_VERBOSITY=debug
export HF_HUB_DISABLE_TELEMETRY=1
export DO_NOT_TRACK=1
export DISABLE_TELEMETRY=1
export SCARF_NO_ANALYTICS=1
export ANONYMIZED_TELEMETRY=False

# PaddleOCR offline hardening
export PADDLE_HOME="$SCRIPT_DIR/model_weight/paddleocr"
export PADDLEOCR_HOME="$SCRIPT_DIR/model_weight/paddleocr"
export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
export DISABLE_PADDLE_UPDATE_CHECK=1
export FLAGS_use_mkldnn=0

if [ -d "$SCRIPT_DIR/model_weight/MonkeyOCRv2-B-Parsing" ]; then
    export MONKEY_MODEL_ID=${MONKEY_MODEL_ID:-"$SCRIPT_DIR/model_weight/MonkeyOCRv2-B-Parsing"}
fi

export OCR_ENGINE=${OCR_ENGINE:-"auto"}
export MONKEY_DEVICE=${MONKEY_DEVICE:-"auto"}
export PORT=8002

echo "OCR_ENGINE    = $OCR_ENGINE"
echo "MONKEY_DEVICE = $MONKEY_DEVICE"
echo "MONKEY_MODEL  = $MONKEY_MODEL_ID"
echo "PORT          = $PORT"
echo "OFFLINE_MODE  = HF_HUB_OFFLINE=1, TRANSFORMERS_OFFLINE=1"
echo "------------------------------------------"

python main.py

