# TRƯỜNG QUÂN SỰ QUÂN KHU 7 DATAHUB — Cổng Quản Lý Dữ Liệu Tập Trung Quân Khu 7

Hệ thống quản lý, lưu trữ số hóa, phân quyền khai thác tài liệu quân sự bảo mật đa cấp độ, tích hợp Trợ lý Trí Tuệ Nhân Tạo (AI RAG) và Xác Thực Sinh Trắc Học Vân Tay (ZKTeco ZK9500) của Bộ Tư Lệnh Quân Khu 7.

---

## 📌 Tài Liệu Kiến Trúc Toàn Diện

Toàn bộ sơ đồ kiến trúc hệ thống, sơ đồ cấu trúc mã nguồn, lưu đồ tuần tự nghiệp vụ, thiết kế cơ sở dữ liệu và chi tiết tích hợp AI/vân tay được trình bày tại:

👉 **[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)** | **[SETUP_SERVER.md](./SETUP_SERVER.md)**

Nội dung tài liệu bao gồm:
1. **Sơ Đồ Kiến Trúc Hệ Thống (Mermaid):** Mô hình 5 tầng: Client & Phần cứng ZK9500, Presentation React 18 SPA, Gateway Express 5 & WebSocket, Microservice AI FastAPI (:8001) và CSDL SQL Server / Qdrant Vector Storage.
2. **Sơ Đồ Cấu Trúc Mã Nguồn:** Cây thư mục chi tiết toàn bộ dự án (`backend/`, `frontend/`, `boxchat/`, `fingerprint/`).
3. **Mô Hình Phân Quyền & Bảo Mật Đa Tầng:** 5 cấp độ mật quân sự, xác thực sinh trắc học 2FA và lọc ngữ cảnh an toàn trong AI RAG.
4. **Sơ Đồ Luồng Dữ Liệu Nghiệp Vụ:** Đăng nhập, tải lên văn bản, tra cứu độ mật, xác thực vân tay xem tài liệu độ mật cao (Cấp 3 - Mật, Cấp 4 - Tối Mật, Cấp 5 - Tuyệt Mật), đăng ký mẫu vân tay 3 bước và hỏi đáp tác chiến AI kèm Smart SQL Fallback.
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
├── SETUP_SERVER.md                         # Sổ tay hướng dẫn cài đặt Server & Client chi tiết
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
├── fingerprint/                            # 🔴 DỊCH VỤ PHẦN CỨNG MÁY QUÉT VÂN TAY (:9001)
│   ├── agent.py                            # Local HTTP Server (:9001) & WebSocket Client
│   ├── zk_service.py                       # CTypes wrapper SDK ZKTeco ZK9500 (libzkfp.dll)
│   ├── libzkfp.dll                         # Thư viện DLL điều khiển cảm biến quang học ZKTeco
│   ├── device_id.txt                       # Mã định danh máy quét trạm làm việc
│   └── requirements.txt                    # Dependencies: websockets, aiohttp
│
└── frontend/                               # 🔵 GIAO DIỆN CLIENT REACT 18 + TYPESCRIPT + ANT DESIGN (DUAL-PLATFORM)
    ├── index.html                          # DUY NHẤT 1 file HTML vỏ bọc cho toàn ứng dụng
    ├── vite.config.ts                      # Config build xuất sang ../backend/public, proxy :8000
    ├── package.json                        # Dependencies: antd, react-router-dom, lucide-react, exceljs...
    └── src/
        ├── App.tsx                         # Ant Design ConfigProvider (Màu Tím #722ED1), Auth, Theme
        ├── routes/                         # Auto-Discovery Routing & ProtectedRoute theo Cấp mật
        ├── pages/                          # LoginPage, PortalPage (Thư viện số), MyUnitPage, DocumentDeskPage, AdminDashboardPage, UsersPage
        ├── components/
        │   ├── ai-chat/                    # AIChatWidget (Cửa sổ trợ lý AI nổi, Markdown, LaTeX, Citations)
        │   ├── document-desk/              # FingerprintScanModal (Xác thực vân tay xem văn bản Mật / Tối Mật / Tuyệt Mật)
        │   ├── users/                      # UserTable, UserFormModal, FingerprintEnrollModal (Touch ID Vector 3 bước)
        │   ├── dashboard/                  # SecurityAuditLog (Trung tâm SOC), UnitTreeTable (Cây đơn vị), StatCard...
        │   └── common/                     # Header, Sidebar, Layout, DeviceModeSwitch, TouchIDFingerprint...
        ├── hooks/                          # useDeviceMode (Hook quản lý chế độ PC Widescreen & iPad Touch UI)
        ├── utils/                          # exportAuditReportExcel.ts (Xuất file Excel .xlsx chuẩn biểu mẫu Quân đội)
        ├── services/                       # authService, documentService, userService, fingerprintService...
        └── contexts/                       # AuthContext, ThemeContext, DeviceModeContext
