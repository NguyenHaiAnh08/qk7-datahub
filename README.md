# QK7 DATAHUB — Cổng Quản Lý Dữ Liệu Tập Trung Quân Khu 7

Hệ thống quản lý, lưu trữ số hóa và phân quyền khai thác tài liệu văn bản quân sự bảo mật đa cấp độ của Bộ Tư Lệnh Quân Khu 7.

---

## 📌 Tài Liệu Kiến Trúc Toàn Diện

Toàn bộ sơ đồ kiến trúc hệ thống, sơ đồ cấu trúc mã nguồn, lưu đồ tuần tự nghiệp vụ và thiết kế cơ sở dữ liệu được trình bày chi tiết tại:

👉 **[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)**

Nội dung tài liệu bao gồm:
1. **Sơ Đồ Kiến Trúc Hệ Thống (System Architecture Diagram - Mermaid):** 4 tầng Client, Presentation (React SPA), Gateway Express 5 và Storage vật lý / SQL Server.
2. **Sơ Đồ Cấu Trúc Mã Nguồn (Source Tree & Architecture):** Cây thư mục chi tiết, quan hệ giữa các mô-đun frontend, backend, public và uploads.
3. **Mô Hình Phân Quyền & Bảo Mật:** 5 cấp độ bảo mật quân sự (Công khai, Nội bộ, Mật, Tối mật, Tuyệt mật), cơ chế băm SHA-256 và Access Audit Log.
4. **Sơ Đồ Luồng Dữ Liệu (Sequence Diagrams):** Đăng nhập xác thực, Tải lên tệp văn bản và Tra cứu kiểm soát cấp độ mật.
5. **Sơ Đồ Cơ Sở Dữ Liệu (Database ERD):** Quan hệ giữa các bảng `USER`, `SECURITY_LEVEL`, `UNIT`, `DOCUMENT`, `DOCUMENT_TYPE`, `ACCESS_LOG`, `ROLE`, `PERMISSION`.
6. **Danh Mục API Endpoints:** Bảng đặc tả chi tiết toàn bộ REST APIs chuẩn OpenAPI 3.0 / Swagger.
7. **Hướng Dẫn Vận Hành & Lệnh Chạy:** Runbook chi tiết cho môi trường phát triển và sản phẩm.

---

## 📁 Cấu Trúc Dự Án (Chuẩn SPA React 18 + Vite + Ant Design + Express Gateway)

