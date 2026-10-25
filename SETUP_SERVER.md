# HƯỚNG DẪN SETUP MÁY CHỦ SERVER & MÁY TRẠM CLIENT — QK7 DATAHUB

Tài liệu hướng dẫn chi tiết quy trình thiết lập máy chủ (Server), cấu hình biến môi trường, khởi động hệ thống hàng ngày và cài đặt trạm máy quét sinh trắc học vân tay Client (ZKTeco ZK9500) trong mạng nội bộ Quân Khu 7.

---

## PHẦN A — SETUP MÁY SERVER (192.168.1.xxx)
*(Thay `192.168.1.xxx` bằng địa chỉ IP server thực tế trong mạng LAN)*

### 1. Kiểm tra môi trường hệ thống
Mở **PowerShell** và chạy các lệnh:
```powershell
node --version        # Yêu cầu >= 22.13 (Tải tại: https://nodejs.org/)
npm --version
python --version      # Yêu cầu >= 3.10  (Tải tại: https://www.python.org/downloads/)
```

### 2. Kiểm tra dịch vụ Microsoft SQL Server
Chạy lệnh kiểm tra SQL Server trong PowerShell:
```powershell
Get-Service | Where-Object {$_.Name -like "MSSQL*"}
```
> **Lưu ý:** Phải có ít nhất 1 service trạng thái **Running** (ví dụ: `MSSQLSERVER` hoặc `MSSQL$SQLEXPRESS`).

---

### 3. Cấu hình biến môi trường Backend (`backend\.env`)
Tạo hoặc mở file `backend\.env` và điền nội dung cấu hình:
```env
# ─── Server ───
PORT=8000
NODE_ENV=production

# ─── SQL Server ───
# localhost nếu cùng máy. IP máy khác nếu SQL Server ở máy khác.
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=QK7_ThuVienSo
DB_USER=sa
DB_PASSWORD=<mật_khẩu_SQL_Server_thật_của_bạn>
DB_ENCRYPT=false
DB_TRUST_CERT=true

# ─── Bảo vệ đăng nhập ───
LOCKOUT_MAX_ATTEMPTS=6
LOCKOUT_WINDOW_MINUTES=15
IPBLOCK_MAX_ATTEMPTS=6
IPBLOCK_WRONG_PASSWORD_MAX_ATTEMPTS=15
IPBLOCK_WINDOW_MINUTES=15
IPBLOCK_DURATION_MINUTES=30

# ─── Swagger ───
ENABLE_SWAGGER=false

# ─── Parser ───
PARSER_STRICT_MODE=false

# ─── JWT ───
JWT_SECRET=<sinh_ngay_bên_dưới>
JWT_EXPIRES_IN=8h

# ─── Fingerprint ───
FP_ENC_KEY=k42yVJ1TDdgCiNX+gIFRDvddfvihwjvREJcBSPbpJkw=
FINGERPRINT_BRIDGE_TOKEN=qk7_bridge_2026_secret_xyz9876543210abcdef
```

* **Sinh `JWT_SECRET` mới:** Chạy lệnh sau trong PowerShell, copy chuỗi sinh được và dán vào `JWT_SECRET` trong `.env`:
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

---

### 4. Cấu hình biến môi trường AI boxchat (`boxchat\.env`)
Tạo hoặc mở file `boxchat\.env` (nếu chưa có thì tạo mới):
```env
BACKEND_UPLOADS_DIR=../backend/uploads
QDRANT_STORAGE_PATH=./local_storage/qdrant_data
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

---

### 5. Cài đặt dependencies (Chỉ lần đầu)
Mở cửa sổ Command Prompt (CMD) và chạy lần lượt:
```cmd
cd /d D:\QK7_DataHub\qk7-datahub\backend
npm install

cd /d D:\QK7_DataHub\qk7-datahub\frontend
npm install

cd /d D:\QK7_DataHub\qk7-datahub\boxchat
pip install -r requirements.txt
```

---

### 6. Đóng gói giao diện Frontend (Production Build)
Chạy lệnh build tại thư mục `frontend`:
```cmd
cd /d D:\QK7_DataHub\qk7-datahub\frontend
npm run build
```

Kiểm tra file build đã vào `backend/public/`:
```cmd
dir D:\QK7_DataHub\qk7-datahub\backend\public\index.html
```

---

### 7. Khởi tạo tài khoản quản trị viên
Tại thư mục `backend`, chạy:
```cmd
cd /d D:\QK7_DataHub\qk7-datahub\backend
node setup-passwords.js
```
*(Lệnh này khởi tạo tài khoản quản trị: Mã `USR-001`, Mật khẩu `123456789`, Vai trò `ADMIN`)*

---

### 8. Mở Firewall Windows trên máy Server
Chạy PowerShell (Run as Administrator) mở port 8000 cho các máy Client trong mạng LAN:
```powershell
New-NetFirewallRule -DisplayName "QK7 Backend 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

---

## PHẦN B — CHẠY SERVER (HÀNG NGÀY)

1. **Khởi động hệ thống máy chủ (Backend + AI boxchat):**
   - Click đúp vào tệp `s.bat` trong thư mục gốc `D:\QK7_DataHub\qk7-datahub\s.bat`.
2. **Khởi động trạm quét vân tay trên máy chủ (nếu server có cắm máy quét ZK9500):**
   ```cmd
   cd /d D:\QK7_DataHub\qk7-datahub\fingerprint
   python agent.py
   ```

