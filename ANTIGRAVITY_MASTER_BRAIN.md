# 🧠 ANTIGRAVITY MASTER BRAIN — QK7 DATAHUB PROJECT CONSTITUTION
> **CẢNH BÁO TỐI CAO:** Bất kỳ AI Agent nào khi tham gia dự án này BẮT BUỘC phải đọc file này ĐẦU TIÊN. Đây là nguồn chân lý tối cao (Single Source of Truth). Nếu mâu thuẫn với bất kỳ file nào khác, file này là chuẩn.

---

## 1. LỜI THỀ CỦA KỸ SƯ TRƯỞNG (THE OATH)
- **KHÔNG PHÁ VỠ LOGIC:** Không tự ý thay đổi API contract, không sửa logic nghiệp vụ, không đổi cấu trúc CSDL (trừ khi có lệnh trực tiếp bằng văn bản từ USER).
- **BẢO MẬT LÀ TRÊN HẾT:** Mọi thay đổi phải giữ nguyên mô hình bảo mật 3 tầng bắt buộc:
  $$\text{UI Guard} \longrightarrow \text{Gateway Middleware} \longrightarrow \text{SQL Constraint}$$
  Tuyệt đối không bypass xác thực sinh trắc học vân tay 2FA (ZKTeco ZK9500), không hardcode secrets (`JWT_SECRET`, `FP_ENC_KEY`, `FINGERPRINT_BRIDGE_TOKEN`, mật khẩu DB/admin).
- **KỶ LUẬT THƯ MỤC:** Chỉ được tạo file/thư mục theo đúng cấu trúc quy định tại Mục 3 dưới đây. Nghiêm cấm tạo file rác, file nháp, file dump ở thư mục gốc.
- **DI CHUYỂN AN TOÀN:** Mọi thao tác di chuyển file phải dùng lệnh `git mv` để bảo toàn lịch sử mã nguồn (Git history). Tuyệt đối không copy/paste làm đứt gãy tracking.

---

## 2. BẢN ĐỒ TÀI LIỆU DỰ ÁN (DOCUMENTATION INDEX)
Khi cần tra cứu thông tin nghiệp vụ và kỹ thuật, BẮT BUỘC đọc các tài liệu tương ứng trong thư mục `docs/`:

### 2.1. Kiến trúc hệ thống & Cơ sở dữ liệu (`docs/architecture/`)
- **Kiến trúc tổng thể hệ thống:** [`docs/architecture/SYSTEM_ARCHITECTURE.md`](./docs/architecture/SYSTEM_ARCHITECTURE.md)
  - Kiến trúc 5 tầng: Client/Phần cứng $\rightarrow$ Presentation SPA (React 18) $\rightarrow$ Gateway (Express 5, `:8000`) $\rightarrow$ AI Microservice (FastAPI, `:8001`) $\rightarrow$ Storage (SQL Server `QK7_ThuVienSo`, `uploads/`, Qdrant).
  - Dual-Platform UI: Desktop PC Widescreen & iPad Air M4 Touch UI.

### 2.2. An ninh & Bảo mật (`docs/security/`)
- **Chính sách bảo mật & 5 cấp độ mật:** [`docs/security/SECURITY.md`](./docs/security/SECURITY.md)
  - Cấp 1: Công khai | Cấp 2: Nội bộ | Cấp 3: Mật | Cấp 4: Tối Mật | Cấp 5: Tuyệt Mật.
  - Cấp 3–5 bắt buộc quét vân tay 2FA, cấp token `X-Fingerprint-Token` (hiệu lực 5 phút, gắn chặt cặp `user_id, file_id`).
- **Báo cáo kiểm toán bảo mật & Pentest:** [`docs/security/SECURITY_AUDIT_REPORT.md`](./docs/security/SECURITY_AUDIT_REPORT.md) & [`docs/security/strix-pentest-instructions.md`](./docs/security/strix-pentest-instructions.md)
  - Phòng chống 10 lỗ hổng OWASP: SQL Injection, Path Traversal (CWE-22), Zip Slip / Zip Bomb (CWE-409), Broken Access Control, Secret Leak.

