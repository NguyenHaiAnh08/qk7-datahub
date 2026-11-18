"""
Fingerprint Agent — device-based WebSocket client (Hỗ trợ WSS + HTTPS)
"""
import asyncio
import base64
import http.server
import json
import os
import signal
import ssl
import sys
import threading
import time          # ★ cho idle watchdog
import uuid
from typing import Optional

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import websockets
from dotenv import load_dotenv

# Khi đóng gói exe (PyInstaller onefile):
#   _HERE    = thư mục chứa file .exe  → nơi đặt device_id.txt, .env/rootCA.pem ghi đè
#   _RES_DIR = thư mục giải nén tạm    → cấu hình/chứng chỉ nhúng sẵn trong exe
_FROZEN = getattr(sys, "frozen", False)
_RES_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
_HERE = os.path.dirname(sys.executable) if _FROZEN else os.path.dirname(os.path.abspath(__file__))

def _find_file(name: str) -> str:
    """Ưu tiên file cạnh exe (ghi đè được), sau đó file nhúng trong exe."""
    for base in (_HERE, _RES_DIR):
        p = os.path.join(base, name)
        if os.path.exists(p):
            return p
    return os.path.join(_HERE, name)

# .env cạnh exe thắng .env nhúng (load_dotenv không ghi đè biến đã có)
load_dotenv(os.path.join(_HERE, ".env"))
load_dotenv(os.path.join(_RES_DIR, ".env"))

BACKEND_WS_URL = os.getenv("BACKEND_WS_URL", "ws://localhost:8000/ws/fingerprint")
BRIDGE_TOKEN = os.getenv("BRIDGE_TOKEN", "")
DEVICE_SERVER_HOST = os.getenv("DEVICE_SERVER_HOST", "127.0.0.1")
DEVICE_SERVER_PORT = int(os.getenv("DEVICE_SERVER_PORT", "9001"))

# ★ Idle timeout: tự đóng thiết bị nếu không dùng trong N giây
DEVICE_IDLE_TIMEOUT = int(os.getenv("DEVICE_IDLE_TIMEOUT", "60"))

CA_CERT_PATH = os.getenv("CA_CERT_PATH", "rootCA.pem")
USE_TLS = BACKEND_WS_URL.lower().startswith("wss://")

if not BRIDGE_TOKEN or len(BRIDGE_TOKEN) < 16:
    print("❌ BRIDGE_TOKEN thiếu hoặc <16 ký tự trong .env")
    sys.exit(1)

from zk_service import ZK9500Service

DEVICE_ID_FILE = os.path.join(_HERE, "device_id.txt")

import base64 as _b64
import hashlib as _hashlib
import hmac as _hmac

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Nếu đặt AGENT_STRICT_TLS=true: bắt buộc chứng chỉ TLS hợp lệ (không chấp nhận diệt virus/proxy ký lại).
# Mặc định: nếu xác minh chứng chỉ thất bại (diệt virus quét HTTPS...), vẫn kết nối vì kênh đã được
# xác thực 2 chiều bằng HMAC và mã hóa AES-256-GCM ở tầng ứng dụng (xem backend/src/agent-crypto.js).
STRICT_TLS = os.getenv("AGENT_STRICT_TLS", "false").lower() == "true"


def _hm(key: str, data: str) -> bytes:
    return _hmac.new(key.encode("utf-8"), data.encode("utf-8"), _hashlib.sha256).digest()


