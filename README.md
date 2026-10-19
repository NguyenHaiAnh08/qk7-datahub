# QK7 DATAHUB — Cổng Quản Lý Dữ Liệu Tập Trung Quân Khu 7

Hệ thống quản lý, lưu trữ số hóa, phân quyền khai thác tài liệu quân sự bảo mật đa cấp độ, tích hợp Trợ lý Trí Tuệ Nhân Tạo (AI RAG) và Xác Thực Sinh Trắc Học Vân Tay (ZKTeco ZK9500) của Bộ Tư Lệnh Quân Khu 7.

---

## 📌 Tài Liệu Kiến Trúc Toàn Diện

Toàn bộ sơ đồ kiến trúc hệ thống, sơ đồ cấu trúc mã nguồn, lưu đồ tuần tự nghiệp vụ, thiết kế cơ sở dữ liệu và chi tiết tích hợp AI/vân tay được trình bày tại:

👉 **[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)**

Nội dung tài liệu bao gồm:
1. **Sơ Đồ Kiến Trúc Hệ Thống (Mermaid):** Mô hình 5 tầng: Client & Phần cứng ZK9500, Presentation React 18 SPA, Gateway Express 5 & WebSocket, Microservice AI FastAPI (:8001) và CSDL SQL Server / Qdrant Vector Storage.
2. **Sơ Đồ Cấu Trúc Mã Nguồn:** Cây thư mục chi tiết toàn bộ dự án (`backend/`, `frontend/`, `boxchat/`, `fingerprint-service/`).
3. **Mô Hình Phân Quyền & Bảo Mật Đa Tầng:** 5 cấp độ mật quân sự, xác thực sinh trắc học 2FA và lọc ngữ cảnh an toàn trong AI RAG.
4. **Sơ Đồ Luồng Dữ Liệu Nghiệp Vụ:** Đăng nhập, tải lên văn bản, tra cứu độ mật, xác thực vân tay xem tài liệu Mật/Tuyệt Mật, đăng ký mẫu vân tay 3 bước và hỏi đáp tác chiến AI kèm Smart SQL Fallback.
5. **Sơ Đồ Cơ Sở Dữ Liệu (Database ERD):** Ràng buộc quan hệ giữa các bảng `USER`, `USER_FINGERPRINT`, `SECURITY_LEVEL`, `UNIT`, `DOCUMENT`, `DOCUMENT_TYPE`, `ACCESS_LOG`, `ROLE`, `PERMISSION`.
6. **Kiến Trúc Trợ Lý AI Tác Chiến (boxchat):** RAG với trích dẫn số trang chính xác, tự động sinh cẩm nang học tập tác chiến (`study-book`) và cơ chế Smart SQL Fallback.
7. **Kiến Trúc Sinh Trắc Học Vân Tay (ZKTeco ZK9500):** CTypes wrapper kết nối `libzkfp.dll`, Local Agent (:9001), WebSocket Gateway và mã hóa AES-256-GCM.
8. **Danh Mục API Endpoints:** Đặc tả OpenAPI 3.0 / Swagger UI đầy đủ cho Core, AI và Fingerprint.
9. **Hướng Dẫn Vận Hành & Lệnh Chạy Runbook:** Hướng dẫn khởi động cả 4 dịch vụ hệ thống.

---

## 📁 Cấu Trúc Dự Án Toàn Diện