---

## PHẦN C — SETUP MÁY CLIENT (192.168.1.X)

### 1. Cài driver ZK9500 & Python
- Cài đặt driver cho máy quét quang học ZK9500.
- Kiểm tra file driver:
  ```cmd
  dir C:\Windows\System32\libzkfp.dll
  ```
- Kiểm tra Python (yêu cầu >= 3.10, tick chọn "Add Python to PATH"):
  ```cmd
  python --version
  ```

### 2. Cài chứng chỉ rootCA vào Windows Root Store
Mở PowerShell (Run as Administrator) trên máy Client:
```powershell
# Copy rootCA.pem từ share LAN của server về client (nếu chưa có)
Copy-Item "\\192.168.1.229\QK7Share\rootCA.pem" "C:\QK7Agent\rootCA.pem" -Force

# Cài vào Windows Root Store
Import-Certificate -FilePath "C:\QK7Agent\rootCA.pem" -CertStoreLocation Cert:\LocalMachine\Root
```

### 3. Tạo thư mục trạm máy quét `C:\QK7Agent\`
Tạo thư mục `C:\QK7Agent\` trên máy Client với cấu trúc:
```text
C:\QK7Agent\
├── agent.py
├── libzkfp.dll
├── requirements.txt
├── s-agent.bat
├── .env                    ← sửa ở bước 4
└── (chưa có device_id.txt — sẽ tự sinh khi chạy lần đầu)
```

### 4. Cấu hình file `C:\QK7Agent\.env`
Tạo/sửa file `.env` trên máy Client (thay IP bằng IP máy server thực tế):
```env
# Cấu hình cho MÁY CLIENT — KHÔNG dùng localhost
BACKEND_WS_URL=ws://192.168.1.229:8000/ws/fingerprint
BRIDGE_TOKEN=qk7_bridge_2026_secret_xyz9876543210abcdef
DEVICE_SERVER_HOST=127.0.0.1
DEVICE_SERVER_PORT=9001
MATCH_SCORE_THRESHOLD=45
```

### 5. Cài đặt Python dependencies cho Agent
Mở CMD tại máy Client và chạy:
```cmd
cd /d C:\QK7Agent
pip install -r requirements.txt
```

### 6. Chạy thử nghiệm Fingerprint Agent
```cmd
cd /d C:\QK7Agent
python agent.py
```
*(Hoặc click đúp file `s-agent.bat`)*

### 7. Đăng ký tự động chạy khi Login Windows (Startup)
Để quân nhân / cán bộ không phải mở CMD mỗi sáng, đặt shortcut vào Startup:
1. Nhấn **Win + R**, gõ `shell:startup`, bấm **Enter**.
2. Trong thư mục vừa mở, click chuột phải → **New** → **Shortcut**.
3. Trong ô *"Type the location of the item"*, nhập:
   ```text
   C:\QK7Agent\s-agent.bat
   ```
4. Bấm **Next** → đặt tên `QK7 Fingerprint Agent` → bấm **Finish**.

---

## 🌐 KIỂM TRA TRUY CẬP HOÀN TẤT

Sau khi thiết lập hoàn tất, mở trình duyệt từ máy Client hoặc Server để kiểm tra:
* **Giao diện Web QK7 DataHub:** 👉 **`http://192.168.1.229:8000`** *(hoặc IP máy server của bạn)*
* **Tài liệu Swagger API:** `http://192.168.1.229:8000/api-docs`
* **Microservice AI boxchat:** `http://192.168.1.229:8001/docs`
* **Trạm kiểm soát vân tay nội bộ:** `http://127.0.0.1:9001/device-id`

---

## PHẦN D — TRẢI NGHIỆM TRÊN MÁY TÍNH BẢNG IPAD AIR M4 (IPADOS)

### 1. Kết nối mạng WiFi quân khu
- Kết nối máy tính bảng iPad Air M4 (11-inch hoặc 13-inch) vào mạng WiFi nội bộ cùng dải mạng LAN với máy chủ Server (ví dụ: `192.168.1.xxx`).

### 2. Truy cập qua trình duyệt iPadOS
- Mở một trong các trình duyệt: **Safari**, **Google Chrome**, **Google App** hoặc **Cốc Cốc**.
- Nhập địa chỉ: **`http://192.168.1.229:8000`** *(thay bằng IP máy chủ Server)*.

### 3. Tùy chỉnh chế độ hiển thị
- Chạm vào nút **Chuyển chế độ thiết bị** trên thanh Header (icon Máy tính / Tablet) để chuyển sang chế độ **iPad Touch UI** tối ưu thao tác ngón tay (Touch Target ≥ 44×44px, thanh điều hướng dạng viên thuốc căn giữa).
- Hỗ trợ hoàn hảo cả **Chế độ để ngang (Landscape - 1210×802px)** và **Chế độ để dọc (Portrait - 834×1178px)** mà không bị vỡ layout, tràn chữ hay lệch khung hình.
- Khi cần xem trên màn hình máy tính bàn, chạm chuyển sang chế độ **PC Widescreen** để sử dụng cụm nút bấm chuyển trang màu sắc chuyên biệt (`Đăng tải`, `Trung tâm thư viện số`, `Đơn vị của tôi`, `Quản trị`) ổn định, không bị nhảy vị trí khi chuyển trang.