```text
qk7-datahub/
├── backend/                                # 🟢 Máy chủ Backend Express & Cơ sở dữ liệu
│   ├── src/                                # db.js (Kết nối SQL Server) & admin-routes.js (APIs QTV)
│   ├── uploads/                            # Kho lưu trữ file PDF thật (2026/..., Mat/, ToiMat/, TuyetMat/)
│   ├── public/                             # Thư mục chứa sản phẩm build tĩnh từ frontend (index.html, assets/)
│   ├── server.js                           # Entry point Express API Gateway (:8000) & SPA Fallback Middleware
│   ├── swagger.js                          # Đặc tả OpenAPI 3.0 Swagger Spec (/api-docs)
│   ├── setup-passwords.js                  # Script đồng bộ và băm mật khẩu bcrypt tài khoản
│   ├── .env                                # Cấu hình kết nối SQL Server và PORT
│   └── package.json                        # Dependencies & scripts riêng cho Backend (Express 5)
│
├── frontend/                               # 🔵 Giao diện người dùng Single Page Application (SPA)
│   ├── index.html                          # DUY NHẤT 1 file HTML vỏ bọc cho toàn ứng dụng
│   ├── vite.config.ts                      # Config build xuất sang ../backend/public, proxy :8000
│   ├── tsconfig.json                       # Cấu hình TypeScript compiler
│   ├── tailwind.config.js                  # Cấu hình TailwindCSS
│   ├── package.json                        # Dependencies Frontend (antd, @ant-design/icons, react-router-dom...)
│   └── src/
│       ├── App.tsx                         # Khởi tạo Ant Design ConfigProvider (Màu Tím #722ED1), Auth, Theme
│       ├── main.tsx                        # Entry point React 18 createRoot
│       ├── index.css                       # Design System CSS, biến màu quân sự, glassmorphism
│       │
│       ├── routes/                         # Hệ thống Auto-Discovery Routing & Phân Quyền
│       │   ├── routePaths.ts               # Danh mục URL tập trung (/login, /portal, /403, /404, /500...)
│       │   ├── routeAccess.ts              # Ma trận phân quyền kiểm soát Clearance Level & Login Guard (.ts)
│       │   ├── getAppRoutes.ts             # Tự động quét modules/*.routes.tsx qua import.meta.glob (.ts)
│       │   ├── RouterProvider.tsx          # Component điều hướng useRoutes hook (.tsx)
│       │   └── modules/                    # Định nghĩa route theo từng module nghiệp vụ (.routes.tsx)
│       │       ├── auth.routes.tsx         # Tuyến đường xác thực (/login)
│       │       ├── portal.routes.tsx       # Tuyến đường Cổng tra cứu (/portal, /)
│       │       ├── desk.routes.tsx         # Bàn làm việc văn thư (/document-desk, yêu cầu Cấp mật ≥ 3)
│       │       ├── admin.routes.tsx        # Quản trị hệ thống (/admin-dashboard, /users, yêu cầu Cấp mật ≥ 4)
│       │       ├── error.routes.tsx        # Tuyến đường mã lỗi HTTP (/400, /401, /403, /404, /500, /502, /503)
│       │       └── fallback.routes.tsx     # Bắt URL không hợp lệ (*) chuyển sang HttpErrorPage 404
│       │
│       ├── pages/                          # Các màn hình giao diện chính (TSX)
│       │   ├── LoginPage.tsx               # Màn hình đăng nhập quân nhân
│       │   ├── PortalPage.tsx              # Cổng tra cứu tài liệu quân sự
│       │   ├── DocumentDeskPage.tsx        # Bàn làm việc số hóa văn bản
│       │   ├── AdminDashboardPage.tsx      # Bảng điều khiển quản trị trung tâm
│       │   ├── UsersPage.tsx               # Quản lý tài khoản quân nhân & phân quyền
│       │   └── HttpErrorPage.tsx           # Trang mã trạng thái HTTP tinh gọn chuẩn Ant Design Result
│       │
│       ├── components/                     # Giao diện thành phần tái sử dụng
│       │   ├── common/                     # Header, Sidebar, Layout, ProtectedRoute, HttpErrorListener, Toast...
│       │   ├── auth/                       # LoginForm
│       │   ├── portal/                     # SecurityBanner, DocumentCard, PortalDocumentList
│       │   ├── document-desk/              # Dropzone, DocumentFilters, DocumentTable, DocumentUploadModal...
│       │   ├── dashboard/                  # StatCard, DistributionChart
│       │   └── users/                      # UserTable, UserFormModal, UserCredentialsModal
│       │
│       ├── services/                       # Tầng Dịch Vụ Mạng (Domain-Driven Architecture)
│       │   ├── http.ts                     # HTTP Client Wrapper với HttpError & Event phát lỗi HTTP
│       │   ├── authService.ts              # Xác thực đăng nhập & quản lý phiên làm việc
│       │   ├── documentService.ts          # Nghiệp vụ tìm kiếm, tải lên, xem, sửa, xóa văn bản
│       │   ├── userService.ts              # Nghiệp vụ quản lý người dùng & phân quyền quân nhân
│       │   ├── roleService.ts              # Nghiệp vụ quản lý vai trò (Roles)
│       │   ├── permissionService.ts        # Nghiệp vụ quản lý quyền thao tác (Permissions)
│       │   ├── unitService.ts              # Nghiệp vụ quản lý cơ quan, đơn vị quân khu
│       │   ├── documentTypeService.ts      # Nghiệp vụ quản lý danh mục loại văn bản
│       │   ├── securityLevelService.ts     # Nghiệp vụ quản lý 5 cấp độ bảo mật
│       │   ├── logService.ts               # Nghiệp vụ nhật ký kiểm toán an ninh (ACCESS_LOG)
│       │   ├── systemService.ts            # Kiểm tra trạng thái máy chủ (/api/health, /api/meta)
│       │   ├── dashboardApi.ts             # Aggregator Service phục vụ Admin Dashboard
│       │   ├── documentsApi.ts / usersApi.ts # Compatibility Aliases
│       │   └── index.ts                    # Barrel export tập trung toàn bộ services
│       │
│       ├── contexts/                       # Quản lý trạng thái toàn cục (AuthContext, ThemeContext)
│       ├── hooks/                          # Custom hooks tiện ích (useAuth)
│       ├── types/                          # Định nghĩa kiểu dữ liệu TypeScript (document.ts, user.ts)
│       └── utils/                          # Công cụ định dạng ngày tháng, kích thước tệp
│
├── package.json                            # Scripts tiện ích điều phối chạy từ thư mục gốc
├── .gitignore                              # Cấu hình bỏ qua node_modules, .env, uploads PDF
└── README.md
```