```text
qk7-datahub/
├── package.json                            # Điều phối kịch bản khởi chạy toàn bộ dự án
├── README.md                               # Sổ tay hướng dẫn khởi động nhanh
├── SYSTEM_ARCHITECTURE.md                  # Tài liệu kiến trúc toàn diện hệ thống
│
├── backend/                                # 🟢 MÁY CHỦ EXPRESS 5 & WEBSOCKET GATEWAY (:8000)
│   ├── src/
│   │   ├── db.js                           # Kết nối Microsoft SQL Server (QK7_ThuVienSo)
│   │   ├── admin-routes.js                 # API quản trị CRUD (Users, Roles, Units, Permissions...)
│   │   ├── ai-routes.js                    # Cổng giao tiếp AI boxchat (:8001) & Smart SQL Fallback
│   │   └── fingerprint-ws.js               # WebSocket Server (/ws/fingerprint) quản lý ZK9500
│   ├── uploads/                            # Kho lưu trữ tệp PDF thật (2026/10/..., Mat/, ToiMat/, TuyetMat/)
│   ├── public/                             # Sản phẩm build tĩnh từ Frontend xuất sang
│   ├── server.js                           # Entry point Express API Gateway, SPA Fallback & Biometrics
│   ├── swagger.js                          # Đặc tả OpenAPI 3.0 Swagger Spec (/api-docs)
│   ├── setup-passwords.js                  # Script đồng bộ và băm mật khẩu bcrypt
│   └── package.json                        # Dependencies backend (express 5, mssql, ws, jsonwebtoken...)
│
├── boxchat/                                # 🟣 MICROSERVICE TRỢ LÝ AI TÁC CHIẾN (:8001 - FastAPI)
│   ├── main.py                             # Entry point FastAPI: /api/ai/query, /api/ai/study-book...
│   ├── core/
│   │   ├── pdf_processor.py                # Bóc tách văn kiện PDF quân sự theo từng trang
│   │   ├── vector_store.py                 # Hybrid Vector Store (Qdrant Local Engine) & Auto-index
│   │   ├── agent_tutor.py                  # Agent RAG trả lời câu hỏi kèm trích dẫn và luồng suy nghĩ
│   │   ├── study_book_gen.py               # Biên soạn giáo trình tác chiến & trắc nghiệm nhận thức
│   │   └── media_timeline.py               # Quản lý dòng thời gian sự kiện, chiến dịch quân sự
│   ├── local_storage/                      # Kho lưu trữ vector embedding nội bộ bảo mật
│   └── requirements.txt                    # Dependencies: fastapi, uvicorn, qdrant-client, langchain...
│
├── fingerprint-service/                    # 🔴 DỊCH VỤ PHẦN CỨNG MÁY QUÉT VÂN TAY (:9001)
│   ├── agent.py                            # Local HTTP Server (:9001) & WebSocket Client
│   ├── zk_service.py                       # CTypes wrapper SDK ZKTeco ZK9500 (libzkfp.dll)
│   ├── libzkfp.dll                         # Thư viện DLL điều khiển cảm biến quang học ZKTeco
│   ├── device_id.txt                       # Mã định danh máy quét trạm làm việc
│   └── requirements.txt                    # Dependencies: websockets, aiohttp
│
└── frontend/                               # 🔵 GIAO DIỆN CLIENT REACT 18 + TYPESCRIPT + ANT DESIGN
    ├── index.html                          # DUY NHẤT 1 file HTML vỏ bọc cho toàn ứng dụng
    ├── vite.config.ts                      # Config build xuất sang ../backend/public, proxy :8000
    ├── package.json                        # Dependencies: antd, react-router-dom, lucide-react, exceljs...
    └── src/
        ├── App.tsx                         # Ant Design ConfigProvider (Màu Tím #722ED1), Auth, Theme
        ├── routes/                         # Auto-Discovery Routing & ProtectedRoute theo Cấp mật
        ├── pages/                          # LoginPage, PortalPage, DocumentDeskPage, AdminDashboardPage, UsersPage
        ├── components/
        │   ├── ai-chat/                    # AIChatWidget (Cửa sổ trợ lý AI nổi, Markdown, LaTeX, Citations)
        │   ├── document-desk/              # FingerprintScanModal (Xác thực vân tay xem văn bản Mật)
        │   ├── users/                      # UserTable, UserFormModal, FingerprintEnrollModal (Touch ID SVG)
        │   ├── dashboard/                  # SecurityAuditLog (Trung tâm SOC), UnitTreeTable (Cây đơn vị), StatCard...
        │   └── common/                     # Header, Sidebar, Layout, TouchIDFingerprint...
        ├── utils/                          # exportAuditReportExcel.ts (Xuất file Excel .xlsx chuẩn biểu mẫu Quân đội)
        ├── services/                       # authService, documentService, userService, fingerprintService...
        └── contexts/                       # AuthContext, ThemeContext
```

