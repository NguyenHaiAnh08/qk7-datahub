# CHÍNH SÁCH & HƯỚNG DẪN BẢO MẬT HỆ THỐNG QK7 DATAHUB
*(Phiên bản v4.1 — Chuẩn hóa An toàn Thông tin & Khắc phục Báo cáo Quét An ninh)*

Tài liệu này quy chuẩn toàn bộ kiến trúc bảo mật HTTP Header, quản lý chứng chỉ số SSL/TLS, quy trình kiểm soát phiên làm việc và các đánh giá rủi ro (trade-off) trong quá trình vận hành hệ thống Thư viện số & Trợ lý AI QK7 DataHub.

---

## 1. Danh Mục Security Headers Đã Triển Khai (100% Endpoints)

Toàn bộ các phản hồi từ Express Gateway cổng `:8000` (bao gồm mã `2xx`, `3xx`, `4xx` và `5xx`) đều được gắn đầy đủ các tiêu đề an ninh theo tiêu chuẩn OWASP và CIS Benchmark:

| Header | Giá trị chuẩn hóa | Mục đích & Finding khắc phục |
| :--- | :--- | :--- |
| **Strict-Transport-Security (HSTS)** | `max-age=31536000; includeSubDomains` | **Findings #5–#12:** Ép buộc 100% kết nối HTTPS trong 1 năm, chống tấn công SSL Stripping / Man-in-the-Middle. |
| **Content-Security-Policy (CSP)** | `default-src 'self'; script-src 'self' 'nonce-<N>'; style-src 'self' 'nonce-<N>'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: data: ws: wss:; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests` | **Findings #13, #16, #19, #22, #25, #28, #31, #34:** Loại bỏ hoàn toàn `unsafe-inline` và `unsafe-eval`. Sử dụng cơ chế Nonce ngẫu nhiên per-request (`res.locals.cspNonce`), ngăn chặn triệt để XSS và Code Injection. |
| **Permissions-Policy** | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | **Findings #14, #17, #20, #23, #26, #29, #32, #35:** Vô hiệu hóa các API nhạy cảm của trình duyệt không thuộc phạm vi khai thác tài liệu quân sự. |
| **Cross-Origin-Opener-Policy (COOP)** | `same-origin` | **Findings #15, #18, #21, #24, #27, #30, #33, #36:** Cô lập ngữ cảnh duyệt web, ngăn chặn tấn công Spectre qua kênh phụ trình duyệt (Cross-Origin attacks). |
| **Cross-Origin-Resource-Policy (CORP)** | `same-origin` | Bảo vệ tài nguyên nhạy cảm (tài liệu PDF, biểu đồ, avatar) không bị load trái phép từ origin khác. |
| **X-Content-Type-Options** | `nosniff` | Chống tấn công MIME-type Sniffing (ngăn trình duyệt tự đoán định kiểu MIME thực thi mã độc). |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Ngăn rò rỉ đường dẫn tài liệu và tham số URL sang các tên miền bên ngoài. |
| **X-Frame-Options** | `DENY` | Chống Clickjacking — không cho phép nhúng ứng dụng vào `<iframe>` ngoài tầm kiểm soát. |
| **Ẩn thông tin Server & Engine** | Xóa bỏ `Server` và `X-Powered-By` | Che giấu dấu vết công nghệ (Fingerprinting mitigation). |

---

## 2. Quy Trình Cấp Phát & Deploy Chứng Chỉ SSL/TLS (Finding #3)

Để loại bỏ cảnh báo Self-Signed SSL (`_ssl.c:1144` / SSL/TLS untrusted), hệ thống cung cấp 2 giải pháp chuẩn:

### 2.1. Môi trường Dev / Test / Mạng LAN Quân sự Cô lập (Air-Gap) — Sử dụng `mkcert`
Trong mạng cô lập không có kết nối Internet để xác thực Let's Encrypt qua ACME, `mkcert` được sử dụng làm **Internal Root CA**.

1. **Khởi tạo và cài đặt Local CA:**
   ```bash
   # Linux / macOS
   bash scripts/gen_cert.sh mkcert 192.168.1.229

   # Windows PowerShell
   powershell -ExecutionPolicy Bypass -File scripts/gen_cert.ps1 -Mode mkcert -Domain 192.168.1.229
   ```
   Script sẽ tự sinh chứng chỉ SAN (Subject Alternative Names) bao gồm: `192.168.1.229`, `localhost`, `127.0.0.1`, `trungtamdulieuso.tqs.com`, `::1` và xuất ra:
   - Cert: `backend/certs/cert.pem`
   - Key: `backend/certs/private-key.pem`