```

---

## 🛡️ Điểm Nhấn Kiến Trúc & Tính Năng Nổi Bật

### 1. Trợ Lý AI Tác Chiến & Văn Thư (boxchat Agentic RAG)
- **Hỏi đáp thông minh kèm trích dẫn:** Trả lời các câu hỏi về điều lệnh, chỉ thị, phương án tác chiến dựa trên tài liệu PDF đã nạp vào hệ thống. Kèm trích dẫn số trang chính xác và hiển thị quá trình suy luận (`think`).
- **Biên soạn cẩm nang học tập (`study-book`):** Tự động phân tích tài liệu để tóm tắt các điểm cốt lõi và sinh đề trắc nghiệm kiểm tra nhận thức chính trị, nghiệp vụ quân sự.
- **Smart SQL Fallback:** Khi microservice AI tạm thời chưa bật, Gateway Express tự động chuyển sang chế độ dự phòng thông minh, truy vấn trực tiếp SQL Server đảm bảo không gián đoạn dịch vụ.

### 2. Xác Thực Sinh Trắc Học Vân Tay Hai Lớp (ZKTeco ZK9500)
- **Bảo mật cấp độ cao:** Đối với văn bản Cấp 3 (Mật), Cấp 4 (Tối Mật) và Cấp 5 (Tuyệt Mật), quân nhân bắt buộc phải xác thực vân tay quang học trên máy quét ZK9500 trước khi mở xem inline hoặc tải tệp.
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

### 7. Kiến Trúc Giao Diện Kép Đa Nền Tảng (Dual-Platform Desktop & iPad Air M4 Touch UI)
- **Tương thích toàn diện:** Vận hành tối ưu cả Máy tính bàn (Desktop PC Widescreen 16:9) lẫn máy tính bảng iPad Air M4 (11-inch & 13-inch) trên 4 trình duyệt iPadOS: Safari, Google Chrome, Google App và Cốc Cốc.
- **Bộ chuyển đổi chế độ thông minh (`DeviceModeSwitch`):** Cho phép thủ trưởng và cán bộ chuyển đổi tức thì giữa chế độ PC và iPad, lưu trạng thái vào `localStorage`. Hỗ trợ xem thông số thiết bị real-time (Viewport `1210x802` Landscape, `834x1178` Portrait, DPR, Touch Target Apple HIG ≥ 44×44px).
- **Thiết kế hoàn mỹ cả Light Mode & Dark Mode:**
  - Light Mode: Phối màu Tím `#722ED1` thương hiệu Quân Khu 7 (`bg-purple-50`, `border-purple-200`, active `bg-purple-600 text-white`), popover nền trắng sáng tương phản cao.
  - Dark Mode: Nền `bg-slate-900/80`, viền `border-slate-800` chống chói mắt khi tác chiến ca đêm.
- **Điều hướng phân biệt thông minh:**
  - **Trên iPad:** Segmented Navigation Bar căn giữa với hiệu ứng trượt mượt mà.
  - **Trên Desktop PC:** Loại bỏ hiệu ứng Dynamic Sliding Pill Indicator (viên thuốc trượt) để phục hồi cụm nút bấm cũ chuyển trang màu sắc chuyên biệt (`Đăng tải`, `Trung tâm thư viện số`, `Đơn vị của tôi`, `Quản trị`) ổn định, tốc độ chuyển trang tức thì (0ms), loại bỏ hoàn toàn hiện tượng nhảy chớp vị trí khi chuyển trang.