---

## 🛡️ Điểm Nhấn Kiến Trúc & Tính Năng Nổi Bật

### 1. Trợ Lý AI Tác Chiến & Văn Thư (boxchat Agentic RAG)
- **Hỏi đáp thông minh kèm trích dẫn:** Trả lời các câu hỏi về điều lệnh, chỉ thị, phương án tác chiến dựa trên tài liệu PDF đã nạp vào hệ thống. Kèm trích dẫn số trang chính xác và hiển thị quá trình suy luận (`think`).
- **Biên soạn cẩm nang học tập (`study-book`):** Tự động phân tích tài liệu để tóm tắt các điểm cốt lõi và sinh đề trắc nghiệm kiểm tra nhận thức chính trị, nghiệp vụ quân sự.
- **Smart SQL Fallback:** Khi microservice AI tạm thời chưa bật, Gateway Express tự động chuyển sang chế độ dự phòng thông minh, truy vấn trực tiếp SQL Server đảm bảo không gián đoạn dịch vụ.

### 2. Xác Thực Sinh Trắc Học Vân Tay Hai Lớp (ZKTeco ZK9500)
- **Bảo mật cấp độ cao:** Đối với văn bản Cấp 4 (Tối Mật) và Cấp 5 (Tuyệt Mật), quân nhân bắt buộc phải xác thực vân tay quang học trên máy quét ZK9500 trước khi mở xem inline hoặc tải tệp.
- **Biometric Token:** Sau khi xác thực thành công, Gateway cấp JWT `fingerprint_token` có hiệu lực 5 phút gắn với `(user_id, file_id)`.
- **Đăng ký vân tay 3 bước trực quan:** Hộp thoại đăng ký quân nhân tích hợp hoạt ảnh Touch ID mô phỏng vector chuyển màu đỏ theo tiến trình đặt ngón tay 3 lần liên tiếp, cập nhật real-time từ cảm biến quang học.

### 3. Chuẩn Giao Diện Ant Design Toàn Diện (Tông Màu Tím `#722ED1`)
- **Theme & Color:** Toàn bộ ứng dụng cấu hình qua `<ConfigProvider>` của Ant Design với màu chủ đạo hành động (Primary Action) là **Màu Tím (`#722ED1`)**, hỗ trợ chế độ Sáng / Tối mượt mà và giao diện Việt hóa 100% (`vi_VN`).
- **Phân trang chuẩn 5 người dùng / trang:** Danh sách quân nhân hiển thị đúng 5 người dùng / trang, người thứ 6 chuyển sang trang tiếp theo kèm bộ điều hướng Ant Design Pagination.
- **Trang xử lý mã lỗi HTTP chuẩn mực:** Sử dụng `<Result>` của Ant Design xử lý thân thiện các mã 400, 401, 403, 404, 500, 502, 503.

### 4. Trung Tâm Giám Sát Nhật Ký Hoạt Động & Kiểm Toán An Ninh SOC (`SecurityAuditLog`)
- **Giao diện SOC chuyên nghiệp:** Tối ưu hóa phân cấp chiều sâu thị giác (Layered backgrounds), kính mờ (Backdrop blur) và viền phát sáng; hỗ trợ hoàn hảo cả Dark Mode (cho kíp trực an ninh ban đêm) và Light Mode.
- **4 Thẻ KPI Tác Chiến Thời Gian Thực:** Giám sát tổng hoạt động, cảnh báo an ninh (`FINGERPRINT_FAIL`, `ACCESS_DENIED`...), biến động vai trò/đặc quyền (`ASSIGN_ROLE`...) và lượt truy xuất văn bản mật.
- **Giám sát trực tuyến & Tự động làm mới:** Chỉ báo trạng thái trực tuyến `🟢 Hệ thống Trực tuyến`, bộ hẹn giờ tự động làm mới chu kỳ 10s / 30s / Tắt kèm thanh đếm ngược và nút tạm dừng / tiếp tục.
- **Bảng kiểm toán thông minh:** Cột thời gian Monospace chính xác từng giây, badge IP mạng nội bộ/localhost, avatar quân nhân không ngắt dòng, tự động bóc tách thực thể mục tiêu (`USR-...`, `DEV-...`, `ROL-...`, `DOC-...`) từ nội dung ghi chú.
- **Điều tra sự cố chuyên sâu (Deep Incident Inspection):** Hộp thoại Drawer / Modal kiểm toán chi tiết hiển thị toàn bộ thuộc tính, Raw JSON Payload với tính năng 1-click sao chép Clipboard.

