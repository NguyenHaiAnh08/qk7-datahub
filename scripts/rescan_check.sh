#!/bin/bash
# ==============================================================================
# scripts/rescan_check.sh — Script kiểm tra nhanh Security Headers cho 8 endpoint
# Hiển thị bảng màu trực quan Xanh/Đỏ trước khi bàn giao cho scanner
# ==============================================================================

set -euo pipefail

TARGET_HOST="${1:-https://127.0.0.1:8000}"

ENDPOINTS=(
    "/login"
    "/portal"
    "/lectures"
    "/materials"
    "/library"
    "/403"
    "/404"
    "/500"
)

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${BOLD}================================================================================================================${NC}"
echo -e "${BOLD}                     QK7 DATAHUB — BẢNG ĐỐI CHIẾU KIỂM TOÁN SECURITY HEADERS (OWASP)                            ${NC}"
echo -e "${BOLD} Mục tiêu: $TARGET_HOST${NC}"
echo -e "${BOLD}================================================================================================================${NC}"
printf "%-12s | %-6s | %-12s | %-12s | %-12s | %-8s | %-8s | %-8s | %-10s\n" \
       "Endpoint" "Status" "HSTS" "CSP-Nonce" "Permissions" "COOP" "CORP" "X-Type" "X-Frame"
echo "----------------------------------------------------------------------------------------------------------------"

TOTAL_MISSING=0

for ep in "${ENDPOINTS[@]}"; do
    URL="${TARGET_HOST}${ep}"
    
    # Lấy headers qua curl -k (insecure cert bypass)
    HEADERS=$(curl -k -s -I "$URL" || true)
    
    STATUS=$(echo "$HEADERS" | head -n 1 | awk '{print $2}')
    if [ -z "$STATUS" ]; then STATUS="ERR"; fi
    
    # 1. HSTS
    if echo "$HEADERS" | grep -iq "Strict-Transport-Security:.*max-age=31536000.*includeSubDomains"; then
        H_HSTS="${GREEN}OK${NC}"
    else
        H_HSTS="${RED}MISSING${NC}"
        ((TOTAL_MISSING++))
    fi
    
    # 2. CSP (phải có nonce và không chứa unsafe-inline)
    if echo "$HEADERS" | grep -iq "Content-Security-Policy:" && \
       echo "$HEADERS" | grep -iq "nonce-" && \
       ! echo "$HEADERS" | grep -iq "unsafe-inline"; then
        H_CSP="${GREEN}NONCE${NC}"
    else
        H_CSP="${RED}MISSING${NC}"
        ((TOTAL_MISSING++))
    fi
    
    # 3. Permissions-Policy
    if echo "$HEADERS" | grep -iq "Permissions-Policy:.*camera=()"; then
        H_PERM="${GREEN}OK${NC}"
    else
        H_PERM="${RED}MISSING${NC}"
        ((TOTAL_MISSING++))
    fi
    
    # 4. COOP
    if echo "$HEADERS" | grep -iq "Cross-Origin-Opener-Policy:.*same-origin"; then
        H_COOP="${GREEN}OK${NC}"
    else
        H_COOP="${RED}MISSING${NC}"
        ((TOTAL_MISSING++))
    fi
    
    # 5. CORP
    if echo "$HEADERS" | grep -iq "Cross-Origin-Resource-Policy:.*same-origin"; then
        H_CORP="${GREEN}OK${NC}"
    else
        H_CORP="${RED}MISSING${NC}"
        ((TOTAL_MISSING++))
    fi
    
    # 6. X-Content-Type-Options
    if echo "$HEADERS" | grep -iq "X-Content-Type-Options:.*nosniff"; then
        H_XTYPE="${GREEN}OK${NC}"
    else
        H_XTYPE="${RED}MISSING${NC}"
        ((TOTAL_MISSING++))
    fi
    
    # 7. X-Frame-Options
    if echo "$HEADERS" | grep -iq "X-Frame-Options:.*DENY"; then
        H_FRAME="${GREEN}OK${NC}"
    else
        H_FRAME="${RED}MISSING${NC}"
        ((TOTAL_MISSING++))
    fi
    
    printf "%-12s | %-6s | %-21b | %-21b | %-21b | %-17b | %-17b | %-17b | %-19b\n" \
           "$ep" "$STATUS" "$H_HSTS" "$H_CSP" "$H_PERM" "$H_COOP" "$H_CORP" "$H_XTYPE" "$H_FRAME"
done

echo "----------------------------------------------------------------------------------------------------------------"
if [ "$TOTAL_MISSING" -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✅ KẾT QUẢ: 100% SECURITY HEADERS ĐÃ ĐẠT CHUẨN TRÊN TOÀN BỘ 8/8 ENDPOINT (0 MISSING)!${NC}"
    exit 0
else
    echo -e "${RED}${BOLD}❌ KẾT QUẢ: CÒN $TOTAL_MISSING VỊ TRÍ THIẾU TIÊU ĐỀ AN NINH!${NC}"
    exit 1
fi

