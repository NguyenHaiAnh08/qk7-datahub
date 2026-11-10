#!/usr/bin/env bash
# ==============================================================
#   QK7 DataHub - Khởi Động OCR Microservice v2.0 (Linux)
#   Port: 8002
# ==============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  QK7 DataHub - OCR MICROSERVICE v2.0"
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
export OCR_ENGINE=${OCR_ENGINE:-"auto"}
export MONKEY_DEVICE=${MONKEY_DEVICE:-"auto"}
export PORT=8002

echo "OCR_ENGINE    = $OCR_ENGINE"
echo "MONKEY_DEVICE = $MONKEY_DEVICE"
echo "PORT          = $PORT"
echo "------------------------------------------"

python main.py