### 8. Chuẩn Hóa Danh Xưng "Trung Tâm Thư Viện Số" & Phân Hệ "Đơn Vị Của Tôi" (`/my-unit`)
- **Chuẩn hóa nhận diện:** Đổi toàn bộ nhãn hiển thị từ "Portal" thành "Trung tâm thư viện số" trên toàn web (Header, Banner, User Menu, Quick login tags), bảo toàn 100% route `/portal` và API backend.
- **Phân hệ "Đơn vị của tôi":** Trang chuyên biệt `/my-unit` quản lý và khai thác tài liệu số phân quyền nội bộ theo từng cơ quan/đơn vị trực thuộc Quân Khu 7 (Sư đoàn, Lữ đoàn, Trung đoàn, Phòng Tham mưu...).

### 9. Nâng Cấp Trải Nghiệm Xác Thực Sinh Trắc Học Vân Tay Trực Quan
- **Touch ID Vector 3 Bước:** Hoạt ảnh vector dấu vân tay quang học với vòng tròn tiến trình Ant Design và hướng dẫn thao tác trực quan (1/3, 2/3, 3/3).
- **Khử lỗi nhảy gián đoạn:** Cơ chế debounce polling và lọc trạng thái trong `fingerprintService.ts`, phân tách trạng thái chờ ngón tay với lỗi phần cứng thật, ngăn ngừa hiện tượng văng lỗi/nhảy lỗi liên tục.
- **Mở khóa tài liệu Mật siêu tốc:** Nhận diện nhanh máy quét nội bộ `127.0.0.1:9001` và cấp quyền xem tài liệu Cấp 3, 4, 5 chỉ trong 1 lần chạm.

### 10. Giao Diện Tự Thích Ứng Chống Bể Layout Mọi Mức Phóng To (Adaptive Zoom-Proof Layout)
- **Tương thích hoàn hảo mọi tỷ lệ Zoom (100% – 200%):** Giải quyết triệt để sự cố co ép giao diện khi người dùng phóng to trình duyệt (150%, 175%, 200%) hoặc trên màn hình laptop có độ phân giải nhỏ (1366×768, 1536×864):
  - **Khử lỗi ngắt dòng:** Toàn bộ nút điều hướng trên thanh Header được áp dụng `whitespace-nowrap shrink-0`, ngăn hoàn toàn hiện tượng vỡ dòng chữ thành nhiều tầng.
  - **Cơ chế nhãn thích ứng 3 tầng thông minh:**
    - `>= 1536px (Zoom 100%):` Hiển thị đầy đủ nhãn dài (*Đăng tải, Trung tâm thư viện số, Đơn vị của tôi, Quản trị*) cùng phụ đề đơn vị.
    - `1280px - 1535px (Zoom 125% - 150%):` Tự động chuyển sang nhãn ngắn gọn (*"Thư viện số"*, *"Đơn vị"*).
    - `< 1280px (Zoom 175% - 200%):` Tự động chuyển sang dạng **Icon Button tinh gọn kết hợp Ant Design Tooltip** hiển thị tên đầy đủ khi hover, tự ẩn phụ đề dài để tiết kiệm không gian.
  - **Bảo toàn hiển thị 100% cho bộ công cụ điều khiển:** Nút gạt chế độ thiết bị (`DeviceModeSwitch`), nút chế độ Sáng/Tối (`ThemeToggle`) và Menu người dùng được gán `shrink-0`, không bao giờ bị cắt xén hay tràn ra mép phải màn hình.
- **Thanh Tab quản trị phụ cuộn mượt mà (Smart Subnav Strip):**
  - **Bổ sung nút điều hướng cuộn:** Tích hợp 2 nút cuộn `<` (`ChevronLeft`) và `>` (`ChevronRight`) ở hai đầu thanh tab.
  - **Hỗ trợ lăn bánh xe chuột (`onWheel`):** Cho phép lăn chuột dọc để cuộn ngang danh mục tự nhiên trên máy tính bàn.
  - **Tự động căn giữa (`scrollIntoView`):** Đảm bảo tab danh mục đang chọn luôn nằm gọn trong tầm nhìn người dùng.
