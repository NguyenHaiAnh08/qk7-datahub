# ==============================================================================
# tests/test_security_headers.py — Kiểm thử tự động Security Headers (QK7 DataHub)
# Khắc phục triệt để 36 Finding kiểm thử an ninh v4.0
# ==============================================================================

import pytest
import requests
import urllib3

# Tắt cảnh báo InsecureRequestWarning khi kiểm tra HTTPS local
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://127.0.0.1:8000"

SCANNED_ROUTES = [
    "/login",
    "/portal",
    "/lectures",
    "/materials",
    "/library",
    "/403",
    "/404",
    "/500",
]

API_ENDPOINTS = [
    "/api/documents",
    "/api/health",
    "/api/meta",
    "/health",
]


@pytest.mark.parametrize("route", SCANNED_ROUTES)
def test_spa_route_security_headers(route):
    """
    Kiểm tra 8 endpoint SPA:
    1. Trả về mã trạng thái hợp lệ (!= 5xx)
    2. Đầy đủ các header bảo mật theo OWASP
    3. CSP chuẩn Nonce, tuyệt đối không có 'unsafe-inline' hoặc 'unsafe-eval'
    """
    url = f"{BASE_URL}{route}"
    res = requests.get(url, verify=False, timeout=10)

    # 1. Trạng thái phản hồi không được là 5xx (Lỗi máy chủ)
    assert res.status_code < 500, f"Endpoint {route} trả về mã lỗi 5xx: {res.status_code}"

    headers = {k.lower(): v for k, v in res.headers.items()}

    # 2. HTTP Strict Transport Security (HSTS) — Findings #5–#12
    assert "strict-transport-security" in headers, f"Thiếu HSTS trên {route}"
    assert "max-age=31536000" in headers["strict-transport-security"]
    assert "includesubdomains" in headers["strict-transport-security"].lower()

    # 3. Content Security Policy (CSP) — Findings #13, #16, #19, #22, #25, #28, #31, #34
    assert "content-security-policy" in headers, f"Thiếu CSP trên {route}"
    csp = headers["content-security-policy"]
    assert "'unsafe-inline'" not in csp, f"CSP chứa 'unsafe-inline' trên {route}"
    assert "'unsafe-eval'" not in csp, f"CSP chứa 'unsafe-eval' trên {route}"
    assert "nonce-" in csp, f"CSP thiếu Nonce ngẫu nhiên trên {route}"

    # 4. Permissions-Policy — Findings #14, #17, #20, #23, #26, #29, #32, #35
    assert "permissions-policy" in headers, f"Thiếu Permissions-Policy trên {route}"
    perm = headers["permissions-policy"]
    for feature in ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"]:
        assert feature in perm, f"Permissions-Policy thiếu {feature} trên {route}"

    # 5. Cross-Origin-Opener-Policy (COOP) — Findings #15, #18, #21, #24, #27, #30, #33, #36
    assert "cross-origin-opener-policy" in headers, f"Thiếu COOP trên {route}"
    assert headers["cross-origin-opener-policy"] == "same-origin"

    # 6. Các header phòng thủ bổ sung
    assert "cross-origin-resource-policy" in headers, f"Thiếu CORP trên {route}"
    assert headers["cross-origin-resource-policy"] == "same-origin"

    assert "x-content-type-options" in headers, f"Thiếu X-Content-Type-Options trên {route}"
    assert headers["x-content-type-options"] == "nosniff"

    assert "referrer-policy" in headers, f"Thiếu Referrer-Policy trên {route}"
    assert headers["referrer-policy"] == "strict-origin-when-cross-origin"

    assert "x-frame-options" in headers, f"Thiếu X-Frame-Options trên {route}"
    assert headers["x-frame-options"] == "DENY"

    # 7. Ẩn thông tin Server & X-Powered-By
    assert "x-powered-by" not in headers, f"Lộ header x-powered-by trên {route}"


@pytest.mark.parametrize("api_path", API_ENDPOINTS)
def test_api_security_headers(api_path):
    """
    Kiểm tra các endpoint API phục vụ dữ liệu cũng có đầy đủ các header bảo mật.
    """
    url = f"{BASE_URL}{api_path}"
    res = requests.get(url, verify=False, timeout=10)

    # API có thể yêu cầu xác thực (401) hoặc công khai (200), nhưng không được lỗi 500
    assert res.status_code < 500, f"API {api_path} trả về 5xx: {res.status_code}"

    headers = {k.lower(): v for k, v in res.headers.items()}
    assert "strict-transport-security" in headers, f"API {api_path} thiếu HSTS"
    assert "content-security-policy" in headers, f"API {api_path} thiếu CSP"
    assert "permissions-policy" in headers, f"API {api_path} thiếu Permissions-Policy"
    assert "cross-origin-opener-policy" in headers, f"API {api_path} thiếu COOP"
    assert "x-content-type-options" in headers, f"API {api_path} thiếu X-Content-Type-Options"
    assert "x-frame-options" in headers, f"API {api_path} thiếu X-Frame-Options"
    assert "x-powered-by" not in headers, f"API {api_path} lộ X-Powered-By"

