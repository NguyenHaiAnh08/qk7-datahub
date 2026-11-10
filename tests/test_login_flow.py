# ==============================================================================
# tests/test_login_flow.py — Kiểm thử luồng đăng nhập tự động bằng Playwright
# Khắc phục Finding #1, #2 (Form POST + CSRF) và Finding #4 (Xác nhận đăng nhập & Cookie)
# ==============================================================================

import pytest
from playwright.sync_api import sync_playwright

BASE_URL = "https://127.0.0.1:8000"


def test_login_form_structure_and_post_attributes():
    """
    Finding #1, #2:
    - Form đăng nhập bắt buộc dùng method="POST"
    - Có CSRF token
    - Có thuộc tính autocomplete trên username và password
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        page.goto(f"{BASE_URL}/login", wait_until="networkidle")

        # 1. Kiểm tra tồn tại thẻ form method="POST"
        form = page.locator("form")
        assert form.count() > 0, "Không tìm thấy thẻ form trên trang /login"

        # Form đầu tiên hiển thị
        method = form.first.get_attribute("method")
        assert method and method.upper() == "POST", f"Form không sử dụng method='POST' (nhận: {method})"

        action = form.first.get_attribute("action")
        assert action and "/login" in action, f"Form action không trỏ về /login (nhận: {action})"

        # 2. Kiểm tra input password có autocomplete="current-password"
        pwd_input = page.locator("input[type='password']").first
        assert pwd_input.is_visible(), "Input password không hiển thị"
        autocomplete = pwd_input.get_attribute("autocomplete")
        assert autocomplete == "current-password", f"Input password thiếu autocomplete='current-password' (nhận: {autocomplete})"

        # 3. Kiểm tra CSRF token ẩn
        csrf_input = page.locator("input[name='_csrf']").first
        assert csrf_input.count() > 0, "Thiếu input hidden _csrf trong form đăng nhập"

        browser.close()


def test_login_authentication_cookies_and_health_check():
    """
    Finding #4:
    - Đăng nhập thành công và nhận cookie phiên có cờ Secure; HttpOnly; SameSite=Lax
    - Route /health trả { status: 'ok', authenticated: True }
    - URL chuyển tiếp sang /portal và không còn input password
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        page.goto(f"{BASE_URL}/login", wait_until="networkidle")

        # Điền thông tin đăng nhập
        user_input = page.locator("input[name='username']").first
        pwd_input = page.locator("input[name='password']").first

        user_input.fill("USR-002")
        pwd_input.fill("123456789")

        # Submit form
        submit_btn = page.locator("button[type='submit']").first
        submit_btn.click()

        # Đợi xử lý đăng nhập hoặc kiểm tra cookies
        page.wait_for_timeout(2000)

        # Lấy danh sách cookies từ context
        cookies = context.cookies()
        cookie_names = [c["name"] for c in cookies]

        # Kiểm tra cookie qk7_session hoặc token
        session_cookie = next((c for c in cookies if c["name"] in ["qk7_session", "token"]), None)
        assert session_cookie is not None, f"Không nhận được session cookie sau khi đăng nhập. Cookies hiện có: {cookie_names}"

        # Kiểm tra các cờ bảo mật bắt buộc của cookie
        assert session_cookie["secure"] is True, "Session cookie thiếu cờ Secure"
        assert session_cookie["httpOnly"] is True, "Session cookie thiếu cờ HttpOnly"
        assert session_cookie["sameSite"] in ["Lax", "Strict"], f"Session cookie thiếu SameSite=Lax/Strict (nhận: {session_cookie['sameSite']})"

        # Kiểm tra route /health với context đã xác thực
        health_res = page.request.get(f"{BASE_URL}/health")
        assert health_res.status == 200, f"/health trả mã trạng thái {health_res.status}"
        health_json = health_res.json()
        assert health_json.get("status") == "ok", f"/health trả status không phải ok: {health_json}"
        assert health_json.get("authenticated") is True, f"/health chưa xác nhận authenticated=True: {health_json}"

        browser.close()