- **Tinh giản cấu trúc giao diện & loại bỏ nút trùng lặp:**
  - Loại bỏ nút `[ ≡ Danh mục ]` ở hàng thứ 2 vì Header đã có sẵn nút Menu Hamburger `[ ≡ ]`.
  - Loại bỏ nút `< Thu gọn danh mục` ở đáy sidebar (trùng lặp với nút gạt ở đầu sidebar), tối ưu khoảng đệm `pb-4` giúp sidebar thoáng và liền mạch.

### 11. Giám Sát Phiên Đang Trực Tuyến Thời Gian Thực (Active Online Sessions)
- **Bảng điều khiển trung tâm tác chiến mạng (Command Center Telemetry):** Theo dõi toàn bộ các phiên làm việc đang kết nối tới hệ thống từ Desktop PC và iPad Air M4 với chu kỳ làm mới tự động **15 giây (`LIVE 15s`)** có hiệu ứng phát quang nhịp đập (`animate-ping`).
- **Phân loại trạng thái nhịp đập:** 🟢 Đang trực (`idle <= 2m`), 🟡 Chờ thao tác (`idle <= 120m`), 🔴 Cảnh báo treo (`idle > 120m`), tự động thu hồi phiên sau 180 phút.
- **Bộ bóc tách User-Agent thông minh:** Tự động nhận diện hệ điều hành và trình duyệt (Ví dụ: `Windows • Chrome`, `iPadOS • Safari`) kèm icon phân loại thiết bị trực quan (Desktop, Tablet, Mobile).
- **Typography quân sự chuẩn xác:** Cột IP và dấu thời gian ép kiểu `font-mono tabular-nums text-sm`, toàn bộ các cột được căn giữa (`text-center`) tuyệt đối cân xứng.
- **Ngắt phiên an toàn (Kill Sessions Guard):** Hỗ trợ ngắt phiên đơn lẻ hoặc cưỡng bức hủy toàn bộ phiên của quân nhân trên mọi thiết bị. Tích hợp cơ chế tự bảo vệ an toàn (`is_current` guard) ngăn Quản trị viên vô tình tự ngắt phiên của chính mình.

### 12. Thùng Rác Tài Liệu Tác Chiến & Khôi Phục Dữ Liệu An Toàn 2 Bước (Tactical Trash Bin & Data Recovery)
- **Vòng đời Xóa Mềm (Soft Delete):** Khi xóa tài liệu, hệ thống đánh dấu `deleted_at`, `deleted_by`, `deleted_reason`, bảo toàn tuyệt đối file PDF vật lý và mã băm SHA-256 trên đĩa lưu trữ.
- **Khôi phục đơn lẻ & Hàng loạt (Batch Actions):** Khôi phục 1 tài liệu hoặc chọn checkbox khôi phục nhiều tài liệu cùng lúc chỉ trong một cú click chuột.
- **Cơ chế Xóa Vĩnh Viễn An Toàn 2 Bước (Double-Safety Purge):**
  - Hộp thoại cảnh báo rủi ro quân sự màu Đỏ Quân Kỳ (`#b91c1c` / red-600).
  - Bắt buộc xác nhận mã tệp tin `confirm === fileId` (hoặc nhập từ khóa bảo vệ `XAC NHAN XOA` khi dọn sạch thùng rác) mới tiến hành xóa vật lý trên ổ đĩa và CSDL.
  - Tự động ghi vết vào `ACCESS_LOG` với mức độ Critical phục vụ thanh tra an ninh.
- **Bản sắc thiết kế Quân đội:** Xóa bỏ hoàn toàn màu tím AI mặc định ở sidebar, đồng bộ hệ màu Xanh Lục Quân - Vàng Kim - Đỏ Quân Kỳ, bảng dữ liệu rộng rãi `min-w-[1150px]` không ép chữ.

