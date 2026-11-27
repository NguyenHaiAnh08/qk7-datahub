# Mẫu Tương tác Nghiệp vụ & Quy chế `uiverse-galaxy` (`COMPONENTS_AND_PATTERNS.md`)

Tài liệu hướng dẫn cách lắp ráp màn hình nghiệp vụ nhất quán trên QK7 DataHub và quy trình chuyển hóa vi thành phần từ nhân sự `uiverse-galaxy`.

---

## 1. Bảng Dữ liệu Mật độ Cao & Lọc Đa Tiêu chí

Áp dụng cho: `DocumentDeskPage`, `UsersPage`, `SessionsPage`, `TrashPage`, `ApprovalQueuePage`, nhật ký kiểm toán SOC.

- **Thanh công cụ (Toolbar):**
  - Ô tìm kiếm tiếng Việt không dấu (hỗ trợ lọc nhanh), đứng bên trái; các bộ lọc chọn (`Cấp độ mật`, `Đơn vị`, `Trạng thái`) xếp liền kề với khoảng cách `8px`–`12px`; nút hành động chính (`Thêm mới`, `Xuất Excel`) đặt bên phải.
  - Trên iPad Portrait (`834×1178`), toolbar tự động ngắt thành 2 hàng gọn, giữ chiều cao điều khiển `≥44px`.
- **Bảng (`DataTable.tsx` + AntD `Table`):**
  - Không dùng viền kẻ dọc chằng chịt; chỉ dùng đường phân cách hàng ngang mảnh (`#f1f5f9` Light / `#1e293b` Dark) và hover hàng nhẹ (`rgba(22,101,52,0.06)` Light / `rgba(16,185,129,0.12)` Dark).
  - Các cột **Mã hiệu, IP, Thời gian, Dung lượng, Số lượng** dùng `Be Vietnam Pro` kết hợp `tabular-nums` và căn lề nhất quán (cột số căn phải hoặc giữa theo chuẩn cột; cột văn bản căn trái), không dùng font monospace lập trình.
  - Dữ liệu `User-Agent` tại `SessionsPage` được phân tích gọn thành `HĐH • Trình duyệt` kèm icon thiết bị, không đổ nguyên chuỗi thô làm xô cột.
- **Phân trang:** Toàn bộ bảng/lưới phân trang dùng thống nhất [`PaginationBar.tsx`](../../frontend/src/components/common/PaginationBar.tsx) kết hợp `PageTransitionStage.tsx` khi chuyển trang.

---

## 2. Luồng UX Bảo mật 3 Tầng & Sinh trắc học 2FA (Cấp 3–5)

Mọi giao diện chạm tài liệu mật phải thể hiện rõ trạng thái bảo mật cho người vận hành:

