---
name: qk7-design-orchestrator
description: >-
  Điều phối toàn bộ skill thiết kế UX/UI của QK7 DataHub. Khi có bất kỳ yêu cầu thiết kế,
  sửa giao diện, thêm component hoặc tối ưu UX/UI, skill này BẮT BUỘC kích hoạt và phân bổ
  nhiệm vụ cho tất cả skill con theo đúng thứ tự (B1-B6). Không được bỏ qua bất kỳ skill nào.
triggers:
  - "thiết kế"
  - "design"
  - "giao diện"
  - "UI"
  - "UX"
  - "component"
  - "layout"
  - "style"
  - "redesign"
  - "landing page"
  - "dashboard"
  - "app screen"
---

# QK7 Design Orchestrator · Nhạc Trưởng Thiết Kế UX/UI Toàn Diện QK7 DataHub

> **VAI TRÒ:** Điều phối viên cấp cao chịu trách nhiệm huy động toàn bộ 7 năng lực thiết kế trong dự án QK7 DataHub: `design-md`, `ui-ux-pro-max`, `design-taste-frontend` (taste-skill), `huashu-design`, `daub-ui`, `sketchbook-ui` (reference) và `unslop`.
> **MỤC TIÊU:** Đảm bảo mọi giao diện được tạo ra đạt chuẩn thẩm mỹ cao cấp, chống AI-slop, tuân thủ nghiêm ngặt bản sắc Quân đội Nhân dân Việt Nam và hoạt động ổn định trên cả PC Widescreen & iPad Air M4.

---

## 🗺️ Bản Đồ Năng Lực & Vị Trí Kỹ Thuật Các Skill

| Skill | Vị Trí Trong Dự Án | Năng Lực Cốt Lõi | Công Cụ / Script Khả Dụng |
| :--- | :--- | :--- | :--- |
| **`design-md`** | `.agents/skills/design-md/` & `docs/design/DESIGN.md` | Quản lý token, màu sắc, typography và chuẩn mực hệ thống | Đọc trực tiếp `docs/design/DESIGN.md` |
| **`ui-ux-pro-max`** | `.agents/skills/ui-ux-pro-max/` | 161 quy tắc UX, 67 style, 57 font pair, 161 palette | `python .agents/skills/ui-ux-pro-max/scripts/search.py "<query>"`<br>`python .agents/skills/ui-ux-pro-max/scripts/design_system.py "<query>"` |
| **`design-taste-frontend`** | `.agents/skills/design-taste-frontend/` | Art direction từ 247 curated sites, no-slop house style, real-browser inspector | `node .agents/skills/design-taste-frontend/scripts/draw.mjs`<br>`node .agents/skills/design-taste-frontend/scripts/inspect.mjs`<br>`node .agents/skills/design-taste-frontend/scripts/lint.mjs` |
| **`huashu-design`** | `.agents/skills/huashu-design/` | Sinh 2–3 hướng concept thị giác, mockup, animation | Đọc hướng dẫn tại `.agents/skills/huashu-design/SKILL.md` |
| **`daub-ui`** | `.agents/skills/daub-ui/` | 91 component HTML/CSS/JS (`db-*`), theme tokens, verify loop | Đọc tham chiếu class tại `.agents/skills/daub-ui/` |
| **`sketchbook-ui`** | `.design-references/sketchbook-ui/` | Tham chiếu component React vẽ tay (hand-drawn), viền hữu cơ | Đọc file `.tsx`/`.css` trong `.design-references/sketchbook-ui/` |
| **`unslop`** | `.agents/skills/unslop/` | Audit & diệt sạch AI-slop 9 lượt (spacing, color, icons, copy, type...) | Đọc checklist tại `.agents/skills/unslop/SKILL.md` |

---

## ⚡ Quy Trình 6 Bước Bắt Buộc (Tuần Tự — Không Bỏ Sót)