class SecureWS:
    """Bọc websocket: mã hóa/giải mã mọi tin nhắn (AES-256-GCM + seq chống phát lại).
    Giữ nguyên giao diện send(str) / async for / recv() nên code xử lý cũ không phải sửa."""

    def __init__(self, ws, key: bytes):
        self._ws = ws
        self._it = None
        self._aes = AESGCM(key)
        self._send_seq = 0
        self._recv_seq = 0

    async def send(self, text: str):
        self._send_seq += 1
        pt = json.dumps({"s": self._send_seq, "d": json.loads(text)}, ensure_ascii=False).encode("utf-8")
        iv = os.urandom(12)
        ct = self._aes.encrypt(iv, pt, b"a2s")  # ciphertext || tag(16)
        await self._ws.send(json.dumps({"e": _b64.b64encode(iv + ct).decode()}))

    def _open(self, raw) -> str:
        buf = _b64.b64decode(json.loads(raw)["e"])
        pt = self._aes.decrypt(buf[:12], buf[12:], b"s2a")
        obj = json.loads(pt.decode("utf-8"))
        if not isinstance(obj.get("s"), int) or obj["s"] <= self._recv_seq:
            raise ValueError("seq không hợp lệ (phát lại?)")
        self._recv_seq = obj["s"]
        return json.dumps(obj["d"], ensure_ascii=False)

    async def recv(self) -> str:
        return self._open(await self._ws.recv())

    def __aiter__(self):
        return self

    async def __anext__(self) -> str:
        while True:
            if self._it is None:
                self._it = self._ws.__aiter__()
            raw = await self._it.__anext__()  # StopAsyncIteration khi đóng kết nối
            try:
                return self._open(raw)
            except Exception as e:
                print(f"[Agent] ⚠️ Bỏ qua gói tin không hợp lệ: {type(e).__name__}")
                continue


async def secure_handshake(ws, device_id: str) -> "SecureWS":
    """Xác thực 2 chiều bằng HMAC; BRIDGE_TOKEN không bao giờ gửi qua mạng."""
    challenge = json.loads(await asyncio.wait_for(ws.recv(), 8))
    if challenge.get("type") != "challenge" or not challenge.get("nonce"):
        raise ConnectionError("Server không hỗ trợ giao thức bảo mật mới — hãy cập nhật Backend.")
    nonce = challenge["nonce"]
    cnonce = _b64.b64encode(os.urandom(16)).decode()
    proof = _hm(BRIDGE_TOKEN, f"qk7-agent-auth|{nonce}|{device_id}").hex()
    await ws.send(json.dumps({"type": "auth", "cnonce": cnonce, "proof": proof}))

    reply = json.loads(await asyncio.wait_for(ws.recv(), 8))
    expect = _hm(BRIDGE_TOKEN, f"qk7-server-auth|{nonce}|{cnonce}|{device_id}")
    if reply.get("type") != "auth_ok" or not _hmac.compare_digest(bytes.fromhex(reply.get("proof", "")), expect):
        raise ConnectionError("Server không xác thực được (sai BRIDGE_TOKEN hoặc server giả mạo).")
    key = _hm(BRIDGE_TOKEN, f"qk7-session|{nonce}|{cnonce}|{device_id}")
    return SecureWS(ws, key)