### 13. Quản Trị Phân Quyền Kéo-Thả Trực Quan & Phân Quyền Trực Tiếp Quân Nhân (Permissions Drag-and-Drop)
- **Sắp xếp thứ tự Kéo - Thả (Drag & Drop):** Xóa bỏ trường nhập thủ công `Sort order tổng` gây bối rối; thay bằng tay cầm kéo thả trực quan (`GripVertical`) chuẩn HTML5, cập nhật giao diện tức thì (Optimistic Update) và đồng bộ nguyên tử qua SQL Transaction.
- **Phân quyền trực tiếp cá nhân (`USER_PERMISSION`):** Cho phép gán quyền đặc thù cho cá nhân quân nhân có thời hạn (`expires_at`) hoặc theo nhiệm vụ đặc biệt (`note`), kết hợp linh hoạt với phân quyền theo vai trò (`ROLE_PERMISSION`).
- **Tối ưu Form Modal:** Lưới 2 cột trực quan, đóng khung phân vùng Phân loại con (Subgroup) bằng khối Fieldset viền hổ phách sắc nét.
- **Bảng mã màu 4 cấp độ rủi ro:** Phân loại rõ ràng 🟢 Read (Chỉ đọc), 🟡 Write (Ghi), 🟣 Security (Bảo mật), 🔴 Delete (Xóa/Nguy hiểm) kết hợp hệ thống huy hiệu nhóm quyền động (`DOCUMENT`, `SYSTEM`, `USER`, `ROLE`, `FINGERPRINT`, `AUDIT`).

### 14. Trợ Lý AI Trượt Đỉnh & Cơ Chế Khám Phá Hệ Thống Tự Động (Header AI Drawer & Guided Tour)
- **Ngăn kéo Trợ lý AI trượt đỉnh (Header AI Slide-Over Drawer):** Ngăn kéo 380px trượt mượt mà bằng lò xo vật lý (`--ux-spring`), kính mờ `backdrop-blur-md`, tra cứu điều lệnh và phương án tác chiến tức thì kèm trích dẫn số trang.
- **Chuỗi khám phá hệ thống tự động (Guided Tour Engine):** Tự động hướng dẫn từng bước (Step-by-step Spotlight Tour) cho tài khoản Khách vãng lai (Guest) khi lần đầu truy cập.
- **Nút khám phá La bàn (`Compass` button):** Tích hợp trên biểu ngữ an ninh `SecurityBanner`, cho phép kích hoạt lại tour khám phá bất cứ lúc nào mà không làm rối mắt thanh Header.

---

## 🚀 Hướng Dẫn Cài Đặt & Vận Hành Hệ Thống (Server & Client Setup Guide)

### PHẦN A — SETUP MÁY SERVER (192.168.1.xxx)
*(Thay `192.168.1.xxx` bằng địa chỉ IP tĩnh thực tế của máy chủ Server trong mạng LAN)*

#### 1. Kiểm tra môi trường hệ thống
Mở **PowerShell** và chạy:
```powershell
node --version        # Yêu cầu >= 22.13 (Tải tại: https://nodejs.org/)
npm --version
python --version      # Yêu cầu >= 3.10  (Tải tại: https://www.python.org/downloads/)
```

#### 2. Kiểm tra dịch vụ Microsoft SQL Server
```powershell
Get-Service | Where-Object {$_.Name -like "MSSQL*"}
```
> **Lưu ý:** Phải có ít nhất 1 service trạng thái **Running** (ví dụ: `MSSQLSERVER` hoặc `MSSQL$SQLEXPRESS`).

#### 3. Cấu hình biến môi trường Backend (`backend/.env`)
Tạo hoặc chỉnh sửa tệp `backend/.env`:
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

* **Sinh `JWT_SECRET` mới:** Chạy lệnh sau trong PowerShell, sao chép kết quả chuỗi Base64 và dán vào `JWT_SECRET` trong file `.env`:
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

#### 4. Cấu hình biến môi trường AI boxchat (`boxchat/.env`)
Tạo hoặc chỉnh sửa tệp `boxchat/.env` (nếu chưa có thì tạo mới):
```env
BACKEND_UPLOADS_DIR=../backend/uploads
QDRANT_STORAGE_PATH=./local_storage/qdrant_data
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

#### 5. Cài đặt dependencies (Chỉ lần đầu)
Mở CMD chạy lần lượt:
```cmd
cd /d D:\QK7_DataHub\qk7-datahub\backend
npm install

cd /d D:\QK7_DataHub\qk7-datahub\frontend
npm install