---

## 🛡️ Điểm Nhấn Kiến Trúc & Tính Năng Mới

### 1. Chuẩn Giao Diện Ant Design Toàn Diện (Tông Màu Tím `#722ED1`)
- **Theme & Color:** Toàn bộ ứng dụng được cấu hình qua `<ConfigProvider>` của Ant Design với màu chủ đạo hành động (Primary Action) là **Màu Tím (`#722ED1`)**, kết hợp phông chữ hệ thống tiêu chuẩn và tự động thích ứng chế độ Sáng / Tối (`algorithm: darkAlgorithm / defaultAlgorithm`).
- **Việt hóa toàn diện:** Tích hợp locale `vi_VN` sẵn trong Ant Design cho lịch, phân trang, thông báo, modal.

### 2. Trang Xử Lý Mã Trạng Thái HTTP Tinh Gọn (`HttpErrorPage.tsx`)
- Tích hợp chuẩn giao diện `<Result>` của Ant Design, xử lý trực quan các mã trạng thái:
  - **400 (Yêu cầu không hợp lệ)**: Báo lỗi định dạng truy vấn.
  - **401 (Chưa xác thực)**: Yêu cầu đăng nhập tài khoản quân nhân.
  - **403 (Truy cập bị từ chối)**: Vi phạm cấp độ bảo mật hoặc chưa được cấp quyền.
  - **404 (Không tìm thấy tài liệu)**: Đường dẫn không tồn tại hoặc văn bản đã bị thu hồi/hủy bỏ.
  - **500 / 502 / 503 (Lỗi máy chủ)**: Máy chủ gặp sự cố hoặc gián đoạn kết nối.
- **Trải nghiệm người dùng:**
  - Lỗi `4xx`: Hiển thị duy nhất nút **"Về Trang Chủ"** (`/portal`), thông điệp ngắn gọn, thân thiện.
  - Lỗi `5xx`: Bổ sung nút **"Tải Lại Trang"** song song với **"Về Trang Chủ"** để người dùng chủ động thử lại kết nối.
  - Không hiển thị thanh test mã lỗi hay các khối chẩn đoán kỹ thuật thừa thãi.
  - Tự động bắt lỗi qua `http.ts` và lắng nghe sự kiện `qk7:http-error` trong `HttpErrorListener.tsx`.

### 3. Bộ Gác Cổng Phân Quyền Theo 5 Cấp Độ Mật (`ProtectedRoute.tsx` & `routeAccess.ts`)
- **Cấp 1 - 2 (Công khai / Lưu hành nội bộ):** Truy cập Cổng tra cứu tài liệu (`/portal`, `/`).
- **Cấp 3 (Mật):** Truy cập Bàn làm việc văn thư (`/document-desk`).
- **Cấp 4 - 5 (Tối Mật / Tuyệt Mật):** Truy cập Trung tâm quản trị (`/admin-dashboard`) và Quản lý quân nhân (`/users`).
- Khi người dùng chưa đăng nhập hoặc không đủ cấp độ bảo mật tối thiểu, `ProtectedRoute` tự động chuyển hướng an toàn về `/login` hoặc hiển thị mã trạng thái `/403`.

---

## 🚀 Khởi Động Nhanh

### 1. Cài đặt thư viện (lần đầu)
```bash
# Cách 1: Chạy từ thư mục gốc
npm run backend:install
npm run frontend:install

# Cách 2: Chạy trực tiếp từng thư mục
cd backend && npm install
cd ../frontend && npm install
```

