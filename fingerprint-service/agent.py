"""
Fingerprint Agent — device-based WebSocket client
"""
import asyncio
import base64
import http.server
import json
import os
import signal
import sys
import threading
import uuid

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import websockets
from dotenv import load_dotenv

load_dotenv()

BACKEND_WS_URL = os.getenv("BACKEND_WS_URL", "ws://localhost:8000/ws/fingerprint")
BRIDGE_TOKEN = os.getenv("BRIDGE_TOKEN", "")
DEVICE_SERVER_HOST = os.getenv("DEVICE_SERVER_HOST", "127.0.0.1")
DEVICE_SERVER_PORT = int(os.getenv("DEVICE_SERVER_PORT", "9001"))

if not BRIDGE_TOKEN or len(BRIDGE_TOKEN) < 16:
    print("❌ BRIDGE_TOKEN thiếu hoặc <16 ký tự trong .env")
    sys.exit(1)

from zk_service import ZK9500Service

DEVICE_ID_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "device_id.txt")


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
                    import time
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
            self.end_headers()

        def do_GET(self):
            if self.path == "/device-id":
                body = json.dumps({"device_id": device_id, "service": "qk7-fingerprint-agent"}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif self.path == "/health":
                body = json.dumps({"ok": True}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
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
    def __init__(self, device_id: str):
        self.svc = ZK9500Service()
        self.device_id = device_id
        self.running = True
        self.busy = False
        self.reconnect_delay = 3
        self.enroll_step = 0
        self.enroll_total = 3
        self.enroll_state = "idle"

    def get_enroll_status(self):
        return {
            "enrolling": bool(self.busy and self.enroll_state != "idle"),
            "step": self.enroll_step,
            "total": self.enroll_total,
            "state": self.enroll_state,
        }

    async def run(self):
        ok, msg = self.svc.load_sdk()
        print(f"[Agent] Load SDK: {msg}")
        if not ok:
            print("❌ Không load được SDK.")
            return
        ok, msg = self.svc.open_device()
        print(f"[Agent] Open device: {msg}")
        if not ok:
            print("❌ Không mở được đầu đọc ZK9500.")
            return

        print(f"[Agent] Device ID: {self.device_id}")
        print(f"[Agent] Sẵn sàng. Kết nối tới {BACKEND_WS_URL}...\n")

        while self.running:
            try:
                await self._session()
            except Exception as e:
                print(f"[Agent] Session error: {type(e).__name__}: {e}")
            if self.running:
                print(f"[Agent] Reconnect sau {self.reconnect_delay}s...")
                await asyncio.sleep(self.reconnect_delay)

    async def _session(self):
        url = f"{BACKEND_WS_URL}?device_id={self.device_id}&bridge_token={BRIDGE_TOKEN}"
        async with websockets.connect(url, ping_interval=None) as ws:
            print(f"[Agent] ✅ WS connected")
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                t = msg.get("type")
                if t == "ping":
                    await ws.send(json.dumps({"type": "pong"}))
                elif t == "scan_request":
                    asyncio.create_task(self._handle_scan(ws, msg))
                elif t == "enroll_request":
                    asyncio.create_task(self._handle_enroll(ws, msg))

    async def _handle_scan(self, ws, job):
        job_id = job.get("job_id")
        template_b64 = job.get("template_plain_b64")
        timeout = int(job.get("timeout_seconds", 30))

        if self.busy:
            print(f"[Agent] ⚠️ Bỏ qua scan {job_id} vì thiết bị đang bận.")
            await ws.send(json.dumps({
                "type": "scan_result", "job_id": job_id,
                "match": False, "score": 0, "error": "BUSY",
            }))
            return

        self.busy = True
        print(f"\n[Agent] 📥 scan {job_id} | timeout={timeout}s")
        print(f"[Agent] 👉 Đặt tay lên máy quét...")

        try:
            stored = base64.b64decode(template_b64)
            scanned = await asyncio.to_thread(self.svc.wait_for_finger, timeout)
            if scanned is None:
                await ws.send(json.dumps({
                    "type": "scan_result", "job_id": job_id,
                    "match": False, "score": 0, "error": "TIMEOUT",
                }))
                return
            matched, score = await asyncio.to_thread(self.svc.compare_templates, stored, scanned)
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
            self.busy = False

    async def _handle_enroll(self, ws, job):
        job_id = job.get("job_id")
        user_id = job.get("user_id")
        step_timeout = max(10, int(job.get("timeout_seconds", 60)) // 3)

        if self.busy:
            print(f"[Agent] ⚠️ Bỏ qua enroll {job_id} vì thiết bị đang bận.")
            await ws.send(json.dumps({
                "type": "enroll_result", "job_id": job_id,
                "success": False, "error": "BUSY",
            }))
            return

        self.busy = True
        self.enroll_step = 0
        self.enroll_total = 3
        self.enroll_state = "waiting_touch_1"
        print(f"\n[Agent] 📥 enroll {job_id} | user={user_id} | {step_timeout}s/lần")

        try:
            templates = []
            for i in range(3):
                self.enroll_step = i
                self.enroll_state = f"waiting_touch_{i+1}"
                print(f"[Agent] 👉 Lần {i+1}/3 — Đặt tay...")
                t = await asyncio.to_thread(self.svc.wait_for_finger, step_timeout)
                if t is None:
                    self.enroll_state = "timeout"
                    await ws.send(json.dumps({
                        "type": "enroll_result", "job_id": job_id,
                        "success": False, "error": f"Quét vần tay không thành công lần {i+1}/3",
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
                            "success": False, "error": f"Lần {i+1} không khớp ngón ban đầu. Vui lòng thử lại.",
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
            self.enroll_step = 0
            self.enroll_state = "idle"


def main():
    device_id = get_or_create_device_id()
    agent = FingerprintAgent(device_id)
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