### 2.3. Hướng dẫn kỹ thuật & Vận hành (`docs/guides/`)
- **Cài đặt & Triển khai máy chủ:** [`docs/guides/SETUP_SERVER.md`](./docs/guides/SETUP_SERVER.md)
- **Quy chuẩn điều hướng Frontend:** [`docs/guides/ROUTING_CONVENTION.md`](./docs/guides/ROUTING_CONVENTION.md)
- **Nhật ký sửa lỗi hệ thống:** [`docs/guides/TROUBLESHOOTING_HISTORY.md`](./docs/guides/TROUBLESHOOTING_HISTORY.md)
- **Quy trình làm việc của Agent:** [`docs/guides/AGENT_WORKFLOW.md`](./docs/guides/AGENT_WORKFLOW.md)
- **Quy tắc kỹ sư đa vai trò:** [`docs/guides/Senior Multi-Role.md`](./docs/guides/Senior%20Multi-Role.md)
- **Báo cáo tái cấu trúc chuẩn Enterprise:** [`docs/guides/ENTERPRISE_RESTRUCTURING_REPORT.md`](./docs/guides/ENTERPRISE_RESTRUCTURING_REPORT.md)
- **Báo cáo triển khai & đóng gói OCR Microservice v2.0 (Air-Gapped VLAN):** [`docs/guides/OCR_DEPLOYMENT_REPORT.md`](./docs/guides/OCR_DEPLOYMENT_REPORT.md)

### 2.4. Quy chuẩn Thiết kế UI/UX — Anti-AI-Slop (`docs/design/`)
- **Kim chỉ nam Thiết kế Bản sắc Quân sự:** [`docs/design/DESIGN.md`](./docs/design/DESIGN.md)
  - Hệ màu: Xanh Lục Quân `#166534`, Vàng Kim `#fbbf24`, Đỏ Quân Kỳ `#b91c1c`, Tím Thư viện `#722ED1`.
  - Không dùng animation tuyến tính vô hồn; dùng Spring physics `cubic-bezier(.34, 1.45, .64, 1)`.
  - Phân tầng độ sâu bề mặt (Layered Surfaces), Animated Toast, `font-mono` tabular cho số liệu chỉ huy.
- **Kỹ năng thiết kế chi tiết & Tham chiếu:** [`docs/design/SKILL.md`](./docs/design/SKILL.md) & [`docs/design/System Architect.md`](./docs/design/System%20Architect.md)

---

## 3. QUY CHUẨN CẤU TRÚC MÃ NGUỒN (STRICT SOURCE TREE)

### 3.1. Cấu trúc thư mục gốc (Root)
```text
qk7-datahub/
├── .github/               # CI/CD Workflows (GitHub Actions)
├── backend/               # Express 5 Gateway (:8000)
├── boxchat/               # FastAPI AI Microservice (:8001)
├── frontend/              # React 18 + Vite + Ant Design SPA
├── fingerprint/           # ZKTeco Local Agent (:9001, libzkfp.dll)
├── ocr-service/           # PaddleOCR / MonkeyOCRv2 Microservice (:8002)
├── scripts/               # Chứa TẤT CẢ script tiện ích (.bat, .ps1, .sh, mergecode.py)
├── data/                  # Chứa dữ liệu tĩnh (eng.traineddata, vie.traineddata)
├── docs/                  # Chứa TẤT CẢ tài liệu Markdown của dự án
│   ├── architecture/      # Kiến trúc tổng thể, sơ đồ hệ thống, CSDL
│   ├── security/          # Chính sách an ninh, báo cáo audit, pentest
│   ├── guides/            # Hướng dẫn setup, convention, checklist, troubleshoot
│   └── design/            # Quy chuẩn UI/UX Anti-AI-Slop, Design System
├── reports/               # Chứa output quét bảo mật (trivy, zap, gitleaks, sbom) [GITIGNORE]
├── tests/                 # Chứa Integration Tests & E2E Tests
├── config/                # Chứa file cấu hình phụ trợ (zap.yaml, tsconfig.json, client.info)
├── ANTIGRAVITY_MASTER_BRAIN.md # Hiến pháp tối cao của dự án (Single Source of Truth)
├── README.md              # Sổ tay tổng quan dự án & hướng dẫn khởi động nhanh
├── docker-compose.yml     # Điều phối container Docker
└── package.json           # Scripts điều phối monorepo
```

