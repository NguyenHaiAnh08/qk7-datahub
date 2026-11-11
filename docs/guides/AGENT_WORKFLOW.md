# 📋 QUY TRÌNH LÀM VIỆC BẮT BUỘC VỚI AI AGENT (AGENT WORKFLOW GUIDELINES)
> **Dự án:** TRƯỜNG QUÂN SỰ QUÂN KHU 7 DATAHUB  
> **Áp dụng cho:** Kỹ sư phát triển, Pair-Programming AI Agent, DevOps & Đội ngũ vận hành  
> **Cập nhật lần cuối:** 30/10/2026

---

Mọi tác vụ liên quan đến dự án (bao gồm: **chỉnh sửa mã nguồn**, **phát triển tính năng mới**, **sửa lỗi / bug fixing**, **tối ưu hóa hiệu năng**, hoặc **bất kỳ tương tác nào với AI Agent**) đều phải tuân thủ nghiêm ngặt quy trình 3 bước dưới đây:

---

## 🔍 Bước 1: Khởi động & Đọc tài liệu (Pre-task Context Loading)

Trước khi bắt đầu thực hiện bất kỳ lệnh shell, viết mã hay chỉnh sửa bất kỳ tệp tin nào trong dự án:

1. **Rà soát & Đọc toàn bộ tài liệu Markdown liên quan:**
   * AI Agent / Kỹ sư bắt buộc phải rà soát và đọc qua các tệp tài liệu Markdown cốt lõi trong thư mục gốc và thư mục `docs/`:
     - `README.md`: Hướng dẫn khởi động nhanh, tổng quan hệ thống, danh mục chức năng.
     - `SYSTEM_ARCHITECTURE.md`: Tài liệu kiến trúc toàn diện 5 tầng, mô hình dữ liệu, phân quyền bảo mật 3 lớp.
     - `SETUP_SERVER.md`: Hướng dẫn cấu hình phần cứng (ZKTeco ZK9500), cơ sở dữ liệu, dịch vụ.
     - `TROUBLESHOOTING_HISTORY.md`: Danh mục tổng hợp toàn bộ các sự cố kỹ thuật từ trước đến nay và phương án giải quyết dứt điểm.
     - `AGENT_WORKFLOW.md`: Quy trình làm việc và quy chuẩn vận hành.
     - Các tài liệu trong thư mục `docs/`: `docs/CHANGELOG.md`, `docs/REMEDIATION_LOG.md`, v.v.

2. **Nắm bắt ngữ cảnh & Quy chuẩn kỹ thuật:**
   * Hiểu rõ kiến trúc 5 tầng: Client/ZKTeco ZK9500 $\rightarrow$ React 18 SPA (Dual-Platform Desktop & iPad Air M4) $\rightarrow$ Express 5 Gateway (:8000) $\rightarrow$ AI Microservice FastAPI (:8001) $\rightarrow$ SQL Server & Qdrant Vector DB.
   * Enforce triệt để **3 tầng bảo mật phân quyền**: UI Guard $\rightarrow$ Gateway Middleware $\rightarrow$ SQL Server Constraint. Tuyệt đối không chỉ chặn ở 1 tầng.
   * Tài liệu văn bản Cấp 3 (Mật), Cấp 4 (Tối Mật), Cấp 5 (Tuyệt Mật) bắt buộc xác thực sinh trắc học vân tay 2FA, cấp `fingerprint_token` JWT 5 phút gắn chặt `(user_id, file_id)`.
   * Kiểm tra các bảng nhạy cảm và ràng buộc Check Constraint trước khi thực hiện thao tác cơ sở dữ liệu.

---

## ⚙️ Bước 2: Thực hiện tác vụ (Execution)

1. **Lập kế hoạch & Phân tích:**
   * Xác định rõ phạm vi thay đổi (frontend, backend, AI microservice, biometric agent hoặc database).
   * Đảm bảo thay đổi nhỏ, an toàn, không phá vỡ hợp đồng API theo đặc tả Swagger OpenAPI (`/api-docs`).
   * Không tạo thư mục mới ngoài quy chuẩn cấu trúc dự án.
   * Không hardcode các khóa bí mật (`JWT_SECRET`, `FP_ENC_KEY`, `FINGERPRINT_BRIDGE_TOKEN`) vào mã nguồn.

2. **Triển khai mã nguồn:**
   * Áp dụng đúng công nghệ và quy chuẩn lập trình: TypeScript chặt chẽ, Ant Design theme tím `#722ED1`, xử lý trạng thái đầy đủ (loading, empty, error).
   * Tái sử dụng các module dùng chung: `services/http.ts`, `AuthContext`, `ThemeContext`, `DeviceModeContext`.
   * Ghi nhận đầy đủ nhật ký kiểm toán `ACCESS_LOG` đối với mọi hành vi nhạy cảm.

3. **Kiểm thử & Xác minh chất lượng:**
   * Chạy kiểm tra TypeScript `npx tsc --noEmit` và Vite build đảm bảo không phát sinh lỗi biên dịch.
   * Kiểm tra tính toàn vẹn của luồng nghiệp vụ trên cả 2 nền tảng: PC Widescreen và iPad Touch UI.

---

## 📝 Bước 3: Cập nhật tài liệu sau khi hoàn thành (Post-task Documentation Update)

Ngay sau khi hoàn thành công việc và kiểm thử thành công:

1. **Cập nhật đồng bộ các tài liệu Markdown liên quan:**
   * **Nếu phát triển tính năng mới:** Cập nhật mô tả tính năng, danh mục API, sơ đồ kiến trúc trong `README.md` và `SYSTEM_ARCHITECTURE.md`.
   * **Nếu khắc phục sự cố / bug fixing:** Ghi lại triệu chứng, nguyên nhân gốc rễ, giải pháp kỹ thuật và bài học phòng ngừa vào `TROUBLESHOOTING_HISTORY.md` và `docs/CHANGELOG.md`.
   * **Nếu có thay đổi schema CSDL hoặc cấu hình hệ thống:** Ghi chú chi tiết trong `SETUP_SERVER.md` và `SYSTEM_ARCHITECTURE.md`.

2. **Đảm bảo tính nhất quán tuyệt đối:**
   * Tài liệu dự án phải luôn là nguồn chân lý duy nhất (Single Source of Truth), phản ánh chính xác 100% trạng thái hoạt động thực tế của mã nguồn và hệ thống.