2. **Trust Root CA trên máy kiểm thử / Scanner:**
   - Vị trí file Root CA: chạy lệnh `mkcert -CAROOT` (thường là `~/.local/share/mkcert` hoặc `%LOCALAPPDATA%\mkcert\rootCA.pem`).
   - **Với Python Requests / Pytest / Automation:**
     ```bash
     export REQUESTS_CA_BUNDLE="$(mkcert -CAROOT)/rootCA.pem"
     export SSL_CERT_FILE="$(mkcert -CAROOT)/rootCA.pem"
     ```
   - **Với Windows Certificate Store:** Import `rootCA.pem` vào `Trusted Root Certification Authorities`.
   - **Với Ubuntu / Debian:**
     ```bash
     sudo cp rootCA.pem /usr/local/share/ca-certificates/qk7-rootCA.crt
     sudo update-ca-certificates
     ```

### 2.2. Môi trường Staging / Production có Internet — Sử dụng `certbot` (Let's Encrypt)
Chạy script cấp chứng chỉ ACME chuẩn:
```bash
bash scripts/gen_cert.sh certbot domain.truongquansu.qk7.vn
```

### 2.3. Nguyên Tắc Quản Lý Chứng Chỉ Trên Git & Chống Rò Rỉ Khóa Bí Mật (Private Key)
Nhằm tuân thủ tuyệt đối quy định an toàn thông tin quân sự và chuẩn OWASP:
1. **Chặn commit Private Key (`.gitignore`):**
   - Các file khóa bí mật (`*.pem`, `*.key`) và toàn bộ nội dung trong `backend/certs/*` (ngoại trừ `.gitkeep`) được cấu hình trong `.gitignore`.
   - **Tuyệt đối không bao giờ commit hoặc đẩy Private Key lên GitHub** để tránh nguy cơ lộ mã hóa, giải mã gói tin lưu lượng và giả mạo máy chủ.
2. **Quy trình thiết lập môi trường mới:**
   - Sau khi `git clone` hoặc checkout nhánh mới, thư mục `backend/certs/` sẽ chỉ có tệp giữ chỗ `.gitkeep`.
   - Chạy lệnh sinh chứng chỉ cục bộ:
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts\gen_cert.ps1 -Mode mkcert
     ```
   - Cặp chứng chỉ `cert.pem` và `private-key.pem` sẽ được tự động tạo ngay trên máy trạm mà không cần tải qua Internet hay lưu trên Git.
   - Nếu môi trường dev thuần túy không cần HTTPS, có thể cấu hình `USE_HTTPS=false` trong `backend/.env`.

---

## 3. Đánh Giá Trade-Off Khi Bật Header Bảo Mật (COOP / COEP / CORP)

Trong quá trình siết chặt bảo mật, cần lưu ý các trade-off kỹ thuật:

1. **Cross-Origin-Opener-Policy (`same-origin`):**
   - *Ưu điểm:* Cô lập hoàn toàn cửa sổ duyệt web, vô hiệu hóa kênh chia sẻ bộ nhớ `SharedArrayBuffer` với trang web lạ, ngăn chặn rò rỉ dữ liệu qua tấn công Spectre/Meltdown.
   - *Trade-off:* Không thể sử dụng `window.open()` liên kết 2 chiều (ví dụ mở cửa sổ popup đăng nhập SSO ngoài hệ thống nếu có liên lạc `window.opener.postMessage`). Do QK7 DataHub sử dụng xác thực vân tay 2FA cục bộ qua WebSocket nội bộ (`/ws/fingerprint`), việc bật `COOP: same-origin` **hoàn toàn tương thích và không gây lỗi**.

2. **Cross-Origin-Resource-Policy (`same-origin`):**
   - *Ưu điểm:* Ngăn các trang ngoài truy cập vào ảnh, font hoặc tệp PDF của hệ thống.
   - *Trade-off:* Tất cả tài nguyên (ảnh, font, icon, pdf worker) phải được phục vụ trực tiếp từ chính Origin (`'self'`). QK7 DataHub đã chuẩn hóa 100% Air-Gap (toàn bộ Google Fonts, Ant Design icons, PDF.js workers đều được đóng gói nội bộ trong `backend/public/`), nên CORP `same-origin` hoạt động hoàn hảo.

3. **Về Cross-Origin-Embedder-Policy (COEP):**
   - *Khuyến cáo:* Không bật `Cross-Origin-Embedder-Policy: require-corp` nếu không có nhu cầu bắt buộc dùng `SharedArrayBuffer`, vì COEP có thể chặn việc nhúng tệp PDF vào thẻ `<embed>` hoặc `<object>` khi xem trước tài liệu. Hệ thống hiện tại áp dụng `frame-ancestors 'self'` là phương án cân bằng tối ưu giữa bảo mật và tính năng.

---

## 4. Kiến Trúc "Source of Truth" Về Header

- **Express Gateway (`:8000`):** Là nguồn thẩm quyền tối cao (`Source of Truth`) cấu hình header thông qua `backend/src/security-headers.js`.
- **Nếu triển khai Nginx Reverse Proxy phía trước:**
  Đảm bảo khối `nginx.conf` sử dụng cờ `always` để không làm mất header khi backend trả về lỗi 4xx/5xx:
  ```nginx
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  proxy_pass https://127.0.0.1:8000;
  ```