### 5. Cây Quản Lý Phân Cấp Đơn Vị Quân Khu Đa Tầng (`UnitTreeTable`)
- **Tổ chức thứ bậc chỉ huy cây đa tầng (Command Tree Hierarchy):** Hiển thị trực quan quan hệ cơ quan cha - đơn vị con với số lượng đơn vị trực thuộc tự động tổng hợp.
- **Cơ chế bảo vệ đơn vị "mồ côi" (Orphan Safeguarding):** Tự động phát hiện và chuyển các đơn vị có `parent_id` không hợp lệ về gốc (Root), ngăn ngừa triệt để lỗi mất dữ liệu trên giao diện.
- **Phân loại cấp bậc tự động 6 tầng quân sự:** Nhận diện thông minh qua tên đơn vị: Cấp Quân Khu, Sư Đoàn, Trung Đoàn, Tiểu Đoàn, Nhà Trường/Học Viện và Cơ Quan/Phòng Ban.
- **Thanh thống kê tương tác (Mini KPI Stat Pills):** Lọc nhanh đơn vị theo cấp bậc chỉ với 1 cú click chuột.
- **Tìm kiếm tiếng Việt thông minh (Accent-Insensitive Search):** Tự động loại bỏ dấu tiếng Việt khi tìm kiếm và tự động bung (expand) tất cả các nhánh cha dẫn đến kết quả tìm kiếm.

### 6. Xuất Báo Cáo Nhật Ký Kiểm Toán Chuẩn Quy Chuẩn Quân Đội (`exportAuditReportExcel`)
- **Định dạng file Excel (.xlsx) chính quy:** Thay thế việc xuất file CSV đơn giản bằng định dạng Excel `.xlsx` chuyên nghiệp thông qua thư viện `exceljs`, tuân thủ 100% biểu mẫu công văn `Xuất báo cáo mẫu.xlsx`.
- **Đầy đủ trường chuẩn hành chính quân sự:**
  - Tiêu ngữ bên trái: **PHÒNG THAM MƯU HÀNH CHÍNH** / **TỔ CÔNG NGHỆ THÔNG TIN** / **Số: ....../BC-CNTT**.
  - Quốc hiệu bên phải: **CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM** / **Độc lập - Tự do - Hạnh phúc** / Ngày tháng địa danh tự động (`TP. Hồ Chí Minh, ngày DD tháng MM năm YYYY`).
- **Bảng dữ liệu chuẩn 9 cột:** `Mã Log`, `Thời Gian`, `Mã Quân Nhân`, `Họ Tên Quân Nhân`, `Hành Động`, `Nhóm Phân Loại`, `Đối Tượng / Văn Bản`, `Địa Chỉ IP`, `Ghi Chú` với tiêu đề màu vàng cam `#FFC000`, font `Times New Roman` và khung viền mảnh chuẩn mực.
- **Chân trang ký duyệt quân sự:** Khối ký duyệt `NGƯỜI LẬP` và chức danh người lập báo cáo: `Thiếu tá QNCN Nguyễn Mạnh Nam`.

---

## 🚀 Khởi Động Nhanh

### 1. Cài đặt thư viện (lần đầu)
```bash
# Cài đặt Backend & Frontend
npm run backend:install
npm run frontend:install

# Cài đặt Microservice AI boxchat
cd boxchat && pip install -r requirements.txt

# Cài đặt Local Fingerprint Agent
cd ../fingerprint-service && pip install -r requirements.txt
```

### 2. Chạy toàn bộ 4 dịch vụ hệ thống

Mở 4 cửa sổ Terminal riêng biệt:

