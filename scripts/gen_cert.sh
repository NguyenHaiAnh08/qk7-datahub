#!/bin/bash
# ==============================================================================
# scripts/gen_cert.sh — Tạo chứng chỉ SSL/TLS chuẩn cho QK7 DataHub
# Hỗ trợ:
#   1. mkcert (Môi trường Dev / Test / LAN nội bộ có CA tin cậy)
#   2. certbot (Môi trường Staging / Production có domain công khai qua Let's Encrypt)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$ROOT_DIR/backend/certs"

mkdir -p "$CERTS_DIR"

MODE="${1:-mkcert}"
DOMAIN="${2:-192.168.1.229}"
ADDITIONAL_DOMAINS="localhost 127.0.0.1 trungtamdulieuso.tqs.com ::1"

echo "======================================================================="
echo "  QK7 DataHub — Trình tạo chứng chỉ SSL/TLS Bảo Mật"
echo "  Chế độ: $MODE | Mục tiêu: $DOMAIN"
echo "======================================================================="

if [ "$MODE" = "mkcert" ]; then
    if ! command -v mkcert &> /dev/null; then
        echo "❌ Lỗi: Chưa cài đặt 'mkcert'. Vui lòng cài đặt trước:"
        echo "   Ubuntu/Debian: sudo apt install libnss3-tools && brew install mkcert"
        echo "   Windows: choco install mkcert / winget install FiloSottile.mkcert"
        exit 1
    fi

    echo "⚙️  Đang cài đặt Local CA vào hệ thống..."
    mkcert -install

    echo "⚙️  Đang tạo chứng chỉ SSL/TLS có thẩm quyền tin cậy..."
    mkcert -cert-file "$CERTS_DIR/cert.pem" \
           -key-file "$CERTS_DIR/private-key.pem" \
           "$DOMAIN" $ADDITIONAL_DOMAINS

    echo ""
    echo "✅ Tạo chứng chỉ thành công tại:"
    echo "   Cert: $CERTS_DIR/cert.pem"
    echo "   Key:  $CERTS_DIR/private-key.pem"
    echo ""
    echo "📌 Hướng dẫn Trust Root CA trên máy quét/máy kiểm thử:"
    echo "   File Root CA nằm tại: $(mkcert -CAROOT)/rootCA.pem"
    echo "   Sao chép file này sang máy test và thêm vào trust store của OS/Python requests."

elif [ "$MODE" = "certbot" ]; then
    if ! command -v certbot &> /dev/null; then
        echo "❌ Lỗi: Chưa cài đặt 'certbot'. Vui lòng chạy: sudo apt install certbot"
        exit 1
    fi

    echo "⚙️  Chạy Certbot Standalone để cấp chứng chỉ Let's Encrypt..."
    sudo certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN"

    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERTS_DIR/cert.pem"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERTS_DIR/private-key.pem"
    sudo chown "$(whoami)" "$CERTS_DIR/cert.pem" "$CERTS_DIR/private-key.pem"

    echo "✅ Cấp chứng chỉ Let's Encrypt thành công cho $DOMAIN!"

else
    echo "❌ Chế độ không hợp lệ: $MODE. Chỉ hỗ trợ 'mkcert' hoặc 'certbot'."
    exit 1
fi

