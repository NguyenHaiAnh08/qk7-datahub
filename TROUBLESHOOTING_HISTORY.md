# 🛡️ SỔ TAY TỔNG HỢP SỰ CỐ & GIẢI PHÁP KỸ THUẬT (TROUBLESHOOTING HISTORY)
> **Dự án:** TRƯỜNG QUÂN SỰ QUÂN KHU 7 DATAHUB  
> **Cập nhật lần cuối:** 02/11/2026  
> **Mục đích:** Tài liệu tra cứu và khắc phục nhanh toàn bộ các lỗi kỹ thuật phát sinh từ trước đến nay trong quá trình phát triển, tích hợp phần cứng và vận hành hệ thống.

---

## 📑 MỤC LỤC SỰ CỐ
1. [Sự cố 01: Lỗi "Failed to initialize the algorithm library" trên ZKTeco Agent (:9001)](#sự-cố-01-lỗi-failed-to-initialize-the-algorithm-library-trên-zkteco-agent-9001)
2. [Sự cố 02: Lỗi giải mã mẫu vân tay "Unsupported state or unable to authenticate data" (GCM Auth Tag Mismatch)](#sự-cố-02-lỗi-giải-mã-mẫu-vân-tay-unsupported-state-or-unable-to-authenticate-data-gcm-auth-tag-mismatch)
3. [Sự cố 03: Vi phạm ràng buộc Check Constraint SQL Server `CK_LA_RESULT` trong bảng LOGIN_ATTEMPT](#sự-cố-03-vi-phạm-ràng-buộc-check-constraint-sql-server-ck_la_result-trong-bảng-login_attempt)
4. [Sự cố 04: Xung đột và bị chiếm dụng cổng mạng (:9001 của Agent và :8001 của AI Boxchat)](#sự-cố-04-xung-đột-và-bị-chiếm-dụng-cổng-mạng-9001-của-agent-và-8001-của-ai-boxchat)
5. [Sự cố 05: Modal quét vân tay 2FA Admin bị kẹt layout, nền đen che mất giao diện đăng nhập](#sự-cố-05-modal-quét-vân-tay-2fa-admin-bị-kẹt-layout-nền-đen-che-mất-giao-diện-đăng-nhập)
6. [Sự cố 06: Lỗi kiểu chữ Markdown bị nghiêng và không đồng nhất trong tài liệu PDF & Khung xem](#sự-cố-06-lỗi-kiểu-chữ-markdown-bị-nghiêng-và-không-đồng-nhất-trong-tài-liệu-pdf--khung-xem)
7. [Sự cố 07: Ký hiệu / Số hiệu văn bản bị rớt dòng trên thanh tiêu đề Modal xem văn bản](#sự-cố-07-ký-hiệu--số-hiệu-văn-bản-bị-rớt-dòng-trên-thanh-tiêu-đề-modal-xem-văn-bản)
8. [Sự cố 08: Lỗi mã hóa console Windows `cp1252` gây văng tiến trình Python khi in tiếng Việt (`UnicodeEncodeError`)](#sự-cố-08-lỗi-mã-hóa-console-windows-cp1252-gây-văng-tiến-trình-python-khi-in-tiếng-việt-unicodeencodeerror)
9. [Sự cố 09: Tồn dư tệp khóa Stale Lock (.lock) của Qdrant Vector Store gây kẹt khởi động AI](#sự-cố-09-tồn-dư-tệp-khóa-stale-lock-lock-của-qdrant-vector-store-gây-kẹt-khởi-động-ai)
10. [Sự cố 10: Xung đột tập tin build tĩnh `index.html` gây báo lỗi giả trong VS Code / TypeScript](#sự-cố-10-xung-đột-tập-tin-build-tĩnh-indexhtml-gây-báo-lỗi-giả-trong-vs-code--typescript)
11. [Sự cố 11: Tràn bộ nhớ VRAM GPU khi chạy Model AI lớn (7B) trên card đồ họa GTX 1650 (4GB)](#sự-cố-11-tràn-bộ-nhớ-vram-gpu-khi-chạy-model-ai-lớn-7b-trên-card-đồ-họa-gtx-1650-4gb)
12. [Sự cố 12: Đơn vị trực thuộc bị "mồ côi" (Orphan Unit) do `parent_id` không tồn tại trong CSDL](#sự-cố-12-đơn-vị-trực-thuộc-bị-mồ-côi-orphan-unit-do-parent_id-không-tồn-tại-trong-csdl)
13. [Sự cố 13: Xung đột lệnh shell PowerShell không nhận diện cú pháp `&&`](#sự-cố-13-xung-đột-lệnh-shell-powershell-không-nhận-diện-cú-pháp-)
14. [Sự cố 14: Chatbox từ chối tài liệu cùng cấp/tuyệt mật và chặn sai cơ chế bảo mật (>= 3)](#sự-cố-14-chatbox-từ-chối-tài-liệu-cùng-cấptuyệt-mật-và-chặn-sai-cơ-chế-bảo-mật--3)
15. [Sự cố 15: Rò rỉ token sinh trắc học 5 phút của Chatbox sang Bàn làm việc (Bypass quét vân tay khi đóng Chatbox)](#sự-cố-15-rò-rỉ-token-sinh-trắc-học-5-phút-của-chatbox-sang-bàn-làm-việc-bypass-quét-vân-tay-khi-đóng-chatbox)
16. [Sự cố 16: Chưa đặt tay quét đã báo "Xác thực thất bại - Vân tay không khớp" và hết lượt tự động](#sự-cố-16-chưa-đặt-tay-quét-đã-báo-xác-thực-thất-bại---vân-tay-không-khớp-và-hết-lượt-tự-động)
17. [Sự cố 17: Cắt cụt ghi chú kiểm toán an ninh do giới hạn độ dài NVARCHAR(255) & Thông tin văn bản bị chụp hiển thị N/A](#sự-cố-17-cắt-cụt-ghi-chú-kiểm-toán-an-ninh-do-giới-hạn-độ-dài-nvarchar255--thông-tin-văn-bản-bị-chụp-hiển-thị-na)
18. [Sự cố 18: Hàng đợi phê duyệt không hiển thị đề xuất chỉnh sửa văn bản do lệch cấu trúc cột DB & Lỗi cú pháp scope async](#sự-cố-18-hàng-đợi-phê-duyệt-không-hiển-thị-đề-xuất-chỉnh-sửa-văn-bản-do-lệch-cấu-trúc-cột-db-proposal_data-vs-cột-độc-lập--lỗi-cú-pháp-scope-async)
19. [Sự cố 19: Báo động giả chụp màn hình khi click/di chuột, lệch độ tương phản tên quân nhân chế độ ngày/đêm, và các kỹ thuật lách chống chụp màn hình (Đa màn hình, Zalo Snipping, Clipboard dán vào Paint)](#sự-cố-19-báo-động-giả-chụp-màn-hình-khi-clickdi-chuột-lệch-độ-tương-phản-tên-quân-nhân-chế-độ-ngàyđêm-và-các-kỹ-thuật-lách-chống-chụp-màn-hình-đa-màn-hình-zalo-snipping-clipboard-dán-vào-paint)
20. [Sự cố 20: Hiện tượng nhấp nháy (Flickering) PDF Canvas khi nhập liệu trong Split-Pane Modal do re-render chuỗi dependencies](#sự-cố-20-hiện-tượng-nhấp-nháy-flickering-pdf-canvas-khi-nhập-liệu-trong-split-pane-modal-do-re-render-chuỗi-dependencies)

---

## CHI TIẾT CÁC SỰ CỐ & PHƯƠNG ÁN XỬ LÝ

### Sự cố 01: Lỗi "Failed to initialize the algorithm library" trên ZKTeco Agent (:9001)

* **Triệu chứng:**
  Khi chạy `fingerprint/s-agent.bat` hoặc `python agent.py`, màn hình console in thông báo:
  ```text
  [Agent] Load SDK: Init SDK lỗi: Failed to initialize the algorithm library
  ❌ Không load được SDK.
  ```
* **Nguyên nhân gốc rễ:**
  1. Thư viện `fingerprint/libzkfp.dll` trong dự án ban đầu là phiên bản 32-bit (x86), trong khi môi trường Python chạy trên Windows 64-bit (`WinError 193: %1 is not a valid Win32 application`).
  2. `libzkfp.dll` của ZKTeco ZK9500 phụ thuộc vào thư viện thuật toán trích xuất đặc trưng `fpslib.dll` (cùng các DLL đi kèm: `zkfinger10.dll`, `ZKFPCap.dll`, `libzksensorcore.dll`, `zkfpslibLow.dll`). Khi thiếu `fpslib.dll`, hàm `ZKFPM_Init()` thất bại với mã lỗi thuật toán.
* **Cách khắc phục:**
  1. Sao chép toàn bộ bộ DLL 64-bit chuẩn từ `C:\Windows\System32\` vào thư mục `fingerprint/`:
     * `libzkfp.dll` (278,528 bytes, 64-bit chuẩn).
     * `fpslib.dll` (thư viện thuật toán cốt lõi).
     * `zkfinger10.dll`, `ZKFPCap.dll`, `libzksensorcore.dll`, `zkfpslibLow.dll`.
  2. Cập nhật `s-agent.bat` tự động phát hiện và sao chép DLL từ System32 nếu phát hiện thiếu.
* **Cách phòng ngừa:**
  Kiểm tra kiến trúc binary bằng PowerShell:
  ```powershell
  [System.Reflection.AssemblyName]::GetAssemblyName("fingerprint/libzkfp.dll")
  ```
  Đảm bảo runtime Python 64-bit luôn đi kèm DLL 64-bit.

---

### Sự cố 02: Lỗi giải mã mẫu vân tay "Unsupported state or unable to authenticate data" (GCM Auth Tag Mismatch)

* **Triệu chứng:**
  Khi người dùng hoặc Admin quét vân tay để đăng nhập hoặc mở tài liệu Mật, giao diện báo lỗi đỏ:
  `Xác thực thất bại: Template vân tay bị hỏng` hoặc `Không thể giải mã template vân tay bằng khóa FP_ENC_KEY hiện tại`.
  Log backend ghi:
  ```text
  [decryptTemplate] ❌ Lỗi giải mã template vân tay (GCM tag verification fail): Unsupported state or unable to authenticate data
  ```
* **Nguyên nhân gốc rễ:**
  Mẫu vân tay được mã hóa bằng thuật toán đối xứng **AES-256-GCM** với khóa dẫn xuất qua `crypto.scryptSync(process.env.FP_ENC_KEY, 'qk7-fp-salt', 32)`.
  Khi giá trị biến môi trường `FP_ENC_KEY` trong file `.env` bị thay đổi, sinh lại ngẫu nhiên hoặc lệch giữa file `.env` gốc và `backend/.env`, các bản ghi `USER_FINGERPRINT.template_enc` đã lưu trước đó không thể giải mã được Auth Tag của AES-GCM.
* **Cách khắc phục:**
  1. Xây dựng công cụ cứu hộ và chẩn đoán mẫu vân tay: `tools/admin-fingerprint-tool.js`:
     * Kiểm tra trạng thái: `node tools/admin-fingerprint-tool.js status`
     * Reset tạm thời: `node tools/admin-fingerprint-tool.js reset <userId>` (đặt `active = 0` để người dùng đăng nhập bằng mật khẩu và đăng ký lại).
     * Xóa sạch mẫu hỏng: `node tools/admin-fingerprint-tool.js delete <userId>`
  2. Tại Backend `server.js`: Cho phép Admin đăng nhập bằng mật khẩu khi chưa có mẫu vân tay hợp lệ (`active = 0`), ghi cảnh báo an ninh `LOGIN_NO_FP_WARNING`, hướng dẫn quản trị viên vào trang Quản lý người dùng để thu thập mẫu mới.
* **Cách phòng ngừa:**
  Khóa cố định `FP_ENC_KEY` sau khi đã cấu hình sản xuất. Khi cần xoay vòng khóa (key rotation), phải chạy script re-encrypt toàn bộ CSDL thay vì chỉ sửa file `.env`.

---

### Sự cố 03: Vi phạm ràng buộc Check Constraint SQL Server `CK_LA_RESULT` trong bảng LOGIN_ATTEMPT

* **Triệu chứng:**
  Mỗi lần người dùng đăng nhập 1FA thành công hoặc thất bại vân tay, câu lệnh `INSERT INTO LOGIN_ATTEMPT` ném ngoại lệ:
  ```text
  The INSERT statement conflicted with the CHECK constraint "CK_LA_RESULT". The conflict occurred in database "QK7_ThuVienSo", table "dbo.LOGIN_ATTEMPT", column 'result'.
  ```
* **Nguyên nhân gốc rễ:**
  Bảng `LOGIN_ATTEMPT` trong CSDL SQL Server có ràng buộc toàn vẹn cứng:
  `CHECK ([result]='LOCKED' OR [result]='USERNAME_NOT_FOUND' OR [result]='WRONG_PASSWORD' OR [result]='SUCCESS')`.
  Tuy nhiên, mã nguồn cũ cố gắng ghi các giá trị tùy biến như `'LOGIN_FAIL_FP'` hoặc `'LOGIN_1FA_SUCCESS'`.
* **Cách khắc phục:**
  Bổ sung hàm tiền xử lý và sanitize giá trị `result` tại hàm `writeLoginAttempt()` trong `backend/server.js`:
  ```javascript
  const allowed = ['LOCKED', 'USERNAME_NOT_FOUND', 'WRONG_PASSWORD', 'SUCCESS'];
  const sanitizedResult = allowed.includes(result) 
    ? result 
    : (result.includes('FAIL') ? 'WRONG_PASSWORD' : 'SUCCESS');
  ```
* **Cách phòng ngừa:**
  Luôn tra cứu định nghĩa schema CSDL (DDL) trước khi truyền các hằng số trạng thái vào câu truy vấn INSERT/UPDATE.

---

### Sự cố 04: Xung đột và bị chiếm dụng cổng mạng (:9001 của Agent và :8001 của AI Boxchat)

* **Triệu chứng:**
  Khởi động `s-agent.bat` hoặc `start-ai.bat` bị treo hoặc báo lỗi:
  `[Errno 10048] Only one usage of each socket address (protocol/network address/port) is normally permitted`.
* **Nguyên nhân gốc rễ:**
  Khi người dùng đóng cửa sổ console bằng dấu `X` hoặc tiến trình Python bị văng ngầm, tiến trình con vẫn tiếp tục chạy ngầm trong bộ nhớ Windows và giữ chặt socket socket port `9001` hoặc `8001`.
* **Cách khắc phục:**
  1. Trong `fingerprint/s-agent.bat`: Tự động tìm và diệt tất cả PID đang chiếm cổng trước khi chạy Python:
     ```bat
     for /f "tokens=5" %%a in ('netstat -aon ^| findstr :9001 ^| findstr LISTENING') do (
         taskkill /F /PID %%a >nul 2>&1
     )
     ```
  2. Trong `fingerprint/agent.py`: Bổ sung hàm `free_port(9001)` dò tìm socket và giải phóng thông qua `netstat` và `os.kill(pid, signal.SIGTERM)`.
  3. Trong `boxchat/`: Cung cấp script chuyên dụng `boxchat/free-port.ps1` giải phóng triệt để cổng `8001`.
* **Cách phòng ngừa:**
  Luôn tích hợp cơ chế pre-flight port cleanup vào mọi file kịch bản khởi động batch (`.bat`) và PowerShell (`.ps1`).

---

### Sự cố 05: Modal quét vân tay 2FA Admin bị kẹt layout, nền đen che mất giao diện đăng nhập

* **Triệu chứng:**
  Khi hiện hộp thoại quét vân tay 2FA cho Admin, toàn bộ màn hình chuyển màu đen kịt, hộp thoại bị co cụm hoặc bị che khuất một phần dưới form đăng nhập. Người dùng không thể nhìn thấy tiến trình quét.
* **Nguyên nhân gốc rễ:**
  1. Thẻ `FingerprintScanModal` được render bên trong component cha `LoginForm`, nằm dưới cây phần tử `<motion.div>` của thư viện Framer Motion có thuộc tính CSS `transform` hoặc `filter`. Theo quy chuẩn CSS, thuộc tính `transform` tạo ra một Stacking Context mới, khiến cho `position: fixed` của modal bị giới hạn kích thước trong khung con thay vì phủ toàn bộ màn hình trình duyệt (`viewport`).
  2. Lớp phủ overlay sử dụng màu nền cứng `bg-slate-950/85` quá đậm làm tối mịt màn hình.
* **Cách khắc phục:**
  1. Sử dụng kỹ thuật **React Portal** (`createPortal(modalContent, document.body)`) đưa toàn bộ DOM của modal ra ngoài trực tiếp thẻ `<body>`.
  2. Điều chỉnh lớp phủ thành hiệu ứng kính mờ mềm mại (Frosted Glass):
     `bg-slate-900/30 dark:bg-black/50 backdrop-blur-sm`.
  3. Bổ sung sự kiện đóng modal khi nhấp chuột ra ngoài vùng phủ (click outside to dismiss).
* **Cách phòng ngừa:**
  Mọi hộp thoại (Modal/Dialog/Drawer) toàn màn hình bắt buộc phải render qua `createPortal` vào `document.body` để tránh xung đột Stacking Context với thư viện animation.

---

### Sự cố 06: Lỗi kiểu chữ Markdown bị nghiêng và không đồng nhất trong tài liệu PDF & Khung xem

* **Triệu chứng:**
  Khi người dùng mở một số tài liệu (ví dụ: công văn `800/KH`), toàn bộ văn bản trong khung hiển thị bị in nghiêng (*italic*), kích thước font chữ to nhỏ không đều, làm mất mỹ quan của văn bản quân sự chính quy.
* **Nguyên nhân gốc rễ:**
  1. Trong CSS toàn cục hoặc component xem trước, thẻ `<p>` hoặc `<blockquote>` bên trong markdown container bị áp class `italic` hoặc font chữ monospace không chuẩn.
  2. Ký tự markdown chứa các thẻ gạch dưới `_` hoặc sao `*` từ nội dung văn bản hành chính (ví dụ: `Số: 800/KH_TQS`) bị trình phân tích Markdown hiểu nhầm là cú pháp định dạng in nghiêng.
* **Cách khắc phục:**
  1. Cấu hình lại CSS container xem văn bản: cưỡng chế `font-style: normal !important`, sử dụng chuẩn font Times New Roman hoặc font hệ thống hành chính rõ ràng.
  2. Xử lý escape các ký tự đặc biệt trong số hiệu văn bản trước khi đưa vào bộ render Markdown.
* **Cách phòng ngừa:**
  Phân tách rõ ràng giữa trường metadata văn bản (số hiệu, trích yếu) và nội dung tài liệu; không để cú pháp markdown tự do can thiệp vào các trường thông tin chuẩn hóa.

---

### Sự cố 07: Ký hiệu / Số hiệu văn bản bị rớt dòng trên thanh tiêu đề Modal xem văn bản

* **Triệu chứng:**
  Khi văn bản có số ký hiệu dài (ví dụ: `532/KH-CT`), nhãn số hiệu bị gãy dòng làm hai hàng (`532/KH-` ở hàng trên, `CT` ở hàng dưới), làm vỡ bố cục thanh tiêu đề.
* **Nguyên nhân gốc rễ:**
  Thẻ tag hiển thị số hiệu sử dụng CSS `flex` nhưng thiếu thuộc tính cấm ngắt dòng (`whitespace-nowrap`) và độ rộng cố định quá hẹp.
* **Cách khắc phục:**
  Áp dụng class `whitespace-nowrap shrink-0 inline-flex items-center` cho thẻ tag số hiệu, đảm bảo toàn bộ chuỗi ký hiệu luôn nằm trọn vẹn trên cùng 1 dòng ngang.
* **Cách phòng ngừa:**
  Các chuỗi định danh như Số hiệu văn bản, Cấp bậc, Mã định danh quân nhân luôn phải đi kèm `whitespace-nowrap`.

---

### Sự cố 08: Lỗi mã hóa console Windows `cp1252` gây văng tiến trình Python khi in tiếng Việt (`UnicodeEncodeError`)

* **Triệu chứng:**
  Tiến trình AI Boxchat hoặc Fingerprint Agent đột ngột thoát văng khi in log có dấu tiếng Việt:
  ```text
  UnicodeEncodeError: 'charmap' codec can't encode characters in position ...: character maps to <undefined>
  ```
* **Nguyên nhân gốc rễ:**
  Mã trang console mặc định trên hệ điều hành Windows Tiếng Anh là `cp1252` hoặc `cp437`. Khi Python cố gắng in chuỗi ký tự UTF-8 (tiếng Việt có dấu như "Trường Quân sự Quân khu 7") ra standard output mà không có thiết lập mã hóa, Python sẽ ném ngoại lệ.
* **Cách khắc phục:**
  Đặt lại cấu hình mã hóa luồng output ngay tại đầu file thực thi Python:
  ```python
  import sys
  if hasattr(sys.stdout, 'reconfigure'):
      sys.stdout.reconfigure(encoding='utf-8', errors='replace')
  if hasattr(sys.stderr, 'reconfigure'):
      sys.stderr.reconfigure(encoding='utf-8', errors='replace')
  ```
* **Cách phòng ngừa:**
  Mọi script Python chạy trên môi trường Windows bắt buộc phải có đoạn mã tái cấu hình `reconfigure(encoding='utf-8')`.

---

### Sự cố 09: Tồn dư tệp khóa Stale Lock (.lock) của Qdrant Vector Store gây kẹt khởi động AI

* **Triệu chứng:**
  Khởi động AI Boxchat (:8001) thất bại với lỗi:
  `RuntimeError: Storage folder .../qdrant_data is locked by another instance`.
* **Nguyên nhân gốc rễ:**
  Khi microservice AI bị ngắt đột ngột (tắt máy, force kill), engine lưu trữ Qdrant cục bộ chưa kịp giải phóng tệp tin khóa `.lock`. Nếu xóa file `.lock` một cách mù quáng trong khi tiến trình khác đang ghi dữ liệu thì sẽ gây hỏng cơ sở dữ liệu vector.
* **Cách khắc phục:**
  Xây dựng cơ chế **Process Safety Guard**:
  Sử dụng câu truy vấn CIM `Get-CimInstance Win32_Process` kiểm tra xem có tiến trình Python nào đang trỏ vào `main.py` hay không.
  * Nếu CÓ tiến trình khác: Tuyệt đối KHÔNG xóa lock, hủy thao tác để đảm bảo an toàn.
  * Nếu KHÔNG CÓ tiến trình nào: Xác nhận là stale lock từ lần crash trước, tự động xóa tệp `.lock` và khởi tạo lại kết nối thành công.
* **Cách phòng ngừa:**
  Tích hợp kiểm tra cây tiến trình hệ thống trước khi can thiệp vào các tệp lock của cơ sở dữ liệu nhúng.

---

### Sự cố 10: Xung đột tập tin build tĩnh `index.html` gây báo lỗi giả trong VS Code / TypeScript

* **Triệu chứng:**
  Trình soạn thảo mã nguồn VS Code hiển thị cảnh báo đỏ "9 errors" trong các file như `index.html`, `login`, `my-approvals...`, nhưng khi chạy lệnh biên dịch `npx tsc --noEmit` thì kết quả hoàn toàn sạch (0 lỗi, exit code 0).
* **Nguyên nhân gốc rễ:**
  Thư mục `backend/public/` chứa tệp `index.html` và các bundle assets được tạo ra từ quá trình build của Vite. Do thư mục này nằm trong phạm vi quét của VS Code Workspace, TypeScript Language Server cố gắng phân tích cú pháp của các thẻ `<script type="module">` và modulepreload được đóng gói sẵn, dẫn đến cảnh báo giả.
* **Cách khắc phục:**
  1. Thêm `backend/public/` vào mục loại trừ `exclude` trong file cấu hình `tsconfig.json` của frontend:
     ```json
     "exclude": ["node_modules", "dist", "../backend/public"]
     ```
  2. Bổ sung `backend/public/` vào `.gitignore` hoặc cấu hình `files.watcherExclude` của VS Code.
  3. Thực hiện lệnh `Developer: Reload Window` trong VS Code để xóa bộ nhớ đệm phân tích cũ.
* **Cách phòng ngừa:**
  Không để thư mục chứa sản phẩm build tĩnh (artifact) xen lẫn vào phạm vi phân tích của công cụ linter/type-checker.

---

### Sự cố 11: Tràn bộ nhớ VRAM GPU khi chạy Model AI lớn (7B) trên card đồ họa GTX 1650 (4GB)

* **Triệu chứng:**
  Khi cố gắng nạp model `qwen2.5:7b`, hệ thống phản hồi cực kỳ chậm (độ trễ 60 - 120 giây / câu hỏi), quạt tản nhiệt GPU hú to, hoặc tiến trình Ollama báo lỗi `CUDA out of memory`.
* **Nguyên nhân gốc rễ:**
  Card đồ họa thực tế của máy chủ là NVIDIA GeForce GTX 1650 chỉ có 4.0 GB VRAM. Model 7B cần tối thiểu 4.7 GB (trọng số Q4) + 1.5 GB (KV cache context) + 1.2 GB (`bge-m3` embedding) = ~7.4 GB VRAM. Khi thiếu hụt VRAM, hệ thống buộc phải đẩy layer sang RAM qua khe PCIe làm tắc nghẽn băng thông.
* **Cách khắc phục:**
  Quyết định giữ nguyên model **`qwen2.5:3b`** (kích thước ~1.9 GB) kết hợp với `bge-m3` (~1.2 GB), tổng dung lượng chiếm ~3.1 GB VRAM, nằm gọn hoàn toàn trong bộ nhớ 4.0 GB của GPU.
  Kết quả benchmark thực tế: Hit Rate đạt 100%, Citation Accuracy đạt 100%, độ trễ phản hồi chỉ còn 4.8 - 6.7 giây.
* **Cách phòng ngừa:**
  Luôn khảo sát năng lực phần cứng thực tế trước khi lựa chọn trọng số mô hình LLM.

---

### Sự cố 12: Đơn vị trực thuộc bị "mồ côi" (Orphan Unit) do `parent_id` không tồn tại trong CSDL

* **Triệu chứng:**
  Cây đơn vị Quân khu (`UnitTreeTable`) bị mất tích một số phòng ban hoặc vỡ cấu trúc đệ quy do bản ghi con có `parent_id` trỏ tới một mã đơn vị đã bị xóa khỏi CSDL.
* **Nguyên nhân gốc rễ:**
  Dữ liệu lịch sử hoặc quá trình cập nhật cơ sở dữ liệu làm phát sinh các bản ghi có khóa ngoại logic `parent_id` không hợp lệ.
* **Cách khắc phục:**
  Xây dựng cơ chế **Orphan Safeguarding** ngay tại frontend:
  Thuật toán dựng cây kiểm tra xem `parent_id` có tồn tại trong danh sách khóa hay không. Nếu không tìm thấy đơn vị cha, bản ghi lập tức được gom tự động về nút Gốc (Root Level), kèm badge cảnh báo để quản trị viên phát hiện và tái phân bổ.
* **Cách phòng ngừa:**
  Bổ sung ràng buộc khóa ngoại `FOREIGN KEY (parent_id) REFERENCES UNIT(unit_id) ON DELETE SET NULL` trong CSDL SQL Server.

---

### Sự cố 13: Xung đột lệnh shell PowerShell không nhận diện cú pháp `&&`

* **Triệu chứng:**
  Khi chạy lệnh kết hợp: `cd frontend && npm run build` trên PowerShell của Windows cũ, console báo lỗi:
  ```text
  The token '&&' is not a valid statement separator in this version.
  ```
* **Nguyên nhân gốc rễ:**
  Windows PowerShell (phiên bản 5.1 đi kèm Windows) không hỗ trợ toán tử nối lệnh `&&` (toán tử này chỉ có trong PowerShell Core 7+ hoặc cmd.exe).
* **Cách khắc phục:**
  Thay thế toán tử `&&` bằng dấu chấm phẩy `;` hoặc lệnh ghép tuần tự trong PowerShell:
  `Set-Location frontend; npm run build`
* **Cách phòng ngừa:**
  Trong tất cả các công cụ automation, file hướng dẫn và lệnh chạy tự động trên môi trường Windows PowerShell, luôn sử dụng cú pháp `Set-Location <dir>; <command>`.

---

### Sự cố 14: Chatbox từ chối tài liệu cùng cấp/tuyệt mật và chặn sai cơ chế bảo mật (>= 3)

* **Triệu chứng:**
  - Tài khoản Tuyệt mật (Cấp 5) hỏi văn bản Tuyệt mật `39-KH/ĐU`, hoặc tài khoản Mật (Cấp 3) hỏi văn bản Mật `880/KH` đều bị Chatbox từ chối với thông báo: *"Báo cáo đồng chí, tài liệu ... không phù hợp với cấp bảo mật hiện tại của đồng chí..."*.
  - Người dùng nghi ngờ cơ chế bảo vệ bị set sai điều kiện `>= 3` vì mọi văn bản Cấp 3 trở lên đều bị chặn, không hiện modal quét vân tay 2FA.
* **Nguyên nhân gốc rễ:**
  1. **Lệch pha đồng bộ dữ liệu:** Khi văn bản được tải lên qua Gateway Express, tài liệu chỉ được lưu vào SQL Server và ổ đĩa, không tự động gọi `/ai/ingest` sang Boxchat `:8001`. Kho vector chỉ có 10 chunks demo cũ, thiếu hoàn toàn `39-KH/ĐU` và văn bản `880/KH` trong vector store lại đang lưu cấp độ cũ (Cấp 5).
  2. **Ngộ nhận sai nguyên lý trong Clearance Guard (`agent_tutor.py` & `ai-routes.js`):** Khi phát hiện số hiệu văn bản trong câu hỏi, nếu không tìm thấy trong `authorized_chunks`, code mặc định kết luận là do "vượt cấp bảo mật" thay vì kiểm tra xem tài liệu có thực sự tồn tại trong kho hay không. Đoạn check này nằm trước luồng Biometric Guard nên triệt tiêu hoàn toàn cơ hội yêu cầu quét vân tay 2FA cho tài liệu $\ge 3$.
* **Cách khắc phục:**
  1. Cập nhật `agent_tutor.py` và `ai-routes.js`: Tra cứu thông tin tài liệu trong toàn bộ kho (`all_chunks`/CSDL) trước:
     - Nếu tồn tại và cấp mật thật sự lớn hơn `user_clearance`: Từ chối do vượt cấp mật.
     - Nếu tồn tại và người dùng có đủ quyền (`security_level_id <= user_clearance`): Cho phép truy cập; nếu tài liệu $\ge 3$ và chưa quét vân tay thì kích hoạt Biometric Guard (`requires_biometric: true`).
     - Nếu không tồn tại: Báo rõ "Không tìm thấy văn bản trong hệ thống dữ liệu số".
  2. Thêm cơ chế đồng bộ tự động 2 chiều tại `backend/server.js`: Mọi hành động upload, sửa, xóa mềm, khôi phục, purge đều tự động bắn webhook sang `:8001` (`/ai/ingest`, `/ai/documents/:fileId`).
  3. Cập nhật `/ai/sync-all` để tự động dọn dẹp các tài liệu cũ đã bị xóa khỏi CSDL SQL Server và chuẩn hóa đường dẫn bóc tách PDF trong `pdf_processor.py`.
* **Cách phòng ngừa:**
  Enforce tính toàn vẹn dữ liệu giữa CSDL quan hệ và Vector Store; tách bạch rõ ràng giữa "không tìm thấy dữ liệu" và "từ chối do vi phạm cấp quyền".

---

### Sự cố 15: Rò rỉ token sinh trắc học 5 phút của Chatbox sang Bàn làm việc (Bypass quét vân tay khi đóng Chatbox)

* **Triệu chứng:**
  Sau khi người dùng quét vân tay ZK9500 trong Chatbox để tra cứu văn bản Cấp 3+ (`880/KH` hoặc `39-KH/ĐU`), người dùng đóng Chatbox (`tắt chatbox`) rồi ra ngoài giao diện Bàn làm việc (Document Desk) bấm "Xem văn bản PDF" của văn bản đó thì xem được luôn, bỏ qua hoàn toàn bước quét vân tay 2FA.
* **Nguyên nhân gốc rễ:**
  1. Trong `AIChatDrawer.tsx` và `AIChatWidget.tsx`, khi quét vân tay thành công, mã nguồn ghi token vào `sessionStorage.setItem('qk7_fp_token_' + targetScanFileId, validToken)`.
  2. Khóa lưu trữ này có phạm vi toàn tab trình duyệt (`sessionStorage`), dùng chung cho cả `DocumentPreviewModal` và `fileService.ts`.
  3. Khi người dùng đóng Chatbox (click backdrop, click nút `X`, hoặc phím `ESC`), Chatbox chỉ ẩn giao diện mà không xóa token trong `sessionStorage` và không hủy state `fpToken`.
  4. Do đó, trong 5 phút hiệu lực của token, `DocumentPreviewModal` ở Bàn làm việc tìm thấy token trong `sessionStorage` nên mở thẳng PDF mà không yêu cầu quét vân tay.
* **Cách khắc phục:**
  1. **Cô lập token hoàn toàn vào React State nội bộ Chatbox:** Xóa bỏ lệnh ghi `sessionStorage` từ `AIChatDrawer.tsx` và `AIChatWidget.tsx`. Token chỉ tồn tại trong state `fpToken` kèm timestamp 5 phút (`fpTokenExpiresAt`), chỉ dùng cho phiên chat và modal xem trước trích dẫn bên trong Chatbox (`initialToken={getActiveFpToken(...)}`).
  2. **Thanh tẩy triệt để khi đóng Chatbox (`handleCloseChat`):**
     - Đặt `fpToken = null`, `fpTokenExpiresAt = null`, `targetScanFileId = ''`.
     - Duyệt và xóa toàn bộ các khóa `qk7_fp_token*` trong `sessionStorage`.
     - Hook `useEffect` lắng nghe `!isChatOpen` đảm bảo mọi luồng đóng Chatbox (backdrop, nút `X`, phím `ESC`) đều kích hoạt dọn dẹp.
  3. **Giữ nguyên trải nghiệm hội thoại trong 5 phút:** Trong lúc Chatbox đang mở, người dùng vẫn duy trì phiên tra cứu và mở xem trích dẫn liên tục mà không phải quét lại sau mỗi tin nhắn.
* **Cách phòng ngừa:**
  Tuân thủ nguyên tắc Zero-Trust: Token sinh trắc học cấp cho một ngữ cảnh (Chatbox) không được rò rỉ vào kho lưu trữ dùng chung của ngữ cảnh khác (Document Desk / Portal). Mọi phiên xác thực phải có cơ chế cleanup vòng đời rõ ràng khi đóng component.

---

### Sự cố 16: Chưa đặt tay quét đã báo "Xác thực thất bại - Vân tay không khớp" và hết lượt tự động

* **Triệu chứng:**
  Khi mở hộp thoại quét vân tay (qua Chatbox hoặc Bàn làm việc), người dùng **chưa kịp đặt tay lên đầu đọc ZK9500** thì modal đã lập tức chuyển sang trạng thái màu đỏ: *"Xác thực thất bại - Vân tay không khớp. Vui lòng thử lại. Đã hết lượt tự động. Vui lòng bấm 'Quét ngay' để thử lại"*.
* **Nguyên nhân gốc rễ:**
  1. **Thiết bị ZK9500 rơi vào trạng thái ngủ đông / lỗi mở USB:** Sau thời gian idle (≥ 60s), Agent giải phóng handle (`Terminate()`). Khi có yêu cầu quét mới, hàm `open_device()` chỉ gọi `self.zk.Init()` trên đối tượng DLL cũ mà không tạo lại instance mới, khiến `GetDeviceCount()` trả về 0 $\rightarrow$ Agent trả về lỗi `DEVICE_OFFLINE`.
  2. **Gateway Server nuốt lỗi phần cứng thành "Vân tay không khớp":** Tại Express Gateway (`backend/server.js`), khi `scanResult.match == false`, khối điều kiện không bóc tách mã lỗi `DEVICE_OFFLINE` mà mặc định gộp thành `error: Vân tay không khớp (score=0)` với HTTP `403`.
  3. **Frontend tự động retry dồn dập (Auto-retry Storm):** Nhận được mã 403 "Vân tay không khớp", `FingerprintScanModal.tsx` nhầm tưởng người dùng đặt sai ngón tay nên tự động kích hoạt 2 lượt retry liên tiếp trong vòng 2 giây. Cả 2 lượt đều vấp phải lỗi `DEVICE_OFFLINE`, dẫn tới việc cạn kiệt toàn bộ 3 lượt quét trước khi người dùng kịp chạm tay vào mắt đọc.
* **Cách khắc phục:**
  1. **Cơ chế tự đánh thức và tự phục hồi (Self-Healing SDK Reload):** Trong `zk_service.py` và `agent.py`, nếu `GetDeviceCount() <= 0` hoặc mở thiết bị thất bại, Agent tự động reload fresh instance `load_sdk()` để re-enumerate lại cổng USB và đánh thức ZK9500 trước khi gửi kết quả.
  2. **Bóc tách lỗi minh bạch tại Express Gateway:** Phân biệt rành mạch:
     - `DEVICE_OFFLINE`: Trả về `503 Service Unavailable` kèm cờ `device_offline: true`.
     - `TIMEOUT`: Trả về `408 Request Timeout`.
     - `device_error`: Trả về `500 Internal Server Error`.
     - **Chỉ trả về 403 "Vân tay không khớp"** khi thiết bị đã thu nhận ảnh vân tay thực tế nhưng điểm so khớp không đạt ngưỡng.
  3. **Ngắt vòng lặp Auto-retry tại Frontend:** Trong `FingerprintScanModal.tsx`, khi gặp lỗi `device_offline` hoặc `TIMEOUT`, hệ thống lập tức dừng auto-retry (`setRetryExhausted(true)`), hiển thị chính xác thông báo kiểm tra cáp USB / bật Agent và nút "Quét ngay" để người dùng chủ động kích hoạt khi sẵn sàng.
* **Cách phòng ngừa:**
  Không bao giờ ánh xạ lỗi kết nối vật lý/phần cứng thành lỗi sai thông tin định danh sinh trắc học của người dùng. Cần phân loại rõ mã lỗi hệ thống và có cơ chế tự phục hồi ở tầng Driver/Agent.

---

### Sự cố 17: Cắt cụt ghi chú kiểm toán an ninh do giới hạn độ dài NVARCHAR(255) & Thông tin văn bản bị chụp hiển thị N/A

* **Triệu chứng:**
  Khi mở xem chi tiết một sự kiện cảnh báo chụp màn hình (`SCREENSHOT_ATTEMPT`) trong Nhật ký kiểm toán an ninh SOC (`SecurityAuditLog.tsx`), phần *Văn bản / Đối tượng tác động* chỉ hiển thị dấu gạch `—` và phần ghi chú hiển thị: *`Cảnh báo an ninh: Phát hiện hành vi chụp màn hình (PrintScreen) trên văn bản N/A`*. Trong các trường hợp khác có thông tin văn bản, chuỗi trích yếu dài bị cắt cụt lửng lơ ở cuối mà không có dấu ngoặc đóng `]`.
* **Nguyên nhân gốc rễ:**
  1. **Kích hoạt lá chắn bị trễ:** Trong `DocumentPreviewModal.tsx`, hook `useAntiScreenshot` ban đầu dùng điều kiện `enabled: open && Boolean(blobUrl)`. Trong khoảng 1–2 giây đầu khi modal mở lên và đang tải file PDF, `blobUrl` vẫn là `null` nên lá chắn chưa được kích hoạt, dẫn đến việc chụp màn hình lúc này không gửi kèm thông tin tài liệu (`file_id = null`).
  2. **Giới hạn độ dài cột CSDL SQL Server:** Bảng `ACCESS_LOG` và `ACCESS_LOG_ARCHIVE` định nghĩa cột `note NVARCHAR(255)`. Đồng thời hàm `writeAccessLog` trong `server.js` cắt chuỗi bằng `String(note).slice(0, 255)`. Chuỗi ghi chú chuẩn chứa đầy đủ Số hiệu, Trích yếu dài, Cấp mật và Đơn vị ban hành thường vượt quá 255 ký tự, khiến chuỗi bị cắt cụt và regex ở frontend không thể parse được các trường dữ liệu.
* **Cách khắc phục:**
  1. **Kích hoạt tức thì khi mở modal:** Đổi điều kiện kích hoạt thành `enabled: open && Boolean(document)`. Ngay khi người dùng nhấp xem văn bản, lá chắn kích hoạt ngay lập tức và gắn chặt metadata (`file_id`, `document_code`, `title`, `security_name`, `unit_name`).
  2. **Mở rộng cột CSDL:** Thực thi lệnh T-SQL:
     ```sql
     ALTER TABLE ACCESS_LOG ALTER COLUMN note NVARCHAR(1000) NULL;
     ALTER TABLE ACCESS_LOG_ARCHIVE ALTER COLUMN note NVARCHAR(1000) NULL;
     ```
  3. **Cập nhật Backend:** Nâng `.input('note', sql.NVarChar(1000), note ? String(note).slice(0, 1000) : null)` trong `writeAccessLog`.
  4. **Tối ưu hóa hiển thị SOC:** Component `SecurityAuditLog.tsx` bóc tách trực tiếp quan hệ `JOIN` giữa `ACCESS_LOG.file_id` và bảng `DOCUMENT` để render thẻ cảnh báo chuyên biệt màu đỏ tươi có đầy đủ huy hiệu Cấp mật, Số hiệu, Mã tệp và Đơn vị ban hành.
* **Cách phòng ngừa:**
  Tránh giới hạn độ dài cột ghi chú kiểm toán quá ngắn (`NVARCHAR(255)`) đối với các hệ thống quản lý văn bản có trích yếu nội dung dài. Luôn thiết kế độ rộng tối thiểu 1.000 ký tự cho các cột lưu vết audit log.

---

### Sự cố 18: Hàng đợi phê duyệt không hiển thị đề xuất chỉnh sửa văn bản do lệch cấu trúc cột DB (proposal_data vs cột độc lập) & Lỗi cú pháp scope async

* **Triệu chứng:**
  Sau khi chuyển đổi luồng phê duyệt sang trang Hàng Đợi Phê Duyệt (`ApprovalQueuePage.tsx`), mặc dù trong bảng đề xuất sửa đổi văn bản (`DOCUMENT_REVISION_PROPOSAL`) đang có 4 yêu cầu chờ duyệt, nhưng giao diện Admin lại báo: *"Hàng Đợi Phê Duyệt (0 chờ) - Không có yêu cầu nào đang chờ duyệt"*. Người dùng vào trang *"Yêu cầu chỉnh sửa của tôi"* cũng không thấy đề xuất nào của mình.
* **Nguyên nhân gốc rễ:**
  1. **Lệch cấu trúc bảng CSDL:** Khi xây dựng truy vấn hợp nhất trong `backend/src/admin-routes.js`, câu lệnh SQL giả định bảng có cột chứa JSON `proposal_data` (`SELECT p.proposal_data ...`). Tuy nhiên, cấu trúc bảng `DOCUMENT_REVISION_PROPOSAL` trong CSDL thực tế lưu từng trường dữ liệu độc lập (`document_code`, `title`, `signer`, `issued_date`, `issuing_unit_id`, `security_level_id`, `note`, `review_note`). Lỗi `Invalid column name 'proposal_data'` làm truy vấn ném ngoại lệ và trả về mảng rỗng.
  2. **Lỗi cú pháp khối lệnh async:** Trong quá trình tích hợp vào `admin-routes.js`, một đoạn code thừa ngoài phạm vi handler chứa lệnh `await getPool()` khiến trình thông dịch Node.js báo lỗi `SyntaxError: await is only valid in async functions` khi khởi động lại server.
* **Cách khắc phục:**
  1. **Khắc phục câu lệnh truy vấn SQL:** Đọc đúng từng cột dữ liệu trong bảng `DOCUMENT_REVISION_PROPOSAL`, `JOIN` với bảng `DOCUMENT` và `[USER]`, đóng gói thành đối tượng `proposal_data` chuẩn hóa trước khi trả về cho Frontend.
  2. **Dọn sạch scope handler:** Xóa bỏ đoạn mã dư thừa, đảm bảo toàn bộ lệnh `await` nằm trọn vẹn trong các hàm async middleware của Express.
  3. **Khởi động lại tiến trình Daemon:** Chạy lại tiến trình backend daemon trên cổng 8000. Kết quả API `/api/admin/approval-requests?status=PENDING` lập tức trả về chính xác 4 đề xuất chờ duyệt kèm đầy đủ bảng đối chiếu so sánh thông tin chuẩn hóa 2 cột.
* **Cách phòng ngừa:**
  Trước khi viết câu lệnh truy vấn SQL mới trên các bảng nghiệp vụ nhạy cảm, luôn kiểm tra schema thực tế bằng `INFORMATION_SCHEMA.COLUMNS`. Luôn kiểm tra cú pháp (`node -c`) trước khi khởi chạy tiến trình nền.

---

### Sự cố 19: Báo động giả chụp màn hình khi click/di chuột, lệch độ tương phản tên quân nhân chế độ ngày/đêm, và các kỹ thuật lách chống chụp màn hình (Đa màn hình, Zalo Snipping, Clipboard dán vào Paint)

* **Triệu chứng:**
  1. Khi quân nhân mở xem tài liệu PDF trong hộp thoại xem trước (`DocumentPreviewModal`), chỉ cần click chuột vào nội dung PDF để cuộn trang hoặc di chuyển chuột thì hệ thống lập tức nảy popup đỏ cảnh báo vi phạm an ninh chụp màn hình (`SecurityScreenShield`).
  2. Khi chuyển sang Chế độ ban ngày (Light Mode), tên quân nhân trên Header bar và các nhãn định danh hiển thị màu xám mờ (`text-slate-800` / `text-slate-400`), độ tương phản kém và không đúng giao thức Ngày/Đêm của Quân khu.
  3. Khi sử dụng hệ thống 2 màn hình: Tài liệu mở ở màn hình 1 nhưng dùng chuột sang màn hình 2 mở Zalo (phím tắt `Ctrl + Alt + S`) hoặc Snipping Tool thì vẫn chụp lén được nội dung; mở Paint bấm `Ctrl + V` vẫn dán được hình ảnh tài liệu vừa chụp; bật phần mềm quay màn hình từ trước thì quay được hết tài liệu, chỉ khi đóng cửa sổ mới phát cảnh báo vi phạm.
* **Nguyên nhân gốc rễ:**
  1. **Báo động giả do cơ chế Blur của Chromium:** Khi người dùng click vào thẻ `<iframe>` nhúng PDF, trình duyệt chuyển `activeElement` sang iframe khiến sự kiện `window.onblur` bị kích hoạt. Bộ lắng nghe sự kiện cũ coi việc focus trở lại trang web sau đó là hành vi chụp màn hình bằng phím tắt ngoài (`Win + Shift + S`) và kích hoạt cảnh báo đỏ.
  2. **Lệch màu giao thức Ngày/Đêm:** Thiếu sự tách bạch giữa Chế độ ban ngày (`text-slate-900 font-bold`, clearance `text-emerald-800`, nút `bg-slate-100 border-slate-300`) và Chế độ ban đêm (`dark:text-white font-bold`, clearance `dark:text-emerald-400`, nút `dark:bg-slate-800 dark:border-slate-700`).
  3. **Lỗ hổng đa màn hình và ứng dụng chụp ngoài:**
     - Sự kiện mất tiêu điểm (`blur`) trước đây có độ trễ `setTimeout` 100ms, tạo khoảng trống thời gian cho Zalo và Snipping Tool chụp đóng băng khung hình.
     - Tổ hợp phím chụp màn hình chuyên dụng của Zalo (`Ctrl + Alt + S`), WeChat (`Ctrl + Alt + A`), Game Bar (`Win + Alt + R`) chưa được đưa vào danh mục phím nóng bị chặn ở tầng `keydown`.
     - Bộ nhớ tạm Clipboard của hệ điều hành chưa được ghi đè tự động khi mất focus, dẫn tới việc dán (`Ctrl + V`) ảnh chụp vào MS Paint thành công.
* **Cách khắc phục:**
  1. **Triệt tiêu 100% báo động giả:** Trong `useAntiScreenshot.ts`, kiểm tra `activeElement === iframeRef.current` và các phần tử con `.secure-pdf-content`. Khi focus nằm trong iframe hoặc người dùng thao tác cuộn/click đọc tài liệu, hệ thống bỏ qua và không kích hoạt rèm che hay cảnh báo an ninh.
  2. **Cơ chế Rèm che bảo mật vật lý tức thì (Blackout Curtain 0ms):**
     - Khi con trỏ chuột rời khỏi biên cửa sổ sang Màn hình 2 (`mouseleave`) hoặc khi cửa sổ thực sự mất tiêu điểm sang ứng dụng khác (`blur`): Kéo rèm che đen `isCurtainActive = true` và làm mờ sâu `applyInstantBlackout(true)` với độ trễ 0ms. Mọi công cụ chụp từ Màn hình 2 hoặc Zalo chỉ chụp được một màn hình màu đen tuyền kèm thông điệp *"Nội Dung Tạm Ẩn Bảo Mật"*.
     - Khi người dùng click quay lại cửa sổ: Rèm che tự động mở mượt mà để tiếp tục đọc tài liệu, không hiện popup đe dọa.
  3. **Mở rộng danh mục phím tắt chặn đứng:** Bắt chặn `e.preventDefault()` và `wipeClipboard()` cho: `PrintScreen`, `Win + Shift + S`, `Ctrl + Shift + S`, `Ctrl + Alt + S` (Zalo), `Ctrl + Alt + A`, `Win + Alt + R`, `Cmd + Shift + 3/4/5`, `Ctrl + P`, `Ctrl + S`.
  4. **Tiêu hủy dữ liệu hình ảnh trong Clipboard (Anti-Paste):**
     - Hàm `wipeClipboard()` kết hợp cả Clipboard API hiện đại và Fallback Textarea `execCommand`, ghi đè Clipboard bằng thông điệp cảnh báo an ninh bảo vệ bí mật nhà nước.
     - Lắng nghe sự kiện dán `paste` để hủy bỏ bất kỳ luồng paste ảnh nào; quét định kỳ 1.5 giây khi cửa sổ không có focus để triệt tiêu ảnh trong clipboard trước khi người dùng kịp dán vào MS Paint.
  5. **Forensic DRM Watermark chống quay lén:** Duy trì 4 vị trí Watermark chuẩn hóa (18%, 38%, 62%, 82%) nhúng chìm vĩnh viễn tên quân nhân, chức vụ, đơn vị, timestamp NTP và mã truy vết vào từng trang PDF canvas qua `stampWatermarkOnPdf`. Mọi video quay màn hình trái phép từ trước đều mang bằng chứng định danh không thể chối cãi.
  6. **Chuẩn hóa hiển thị Ngày/Đêm cho SecurityScreenShield & Hệ thống:**
     - Thiết kế giao diện cảnh báo đỏ `SecurityScreenShield` hài hòa, tương phản cao trên cả 2 chế độ:
       + **Chế độ Ban ngày (Light Mode):** Card trắng bo góc 3xl (`bg-white`), viền đỏ tươi rực rỡ (`border-2 border-rose-300`), bóng đổ viền hồng neon mềm mại (`shadow-[0_10px_50px_rgba(244,63,94,0.22)]`), các khung chi tiết chữ đen sắc nét tương phản cao.
       + **Chế độ Ban đêm (Dark Mode):** Card tối (`dark:bg-slate-900`), viền đỏ phát quang (`dark:border-rose-600/70`), shadow dạ quang đỏ chuẩn tác chiến.
     - Cập nhật đồng bộ `Header.tsx` và `UnitOverviewStrip.tsx` hiển thị tên quân nhân màu đen đậm tương phản cao `text-slate-900 font-bold` ban ngày và `dark:text-white font-bold` ban đêm.
  7. **Tối ưu hóa UX/UI & Nhận diện chính xác thao tác (Fix Compact & Trigger Matching):**
     - **Thu nhỏ khung cảnh báo (Compact Modal):** Rút gọn kích thước thẻ `SecurityScreenShield` về chuẩn `max-w-md`, chiều cao an toàn `max-h-[92vh] overflow-y-auto`, bo góc `rounded-2xl`, căn chỉnh padding `p-4 sm:p-5` để vừa khít 100% trên các màn hình laptop và iPad mà không bị tràn viền hay che khuất nút bấm.
     - **Bóc tách danh mục phím nóng chính xác (Exact Trigger Mapping):** Phân định rạch ròi từng loại hành vi:
       + `Win + Shift + S`: Hiển thị chuẩn *"Tổ hợp phím Win + Shift + S (Snipping Tool)"* (không còn bị gộp nhầm Zalo).
       + `Ctrl + Alt + S`: Hiển thị chuẩn *"Tổ hợp phím Ctrl + Alt + S (Chụp ảnh Zalo)"*.
       + `PrintScreen`: Hiển thị *"Phím PrintScreen (Chụp toàn màn hình)"*.
       + Snipping Tool ngoài: Hiển thị *"Công cụ cắt ảnh màn hình (Snipping Tool)"*.
     - **Triệt tiêu độ trễ làm mờ (0ms Instant Blackout):** Khi Windows Snipping Tool kích hoạt làm mất focus, CSS `applyInstantBlackout(true)` làm mờ sâu 60px và giảm opacity về 0.02 ngay tại 0ms (thay vì trễ 150ms như trước). Do đó khi Windows đóng băng khung hình, ảnh chụp thu được chỉ là màn hình cảnh báo đỏ hoặc khung mờ, bảo vệ hoàn toàn nội dung tài liệu.
     - **Tách biệt luồng Sao chép văn bản & Chụp màn hình:** Cập nhật thông điệp cảnh báo phù hợp khi sao chép đoạn văn (*"Nghiêm cấm sao chép, trích xuất văn bản quân sự bảo mật"* thay vì báo nhầm "dữ liệu hình ảnh").
   8. **Cơ chế Chặn Liên Tục & Giải phóng bẫy Focus Iframe (Continuous Protection Engine):**
      - **Nguyên nhân lần 2 bị lọt:** Sau khi đóng cảnh báo lần đầu, nếu người dùng nhấp chuột vào văn bản PDF để đọc, `document.activeElement` trở thành `<iframe>`. Đoạn mã cũ kiểm tra `if (activeEl === iframe) return;` trong `handleWindowBlur` khiến mọi lần bấm `Win + Shift + S` hay mất tiêu điểm về sau ĐỀU BỊ BỎ QUA hoàn toàn.
      - **Giải pháp Chặn Liên Tục:**
        + Tự động thu hồi tiêu điểm về Window (`window.focus()`) sau khi click vào PDF và sau khi đóng modal cảnh báo, đảm bảo Window luôn sẵn sàng lắng nghe `keydown` và `blur` cho mọi lần chụp tiếp theo (lần 2, lần 3, liên tục 100%).
        + Trong `handleWindowBlur`: Nếu phát hiện có phím bổ trợ chụp ảnh (`Win`, `Shift`, `Ctrl`, `Alt`) vừa được bấm trong 1.5 giây gần nhất, lập tức kích hoạt `triggerViolation(...)` và `applyInstantBlackout(true)` mà KHÔNG bỏ qua, dù `activeElement` đang ở đâu.
        + Tự động dọn sạch Clipboard liên tục (0ms, 100ms, 300ms, 800ms) để ngăn chặn triệt để hành vi dán ảnh vào MS Paint hay Zalo.

   9. **Loại bỏ hoàn toàn cơ chế Chuột/Rèm che & CHỈ cảnh báo khi sử dụng phím tắt bàn phím:**
      - **Loại bỏ cơ chế của chuột & Rèm che:** Xóa bỏ hoàn toàn lắng nghe `mouseleave`, `mouseenter`, `visibilitychange` và cơ chế rèm che *"Nội Dung Tạm Ẩn Bảo Mật"*. Người dùng di chuyển chuột, rê chuột sang Màn hình 2, hoặc click chuột chuyển tab hoàn toàn bình thường, tuyệt đối KHÔNG bị báo động giả nhầm là đang chụp màn hình.
      - **Chỉ cảnh báo khi sử dụng phím tắt bàn phím:** Chỉ kích hoạt cảnh báo khi người dùng thực sự bấm các phím/tổ hợp phím chụp màn hình (`PrintScreen`, `Win + Shift + S`, `Ctrl + Alt + S` Zalo, `Ctrl + Shift + S`, `Ctrl + P`,...).
      - **Nấc thang cảnh báo 3 lần chuẩn hóa:**
        + **Lần 1 / 3:** Cảnh báo an ninh quân sự, che mờ PDF 0ms và dọn sạch clipboard.
        + **Lần 2 / 3:** Cảnh báo nghiêm trọng, thông báo quy chế tái phạm quá 3 lần sẽ khóa tài khoản toàn hệ thống.
        + **Lần 3 / 3:** CẢNH BÁO KHẨN CẤP (Ngưỡng tối đa) - Thông báo đây là cơ hội cuối cùng trước khi bị khóa cứng.
      - **Khóa tài khoản tự động (Khi vi phạm quá 3 lần, tức từ lần thứ 4):**
        + **Backend Gateway & SQL Server:** Cập nhật ngay `UPDATE [USER] SET status = 'locked', locked_at = GETDATE()`, thu hồi toàn bộ phiên làm việc (`USER_SESSION`), ghi nhận nhật ký kiểm toán đặc biệt nghiêm trọng `ACCOUNT_LOCKED` trong `ACCESS_LOG`.
        + **Frontend UX/UI:** Modal đỏ chuyển sang chế độ Khóa cứng (`🚨 TÀI KHOẢN ĐÃ BỊ KHÓA TOÀN HỆ THỐNG`), vô hiệu hóa nút bỏ qua, buộc quân nhân phải bấm *"Đăng xuất khỏi hệ thống"* và liên hệ Trực ban Tác chiến / Quản trị viên để giải trình và thực hiện thủ tục mở khóa tài khoản qua API `/api/admin/users/:id/unlock`.

   10. **Bịt kín lỗ hổng Toàn màn hình & Cơ chế Reset số lần vi phạm về 0 khi Admin mở khóa:**
       - **Lỗ hổng Toàn màn hình (Fullscreen Vulnerability Fix):**
         + *Nguyên nhân:* Nút "Toàn màn hình" trước đây gọi hàm `handleOpenNewTab`, tạo một Blob HTML chứa iframe PDF thô và mở tab trình duyệt mới (`blob:https://...`). Tab mới này tách rời khỏi React SPA, không có hook `useAntiScreenshot`, khiến người dùng có thể chụp màn hình mà không bị chặn.
         + *Khắc phục:* Chuyển đổi nút "Toàn màn hình" sang gọi trực tiếp `handleToggleFullscreen()` kích hoạt HTML5 Fullscreen API (`modalContainerRef.current.requestFullscreen()`). Toàn bộ khung xem văn bản phóng to 100% màn hình thiết bị nhưng vẫn nằm trọn vẹn bên trong React SPA, có đầy đủ lá chắn an ninh, bắt trọn phím tắt `Win + Shift + S`, `PrintScreen` và hiển thị modal cảnh báo đỏ bảo vệ ngay trong chế độ fullscreen. Xóa bỏ hoàn toàn hàm `handleOpenNewTab` để không còn luồng rò rỉ nào qua tab ngoài.
       - **Cơ chế Reset số lần vi phạm về 0 khi Admin mở khóa tài khoản:**
         + *Nguyên nhân:* Endpoint `POST /api/admin/users/:id/unlock` trước đây chỉ cập nhật `status = 'active'` trên bảng `[USER]`, mà không xử lý các bản ghi `SCREENSHOT_ATTEMPT` cũ trong `ACCESS_LOG`. Khi người dùng được mở khóa đăng nhập lại và chụp màn hình lần đầu, câu lệnh SQL `SELECT COUNT(*) ... WHERE action = 'SCREENSHOT_ATTEMPT'` đếm cộng dồn cả 9 lần cũ cộng 1 lần mới thành 10 lần, khiến tài khoản lập tức bị khóa lại ngay tại lần chụp đầu tiên.
         + *Khắc phục:*
           1. Trong `backend/src/admin-routes.js`: Khi Admin bấm "Mở khóa tài khoản", hệ thống tự động chạy lệnh `UPDATE ACCESS_LOG SET action = 'SCREENSHOT_RESOLVED', note = ISNULL(note, '') + ' [ĐÃ ĐƯỢC ADMIN MỞ KHÓA & RESET VI PHẠM]' WHERE user_id = @uid AND action = 'SCREENSHOT_ATTEMPT'`. Giữ nguyên 100% lịch sử kiểm toán SOC nhưng đưa số lần vi phạm chưa giải quyết về đúng 0 lần.
           2. Trong `backend/server.js`: Bổ sung endpoint `GET /api/security/violation-status` để frontend chủ động đồng bộ số lần vi phạm thực tế từ máy chủ.
           3. Trong `frontend/src/hooks/useAntiScreenshot.ts` & `AuthContext.tsx`: Tự động đồng bộ số lần vi phạm từ server khi mở văn bản, dọn sạch `sessionStorage` khi login/logout; sau khi Admin mở khóa, số lần đếm bắt đầu lại từ Lần 1/3 chuẩn xác.

* **Phân tích Kiến trúc Bảo vệ (Web Client vs. Native OS):**
  - **Trên Web (Browser):** Chạy trong Chromium Sandbox, không thể gọi trực tiếp Win32 API kernel. Áp dụng chuẩn công nghiệp tương đương thư viện `Screenshot-PrivacyProtectionWeb`: kết hợp **0ms Client Shielding (CSS/JS Blurring)** + **Ghi đè Clipboard** + **Forensic Dynamic Watermark** (4 vị trí khắc vĩnh viễn Họ tên, Đơn vị, Timestamp NTP) để triệt tiêu giá trị trích xuất dữ liệu.
  - **Khuyến nghị lộ trình Native Desktop:** Nếu đơn vị yêu cầu chặn chụp màn hình cứng ở tầng hệ điều hành Windows (khiến Snipping Tool / OBS / Zalo chụp ra màn hình đen tuyền), giải pháp là đóng gói client thành ứng dụng Desktop (Electron / C# WebView2) và gọi Win32 API `SetWindowDisplayAffinity(hWnd, WDA_MONITOR)` hoặc trên Mobile dùng `FLAG_SECURE`.

---

### Sự cố 20: Hiện tượng nhấp nháy (Flickering) PDF Canvas khi nhập liệu trong Split-Pane Modal do re-render chuỗi dependencies

* **Triệu chứng:**
  Khi người dùng mở modal "Tiếp Nhận & Lưu Trữ Văn Bản Mới" hoặc "Hiệu Chỉnh Văn Bản" dạng Split-Pane, mỗi lần gõ một ký tự vào bất kỳ ô input nào (Số hiệu, Trích yếu, Người ký), trang PDF bên khung phải bị giật/nhấp nháy trắng liên tục, gây khó chịu cho mắt và làm chậm quá trình nhập liệu.
* **Nguyên nhân gốc rễ:**
  1. Trong `DocumentUploadModal.tsx`, toàn bộ component là một hàm lớn chứa state form (`formData`). Mỗi lần `onChange` input, `setFormData` làm toàn bộ component re-render.
  2. Khung PDF bên phải nhận prop `fileUrl={previewUrl}`. Dù `previewUrl` là chuỗi giống nhau nhưng component con `PdfPagesViewer` không được memoize, khiến nó re-render theo cha.
  3. Trong `PdfPagesViewer.tsx`, prop `strokes` mặc định nhận `[]` (một tham chiếu mảng mới ở mỗi lần render). Điều này khiến `redrawStrokes` callback được tạo mới.
  4. Trong `SinglePdfPage.tsx`, `useEffect` vẽ trang PDF phụ thuộc vào `[pdfDoc, pageNum, scale, redrawStrokes]`. Vì `redrawStrokes` bị đổi tham chiếu ở mỗi nhịp gõ phím, `useEffect` vẽ PDF bị trigger lại, thực hiện `renderTask.cancel()`, xóa canvas (`canvas.width = canvas.width`) và render lại từ đầu, gây ra hiện tượng nhấp nháy trắng (canvas blankout flicker).
  5. Đối với chế độ hiệu chỉnh (`mode = 'edit'`), hàm `loadOriginalDocumentPdf` bị kích hoạt lại nhiều lần làm sinh ra `previewUrl` blob mới không cần thiết.
* **Cách khắc phục triệt để:**
  1. **Memoize các Component PDF:**
     - Bọc `SinglePdfPage` và `PdfPagesViewer` trong `React.memo` với custom prop comparison (chỉ so sánh `pdfDoc`, `scale`, `pageCount`, và độ dài chuỗi nét vẽ `strokes.length`).
  2. **Tách biệt Lifecycle của PDF Canvas và Canvas Vẽ Nét (Highlight Layer):**
     - Loại bỏ `redrawStrokes` khỏi mảng dependencies của effect render PDF chính trong `SinglePdfPage.tsx`. Canvas PDF chỉ vẽ đúng 1 lần khi trang được nạp hoặc khi zoom scale.
     - Canvas vẽ nét (bút dạ quang) chạy trên một `useEffect` riêng biệt, không làm gián đoạn PDF canvas bên dưới.
  3. **Khóa chặt instance Viewer bằng `useMemo` & `useRef`:**
     - Trong `DocumentUploadModal.tsx`, dùng `prevSelectedFileRef` và `initializedDocIdRef` để đảm bảo `loadOriginalDocumentPdf` và `URL.createObjectURL` chỉ chạy duy nhất 1 lần khi file hoặc tài liệu thực sự thay đổi.
     - Dùng hằng số cố định ngoài component `EMPTY_STROKES = []` để tránh tạo mảng mới ở mỗi render.
     - Bọc toàn bộ JSX của PDF Viewer trong `useMemo(() => ..., [previewUrl, isPreviewLoading, isEditMode, ...])` hoàn toàn độc lập với các state của input form (`formData`).
* **Kết quả:**
  Gõ phím nhập liệu siêu mượt, 0ms lag, trang PDF bên phải giữ nguyên trạng thái hiển thị 100% ổn định, không còn bất kỳ hiện tượng nhấp nháy nào.