def build_relaxed_ssl_context():
    """TLS không xác minh chứng chỉ — CHỈ dùng khi kênh đã được bảo vệ ở tầng ứng dụng."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def build_ssl_context():
    if not USE_TLS:
        return None

    ctx = ssl.create_default_context()

    ca_path = CA_CERT_PATH
    if not os.path.isabs(ca_path):
        ca_path = _find_file(ca_path)

    if os.path.exists(ca_path):
        try:
            ctx.load_verify_locations(cafile=ca_path)
            print(f"[Agent] 🔒 Đã nạp CA: {ca_path}")
        except Exception as e:
            print(f"[Agent] ⚠️ Lỗi nạp CA '{ca_path}': {e}")
            print(f"[Agent]    Sẽ dùng CA hệ thống Windows thay thế.")
    else:
        print(f"[Agent] ⚠️ Không tìm thấy CA file: {ca_path}")
        print(f"[Agent]    Đang dùng CA hệ thống Windows.")

    return ctx

def get_or_create_device_id() -> str:
    if os.path.exists(DEVICE_ID_FILE):
        with open(DEVICE_ID_FILE, "r", encoding="utf-8") as f:
            did = f.read().strip()
            if did:
                return did
    did = "DEV-" + str(uuid.uuid4())
    try:
        with open(DEVICE_ID_FILE, "w", encoding="utf-8") as f:
            f.write(did)
    except OSError as e:
        print(f"[Agent] ⚠️ Không ghi được {DEVICE_ID_FILE}: {e}")
    return did

def free_port(port: int):
    try:
        import subprocess
        res = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
        my_pid = str(os.getpid())
        killed_any = False
        for line in res.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.strip().split()
                pid = parts[-1]
                if pid != my_pid and pid != "0":
                    print(f"[Agent] 🔄 Phát hiện PID {pid} đang chiếm cổng {port}. Đang kill để giải phóng...")
                    subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
                    killed_any = True
        if killed_any:
            time.sleep(1.2)
    except Exception as e:
        print(f"[Agent] ⚠️ Lỗi kiểm tra cổng {port}: {e}")


def start_device_id_server(device_id: str, host: str, port: int, agent_ref=None):
    from urllib.parse import urlsplit

    free_port(port)

    class Handler(http.server.BaseHTTPRequestHandler):
        # Ngắt kết nối rảnh (Chrome preconnect) để không giữ luồng vô hạn.
        timeout = 10

        def _send_json(self, status_code, data):
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")

            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            try:
                self.wfile.write(body)
            except (ssl.SSLError, ConnectionError, OSError):
                pass  # trình duyệt đã hủy/đóng kết nối — không phải lỗi

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Max-Age", "600")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            # Bỏ query string để /device-id?test=1 vẫn nhận đúng route.
            path = urlsplit(self.path).path.rstrip("/") or "/"

            if path == "/device-id":
                self._send_json(200, {
                    "device_id": device_id,
                    "service": "qk7-fingerprint-agent"
                })

            elif path == "/health":
                self._send_json(200, {
                    "ok": True,
                    "service": "qk7-fingerprint-agent"
                })

            elif path == "/enroll-status":
                status = (
                    agent_ref.get_enroll_status()
                    if agent_ref
                    else {
                        "enrolling": False,
                        "step": 0,
                        "total": 3,
                        "state": "idle"
                    }
                )
                self._send_json(200, status)

            else:
                self._send_json(404, {
                    "error": "NOT_FOUND",
                    "path": path
                })

        def log_message(self, format, *args):
            pass

    class _Server(http.server.ThreadingHTTPServer):
        """Bắt tay TLS ở luồng riêng của từng kết nối, không chặn vòng lặp accept."""
        daemon_threads = True
        ssl_ctx = None

        def process_request_thread(self, request, client_address):
            if self.ssl_ctx is not None:
                try:
                    request.settimeout(5)
                    request = self.ssl_ctx.wrap_socket(request, server_side=True)
                    request.settimeout(None)
                except (ssl.SSLError, OSError):
                    self.shutdown_request(request)
                    return
            super().process_request_thread(request, client_address)

        def handle_error(self, request, client_address):
            exc = sys.exc_info()[1]
            if isinstance(exc, (ssl.SSLError, ConnectionError, TimeoutError, OSError)):
                return  # client ngắt giữa chừng: bỏ qua, không in traceback
            super().handle_error(request, client_address)

    server = None

    cert_file = _find_file("cert.pem")
    key_file = _find_file("private-key.pem")
    if not os.path.exists(cert_file):
        cert_file = os.path.join(_HERE, "..", "backend", "certs", "cert.pem")
        key_file = os.path.join(_HERE, "..", "backend", "certs", "private-key.pem")

    for attempt in range(3):
        try:
            free_port(port)
            server = _Server((host, port), Handler)
            is_https = False
            if os.path.exists(cert_file) and os.path.exists(key_file):
                try:
                    ssl_ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
                    ssl_ctx.load_cert_chain(certfile=cert_file, keyfile=key_file)
                    server.ssl_ctx = ssl_ctx
                    is_https = True
                except Exception as e:
                    print(f"[Agent] ⚠️ Không kích hoạt được HTTPS cho Device-id server: {e}")

            t = threading.Thread(
                target=server.serve_forever,
                daemon=True
            )
            t.start()

            protocol = "https" if is_https else "http"
            print(
                f"[Agent] Device-id server: "
                f"{protocol}://{host}:{port}/device-id"
            )
            return server

        except OSError as e:
            if attempt < 2:
                print(
                    f"[Agent] ⚠️ Cổng {port} chưa sẵn sàng ({e}), "
                    f"đang thử mở lại lần {attempt + 2}..."
                )
                free_port(port)
                time.sleep(1.5)
            else:
                print(
                    f"[Agent] ❌ Không mở được {host}:{port}: {e}."
                )
                return None

class FingerprintAgent:
    def __init__(self, device_id: str, ssl_context=None):
        self.svc = ZK9500Service()
        self.device_id = device_id
        self.ssl_context = ssl_context
        self.running = True
        self.reconnect_delay = 3
        self.busy = False
        self.enroll_step = 0
        self.enroll_total = 3
        self.enroll_state = "idle"
        self._cancel_event = threading.Event()

        # Quản lý đóng/mở thiết bị (Lazy Open)
        self.active_jobs = 0
        self.device_lock = threading.Lock()

        # ★ Idle timeout
        self._last_activity_ts = time.monotonic()
        self._idle_timeout = DEVICE_IDLE_TIMEOUT
        self._idle_task: Optional[asyncio.Task] = None

    # ─────────────────────────── Device lifecycle ───────────────────────────

    def _ensure_device_open(self) -> bool:
        with self.device_lock:
            self._last_activity_ts = time.monotonic()
            if self.svc.device_connected:
                self.active_jobs += 1
                return True
            print("[Agent] 🎬 Mở thiết bị ZK9500 (Lazy Open)...")
            ok, msg = self.svc.open_device()
            print(f"[Agent] Open device: {msg}")
            if ok:
                self.active_jobs += 1
            return ok

    def _release_device(self):
        """
        ★ Gia cố: close_device() có thể raise (USB rút giữa chừng).
        Không được để exception lan ra — chỉ log và tiếp tục.
        """
        with self.device_lock:
            self._last_activity_ts = time.monotonic()
            self.active_jobs -= 1
            if self.active_jobs <= 0:
                self.active_jobs = 0
                if self.svc.device_connected:
                    try:
                        self.svc.close_device()
                        print("[Agent] 🔌 Đã nhả thiết bị ZK9500 (Tránh nóng)")
                    except Exception as e:
                        print(f"[Agent] ⚠️ close_device() lỗi: {e} — đánh dấu disconnected")
                        try:
                            self.svc.device_connected = False
                        except Exception:
                            pass

    async def _idle_watchdog(self):
        """★ Tự đóng thiết bị khi idle quá lâu (không có job nào)."""
        while self.running:
            await asyncio.sleep(3)
            try:
                with self.device_lock:
                    if self.active_jobs <= 0 and self.svc.device_connected:
                        idle = time.monotonic() - self._last_activity_ts
                        if idle >= self._idle_timeout:
                            print(f"[Agent] 😴 Idle {idle:.0f}s ≥ "
                                  f"{self._idle_timeout}s — tự đóng thiết bị")
                            try:
                                self.svc.close_device()
                            except Exception as e:
                                print(f"[Agent] idle watchdog close lỗi: {e}")
            except Exception as e:
                print(f"[Agent] idle watchdog: {e}")

    def get_enroll_status(self):
        return {
            "enrolling": bool(self.busy and self.enroll_state not in
                              ("idle", "completed", "error", "timeout",
                               "mismatch", "cancelled")),
            "step": self.enroll_step,
            "total": self.enroll_total,
            "state": self.enroll_state,
        }

    # ─────────────────────────── Main loop ───────────────────────────

    async def run(self):
        ok, msg = self.svc.load_sdk()
        print(f"[Agent] Load SDK: {msg}")
        if not ok:
            print("❌ Không load được SDK.")
            print("   Kiểm tra: đã cài driver ZKTeco chưa? đã cắm USB đầu đọc ZK9500 chưa?")
            if _FROZEN:
                print("   (Cửa sổ tự đóng sau 60 giây — mở lại ứng dụng sau khi cắm đầu đọc.)")
                time.sleep(60)
            return

        # ★ Khởi động idle watchdog
        self._idle_task = asyncio.create_task(self._idle_watchdog())

        print(f"[Agent] Device ID: {self.device_id}")
        proto_info = "WSS (TLS)" if USE_TLS else "WS (plaintext)"
        print(f"[Agent] Giao thức: {proto_info}")
        print(f"[Agent] Idle timeout: {self._idle_timeout}s")
        print(f"[Agent] Sẵn sàng. Kết nối tới {BACKEND_WS_URL}...\n")

        retry_count = 0
        try:
            while self.running:
                try:
                    await self._session()
                    retry_count = 0
                except ssl.SSLError as e:
                    print(f"[Agent] ❌ Lỗi SSL: {e}")
                    print(f"[Agent]    Kiểm tra: file 'rootCA.pem' có trong {_HERE}?")
                except (ConnectionRefusedError, OSError) as e:
                    print(f"[Agent] ⚠️ Backend Gateway (:8000) chưa sẵn sàng ({e}). Đang chờ Backend khởi động...")
                except Exception as e:
                    print(f"[Agent] Session error: {type(e).__name__}: {e}")

                if self.running:
                    delay = min(2 * (retry_count + 1), 6)
                    print(f"[Agent] Reconnect sau {delay}s...")
                    await asyncio.sleep(delay)
                    retry_count += 1
        finally:
            if self._idle_task:
                self._idle_task.cancel()

    async def _session(self):
        candidate_urls = [BACKEND_WS_URL]
        if "127.0.0.1" not in BACKEND_WS_URL and "localhost" not in BACKEND_WS_URL:
            # Fallback sang localhost nếu đang chạy trên cùng máy với Gateway
            local_fallback = BACKEND_WS_URL.replace("192.168.1.229", "127.0.0.1")
            if ":8000" in BACKEND_WS_URL and local_fallback == BACKEND_WS_URL:
                local_fallback = "wss://127.0.0.1:8000/ws/fingerprint"
            candidate_urls.append(local_fallback)

        connect_kwargs = {"ping_interval": None}
        if self.ssl_context is not None:
            connect_kwargs["ssl"] = self.ssl_context

        ws = None
        last_error = None
        for target_url in candidate_urls:
            # proto=2: xác thực bằng thách đố HMAC (không gửi token trong URL)
            url = f"{target_url}?device_id={self.device_id}&proto=2"
            try:
                try:
                    ws = await websockets.connect(url, **connect_kwargs)
                except ssl.SSLCertVerificationError as e:
                    if STRICT_TLS or not USE_TLS:
                        raise
                    print(f"[Agent] ⚠️ Không xác minh được chứng chỉ TLS ({e.verify_message}).")
                    print("[Agent]    Có thể diệt virus/proxy đang quét HTTPS. Vẫn tiếp tục vì kênh đã được "
                          "xác thực HMAC + mã hóa AES-256-GCM ở tầng ứng dụng.")
                    relaxed = dict(connect_kwargs, ssl=build_relaxed_ssl_context())
                    ws = await websockets.connect(url, **relaxed)
                break
            except (ConnectionRefusedError, OSError) as e:
                last_error = e
                if isinstance(e, ssl.SSLError):
                    raise
                continue

        if ws is None:
            raise last_error or ConnectionRefusedError("Không thể kết nối WebSocket Gateway")

        async with ws:
            try:
                secure = await secure_handshake(ws, self.device_id)
            except websockets.exceptions.ConnectionClosed as e:
                if getattr(e, "code", None) == 4001 or "bridge token" in str(e).lower():
                    print("[Agent] ❌ Server đóng kết nối ngay khi xác thực (mã 4001). Hai nguyên nhân có thể:")
                    print("[Agent]    1) Backend trên Server là BẢN CŨ, chưa cập nhật/khởi động lại → cập nhật Backend rồi restart.")
                    print("[Agent]    2) BRIDGE_TOKEN trong agent khác Server → build lại bộ cài với token đúng.")
                raise
            print(f"[Agent] ✅ WS connected ({'wss' if USE_TLS else 'ws'}://...) 🔐 kênh mã hóa E2E")
            async for raw in secure:
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                t = msg.get("type")
                if t == "ping":
                    try:
                        await secure.send(json.dumps({"type": "pong"}))
                    except Exception:
                        pass
                elif t == "scan_request":
                    self._cancel_event.set()
                    new_event = threading.Event()
                    self._cancel_event = new_event
                    asyncio.create_task(self._handle_scan(secure, msg, new_event))
                elif t == "enroll_request":
                    self._cancel_event.set()
                    new_event = threading.Event()
                    self._cancel_event = new_event
                    asyncio.create_task(self._handle_enroll(secure, msg, new_event))

    # ─────────────────────────── Handlers ───────────────────────────

    async def _handle_scan(self, ws, job, cancel_event: threading.Event):
        """
        ★ Gia cố: BẮT BUỘC gửi scan_result (match=False) trong MỌI nhánh lỗi.
        - Outer try bao trùm cả _ensure_device_open và validate input
        - finally bọc try/except để close_device() throw không giết task
        """
        job_id = job.get("job_id")
        device_acquired = False  # ★ Theo dõi để balance active_jobs chính xác

        try:
            template_b64 = job.get("template_plain_b64")
            timeout = int(job.get("timeout_seconds", 30) or 30)

            print(f"\n[Agent] 📥 scan {job_id} | timeout={timeout}s")

            # ★ BƯỚC 1 — Validate input SỚM (trước khi chạm phần cứng)
            if not job_id:
                print("[Agent] ❌ scan: thiếu job_id — bỏ qua")
                return
            if not template_b64:
                await ws.send(json.dumps({
                    "type": "scan_result", "job_id": job_id,
                    "match": False, "score": 0,
                    "error": "INVALID_TEMPLATE",
                }))
                return

            # ★ BƯỚC 2 — Mở thiết bị trong try (bắt mọi lỗi USB/SDK)
            try:
                device_acquired = self._ensure_device_open()
            except Exception as open_err:
                print(f"[Agent] ❌ open_device() raise: {open_err}")
                device_acquired = False

            if not device_acquired:
                await ws.send(json.dumps({
                    "type": "scan_result", "job_id": job_id,
                    "match": False, "score": 0, "error": "DEVICE_OFFLINE",
                }))
                return

            print(f"[Agent] 👉 Đặt tay lên máy quét...")

            # ★ BƯỚC 3 — Quét + so khớp (tối đa MAX_TRIES lần chụp trong thời gian cho phép:
            #   một lần chụp xấu/ấn nhẹ không nên làm hỏng cả phiên xác thực)
            stored = base64.b64decode(template_b64)
            MAX_TRIES = 3
            deadline = time.time() + timeout
            matched, score = False, 0
            captured_any = False
            for attempt in range(1, MAX_TRIES + 1):
                remaining = deadline - time.time()
                if remaining <= 0:
                    break
                scanned = await asyncio.to_thread(
                    self.svc.wait_for_finger, remaining, cancel_event
                )

                if cancel_event.is_set():
                    print(f"[Agent] ⏹️ Scan {job_id} bị hủy bởi job mới.")
                    await ws.send(json.dumps({
                        "type": "scan_result", "job_id": job_id,
                        "match": False, "score": 0, "error": "CANCELLED",
                    }))
                    return

                if scanned is None:
                    break
                captured_any = True

                matched, score = await asyncio.to_thread(
                    self.svc.compare_templates, stored, scanned
                )
                if matched:
                    break
                if attempt < MAX_TRIES and deadline - time.time() > 3:
                    print(f"[Agent] ⚠️ Lần {attempt}/{MAX_TRIES} không khớp (score={score}). "
                          f"Nhấc tay ra, đặt lại NGÓN ĐÃ ĐĂNG KÝ, ấn chắc và đặt phẳng...")
                    await asyncio.sleep(1.0)  # chờ người dùng nhấc tay

            if not captured_any:
                await ws.send(json.dumps({
                    "type": "scan_result", "job_id": job_id,
                    "match": False, "score": 0, "error": "TIMEOUT",
                }))
                return

            print(f"[Agent] {'✅' if matched else '❌'} {job_id}: match={matched} score={score}")
            await ws.send(json.dumps({
                "type": "scan_result", "job_id": job_id,
                "match": matched, "score": score,
            }))

        except Exception as e:
            # ★ LƯỚI AN TOÀN CUỐI — mọi exception chưa được bắt ở trên đều rơi vào đây
            print(f"[Agent] ❌ scan exception: {type(e).__name__}: {e}")
            try:
                await ws.send(json.dumps({
                    "type": "scan_result", "job_id": job_id,
                    "match": False, "score": 0,
                    "error": f"{type(e).__name__}: {str(e)[:180]}",
                }))
            except Exception as send_err:
                # WS đã đóng — không còn cách nào báo frontend, chỉ log
                print(f"[Agent] ⚠️ Không gửi được scan_result lỗi: {send_err}")

        finally:
            # ★ Bọc release_device trong try riêng — close_device() lỗi không được
            #   ghi đè exception gốc hoặc làm task crash
            if device_acquired:
                try:
                    self._release_device()
                except Exception as rel_err:
                    print(f"[Agent] ⚠️ release_device error: {rel_err}")

    async def _handle_enroll(self, ws, job, cancel_event: threading.Event):
        """
        ★ Gia cố cùng pattern với _handle_scan:
        - Outer try bao trùm _ensure_device_open
        - device_acquired flag balance active_jobs
        - finally luôn reset busy + enroll_state, bọc release_device an toàn
        - Mọi nhánh lỗi đều gửi enroll_result (success=False)
        """
        job_id = job.get("job_id")
        user_id = job.get("user_id")
        device_acquired = False

        try:
            step_timeout = max(10, int(job.get("timeout_seconds", 60) or 60) // 3)

            print(f"\n[Agent] 📥 enroll {job_id} | user={user_id} | {step_timeout}s/lần")

            # ★ Validate job_id
            if not job_id:
                print("[Agent] ❌ enroll: thiếu job_id — bỏ qua")
                return

            # ★ Mở thiết bị trong try
            try:
                device_acquired = self._ensure_device_open()
            except Exception as open_err:
                print(f"[Agent] ❌ enroll open_device() raise: {open_err}")
                device_acquired = False

            if not device_acquired:
                await ws.send(json.dumps({
                    "type": "enroll_result", "job_id": job_id,
                    "success": False, "error": "DEVICE_OFFLINE",
                }))
                return

            self.busy = True
            self.enroll_step = 0
            self.enroll_total = 3
            self.enroll_state = "waiting_touch_1"

            templates = []
            for i in range(3):
                self.enroll_step = i
                self.enroll_state = f"waiting_touch_{i+1}"

                if cancel_event.is_set():
                    print(f"[Agent] ⏹️ Enroll {job_id} bị hủy trước lần {i+1}.")
                    self.enroll_state = "cancelled"
                    try:
                        await ws.send(json.dumps({
                            "type": "enroll_result", "job_id": job_id,
                            "success": False, "error": "CANCELLED",
                        }))
                    except Exception:
                        pass
                    return

                print(f"[Agent] 👉 Lần {i+1}/3 — Đặt tay...")
                t = await asyncio.to_thread(
                    self.svc.wait_for_finger, step_timeout, cancel_event
                )

                if cancel_event.is_set():
                    print(f"[Agent] ⏹️ Enroll {job_id} bị hủy sau lần {i+1}.")
                    self.enroll_state = "cancelled"
                    try:
                        await ws.send(json.dumps({
                            "type": "enroll_result", "job_id": job_id,
                            "success": False, "error": "CANCELLED",
                        }))
                    except Exception:
                        pass
                    return

                if t is None:
                    self.enroll_state = "timeout"
                    try:
                        await ws.send(json.dumps({
                            "type": "enroll_result", "job_id": job_id,
                            "success": False,
                            "error": f"Lần {i+1} quét không thành công sau {step_timeout}s. Vui lòng thử lại.",
                        }))
                    except Exception:
                        pass
                    return

                if i > 0:
                    matched, score = await asyncio.to_thread(
                        self.svc.compare_templates, templates[0], t
                    )
                    if not matched:
                        self.enroll_state = "mismatch"
                        try:
                            await ws.send(json.dumps({
                                "type": "enroll_result", "job_id": job_id,
                                "success": False,
                                "error": f"Lần {i+1} không khớp ngón ban đầu. Vui lòng thử lại.",
                            }))
                        except Exception:
                            pass
                        return

                templates.append(t)
                self.enroll_step = i + 1
                self.enroll_state = f"captured_{i+1}" if (i + 1 < 3) else "merging"
                print(f"[Agent] ✓ Ghi nhận ngón tay lần {i+1}/3 thành công")
                try:
                    await ws.send(json.dumps({
                        "type": "enroll_progress", "job_id": job_id,
                        "step": i + 1, "total": 3,
                    }))
                except Exception:
                    pass
                await asyncio.sleep(0.8)

            if cancel_event.is_set():
                print(f"[Agent] ⏹️ Enroll {job_id} bị hủy trước khi merge.")
                self.enroll_state = "cancelled"
                try:
                    await ws.send(json.dumps({
                        "type": "enroll_result", "job_id": job_id,
                        "success": False, "error": "CANCELLED",
                    }))
                except Exception:
                    pass
                return

            from zk_service import to_csharp_byte_array
            result = self.svc.zk.DBMerge(
                to_csharp_byte_array(templates[0]),
                to_csharp_byte_array(templates[1]),
                to_csharp_byte_array(templates[2]),
            )
            merged_bytes = bytes(result[0]) if isinstance(result, tuple) else bytes(result)
            print(f"[Agent] ✅ enroll {job_id} done, merged={len(merged_bytes)}B")
            self.enroll_state = "completed"

            await ws.send(json.dumps({
                "type": "enroll_result", "job_id": job_id,
                "success": True,
                "template_b64": base64.b64encode(merged_bytes).decode(),
            }))

        except Exception as e:
            # ★ LƯỚI AN TOÀN CUỐI
            self.enroll_state = "error"
            print(f"[Agent] ❌ enroll exception: {type(e).__name__}: {e}")
            try:
                await ws.send(json.dumps({
                    "type": "enroll_result", "job_id": job_id,
                    "success": False,
                    "error": f"{type(e).__name__}: {str(e)[:180]}",
                }))
            except Exception as send_err:
                print(f"[Agent] ⚠️ Không gửi được enroll_result lỗi: {send_err}")

        finally:
            # ★ Luôn reset state, không phụ thuộc vào nhánh điều khiển nào ở trên
            self.busy = False
            if self.enroll_state not in ("completed", "cancelled", "error", "timeout", "mismatch"):
                self.enroll_state = "idle"

            if device_acquired:
                try:
                    self._release_device()
                except Exception as rel_err:
                    print(f"[Agent] ⚠️ enroll release_device error: {rel_err}")

def ensure_ca_trusted():
    """Exe chạy lần đầu: cài rootCA.pem vào kho tin cậy của người dùng Windows
    để trình duyệt tin HTTPS của agent (127.0.0.1:9001) và của Server.
    Chỉ chạy 1 lần (marker .ca_installed); Windows có thể hiện hộp thoại xác nhận."""
    if not (_FROZEN and sys.platform == "win32"):
        return
    marker = os.path.join(_HERE, ".ca_installed")
    ca = _find_file("rootCA.pem")
    if os.path.exists(marker) or not os.path.exists(ca):
        return
    try:
        import subprocess
        r = subprocess.run(["certutil", "-user", "-addstore", "Root", ca],
                           capture_output=True, text=True, timeout=60)
        if r.returncode == 0:
            print("[Agent] 🔐 Đã cài rootCA vào kho tin cậy của người dùng.")
            try:
                open(marker, "w").write("ok")
            except OSError:
                pass
        else:
            print("[Agent] ⚠️ Chưa cài được rootCA (bạn có thể đã bấm 'No'). Lần sau sẽ hỏi lại.")
    except Exception as e:
        print(f"[Agent] ⚠️ Lỗi cài rootCA: {e}")

def main():
    ensure_ca_trusted()
    device_id = get_or_create_device_id()
    ssl_ctx = build_ssl_context()
    agent = FingerprintAgent(device_id, ssl_context=ssl_ctx)
    start_device_id_server(device_id, DEVICE_SERVER_HOST, DEVICE_SERVER_PORT, agent)

    def _stop(*_):
        agent.running = False
        try:
            agent.svc.close()
        except Exception:
            pass

    signal.signal(signal.SIGINT, _stop)

    try:
        asyncio.run(agent.run())
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        try:
            agent.svc.close()
        except Exception:
            pass

if __name__ == "__main__":
    main()
