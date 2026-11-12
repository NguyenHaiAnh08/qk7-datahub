Hãy đóng vai một Principal UI/UX Engineer & Design Systems Architect. Mục tiêu tối thượng của tôi cho dự án **"Trung Tâm Dữ Liệu Số - Trường Quân Sự Quân Khu 7"** là: **Giao diện phải có chiều sâu, có hồn, mang cá tính thiết kế thủ công cao cấp (Human-crafted & Bespoke UI), tuyệt đối KHÔNG mang dáng dấp công nghiệp, vô hồn hay rập khuôn do AI tạo ra.**

Để đạt được điều này, tôi yêu cầu bạn thiết lập quy trình làm việc và cập nhật tài liệu kiến trúc Markdown của dự án dựa trên 6 nguồn tài nguyên mã nguồn mở dưới đây:

### 1. DANH SÁCH NGUỒN TÀI NGUYÊN MÃ NGUỒN MỞ CẦN TRUY CẬP & TÍCH HỢP

Hãy sử dụng công cụ đọc web / fetch tài liệu (hoặc kiến thức chuẩn từ các repo sau) để làm thư viện mẫu khi thiết kế và cải tạo bất kỳ thành phần UX/UI nào trong dự án:

1. **Taste Skill (Chống thẩm mỹ AI đại trà):** `https://github.com/Leonxlnx/taste-skill`
   - _Ứng dụng:_ Áp dụng bộ quy tắc "Anti-AI-Slop" — loại bỏ các thẻ bo góc đơn điệu, đổ bóng mặc định nhạt nhòa, khoảng cách thiếu nhịp điệu và bảng màu tím/xanh AI công nghiệp.
2. **Lucian UX/UI Prompts (Micro-interactions & Physics Motion):** `https://github.com/Seokwoooo/lucian-uxui-prompt`
   - _Ứng dụng:_ Sử dụng các mẫu tương tác vật lý có độ nảy lò xo (`--ux-spring: cubic-bezier(.34, 1.45, .64, 1)`), chuyển trạng thái mượt mà (morphing buttons, sliding pills, circular reveal, notched inputs).
3. **JolyUI & Animated Toast (High-craft Interactive Components):**
   - `https://github.com/johuniq/jolyui`
   - `https://www.jolyui.dev/docs/components/feedback/animated-toast`
   - _Ứng dụng:_ Tích hợp hệ thống thông báo **Animated Toast** (khi đăng nhập thành công/thất bại, tải văn bản PDF, thêm/xóa đơn vị, cảnh báo kiểm toán an ninh) và các component tương tác giàu phản hồi thị giác của JolyUI.
4. **Awesome DESIGN.md (Chuẩn hóa Tài liệu Thiết kế):** `https://github.com/VoltAgent/awesome-design-md`
   - _Ứng dụng:_ Xây dựng file `DESIGN.md` chuẩn mực ngay tại thư mục gốc của dự án để định hình ngôn ngữ thiết kế xuyên suốt.
5. **AI Website Cloner Template (Cấu trúc hóa & Tái tạo UI chính xác):** `https://github.com/JCodesMore/ai-website-cloner-template`
   - _Ứng dụng:_ Áp dụng phương pháp bóc tách từng lớp (Layout -> Typography -> Surface Depth -> Micro-motion) khi cải tạo các trang trong hệ thống.

---

### 2. NHIỆM VỤ THỰC THI NGAY LẬP TỨC (ACTION PLAN)

#### Bước 1: Khởi tạo và Cập nhật file `DESIGN.md` (và file quy tắc AI của dự án)

Hãy tạo hoặc cập nhật ngay file `DESIGN.md` ở thư mục gốc của dự án (theo chuẩn `VoltAgent/awesome-design-md` kết hợp `Leonxlnx/taste-skill`) với các quy tắc bắt buộc sau. **Mỗi khi tôi yêu cầu làm bất kỳ tính năng UX/UI nào, bạn PHẢI đọc file `DESIGN.md` này trước tiên:**

