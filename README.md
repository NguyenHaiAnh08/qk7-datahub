# QK7 DATAHUB — Cổng Quản Lý Dữ Liệu Tập Trung Quân Khu 7

Hệ thống quản lý, lưu trữ số hóa và phân quyền khai thác tài liệu văn bản quân sự bảo mật đa cấp độ của Bộ Tư Lệnh Quân Khu 7.

---

## 📌 Tài Liệu Kiến Trúc Toàn Diện

Toàn bộ sơ đồ kiến trúc hệ thống, sơ đồ cấu trúc mã nguồn, lưu đồ tuần tự nghiệp vụ và thiết kế cơ sở dữ liệu được trình bày chi tiết tại:

👉 **[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)**

Nội dung tài liệu bao gồm:
1. **Sơ Đồ Kiến Trúc Hệ Thống (System Architecture Diagram - Mermaid):** 4 tầng Client, Presentation (MPA), Gateway Express và Storage vật lý / SQL Server.
2. **Sơ Đồ Cấu Trúc Mã Nguồn (Source Tree & Architecture):** Cây thư mục chi tiết, quan hệ giữa các mô-đun frontend, backend, public và uploads.
3. **Mô Hình Phân Quyền & Bảo Mật:** 5 cấp độ bảo mật quân sự (Công khai, Nội bộ, Mật, Tối mật, Tuyệt mật), cơ chế băm SHA-256 và Access Audit Log.
4. **Sơ Đồ Luồng Dữ Liệu (Sequence Diagrams):** Đăng nhập xác thực, Tải lên tệp văn bản và Tra cứu kiểm soát cấp độ mật.
5. **Sơ Đồ Cơ Sở Dữ Liệu (Database ERD):** Quan hệ giữa các bảng `USER`, `SECURITY_LEVEL`, `UNIT`, `DOCUMENT`, `DOCUMENT_TYPE`, `ACCESS_LOG`, `ROLE`, `PERMISSION`.
6. **Danh Mục API Endpoints:** Bảng đặc tả chi tiết toàn bộ REST APIs.
7. **Hướng Dẫn Vận Hành & Lệnh Chạy:** Runbook chi tiết cho môi trường phát triển và sản phẩm.

---

## 📁 Cấu Trúc Dự Án (Chuẩn SPA React + Vite + Express Gateway)

```text
qk7-datahub/
├── backend/                       # 🟢 Máy chủ Backend Express & Cơ sở dữ liệu
│   ├── src/                       # db.js (SQL Server connection) & admin-routes.js
│   ├── uploads/                   # Kho lưu trữ file PDF thật (2026/..., Mat/, ToiMat/, TuyetMat/)
│   ├── public/                    # Thư mục chứa sản phẩm build từ frontend (index.html, assets/ js/css)
│   ├── server.js                  # Entry point Express API Gateway (:8000) & SPA Fallback Middleware
│   ├── swagger.js                 # Đặc tả OpenAPI Swagger Spec
│   ├── setup-passwords.js         # Script đồng bộ mật khẩu tài khoản
│   ├── .env                       # Cấu hình kết nối SQL Server và PORT
│   └── package.json               # Dependencies & scripts riêng cho Backend (Express 5)
├── frontend/                      # 🔵 Giao diện người dùng Single Page Application (SPA)
│   ├── index.html                 # DUY NHẤT 1 file HTML vỏ bọc cho toàn ứng dụng
│   ├── src/
│   │   ├── App.tsx                # Setup Root Provider (BrowserRouter, ThemeProvider, AuthProvider)
│   │   ├── main.tsx               # Entry point React 18 createRoot
│   │   ├── routes/                # Hệ thống Auto-Discovery Routing (React Router)
│   │   │   ├── routePaths.ts      # Danh mục đường dẫn chuẩn (/login, /portal, /document-desk...)
│   │   │   ├── getAppRoutes.tsx   # Tự động quét modules/*.routes.tsx qua import.meta.glob
│   │   │   ├── RouterProvider.tsx # Component điều hướng useRoutes hook
│   │   │   └── modules/           # Định nghĩa routes theo từng nghiệp vụ (auth, portal, desk, admin...)
│   │   ├── pages/                 # Màn hình TSX (LoginPage, PortalPage, AdminDashboardPage...)
│   │   ├── components/            # Giao diện thành phần (Header, Sidebar, LoginForm...)
│   │   ├── contexts/              # Quản lý trạng thái toàn cục (AuthContext, ThemeContext)
│   │   └── services/              # Kết nối REST API Backend (/api)
│   ├── vite.config.ts             # Config build xuất sang ../backend/public, proxy :8000
│   └── package.json               # Dependencies & scripts riêng cho Frontend
├── package.json                   # Scripts tiện ích chạy từ thư mục gốc
├── .gitignore                     # Cấu hình bỏ qua node_modules, .env, uploads PDF
└── README.md
```

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
2. **`System`**: Kiểm tra kết nối SQL Server (`GET /api/health`) và lấy danh mục dùng chung (`GET /api/meta`).
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