Mỗi khi nhận yêu cầu thiết kế (trang mới, sửa màn hình, tối ưu component hay tái cấu trúc giao diện), Agent **BẮT BUỘC** thực hiện tuần tự 6 bước sau:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               LUỒNG ĐIỀU PHỐI THIẾT KẾ UX/UI TUẦN TỰ (B1 ➔ B6)                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ BƯỚC 1: ĐỌC DESIGN.md (design-md)                                                      │
│   • Trích xuất Triad Military Colors: Xanh Lục Quân, Vàng Kim, Đỏ Quân Kỳ.            │
│   • Ràng buộc Typography: Be Vietnam Pro + JetBrains Mono (font-mono tabular-nums).    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ BƯỚC 2: TẠO DESIGN SYSTEM & ART DIRECTION (ui-ux-pro-max + taste-skill)                │
│   • ui-ux-pro-max: Chạy search.py/design_system.py lấy style, pattern, anti-patterns.  │
│   • taste-skill: Đọc app-screens.md, chạy draw.mjs chọn composition, blueprint.        │
│   • Hợp nhất: Giữ màu Quân đội, lấy composition từ taste-skill, checklist từ ui-ux.    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ BƯỚC 3: SINH CONCEPT & PROTOTYPE (huashu-design)                                       │
│   • Đề xuất 2–3 hướng concept trực quan dựa trên brief và palette Quân đội.            │
│   • Xác định nhịp điệu thị giác và bố cục sơ bộ trước khi code.                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ BƯỚC 4: TRIỂN KHAI COMPONENT (daub-ui + sketchbook-ui reference)                       │
│   • Chọn pattern component tinh gọn, semantic HTML, CSS chuẩn.                         │
│   • Tham chiếu .design-references/sketchbook-ui nếu cần hiệu ứng hand-drawn đặc thù.  │
│   • Đảm bảo Responsive PC Widescreen & iPad Air M4 Touch UI.                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ BƯỚC 5: AUDIT & SỬA "AI-SLOP" (unslop + taste-skill inspector)                         │
│   • unslop: Audit 9 lượt (diệt purple gradients, glossy blobs, emoji badges, v.v.).   │
│   • taste-skill: Chạy inspect.mjs (1440/768/390px) & lint.mjs, sửa mọi FAIL.           │
│   • Xung đột thẩm mỹ: Ưu tiên taste-skill (House style QK7).                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ BƯỚC 6: XUẤT BÁO CÁO TỔNG HỢP                                                          │
│   • Báo cáo đóng góp của 7 skill, direction đã chọn, FAIL/WARN và điểm chốt xác nhận.  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### BƯỚC 1 — ĐỌC DESIGN.md (`design-md`)
1. Đọc tệp [docs/design/DESIGN.md](../../../docs/design/DESIGN.md) của dự án.
2. Trích xuất chuẩn xác các token bắt buộc:
   * **Primary Color (Xanh Lục Quân):** Light `#166534` (Emerald-800) • Dark `#10b981` (Emerald-500).
   * **Secondary Color (Vàng Kim Quân Hiệu & Đồng Cổ):** Light `#d97706` (Amber-600) • Dark `#fbbf24` (Amber-400).
   * **Accent / Warning / Danger (Đỏ Quân Kỳ):** Light `#b91c1c` (Red-700) • Dark `#f87171` (Red-400).
   * **Typography:** Văn bản chính dùng `Be Vietnam Pro`, số liệu/mã định danh/thời gian dùng `JetBrains Mono` với thuộc tính `font-mono tabular-nums`.
   * **Bề mặt (Surfaces):** Kính mờ quang học nhẹ, hoa văn Trống đồng Đông Sơn mờ ẩn ở nền trang trọng.

### BƯỚC 2 — TẠO DESIGN SYSTEM & ART DIRECTION (`ui-ux-pro-max` + `design-taste-frontend`)
1. **Truy vấn `ui-ux-pro-max`:**
   * Chạy: `python .agents/skills/ui-ux-pro-max/scripts/search.py "<loại màn hình, vd: analytics dashboard, audit log, admin>"`
   * Thu thập: Style được gợi ý (Data-Dense, Drill-Down, Minimalist), checklist UX, lỗi anti-pattern cần tránh.
2. **Khai thác `design-taste-frontend`:**
   * Đọc kỹ `.agents/skills/design-taste-frontend/references/app-screens.md` (đối với ứng dụng quản trị, dashboard, bảng dữ liệu).
   * Chạy: `node .agents/skills/design-taste-frontend/scripts/draw.mjs` nếu cần deal một hướng cấu trúc mới (hero composition, section layout).
3. **Hợp nhất kết quả:**
   * **Màu sắc:** Bắt buộc tuân theo bảng màu Quân đội tại Bước 1 (không dùng palette tím neon hay pastel đại trà của các template nước ngoài).
   * **Bố cục & Cấu trúc:** Kế thừa từ `design-taste-frontend` (khoảng cách dứt khoát, viền mỏng `border-white/10`, không resting shadows).
   * **Checklist & Quy chuẩn tương tác:** Kế thừa từ `ui-ux-pro-max`.

### BƯỚC 3 — SINH CONCEPT & PROTOTYPE (`huashu-design`)
1. Kích hoạt tư duy `huashu-design`: Lập 2–3 phương án thị giác (Visual Direction) cho người dùng/kỹ sư lựa chọn:
   * *Hướng A (Mật độ cao - High Density):* Tối ưu cho chuyên viên SOC, màn hình PC Widescreen nhiều thông số, bảng dữ liệu kèm mini-chart.
   * *Hướng B (Thanh lịch & Trực quan - Clean & Executive):* Phù hợp cho chỉ huy duyệt nhanh trên iPad Air M4, thẻ KPI lớn dùng số đếm cơ học `RollingNumber`.
   * *Hướng C (Dòng thời gian - Timeline Focused):* Nhấn mạnh trình tự sự kiện an ninh, cảnh báo sinh trắc học và lịch sử phân quyền.
2. Chọn hướng tối ưu nhất khớp với yêu cầu và chuyển sang bước code.

