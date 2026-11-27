# Tham chiếu Design Tokens & Kiến trúc CSS (`TOKENS.md`)

Tài liệu đối chiếu trực tiếp giữa quy chuẩn thiết kế tại [`DESIGN.md`](./DESIGN.md) và mã nguồn cấu hình hiện hành trong `frontend/`.

---

## 1. Nguồn Chân lý Mã nguồn (Token Sources)

| Tầng cấu hình | Tệp nguồn trong codebase | Nội dung quản lý |
| :--- | :--- | :--- |
| **Ant Design v6 Theme** | `frontend/src/App.tsx` (`AntdAppWrapper`) | `ConfigProvider` đồng bộ `darkAlgorithm`/`defaultAlgorithm`, màu chủ đạo, `borderRadius`, `controlHeight`, bảng màu từng component (`Button`, `Input`, `Select`, `TreeSelect`, `Card`, `Table`, `Modal`, `Drawer`, `Tag`). |
| **Tailwind CSS v3** | `frontend/tailwind.config.js` | Bảng màu mở rộng `navy.*`, `military.*`, `fontFamily` (`sans`, `mono`), `transitionTimingFunction` (`spring`, `smooth`, `tactile`), `spin-slow`. |
| **Global CSS & Biến CSS** | `frontend/src/index.css` & `frontend/src/fonts.css` | Font cục bộ `@font-face`, `:root` timing variables, thanh cuộn, lớp tiện ích và adapter Light Mode. |
| **State Giao diện** | `frontend/src/contexts/ThemeContext.tsx` | Khóa lưu trữ `qk7_theme`, mặc định Light Mode (`qk7_theme_default_light_v1`), chuyển đổi View Transitions API. |

---

## 2. Biến CSS & Đường cong Chuyển động (`frontend/src/index.css`)

```css
:root {
  color-scheme: light;
  --ux-spring: cubic-bezier(0.34, 1.45, 0.64, 1);  /* Toast, stepper, rolling number */
  --ux-smooth: cubic-bezier(0.2, 0.8, 0.2, 1);     /* Trượt tab, co giãn khung */
  --ux-tactile: cubic-bezier(0.16, 1, 0.3, 1);     /* Hover, active lún nhẹ, nút bấm */
}

:root.dark {
  color-scheme: dark;
}
```

### Quy ước sử dụng nhanh trong Tailwind (`frontend/tailwind.config.js`)
- `ease-tactile` → phản hồi điều khiển nhanh (`150–200ms`).
- `ease-smooth` → chuyển tab, mở drawer (`200–250ms`).
- `ease-spring` → thông báo, badge nảy, step hoàn tất (`250–350ms`).

---

## 3. Bảng Token Màu Thực tế (Light Mode vs Dark Mode)

### 3.1. Màu Thương hiệu & Ngữ nghĩa Quân sự (`tailwind.config.js` & `App.tsx`)

| Token Tailwind / AntD | Light Mode | Dark Mode | Ghi chú sử dụng |
| :--- | :--- | :--- | :--- |
| `military.green` / `colorPrimary` | `#166534` | `#10b981` | Hành động chính, trạng thái hợp lệ. |
| `military.green.hover` / `colorPrimaryHover` | `#14532d` | `#059669` | Trạng thái hover của nút chính. |
| `military.green.active` / `colorPrimaryActive` | `#15803d` | `#047857` | Trạng thái nhấn xuống (`:active`). |
| `military.green.darkText` / `colorLink` | `#166534` | `#34d399` | Liên kết văn bản, text nổi bật xanh quân đội. |
| `military.gold` | `#d97706` (`light: #b45309`) | `#fbbf24` (`darkHover: #f59e0b`) | Trạng thái chờ duyệt, cảnh báo mức Warning, Cấp 3 Mật. |
| `military.gold_accent` | `#d4af37` | `#d4af37` | Viền vàng quân hiệu, thanh cuộn hover. |
| `military.red` | `#b91c1c` / `#dc2626` | `#f87171` | Cảnh báo Critical, xóa vĩnh viễn, Cấp 5 Tuyệt Mật. |
| `navy.900` / `navy.950` | `#0b1b29` / `#061019` | `#0b1b29` / `#061019` | Nền tương phản đậm cho thành phần đặc thù. |

