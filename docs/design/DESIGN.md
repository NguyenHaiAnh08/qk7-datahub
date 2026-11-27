---
name: qk7-datahub-design-system
description: Hệ thống Thiết kế Giao diện & Trải nghiệm Người dùng cho Trung tâm Dữ liệu Số — Trường Quân sự Quân khu 7.
colors:
  primary-light: "#166534"
  primary-hover-light: "#14532d"
  primary-active-light: "#15803d"
  primary-dark: "#10b981"
  primary-hover-dark: "#059669"
  secondary-light: "#d97706"
  secondary-dark: "#fbbf24"
  gold-accent: "#d4af37"
  danger-light: "#b91c1c"
  danger-dark: "#f87171"
  canvas-light: "#e2e8f0"
  surface-light: "#ffffff"
  surface-subtle-light: "#f8fafc"
  border-light: "#e2e8f0"
  text-light: "#0f172a"
  text-muted-light: "#64748b"
  canvas-dark: "#090e17"
  surface-dark: "#111827"
  surface-elevated-dark: "#1e293b"
  text-dark: "#f1f5f9"
  text-muted-dark: "#94a3b8"
  navy-900: "#0b1b29"
typography:
  body:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  heading:
    fontFamily: "Be Vietnam Pro, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontWeight: 500
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.md}"
    height: "38px"
  card-surface:
    backgroundColor: "{colors.surface-light}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  input-control:
    backgroundColor: "{colors.surface-light}"
    rounded: "{rounded.md}"
    height: "38px"
---

# Đặc tả Hệ thống Thiết kế — QK7 DataHub (`DESIGN.md`)

> Tài liệu chuẩn kỹ thuật (Single Source of Truth) cho toàn bộ giao diện React 18 + Ant Design v6 + Tailwind CSS v3 tại `frontend/`.  
> Tham chiếu kèm: [`TOKENS.md`](./TOKENS.md) · [`COMPONENTS_AND_PATTERNS.md`](./COMPONENTS_AND_PATTERNS.md) · [`REVIEW_CHECKLIST.md`](./REVIEW_CHECKLIST.md).

---

## 1. Tổng quan & Chế độ Sản phẩm (Overview & Modes)

QK7 DataHub là phần mềm nghiệp vụ nội bộ phục vụ quản trị văn bản số bảo mật đa cấp độ, bài giảng điện tử SCORM/HTML5, điều hành giảng đường và giám sát an ninh SOC. Giao diện tuân theo hai chế độ sử dụng rõ rệt:

- **Operate Mode (~90% màn hình):** `PortalPage`, `DocumentDeskPage`, `MyUnitPage`, `AdminDashboardPage`, `UsersPage`, `ApprovalQueuePage`, `ClassroomsPage`, `SessionsPage`, `TrashPage`, `ProtectedPermissionsConfigPage`.
  - Ưu tiên **tính quen thuộc đáng tin cậy, khả năng quét nhanh dữ liệu, mật độ thông tin hợp lý và độ chính xác khi thao tác**.
  - Tránh trang trí thừa, tránh chữ hiển thị quá khổ kiểu trang quảng bá, tránh làm người dùng phải chờ hiệu ứng mở màn.
- **Read Mode (~10% bề mặt):** Trình đọc PDF có đóng dấu watermark (`DynamicWatermark`), chi tiết nội dung văn bản, phòng học `LiveSessionRoom`, luồng trả lời kèm trích dẫn trang của Trợ lý AI (`AIChatDrawer`).
  - Ưu tiên **độ tương phản chữ cao, khoảng thở đọc thoải mái và đường dẫn trích dẫn minh bạch**.

**Mặc định giao diện:** Khởi động ở **Light Mode** cho công tác hành chính ban ngày (`ThemeContext.tsx` với key `qk7_theme_default_light_v1`). **Dark Mode** (`#090e17` / `#111827`) phục vụ phòng trực ban và giám sát an ninh SOC dài giờ. Mọi component mới bắt buộc hoạt động hoàn chỉnh ở cả hai chế độ.