### 3.2. Quy chuẩn Frontend (`frontend/src/`)
Khi xây dựng giao diện hoặc tích hợp API, BẮT BUỘC tuân thủ:
- `services/`: Chứa các service gọi API (`http.ts`, `authService.ts`, `documentService.ts`...) qua HTTP Client Wrapper thống nhất (`HttpError`). KHÔNG gọi `fetch`/`axios` trực tiếp trong Component.
- `components/`: Chia nhóm rành mạch:
  - `common/`: Các component tái sử dụng (Header, AnimatedToast, Watermark, Table, Button).
  - `ai-chat/`: Giao diện Trợ lý AI RAG, streaming chat, trích dẫn.
  - `document-desk/`: Quản lý văn bản, bàn làm việc, trình đọc PDF bảo mật.
  - `portal/`: Trang cổng thông tin, danh mục đơn vị, thống kê nhanh.
  - `users/`: Quản lý người dùng, phân quyền, đăng ký vân tay ZKTeco.
- `pages/`: Các màn hình chính (Login, Portal, DocumentDesk, AdminDashboard, Users, Sessions...).
- `routes/`: Cấu hình Auto-Discovery Routing (`routePaths.ts`, `routeAccess.ts`, `getAppRoutes.ts`, `modules/`).
- `hooks/`: Custom hooks chuyên dụng (`useAntiScreenshot`, `useDeviceMode`, `useApprovalCount`...).
- `contexts/`: Quản lý Global State (`AuthContext`, `ThemeContext`, `DeviceModeContext`, `AIChatContext`).
- `types/` & `utils/`: Định nghĩa kiểu dữ liệu TypeScript và các hàm tiện ích thuần túy.

### 3.3. Quy chuẩn Backend (`backend/src/`)
- `routes/` & `*-routes.js`: Định nghĩa các API endpoints theo hợp đồng Swagger OpenAPI (`/api-docs`).
- `middlewares/` (hoặc module bảo mật chuyên biệt): Xác thực Auth JWT, Clearance Guard (Cấp 1–5), Fingerprint 2FA Token Guard, Rate Limiting, Security Headers Helmet.
- `services/` (hoặc module nghiệp vụ chuyên biệt): Xử lý logic nghiệp vụ, giao tiếp SQL Server qua connection pool `db.js`, stream file PDF có đóng dấu watermark.
- `utils/` (hoặc helper module): Tiện ích thẩm định dữ liệu, giải nén SCORM an toàn (chống Zip Slip/Zip Bomb), clock authority chống chỉnh giờ OS.

---

## 4. QUY TẮC THỰC THI (EXECUTION RULES) DÀNH CHO AI AGENT

1. **ĐỌC TRƯỚC KHI LÀM:**
   - Đụng chạm UI/UX: Bắt buộc đọc [`docs/design/DESIGN.md`](./docs/design/DESIGN.md) và [`docs/design/SKILL.md`](./docs/design/SKILL.md) để đảm bảo chuẩn Anti-AI-Slop.
   - Đụng chạm bảo mật/tài liệu: Bắt buộc đọc [`docs/security/SECURITY.md`](./docs/security/SECURITY.md).
   - Đụng chạm định tuyến: Bắt buộc đọc [`docs/guides/ROUTING_CONVENTION.md`](./docs/guides/ROUTING_CONVENTION.md).

2. **KHI TỔ CHỨC LẠI SOURCE CODE:**
   - CHỈ di chuyển file bằng lệnh `git mv`, KHÔNG sửa đổi nội dung nghiệp vụ bên trong file.
   - Cập nhật chính xác đường dẫn import/require/path trong các file liên quan để không gây lỗi runtime.

3. **KHI VIẾT CODE MỚI HOẶC BẢO TRÌ:**
   - Giữ nguyên mô hình bảo mật 3 tầng (UI Guard $\rightarrow$ Gateway Middleware $\rightarrow$ SQL Constraint).
   - Không nới lỏng bộ lọc cấp mật ở RAG vector store (`local_storage/qdrant_data`) hoặc nhánh Smart SQL Fallback.
   - Không sửa API contract; chỉ gọi đúng endpoint theo Swagger specs.

4. **KIỂM TRA BẮT BUỘC TRƯỚC KHI BÀN GIAO:**
   - Frontend: Chạy `cd frontend && npm run build` (phải biên dịch thành công, không có lỗi TypeScript).
   - Backend: Chạy `cd backend && node -c server.js` (kiểm tra cú pháp Node.js sạch sẽ).
   - Scripts: Kiểm tra các đường dẫn tương đối trong `scripts/` bảo đảm hoạt động từ mọi thư mục.

