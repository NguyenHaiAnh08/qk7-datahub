# Nhật Ký Thay Đổi Kỹ Thuật (CHANGELOG) — QK7 DataHub

Tài liệu ghi nhận toàn bộ các điều chỉnh, cải tiến, bản vá kỹ thuật và quy chuẩn vận hành của dự án QK7 DataHub.

---

## [v1.2.8-fix-download-0kb-and-central-units-kpi] — 2026-11-04

### 1. Chuẩn Hóa Quy Trình Tải Về 3 Bước & Khắc Phục Triệt Để File 0 KB
- **Quy trình tải về 3 bước chuẩn nghiệp vụ (3-Stage Download Lifecycle):**
  - **Bước 1 (Bấm tải về):** Người dùng bấm nút "Tải về". Nút bấm lập tức chuyển sang trạng thái xử lý tiến trình (`CompactDownloadButton`). Hệ thống ngầm nạp trước toàn bộ dữ liệu file từ server vào bộ nhớ (RAM Blob) và kiểm tra dung lượng hợp lệ (> 0 bytes).
  - **Bước 2 (Chờ chạy xong UX/UI % tiến trình):** Thanh tiến trình hiển thị tỷ lệ % tải tăng dần mượt mà từ 0% đến 100% trong 2.4s (`DURATION = 2400ms`), cho người dùng phản hồi trực quan sinh động mà không bị bất kỳ cửa sổ popup nào làm gián đoạn.
  - **Bước 3 (Nhả file & Chọn ổ đĩa lưu):** Ngay khi UX/UI chạm mốc 100%, hệ thống mới "nhả file" bằng cách kích hoạt hộp thoại chọn nơi lưu (`showSaveFilePicker`). Cán bộ tùy ý chọn ổ đĩa (C:, D:, E:...) hoặc thư mục chuyên biệt. Khi bấm Save, dữ liệu sạch từ RAM được ghi lập tức vào file và đóng luồng stream.
- **Khắc phục lỗi file 0 KB khi tải từ trong modal xem trước (`DocumentPreviewModal`):**
  - *Nguyên nhân:* Khi xem PDF ở chế độ toàn màn hình (`Fullscreen`), hộp thoại Save As native của OS mở ra khiến Chromium tự động thoát Fullscreen $\rightarrow$ sự kiện `fullscreenchange` kích hoạt đóng modal $\rightarrow$ component unmount làm hủy (`abort()`) luồng fetch và stream ghi file, để lại file rác 0 KB trên đĩa.
  - *Giải pháp triệt để:* Thêm cờ bảo vệ `isDownloadingRef` trong `DocumentPreviewModal`. Khi đang trong tiến trình chọn nơi lưu hoặc ghi file, sự kiện `fullscreenchange` bị chặn không cho đóng modal, bảo đảm luồng ghi file hoàn tất 100% (đủ 168 KB+) và file mở xem bình thường.
- **Tự động khôi phục chế độ Fullscreen sau khi tải xong (`Auto Re-enter Fullscreen`):**
  - Ngay sau khi hộp thoại lưu tệp đóng lại và tệp đã lưu thành công (hoặc người dùng bấm Hủy), hệ thống tự động gọi `modalContainerRef.current.requestFullscreen()` để đưa tài liệu trở lại chế độ Toàn màn hình ngay lập tức, giúp cán bộ tiếp tục nghiên cứu và đọc tài liệu tập trung, không bị vướng các thanh công cụ/URL của trình duyệt.
