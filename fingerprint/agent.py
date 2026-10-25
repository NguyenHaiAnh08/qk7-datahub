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
import time          # ★ MỚI: cho idle watchdog
import uuid
from typing import Optional

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import websockets
from dotenv import load_dotenv


_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, ".env"))

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

DEVICE_ID_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "device_id.txt")


def build_ssl_context():
    if not USE_TLS:
        return None

    ctx = ssl.create_default_context()

    ca_path = CA_CERT_PATH
    if not os.path.isabs(ca_path):
        ca_path = os.path.join(_HERE, ca_path)

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
    with open(DEVICE_ID_FILE, "w", encoding="utf-8") as f:
        f.write(did)
    return did


def free_port(port: int):
    try:
        import subprocess
        res = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
        my_pid = str(os.getpid())
        for line in res.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.strip().split()
                pid = parts[-1]
                if pid != my_pid and pid != "0":
                    print(f"[Agent] 🔄 Đóng tiến trình cũ (PID {pid}) đang chiếm cổng {port}...")
                    subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
                    time.sleep(1)
    except Exception:
        pass


def start_device_id_server(device_id: str, host: str, port: int, agent_ref=None):
    free_port(port)

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()

        def do_GET(self):
            if self.path == "/device-id":
                body = json.dumps({"device_id": device_id, "service": "qk7-fingerprint-agent"}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif self.path == "/health":
                body = json.dumps({"ok": True}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif self.path == "/enroll-status":
                status = agent_ref.get_enroll_status() if agent_ref else {
                    "enrolling": False, "step": 0, "total": 3, "state": "idle"
                }
                body = json.dumps(status).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "*")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, *args):
            pass

    try:
        server = http.server.HTTPServer((host, port), Handler)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        print(f"[Agent] Device-id server: http://{host}:{port}/device-id")
        return server
    except OSError as e:
        print(f"[Agent] ⚠️  Không mở được {host}:{port}: {e}.")
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

        # ★ MỚI — idle timeout
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
        with self.device_lock:
            self._last_activity_ts = time.monotonic()
            self.active_jobs -= 1
            if self.active_jobs <= 0:
                self.active_jobs = 0
                if self.svc.device_connected:
                    self.svc.close_device()
                    print("[Agent] 🔌 Đã nhả thiết bị ZK9500 (Tránh nóng)")

    async def _idle_watchdog(self):
        """★ MỚI — Tự đóng thiết bị khi idle quá lâu (không có job nào)."""
        while self.running:
            await asyncio.sleep(3)
            try:
                with self.device_lock:
                    if self.active_jobs <= 0 and self.svc.device_connected:
                        idle = time.monotonic() - self._last_activity_ts
                        if idle >= self._idle_timeout:
                            print(f"[Agent] 😴 Idle {idle:.0f}s ≥ "
                                  f"{self._idle_timeout}s — tự đóng thiết bị")
                            self.svc.close_device()
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
            return

        # ★ MỚI: khởi động idle watchdog
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
                except Exception as e:
                    print(f"[Agent] Session error: {type(e).__name__}: {e}")

                if self.running:
                    delay = min(3 * (2 ** retry_count), 30)
                    print(f"[Agent] Reconnect sau {delay}s...")
                    await asyncio.sleep(delay)
                    retry_count += 1
        finally:
            if self._idle_task:
                self._idle_task.cancel()

    async def _session(self):
        url = f"{BACKEND_WS_URL}?device_id={self.device_id}&bridge_token={BRIDGE_TOKEN}"

        connect_kwargs = {"ping_interval": None}
        if self.ssl_context is not None:
            connect_kwargs["ssl"] = self.ssl_context

        async with websockets.connect(url, **connect_kwargs) as ws:
            print(f"[Agent] ✅ WS connected ({'wss' if USE_TLS else 'ws'}://...)")
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                t = msg.get("type")
                if t == "ping":
                    await ws.send(json.dumps({"type": "pong"}))
                elif t == "scan_request":
                    self._cancel_event.set()
                    new_event = threading.Event()
                    self._cancel_event = new_event
                    asyncio.create_task(self._handle_scan(ws, msg, new_event))
                elif t == "enroll_request":
                    self._cancel_event.set()
                    new_event = threading.Event()
                    self._cancel_event = new_event
                    asyncio.create_task(self._handle_enroll(ws, msg, new_event))

    # ─────────────────────────── Handlers ───────────────────────────

    async def _handle_scan(self, ws, job, cancel_event: threading.Event):
        job_id = job.get("job_id")
        template_b64 = job.get("template_plain_b64")
        timeout = int(job.get("timeout_seconds", 30))

        print(f"\n[Agent] 📥 scan {job_id} | timeout={timeout}s")

        if not self._ensure_device_open():
            await ws.send(json.dumps({
                "type": "scan_result", "job_id": job_id,
                "match": False, "score": 0, "error": "DEVICE_OFFLINE",
            }))
            return

        print(f"[Agent] 👉 Đặt tay lên máy quét...")

        try:
            stored = base64.b64decode(template_b64)
            scanned = await asyncio.to_thread(
                self.svc.wait_for_finger, timeout, cancel_event
            )

            if cancel_event.is_set():
                print(f"[Agent] ⏹️ Scan {job_id} bị hủy bởi job mới.")
                try:
                    await ws.send(json.dumps({
                        "type": "scan_result", "job_id": job_id,
                        "match": False, "score": 0, "error": "CANCELLED",
                    }))
                except Exception:
                    pass
                return

            if scanned is None:
                await ws.send(json.dumps({
                    "type": "scan_result", "job_id": job_id,
                    "match": False, "score": 0, "error": "TIMEOUT",
                }))
                return

            matched, score = await asyncio.to_thread(
                self.svc.compare_templates, stored, scanned
            )
            print(f"[Agent] {'✅' if matched else '❌'} {job_id}: match={matched} score={score}")
            await ws.send(json.dumps({
                "type": "scan_result", "job_id": job_id,
                "match": matched, "score": score,
            }))
        except Exception as e:
            print(f"[Agent] ❌ scan error: {e}")
            try:
                await ws.send(json.dumps({
                    "type": "scan_result", "job_id": job_id,
                    "match": False, "score": 0, "error": str(e)[:200],
                }))
            except Exception:
                pass
        finally:
            self._release_device()

    async def _handle_enroll(self, ws, job, cancel_event: threading.Event):
        job_id = job.get("job_id")
        user_id = job.get("user_id")
        step_timeout = max(10, int(job.get("timeout_seconds", 60)) // 3)

        print(f"\n[Agent] 📥 enroll {job_id} | user={user_id} | {step_timeout}s/lần")

        if not self._ensure_device_open():
            await ws.send(json.dumps({
                "type": "enroll_result", "job_id": job_id,
                "success": False, "error": "DEVICE_OFFLINE",
            }))
            return

        self.busy = True
        self.enroll_step = 0
        self.enroll_total = 3
        self.enroll_state = "waiting_touch_1"

        try:
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
                    await ws.send(json.dumps({
                        "type": "enroll_result", "job_id": job_id,
                        "success": False,
                        "error": f"Lần {i+1} quét không thành công sau {step_timeout}s. Vui lòng thử lại.",
                    }))
                    return

                if i > 0:
                    matched, score = await asyncio.to_thread(
                        self.svc.compare_templates, templates[0], t
                    )
                    if not matched:
                        self.enroll_state = "mismatch"
                        await ws.send(json.dumps({
                            "type": "enroll_result", "job_id": job_id,
                            "success": False,
                            "error": f"Lần {i+1} không khớp ngón ban đầu. Vui lòng thử lại.",
                        }))
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
            self.enroll_state = "error"
            print(f"[Agent] ❌ enroll error: {e}")
            try:
                await ws.send(json.dumps({
                    "type": "enroll_result", "job_id": job_id,
                    "success": False, "error": str(e)[:200],
                }))
            except Exception:
                pass
        finally:
            self.busy = False
            self._release_device()


def main():
    device_id = get_or_create_device_id()
    ssl_ctx = build_ssl_context()
    agent = FingerprintAgent(device_id, ssl_context=ssl_ctx)
    start_device_id_server(device_id, DEVICE_SERVER_HOST, DEVICE_SERVER_PORT, agent)

    def _stop(*_):
        agent.running = False
        agent.svc.close()
        sys.exit(0)

    signal.signal(signal.SIGINT, _stop)

    try:
        asyncio.run(agent.run())
    finally:
        agent.svc.close()


if __name__ == "__main__":
    main()