---

## 2. Hệ Màu & Mã Hóa 5 Cấp Độ Mật (Color System & Clearance Encoding)

### 2.1. Bảng màu Triad Quân đội & Bề mặt Trung tính

| Vai trò | Light Mode (Mặc định) | Dark Mode (Trực ban / SOC) | Phạm vi áp dụng |
| :--- | :--- | :--- | :--- |
| **Primary (Xanh Lục Quân)** | `#166534` (Hover `#14532d`, Active `#15803d`) | `#10b981` (Hover `#059669`, Text `#34d399`) | Nút hành động chính, mục đang chọn, liên kết chính, trạng thái hợp lệ/duyệt xong. |
| **Secondary (Vàng Kim Quân Hiệu)** | `#d97706` (Light text `#b45309`, Accent `#d4af37`) | `#fbbf24` (Hover `#f59e0b`) | Cảnh báo chú ý, chờ duyệt, Cấp 3 Mật, điểm nhấn tab chọn trên iPad. |
| **Danger (Đỏ Quân Kỳ)** | `#b91c1c` / `#dc2626` | `#f87171` | Cảnh báo an ninh `CRITICAL`, xóa vĩnh viễn, Cấp 5 Tuyệt Mật, lỗi xác thực/lệch giờ. |
| **Canvas (Nền tổng thể)** | `#e2e8f0` (Layout AntD `#f8fafc`) | `#090e17` | Lớp nền dưới cùng chứa toàn trang. |
| **Surface (Thẻ / Bảng / Modal)** | `#ffffff` (Header bảng `#f8fafc`) | `#111827` (Header bảng `#0f172a`, Elevated `#1e293b`) | Vùng chứa nội dung chính, bảng dữ liệu, khung nhập. |
| **Border (Viền phân tách)** | `#e2e8f0` (Control `#cbd5e1`, Row `#f1f5f9`) | `rgba(255, 255, 255, 0.08)` / `rgba(16, 185, 129, 0.2)` | Phân cách cấu trúc bảng, thẻ, ô nhập liệu. |
| **Text Primary / Muted** | `#0f172a` / `#64748b` | `#f1f5f9` / `#94a3b8` | Nội dung chính phải đạt tối thiểu tương phản **4.5:1** (WCAG AA). |

### 2.2. Bảng Mã hóa Màu Bắt buộc cho 5 Cấp Độ Mật

Không dùng màu tím AI (`#722ED1`, violet, indigo) hay màu pastel ngẫu nhiên cho huy hiệu độ mật. Toàn hệ thống thống nhất 5 bậc phân biệt rõ bằng cả **màu sắc + nhãn chữ + biểu tượng**:

| Cấp độ | Tên gọi chuẩn | Nhóm màu | Yêu cầu xác thực UX bắt buộc |
| :---: | :--- | :--- | :--- |
| **Cấp 1** | Công khai | Xám đá (`Slate`) | Mở xem/tải trực tiếp qua `/api/files/:fileId/view`. |
| **Cấp 2** | Nội bộ | Xanh Lục Quân (`Emerald` / `#166534`) | Yêu cầu đăng nhập & thuộc đơn vị/quyền hợp lệ. |
| **Cấp 3** | Mật | Vàng Kim (`Amber` / `#d97706`) | Bắt buộc biểu tượng khóa/vân tay + mở hộp thoại quét **ZKTeco ZK9500** (`X-Fingerprint-Token` 5 phút). |
| **Cấp 4** | Tối Mật | Cam đậm (`Orange` / `#ea580c`) | Bắt buộc quét vân tay 2FA + đóng dấu `DynamicWatermark` dày đặc; hỗ trợ `VerificationCodeInput` khi cấu hình PIN. |
| **Cấp 5** | Tuyệt Mật | Đỏ Quân Kỳ (`Red` / `#b91c1c`) | Bắt buộc quét vân tay 2FA + giới hạn quyền tối cao + cảnh báo rõ trên SOC `ACCESS_LOG`. |