### 2. Chạy máy chủ Backend (Express :8000)
```bash
# Cách 1: Chạy từ gốc
npm run backend:start

# Cách 2: Chạy từ thư mục backend
cd backend
npm start
```
* **Cổng API & Web:** [http://localhost:8000](http://localhost:8000)
* **API Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
* **Tài liệu Swagger API (UI):** [http://localhost:8000/api-docs](http://localhost:8000/api-docs)
* **Đặc tả OpenAPI JSON:** [http://localhost:8000/api-docs.json](http://localhost:8000/api-docs.json)

### 3. Chạy môi trường phát triển Frontend (Hot-Reload Vite :5173)
```bash
# Cách 1: Chạy từ gốc
npm run frontend:dev

# Cách 2: Chạy từ thư mục frontend
cd frontend
npm run dev
```
* Truy cập giao diện: [http://localhost:5173/login](http://localhost:5173/login) hoặc [http://localhost:5173/portal](http://localhost:5173/portal)
*(Dev server tự động proxy toàn bộ request `/api` và `/uploads` sang `http://localhost:8000`)*

### 4. Đóng gói sản phẩm (Production Build xuất sang `backend/public/`)
```bash
# Cách 1: Chạy từ gốc
npm run frontend:build

# Cách 2: Chạy từ thư mục frontend
cd frontend
npm run build
```
Bản build tĩnh (gồm `index.html` và thư mục `assets/`) sẽ tự động được xuất sang `backend/public/`. Máy chủ `backend/server.js` sẽ tự động phục vụ các trang thông qua SPA Fallback Middleware khi F5 ở bất kỳ URL nào.

---

## 📜 Tài Liệu API & Swagger UI (OpenAPI 3.0)

Hệ thống tích hợp sẵn cổng tương tác API trực tiếp qua **Swagger UI** chuẩn OpenAPI 3.0:

* **URL Swagger UI:** [http://localhost:8000/api-docs](http://localhost:8000/api-docs)
* **OpenAPI 3.0 Spec JSON:** [http://localhost:8000/api-docs.json](http://localhost:8000/api-docs.json)
* **File cấu hình:** [`backend/swagger.js`](file:///d:/QK7_DataHub/qk7-datahub/backend/swagger.js)
* **Cấu hình môi trường:** Biến `ENABLE_SWAGGER=true` (trong file `backend/.env`)

### Các Nhóm Endpoint Chính (Tags)
1. **`Auth`**: Xác thực đăng nhập (`POST /api/auth/login`) và lấy hồ sơ hiện tại (`GET /api/auth/me`).
2. **`System`**: Kiểm tra kết nối SQL Server (`GET /api/health`), danh mục dùng chung (`GET /api/meta`) và kiểm thử mã lỗi (`GET /api/test-http-error/:code`).
3. **`Documents`**: Quản lý tài liệu PDF — Tìm kiếm (`GET /api/documents`), Tải lên có hash SHA-256 (`POST /api/documents/upload`), Xem chi tiết, Cập nhật, Xóa.
4. **`Files`**: Stream xem inline hoặc tải về tệp PDF đính kèm (`GET /api/files/{fileId}/view`).
5. **`Logs`**: Tra cứu 200 bản ghi nhật ký kiểm toán an ninh (`GET /api/access-logs`).
6. **`Admin` (Cần Clearance $\ge$ 4)**: 
   - Thống kê KPI tổng quan (`/api/admin/stats`).
   - CRUD Người dùng & Cấp mật khẩu (`/api/admin/users`, `/api/admin/users/{id}/credentials`).
   - Gán & Quản lý Vai trò (`/api/admin/roles`, `/api/admin/users/{id}/roles`).
   - Khai báo & Phân quyền (`/api/admin/permissions`, `/api/admin/roles/{id}/permissions`).
   - CRUD Đơn vị, Loại văn bản & 5 Mức bảo mật (`/api/admin/units`, `/api/admin/document-types`, `/api/admin/security-levels`).
   - Dọn dẹp nhật ký an ninh (`/api/admin/access-logs/clear`).

### Hướng Dẫn Thử Nghiệm API Trên Swagger UI
1. Mở trình duyệt truy cập: [http://localhost:8000/api-docs](http://localhost:8000/api-docs).
2. Nhấn nút **Authorize 🔓** ở góc trên bên phải.
3. Nhập giá trị xác thực:
   - `UserHeader` (`X-User-Id`): ví dụ `USR-004` (Quản trị viên) hoặc `USR-001`.
   - `ClearanceHeader` (`X-Clearance`): ví dụ `5` (Mức Tuyệt Mật) hoặc `4` (Tối Mật).
4. Nhấn **Authorize** và bắt đầu bấm **Try it out** trực tiếp trên từng endpoint.

---

## 🔐 Tài Khoản Kiểm Thử Mẫu (Mật khẩu: `123456789`)

* **Quản trị viên / Thủ trưởng (Cấp 5 - Tuyệt Mật):** `USR-004`
* **Trưởng phòng / Chỉ huy (Cấp 4 - Tối Mật):** `USR-001`
* **Cán bộ / Sĩ quan (Cấp 3 - Mật):** `USR-002`