### BƯỚC 4 — TRIỂN KHAI COMPONENT (`daub-ui` + `sketchbook-ui` reference)
1. **Triển khai giao diện:**
   * Sử dụng cấu trúc HTML semantic, CSS/Tailwind hoặc Ant Design component có sẵn trong dự án.
   * Tham chiếu bộ component `daub-ui` tại `.agents/skills/daub-ui/` để học hỏi cách viết layout gọn nhẹ, cấu trúc thẻ, trạng thái hover/focus.
2. **Tham chiếu `sketchbook-ui`:**
   * Mở thư mục `.design-references/sketchbook-ui/src/` để tham khảo khi cần phong cách minh họa vẽ tay, viền hữu cơ (organic borders), hoặc ghi chú dạng bản vẽ kỹ thuật quân sự.
   * *Lưu ý:* Chỉ tham khảo logic/style; không import trực tiếp thư viện nếu làm lệch cấu trúc React/AntD hiện hữu của QK7 DataHub.
3. **Đảm bảo Dual-Platform:**
   * PC: Giữ độ phản hồi tức thì 0ms, cụm nút màu sắc dứt khoát.
   * iPad Air M4: Tối ưu vùng chạm `min-h-[44px]`, hỗ trợ vuốt mượt mà.

### BƯỚC 5 — AUDIT VÀ SỬA "AI-SLOP" (`unslop` + `design-taste-frontend` inspector)
1. **Quét 9 lượt theo `unslop`:**
   * Lượt 1 (Spacing): Loại bỏ padding/margin thừa hoặc không nhất quán.
   * Lượt 2 (Color): Xóa sạch gradient tím/hồng neon, card phát sáng (glow) sáo rỗng.
   * Lượt 3 (Icons): Không bọc icon trong các ô vuông đổ bóng lòe loẹt.
   * Lượt 4 (Copy): Bỏ các câu từ hoa mỹ rỗng tuếch kiểu AI ("Elevate your experience...").
   * Lượt 5 (Type): Khóa chặt tỷ lệ kích thước chữ và `tabular-nums` cho số liệu.
   * Lượt 6 (Layout): Phẳng hóa, bỏ các card lồng nhau quá nhiều lớp.
   * Lượt 7 (Details): Bỏ badge "New ✨", chấm sáng pulsing vô nghĩa.
   * Lượt 8 (Visuals): Sử dụng hình ảnh/icon mang tính biểu tượng quân sự thực tế.
   * Lượt 9 (Motion): Chuyển động lò xo dứt khoát, không delay dài.
2. **Kiểm tra với `design-taste-frontend`:**
   * Chạy: `node .agents/skills/design-taste-frontend/scripts/lint.mjs`
   * Sửa toàn bộ lỗi `FAIL`. Các cảnh báo `WARN` phải có giải trình hợp lý.
3. **Giải quyết xung đột:** Nếu `unslop` và `design-taste-frontend` mâu thuẫn về một chi tiết giao diện, **luôn ưu tiên quy tắc của `design-taste-frontend`** (vì đã được bản địa hóa riêng cho QK7 DataHub).

### BƯỚC 6 — XUẤT BÁO CÁO TỔNG HỢP (DELIVERABLE REPORT)
Mỗi tác vụ hoàn tất phải đi kèm báo cáo ngắn gọn gồm 5 mục:
1. **Bảng tổng hợp đóng góp của các skill:** Liệt kê cụ thể từng skill trong số 7 skill đã tham gia và tạo giá trị gì.
2. **Art Direction & Lý do lựa chọn:** Nêu rõ phong cách đã chốt từ Bước 2 & 3.
3. **Kết quả Audit AI-Slop & Inspector:** Danh sách lỗi đã quét và sửa sạch.
4. **Trạng thái Dual-Platform:** Xác nhận giao diện hoạt động tốt trên cả PC (1440px+) và iPad (834px/1210px).
5. **Điểm cần con người phê duyệt:** Văn bản mẫu, hình ảnh huy hiệu, quyền hạn truy cập nếu có.

---

## 🔒 Quy Tắc Cứng Bắt Buộc (Strict Invariants)

1. **Tuyệt đối không bỏ sót skill:** Trong cả 6 bước, tất cả các skill đều phải được gọi hoặc tham chiếu theo chức năng tương ứng. Nếu một skill không áp dụng được (ví dụ brief không cần hand-drawn từ `sketchbook-ui`), phải nêu rõ lý do trong báo cáo Bước 6.
2. **Nguồn gốc truy vết (Traceability):** Mọi mã màu HEX, kiểu font, bán kính bo góc và khoảng cách spacing phải truy vết được về `docs/design/DESIGN.md` hoặc output của `ui-ux-pro-max` / `design-taste-frontend`.
3. **Phân cấp bảo mật tài liệu:** Nếu màn hình liên quan đến văn bản Mật (Cấp 3–5), giao diện bắt buộc phải có vị trí hiển thị Huy hiệu Độ Mật (5 cấp) và khu vực kích hoạt xác thực sinh trắc học vân tay 2FA.