1. **Phân biệt trực quan Cấp 1–2 và Cấp 3–5:**
   - Văn bản Cấp 3 (Mật), Cấp 4 (Tối Mật), Cấp 5 (Tuyệt Mật) hiển thị rõ huy hiệu độ mật chuẩn màu tại [`DESIGN.md`](./DESIGN.md#22-bảng-mã-hóa-màu-bắt-buộc-cho-5-cấp-độ-mật) kèm biểu tượng khóa/vân tay trên nút mở tài liệu.
2. **Hộp thoại Quét Vân tay ZKTeco ZK9500 (`TouchIDFingerprint.tsx`):**
   - **Bắt buộc render bằng React Portal vào `document.body`** để thoát khỏi mọi container có `overflow: hidden` hoặc `transform` (tránh lỗi kẹt Stacking Context của Framer Motion).
   - Hiển thị rõ 4 trạng thái vận hành: *Chờ đặt ngón tay (đếm ngược 15 giây)* → *Đang đối sánh 1:1* → *Thành công (cấp `X-Fingerprint-Token` hiệu lực 5 phút)* → *Thất bại / Mất kết nối Agent `:9001` (nút thử lại rõ ràng)*.
   - Nếu có cấu hình xác minh PIN 6 chữ số, tái sử dụng [`VerificationCodeInput.tsx`](../../frontend/src/components/common/VerificationCodeInput.tsx) (hỗ trợ dán chuỗi 6 số, báo lỗi rõ ràng).
3. **Xem Tài liệu PDF & Chống Rò rỉ:**
   - Luồng xem/tải luôn đi qua `/api/files/:fileId/view`, tuyệt đối không lộ đường dẫn `uploads/`.
   - Phủ lớp [`DynamicWatermark.tsx`](../../frontend/src/components/common/DynamicWatermark.tsx) nghiêng `45°`, chữ thẳng đứng (`font-style: normal`, không in nghiêng), hiển thị Họ tên, Tên đăng nhập, IP và Timestamp.
   - Khi Gateway trả `403 TIME_DRIFT_EXCEEDED`, hiển thị ngay [`SecurityScreenShield.tsx`](../../frontend/src/components/common/SecurityScreenShield.tsx) khóa thao tác và hướng dẫn đồng bộ giờ hệ thống.

---

## 3. Form Nhập liệu & Hành động Phá hủy

- **Form hành chính công vụ:**
  - Ưu tiên **nhãn tĩnh phía trên ô nhập** (`label` rõ ràng, có dấu `*` đỏ cho trường bắt buộc) đối với form nhiều trường (tạo văn bản, sửa thông tin quân nhân, cấu hình giảng đường) để mắt quét nhanh theo trục dọc.
  - Thông báo lỗi validation hiển thị ngay dưới trường bị lỗi bằng màu Đỏ Quân Kỳ (`#b91c1c` / `#f87171`) kèm câu hướng dẫn sửa ngắn gọn.
- **Sắp xếp thứ tự danh mục / quyền:**
  - Dùng kéo-thả trực quan với tay cầm `GripVertical` (như tab Cấu hình Quyền tại `AdminDashboardPage`), không bắt nhập số thứ tự thủ công.
- **Hành động Phá hủy (Xóa vĩnh viễn / Ngắt phiên / Hạ quyền):**
  - Sử dụng [`ConfirmDialog.tsx`](../../frontend/src/components/common/ConfirmDialog.tsx) tông màu Đỏ Quân Kỳ, ghi rõ đối tượng bị tác động (ví dụ: mã văn bản, số phiên) và yêu cầu xác nhận 2 bước với thao tác không thể hoàn tác.

---

## 4. Trạng thái Hệ thống: Loading, Empty, Error & Toast

- **Loading:**
  - Với bảng/thẻ danh sách đang tải dữ liệu lần đầu, ưu tiên khung xương (Skeleton) giữ đúng kích thước bố cục để tránh giật màn hình; dùng `CompactDownloadButton.tsx` cho tiến trình tải tệp PDF.
- **Empty State:**
  - Dùng [`TacticalEmptyState.tsx`](../../frontend/src/components/common/TacticalEmptyState.tsx): giải thích lý do trống (ví dụ: *"Không tìm thấy văn bản khớp bộ lọc hiện tại"*) kèm nút hành động tiếp theo (*"Xóa bộ lọc"* hoặc *"Tải văn bản mới"*).
- **Thông báo (Toast):**
  - Gọi qua `ToastProvider` (`Toast.tsx`, góc dưới phải). Đã tích hợp **debounce/throttle 2 giây** cho lỗi `403 Forbidden` để tránh chồng chéo thông báo khi nhiều API nền cùng bị từ chối.

---

## 5. Văn phong Giao diện Tiếng Việt (UX Copywriting)

Áp dụng chuẩn từ `humanizer` và thuật ngữ hành chính-quân sự thống nhất của Nhà trường:

- **Thuật ngữ chuẩn:** *"Trung tâm dữ liệu số"*, *"Đơn vị của tôi"*, *"Văn bản số"*, *"Bài giảng số"*, *"Giảng đường"*, *"Cấp bậc"*, *"Độ mật"*, *"Phiên trực tuyến"*, *"Nhật ký kiểm toán SOC"*.
- **Nhãn nút bấm:** Dùng động từ cụ thể theo kết quả hành động (`"Lưu thay đổi"`, `"Tải PDF"`, `"Khôi phục văn bản"`, `"Ngắt phiên"`, `"Quét vân tay"`), tránh từ mơ hồ như `"Xác nhận"` hay `"Gửi"` lặp lại ở mọi nơi.
- **Thông báo lỗi thân thiện nhưng chính xác:** Nêu rõ *chuyện gì xảy ra* + *người dùng cần làm gì* (ví dụ: *"Không kết nối được máy quét vân tay (:9001). Kiểm tra cáp USB và khởi động lại Fingerprint Agent."*).

---

## 6. Quy chế Khai thác Nhân sự `uiverse-galaxy` (Offline Library)

Nhân sự `uiverse-galaxy` quản lý **3,802 thành phần UI thủ công** tại `.agents/skills/uiverse-galaxy/library/` (MIT License, chạy 100% offline).

### 6.1. Quy trình 4 bước trước khi đưa vào `frontend/src/`

1. **Tra cứu bằng CLI cục bộ:**
   ```bash
   node .agents/skills/uiverse-galaxy/scripts/search-galaxy.mjs --category Toggle-switches --style css --limit 10
   node .agents/skills/uiverse-galaxy/scripts/search-galaxy.mjs --show Toggle-switches/<file>.html
   ```
2. **Giữ cái tốt, bỏ cái rườm rà:**
   - **Giữ lại:** Cấu trúc HTML tối giản, cơ chế chuyển trạng thái CSS mượt (`transform`, `opacity`, `:checked + span`), tỷ lệ hình học cân đối.
   - **Loại bỏ hoàn toàn:** Màu neon cố định (`#00ffff`, `#ff00ff`, `#722ED1`), bóng phát sáng lớn, hoạt ảnh quay vô tận làm phân tâm khi đọc bảng, mọi URL ngoài (`https://...`), reset CSS toàn cục (`* { margin: 0 }`) có thể làm vỡ Ant Design.
3. **Chuẩn hóa sang QK7 Tokens & 7 Trạng thái:**
   - Thay toàn bộ màu cứng bằng cặp biến/class hỗ trợ cả Light Mode (`#166534`, `#ffffff`, `#0f172a`, `#e2e8f0`) và Dark Mode (`#10b981`, `#111827`, `#f1f5f9`, `rgba(255,255,255,0.08)`).
   - Bổ sung `:focus-visible`, `:disabled`, `@media (prefers-reduced-motion: reduce)` và đảm bảo vùng chạm `≥44×44px` khi `deviceMode === 'ipad'`.
4. **Đóng gói sạch sẽ & Ghi nhận MIT:**
   - Đưa vào `frontend/src/components/common/` (nếu tái sử dụng toàn hệ thống) hoặc giữ cục bộ trong module tính năng tương ứng. Không tự tạo thư mục mới ngoài cấu trúc chuẩn tại `ANTIGRAVITY_MASTER_BRAIN.md`.
   - Thêm dòng chú thích bản quyền MIT:
     `/* Adapted from Uiverse.io Galaxy: <Danh-muc>/<ten-file>.html (MIT License) */`