---

## 3. Typography & Mật độ Thông tin

- **Hai họ font duy nhất (khai báo cục bộ trong `frontend/src/fonts.css`, không gọi Google Fonts CDN):**
  1. **`Be Vietnam Pro`** (`400`, `500`, `600`, `700`): Toàn bộ tiêu đề, điều hướng, nhãn nút, bảng dữ liệu và văn bản hành chính tiếng Việt.
  2. **`JetBrains Mono`** (`tabular-nums`): Chỉ áp dụng cho **số liệu thống kê KPI, mã văn bản, mã đơn vị (`QK7`, `TRGQS-QK7`), mã quân nhân (`USR-001`), địa chỉ IP, dấu thời gian kiểm toán và mã băm SHA-256**. Không dùng monospace làm tiêu đề trang trí hoặc nhãn văn bản thường.
- **Thang kích thước cố định cho Operate Mode (`rem`, tỷ lệ 1.15–1.2):**
  - Tiêu đề trang (`h1`): `1.375rem`–`1.5rem` (`22px`–`24px`, `font-weight: 700`, tối đa 1–2 dòng).
  - Tiêu đề phân khu (`h2` / Card title): `1rem`–`1.125rem` (`16px`–`18px`, `font-weight: 600`).
  - Văn bản bảng & form (`body`): `0.875rem` (`14px`, `line-height: 1.5`).
  - Nhãn phụ & chú thích (`caption`): `0.75rem` (`12px`). Tránh chữ nhỏ hơn `12px` ở dữ liệu nghiệp vụ quan trọng.
- **Cắt ngắn có kiểm soát:** Tên văn bản dài dùng `truncate` / `line-clamp-2` kèm tooltip đầy đủ khi hover/focus để giữ hàng bảng đều nhau.

---

## 4. Bố cục & Công thái học Đa Nền tảng (Layout & Dual-Platform)

Hệ thống hỗ trợ song song hai chế độ qua `DeviceModeContext` (`frontend/src/contexts/DeviceModeContext.tsx`):

1. **Desktop PC Widescreen (`deviceMode === 'pc'`):**
   - Tối ưu thao tác chuột và phím, mật độ cột bảng cao, phản hồi tức thì (`0ms` độ trễ thao tác chọn chế độ, không ép hiệu ứng trượt rườm rà lên nút công cụ PC).
   - Độ rộng đọc văn bản tối đa `65–75ch`; bảng dữ liệu mở rộng theo khung màn hình rộng.
2. **iPad Air M4 Touch UI (`deviceMode === 'ipad'`):**
   - Hỗ trợ chuẩn hai hướng: **Landscape (`1210×802`)** và **Portrait (`834×1178`)**, chịu được mức thu phóng trình duyệt **`100%`, `125–150%`, `175–200%`** mà không vỡ lưới hay mất nút.
   - Mọi mục tiêu chạm (nút, tab, checkbox, hàng bảng bấm được) phải đạt kích thước vùng chạm tối thiểu **`44×44px`**.
   - Điều hướng sử dụng cụm trượt dạng viên thuốc (Segmented Pill Glider) cho thao tác ngón tay.
3. **Kỷ luật Header co giãn 3 tầng (`Header.tsx`) & Sidebar thông minh (`Sidebar.tsx`):**
   - Bảo toàn 3 ngưỡng hiển thị (`≥1536px` / `1280–1535px` / `<1280px`).
   - Cụm điều khiển trọng yếu (`DeviceModeSwitch`, `ThemeToggle`, User Profile) **luôn giữ `shrink-0 whitespace-nowrap`** để không bao giờ bị ép xuống dòng hoặc cắt mất nút đăng xuất.
   - `Sidebar` tự động ẩn hoàn toàn khi người dùng ở các trang không có menu con khả dụng.

---

## 5. Phân tầng Bề mặt & Độ sâu (Elevation & Depth)

