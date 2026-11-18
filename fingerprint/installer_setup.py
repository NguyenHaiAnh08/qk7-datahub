"""QK7 Fingerprint Agent — bộ cài 1 file (không cần quyền admin).

  QK7AgentSetup.exe              → cài đặt
  QK7AgentSetup.exe /uninstall   → gỡ cài đặt   (cũng là Uninstall.exe trong thư mục cài)
  QK7AgentSetup.exe /silent      → cài không hỏi
"""
import ctypes, os, subprocess, sys, shutil, time, winreg

APP = "QK7 Fingerprint Agent"
EXE = "QK7FingerprintAgent.exe"
INSTALL_DIR = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "QK7Agent")
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
UNINSTALL_KEY = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\QK7FingerprintAgent"
FLAGS = {a.lower() for a in sys.argv[1:]}
SILENT = "/silent" in FLAGS
NOWND = 0x08000000  # CREATE_NO_WINDOW

def msg(text, style=0x40):  # 0x40 info, 0x10 error, 0x24 yes/no
    if SILENT:
        return 6
    return ctypes.windll.user32.MessageBoxW(0, text, APP, style)

def res(name):
    return os.path.join(getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__))), name)

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, creationflags=NOWND)

def kill_agent():
    run(["taskkill", "/F", "/IM", EXE])
    time.sleep(1.0)

def shortcut(path, target, workdir):
    ps = ("$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%s');"
          "$s.TargetPath='%s';$s.WorkingDirectory='%s';$s.WindowStyle=7;$s.Save()") % (path, target, workdir)
    run(["powershell", "-NoProfile", "-Command", ps])

def start_menu():
    return os.path.join(os.environ["APPDATA"], r"Microsoft\Windows\Start Menu\Programs", APP + ".lnk")

def desktop():
    return os.path.join(os.path.expanduser("~"), "Desktop", APP + ".lnk")

def install():
    if msg(f"Cài đặt {APP} vào:\n{INSTALL_DIR}\n\nTiếp tục?", 0x24) != 6:
        return
    try:
        kill_agent()
        os.makedirs(INSTALL_DIR, exist_ok=True)
        target = os.path.join(INSTALL_DIR, EXE)
        shutil.copy2(res(EXE), target)
        shutil.copy2(sys.executable, os.path.join(INSTALL_DIR, "Uninstall.exe"))
        shortcut(start_menu(), target, INSTALL_DIR)
        shortcut(desktop(), target, INSTALL_DIR)
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as k:
            winreg.SetValueEx(k, "QK7FingerprintAgent", 0, winreg.REG_SZ, f'"{target}"')
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY) as k:
            for n, v in (("DisplayName", APP), ("Publisher", "QK7 DataHub"), ("InstallLocation", INSTALL_DIR),
                         ("UninstallString", f'"{os.path.join(INSTALL_DIR, "Uninstall.exe")}" /uninstall')):
                winreg.SetValueEx(k, n, 0, winreg.REG_SZ, v)
        subprocess.Popen([target], cwd=INSTALL_DIR, creationflags=0x00000010)  # CREATE_NEW_CONSOLE
        msg(f"Đã cài đặt xong.\n\n• Agent đang chạy (cửa sổ console — hãy giữ mở).\n"
            f"• Tự chạy cùng Windows.\n• Lần đầu Windows hỏi cài chứng chỉ: bấm Yes, rồi mở lại trình duyệt.")
    except Exception as e:
        msg(f"Cài đặt thất bại:\n{e}", 0x10)
        sys.exit(1)

def uninstall():
    if msg(f"Gỡ cài đặt {APP}?", 0x24) != 6:
        return
    kill_agent()
    for p in (start_menu(), desktop()):
        try: os.remove(p)
        except OSError: pass
    for root, key in ((winreg.HKEY_CURRENT_USER, RUN_KEY),):
        try:
            with winreg.OpenKey(root, key, 0, winreg.KEY_SET_VALUE) as k:
                winreg.DeleteValue(k, "QK7FingerprintAgent")
        except OSError: pass
    try: winreg.DeleteKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY)
    except OSError: pass
    # xóa thư mục cài sau khi tiến trình này thoát
    subprocess.Popen(f'cmd /c ping -n 3 127.0.0.1 >nul & rmdir /s /q "{INSTALL_DIR}"',
                     shell=True, creationflags=NOWND)
    msg("Đã gỡ cài đặt.")

if __name__ == "__main__":
    uninstall() if "/uninstall" in FLAGS else install()