cd /d D:\QK7_DataHub\qk7-datahub\boxchat
pip install -r requirements.txt
```

#### 6. Đóng gói giao diện Frontend (Production Build)
```cmd
cd /d D:\QK7_DataHub\qk7-datahub\frontend
npm run build
```
Kiểm tra file build đã tự động xuất sang `backend/public/`:
```cmd
dir D:\QK7_DataHub\qk7-datahub\backend\public\index.html
```

#### 7. Khởi tạo tài khoản quản trị viên
Tại thư mục `backend`, chạy:
```cmd
cd /d D:\QK7_DataHub\qk7-datahub\backend
node setup-passwords.js
```
*(Thiết lập tài khoản: Mã `USR-001`, Mật khẩu `123456789`, Vai trò `ADMIN`)*

#### 8. Mở cổng tường lửa Windows Firewall (Server)
Chạy lệnh PowerShell (Run as Administrator) mở port 8000 cho các máy Client kết nối:
```powershell
New-NetFirewallRule -DisplayName "QK7 Backend 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

---

### PHẦN B — CHẠY SERVER (HÀNG NGÀY)

1. **Khởi động Server (Backend + AI boxchat):**
   - Click đúp vào tệp `s.bat` trong thư mục gốc `D:\QK7_DataHub\qk7-datahub\s.bat`.
2. **Khởi động trạm quét vân tay trên server (nếu máy chủ có cắm đầu đọc ZK9500):**
   ```cmd
   cd /d D:\QK7_DataHub\qk7-datahub\fingerprint
   python agent.py
   ```

---

### PHẦN C — SETUP MÁY CLIENT (192.168.1.X)

#### 1. Cài đặt driver ZK9500 & Python
- Cài đặt driver ZK9500 cho máy client.
- Kiểm tra file thư viện DLL:
  ```cmd
  dir C:\Windows\System32\libzkfp.dll
  ```
- Kiểm tra phiên bản Python (yêu cầu >= 3.10, tick chọn "Add Python to PATH"):
  ```cmd
  python --version
  ```

#### 2. Cài đặt chứng chỉ rootCA vào Windows Root Store
Mở PowerShell (Run as Administrator) trên máy Client:
```powershell
# Copy rootCA.pem từ share LAN của máy server về máy client (nếu chưa có)
Copy-Item "\\192.168.1.229\QK7Share\rootCA.pem" "C:\QK7Agent\rootCA.pem" -Force

# Cài chứng chỉ vào Windows Root Store
Import-Certificate -FilePath "C:\QK7Agent\rootCA.pem" -CertStoreLocation Cert:\LocalMachine\Root
```

#### 3. Tạo thư mục trạm máy quét `C:\QK7Agent\`
Tạo thư mục `C:\QK7Agent\` trên máy Client với cấu trúc:
```text
C:\QK7Agent\
├── agent.py
├── libzkfp.dll
├── requirements.txt
├── s-agent.bat
├── .env                    ← sửa ở bước C.4
└── (chưa có device_id.txt — sẽ tự sinh khi chạy lần đầu)
```

#### 4. Cấu hình file `C:\QK7Agent\.env`
Tạo/sửa file `.env` trên máy Client (thay IP bằng IP máy server thực tế):
```env
# Cấu hình cho MÁY CLIENT — KHÔNG dùng localhost
BACKEND_WS_URL=ws://192.168.1.229:8000/ws/fingerprint
BRIDGE_TOKEN=qk7_bridge_2026_secret_xyz9876543210abcdef
DEVICE_SERVER_HOST=127.0.0.1
DEVICE_SERVER_PORT=9001
MATCH_SCORE_THRESHOLD=45
```

#### 5. Cài đặt Python dependencies
```cmd
cd /d C:\QK7Agent
pip install -r requirements.txt
```

#### 6. Chạy thử nghiệm Fingerprint Agent
```cmd
cd /d C:\QK7Agent
python agent.py
```
*(Hoặc click đúp file `s-agent.bat`)*

#### 7. Đăng ký tự động chạy khi Login (Startup)
Để quân nhân / cán bộ không phải mở CMD mỗi sáng, đặt shortcut vào Startup:
1. Nhấn **Win + R**, nhập `shell:startup`, bấm **Enter**.
2. Trong thư mục vừa mở, click chuột phải → **New** → **Shortcut**.
3. Trong ô *"Type the location of the item"*, nhập:
   ```text
   C:\QK7Agent\s-agent.bat
   ```
4. Bấm **Next** → đặt tên `QK7 Fingerprint Agent` → bấm **Finish**.

---

### 🌐 KIỂM TRA TRUY CẬP HOÀN TẤT
Mở trình duyệt trên máy Client hoặc Server để truy cập:
👉 **`http://192.168.1.229:8000`** *(hoặc địa chỉ IP máy server của bạn)*