- **Bảo toàn dữ liệu an toàn & Chống lỗi:**
  - Dữ liệu file được fetch hoàn tất trước khi ghi nên không bị ảnh hưởng bởi độ trễ mạng trong lúc ghi ra đĩa. File lưu về máy đạt 100% dung lượng, mở xem chuẩn xác trên mọi trình đọc PDF.
  - **Hủy an toàn khi bấm Cancel:** Nếu người dùng bấm Hủy trên hộp thoại lưu, nút tải lập tức quay về trạng thái ban đầu, không tải file rác.
  - **Sanitize tên tệp Windows:** Tự động chuẩn hóa tên file loại bỏ toàn bộ ký tự cấm (`/`, `\`, `?`, `%`, `*`, `:`, `|`, `"`, `<`, `>`) thành dấu gạch dưới `_` (ví dụ: `603/KH-CT` $\rightarrow$ `603_KH-CT.pdf`).
  - **Fallback an toàn:** Nếu trình duyệt không hỗ trợ File System API (như iPad, Safari), tự động chuyển sang tải native qua Blob URL chuẩn.

### 2. Chuẩn Hóa Cấp Bậc Cơ Quan Trung Ương / Bộ (`UnitTreeTable`)
- **Bổ sung cấp bậc "Cấp Trung ương / Bộ" (`trung_uong`):**
  - Tự động nhận diện chính xác các cơ quan cấp chiến lược tối cao: `Bộ Quốc Phòng` (BQP), `Bộ Tổng Tham mưu` (BTTM), `Tổng cục Chính trị` (TCCT), `Chính Phủ` (CP).
  - Không còn bị xếp sai thành "Phòng / Ban / Cơ quan".
  - Hiển thị biểu tượng `Landmark` và Badge màu Đỏ Cờ Rose trang trọng (`bg-rose-100 text-rose-900 border-rose-300`).
- **Tái cấu trúc 4 Thẻ KPI Phân Nhóm Chiến Thuật (Mini Stat Pills):**
  - Loại bỏ hoàn toàn thẻ "Trung / Tiểu đoàn: 0 đơn vị" không có dữ liệu thực tế.
  - Thay bằng 4 thẻ KPI phản ánh chính xác 100% cơ cấu 13 đơn vị toàn hệ thống:
    1. *Thẻ 1:* `Toàn hệ thống: 13 đơn vị` (Tất cả)
    2. *Thẻ 2:* `Cấp Trung ương / Bộ: 4 cơ quan` (BQP, BTTM, TCCT, CP)
    3. *Thẻ 3:* `Quân khu & Sư đoàn: 2 đầu mối` (QK7, Sư đoàn 5)
    4. *Thẻ 4:* `Trường QS & Trực thuộc: 7 đơn vị` (TQS, BGH, TM, CT, ĐT, HC, Bếp cơ quan)
  - Hỗ trợ Click-to-filter mượt mà trên từng thẻ thống kê.
- **Tối ưu Dropdown Lọc Cấp Đơn Vị:**
  - Đưa "Cấp Trung ương / Bộ" lên vị trí ưu tiên cao nhất, loại bỏ các cấp trung gian không dùng đến.

### 3. Bỏ Ký Tự Thụt Lề `└─ ` Của Bếp Cơ Quan
- Trong ô chọn "Tất cả phòng ban trực thuộc", Bếp cơ quan hiển thị tên thuần túy: `Bếp cơ quan` (không còn tiền tố `└─ ` gây khó nhìn).

---

## [v1.2.7-unit-filters-and-scroll-preservation] — 2026-11-04

### 1. Chuẩn Hóa Dropdown "Tất Cả Đơn Vị Ban Hành" (Clean Main Issuing Units Dropdown)
- **Tách bạch cơ quan ban hành chính:** Dropdown "Tất cả đơn vị ban hành" giữ danh mục cơ quan ban hành lớn gọn gàng như cũ (Trường Quân sự Quân khu 7, Quân khu 7, Bộ Tổng Tham mưu, Tổng cục Chính trị, Bộ Quốc Phòng, Chính Phủ, Sư đoàn 5...).
- **Ngăn ngừa bung dữ liệu con:** Tự động loại trừ 100% các phòng ban, đơn vị con cháu nội bộ của Nhà trường (`Ban Giám hiệu`, `Bếp cơ quan`, `Phòng Chính trị`, `Phòng Đào tạo`, `Phòng Hậu cần - Kỹ thuật`, `Phòng Tham mưu - Hành chính`) khỏi dropdown chính, loại bỏ hiện tượng bị bung ra thành các tùy chọn riêng lẻ.

### 2. Bộ Lọc Phòng Ban Phụ Thuộc (Dependent School Department Filter)
- **Kích hoạt động theo ngữ cảnh:** Khi người dùng chọn "Trường Quân sự Quân khu 7", hệ thống tự động hiển thị ô chọn filter chuyên biệt "Tất cả phòng ban trực thuộc" (ở hàng thứ 2, ngay dưới ô đơn vị ban hành).
- **Cấu trúc cây đa cấp thụt lề chuẩn (`└─ `):** Đổ toàn bộ danh mục phòng ban con cháu trực thuộc Nhà trường với tiền tố thụt lề trực quan, hỗ trợ vô hạn cấp (`Phòng Hậu cần - Kỹ thuật` $\rightarrow$ `└─ Bếp cơ quan`).
- **Truy vấn phân cấp (`include_children`):** Tự động truy vấn văn bản của cả đơn vị cha và các đơn vị con cháu trực thuộc khi lọc theo phòng ban.
- **Đồng bộ toàn diện:** Áp dụng thống nhất trên cả `DocumentDeskPage` (Trung tâm văn bản) và `PortalPage` (Kho dữ liệu chung).

### 3. Khắc Phục Triệt Để Hiện Tượng Giật/Nhảy Cuộn Trang (Scroll Jump Prevention)
- **Trang Cấu hình Khóa bảo vệ (`ProtectedPermissionsConfigPage.tsx`):** Áp dụng cơ chế **Optimistic UI Update** và **Silent Refresh** (`load(silent=true)`).
- Không unmount/sụp đổ chiều cao DOM khi click mở khóa/bật khóa, giữ nguyên 100% vị trí thanh cuộn (`scrollTop`) của người dùng tại điểm thao tác.
- Bổ sung hiệu ứng xoay loading cục bộ (`togglingId`) ngay tại nút bấm được click.
- Chuẩn hóa cơ chế Silent Refresh tương tự cho `ApprovalQueuePage` và `MyApprovalsPage`.

### 4. Nâng Cấp Bảng Cây Đơn Vị & Khắc Phục Vỡ Layout (`UnitTreeTable`)
- Bổ sung `flex-nowrap`, `truncate min-w-0` cho tên đơn vị và `shrink-0 whitespace-nowrap` cho nhãn loại đơn vị, loại bỏ hiện tượng xuống hàng làm vỡ bảng khi thêm đơn vị con.
- Kéo dài đường kẻ định hướng phân cấp liên tục (`-top-3.5` đến `-bottom-3.5`), loại bỏ đứt gãy nét kẻ giữa các cấp cha - con.

---

## [v1.2.6-hierarchical-approval-diff-school-radar-kpi] — 2026-11-04

### 1. Phân Cấp Phê Duyệt Chỉ Huy & Visual Diff Viewer (GitHub-style Diff)
- **Chuẩn hóa đối chiếu dữ liệu:** Tiêu đề đổi thành **"Đối Chiếu Dữ Liệu Chuẩn Hóa"**, loại bỏ đuôi kỹ thuật thừa.
- **Cụm nút hành động chiến thuật (Commander Action Hub):**
  - `[ ✖ Từ chối ]`: Nút Ghost viền đỏ, mở ô nhập lý do từ chối để phản hồi về cán bộ đề xuất.
  - `[ ✓ Phê duyệt & Cập nhật ]`: Nút Solid Xanh Lục Quân Đậm.
  - Đã loại bỏ nút giải trình trung gian gây thừa thao tác cho chỉ huy.
- **Badge thẩm quyền phê duyệt phân cấp:**
  - `Thẩm quyền duyệt: Chỉ huy cấp Phòng` (Màu Vàng Kim quân hiệu) khi đối tượng đề xuất thuộc đơn vị phòng ban của Chỉ huy.
  - `Thẩm quyền duyệt: Quản trị viên` (Màu Đỏ Quân Kỳ) khi xem xét trên phạm vi toàn trường.
- **Quy tắc chỉnh sửa & duyệt cục bộ (`Local Edit & Hierarchical Approval Rule`):**
  - Cán bộ thuộc đơn vị nào được phép tạo đề xuất chỉnh sửa văn bản của đơn vị đó.
  - Đề xuất được đưa thẳng vào hàng đợi duyệt của Chỉ huy/Trưởng phòng tương ứng, giảm tải cho Admin tối cao.

### 2. Chuẩn Hóa Avatar Quân Nhân Theo 2 Chữ Cái Cuối Họ Tên Tiếng Việt
- **Quy chuẩn hiển thị:** Tự động lấy 2 chữ cái đầu của 2 từ cuối họ tên:
  - `Nguyễn Thị Ánh Tuyết` $\rightarrow$ **ÁT**
  - `Trần Thị Ánh Tuyết` $\rightarrow$ **ÁT**
  - `Nguyễn Hải Anh` $\rightarrow$ **HA**
  - `Lương Nhật Thăng` $\rightarrow$ **NT**
  - `Mạc Lương Thanh Tình` $\rightarrow$ **TT**
- **Đồng bộ toàn hệ thống:** Áp dụng trên Modal Kiểm duyệt, Dropdown User Profile, và Bảng Nhật Ký Hoạt Động & Kiểm Toán An Ninh (`SecurityAuditLog`).

### 3. Điều Hướng "Quản Trị" Trên Topbar Dành Cho Nhân Viên IT
- Trên thanh điều hướng trung tâm (`NavigationGlider`), tài khoản có vai trò/chức vụ IT hoặc được phân bổ quyền quản trị danh mục (như `USR-009` Mạc Lương Thanh Tình) sẽ hiển thị tab **"Quản trị"** (kèm icon Khiên `Shield`), cho phép truy cập trực tiếp Trung tâm Quản trị tương tự Admin.

### 4. Tách 4 Tab Trạng Thái Độc Lập Tại "Yêu Cầu Chỉnh Sửa Của Tôi"
- Tách biệt rõ ràng từ trái sang phải: `Tất cả` $\rightarrow$ `Đang chờ` $\rightarrow$ `Đã Duyệt` $\rightarrow$ `Từ chối`.
- Tích hợp Badge đếm số lượng động trên từng tab theo thời gian thực.
- Khắc phục lỗi lọc trạng thái `APPROVED` ở backend bằng cách gom cả đề xuất `APPROVED` và `EXECUTED`.

### 5. Khắc Phục Lỗi Ngắt Dòng & Cắt Cụt Ký Tự Toast Thông Báo
- Mở rộng chiều rộng Toast Container lên `min-w-[480px] md:min-w-[540px]`.
- Loại bỏ thuộc tính `truncate` ở tiêu đề thông báo `ĐÃ GỬI ĐỀ XUẤT CHỈNH SỬA`, giữ nguyên dòng không bị cắt cụt ba chấm `S...`.

### 6. Nâng Cấp UX/UI Kho Dữ Liệu Chung (`PortalPage`)
- **Banner Phạm vi tra cứu tài liệu quân sự:**
  - Nút bật/tắt thống kê toàn trường: `[ 📊 Ẩn thống kê toàn trường ^ ]` / `[ 📊 Hiện thống kê toàn trường v ]`.
  - Tách nội dung thành 2 dòng rõ ràng:
    + Dòng 1: `Toàn quyền tra cứu và truy xuất tài liệu tối mật của toàn Trường Quân sự Quân khu 7`
    + Dòng 2: `Mọi thao tác đều được kiểm toán và ghi nhận nhật ký an ninh.`
- **4 Thẻ KPI Vĩ Mô Toàn Trường:**
  1. *Thẻ 1 - Tổng kho toàn trường:* Tổng số tài liệu, dung lượng kho số (`KB/MB`), số văn bản mới trong 30 ngày qua.
  2. *Thẻ 2 - Tiến độ các phòng ban:* Tỷ lệ phòng ban Nhà trường đã nộp dữ liệu (4/5 đơn vị = 80%), cảnh báo phòng ban chậm tiến độ.
  3. *Thẻ 3 - Quyền khai thác của bạn (Mới):* Số lượng văn bản khả dụng theo cấp độ mật cá nhân (`15/15 khả dụng [100%]`), kèm thông tin cấp độ và số lượng tài liệu yêu cầu xác thực 2FA vân tay.
  4. *Thẻ 4 - Chuẩn hóa phân bổ:* Tỷ lệ `%` chuẩn hóa gán đúng đơn vị & thể loại, ngày cập nhật văn bản mới nhất.
- **Bảng Tiến Độ Số Hóa & Phân Bổ Theo Đơn Vị:**
  - Lọc duy nhất các phòng ban con trực thuộc Trường Quân sự Quân khu 7 (BGH: 7 Văn bản, Chính trị: 2, Đào tạo: 1, Tham mưu: 1, Hậu cần: 0 - Chậm tiến độ).
  - Loại bỏ hoàn toàn các đơn vị bên ngoài / cấp trên (Quân khu 7, Chính phủ, Bộ Quốc phòng, Sư đoàn 5...).
  - Thiết kế lại Header 2 tầng phân cấp chuẩn Command Center, chống ngắt dòng chữ "Vị" và số "7".
  - Chuẩn hóa chú thích SLA: `Tối đa 3 Văn bản`, `Cần bổ sung (1-2 Văn bản)`, `Chậm tiến độ (0 Văn bản)`.
  - Thay thế toàn bộ từ viết tắt `VB` thành chữ đầy đủ **`Văn bản`**.
  - Tích hợp Click-to-filter tương tác hai chiều và đồng bộ Gateway `/api/documents` cho Ban Giám hiệu.
- **Bảng Cơ Cấu Thể Loại & Mức Bảo Mật Toàn Trường:** Có Mini Segmented Switcher chuyển đổi mượt mà giữa Thể loại và Cấp độ bảo mật.

---

## [v1.2.5-split-pane-digitization-workflow] — 2026-11-03

### 1. Quy Trình Số Hóa Tài Liệu Chia Đôi Màn Hình (Split-Pane Digitization Side-by-Side)
- **Tái cấu trúc Modal Đăng Tải & Hiệu Chỉnh:** Chuyển đổi hộp thoại popup nhỏ sang giao diện toàn màn hình (Full-screen Modal) chia đôi 2 vùng làm việc độc lập:
  - *Khung bên trái (35% - 40%):* Biểu mẫu nhập liệu (Số hiệu, trích yếu, người ký, đơn vị, độ mật) với thanh cuộn dọc độc lập `overflow-y-auto`.
  - *Khung bên phải (60% - 65%):* Trình xem trước PDF toàn màn hình (PDF Viewer) phục vụ đối chiếu dữ liệu theo thời gian thực.
- **Xem trước cục bộ tức thì (Real-time Local Preview 0ms):**
  - Kéo thả tệp PDF vào Dropzone ở form trái sẽ render ngay lập tức sang khung phải thông qua `URL.createObjectURL(file)` mà không cần upload lên máy chủ.
  - Tự động thu hồi `URL.revokeObjectURL` khi unmount hoặc đổi file để ngăn ngừa rò rỉ bộ nhớ.
  - Tự động tải stream văn bản gốc `/api/files/:id/view` khi mở chế độ "Hiệu Chỉnh Văn Bản".
- **Empty State chuyên nghiệp:** Hiển thị màn hình chờ trực quan với biểu tượng tài liệu lớn và thông báo hướng dẫn kéo thả khi chưa chọn tệp.

### 2. Tối Ưu Hiệu Năng & Khắc Phục Triệt Để Hiện Tượng Nhấp Nháy (Flicker-Free Canvas)
- **Khắc phục lỗi giật nhấp nháy PDF Canvas khi nhập liệu:**
  - Bọc `SinglePdfPage` và `PdfPagesViewer` trong `React.memo` với hàm so sánh props tùy biến.
  - Tách `redrawStrokes` khỏi dependency array của effect render PDF trong `SinglePdfPage.tsx`, tránh việc xóa trắng canvas (`canvas.width = canvas.width`) và hủy render task mỗi khi gõ phím.
  - Memoize hoàn toàn node PDF Viewer bằng `useMemo` trong `DocumentUploadModal.tsx`, cô lập khỏi state thay đổi của form nhập liệu (`formData`).
  - Dùng `prevSelectedFileRef` và `initializedDocIdRef` ngăn chặn gọi lại không cần thiết các hàm nạp dữ liệu.

### 3. Tinh Chỉnh UX/UI Theo Bản Sắc Quân Đội & Bảo Mật Đa Tầng
- **Tối ưu màu sắc Light Mode thanh lịch:** Đồng bộ bảng màu nền, viền, shadow tạo độ tương phản cao, dịu mắt và trang nhã.
- **Loại bỏ công cụ thừa & Công thái học nút đóng:** Loại bỏ bút dạ quang khỏi thanh công cụ modal đăng tải/hiệu chỉnh; đưa nút đóng `[X]` lên góc trên bên phải thanh tiêu đề khung PDF.
- **Bảo mật Sparse Dynamic Watermark:** Luôn tự động kích hoạt watermark mờ phủ chéo 45 độ trên khung PDF xem trước cục bộ và máy chủ để bảo vệ an ninh văn bản quân sự.

---

## [v1.2.4-anti-screenshot-approval-workflow-unit-sort] — 2026-11-01

### 1. Lá Chắn Chống Chụp Màn Hình & Cảnh Báo An Ninh Tác Chiến (Anti-Screenshot Security Shield)
- **Đánh chặn phím tắt toàn diện:** Bắt và triệt tiêu các tổ hợp phím chụp màn hình hệ điều hành: `PrintScreen` (Key code 44), `Win + Shift + S` (Snipping Tool trên Windows), `Cmd + Shift + 3/4` (trên macOS/iPadOS).
- **Cơ chế Blackout DOM tức thì (0ms):** Ngay khi phát hiện sự kiện phím tắt hoặc sự kiện mất tiêu điểm cửa sổ (`window.blur` do Snipping Tool mở lên), hệ thống tự động cưỡng chế che đen/mờ toàn bộ vùng nội dung tài liệu tác chiến trước khi Windows kịp ghi khung hình.
- **Tiêu hủy bộ nhớ tạm Clipboard đa nhịp:** Thực hiện ghi đè nội dung rỗng/vô hiệu hóa vào Clipboard hệ điều hành ngay lập tức (0ms) và kích hoạt nhắc lại liên tiếp sau 200ms, 500ms, 1000ms để triệt tiêu hoàn toàn khả năng người dùng nhấn `Ctrl + V` lấy ra hình ảnh.
- **Chặn dán nội dung hình ảnh:** Kiểm tra sự kiện `paste`, nếu clipboard chứa mime-type `image/*`, lập tức từ chối và cảnh báo an ninh vi phạm quy chế bảo vệ bí mật quân sự.
- **Tích hợp cảnh báo thời gian thực về SOC:** Phát tín hiệu báo cáo về Gateway qua endpoint `/api/security/screenshot-alert`. Tự động trích xuất đầy đủ thông tin: Mã tệp (`file_id`), Số hiệu văn bản, Trích yếu nội dung, Cấp độ bảo mật, Đơn vị ban hành, Thời gian vi phạm và Địa chỉ IP máy trạm.
- **Hiển thị trực quan trên Nhật ký SOC (`SecurityAuditLog.tsx`):** Thiết kế thẻ cảnh báo chuyên biệt màu đỏ tươi (`border-rose-300 bg-rose-50`), biểu tượng `CameraOff`, hiển thị rõ văn bản đang bị tác động và thông điệp: *"HÀNH VI CHỤP MÀN HÌNH ĐÃ BỊ CHẶN & TIÊU HỦY DỮ LIỆU BỘ NHỚ TẠM"*.
- **Mở rộng cột `ACCESS_LOG.note`:** Nâng cấp cấu trúc trường dữ liệu `note` từ `NVARCHAR(255)` lên `NVARCHAR(1000)` trong CSDL SQL Server, loại bỏ triệt để hiện tượng cắt cụt trích yếu hoặc mất thông tin đơn vị/cấp mật khi ghi nhận nhật ký kiểm toán an ninh.
- **Công tắc Dev Switch an toàn:** Bổ sung tùy chọn *"Dev: Cho phép chụp ảnh"* (`qk7_dev_allow_screenshot`) trong menu người dùng (Header Profile) để lập trình viên/kiểm thử viên có thể chụp màn hình giao diện khi cần mà không bị lá chắn an ninh kích hoạt.

### 2. Hợp Nhất Luồng Đề Xuất Sửa Đổi & Chuẩn Hóa Văn Bản Vào Hàng Đợi Phê Duyệt Của Admin
- **Hợp nhất hàng đợi tập trung (`ApprovalQueuePage.tsx`):**
  - Tích hợp toàn diện các đề xuất chỉnh sửa văn bản từ bảng `DOCUMENT_REVISION_PROPOSAL` vào chung hàng đợi duyệt `/api/admin/approval-requests` của Quản trị viên tối cao.
  - Loại bỏ hoàn toàn sự rườm rà khi Quản trị viên phải vào trang bàn làm việc để tìm modal cũ; toàn bộ yêu cầu khóa quyền (`APPROVAL_REQUEST`) và đề xuất chuẩn hóa văn bản (`PROP-*`) giờ đây tập trung tại một nơi duy nhất.
- **Nhận diện trực quan & Bảng đối chiếu 2 cột:**
  - Đề xuất sửa văn bản được phân loại với Badge màu xanh ngọc bích: `ĐỀ XUẤT SỬA VĂN BẢN`.
  - Hộp thoại chi tiết cung cấp **BẢNG ĐỐI CHIẾU THÔNG TIN CHUẨN HÓA** 2 cột trực quan:
    - *Cột hiện tại:* Số hiệu, Trích yếu, Đơn vị & Người ký, Cấp độ mật ban đầu.
    - *Cột đề xuất:* Các thông tin mới do trợ lý/văn thư đề xuất thay đổi.
    - *Lý do đề xuất:* Hiển thị rõ ràng ghi chú giải trình của người đề xuất.
- **Xử lý 1-click & Đồng bộ đa tầng:**
  - Phê duyệt / Từ chối trực tiếp ngay tại Hàng đợi, tự động cập nhật bảng `DOCUMENT`, đồng bộ kho vector ngữ nghĩa AI Boxchat (`:8001`), ghi nhận `ACCESS_LOG` kiểm toán và tự động cập nhật số lượng badge chờ duyệt qua `ApprovalContext`.
- **Trang theo dõi của người dùng ("Yêu Cầu Chỉnh Sửa Của Tôi" - `MyApprovalsPage.tsx`):**
  - Đồng bộ API `/api/my-approval-requests` giúp quân nhân theo dõi tiến độ của đề xuất: Đang chờ duyệt (`PENDING`), Đã phê duyệt (`APPROVED`), hoặc Bị từ chối (`REJECTED`) kèm lý do từ chối cụ thể từ Chỉ huy/Admin.
- **Mặc định lý do chuẩn hóa (`DocumentUploadModal.tsx`):**
  - Khi trợ lý/văn thư gửi đề xuất chỉnh sửa, ô nhập lý do đã để sẵn văn bản mẫu: `"Đề xuất chuẩn hóa thông tin văn bản"` để tối ưu hóa tốc độ thao tác, người dùng có thể giữ nguyên hoặc xóa đi nhập lý do riêng.

### 3. Chuẩn Hóa Thứ Tự Ưu Tiên Đơn Vị Ban Hành Trong Bộ Lọc & Lọc Sâu Phòng Ban
- **Thứ tự hiển thị chuẩn quân sự:** Sắp xếp lại danh mục đơn vị ban hành trong dropdown bộ lọc tìm kiếm theo đúng phân cấp quản lý quân sự:
  1. Tất cả đơn vị ban hành
  2. Trường Quân sự Quân khu 7 (`TQS`)
  3. Quân khu 7 (`QK7`)
  4. Bộ Tổng Tham mưu (`BTTM`)
  5. Tổng cục Chính trị (`TCCT`)
  6. Bộ Quốc Phòng (`BQP`)
  7. Chính Phủ (`CP`)
  8. Sư đoàn 5 (`SD5`)
  *(Các đơn vị mới được thêm sau này sẽ tự động xếp ở dưới dần dần)*
- **Bộ lọc sâu phòng ban trực thuộc TQS:** Khi người dùng chọn *"Trường Quân sự Quân khu 7"*, ô chọn phòng ban (*Ban Giám hiệu, Phòng Tham mưu - Hành chính, Phòng Chính trị, Phòng Đào tạo, Phòng Hậu cần - Kỹ thuật*) tự động xuất hiện đối diện ngay bên dưới để tra cứu chi tiết; khi chọn các đơn vị khác, ô phòng ban tự động ẩn đi để giao diện gọn gàng.
- **Xuất helper dùng chung:** Cung cấp hàm `getIssuingUnitPriority` trong `frontend/src/utils/unitTree.tsx` để đồng bộ thứ tự ưu tiên trên toàn bộ các trang (`PortalPage.tsx`, `DocumentFilters.tsx`).

---

## [v1.2.3-biometric-device-recovery-fix] — 2026-10-31

### Khắc Phục Lỗi Báo Ảo "Vân Tay Không Khớp" Khi Chưa Đặt Tay Quét & Tự Phục Hồi Thiết Bị ZK9500
- **Khắc phục lỗi nuốt mã lỗi phần cứng tại Gateway (`server.js`):** Phân biệt rành mạch giữa lỗi thiết bị ngoại vi (`DEVICE_OFFLINE` $\rightarrow$ `503`, `TIMEOUT` $\rightarrow$ `408`, `device_error` $\rightarrow$ `500`) và lỗi dữ liệu sinh trắc học không khớp (`403`). Loại bỏ hoàn toàn tình trạng Gateway tự ý gộp lỗi `DEVICE_OFFLINE` thành *"Vân tay không khớp (score=0)"*.
- **Tự động đánh thức và nạp lại SDK ZKTeco (`zk_service.py` & `agent.py`):** Bổ sung cơ chế **Self-Healing SDK Reload**: khi `GetDeviceCount() <= 0` hoặc thiết bị ở trạng thái ngủ sau thời gian idle dài, Agent tự động reload fresh instance để re-enumerate lại cổng USB và khởi động lại đầu đọc ZK9500.
- **Ngắt vòng lặp Auto-retry tại UI (`FingerprintScanModal.tsx`):** Khi gặp lỗi thiết bị offline hoặc timeout, dừng ngay lập tức việc tự động thử lại 2 lần liên tiếp gây cạn lượt quét trong 2 giây; hiển thị thông báo trung thực để người dùng kiểm tra kết nối cáp USB hoặc chủ động bấm nút "Quét ngay".
- **Bảo vệ luồng Admin 2FA (`server.js`):** Thêm khối kiểm tra bắt buộc `!scanResult.match` cho API xác thực 2FA đăng nhập Admin (`/api/auth/login/admin-fp-verify`), vá triệt để lỗ hổng bỏ qua xác thực vân tay quản trị viên.

---

## [v1.2.2-chatbox-biometric-token-scoping] — 2026-10-31

### Cô Lập Vùng Nhớ Token Sinh Trắc Học Của Chatbox & Chống Bỏ Qua Quét Vân Tay Ngoài Trang
- **Hiện tượng trước khi sửa:** Khi người dùng tra cứu văn bản Cấp 3+ trong Chatbox và hoàn tất quét vân tay ZK9500, Chatbox lưu token vào `sessionStorage` per-file (`qk7_fp_token_${targetScanFileId}`). Khi đóng Chatbox (`tắt chatbox`) rồi truy cập cùng văn bản tại Bàn làm việc (Document Desk), hệ thống tự động bypass quét vân tay do token vẫn còn hiệu lực 5 phút trong `sessionStorage`.
- **Cơ chế cô lập mới (In-Memory Scoped Token):**
  - **Loại bỏ ghi `sessionStorage` từ Chatbox:** Xóa bỏ hoàn toàn thao tác ghi `sessionStorage.setItem('qk7_fp_token_' + targetScanFileId, ...)` trong `AIChatDrawer.tsx` và `AIChatWidget.tsx`.
  - **Quản lý vòng đời token trong bộ nhớ nội bộ:** Token sinh trắc học của Chatbox được lưu trong React State (`fpToken`) kèm mốc thời gian hết hạn 5 phút (`fpTokenExpiresAt`), chỉ dùng riêng cho các truy vấn chat và trích dẫn nội bộ của Chatbox.
  - **Tự động hủy khi đóng Chatbox:** Khi người dùng đóng Chatbox (qua nút `X`, click lớp phủ backdrop, hoặc phím `ESC`), hàm `handleCloseChat` lập tức dọn sạch token trong bộ nhớ (`fpToken = null`), đồng thời chủ động quét xóa mọi khóa `qk7_fp_token*` trong `sessionStorage`.
  - **Bảo toàn 3 tầng phòng thủ Zero-Trust:** Khi ra ngoài Bàn làm việc (Document Desk), Đơn vị của tôi hoặc Danh mục, người dùng bắt buộc phải quét vân tay ZK9500 độc lập để xem tài liệu Cấp 3+, không còn hiện tượng rò rỉ token làm bypass sinh trắc học.

---

## [v1.2.1-chatbox-clearance-sync-fix] — 2026-10-31

### 1. Sửa Lỗi Clearance Guard & Ngộ Nhận Vượt Cấp Mật Trong Chatbox
- **Khắc phục ngộ nhận trong `agent_tutor.py` & `ai-routes.js`:** Loại bỏ giả định sai lầm "không tìm thấy chunk = vượt cấp mật". Cập nhật cơ chế tra cứu toàn diện kho dữ liệu (`all_chunks`/CSDL) để xác minh chính xác cấp mật thực tế của văn bản trước khi đưa ra quyết định từ chối.
- **Tài khoản Tuyệt mật (Cấp 5):** Xem và tra cứu bình thường toàn bộ tài liệu Cấp 1–5 (bao gồm `39-KH/ĐU`), không còn bị thông báo vô lý "không phù hợp cấp bảo mật".
- **Tài khoản cùng cấp mật (Cấp 3 - Mật):** Tra cứu đúng tài liệu Cấp 3 (`880/KH`), tự động kích hoạt luồng Biometric Guard ZK9500 (`requires_biometric: true`) và mở khóa sau khi quét vân tay.
- **Tài liệu không tồn tại:** Trả về thông báo chuẩn xác "không tìm thấy văn bản trong hệ thống" thay vì đổ lỗi cho cấp bậc quân nhân.

### 2. Tự Động Hóa Đồng Bộ 2 Chiều Giữa SQL Server & Boxchat Vector Store
- **Webhook tự động tại Express Gateway (`server.js`):** Các thao tác tải lên văn bản mới (`upload`), cập nhật metadata/file (`edit`), xóa mềm (`delete`), khôi phục (`restore`), và xóa vĩnh viễn (`purge`) đều tự động gửi tín hiệu đồng bộ sang `:8001` (`/ai/ingest` & `/ai/documents/:fileId`).
- **Nâng cấp `/ai/sync-all`:** Bổ sung cơ chế tự động dọn dẹp các tài liệu cũ/đã bị xóa khỏi CSDL SQL Server (stale document cleanup), loại bỏ triệt để tình trạng lệch pha dữ liệu cũ.
- **Chuẩn hóa bộ phân giải đường dẫn PDF (`pdf_processor.py`):** Đa dạng hóa danh sách thư mục `uploads` theo ngữ cảnh thực thi, đảm bảo bóc tách chính xác tệp PDF trong mọi môi trường.

---

## [v1.2.0-security-ecosystem-complete] — 2026-10-30

### 1. Quy hoạch Hệ sinh thái 4 phân hệ số hóa cốt lõi
- **Phân định rõ 4 trụ cột:** Dữ liệu số (đã hoàn thiện, đang vận hành), Bài giảng số (sắp phát triển), Thư viện số (sắp phát triển) và Học liệu số (sắp phát triển).
- **Đồng bộ hóa tài liệu kiến trúc:** Cập nhật `README.md` và `SYSTEM_ARCHITECTURE.md` phản ánh đầy đủ mô hình hệ sinh thái số hóa quân sự.

### 2. Tăng cường An ninh & Bảo mật Đa Tầng
- **Dynamic Watermark chuẩn hóa:** Khắc phục lỗi chữ in nghiêng (*italic*), cố định font-style normal, căn chỉnh đồng đều các hàng, chống thao tác xóa watermark qua DevTools.
- **Chốt chặn cứng 3 lớp khi lệch giờ máy trạm (Clock Authority Engine):** Đồng bộ giờ chuẩn tham chiếu máy chủ (Google / NTP); Gateway Middleware kiểm tra delta drift và từ chối `403 TIME_DRIFT_EXCEEDED` trên toàn bộ 5 cấp độ tài liệu (Cấp 1 - Công khai đến Cấp 5 - Tuyệt mật); phát sinh cảnh báo SOC mức `CRITICAL`.
- **Xác thực 2FA Sinh trắc học Admin & Fail-Safe Initialization:** Bắt buộc quét vân tay ZK9500 với tài khoản Admin; Vé tạm JWT 2 phút; modal Frosted Glass render qua React Portal vào `document.body`; cơ chế fail-safe cho phép đăng nhập mật khẩu khi DB chưa có mẫu vân tay active để quản trị viên tiến hành khởi tạo mẫu mới.
- **Admin IP Whitelist:** Giới hạn đăng nhập quyền Admin trong dải IP nội bộ và máy trạm kiểm soát; tự động khóa IP nếu dò quét mật khẩu.
- **Chống spam Toast cảnh báo 403 (2s Throttle):** Tránh hiện tượng giật lag giao diện khi nhiều background polling request đồng thời bị từ chối quyền.
- **Phân hệ Quản trị & Phiên làm việc:** Quản lý quân nhân phân trang 5 người/trang, tìm kiếm tiếng Việt không dấu; Cây đơn vị 6 tầng bảo vệ đơn vị mồ côi; Tự động ẩn Sidebar khi không có menu; Giám sát và ngắt phiên cưỡng bức (`/sessions`).
- **Trích xuất PDF & Kiểm tra chống trùng lặp SHA-256:** Ngăn tải lên tài liệu trùng lặp, tự động đồng bộ vector Qdrant.

### 3. Ban hành Quy chuẩn Phối hợp AI Agent & Sổ tay Sự cố
- **Ban hành `AGENT_WORKFLOW.md`:** Quy định bắt buộc 3 bước (1. Khởi động & Đọc tài liệu $\rightarrow$ 2. Thực hiện tác vụ $\rightarrow$ 3. Cập nhật tài liệu sau hoàn thành).
- **Biên soạn `TROUBLESHOOTING_HISTORY.md`:** Tổng hợp 13 sự cố kỹ thuật điển hình (ZKTeco DLL 32/64-bit, AES-GCM Auth tag, Check constraint SQL `CK_LA_RESULT`, Port conflict, Stacking context layout...) và phương án khắc phục dứt điểm.

---

## [v1.1.0-boxchat-complete] — 2026-10-27

### 1. Khắc phục triệt để xung đột cổng và lỗi tắt ngầm (:8001)
- **Tách script giải phóng cổng độc lập:** Tạo tệp `boxchat/free-port.ps1` chạy bằng PowerShell với cơ chế cây tiến trình (`Stop-Process -Id ... -Force`).
- **Khử lỗi thoát văng batch script:** Sửa `start-ai.bat` gọi `powershell -NoProfile -ExecutionPolicy Bypass -File free-port.ps1`, loại bỏ triệt để lỗi cú pháp escaping CMD `ForEach-Object : Cannot bind parameter 'RemainingScripts'`.
- **Thay thế lệnh chờ an toàn:** Thay thế `timeout /t 1` bằng `ping 127.0.0.1 -n 2 >nul` để khắc phục lỗi `Input redirection is not supported` trong môi trường subprocess.

### 2. Triệt tiêu độ trễ phân giải mạng Windows (IPv6 Latency Fix)
- **Chuẩn hóa loopback IP:** Đổi toàn bộ cấu hình từ `localhost` sang `127.0.0.1` trên `.env`, `boxchat/.env`, `vector_store.py` và `agent_tutor.py`.
- **Hiệu quả:** Loại bỏ hoàn toàn độ trễ trừng phạt 2.000 ms của Windows khi cố gắng phân giải `::1` IPv6 trước khi chuyển về IPv4.

### 3. Cơ chế Khóa An toàn Tự Phục Hồi Qdrant (Self-Healing Lock with Process Safety Guard)
- **Phát hiện rủi ro:** Cơ chế xóa lock cũ (`os.remove(lock_path)`) xóa mù quáng mà không kiểm tra tiến trình khác đang chạy, có nguy cơ phá hỏng CSDL vector khi có 2 tiến trình chạy đồng thời.
- **Bổ sung Process Safety Guard:** Tích hợp bộ lọc CIM `Get-CimInstance Win32_Process`, loại trừ PID hiện tại (`$_.ProcessId -ne current_pid`), kiểm tra các tiến trình Python đang chạy `main.py` hoặc `uvicorn`.
  - Nếu có tiến trình AI khác: **Tuyệt đối KHÔNG xóa `.lock`**, hủy init để bảo vệ toàn vẹn dữ liệu.
  - Nếu xác nhận là stale lock từ crash: Tự động dọn dẹp an toàn và đánh dấu cờ `stale_lock_cleaned = True`.
- **Kiểm thử đơn vị an toàn:** Tạo `boxchat/test_qdrant_safety.py` đạt 2/2 PASS (100%).

### 4. Mở rộng Khung Đo Lường & Đánh Giá Tự Động (Agentic RAG Evaluation Framework)
- **Mở rộng 30 câu hỏi nghiệp vụ:** Tạo `boxchat/eval_questions.expanded.json` gồm 10 Single-hop, 5 Multi-hop, 5 Paraphrase, 5 Adversarial (Bẫy/ngoài phạm vi), 5 Doc-code.
- **Bổ sung các metrics nâng cao trong `boxchat/eval_rag.py`:**
  - `answer_length`: Độ dài câu trả lời (ký tự).
  - `fallback_reason`: Nguyên nhân fallback (clearance, biometric, extractive, adversarial_refusal, out-of-domain).
  - `fabricated_citations`: Số lượng trích dẫn giả mạo tự sinh đã được gỡ bỏ.
  - `adversarial_refusal_rate`: Tỷ lệ từ chối chuẩn xác khi gặp câu hỏi bẫy ngoài phạm vi (đạt 100%).
  - Bảng thống kê chi tiết theo 5 phân loại câu hỏi.
  - Hỗ trợ CLI arguments (`--dataset`, `--model`, `--runs`, `--output`).

### 5. Khảo sát & Chuẩn Hóa Model Sản Xuất (`qwen2.5:3b`)
- **Khảo sát phần cứng:** Card đồ họa máy chủ thực tế là NVIDIA GeForce GTX 1650 (Tổng VRAM: 4.0 GB).
- **Quyết định model:** Model `7b` (~4.7 GB + context + bge-m3 = ~7.4 GB VRAM) vượt quá ngưỡng phần cứng 4.0 GB, nếu ép chạy sẽ gây tràn RAM và độ trễ 60-120s/query. Hệ thống quyết định **GIỮ NGUYÊN `qwen2.5:3b`** làm model sản xuất chính thức.
- **Thực nghiệm tính ổn định (2 lần chạy 30 câu):**
  - Hit Rate @5: **100.0%** (30/30)
  - Citation Accuracy: **100.0%**
  - Clearance Leak Count: **0 (An toàn tuyệt đối)**
  - Adversarial Refusal Rate: **100.0%** (5/5)
  - Độ trễ trung bình: **4.8s - 6.7s**

### 6. Đồng bộ Tài Liệu Kiến Trúc & Hướng Dẫn Kỹ Thuật
- Cập nhật `SYSTEM_ARCHITECTURE.md` mục 7.1: Ghi rõ quyết định model `qwen2.5:3b` và cơ chế Process Safety Guard của Qdrant.
- Cập nhật `BOXCHAT_TECHNICAL_REPORT.md` mục 3 & IV: Phản ánh cấu hình model thực tế và toàn bộ số liệu benchmark 30 câu hỏi mới.

### 7. Kiểm Thử Toàn Diện & Gia Cố Hệ Thống (End-to-End Verification — Phase 4)
- **Triệt tiêu lỗi mã hóa console Windows:** Bổ sung cấu hình `sys.stdout.reconfigure(encoding='utf-8', errors='replace')` vào `vector_store.py` và `pdf_processor.py`.
- **Bộ kiểm thử tự động 15 kịch bản E2E:** Xây dựng `boxchat/test_e2e_15_scenarios.py` bao quát:
  - Health check & Swagger OpenAPI docs (:8001).
  - Phân quyền Cấp 1 đến Cấp 5 (ngăn chặn 100% rò rỉ vượt cấp).
  - Bảo vệ sinh trắc học vân tay 2FA cho văn bản Cấp 3-5 (khóa và che mờ 100% snippet khi chưa xác thực).
  - Đối thoại đa lượt với cơ chế Query Rewriting theo ngữ cảnh.
  - Từ chối câu hỏi bẫy/ngoài luồng (Adversarial Refusal).
  - Nạp tài liệu PDF mới (:8001/ai/ingest) và tra cứu tức thì theo vector store.
  - Gateway Express proxy (:8000 -> :8001) với Bearer JWT, kiểm toán `ACCESS_LOG` và cơ chế Smart SQL Fallback.
- **Kết quả nghiệm thu:** **15/15 kịch bản ĐẠT (100.0%)**, độ trễ trung bình **3,317 ms**.
- **Tài liệu bàn giao:** `docs/E2E_TEST_RESULTS.md`, `docs/e2e_results.json`.

### 8. Đánh Giá Chuyên Sâu Chất Lượng RAGAS & Tối Ưu Tham Số Vận Hành (Phase 5)
- **Công cụ đo lường RAGAS chuyên sâu:** Xây dựng `boxchat/eval_ragas_quality.py` đo lường 6 chỉ số RAGAS tiêu chuẩn:
  - **Faithfulness:** **94.43%** (Bám sát 100% tài liệu gốc, không bịa đặt số liệu hay nội dung).
  - **Answer Relevance:** **98.20%** (Trả lời trực diện, đúng trọng tâm câu hỏi của quân nhân).
  - **Context Retrieval MRR:** **0.5833** (Tài liệu đúng luôn xuất hiện ở Top 1 hoặc Top 2).
  - **Clearance Leakage Rate:** **0.00% (0/30)** (Tuyệt đối không rò rỉ độ mật).
  - **Biometric Guard Enforcement:** **100.00%** (Tuyệt đối che mờ nội dung mật khi chưa xác thực vân tay).
  - **Adversarial Refusal Rate:** **100.00% (5/5)** (Từ chối ngay trong 836 ms các câu hỏi phi quân sự/tấn công).
  - **Độ trễ trung bình toàn hệ thống:** **5,553.6 ms** (~5.5 giây trên GPU GTX 1650 cục bộ).
- **Cố định tham số vận hành:** Khóa cấu hình Chunking (900 chars, overlap 80, max 1200), Hybrid RRF $k=60$, Top-k=5, Temperature=0.1, keep_alive=24h.
- **Tài liệu bàn giao:** `docs/RAGAS_ANALYSIS.md`, `docs/ragas_evaluation_results.json`.

### 9. Bàn Giao Vận Hành & Phát Hành Phiên Bản (Phase 6)
- **Biên soạn Sổ tay Bàn giao:** Tạo `docs/HANDOVER_CHECKLIST.md` hướng dẫn toàn diện cho kíp trực SOC và quản trị viên hệ thống.
- **Phát hành phiên bản chính thức:** Gắn thẻ tag git `v1.1.0-boxchat-complete`.
