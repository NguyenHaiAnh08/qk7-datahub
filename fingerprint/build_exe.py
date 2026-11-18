"""Đóng gói QK7 Fingerprint Agent thành 1 file exe chạy 'click là chạy' trên máy con.

Dùng:  python build_exe.py --server 192.168.1.229
Kết quả: dist/QK7FingerprintAgent.exe

Nhúng sẵn vào exe: địa chỉ Server + BRIDGE_TOKEN (.env), rootCA.pem (công khai),
cert.pem/private-key.pem RIÊNG của agent (chỉ cho 127.0.0.1). KHÔNG nhúng rootCA-key.pem.
Chỉ chia sẻ exe trong mạng nội bộ tin cậy vì BRIDGE_TOKEN nằm trong exe.
"""
import argparse, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
STAGE = os.path.join(HERE, "build_cfg")

def read_env(path):
    out = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            m = re.match(r"\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
            if m and not line.lstrip().startswith("#"):
                out[m.group(1)] = m.group(2).strip("'\"")
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", required=True, help="IP/tên miền Server, vd 192.168.1.229")
    ap.add_argument("--port", default="8000")
    ap.add_argument("--ca", default=os.path.join(os.environ.get("LOCALAPPDATA", ""), "mkcert", "rootCA.pem"))
    a = ap.parse_args()

    token = read_env(os.path.join(HERE, "..", "backend", ".env")).get("BRIDGE_TOKEN", "")
    if len(token) < 16:
        sys.exit("[LỖI] Không đọc được BRIDGE_TOKEN từ backend/.env")
    for f in ("cert.pem", "private-key.pem"):
        if not os.path.exists(os.path.join(HERE, f)):
            sys.exit(f"[LỖI] Thiếu fingerprint/{f} (tạo bằng mkcert 127.0.0.1 localhost)")
    if not os.path.exists(a.ca):
        sys.exit(f"[LỖI] Không thấy rootCA.pem: {a.ca}")

    shutil.rmtree(STAGE, ignore_errors=True)
    os.makedirs(STAGE)
    with open(os.path.join(STAGE, ".env"), "w", encoding="utf-8") as f:
        f.write(f"BACKEND_WS_URL=wss://{a.server}:{a.port}/ws/fingerprint\n"
                f"BRIDGE_TOKEN={token}\nCA_CERT_PATH=rootCA.pem\n"
                "DEVICE_SERVER_HOST=127.0.0.1\nDEVICE_SERVER_PORT=9001\n"
                "MATCH_SCORE_THRESHOLD=45\nDEVICE_IDLE_TIMEOUT=60\nDEVICE_FULL_RESET_ON_CLOSE=true\n")
    shutil.copy(a.ca, os.path.join(STAGE, "rootCA.pem"))
    shutil.copy(os.path.join(HERE, "cert.pem"), os.path.join(STAGE, "cert.pem"))
    shutil.copy(os.path.join(HERE, "private-key.pem"), os.path.join(STAGE, "private-key.pem"))

    sep = ";"
    cmd = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile",
           "--name", "QK7FingerprintAgent",
           "--distpath", os.path.join(HERE, "dist"),
           "--workpath", os.path.join(HERE, "build_tmp"),
           "--specpath", os.path.join(HERE, "build_tmp"),
           "--collect-all", "pyzkfp", "--collect-all", "pythonnet", "--collect-all", "clr_loader",
           "--hidden-import", "clr", "--hidden-import", "websockets.asyncio.client",
           "--hidden-import", "PIL", "--collect-submodules", "cryptography.hazmat.primitives.ciphers",
           "--hidden-import", "cryptography.hazmat.primitives.ciphers.aead",
           "--add-data", f"{STAGE}{os.sep}.env{sep}.",
           "--add-data", f"{STAGE}{os.sep}rootCA.pem{sep}.",
           "--add-data", f"{STAGE}{os.sep}cert.pem{sep}.",
           "--add-data", f"{STAGE}{os.sep}private-key.pem{sep}.",
           os.path.join(HERE, "agent.py")]
    print(">>", " ".join(cmd))
    subprocess.check_call(cmd, cwd=HERE)
    print("\n[OK] Xong: " + os.path.join(HERE, "dist", "QK7FingerprintAgent.exe"))

if __name__ == "__main__":
    main()