- **Nguyên tắc cốt lõi — Solid Tonal Layering First:**
  - Phân biệt các lớp giao diện bằng bước chuyển sắc độ nền (`Canvas → Surface → Header/Elevated`) kết hợp viền mảnh `1px` sắc nét thay vì đổ bóng mờ đục lớn hoặc phủ kính mờ tràn lan.
- **Phạm vi được phép dùng `backdrop-filter: blur(...)`:**
  - Chỉ dùng cho các lớp thực sự nổi lên trên nội dung nền: hộp thoại quét vân tay 2FA (`TouchIDFingerprint` render qua React Portal), ngăn kéo AI (`AIChatDrawer`), popover/menu nổi hoặc modal xác nhận.
  - **Không dùng** glassmorphism trên toàn bộ card danh sách, bảng dữ liệu hay khu vực đọc tài liệu (gây giảm tương phản và tốn GPU trên iPad khi cuộn danh sách dài).
- **Họa tiết bản sắc (Trống đồng & Chữ S):** Giữ ở tầng nền trang đăng nhập hoặc khu vực trang trí tĩnh với độ mờ thấp, không chồng lên vùng chữ hay số liệu bảng.

---

## 6. Hình khối, Viền & Kỷ luật Chuyển động (Shapes & Motion)

- **Thống nhất bo góc (từ `App.tsx` ConfigProvider):**
  - Control nhỏ (`Tag`, checkbox, badge): `6px` (`borderRadiusSM`).
  - Nút bấm, ô nhập liệu, hộp chọn, bảng (`Button`, `Input`, `Select`, `Table`): `8px` (`borderRadius`).
  - Thẻ lớn, hộp thoại, cây chọn (`Card`, `Modal`, `TreeSelect`): `12px` (`borderRadiusLG`).
  - Viên thuốc (`pill` `9999px`): chỉ dùng cho badge trạng thái nhỏ hoặc thanh chuyển tab iPad.
- **Kỷ luật chuyển động (Motion Budget):**
  - Tương tác thường ngày (hover nút, đóng mở menu, chuyển trạng thái input): **`150–250ms`** dùng `--ux-tactile` (`cubic-bezier(0.16, 1, 0.3, 1)`) hoặc `--ux-smooth` (`cubic-bezier(0.2, 0.8, 0.2, 1)`).
  - Phản hồi có tính nhịp điệu (Toast xếp tầng `Toast.tsx`, bước duyệt `ApprovalStepper.tsx`, cuộn số `RollingNumber.tsx`, chuyển trang bảng `PageTransitionStage.tsx`): dùng `--ux-spring` (`cubic-bezier(0.34, 1.45, 0.64, 1)`).
  - **Cấm:** Chạy animation tự động dài hơi cản trở thao tác khi vào màn hình làm việc; cấm `transition: all ... linear`.
  - **Bắt buộc:** Mọi keyframe và transition mới phải hỗ trợ `@media (prefers-reduced-motion: reduce)`.

---

## 7. Danh mục Thành phần Thực tế trong Mã nguồn (`frontend/src/components/common/`)

Kỹ sư bắt buộc tái sử dụng các thành phần đã chuẩn hóa dưới đây trước khi viết mới:

| Thành phần | Tệp mã nguồn | Vai trò thực tế |
| :--- | :--- | :--- |
| **Điều hướng & Khung** | `Layout.tsx`, `Header.tsx`, `Sidebar.tsx`, `MainNavBar.tsx` | Khung ứng dụng 3 tầng responsive, tự ẩn sidebar khi rỗng. |
| **Bảng & Phân trang** | `DataTable.tsx`, `PaginationBar.tsx`, `PageTransitionStage.tsx`, `DateRangePicker.tsx` | Bảng mật độ cao, phân trang 7 khe thống nhất, bộ lọc ngày. |
| **Phản hồi & Hộp thoại** | `Toast.tsx`, `ConfirmDialog.tsx`, `TacticalEmptyState.tsx`, `LoadingSpinner.tsx` | Thông báo xếp tầng có đếm ngược & throttle 403, modal xác nhận 2 bước, trạng thái trống có hướng dẫn. |
| **Nghiệp vụ & Số liệu** | `ApprovalStepper.tsx`, `RollingNumber.tsx`, `CompactDownloadButton.tsx`, `DocumentReadingRing.tsx` | Tiến trình duyệt 2 tầng, số liệu đồng hồ `tabular-nums`, nút tải tiến trình, vòng đọc tài liệu. |
| **Bảo mật & Sinh trắc** | `TouchIDFingerprint.tsx`, `VerificationCodeInput.tsx`, `DynamicWatermark.tsx`, `SecurityScreenShield.tsx`, `ProtectedRoute.tsx` | Modal quét ZK9500 (React Portal), mã PIN 6 số, watermark 45° không italic, lá chắn chống lệch giờ. |
| **Chế độ Nền tảng** | `DeviceModeSwitch.tsx`, `ThemeToggle.tsx` | Chuyển đổi PC/iPad và Light/Dark với hiệu ứng View Transitions có fallback. |

