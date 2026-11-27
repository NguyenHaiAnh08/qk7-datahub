# Hệ thống Tài liệu Thiết kế UX/UI — QK7 DataHub

Bộ tài liệu kỹ thuật định chuẩn giao diện cho **Trung tâm Dữ liệu Số — Trường Quân sự Quân khu 7**, do Khối Thiết kế và Kỹ sư Frontend xây dựng dựa trên mã nguồn thực tế (`React 18 + TypeScript + Ant Design v6 + Tailwind CSS v3`).

---

## 1. Bản đồ Tài liệu: Cần làm gì → Đọc file nào

| Tệp tài liệu | Mục đích cốt lõi | Đọc khi nào |
| :--- | :--- | :--- |
| **[DESIGN.md](./DESIGN.md)** | Đặc tả hệ thống thiết kế lõi (Single Source of Truth): chế độ vận hành Operate/Read, hệ màu Quân đội + 5 cấp độ mật, typography, bố cục Dual-Platform PC/iPad, bề mặt và danh mục component thực tế. | Bắt buộc đọc **trước mọi tác vụ** chạm tới giao diện hoặc màn hình mới. |
| **[TOKENS.md](./TOKENS.md)** | Bảng mã màu, font chữ, bo góc, biến CSS (`--ux-*`), cấu hình `ConfigProvider` của Ant Design v6, quy ước Light/Dark và danh sách nợ kỹ thuật CSS hiện hữu. | Khi thêm biến style, chỉnh theme Dark/Light, cấu hình Ant Design hoặc Tailwind. |
| **[COMPONENTS_AND_PATTERNS.md](./COMPONENTS_AND_PATTERNS.md)** | Mẫu tương tác nghiệp vụ chuẩn (bảng dữ liệu mật độ cao, luồng 2FA vân tay ZKTeco, form, empty/loading/error state, UX copywriting tiếng Việt) và quy chế khai thác nhân sự `uiverse-galaxy`. | Khi dựng màn hình nghiệp vụ, form nhập liệu, luồng bảo mật hoặc chuyển hóa vi thành phần từ kho Uiverse. |
| **[REVIEW_CHECKLIST.md](./REVIEW_CHECKLIST.md)** | Danh sách kiểm duyệt chất lượng trước khi bàn giao: loại bỏ dấu vết AI-slop, kiểm tra PC/iPad & zoom, tương phản WCAG AA, bảo mật 3 tầng và build sạch. | Bắt buộc đối chiếu **trước khi báo cáo hoàn thành** bất kỳ thay đổi UI/UX nào. |
| **[archive/](./archive/)** | Lưu trữ lịch sử các bản prompt AI và tài liệu thời kỳ đầu (`legacy-tasteskill-v2.md`, `legacy-ai-prompt-v1.md`). | Chỉ tra cứu lịch sử; **không sử dụng** để phát triển tính năng mới. |

---

## 2. Tuyên ngôn Chuyển dịch: Từ UI "AI Dựng" sang UI Kỹ sư Con người

Các tài liệu thiết kế thời kỳ đầu được sinh từ prompt tổng quát, dẫn tới những biểu hiện giao diện công nghiệp dễ nhận ra: lạm dụng kính mờ (`backdrop-blur`), bóng phát sáng neon, gradient nhiều lớp, thẻ thống kê lặp khung vô nghĩa, chuyển động phô trương làm chậm thao tác hành chính và mâu thuẫn giữa các bản mô tả.

Hệ thống thiết kế mới xác lập **5 nguyên tắc kỹ thuật của kỹ sư sản phẩm**:

