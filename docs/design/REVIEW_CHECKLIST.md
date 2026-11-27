# Bảng Kiểm duyệt Chất lượng UX/UI Trước Bàn giao (`REVIEW_CHECKLIST.md`)

Mọi thay đổi liên quan đến giao diện trong `frontend/src/` phải vượt qua đầy đủ 4 nhóm chốt chặn dưới đây trước khi báo cáo hoàn thành cho USER.

---

## 1. Chốt chặn 1 — Kiểm tra Chống "AI-Slop" (10 Tiêu chí Khách quan)

- [ ] **Không sót màu tím AI (`#722ED1`, violet, indigo) hoặc bảng màu lệch hệ Triad Quân đội** (`#166534` / `#10b981`, `#d97706` / `#fbbf24`, `#b91c1c` / `#f87171`).
- [ ] **Không dùng gradient cầu vồng hay viền phát sáng neon** trên thẻ dữ liệu, bảng thống kê hoặc nút nghiệp vụ.
- [ ] **Không lạm dụng kính mờ (`backdrop-blur`)** trên danh sách, bảng dài hoặc khung đọc tài liệu (chỉ dùng ở modal/drawer/popover nổi).
- [ ] **Không dùng chuỗi thẻ icon lặp khung kiểu landing page** trong màn hình vận hành (`Operate Mode`).
- [ ] **Không lạm dụng emoji trang trí** trong tiêu đề bảng, nhãn nút hay cảnh báo an ninh (dùng biểu tượng nhất quán từ `lucide-react` hoặc `@ant-design/icons`).
- [ ] **Đủ 7 trạng thái cho thành phần tương tác:** `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error`.
- [ ] **Số liệu & Mã quân sự thẳng hàng:** Mọi KPI, mã văn bản, mã đơn vị, IP, timestamp, SHA-256 đều dùng `font-mono tabular-nums`.
- [ ] **Ngôn ngữ tiếng Việt chuẩn hành chính-quân sự:** Ngắn gọn, tự nhiên, không văn phong dịch máy, đúng thuật ngữ QK7 DataHub.
- [ ] **Thống nhất bo góc (`6px` / `8px` / `12px`)** theo `App.tsx ConfigProvider`, không trộn lẫn các bán kính ngẫu nhiên.
- [ ] **Kỷ luật chuyển động (`150–250ms` cho thao tác thường):** Không có hiệu ứng tự chạy cản trở thao tác vào trang hoặc `transition: linear`.

---

## 2. Chốt chặn 2 — Đa nền tảng, Responsive & Zoom-Proof

- [ ] **Desktop PC Widescreen (`1920×1080`, `1440×900`, `1280×720`):** Bố cục tận dụng chiều ngang hợp lý, không tràn thanh cuộn ngang bất thường.
- [ ] **iPad Air M4 Landscape (`1210×802`) & Portrait (`834×1178`):** Không tràn khung, nút bấm và mục điều hướng có vùng chạm tối thiểu `44×44px`.
- [ ] **Tách bạch `DeviceModeContext`:** Không trộn hành vi PC (nút công cụ phản hồi 0ms) vào nhánh iPad (`Segmented Pill Glider`).
- [ ] **Header 3 tầng (`≥1536px` / `1280–1535px` / `<1280px`):** Cụm `DeviceModeSwitch`, `ThemeToggle`, User Profile luôn giữ `shrink-0 whitespace-nowrap`, không bị rớt dòng hay che khuất.
- [ ] **Kiểm thử thu phóng (`100%`, `125–150%`, `175–200%`):** Chữ không chồng lên nút bấm, modal không bị tràn khỏi khung nhìn.

---

## 3. Chốt chặn 3 — Light Mode / Dark Mode & Trợ năng (Accessibility)

- [ ] **Light Mode (mặc định) & Dark Mode:** Chuyển qua lại mượt mà bằng `ThemeToggle`, không sót chữ trắng trên nền trắng hay chữ đen trên nền tối.
- [ ] **Tương phản WCAG AA:** Văn bản thường đạt tối thiểu `4.5:1`; chữ lớn và viền input/button đạt tối thiểu `3:1`.
- [ ] **Bàn phím & Focus:** Di chuyển qua toàn bộ form, bảng, modal được bằng phím `Tab` / `Shift+Tab` / `Enter` / `Escape`; vòng `:focus-visible` hiển thị rõ ràng.
- [ ] **Giảm chuyển động:** Bật `prefers-reduced-motion: reduce` không gây lỗi hiển thị hoặc mất nội dung.

---

## 4. Chốt chặn 4 — Bảo mật Giao diện & Kiểm định Build

- [ ] **Đủ 3 tầng bảo mật:** Màn hình mới/sửa đi qua `routeAccess.ts` Guard, giữ nguyên `X-Fingerprint-Token` và Portal cho modal quét vân tay Cấp 3–5.
- [ ] **Không lộ đường dẫn vật lý:** Tài liệu PDF luôn tải qua `/api/files/:fileId/view`, không trỏ trực tiếp vào `uploads/`.
- [ ] **Nếu có thành phần chuyển hóa từ `uiverse-galaxy`:** Không chứa URL ngoài, không reset CSS toàn cục, có ghi chú bản quyền MIT.
- [ ] **Kiểm định kỹ thuật bắt buộc:**
  ```bash
  cd frontend && npm run build
  ```
  Biên dịch TypeScript (`tsc`) và Vite đóng gói sạch `0` lỗi trước khi bàn giao.