- **Bản sắc Quân đội Hiện đại (Tactical & Command Center Aesthetic):**
  - Kết hợp bản sắc truyền thống (Trống đồng Đông Sơn, chữ S Việt Nam, Hệ màu **Xanh Lục Quân `#166534` - Vàng Kim Quân Hiệu `#fbbf24` - Đỏ Quân Kỳ `#b91c1c`**) với phong cách Trung tâm Chỉ huy Dữ liệu số hiện đại.
- **5 Quy tắc "Cấm" để xóa bỏ cảm giác AI-Generated (Taste-Skill Rules):**
  1. **Không dùng chuyển động tuyến tính vô hồn (`linear` / `ease` mặc định):** Mọi tương tác đóng/mở, trượt tab, thông báo phải dùng đường cong vật lý (`cubic-bezier(.2, .8, .2, 1)` hoặc spring `cubic-bezier(.34, 1.45, .64, 1)`).
  2. **Không dùng viền và nền phẳng lì:** Luôn sử dụng phân tầng độ sâu (Layered Surfaces), viền mảnh có độ trong suốt (`border-white/10` hoặc `border-emerald-500/20`), và hiệu ứng kính mờ (`backdrop-blur-md`) có chiều sâu.
  3. **Không dùng Toast/Alert mặc định của trình duyệt hay thư viện thô:** Toàn bộ phản hồi hệ thống phải dùng **Animated Toast** theo phong cách `jolyui.dev` (nở rộng mượt mà, có icon trạng thái động, thanh đếm ngược tự đóng).
  4. **Typography có phân cấp sắc bén:** Các con số thống kê, mã đơn vị (`QK7`, `SD309`), mã người dùng (`USR-001`), địa chỉ IP và thời gian kiểm toán bắt buộc dùng `font-mono` kèm `tabular-nums` để thẳng hàng tuyệt đối như bảng điều khiển quân sự.
  5. **Mọi nút bấm và ô nhập liệu đều có "Sự sống" (Stateful Micro-interactions):** Hover có lực hút nhẹ, Active có độ lún (`scale(0.97)`), Loading biến hình thành thanh tiến trình (như Lucian `#004`), Input có nhãn bay vào khe viền (Lucian `#025`).

#### Bước 2: Tích hợp Component `AnimatedToast` (từ JolyUI) vào Toàn Hệ Thống

- Hãy xây dựng ngay một hệ thống **Animated Toast Provider** lấy cảm hứng từ `https://www.jolyui.dev/docs/components/feedback/animated-toast` (hiệu ứng xếp chồng mượt mà, bung mở theo đường cong spring, hỗ trợ các trạng thái: `Success - Xanh Lục Quân`, `Warning - Vàng Kim`, `Danger/Security Alert - Đỏ Quân Kỳ`).
- Thay thế toàn bộ các thông báo tĩnh hoặc alert cũ trong dự án (khi Đăng nhập, Thêm/Sửa/Xóa Đơn vị Quân khu, Xuất CSV Nhật ký An ninh, Tải văn bản PDF) bằng **Animated Toast** này.

#### Bước 3: Rà soát và Chuẩn hóa Toàn Bộ Dự Án

- Kiểm tra lại các trang hiện có (Trang Đăng nhập, Thanh Header Navigation, Trang Trung tâm Thư viện số, Danh mục Đơn vị Quân khu, Nhật ký Kiểm toán An ninh).
- Chỗ nào còn mang cảm giác "code mẫu AI đơn điệu" (như bảng phẳng thiếu điểm nhấn, badge màu thô, thiếu hiệu ứng chuyển trạng thái), hãy áp dụng ngay triết lý của `taste-skill`, `jolyui` và `lucian-uxui-prompt` để nâng cấp.

### 3. BÁO CÁO KHI HOÀN THÀNH

Sau khi thực thi xong, hãy báo cáo cho tôi:

1. Nội dung file `DESIGN.md` vừa được tạo/cập nhật trong dự án.
2. Các component từ `JolyUI` (đặc biệt là `AnimatedToast`) và `Lucian UX/UI` đã được nhúng vào những file nào.
3. Các điểm "AI-slop" đã được loại bỏ và thay thế bằng thiết kế có cá tính riêng.