1. **Rõ ràng và tin cậy thay vì phô trương:** 90% màn hình của QK7 DataHub là phần mềm nghiệp vụ (`Operate Mode`), nơi cán bộ, giảng viên và kíp trực SOC cần đọc nhanh, lọc chính xác và thao tác không nhầm lẫn. Giao diện phải đứng sau công việc.
2. **Độ sâu bằng sắc độ nền (Solid Tonal Layering First):** Phân tách cấp bậc nội dung bằng chênh lệch sắc độ giữa nền tổng, panel và thẻ nổi kèm viền `1px` sắc nét; chỉ dùng `backdrop-blur` cho lớp phủ thực sự nổi (modal xác thực, drawer, popover).
3. **Thống nhất ngôn ngữ điều khiển:** Một hệ thống `button`, `input`, `select`, `table` và `pagination` dùng chung cấu hình từ `Ant Design ConfigProvider` (`frontend/src/App.tsx`) và `frontend/src/components/common/`. Không tự chế hai kiểu nút "Lưu" khác nhau ở hai trang.
4. **Đầy đủ 7 trạng thái cho mọi thành phần tương tác:** Không chỉ thiết kế trạng thái tĩnh (`default`); bắt buộc hoàn thiện cả `hover`, `focus-visible`, `active`, `disabled`, `loading` và `error`.
5. **Tách bạch hai nền tảng sử dụng thật:** Desktop PC ưu tiên mật độ thông tin và phản hồi chuột/phím tức thì; iPad Air M4 (`DeviceModeContext`) ưu tiên vùng chạm tối thiểu `44×44px`, thanh chuyển chạm và khả năng chịu phóng to tới `200%`.

---

## 3. Cơ cấu Khối Thiết kế & Phân vai Phối hợp

| Nhân sự (Agent Skill) | Vai trò chuyên trách | Tham gia ở bước nào |
| :--- | :--- | :--- |
| **`impeccable`** | Phê bình thiết kế (`critique`), kiểm toán kỹ thuật (`audit`), tinh chỉnh chi tiết (`polish`) theo chuẩn `Operate/Read`. | Rà soát định hướng và nghiệm thu giao diện. |
| **`baoyu-design`** | Định hướng bố cục trực quan, vẽ sơ đồ kiến trúc và khung màn hình trước khi lập trình. | Thiết kế cấu trúc màn hình mới hoặc tái bố cục. |
| **`uiverse-galaxy`** | Chuyên viên vi thành phần UI (`3,802` mẫu HTML/CSS/Tailwind offline tại `.agents/skills/uiverse-galaxy/`). Sàng lọc và chuyển hóa nút, input, switch, checkbox, tooltip, loader sang token QK7. | Khi cần nâng cấp vi tương tác hoặc tạo control chuyên biệt. |
| **`daub-ui` & `ui-ux-pro-max`** | Kho tham chiếu bố cục và hệ thống thành phần mở rộng. | Đối chiếu mẫu layout đa cột, dashboard, bảng. |
| **`humanizer` & `gentle-ai`** | Chuẩn hóa câu chữ giao diện tiếng Việt hành chính-quân sự ngắn gọn, tự nhiên; giữ tài liệu ít tải nhận thức. | Viết nhãn UI, thông báo lỗi, hướng dẫn trống, tài liệu. |
| **`senior-frontend`** | Hiện thực hóa bằng React 18 + TypeScript + Ant Design v6 + Tailwind CSS v3, bảo vệ `routeAccess.ts` và Dual-Platform. | Lập trình, tích hợp và kiểm tra `npm run build`. |

---

## 4. Quy trình Kỹ thuật 5 Giai đoạn Khi Triển khai Giao diện

1. **Xác định nghiệp vụ & Cấp độ mật:** Gắn tính năng vào đúng cấp mật (Cấp 1–5), kiểm tra chế độ `Operate` hay `Read`, đối chiếu quyền tại `routeAccess.ts`.
2. **Chọn chuẩn bố cục & Token:** Đọc `DESIGN.md` + `TOKENS.md`, chọn thành phần tái sử dụng sẵn trong `frontend/src/components/common/` hoặc tra cứu mẫu bổ sung qua `uiverse-galaxy`.
3. **Hiện thực hóa & Chuẩn hóa ngôn ngữ:** Viết code React/TS bám sát `ConfigProvider` của `App.tsx`, hoàn thiện đủ 7 trạng thái tương tác và câu chữ tiếng Việt tự nhiên.
4. **Tự kiểm duyệt theo `REVIEW_CHECKLIST.md`:** Kiểm tra PC (`1920×1080`, `1280×720`), iPad Landscape/Portrait, Light Mode (mặc định) & Dark Mode, bàn phím `Tab`, và luồng 2FA vân tay nếu chạm tài liệu Cấp 3–5.
5. **Kiểm tra Build & Tuân thủ:** Chạy `cd frontend && npm run build` (0 lỗi TypeScript/Vite), xác nhận không đổi API contract và giữ nguyên bảo mật 3 tầng.