---

## 📜 Danh Mục API & Swagger UI (OpenAPI 3.0)

Hệ thống tích hợp cổng tài liệu API tương tác trực tiếp:
* **Swagger UI:** [http://localhost:8000/api-docs](http://localhost:8000/api-docs)
* **OpenAPI JSON Spec:** [http://localhost:8000/api-docs.json](http://localhost:8000/api-docs.json)

### Các Nhóm Endpoint Chính (Tags)
1. **`Auth`**: Đăng nhập (`POST /api/auth/login`), hồ sơ cá nhân (`GET /api/auth/me`), xác thực vân tay (`POST /api/auth/fingerprint/verify`).
2. **`AI`**: Hỏi đáp RAG tác chiến (`POST /api/ai/query`), biên soạn giáo trình học tập (`POST /api/ai/study-book`), kiểm tra trạng thái AI (`GET /api/ai/health`), nạp văn kiện vào vector store (`POST /api/ai/ingest`).
3. **`Fingerprint` (Admin)**: Đăng ký mẫu vân tay quân nhân (`POST /api/admin/fingerprint/enroll/{userId}`), danh sách máy quét online (`GET /api/admin/fingerprint/agents`), xóa vân tay (`DELETE /api/admin/fingerprint/users/{userId}`).
4. **`Documents & Trash`**: Quản lý tài liệu PDF — Tìm kiếm có kiểm soát độ mật (`GET /api/documents`), Tải lên hash SHA-256 (`POST /api/documents/upload`), Xem chi tiết, Sửa, Xóa mềm (`DELETE /api/documents/{fileId}`), Danh sách thùng rác (`GET /api/documents/trash`), Khôi phục tài liệu (`POST /api/documents/{fileId}/restore`), Xóa vĩnh viễn an toàn 2 bước (`DELETE /api/documents/{fileId}/purge`).
5. **`Files`**: Stream xem inline hoặc tải về tệp PDF đính kèm (`GET /api/files/{fileId}/view`, yêu cầu `X-Fingerprint-Token` nếu độ mật ≥ 3: Cấp 3 - Mật, Cấp 4 - Tối Mật, Cấp 5 - Tuyệt Mật).
6. **`Active Sessions`**: Giám sát phiên trực tuyến (`GET /api/admin/sessions`), ngắt phiên làm việc cưỡng bức (`POST /api/admin/sessions/{id}/kill`), hủy toàn bộ phiên của quân nhân (`POST /api/admin/sessions/user/{userId}/revoke-all`).
7. **`Permissions & RBAC`**: Quản lý danh mục quyền (`GET/POST/PUT/DELETE /api/admin/permissions`), sắp xếp thứ tự kéo-thả (`PUT /api/admin/permissions/reorder`), phân quyền vai trò (`POST /api/admin/roles/{id}/permissions`), cấp quyền trực tiếp cá nhân (`GET/POST/DELETE /api/admin/users/{id}/permissions`).
8. **`Admin` (Cần Clearance ≥ 4)**: KPI thống kê (`/api/admin/stats`), CRUD Quân nhân, CRUD Đơn vị, Loại văn bản, Mức bảo mật và Dọn dẹp Audit Log.

---

## 🔐 Tài Khoản Kiểm Thử Mẫu (Mật khẩu: `123456789`)

* **Quản trị viên / Thủ trưởng (Cấp 5 - Tuyệt Mật):** `USR-004` (Đại tá - Chính ủy)
* **Trưởng phòng / Chỉ huy (Cấp 4 - Tối Mật):** `USR-001` (Đại tá - Trưởng phòng Tham mưu)
* **Cán bộ / Sĩ quan (Cấp 3 - Mật):** `USR-002` (Thiếu tá - Thư ký)

---
*Bản quyền tài liệu thuộc Bộ Tư Lệnh Quân Khu 7 — TRƯỜNG QUÂN SỰ QUÂN KHU 7 DATAHUB.*