* **Terminal 1: Máy chủ Backend Express & WebSocket Gateway (:8000)**
  ```bash
  cd backend
  npm start
  ```
  * Cổng Web & API: [http://localhost:8000](http://localhost:8000)
  * Swagger UI: [http://localhost:8000/api-docs](http://localhost:8000/api-docs)

* **Terminal 2: Giao diện người dùng Frontend Vite (:5173)**
  ```bash
  cd frontend
  npm run dev
  ```
  * Truy cập ứng dụng: [http://localhost:5173](http://localhost:5173)

* **Terminal 3: Microservice Trợ Lý AI boxchat (:8001)**
  ```bash
  cd boxchat
  python main.py
  ```
  * Cổng AI Service: [http://localhost:8001](http://localhost:8001)

* **Terminal 4: Local Fingerprint Hardware Agent (:9001)**
  ```bash
  cd fingerprint-service
  python agent.py
  ```
  * Trạm kiểm soát vân tay: [http://127.0.0.1:9001/device-id](http://127.0.0.1:9001/device-id)

### 3. Đóng gói sản phẩm (Production Build)
```bash
cd frontend
npm run build
```
Bản build tĩnh sẽ tự động được xuất sang `backend/public/`. Khi đó chỉ cần chạy `npm start` tại `backend/`, máy chủ sẽ phục vụ toàn bộ ứng dụng SPA, API và WebSocket trên cổng `:8000`.

---

## 📜 Danh Mục API & Swagger UI (OpenAPI 3.0)

Hệ thống tích hợp cổng tài liệu API tương tác trực tiếp:
* **Swagger UI:** [http://localhost:8000/api-docs](http://localhost:8000/api-docs)
* **OpenAPI JSON Spec:** [http://localhost:8000/api-docs.json](http://localhost:8000/api-docs.json)

### Các Nhóm Endpoint Chính (Tags)
1. **`Auth`**: Đăng nhập (`POST /api/auth/login`), hồ sơ cá nhân (`GET /api/auth/me`), xác thực vân tay (`POST /api/auth/fingerprint/verify`).
2. **`AI`**: Hỏi đáp RAG tác chiến (`POST /api/ai/query`), biên soạn giáo trình học tập (`POST /api/ai/study-book`), kiểm tra trạng thái AI (`GET /api/ai/health`), nạp văn kiện vào vector store (`POST /api/ai/ingest`).
3. **`Fingerprint` (Admin)**: Đăng ký mẫu vân tay quân nhân (`POST /api/admin/fingerprint/enroll/{userId}`), danh sách máy quét online (`GET /api/admin/fingerprint/agents`), xóa vân tay (`DELETE /api/admin/fingerprint/users/{userId}`).
4. **`Documents`**: Quản lý tài liệu PDF — Tìm kiếm có kiểm soát độ mật (`GET /api/documents`), Tải lên hash SHA-256 (`POST /api/documents/upload`), Xem chi tiết, Sửa, Xóa.
5. **`Files`**: Stream xem inline hoặc tải về tệp PDF đính kèm (`GET /api/files/{fileId}/view`, yêu cầu `X-Fingerprint-Token` nếu độ mật $\ge$ 4).
6. **`Admin` (Cần Clearance $\ge$ 4)**: KPI thống kê (`/api/admin/stats`), CRUD Quân nhân, Phân quyền vai trò, CRUD Đơn vị, Loại văn bản, Mức bảo mật và Dọn dẹp Audit Log.

---

## 🔐 Tài Khoản Kiểm Thử Mẫu (Mật khẩu: `123456789`)

* **Quản trị viên / Thủ trưởng (Cấp 5 - Tuyệt Mật):** `USR-004` (Đại tá - Chính ủy)
* **Trưởng phòng / Chỉ huy (Cấp 4 - Tối Mật):** `USR-001` (Đại tá - Trưởng phòng Tham mưu)
* **Cán bộ / Sĩ quan (Cấp 3 - Mật):** `USR-002` (Thiếu tá - Thư ký)

---
*Bản quyền tài liệu thuộc Bộ Tư Lệnh Quân Khu 7 — QK7 DataHub.*