**Yêu cầu bắt buộc:** Mọi thành phần tương tác mới (hoặc chuyển hóa từ `uiverse-galaxy`) phải có đủ **7 trạng thái**: `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error`.

---

## 8. Quy chuẩn Nên & Không Nên (Engineering Do's & Don'ts)

| Hạng mục | KHÔNG NÊN (Dấu hiệu AI-Slop / Lỗi kỹ thuật) | NÊN LÀM (Chuẩn Kỹ sư QK7 DataHub) |
| :--- | :--- | :--- |
| **Bảng màu** | Sót màu tím AI mặc định (`#722ED1`), dùng gradient cầu vồng hoặc glow neon trên thẻ dữ liệu. | Tuân thủ Triad Quân đội (`#166534` / `#10b981`, `#d97706` / `#fbbf24`, `#b91c1c` / `#f87171`) và bề mặt trung tính sạch. |
| **Bề mặt & Viền** | Phủ `backdrop-blur` lên mọi card trong bảng dài; đổ bóng nặng ở trạng thái nghỉ. | Phân tầng bằng sắc độ nền + viền `1px`; chỉ đổ bóng/mờ cho thành phần thực sự nổi (modal, drawer, menu). |
| **Typography** | Dùng `font-mono` cho tiêu đề; hiển thị số KPI/IP/ngày giờ bằng chữ thường bị nhảy cột khi cập nhật. | `Be Vietnam Pro` cho văn bản; `JetBrains Mono` + `tabular-nums` cho số liệu, mã hiệu, IP, timestamp, SHA-256. |
| **Phân trang & Cột** | Tự viết nút chuyển trang riêng lẻ ở từng màn hình; để chuỗi `User-Agent` thô làm lệch bảng. | Dùng `PaginationBar` thống nhất; tóm gọn `HĐH • Trình duyệt` kèm icon và căn cột rõ ràng. |
| **Thông báo & Lỗi** | Dùng `window.alert()`, toast đứng yên che nút bấm, hoặc để toast lỗi `403` bắn liên tục. | Dùng `ToastProvider` (`Toast.tsx`) với throttle 2s cho lỗi `403`; thông báo lỗi form đặt ngay dưới ô nhập. |
| **Hành động nguy hiểm** | Xóa vĩnh viễn chỉ bằng 1 cú click hoặc xác nhận sơ sài. | Hộp thoại `ConfirmDialog` màu Đỏ Quân Kỳ, nêu rõ hậu quả và yêu cầu xác nhận 2 bước. |
| **Sắp xếp thứ tự** | Bắt người dùng gõ số thứ tự thủ công gây trùng lặp. | Kéo-thả trực quan với tay cầm `GripVertical` và cập nhật tức thì (như tab Cấu hình Quyền). |
| **Tài liệu mật Cấp 3–5** | Hiển thị link trực tiếp tới `uploads/` hoặc để modal 2FA nằm trong container `overflow: hidden`. | Stream qua `/api/files/:fileId/view` kèm `X-Fingerprint-Token`; render modal 2FA qua React Portal vào `document.body`. |
