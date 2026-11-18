"""Build bộ cài 1 file: dist/QK7AgentSetup.exe
Dùng: python build_setup.py --server 192.168.1.229
"""
import argparse, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser(); ap.add_argument("--server", required=True); ap.add_argument("--port", default="8000")
a = ap.parse_args()
subprocess.check_call([sys.executable, os.path.join(HERE, "build_exe.py"), "--server", a.server, "--port", a.port], cwd=HERE)
agent = os.path.join(HERE, "dist", "QK7FingerprintAgent.exe")
subprocess.check_call([sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile", "--windowed",
    "--name", "QK7AgentSetup", "--distpath", os.path.join(HERE, "dist"),
    "--workpath", os.path.join(HERE, "build_tmp_setup"), "--specpath", os.path.join(HERE, "build_tmp_setup"),
    "--add-data", f"{agent};.", os.path.join(HERE, "installer_setup.py")], cwd=HERE)
print("\n[OK] Setup: " + os.path.join(HERE, "dist", "QK7AgentSetup.exe"))
