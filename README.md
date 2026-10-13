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

## 🚀 Khởi Động Nhanh

### 1. Cài đặt thư viện (lần đầu)
```bash
# Cài đặt backend
npm install

# Cài đặt frontend
cd frontend && npm install && cd ..
```

### 2. Chạy máy chủ chính thức (Express :8000)
```bash
npm start
```
Truy cập: [http://localhost:8000/login.html](http://localhost:8000/login.html)

### 3. Chạy môi trường phát triển Hot-Reload (Vite :5173)
```bash
npm run dev
```
Truy cập: [http://localhost:5173/login.html](http://localhost:5173/login.html)

### 4. Đóng gói sản phẩm (Production Build sang `public/`)
```bash
npm run build
```

---

## 🔐 Tài Khoản Kiểm Thử Mẫu (Mật khẩu: `123456789`)

* **Quản trị viên / Thủ trưởng (Cấp 5 - Tuyệt Mật):** `USR-004`
* **Trưởng phòng / Chỉ huy (Cấp 4 - Tối Mật):** `USR-001`
* **Cán bộ / Sĩ quan (Cấp 3 - Mật):** `USR-002`