### 3.2. Bề mặt & Đường viền (`App.tsx` ConfigProvider)

| Vai trò Token | Light Mode (`defaultAlgorithm`) | Dark Mode (`darkAlgorithm`) |
| :--- | :--- | :--- |
| `colorBgBase` (Nền gốc) | `#f8fafc` *(body CSS: `#e2e8f0`)* | `#090e17` |
| `colorBgContainer` (Card, Table, Input) | `#ffffff` | `#111827` |
| `colorBgElevated` (Dropdown, Popover) | `#ffffff` | `#1e293b` |
| `Table.headerBg` | `#f8fafc` | `#0f172a` |
| `Table.rowHoverBg` | `rgba(22, 101, 52, 0.06)` | `rgba(16, 185, 129, 0.12)` |
| `colorBorder` | `#e2e8f0` *(Input/Select: `#cbd5e1`)* | `rgba(16, 185, 129, 0.2)` *(Input/Select: `0.3`)* |
| `colorBorderSecondary` | `#f1f5f9` | `rgba(255, 255, 255, 0.08)` |
| `colorTextBase` / `colorTextSecondary` | `#0f172a` / `#64748b` | `#f1f5f9` / `#94a3b8` |

---

## 4. Đồng bộ Hình khối & Kích thước (`App.tsx`)

| Thuộc tính | Giá trị chuẩn | Thành phần áp dụng |
| :--- | :--- | :--- |
| `controlHeight` | `38px` (PC) / `≥44px` (iPad touch target) | `Button`, `Input`, `Select`, `TreeSelect`. |
| `borderRadiusSM` | `6px` | `Tag`, chip trạng thái, badge nhỏ. |
| `borderRadius` | `8px` | `Button`, `Input`, `Select`, `Table`. |
| `borderRadiusLG` | `12px` | `Card`, `Modal`, `TreeSelect`. |

---

## 5. Danh sách Nợ Kỹ thuật CSS Hiện hữu (Technical Debt Tracker)

Trong quá trình rà soát mã nguồn `frontend/src/index.css`, các kỹ sư ghi nhận những điểm tồn đọng từ giai đoạn phát triển trước để **xử lý dần có kiểm soát** (không sửa ồ ạt một lần để tránh hồi quy giao diện đang chạy ổn định):

1. **Rule `!important` ép font chữ toàn cục (`frontend/src/index.css` dòng 24–41):** Cưỡng chế `Be Vietnam Pro !important` và `JetBrains Mono !important` làm giảm linh hoạt khi tích hợp SVG hoặc thành phần đặc biệt. Khi đụng tới trang mới, ưu tiên dùng class Tailwind `font-sans` / `font-mono tabular-nums` thay vì thêm `!important`.
2. **Các lớp gradient nút cũ (`.gold-gradient-btn`, `.emerald-gradient-btn` tại dòng 134–163):** Mang phong cách gradient thời kỳ đầu. Khi thiết kế nút mới, **ưu tiên dùng màu phẳng sắc nét** từ Ant Design `ConfigProvider` hoặc lớp Tailwind đơn sắc (`bg-military-green hover:bg-military-green-hover`), giữ độ lún nhẹ `active:scale-[0.98]`.
3. **Khối adapter Light Mode dài trong `frontend/src/index.css` (từ dòng 246 trở đi):** Ghi đè thủ công các lớp `bg-slate-900` / `text-slate-100` khi không có `.dark`. Khi viết component mới, **bắt buộc khai báo cặp class Light/Dark tường minh ngay trên JSX** (vd: `bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-white/10`) để không phụ thuộc vào override gián tiếp.
4. **Hợp nhất biến CSS cục bộ ở các component con:** Một số file CSS riêng (`ApprovalStepper.css`, `AIThinkingBubble.css`) tự định nghĩa `--ux-surface`, `--ux-accent` riêng. Khi bảo trì dài hạn, từng bước quy chiếu về một bảng biến thống nhất tại `:root`.
