---
name: thiet-ke-ux-ui
description: Workflow điều phối tự động toàn bộ 7 skill thiết kế UX/UI cho QK7 DataHub
triggers:
  - "/thiet-ke-ux-ui"
  - "/qk7-design-orchestrator"
  - "thiết kế"
  - "design"
  - "giao diện"
  - "UI/UX"
---

# WORKFLOW: ĐIỀU PHỐI THIẾT KẾ UX/UI QK7 DATAHUB (`qk7-design-orchestrator`)

Khi có bất kỳ yêu cầu thiết kế, chỉnh sửa layout, thêm component hoặc tối ưu UI/UX, Agent tự động kích hoạt tuần tự 6 bước sau:

## BƯỚC 1: ĐỌC & TRÍCH XUẤT TOKEN QUÂN ĐỘI (`design-md`)
- Đọc `docs/design/DESIGN.md`.
- Trích xuất Triad Military Colors:
  - Primary: Xanh Lục Quân (`#166534` Light • `#10b981` Dark)
  - Secondary: Vàng Kim Quân Hiệu & Đồng Cổ (`#d97706` Light • `#fbbf24` Dark)
  - Accent/Alert: Đỏ Quân Kỳ (`#b91c1c` Light • `#f87171` Dark)
- Typography: `Be Vietnam Pro` (văn bản) + `JetBrains Mono` (`font-mono tabular-nums`).

## BƯỚC 2: TẠO DESIGN SYSTEM & ART DIRECTION (`ui-ux-pro-max` + `design-taste-frontend`)
- Chạy: `python .agents/skills/ui-ux-pro-max/scripts/search.py "<loại màn hình>"` để lấy style & pattern.
- Đọc: `.agents/skills/design-taste-frontend/references/app-screens.md` & chạy `scripts/draw.mjs` nếu cần deal direction.
- Hợp nhất: Giữ bảng màu Quân đội (B1), áp dụng composition của `design-taste-frontend` và checklist của `ui-ux-pro-max`.

## BƯỚC 3: SINH CONCEPT & PROTOTYPE (`huashu-design`)
- Đề xuất 2–3 hướng concept thị giác (Mật độ cao / Tối giản chỉ huy / Dòng thời gian).
- Chốt concept trực quan trước khi viết code.

## BƯỚC 4: TRIỂN KHAI COMPONENT (`daub-ui` + `sketchbook-ui` reference)
- Tham chiếu mẫu component gọn nhẹ từ `daub-ui` (`db-*` pattern).
- Tham chiếu `.design-references/sketchbook-ui/` nếu cần phong cách hand-drawn/bản vẽ kỹ thuật quân sự.
- Kiểm soát tương thích Dual-Platform: PC Widescreen & iPad Air M4 Touch UI.

## BƯỚC 5: AUDIT & DIỆT SẠCH "AI-SLOP" (`unslop` + `design-taste-frontend` inspector)
- Chạy checklist `unslop` 9 lượt (diệt purple gradients, glossy blobs, emoji tags, copy sáo rỗng).
- Chạy `design-taste-frontend` inspector & linter: `node .agents/skills/design-taste-frontend/scripts/lint.mjs`. Sửa mọi `FAIL`.
- Ưu tiên `design-taste-frontend` nếu có xung đột thẩm mỹ.

## BƯỚC 6: XUẤT BÁO CÁO TỔNG HỢP
Xuất báo cáo 5 phần:
1. Bảng đóng góp 7 skill
2. Direction đã chọn & lý do
3. Danh sách FAIL/WARN đã xử lý
4. Trạng thái Dual-Platform
5. Điểm cần người dùng xác nhận

