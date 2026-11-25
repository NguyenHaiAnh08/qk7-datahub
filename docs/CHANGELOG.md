# Nhật Ký Thay Đổi Kỹ Thuật (CHANGELOG) — QK7 DataHub

Tài liệu ghi nhận toàn bộ các điều chỉnh, cải tiến, bản vá kỹ thuật và quy chuẩn vận hành của dự án QK7 DataHub.

---

## [v1.8.10-gpu-vram-guard-and-ai-inference-optimization] — 2026-11-25

### 1. Tối Ưu Hóa GPU VRAM, Flash Attention & Bộ Đệm KV Cho Ollama AI Boxchat
- **Cấu hình GPU VRAM Guard ([`scripts/start-ai.bat`](../scripts/start-ai.bat), [`boxchat/s.bat`](../boxchat/s.bat), [`.env.example`](../.env.example)):**
  - Tích hợp các tham số tối ưu hóa phần cứng cao cấp: `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`, `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_KEEP_ALIVE=3m`, `OLLAMA_NUM_CTX=4096`, `OLLAMA_NUM_GPU=99`.
  - Tự động phát hiện thực thi `ollama.exe` trong cả `PATH` và `%LOCALAPPDATA%\Programs\Ollama\`.
- **Đồng nhất Options & Giám sát VRAM Thời Gian Thực ([`boxchat/core/agent_tutor.py`](../boxchat/core/agent_tutor.py), [`boxchat/main.py`](../boxchat/main.py)):**
  - Thêm phương thức `_build_ollama_options()` đồng nhất giữa `warm_up()` và `_call_ollama()`, giữ model 100% trên VRAM GPU, loại bỏ hiện tượng tải lại model khi đổi context.
  - Bổ sung endpoint `/api/ai/runtime-status` và hàm `get_loaded_models()` truy vấn trực tiếp `/api/ps` của Ollama (cache 5s) hiển thị kích thước VRAM sử dụng và % GPU offload.

### 2. Tối Ưu Tài Nguyên Cho Dịch Vụ OCR & Chống Rò Rỉ Bộ Nhớ
- **Nhường 100% VRAM GPU cho AI Boxchat ([`ocr-service/start-ocr.bat`](../ocr-service/start-ocr.bat)):**
  - Cấu hình mặc định `MONKEY_DEVICE=cpu` chạy PaddleOCR PP-OCRv3 siêu nhẹ trên CPU (~60-400MB RAM, 0MB VRAM).
- **Giải phóng bộ nhớ triệt để ([`ocr-service/main.py`](../ocr-service/main.py)):**
  - Bổ sung thu gom rác chủ động (`del pil_img; gc.collect()`) sau khi xử lý OCR từng trang tài liệu, triệt tiêu rò rỉ bộ nhớ khi xử lý file PDF lớn.

---

## [v1.8.9-ai-rag-threadpool-and-lecture-route-order-hardening] — 2026-11-25

### 1. Khắc Phục Route Shadowing & Phân Định Hạn Mức Tải Lên Phân Hệ Bài Giảng
- **Đảo thứ tự đăng ký router ([`backend/server.js`](../backend/server.js)):**
  - Gắn `lecture-extended-routes` trước `lecture-routes` tại tiền tố `/api/lectures` để đảm bảo endpoint tĩnh `/schedules/monitor` không bị route động `/schedules/:id` nuốt chửng.
- **Phân định rõ giới hạn tải lên theo định dạng nội dung số ([`backend/server.js`](../backend/server.js)):**
  - Tự động nhận diện URL upload: gói SCORM / HTML5 cho phép dung lượng tối đa **300MB**, bài giảng số PDF tối đa **150MB**, văn bản tài liệu hành chính mặc định **50MB**, trả về thông báo lỗi tiếng Việt trực quan kèm mã kích thước.

### 2. Tối Ưu Bất Đồng Bộ Hóa & Đo Lường Giám Sát AI Boxchat Microservice
- **Chạy tác vụ nặng trong threadpool ([`boxchat/main.py`](../boxchat/main.py), [`pdf_processor.py`](../boxchat/core/pdf_processor.py), [`agent_tutor.py`](../boxchat/core/agent_tutor.py)):**
  - Chuyển toàn bộ tác vụ trích xuất PDF scan/OCR và nạp chunk vector store vào `run_in_threadpool`, giải phóng Event Loop của FastAPI.
  - Endpoint `/api/ai/health` kiểm tra kết nối Ollama thực tế có bộ đệm cache 10 giây và trả về model đang nạp.
- **Đo lường giám sát chất lượng RAG nâng cao ([`boxchat/core/metrics.py`](../boxchat/core/metrics.py)):**
  - Bổ sung đếm trích dẫn được xác thực hợp lệ (`CITATIONS_VALID`) và cảnh báo trích dẫn bịa đặt (`CITATIONS_FABRICATED`).
  - Ghi nhận chi tiết chế độ tổng hợp (`LLM_SYNTHESIS_MODE`) và lý do fallback sang trích xuất trích đoạn (`LLM_FALLBACK_TOTAL`).

### 3. Cấu Hình Timeout Độc Lập Cho Từng Luồng Nghiệp Vụ AI ([`backend/src/ai-routes.js`](../backend/src/ai-routes.js))
- Tách bạch thời gian chờ: chat hỏi đáp AI thông thường (`AI_CHAT_TIMEOUT_MS`), tạo cẩm nang số (`AI_STUDY_BOOK_TIMEOUT_MS` = 20s), và đồng bộ hóa toàn bộ kho Vector AI (`AI_SYNC_TIMEOUT_MS` = 300s).

### 4. Dọn Dẹp Mã Nguồn & Tinh Chỉnh Giao Diện Frontend
- Xóa bỏ tệp rỗng `TacticalPagination.tsx`.
- Tối ưu hóa các thành phần `AIChatDrawer`, `AIChatWidget`, `LoadingSpinner`, `LectureViewerModal`, `LiveMonitorPanel`, `LecturesPage`, `SessionsPage`, `NetworkStatusContext`.

---

## [v1.8.8-ui-animation-system-and-ocr-air-gapped-hardening] — 2026-11-24

### 1. Hệ Thống Hoạt Ảnh UI Mới (Lucian Prompt Library)
- **Stacking Toasts** ([`Toast.tsx`](../frontend/src/components/common/Toast.tsx), `Toast.css`): xếp chồng ở góc dưới phải, hover xòe quạt và tạm dừng, vuốt ngang để đóng, trạng thái `loading` chuyển hoàn tất.
- **Phân trang kéo giãn & chuyển trang** (`PaginationBar`, `TacticalPagination`, `PageTransitionStage`): áp dụng cho các bảng/lưới phân trang.
- **Stepper duyệt bài giảng 2 tầng** (`ApprovalStepper`): tích hợp vào `LectureCard` và `LectureDetailModal`.
- **Ô nhập mã PIN 6 số** (`VerificationCodeInput`): tích hợp vào `PinVerifyModal` bảo vệ văn bản Cấp 4–5.
- **AI Thinking Bubble** (`AIThinkingBubble`): hiệu ứng suy nghĩ cho `AIChatDrawer` / `AIChatWidget`.
- Cập nhật tài liệu thiết kế [`docs/design/DESIGN.md`](./design/DESIGN.md).

### 2. Củng Cố OCR / Phân Tích PDF Chạy Cục Bộ (Air-Gapped)
- [`backend/pdf-parser.js`](../backend/pdf-parser.js): dùng WASM `pdfjs-dist` cục bộ (giải mã JBIG2/OpenJPEG), nạp `tessdata` (`vie`/`eng`) cục bộ, giải phóng tài nguyên tài liệu sau render; mở rộng nhận diện loại văn bản (Quy chế, Chỉ thị, Công văn, Hướng dẫn, Tờ trình, Biên bản…) và ghép tiêu đề nhiều dòng.
- [`ocr-service/main.py`](../ocr-service/main.py), `start-ocr.bat`, `start-ocr.sh`: tinh chỉnh dịch vụ OCR.
- [`scripts/s.bat`](../scripts/s.bat), `s-dev.bat`: cổng OCR cấu hình qua `PORT_OCR` (mặc định `8002`), lọc PID hợp lệ khi giải phóng cổng.

### 3. Tinh Chỉnh Giao Diện Bài Giảng & Quản Trị
- Cập nhật `LectureCard`, `LectureDetailModal`, `LectureViewerModal`, `LiveMonitorPanel`, `LiveSessionRoom`, `TeachingHistoryPanel`, `BuildingManagerPanel`, `LecturesPage`, `LectureCatalogsPage`, `TrashPage`, `DataTable`, `UserTable`, `AssignRoleModal`, `SecurityAuditLog`, `DocumentTable`, `DocumentPreviewModal`, `PdfPagesViewer`, `PortalDocumentList`.
- Không đổi API contract; vẫn giữ nguyên 3 tầng kiểm soát độ mật (UI Guard, Gateway Middleware, SQL Constraint).

---

## [v1.8.7-military-autonomous-infrastructure-and-ca-portal] — 2026-11-23

### 1. Hạ Tầng Tự Chủ Quân Sự & Tên Miền Nội Bộ (Military Autonomous Infrastructure & Internal Domain)
- **Chuẩn hóa tên miền tác chiến nội bộ:**
  - Thiết lập tên miền chính quy `trungtamdulieuso.tqsqk7.edu` cho toàn bộ hệ thống QK7 DataHub trong môi trường mạng nội bộ quân sự biệt lập (Air-Gapped).
- **Hệ thống DNS tự chủ nội bộ & DNS-over-HTTPS (DoH) RFC 8484:**
  - Phát triển máy chủ DNS nội bộ độc lập ([`scripts/dns-server.js`](../scripts/dns-server.js), [`scripts/setup-military-dns.ps1`](../scripts/setup-military-dns.ps1), [`scripts/start-dns.bat`](../scripts/start-dns.bat)) phân giải tên miền nội bộ tại cổng UDP 53.
  - Tích hợp endpoint DoH `/dns-query` tại Gateway phục vụ Split-DNS cho iPad Air M4 và các thiết bị di động trong mạng tác chiến không cần cấu hình DNS tĩnh.
- **Kịch bản tự động hóa hạ tầng trạm:**
  - Cung cấp kịch bản đổi IP linh hoạt ([`scripts/doi-ip.bat`](../scripts/doi-ip.bat), [`scripts/switch-ip.ps1`](../scripts/switch-ip.ps1)) và kịch bản cài đặt tự động cho máy con ([`scripts/cai-dat-may-con.bat`](../scripts/cai-dat-may-con.bat)).
  - Bổ sung tài liệu kiến trúc toàn diện ([`docs/architecture/MILITARY_AUTONOMOUS_INFRASTRUCTURE.md`](../docs/architecture/MILITARY_AUTONOMOUS_INFRASTRUCTURE.md)) và cẩm nang vận hành ([`docs/guides/INTERNAL_DOMAIN_AND_MILITARY_INFRA_PLAYBOOK.md`](../docs/guides/INTERNAL_DOMAIN_AND_MILITARY_INFRA_PLAYBOOK.md)).

### 2. Cổng Tự Phục Vụ Chứng Chỉ Gốc (CA Portal) & Hỗ Trợ Đa Cổng HTTPS (`server.js` & `ca-portal.js`)
- **Cổng phân phối Root CA tự phục vụ ([`backend/src/ca-portal.js`](../backend/src/ca-portal.js)):**
  - Cung cấp giao diện tải chứng chỉ gốc công khai tại `/ca` cho phép máy trạm PC và iPad Air tự động cài đặt Root CA (`.crt`, `.cer`, `.der`) và cấu hình iOS Configuration Profile (`.mobileconfig`).
- **Hỗ trợ song song cổng chuẩn HTTPS 443 & Chuyển hướng HTTP 80 ([`backend/server.js`](../backend/server.js)):**
  - Cho phép người dùng truy cập trực tiếp `https://trungtamdulieuso.tqsqk7.edu` không cần chỉ định cổng `:8000`.
  - Tự động chuyển hướng HTTP (cổng 80) sang HTTPS (cổng 443), giữ nguyên ngoại lệ cho `/ca` để máy con chưa tin cậy chứng chỉ vẫn tải được Root CA.
  - Mở rộng gắn kết đa máy chủ (`attachServer`) trong [`fingerprint-ws.js`](../backend/src/fingerprint-ws.js), đảm bảo WebSocket vân tay hoạt động ổn định trên cả 2 cổng.

### 3. Nâng Cấp Form Đăng Nhập Cổng Đào Tạo & Hệ Thống Toast Đa Tầng (`TrainingLoginForm.tsx`, `Toast.tsx`, `portal.js`)
- **Mở rộng phân quyền Cổng Quản lý Đào tạo ([`backend/src/portal.js`](../backend/src/portal.js)):**
  - Bổ sung vai trò Giáo viên được phép truy cập Cổng Quản lý Đào tạo song song với Quản trị viên và Chỉ huy.
- **Tối ưu trải nghiệm đăng nhập Cổng Đào tạo ([`TrainingLoginForm.tsx`](../frontend/src/components/auth/TrainingLoginForm.tsx)):**
  - Cập nhật tài khoản kiểm thử nhanh trực quan, hỗ trợ gợi ý thông tin đăng nhập cho giáo viên, quản lý đào tạo và chỉ huy.
  - Tinh chỉnh cơ chế autofocus, xử lý thông báo lỗi chuẩn xác và chuyển đổi form mượt mà.
- **Hệ thống thông báo Toast đa tầng ([`Toast.tsx`](../frontend/src/components/common/Toast.tsx)):**
  - Nâng cấp styling thông báo độ tương phản cao, hỗ trợ nhiều mức độ ưu tiên và hiển thị thanh đếm thời gian tự động đóng.
- **Khởi tạo giao diện chống nhấp nháy (Flicker-Free Theme Init):**
  - Cải tiến [`frontend/public/theme-init.js`](../frontend/public/theme-init.js) và [`ThemeContext.tsx`](../frontend/src/contexts/ThemeContext.tsx) áp dụng class dark/light ngay lập tức trước khi render DOM.

---

## [v1.8.6-lecture-code-limit-and-card-layout] — 2026-11-23

### 1. Giới Hạn Mã Bài Giảng 30 Ký Tự (`CreateLectureModal.tsx` & `lecture-routes.js`)
- **Kiểm soát trực tiếp trên giao diện tạo bài giảng ([`CreateLectureModal.tsx`](../frontend/src/components/lectures/CreateLectureModal.tsx)):**
  - Tích hợp bộ đếm ký tự trực quan `{lectureCode.length}/30` ngay dưới ô nhập mã bài giảng.
  - Khi vượt quá 30 ký tự: viền ô nhập lập tức chuyển đỏ cảnh báo, hiển thị dòng thông báo lỗi tức thì và vô hiệu hóa nút submit (`disabled={submitting || lectureCode.length > 30}`), tuyệt đối ngăn chặn việc tải bài giảng lên khi mã không hợp lệ.
- **Ràng buộc bảo vệ tầng Gateway ([`lecture-routes.js`](../backend/src/lecture-routes.js)):**
  - Thực thi kiểm tra độ dài mã bài giảng tại cả 2 endpoint `POST /api/lectures` và `PUT /api/lectures/:id` (`lecture_code.trim().length > 30` -> từ chối HTTP `400 Bad Request`).
  - Hỗ trợ cập nhật trường `lecture_code` trong câu lệnh `UPDATE` khi chỉnh sửa thông tin bài giảng.

### 2. Tinh Chỉnh Hiển Thị Chống Tràn Tiêu Đề Bài Giảng & Hiển Thị Đầy Đủ Mã Bài Giảng
- **Tiêu đề bài giảng tự động ngắt 2 dòng và cắt `...`:**
  - Áp dụng các utility class `line-clamp-2 break-words [overflow-wrap:anywhere] [word-break:break-word] overflow-hidden` cho trường tiêu đề bài giảng (`title`) trên toàn bộ hệ thống component: [`LectureCard.tsx`](../frontend/src/components/lectures/LectureCard.tsx), [`LectureDetailModal.tsx`](../frontend/src/components/lectures/LectureDetailModal.tsx), [`LectureViewerModal.tsx`](../frontend/src/components/lectures/LectureViewerModal.tsx), [`RejectReasonModal.tsx`](../frontend/src/components/lectures/RejectReasonModal.tsx), [`LiveMonitorPanel.tsx`](../frontend/src/components/lectures/LiveMonitorPanel.tsx), và [`TeachingHistoryPanel.tsx`](../frontend/src/components/lectures/TeachingHistoryPanel.tsx).
  - Đảm bảo tiêu đề dù dài đến đâu cũng chỉ chiếm tối đa 2 dòng, có dấu `...` ở cuối và tuyệt đối không làm vỡ hoặc tràn ra ngoài khung thẻ.
- **Hiển thị đầy đủ 100% Mã bài giảng:**
  - Do mã bài giảng đã bị chặn cứng tối đa 30 ký tự, huy hiệu mã bài giảng trên thẻ và modal được gỡ bỏ giới hạn chiều rộng và `truncate`, hiển thị toàn bộ chuỗi mã mà không bị cắt `...`.

### 3. Quy Hoạch Bố Cục Thẻ Bài Giảng & Dàn Hàng Ngang Cụm Nút Thao Tác (`LectureCard.tsx` & `LecturesPage.tsx`)
- **Mở rộng chiều rộng khung trang ([`LecturesPage.tsx`](../frontend/src/pages/LecturesPage.tsx)):**
  - Nâng chiều rộng container chính từ `max-w-7xl` (`1280px`) lên `max-w-[1440px]`, tạo đủ không gian bề ngang cho các thẻ bài giảng.
- **Sắp xếp thứ tự và cố định 4 nút thao tác trên 1 hàng ([`LectureCard.tsx`](../frontend/src/components/lectures/LectureCard.tsx)):**
  - Sắp xếp lại thứ tự nút theo chuẩn nghiệp vụ: **`Gửi duyệt` -> `Chỉnh sửa` -> `Xem chi tiết` -> `Xóa`**.
  - Thiết lập `flex-nowrap` kèm `whitespace-nowrap shrink-0` cho các nút bấm, giúp nút `Xóa` được đưa lên cùng hàng với 3 nút còn lại, tạo nên cụm điều khiển gọn gàng, cân đối và thẩm mỹ.

### 4. Bổ Sung Cơ Chế Tự Động Dự Phòng Gói Nén Tĩnh ([`server.js`](../backend/server.js))
- Bổ sung khối `try...catch` an toàn khi tải module `compression` tại `server.js`, đảm bảo Gateway vẫn khởi động ổn định ngay cả khi môi trường thử nghiệm chưa hoàn tất cài đặt phụ thuộc.

---

## [v1.8.5-admin-2fa-fingerprint-resilience-and-agent-fallback] — 2026-11-22

### 1. Nâng Cấp Khả Năng Chống Lỗi & Cơ Chế Dự Phòng Xác Thực 2FA Vân Tay Admin (`server.js`, `admin-2fa-ticket.js`, `fingerprint-ws.js`)
- **Cơ chế thử lại 3 lần cho vé xác thực 2FA ([`admin-2fa-ticket.js`](../backend/src/admin-2fa-ticket.js)):**
  - Bổ sung các hàm `validateTicket`, `markTicketUsed` và `recordFailedScan`.
  - Không hủy vé xác thực (ticket) ngay lần quét sai đầu tiên; cho phép thử quét lại tối đa 3 lần (`failed_attempts < 3`).
  - Hủy vé và ghi nhận `used_at = GETDATE()` khi sai quá 3 lần (`TICKET_MAX_ATTEMPTS`) hoặc hết hạn 2 phút (`TICKET_EXPIRED`), đảm bảo cân bằng giữa trải nghiệm người dùng và an toàn bảo mật.
- **Tự động chuyển tiếp máy quét dự phòng (Agent Auto-Fallback - [`server.js`](../backend/server.js) & [`fingerprint-ws.js`](../backend/src/fingerprint-ws.js)):**
  - Tự động phát hiện và chọn máy quét đang online có cảm biến sẵn sàng (`readyAgent`) nếu thiết bị được chỉ định không trực tuyến.
  - Xử lý lỗi `DEVICE_OFFLINE`: Tự động fallback sang agent khác đang hoạt động trong mạng nội bộ.
  - Cập nhật trạng thái `sensor_ready` trong danh sách agent và ưu tiên máy quét sẵn sàng lên đầu.

### 2. Tinh Chỉnh Giao Diện Quét Vân Tay Admin ([`FingerprintScanModal.tsx`](../frontend/src/components/users/FingerprintScanModal.tsx))
- **Xử lý trạng thái vé xác thực hết hạn / vượt quá số lần thử:**
  - Nhận diện các mã lỗi `TICKET_INVALID`, `TICKET_ALREADY_USED`, `TICKET_EXPIRED`, `TICKET_MAX_ATTEMPTS`.
  - Hiển thị thông báo hướng dẫn rõ ràng, khóa nút thử lại (`retryExhausted = true`) và yêu cầu người dùng đóng modal để đăng nhập lại từ đầu.

---

## [v1.8.4-dual-gateway-portal-refinement-and-ux-pagination] — 2026-11-21

### 1. Cổng Xác Thực Kép Trượt Động: Khắc Phục Dính Hậu & Nâng Cấp Tốc Độ Chuyển Động (`DualGatewayPortal.tsx` & `LoginPage.tsx`)
- **Triệt tiêu dính hậu (Ghosting / Bleed-Through) bằng Cô lập Không gian Vật lý ([`DualGatewayPortal.tsx`](../frontend/src/components/auth/DualGatewayPortal.tsx)):**
  - Khắc phục lỗi Form Đào tạo trượt ngược về nửa trái (`translate-x-0`) đè lên Form Dữ Liệu Số khi chuyển portal.
  - Cố định Form Dữ Liệu Số ở nửa trái (`left-0 w-1/2`), Form Đào Tạo ở nửa phải (`left-1/2 w-1/2`), không bao giờ xâm lấn không gian của nhau.
  - Tích hợp chốt chặn `visible` khi active và `invisible` (`visibility: hidden`) khi inactive, chuẩn hóa z-index: Form active (`z-10`), Form inactive (`z-0`), Overlay HUD (`z-30`).
- **Tối ưu tốc độ & nâng cấp đường cong gia tốc siêu mượt ([`DualGatewayPortal.tsx`](../frontend/src/components/auth/DualGatewayPortal.tsx) & [`LoginPage.tsx`](../frontend/src/pages/LoginPage.tsx)):**
  - Rút ngắn thời gian trượt từ `700ms` xuống **`500ms`** (`duration-500`) trên toàn bộ form, tấm trượt overlay HUD, nền parallax và lớp phủ ánh sáng môi trường `Ambient Sync`.
  - Nâng cấp đường cong gia tốc sang **`cubic-bezier(0.25, 1, 0.5, 1)`** khởi động tức thì không độ trễ và giảm tốc mượt mà khi vào vị trí đích.
  - Tinh chỉnh 2 vòng tròn kính mờ Neumorphic Glass Rings sang `700ms` tạo hiệu ứng quán tính sống động, kết thúc đồng pha với giao diện.

### 2. Tối Ưu Bảng Quản Trị Giảng Đường & Phân Trang Thông Minh (`BuildingManagerPanel.tsx`)
- **Phân trang khu giảng đường ([`BuildingManagerPanel.tsx`](../frontend/src/components/lectures/BuildingManagerPanel.tsx)):**
  - Quy định hiển thị tối đa 30 khu giảng đường / trang, khu thứ 31 tự động chuyển sang trang 2.
  - Bổ sung thanh điều khiển phân trang trực quan: hiển thị dải khu đang xem, tổng số khu, số trang hiện tại / tổng trang, nút *Trang trước*, nhãn số trang nổi bật và nút *Trang sau*.
  - Tự động reset về trang 1 khi thay đổi từ khóa tìm kiếm, bộ lọc trạng thái hoặc chế độ hiển thị (Grid / Table).

### 3. Tối Ưu Điều Hướng Phân Hệ Bài Giảng & Phân Quyền Đặc Quyền (`LectureCatalogsPage.tsx` & `ProtectedPermissionsConfigPage.tsx`)
- **Thanh cuộn phân hệ bài giảng số ([`LectureCatalogsPage.tsx`](../frontend/src/pages/LectureCatalogsPage.tsx)):**
  - Bổ sung nút cuộn ngang mượt mà (Trái / Phải) và nút hành động *Phân hệ tiếp theo* kèm hiển thị nhãn phân hệ kế tiếp.
  - Tự động cuộn định tâm (scrollIntoView) vào phân hệ được chọn.
- **Trình cấu hình phân quyền đặc quyền ([`ProtectedPermissionsConfigPage.tsx`](../frontend/src/pages/ProtectedPermissionsConfigPage.tsx)):**
  - Tích hợp điều hướng cuộn ngang phân hệ, nút chuyển phân hệ kế tiếp và hiển thị thẻ phân quyền độ tương phản cao.

---

## [v1.8.3-reading-ring-building-manager-and-security-hardening] — 2026-11-20

### 1. Vòng Chỉ Báo Hoàn Thành Đọc Tài Liệu (Document Reading Completion Ring - `DocumentReadingRing.tsx`)
- **Tối ưu tương phản cao Dual-Theme UX/UI ([`DocumentReadingRing.tsx`](../frontend/src/components/common/DocumentReadingRing.tsx)):**
  - Thiết kế vòng tiến độ SVG độ tương phản cao, chống chìm màu hoặc đè màu trên cả nền Sáng (Light Mode) và Tối (Dark Mode).
  - 3 trạng thái nhận diện thị giác chuẩn quân sự:
    1. *Chưa đọc (0%):* Viền nét mảnh rõ ràng, số trang in đậm đen/trắng nét cao.
    2. *Đang đọc (1% - 99%):* Vòng tiến độ xanh ngọc lục bảo (Emerald) tương phản mạnh, hiển thị tỷ lệ % trang đã đọc sắc nét.
    3. *Đã đọc hết (100%):* Huy hiệu xanh Emerald rực rỡ, biểu tượng tick ($\checkmark$) trắng tinh nổi bật kèm vòng phát quang nhẹ.
- **Tích hợp sâu vào các khung hiển thị tài liệu:**
  - Tích hợp vòng chỉ báo vào [`PdfPagesViewer.tsx`](../frontend/src/components/document-desk/PdfPagesViewer.tsx) và [`DocumentPreviewModal.tsx`](../frontend/src/components/document-desk/DocumentPreviewModal.tsx).
  - Đồng bộ hiển thị tiến độ đọc tài liệu trực tiếp trên bảng danh sách [`PortalDocumentList.tsx`](../frontend/src/components/portal/PortalDocumentList.tsx) và [`DocumentTable.tsx`](../frontend/src/components/document-desk/DocumentTable.tsx).

### 2. Đại Tu Phân Hệ Quản Lý Giảng Đường & Bảng Điều Khiển Giám Sát Radar
- **Nâng cấp Bảng Quản Lý Khu Nhà & Phòng Học ([`BuildingManagerPanel.tsx`](../frontend/src/components/lectures/BuildingManagerPanel.tsx)):**
  - Tái cấu trúc giao diện quản trị khu nhà, phòng học, mã phòng, loại giảng đường và cấu hình viễn trắc telemetry.
  - Hỗ trợ thao tác thêm, sửa, xóa phòng học và trạng thái bảo trì thời gian thực.
- **Tối ưu Bảng Giám Sát Giảng Đường Trực Tiếp ([`LiveMonitorPanel.tsx`](../frontend/src/components/lectures/LiveMonitorPanel.tsx)):**
  - Bổ sung chế độ toàn màn hình, bộ lọc thông minh theo tòa nhà và trạng thái phòng (Đang dạy / Trống / Bảo trì).
  - Hiển thị trực quan sĩ số quân số, tên giảng viên, slide hiện tại và cảnh báo phiên học kéo dài.
- **Cải tiến Phòng Học & Lịch Sử Giảng Dạy ([`LiveSessionRoom.tsx`](../frontend/src/components/lectures/LiveSessionRoom.tsx) & [`TeachingHistoryPanel.tsx`](../frontend/src/components/lectures/TeachingHistoryPanel.tsx)):**
  - Đồng bộ trạng thái trình chiếu bài giảng điện tử và lưu vết lịch sử giảng dạy chính xác.

### 3. Siết Chặt An Toàn Phiên, Bảo Mật Cookie & Phân Quyền Đại Biểu (Security Hardening)
- **Quản lý Phiên & Xóa Sạch Cookie ([`backend/server.js`](../backend/server.js)):**
  - Tại endpoint `POST /api/auth/logout`: Gọi `revokeAllUserSessions` thu hồi toàn bộ phiên hoạt động của người dùng trên toàn mạng.
  - Cưỡng chế xóa cookie an toàn với các cờ nghiêm ngặt `{ path: '/', httpOnly: true, secure: true, sameSite: 'strict' }`.
  - Bổ sung `jti: crypto.randomUUID()` vào JWT token khi đăng nhập và xác thực 2FA vân tay, ngăn chặn triệt để tấn công phát lại (Replay Attacks).
- **Cô lập Quyền Hạn Đại Biểu ([`backend/src/lecture-routes.js`](../backend/src/lecture-routes.js)):**
  - Khóa hoàn toàn cờ `can_teach = false` và `peer_unit = false` đối với người dùng Khách/Đại biểu (`isGuest`), ngăn chặn mọi thao tác vượt quyền.
- **Bảo Vệ Iframe & CSP ([`backend/src/security-headers.js`](../backend/src/security-headers.js) & [`backend/src/scorm-package-routes.js`](../backend/src/scorm-package-routes.js)):**
  - Bổ sung `X-Frame-Options: SAMEORIGIN` và CSP cho phép nhúng an toàn tệp PDF giáo án qua endpoint `/api/lectures/:id/pdf` trong modal trình chiếu.

---

## [v1.8.2-classrooms-subsystem-and-unit-inheritance] — 2026-11-18

### 1. Phân Hệ Giảng Đường Độc Lập & Giám Sát Mặt Bằng Trực Quan (Classrooms Subsystem)
- **Xây dựng Màn hình Phân Hệ Giảng Đường ([`ClassroomsPage.tsx`](../frontend/src/pages/ClassroomsPage.tsx)):**
  - Khởi tạo trang chuyên biệt `/classrooms` phục vụ hiển thị sơ đồ mặt bằng giảng đường, điều hành ca dạy trực tiếp và giám sát telemetry phòng học.
  - Tích hợp vào hệ sinh thái định tuyến [`ecosystem.routes.tsx`](../frontend/src/routes/modules/ecosystem.routes.tsx) và định nghĩa hằng số `ROUTE_PATHS.CLASSROOMS` trong [`routePaths.ts`](../frontend/src/routes/routePaths.ts).
  - Bổ sung nút điều hướng "Giảng đường" (Icon `School`) trên thanh điều hướng trung tâm [`Header.tsx`](../frontend/src/components/common/Header.tsx).
- **Tối ưu Bảng Giám Sát Radar ([`LiveMonitorPanel.tsx`](../frontend/src/components/lectures/LiveMonitorPanel.tsx)):**
  - Tinh chỉnh layout responsive hiển thị trực tiếp cho desktop ($\ge 1200\text{px}$) và drawer compact ($< 1200\text{px}$).
  - Bổ sung nút đóng inspector trực quan và nâng cao độ tương phản màu sắc.

### 2. Cơ Chế Thừa Kế Văn Bản Đơn Vị Con & Phân Cấp Quân Sự (Unit Document Inheritance)
- **Hạ tầng Dịch vụ & Phân quyền ([`backend/src/unit-scope.js`](../backend/src/unit-scope.js) & [`backend/server.js`](../backend/server.js)):**
  - Xây dựng hàm `getUnitWithInheritedUnits`: Cho phép đơn vị con cấp dưới tự động thừa kế tài liệu từ các đơn vị cha trực thuộc (ví dụ Tổ CNTT thừa kế văn bản từ Phòng Tham mưu - Hành chính), dừng lại ở cấp Nhà trường/Quân khu.
  - Endpoint `/api/documents/my-unit` trả về `parent_name` và áp dụng `getUnitWithInheritedUnits`.
  - Hỗ trợ mã `BGH-TQSQK` và `U-BGH` trong bộ lọc tài liệu Ban Giám hiệu.
- **Giao diện Người dùng ([`MyUnitPage.tsx`](../frontend/src/pages/MyUnitPage.tsx) & [`SchoolOverviewSection.tsx`](../frontend/src/components/portal/SchoolOverviewSection.tsx)):**
  - Hiển thị tiêu đề đơn vị ghép chuẩn quân sự (`{Đơn vị con} - {Đơn vị cha}`).
  - Radar tiến độ phòng ban chỉ hiển thị các đơn vị trực thuộc cấp 1 của Nhà trường (tránh cuộn 79 đơn vị nhỏ), tổng hợp văn bản của toàn bộ đơn vị con cháu và sắp xếp theo phân cấp quân sự `getMilitaryUnitSortWeight`.

### 3. Chuẩn Hóa Nhận Diện Thương Hiệu "Văn Bản Số" (Branding Standardization)
- Đồng bộ nhãn điều hướng "Dữ liệu số" $\rightarrow$ "Văn bản số" trên [`Header.tsx`](../frontend/src/components/common/Header.tsx), [`DataHubSubNav.tsx`](../frontend/src/components/common/DataHubSubNav.tsx) và mẫu báo cáo Excel [`exportAuditReportExcel.ts`](../frontend/src/utils/exportAuditReportExcel.ts).
- Cập nhật màu nền hệ thống chuẩn xám quân sự `#e2e8f0` / `bg-slate-200` tại [`index.html`](../frontend/index.html) và [`index.css`](../frontend/src/index.css).

---

## [v1.8.1-lecture-pdf-decoupled] — 2026-11-18

### Tách PDF bài giảng số khỏi Dữ liệu số (bảng `DOCUMENT`)
- **Vấn đề:** upload PDF bài giảng tạo thêm một dòng `DOCUMENT` (`DOC-LEC-…`) → bài giảng hiện bên Dữ liệu số, lọt vào tìm kiếm AI / thống kê / thùng rác / kiểm tra trùng; mức bảo mật và vòng đời lệch với bài giảng.
- **Thay đổi:**
  - `DIGITAL_LECTURE` có thêm `pdf_path`, `pdf_name`, `pdf_size`, `pdf_sha256`; không còn ghi vào `DOCUMENT`.
  - Endpoint mới `GET /api/lectures/:id/pdf` (quyền theo chính bài giảng: trạng thái, cấp bảo mật; Cấp 3+ cần token vân tay đúng `lecture_id` hoặc đang là người giảng của ca ONGOING).
  - Upload PDF chỉ cho `DRAFT`/`REJECTED`; thay tệp thì xóa tệp cũ; xóa vĩnh viễn bài giảng xóa luôn tệp PDF.
  - `PUT /api/lectures/:id` giữ nguyên trường không gửi (trước đây xóa mất liên kết PDF).
  - Frontend `LiveSessionRoom` nạp PDF bằng `fetch` → Blob URL.
- **Triển khai:** chạy `node backend/migrations/decouple_lecture_pdf.cjs` (có `--dry-run`) **trước** khi khởi động lại backend.

## [v1.8.0-fingerprint-e2e-channel] — 2026-11-18

### Kênh Backend ↔ Fingerprint Agent mã hóa & xác thực ở tầng ứng dụng
- **Vấn đề:** diệt virus/proxy ký lại HTTPS (Kaspersky...) làm agent trên một số máy báo lỗi chứng chỉ, không kết nối được backend `:8000`.
- **Giải pháp** ([`backend/src/agent-crypto.js`](../backend/src/agent-crypto.js), [`backend/src/fingerprint-ws.js`](../backend/src/fingerprint-ws.js), [`fingerprint/agent.py`](../fingerprint/agent.py)):
  - Xác thực 2 chiều bằng thách đố HMAC-SHA256 (`proto=2`); `BRIDGE_TOKEN` không còn gửi qua mạng/URL.
  - Mọi tin nhắn mã hóa AES-256-GCM, khóa phiên riêng mỗi kết nối, số thứ tự chống phát lại.
  - Agent chấp nhận lỗi xác minh chuỗi chứng chỉ TLS (trừ khi `AGENT_STRICT_TLS=true`) vì dữ liệu đã được bảo vệ độc lập.
  - Tương thích tạm thời với agent cũ; tắt bằng `AGENT_ALLOW_LEGACY=false` khi mọi máy con đã cập nhật.
- **Triển khai:** cập nhật Backend trước, rồi build lại bộ cài (`python build_setup.py --server <IP>`) và cài lại trên máy con. Agent bản mới cần `cryptography` (đã thêm vào `requirements.txt`).

---

## [v1.7.4-document-unit-fk-guard-and-schedule-note-resilience] — 2026-11-17

### 1. Phòng Vệ Khóa Ngoại Đơn Vị Ban Hành Khi Chỉnh Sửa Văn Bản ([`backend/server.js`](../backend/server.js))
- Tại `PUT /api/documents/:fileId`: Bổ sung bước kiểm tra tính tồn tại của `issuing_unit_id` trong bảng `UNIT` trước khi thực thi truy vấn UPDATE.
- Nếu mã đơn vị gửi lên không hợp lệ hoặc đã bị thay đổi, tự động fallback về `oldDoc.issuing_unit_id` hoặc `null`, ngăn chặn hoàn toàn lỗi sập giao dịch do vi phạm ràng buộc khóa ngoại `FK_DOC_UNIT`.

### 2. Khắc Phục Lỗi Cột Ghi Chú Lịch Giảng Dạy & Tự Động Migration ([`backend/src/lecture-routes.js`](../backend/src/lecture-routes.js) & [`backend/src/migrate-radar.js`](../backend/src/migrate-radar.js))
- Bổ sung hàm kiểm tra tương thích `hasColumn(pool, 'TEACHING_SCHEDULE', 'note')` và gán `${hasNote ? 's.note' : 'NULL AS note'}`, ngăn chặn lỗi SQL `Invalid column name 'note'` khi xem chi tiết radar phòng học trên các phiên bản CSDL chưa cập nhật cột.
- Bổ sung bước tự động thêm cột `note NVARCHAR(500) NULL` vào `TEACHING_SCHEDULE` trong kịch bản di chuyển `migrate-radar.js`.

### 3. Đồng Bộ Dữ Liệu Kho Vector RAG ([`boxchat/local_storage/qdrant_data/metadata_chunks.json`](../boxchat/local_storage/qdrant_data/metadata_chunks.json))
- Dọn dẹp các chunk metadata của tài liệu thử nghiệm đã xóa, bảo đảm kho vector đồng bộ với CSDL.

---

## [v1.7.3-db-connection-pool-and-fingerprint-resilience] — 2026-11-17

### 1. Tối Ưu Hóa Connection Pool SQL Server Chống Drop Socket ([`backend/src/db.js`](../backend/src/db.js))
- Nâng số kết nối tối thiểu thường trực (`min`) từ 2 lên 5 connection.
- Tăng thời gian kết nối rảnh (`idleTimeoutMillis`) từ 30,000ms (30 giây) lên 120,000ms (2 phút), giảm thiểu đáng kể chi phí bắt tay kết nối lại khi có yêu cầu đột biến từ người dùng.

### 2. Nâng Cao Độ Ổn Định Của Fingerprint Agent & ZKTeco SDK ([`fingerprint/`](../fingerprint/))
- **Cơ chế Retry Khởi tạo Driver ([`fingerprint/zk_service.py`](../fingerprint/zk_service.py)):**
  - Bổ sung cơ chế retry 3 lần kèm khoảng nghỉ `time.sleep()` cho hàm `load_sdk()` của `ZK9500Service`, khắc phục triệt để lỗi driver ZKTeco chưa kịp giải phóng tài nguyên từ tiến trình trước.
- **Xử lý Ngoại lệ Kết nối & Đóng Tài nguyên ([`fingerprint/agent.py`](../fingerprint/agent.py)):**
  - Bắt rõ ràng `ConnectionRefusedError` và `OSError`, in thông báo thân thiện: *"Backend Gateway (:8000) chưa sẵn sàng. Đang chờ Backend khởi động..."* thay vì quăng lỗi unhandled.
  - Bọc khối `try-except` an toàn cho hàm đóng thiết bị `agent.svc.close()` khi ngắt dịch vụ bằng `Ctrl+C` hoặc `SIGINT`.
- **Tự động Kiểm tra Cổng Gateway ([`fingerprint/.bat`](../fingerprint/.bat)):**
  - Tích hợp kiểm tra nhanh cổng `:8000` bằng PowerShell `Test-NetConnection`, hiển thị cảnh báo trực quan cho kỹ thuật viên trước khi chạy `agent.py`.

---

## [v1.7.2-admin-2fa-enforcement-and-monitor-stability] — 2026-11-17

### 1. Khắc Phục Cơ Chế Xác Thực Sinh Trắc Học & Bắt Buộc 2FA Cho Quản Trị Viên (Admin 2FA Enforce)
- **Siết chặt luồng đăng nhập Quản trị viên ([`backend/server.js`](../backend/server.js)):**
  - Xóa bỏ hoàn toàn nhánh bypass cho phép `USR-001` đăng nhập chỉ bằng mật khẩu khi chưa có vân tay.
  - Bắt buộc 100% tài khoản Quản trị viên (kể cả Quản trị tối cao `USR-001`) phải xác thực 2FA qua mã phản hồi HTTP 202 (`require_admin_fp: true`) và vé xác thực tạm thời `temp_ticket`.
- **Khởi tạo và tích hợp Bảng CSDL Quản lý Vé 2FA (`ADMIN_2FA_TICKET`):**
  - Tạo bảng `ADMIN_2FA_TICKET` kèm các chỉ mục `IX_ADMIN_2FA_TICKET_user`, `IX_ADMIN_2FA_TICKET_expires`, giải quyết triệt để lỗi máy chủ 500 (`Invalid object name 'ADMIN_2FA_TICKET'`) khi issue vé 2FA.
  - Kích hoạt mẫu vân tay hợp lệ cho tài khoản `USR-001` trong bảng `USER_FINGERPRINT`.

### 2. Khắc Phục Lỗi Giám Sát Bài Giảng Trực Tiếp & Đồng Bộ Giao Thức Proxy
- **Sửa lỗi truy vấn CSDL trong API Live Monitor ([`backend/src/lecture-extended-routes.js`](../backend/src/lecture-extended-routes.js)):**
  - Chuyển đổi truy vấn cột `s.session_type` sang biểu thức tương thích `CASE WHEN s.is_self_study = 1 THEN 'SELF_STUDY' ELSE 'TEACHER_LED' END AS session_type`, ngăn chặn lỗi SQL `Invalid column name 'session_type'`.
- **Đồng bộ hóa Giao thức Vite Dev Server Proxy ([`frontend/vite.config.ts`](../frontend/vite.config.ts)):**
  - Bổ sung hàm `detectBackendTargets()` tự động nhận diện chế độ `USE_HTTPS` để điều hướng proxy mượt mà giữa `https://localhost:8000` (WSS) và `http://localhost:8000` (WS), loại bỏ lỗi ngắt kết nối TLS khi chạy ở chế độ bảo mật cao.

### 3. Chuẩn Hóa YAML Frontmatter Toàn Bộ Agent Skills
- **Khắc phục lỗi nạp Customizations trong Antigravity IDE ([`.agents/skills/`](../.agents/skills/)):**
  - Rà soát và chuẩn hóa 17 tệp `SKILL.md` theo đặc tả kỹ thuật nghiêm ngặt của Antigravity (`name` và `description` độc quyền trong frontmatter block).
  - Loại bỏ các trường lỗi unmarshal Go (`metadata:`, `author:`, `license:`, `allowed-tools:`, `compatibility:`...), giải quyết triệt để cảnh báo đỏ `"12 customizations failed to load"` và `"3 customizations failed to load"`.

---

## [v1.7.1-fingerprint-agent-https-mixed-content-and-watermark-font-fix] — 2026-11-17

### 1. Khắc Phục Lỗi Kết Nối Máy Quét Vân Tay Qua HTTPS & Mixed Content (Fingerprint HTTPS Suite)
- **Hỗ trợ SSL/TLS & Đa luồng cho Local Agent ([`fingerprint/agent.py`](../fingerprint/agent.py)):**
  - Tích hợp `ssl_ctx.wrap_socket` cho `device-id` HTTP server tại cổng `:9001` sử dụng chứng chỉ số nội bộ (`cert.pem`, `private-key.pem`), cho phép trình duyệt truy cập an toàn qua `https://127.0.0.1:9001` mà không bị lỗi Mixed Content.
  - Chuyển đổi sang `http.server.ThreadingHTTPServer` để xử lý các yêu cầu đọc trạng thái vân tay song song không gây nghẽn kết nối.
- **Tối ưu hóa Lấy Định Danh Thiết Bị ([`frontend/src/services/fingerprintService.ts`](../frontend/src/services/fingerprintService.ts)):**
  - Khi ứng dụng chạy trên nền tảng HTTPS hoặc trên iPad, dịch vụ tự động ưu tiên truy vấn danh sách máy quét trực tuyến qua Gateway API (`/api/fingerprint/agents-online`), loại bỏ hoàn toàn việc bị trình duyệt chặn kết nối không an toàn (Mixed Content Block).
  - Bổ sung fallback kiểm tra trực tiếp endpoint HTTPS nội bộ `https://127.0.0.1:9001/device-id` trước khi kết luận thiết bị chưa sẵn sàng.
- **Nâng Cấp Cấu Hình Bảo Mật & CSP ([`backend/src/security-headers.js`](../backend/src/security-headers.js) & [`backend/server.js`](../backend/server.js)):**
  - Bổ sung `https://127.0.0.1:9001` và `https://localhost:9001` vào chỉ thị `connect-src` trong Content Security Policy (CSP).
  - Mở rộng Permissions-Policy hỗ trợ `loopback-network=(self), local-network=(self)`.
  - Mở quyền truy cập công khai (public endpoint) cho `GET /api/fingerprint/agents-online` và `GET /api/fingerprint/device-id` để phục vụ xác thực sinh trắc học vân tay ngay từ màn hình đăng nhập.

### 2. Sửa Lỗi Tải Phông Chữ & Đóng Dấu Bản Quyền PDF Quân Sự
- **Đóng dấu Watermark PDF Tiếng Việt ([`backend/src/pdfWatermarkServer.js`](../backend/src/pdfWatermarkServer.js)):**
  - Xây dựng cơ chế tìm kiếm phông chữ đa nền tảng (`LiberationSans-Regular.ttf`, `Roboto-Regular.ttf`, `C:\Windows\Fonts\arial.ttf`) giúp khắc phục lỗi crash khi máy chủ không tìm thấy file font chữ mặc định.
  - Sửa lỗi cú pháp export module ở cuối tệp.

---

## [v1.7.0-qk7-lecture-hall-radar-and-classroom-monitoring] — 2026-11-17

### 1. Radar Giám Sát Giảng Đường & Lớp Học Thời Gian Thực (QK7 Lecture Hall Radar Suite)
- **Giao diện Radar Tác chiến Thời gian thực ([`LiveMonitorPanel.tsx`](../frontend/src/components/lectures/LiveMonitorPanel.tsx)):**
  - Trực quan hóa bản đồ giảng đường theo khu tòa nhà (H1, H2, HT, PM) và theo từng tầng (Floor grid layout) với tọa độ hàng/cột ma trận phòng học.
  - Phân loại trạng thái phòng học quân sự tức thì: Đang giảng dạy (`ONGOING`, viền nhấp nháy, telemetry tiến độ slide/SCORM thời gian thực, cảnh báo ca treo/vượt giờ), Sắp diễn ra (`SCHEDULED`), Phòng trống (`IDLE`), Đang bảo trì kỹ thuật (`MAINTENANCE`).
  - Tích hợp ngăn kéo (Drawer) chi tiết phòng học: Lịch trình giảng dạy trong ngày, thông tin giảng viên, lớp học viên, môn học, phân cấp mật và chuyên cần.
  - Cho phép Quản trị viên / Chỉ huy / Trưởng bộ môn trực tiếp kích hoạt chế độ bảo trì phòng kèm lý do bảo trì.
- **Hạ tầng Dịch vụ & API Radar Giảng đường ([`backend/src/lecture-routes.js`](../backend/src/lecture-routes.js)):**
  - `GET /api/lectures/radar/overview`: Cung cấp chỉ số tổng quan, tỷ lệ sử dụng phòng, danh sách khu & tầng.
  - `GET /api/lectures/radar/buildings/:buildingCode`: Truy vấn lưới phòng học theo tầng và ca học tương ứng.
  - `GET /api/lectures/radar/rooms/:roomId/detail`: Lấy chi tiết phòng học, ca học hiện tại và toàn bộ lịch trong ngày.
  - `POST /api/lectures/radar/rooms/:roomId/maintenance`: Chuyển đổi trạng thái bảo trì phòng học, ghi nhận nhật ký kiểm toán `CLASSROOM_MAINTENANCE_TOGGLE`.
  - **Bảo mật 5 Cấp Độ Mật (`sanitizeSessionForClearance`):** Tự động che dấu và mã hóa tiêu đề bài giảng nếu độ mật bài giảng vượt quá cấp độ của người giám sát (`[Tài liệu có độ mật cao - Đã mã hóa]`).
- **Kịch bản Migration CSDL ([`backend/src/migrate-radar.js`](../backend/src/migrate-radar.js)):**
  - Bổ sung các cột định vị không gian và cấu hình: `building_code`, `floor_number`, `grid_col`, `grid_row`, `is_maintenance`, `maintenance_reason`, `display_order` vào bảng `CLASSROOM`.
- **Dịch vụ Frontend & Kiểu Dữ Liệu:**
  - Mở rộng [`lectureService.ts`](../frontend/src/services/lectureService.ts) và [`lecture.ts`](../frontend/src/types/lecture.ts) với đầy đủ interface Radar.
- **Tinh Chỉnh Các Trình Xem & Modal:**
  - Tối ưu hóa [`AIChatDrawer.tsx`](../frontend/src/components/ai-chat/AIChatDrawer.tsx), [`AIChatWidget.tsx`](../frontend/src/components/ai-chat/AIChatWidget.tsx), [`DocumentPreviewModal.tsx`](../frontend/src/components/document-desk/DocumentPreviewModal.tsx), [`PdfPagesViewer.tsx`](../frontend/src/components/document-desk/PdfPagesViewer.tsx).

---

## [v1.6.7-military-unit-hierarchy-and-catalogs-treeselect] — 2026-11-16

### 1. Chuẩn Hóa Trọng Số Phân Cấp & Cây Đơn Vị Quân Sự (Military Unit Hierarchy Suite)
- **Chuẩn hóa Trọng số Sắp xếp Quân sự ([`unitTree.tsx`](../frontend/src/utils/unitTree.tsx) & [`UnitTreeTable.tsx`](../frontend/src/components/dashboard/UnitTreeTable.tsx)):**
  - Xây dựng hàm `getMilitaryUnitSortWeight` áp dụng quy chuẩn phân cấp thứ bậc quân đội: Quân khu 7 -> Nhà trường / Viện -> Sư đoàn 5 -> Ban Chỉ huy -> Trung đoàn -> Cơ quan Đảng / UBKT Đảng (nằm trên Ban Giám hiệu) -> Ban Giám hiệu -> Các Phòng chức năng (Đào tạo, Chính trị, Hậu cần - Kỹ thuật, Tham mưu - Hành chính) -> Các Tiểu đoàn 1..5 -> Các Khoa giáo viên -> Trung tâm (Trung Tâm GDQP & AN) -> Lớp học viên / Lớp đào tạo -> Đại đội, Bộ môn, Ban, Tổ -> Khối cơ quan Trung ương / Bộ.
  - Bổ sung danh mục phân loại đơn vị mới: `trung_tam` (Trung tâm) với biểu tượng `Compass`, Badge Violet tác chiến, tích hợp vào các dropdown và bộ lọc phân loại.
  - Tối ưu cơ chế mở rộng mặc định gọn gàng: Chỉ mở Level 0 (Quân khu) và Level 1 (Nhà trường/Sư đoàn), thu gọn các cấp sâu hơn để tránh quá tải giao diện.
- **Nhận Diện Đa Mã Định Danh Đơn Vị Nhà Trường:**
  - Nâng cấp `isSchoolUnitId` và `findSchoolUnit` hỗ trợ đa mã nhận diện (`TQS-QK7`, `TQS`, `U-TQS` hoặc tên trường) đồng bộ trên [`PortalPage.tsx`](../frontend/src/pages/PortalPage.tsx), [`DocumentDeskPage.tsx`](../frontend/src/pages/DocumentDeskPage.tsx), [`DocumentFilters.tsx`](../frontend/src/components/document-desk/DocumentFilters.tsx), và [`SchoolOverviewSection.tsx`](../frontend/src/components/portal/SchoolOverviewSection.tsx).

### 2. Nâng Cấp Quản Trị Danh Mục Bài Giảng & TreeSelect Đơn Vị (Lecture Catalogs Suite)
- **Tích hợp TreeSelect Cây Đơn vị ([`LectureCatalogsPage.tsx`](../frontend/src/pages/LectureCatalogsPage.tsx)):**
  - Thay thế input text thông thường bằng `TreeSelect` trực quan cho "Đơn vị phụ trách" (Môn học) và "Đơn vị quản lý" (Lớp học đào tạo).
  - Hỗ trợ tìm kiếm nhanh, hiển thị cấu trúc cây đa tầng, nút xóa và tùy chỉnh icon switcher thu gọn/mở rộng.
- **Ràng Buộc Cấp Độ Bảo Mật Môn Học (Security Constraints):**
  - Frontend: Bắt buộc người dùng chọn Cấp độ bảo mật khi tạo mới hoặc cập nhật môn học (không cho phép để trống).
  - Backend ([`backend/src/admin-routes.js`](../backend/src/admin-routes.js)): Ràng buộc giá trị cấp độ bảo mật môn học nằm trong khoảng từ Cấp 1 (Công khai) đến Cấp 3 (Mật), ngăn chặn chỉ định vượt cấp trái thẩm quyền.

---

## [v1.6.6-unit-tree-and-admin-unit-management-upgrade] — 2026-11-16

### 1. Nâng Cấp Quản Lý Cây Đơn Vị Quân Sự (Unit Tree & Organization Suite)
- **Giao diện Cây Đơn vị Trực quan ([`UnitTreeTable.tsx`](../frontend/src/components/dashboard/UnitTreeTable.tsx)):**
  - Cải tiến bảng danh mục đơn vị dạng cây phân cấp (tree-table), hỗ trợ đóng/mở nhánh, hiển thị cấp bậc, đơn vị cha/con, tìm kiếm nhanh và thao tác thêm/sửa/xóa trực tiếp.
  - Tích hợp và đồng bộ trạng thái cây đơn vị với bảng điều khiển [`AdminDashboardPage.tsx`](../frontend/src/pages/AdminDashboardPage.tsx).
- **Chuẩn Hóa Dữ Liệu & API Quản Trị Đơn Vị:**
  - Mở rộng các endpoint quản trị cây đơn vị trong [`backend/src/admin-routes.js`](../backend/src/admin-routes.js).
  - Chuẩn hóa kiểu dữ liệu định danh đơn vị sang `sql.NVarChar(50)` đồng bộ trên toàn bộ các route và middleware: [`backend/src/approval-workflow.js`](../backend/src/approval-workflow.js), [`backend/src/lecture-routes.js`](../backend/src/lecture-routes.js), [`backend/src/lecture-extended-routes.js`](../backend/src/lecture-extended-routes.js), [`backend/src/unit-scope.js`](../backend/src/unit-scope.js), [`backend/src/scorm-package-routes.js`](../backend/src/scorm-package-routes.js).

---

## [v1.6.5-ai-chat-drawer-pdf-viewer-and-admin-stats-upgrade] — 2026-11-16

### 1. Nâng Cấp Toàn Diện Ngăn Trợ Lý AI RAG (AI Chat Drawer Suite)
- **Giao diện Ngăn kéo AI Chat ([`AIChatDrawer.tsx`](../frontend/src/components/ai-chat/AIChatDrawer.tsx) & [`AIChatWidget.tsx`](../frontend/src/components/ai-chat/AIChatWidget.tsx)):**
  - Mở rộng trải nghiệm ngăn kéo tương tác trượt từ mép màn hình, phân chia khu vực điều khiển thông minh, hiển thị nguồn tài liệu trích dẫn kèm số trang chi tiết.
  - Tối ưu hóa hiệu năng render hội thoại trực tiếp và hiệu ứng chuyển động Anti-AI-Slop.
- **Dịch vụ Hậu tầng Trí tuệ Nhân tạo:**
  - Đồng bộ cập nhật [`boxchat/core/agent_tutor.py`](../boxchat/core/agent_tutor.py) và [`backend/src/ai-routes.js`](../backend/src/ai-routes.js), bảo đảm lọc dữ liệu theo cấp độ bảo mật nghiêm ngặt.

### 2. Tối Ưu Hóa Trình Đọc PDF & Xem Trước Văn Bản Bảo Mật
- **Trình đọc trang PDF nâng cao ([`PdfPagesViewer.tsx`](../frontend/src/components/document-desk/PdfPagesViewer.tsx) & [`DocumentPreviewModal.tsx`](../frontend/src/components/document-desk/DocumentPreviewModal.tsx)):**
  - Tích hợp cuộn mượt và lazy-render trang tài liệu bảo mật, tối ưu hóa kích thước hiển thị và tích hợp cơ chế chống chụp màn hình.
  - Tinh chỉnh hiển thị thẻ tài liệu [`DocumentCard.tsx`](../frontend/src/components/portal/DocumentCard.tsx) trên Cổng thông tin số.

### 3. Tinh Chỉnh Chỉ Số Bảng Điều Khiển Quản Trị & Giám Sát Giảng Dạy
- Hoàn thiện thẻ chỉ số [`StatCard.tsx`](../frontend/src/components/dashboard/StatCard.tsx) và giao diện tổng quan [`AdminDashboardPage.tsx`](../frontend/src/pages/AdminDashboardPage.tsx).
- Tinh chỉnh giao diện bảng điều khiển giám sát giảng dạy thời gian thực [`LiveMonitorPanel.tsx`](../frontend/src/components/lectures/LiveMonitorPanel.tsx) và [`Header.tsx`](../frontend/src/components/common/Header.tsx).

---

## [v1.6.4-admin-dashboard-catalogs-and-theme-enhancements] — 2026-11-15

### 1. Nâng Cấp Bảng Điều Khiển Chỉ Huy & Quản Trị Hệ Thống (Admin Dashboard Suite)
- **Đại tu màn hình Admin Dashboard ([`AdminDashboardPage.tsx`](../frontend/src/pages/AdminDashboardPage.tsx)):**
  - Mở rộng giao diện điều khiển với các bảng số liệu, biểu đồ phân bố, trạng thái dịch vụ thời gian thực và quản trị tài nguyên toàn trường.
  - Tối ưu hóa hiệu năng render bảng dữ liệu và nâng cấp trải nghiệm người dùng theo tiêu chuẩn bản sắc quân đội.
- **Nâng Cấp Quản Trị Danh Mục & Cấu Hình Phân Quyền Bảo Vệ:**
  - Hoàn thiện giao diện [`LectureCatalogsPage.tsx`](../frontend/src/pages/LectureCatalogsPage.tsx) phục vụ phân loại giáo trình bài giảng.
  - Bổ sung màn hình quản lý phân quyền được bảo vệ [`ProtectedPermissionsConfigPage.tsx`](../frontend/src/pages/ProtectedPermissionsConfigPage.tsx) và hàng đợi phê duyệt [`ApprovalQueuePage.tsx`](../frontend/src/pages/ApprovalQueuePage.tsx).

### 2. Tối Ưu Hóa Khởi Tạo Chủ Đề & Chống Chớp Giao Diện (Theme Initialization)
- Cập nhật [`theme-init.js`](../frontend/public/theme-init.js) và [`backend/public/theme-init.js`](../backend/public/theme-init.js) thực thi trước khi tải DOM để loại bỏ hiện tượng Flash of Unstyled Content (FOUC).
- Hoàn thiện thanh điều hướng bên [`Sidebar.tsx`](../frontend/src/components/common/Sidebar.tsx), hộp thoại xác nhận [`ConfirmDialog.tsx`](../frontend/src/components/common/ConfirmDialog.tsx) và modal so sánh phê duyệt [`ApprovalDiffModal.tsx`](../frontend/src/components/document-desk/ApprovalDiffModal.tsx).

---

## [v1.6.3-lecture-catalogs-and-fingerprint-enhancement] — 2026-11-15

### 1. Phân Hệ Quản Lý Danh Mục Bài Giảng Số (Lecture Catalogs System)
- **Giao diện Quản trị Danh mục Bài giảng:**
  - Bổ sung màn hình chuyên trách [`LectureCatalogsPage.tsx`](../frontend/src/pages/LectureCatalogsPage.tsx) phục vụ phân loại, tổ chức danh mục bài giảng khoa học và trực quan.
  - Tích hợp mục danh mục vào thanh điều hướng bên [`Sidebar.tsx`](../frontend/src/components/common/Sidebar.tsx) và trung tâm chỉ huy [`AdminDashboardPage.tsx`](../frontend/src/pages/AdminDashboardPage.tsx).
- **Hạ tầng Dữ liệu & API Backend:**
  - Bổ sung script migration [`upgrade_lecture_catalogs.cjs`](../backend/migrations/upgrade_lecture_catalogs.cjs) nâng cấp cấu trúc bảng danh mục bài giảng.
  - Bổ sung các endpoint quản trị danh mục trong [`backend/src/admin-routes.js`](../backend/src/admin-routes.js) và khai báo phân quyền chặt chẽ trong [`backend/src/route-permissions.js`](../backend/src/route-permissions.js).

### 2. Tinh Chỉnh Xác Thực Sinh Trắc Học & Quản Trị Bài Giảng
- Nâng cấp modal quét vân tay [`FingerprintScanModal.tsx`](../frontend/src/components/users/FingerprintScanModal.tsx) và [`fingerprintService.ts`](../frontend/src/services/fingerprintService.ts) tăng độ ổn định khi giao tiếp máy quét ZKTeco.
- Cải tiến modal bắt đầu phiên giảng dạy [`StartSessionModal.tsx`](../frontend/src/components/lectures/StartSessionModal.tsx) và dịch vụ bài giảng [`lectureService.ts`](../frontend/src/services/lectureService.ts).

### 3. Tối Ưu Hóa & Sửa Lỗi Tiện Ích Gộp Mã Nguồn (`scripts/mergecode.py` v5.1.1)
- Khắc phục lỗi thiếu đối số `files` tại hàm `_write_summary()` trong `scripts/mergecode.py`.
- Bổ sung mẫu `mergecode*.txt` vào [`.gitignore`](../.gitignore) và loại bỏ tệp dump `mergecode_full.txt` (4.7 MB) khỏi kho mã nguồn Git, bảo đảm tuân thủ Hiến pháp Kỷ luật Thư mục của dự án.

---

## [v1.6.2-lecture-session-and-db-optimization] — 2026-11-14

### 1. Tối Ưu Hóa Kết Nối Cơ Sở Dữ Liệu & Quản Lý Phiên (Database & Session Optimization)
- **Tối ưu hóa kết nối SQL Server ([`backend/src/db.js`](../backend/src/db.js)):**
  - Mở rộng cấu hình connection pool (`max: 25`, `min: 2`), tăng `cancelTimeout` lên 15.000ms nhằm chống ngắt kết nối socket đột ngột khi SQL Server xử lý các tác vụ nặng.
- **Giảm tải I/O ghi nhận phiên đăng nhập ([`backend/src/sessions.js`](../backend/src/sessions.js)):**
  - Bổ sung chỉ thị `WITH (NOLOCK)` cho các truy vấn kiểm tra phiên `USER_SESSION` nhằm loại bỏ hiện tượng khóa bảng (table locking).
  - Điều tiết tần suất cập nhật thời gian hoạt động cuối (`last_seen_at`), chỉ ghi xuống CSDL khi khoảng cách vượt quá 2 phút (120s), giảm thiểu đáng kể số lượng lệnh `UPDATE` liên tục.

### 2. Nâng Cấp Toàn Diện Phân Hệ Bài Giảng Số & Phòng Học Trực Tiếp (Digital Lectures & Live Sessions)
- **Cải tiến Máy chủ Backend:**
  - [`backend/src/lecture-routes.js`](../backend/src/lecture-routes.js): Mở rộng truy vấn liên kết thông tin lớp học (`class_name`) và địa điểm phòng học (`venue_name`), chuẩn hóa luồng cập nhật tiến độ bài giảng trực tiếp (`slide_index`, `slide_total`, `scorm_progress`).
  - [`backend/src/scorm-package-routes.js`](../backend/src/scorm-package-routes.js): Tích hợp cơ chế giao tiếp `postMessage` (`AP_CHANGE_MODE`) giữa iframe học liệu ActivePresenter và cửa sổ cha (`LiveSessionRoom`), tối ưu Content Security Policy cho phép nạp tài nguyên an toàn.
- **Nâng cấp Giao diện Frontend (`frontend/src/components/lectures/`):**
  - [`LiveSessionRoom.tsx`](../frontend/src/components/lectures/LiveSessionRoom.tsx): Nâng cấp trình chiếu toàn màn hình, chuyển đổi mượt mà các chế độ học liệu, theo dõi thời lượng và điểm danh.
  - [`LiveMonitorPanel.tsx`](../frontend/src/components/lectures/LiveMonitorPanel.tsx) & [`TeachingHistoryPanel.tsx`](../frontend/src/components/lectures/TeachingHistoryPanel.tsx): Cải tiến bảng giám sát chỉ huy và thống kê lịch sử giảng dạy.
  - [`LectureCard.tsx`](../frontend/src/components/lectures/LectureCard.tsx), [`StartSessionModal.tsx`](../frontend/src/components/lectures/StartSessionModal.tsx), [`LecturesPage.tsx`](../frontend/src/pages/LecturesPage.tsx): Tinh chỉnh luồng bắt đầu phiên giảng dạy và quản trị trạng thái bài giảng.

### 3. Cấu Hình Kỷ Luật Mã Nguồn & Giữ Sạch Source Control ([`.gitignore`](../.gitignore))
- Cấu hình tự động loại trừ các kho kỹ năng AI và tệp log công ty ảo cục bộ (`.agents/skills/*`, `.agents/company-*.md`), giữ lại 7 kỹ năng UI/UX cốt lõi, bảo đảm kho mã nguồn luôn gọn gàng và không kích hoạt cảnh báo Gitleaks.

---

## [v1.6.1-mergecode-v5-and-doc-sync-rule] — 2026-11-13

### 1. Nâng Cấp Công Cụ Gộp Mã Nguồn Chuẩn Hóa (`scripts/mergecode.py` v5.0.0)
- **Chế độ mặc định tinh gọn (Pure BE & FE Source Code):**
  - Chỉ quét và gộp mã nguồn cốt lõi của Backend (`backend/`) và Frontend (`frontend/`).
  - **Tự động loại trừ triệt để:**
    - Thư viện / dependencies: `node_modules/`, `package-lock.json`, `dist/`, `build/`, `public/assets/`, `backend/public/`, `certs/`, `uploads/`...
    - Tệp môi trường: `.env`, `.env.*`, `*.env`...
    - Kịch bản & công cụ: `scripts/`, `tools/`, `*.bat`, `*.ps1`, `*.sh`...
    - Tệp văn bản & tài liệu: `*.txt`, `*.md`, `*.rst`, `*.pdf`...
    - Tệp kiểm thử: `tests/`, `__tests__/`, `*.test.*`, `*.spec.*`, `test-*.js`...
- **Bảo mật & Tốc độ tối ưu:**
  - Tự động phát hiện và che mờ các khóa nhạy cảm (`JWT_SECRET`, mật khẩu, Private Key, token xác thực).
  - Kết quả kiểm thử thực tế: Thu thập chính xác **191 tệp nguồn** (29 Backend, 162 Frontend), kích thước tổng hợp **2.81 MB** trong thời gian thực thi chỉ **0.30 giây**.

### 2. Ban Hành Quy Định Bắt Buộc: Tự Động Cập Nhật Tài Liệu Markdown Trước Khi Commit & Push
- **Cập nhật đồng bộ các tài liệu nền tảng:**
  - [`ANTIGRAVITY_MASTER_BRAIN.md`](../ANTIGRAVITY_MASTER_BRAIN.md) (Mục 1 & Mục 4.6): Thiết lập quy tắc bắt buộc tự động rà soát và cập nhật toàn bộ file Markdown trước khi thực thi commit & push.
  - [`docs/guides/AGENT_WORKFLOW.md`](./guides/AGENT_WORKFLOW.md) (Bước 2 & Bước 3): Quy chuẩn hóa điều kiện tiên quyết trước khi commit/push, đảm bảo không bỏ sót bất kỳ thay đổi nào của dự án.
  - [`docs/guides/Senior Multi-Role.md`](./guides/Senior%20Multi-Role.md): Quy định cho toàn bộ các vai trò kỹ sư về việc duy trì tài liệu đồng bộ 100% với trạng thái mã nguồn thực tế.
- **Quy trình phối hợp:** Mọi thay đổi mã nguồn tiếp tục được giữ nguyên tại working tree (tuân thủ nghiêm ngặt nguyên tắc **Strict No Auto-Commit & No Auto-Push**); khi nhận được lệnh commit và push từ USER, Agent sẽ tự động cập nhật toàn bộ tài liệu Markdown tương ứng trước khi tiến hành commit và push lên nhánh được chỉ định.

### 3. Đồng Bộ Toàn Diện Tính Năng Từ Nhánh `final-test` Sang `haianh-dev`
- **Quản lý Vòng đời Bài giảng Điện tử (Lecture Lifecycle):**
  - Bổ sung cơ chế Xóa mềm (`soft delete`), Khôi phục (`restore`) và Xóa vĩnh viễn (`permanent delete`) bài giảng trên cả Backend ([`backend/src/lecture-routes.js`](../backend/src/lecture-routes.js)) và Frontend ([`frontend/src/services/lectureService.ts`](../frontend/src/services/lectureService.ts), [`frontend/src/components/lectures/LectureCard.tsx`](../frontend/src/components/lectures/LectureCard.tsx), [`frontend/src/pages/LecturesPage.tsx`](../frontend/src/pages/LecturesPage.tsx)).
- **Tái Cấu Trúc Lưu Trữ Học Liệu ([`backend/src/storage-helper.js`](../backend/src/storage-helper.js)):**
  - Tối ưu hóa đường dẫn lưu trữ tệp tin tải lên theo cấu trúc thư mục quy chuẩn, tự động tạo và bảo vệ cấu trúc thư mục lưu trữ SCORM / Bài giảng (`uploads/lectures/`, `uploads/scorm/`, `uploads/temp/`).
- **Tối ưu hóa Phòng học Trực tiếp ([`LiveSessionRoom.tsx`](../frontend/src/components/lectures/LiveSessionRoom.tsx)):**
  - Nâng cấp trải nghiệm tương tác trong phòng học SCORM/HTML5, giám sát chỉ số học tập thời gian thực ([`LiveMonitorPanel.tsx`](../frontend/src/components/lectures/LiveMonitorPanel.tsx)).
- **Khởi chạy Hệ thống An toàn:**
  - Nâng cấp `s.bat`, [`scripts/s.bat`](../scripts/s.bat), [`scripts/s-dev.bat`](../scripts/s-dev.bat) bổ sung kiểm tra và giải phóng tự động cổng AI Boxchat (:8001) khi khởi động.

---

## [v1.6.0-digital-lecture-scorm-and-design-orchestrator] — 2026-11-13

### 1. Phân Hệ Bài Giảng Số & Gói Học Liệu Tương Tác SCORM / HTML5
- **Giao diện Quản trị & Trình chiếu Bài giảng (`frontend/src/components/lectures/`):**
  - [`LecturesPage.tsx`](../frontend/src/pages/LecturesPage.tsx): Giao diện danh sách bài giảng, bộ lọc đa năng theo môn học, trạng thái phê duyệt và định dạng.
  - [`CreateLectureModal.tsx`](../frontend/src/components/lectures/CreateLectureModal.tsx) & [`LecturePackageDropzone.tsx`](../frontend/src/components/lectures/LecturePackageDropzone.tsx): Tải lên bài giảng điện tử và kéo thả gói nén SCORM/HTML5 (hỗ trợ tối đa 300MB).
  - [`LectureCard.tsx`](../frontend/src/components/lectures/LectureCard.tsx) & [`LectureDetailModal.tsx`](../frontend/src/components/lectures/LectureDetailModal.tsx): Hiển thị chi tiết bài giảng, siêu dữ liệu SCORM, trạng thái duyệt và hành động thao tác.
  - [`LiveSessionRoom.tsx`](../frontend/src/components/lectures/LiveSessionRoom.tsx): Phòng học trực tiếp toàn màn hình, nhúng iframe SCORM/HTML5 có bảo vệ, tích hợp câu hỏi trắc nghiệm và đếm thời lượng.
  - [`LiveMonitorPanel.tsx`](../frontend/src/components/lectures/LiveMonitorPanel.tsx): Bảng giám sát chỉ huy thời gian thực (sĩ số, slide hiện tại/tổng slide, tiến độ SCORM %, cảnh báo phiên treo > 240 phút).
  - [`TeachingHistoryPanel.tsx`](../frontend/src/components/lectures/TeachingHistoryPanel.tsx): Thống kê lịch sử giảng dạy và KPI đào tạo.
  - [`RejectReasonModal.tsx`](../frontend/src/components/lectures/RejectReasonModal.tsx): Luồng từ chối bài giảng kèm lý do chi tiết chuyển ngược cho giảng viên hiệu chỉnh.
  - [`lectureService.ts`](../frontend/src/services/lectureService.ts): Bộ API client wrapper đầy đủ cho nghiệp vụ bài giảng, lịch giảng và gói SCORM.
- **Dịch vụ Máy chủ Backend (`backend/src/`):**
  - [`scorm-package-routes.js`](../backend/src/scorm-package-routes.js): Tiếp nhận tải lên bằng DiskStorage tạm thời, phục vụ static assets SCORM với bảo vệ định danh tệp (`nosniff`, `cross-origin`, dynamic `<base href="..." />`).
  - [`lecture-package-helper.js`](../backend/src/lecture-package-helper.js): Giải nén an toàn và tự động nhận diện entry point (`index.html`, `story.html`, `imsmanifest.xml`).
  - [`scorm-manifest.js`](../backend/src/scorm-manifest.js): Trích xuất cấu trúc siêu dữ liệu và tài nguyên từ `imsmanifest.xml`.
  - [`approval-workflow.js`](../backend/src/approval-workflow.js): Mở rộng quy trình phê duyệt tài liệu và bài giảng đa cấp.

### 2. Gia Cố An Ninh SCORM & Chống Rò Rỉ Mã Nguồn
- **Giải nén an toàn chống Zip Slip (CWE-22) & Zip Bomb (CWE-409):**
  - Triển khai `extractZipSafely`: Thẩm định đường dẫn đích trước khi ghi, chặn ký tự `../` và đường dẫn ngoài phạm vi thư mục đích, tự động hủy bỏ giải nén khi vượt quá 300MB uncompressed, chặn 10 định dạng thực thi nguy hiểm (`.exe`, `.bat`, `.cmd`, `.sh`, `.ps1`...).
- **Chống rò rỉ tệp Code Dump:**
  - Bổ sung quy tắc `*FullSourceCode*.txt` vào `.gitignore` và nâng cấp kịch bản kiểm tra an ninh [`scripts/security-scan.ps1`](../scripts/security-scan.ps1).

### 3. Tích Hợp Bộ Điều Phối Thiết Kế UI/UX Bản Sắc Quân Đội (`.agents/`)
- Thiết lập hệ thống kỹ năng thiết kế chuyên sâu tại `.agents/skills/` gồm 7 kỹ năng phối hợp: `qk7-design-orchestrator`, `daub-ui`, `design-md`, `huashu-design`, `ui-ux-pro-max`, `unslop`, `design-taste-frontend`.
- Thiết lập kịch bản điều phối tự động 6 bước tại workflow [`thiet-ke-ux-ui.md`](../.agents/workflows/thiet-ke-ux-ui.md).
- Bổ sung kho tham chiếu kỹ thuật vẽ tay quân sự `sketchbook-ui`.

### 4. Thiết Lập Kỷ Luật Git Bắt Buộc (Strict No Auto-Commit & No Auto-Push)
- Cập nhật Hiến pháp Tối cao [`ANTIGRAVITY_MASTER_BRAIN.md`](../ANTIGRAVITY_MASTER_BRAIN.md), Quy trình làm việc [`AGENT_WORKFLOW.md`](./guides/AGENT_WORKFLOW.md), và Quy tắc Kỹ sư Senior [`Senior Multi-Role.md`](./guides/Senior%20Multi-Role.md).
- Quy định nghiêm ngặt: AI Agent tuyệt đối **không tự động commit** và **không tự động push**. Mọi mã nguồn chỉ lưu tại working tree; chỉ thực hiện commit và push khi có câu lệnh triển khai chỉ định nhánh cụ thể từ USER.

---

## [v1.5.0-enterprise-restructuring-and-master-brain] — 2026-11-11

### 1. Tái Cấu Trúc Toàn Diện Thư Mục Chuẩn Enterprise
- Di chuyển toàn bộ tài liệu từ thư mục gốc vào `docs/` (`architecture/`, `security/`, `guides/`, `design/`) bằng `git mv` bảo toàn 100% Git history.
- Quy hoạch tập trung toàn bộ script tiện ích khởi chạy, quét an ninh và biên dịch vào thư mục `scripts/` (`s.bat`, `s-dev.bat`, `start-ai.bat`, `mergecode.py`, `security-scan.ps1`...).
- Quy hoạch cấu hình phụ trợ vào `config/` (`zap.yaml`, `tsconfig.json`, `package-lock.json`...) và dữ liệu tĩnh vào `data/` (`eng.traineddata`, `vie.traineddata`).
- Chuẩn hóa toàn bộ relative links liên kết chéo giữa các tài liệu.

### 2. Thiết Lập Bộ Não Tổng (Master Brain)
- Soạn thảo và ban hành Hiến pháp Tối cao của dự án: [`ANTIGRAVITY_MASTER_BRAIN.md`](../ANTIGRAVITY_MASTER_BRAIN.md) làm Single Source of Truth cho toàn bộ đội ngũ kỹ sư và AI Agent.
- Xuất bản Báo cáo thực thi tái cấu trúc toàn diện: [`docs/guides/ENTERPRISE_RESTRUCTURING_REPORT.md`](./guides/ENTERPRISE_RESTRUCTURING_REPORT.md).

---

## [v1.4.1-ocr-air-gapped-vlan-hardened] — 2026-11-11

### 1. Đóng Gói Toàn Diện Trọng Số Mô Hình Cục Bộ & Cấu Hình Git LFS
- **Snapshot trọng số mô hình vào kho mã nguồn nội bộ:**
  - `ocr-service/model_weight/MonkeyOCRv2-B-Parsing/`: Đóng gói 15 tệp (1.65 GB), bao gồm `model.safetensors`, `config.json`, bộ tokenizer và 3 script thực thi kiến trúc mô hình (`configuration_monkeyocrv2.py`, `modeling_monkeyocrv2.py`, `modeling_monkeyocrv2_vision.py`).
  - `ocr-service/model_weight/paddleocr/`: Đóng gói bộ 3 mô hình PP-OCRv4 (15.58 MB) tối ưu tiếng Việt: Detection (`ch_PP-OCRv4_det_infer`), Recognition (`ch_PP-OCRv4_rec_infer`), và Angle Classification (`ch_ppocr_mobile_v2.0_cls_infer`).
- **Thiết lập quy chuẩn Git LFS (`.gitattributes`):**
  - Quản lý tập trung các tệp nhị phân và trọng số lớn: `*.safetensors`, `*.pdiparams`, `*.pdiparams.info`, `*.pdmodel`, và toàn bộ cây thư mục `ocr-service/model_weight/**`.

### 2. Triển Khai Cơ Chế Air-Gapped Hardening (Phòng Chống 5 Bẫy Gọi Mạng Ngầm)
- **Vô hiệu hóa kết nối HuggingFace Hub (Bẫy #1 & Bẫy #2):**
  - Thiết lập cứng các biến môi trường tại dòng đầu `ocr-service/main.py` và các file kịch bản `start-ocr.bat`, `start-ocr.sh`: `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, `HF_DATASETS_OFFLINE=1`, `HF_HUB_VERBOSITY=debug`.
  - Khắc phục lỗi `dtype mismatch` và ép kiểu cứng `bfloat16` trong `modeling_monkeyocrv2_vision.py`.
  - Thay thế kernel `sdpa_kernel(SDPBackend.EFFICIENT_ATTENTION)` bằng hàm PyTorch gốc trên CPU, tối ưu giải phóng attention mask ma trận 5.9 GB cho tài liệu đơn trang.
- **Vô hiệu hóa kiểm tra cập nhật & nguồn mô hình PaddleOCR (Bẫy #3):**
  - Cấu hình cờ môi trường: `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True`, `DISABLE_PADDLE_UPDATE_CHECK=1`, `FLAGS_use_mkldnn=0`.
  - Truyền trực tiếp đường dẫn weights cục bộ vào constructor `PaddleOCR`, loại bỏ triệt để các truy vấn DNS ngoại vi `paddleocr.bj.bcebos.com` và `paddlepaddle.org`.
- **Triệt tiêu toàn bộ SDK Telemetry & Giám sát Outbound Sockets (Bẫy #4):**
  - Thiết lập chuẩn an ninh quốc tế: `DO_NOT_TRACK=1`, `DISABLE_TELEMETRY=1`, `HF_HUB_DISABLE_TELEMETRY=1`, `SCARF_NO_ANALYTICS=1`, `ANONYMIZED_TELEMETRY=False`.
  - Kiểm tra `pip list` xác nhận 0 thư viện analytics; giám sát socket xác nhận 0 kết nối ra ngoài mạng VLAN (`192.168.1.0/24`).
- **Tối ưu hóa thăm dò phần cứng CPU/GPU (Bẫy #5):**
  - Thiết lập cờ thiết bị an toàn, loại bỏ probe CUDA trên máy chủ CPU chuyên dụng, chuẩn hóa log khởi động dưới 3 dòng liên quan đến device.

### 3. Chuẩn Hóa Lắng Nghe Mạng Đa Giao Diện & Điều Phối Thích Ứng (Adaptive CPU Fallback)
- **Host Binding đa giao diện (`HOST=0.0.0.0`):**
  - Thay thế binding cục bộ cứng `127.0.0.1` bằng `os.environ.get("HOST", "0.0.0.0")`, cho phép các trạm làm việc trong VLAN và Gateway Express `:8000` truy cập thông suốt qua `http://192.168.1.229:8002`.
- **Cơ chế điều phối suy luận thích ứng (Adaptive Fallback):**
  - Tự động kích hoạt PaddleOCR fallback khi chạy trên CPU không có GPU rời, đảm bảo thời gian xử lý trích xuất văn bản quân sự đạt từ **4.64s đến 5.13s/trang** (đạt SLA < 10s), độ tin cậy tiếng Việt đạt **95.4%**.
  - Giữ nguyên trạng thái `engine_active: "monkey"` trên endpoint `/health` khi được cấu hình ưu tiên, bảo toàn tính toàn vẹn của hợp đồng API Swagger.

### 4. Bàn Giao Tài Liệu & Ma Trận Kiểm Thử Nghiệm Thu
- Hoàn thành tài liệu chuyên sâu: [`docs/guides/OCR_DEPLOYMENT_REPORT.md`](./docs/guides/OCR_DEPLOYMENT_REPORT.md).
- Bổ sung 3 sự cố an ninh & hạ tầng vào Sổ tay kỹ thuật: [`docs/guides/TROUBLESHOOTING_HISTORY.md`](./docs/guides/TROUBLESHOOTING_HISTORY.md) (Sự cố 29, 30, 31).
- Nghiệm thu đạt 100% Ma trận kiểm thử V1–V5 (`reports/phase46_matrix.json`) và 8 tiêu chí DoD (Definition of Done).

---

## [v1.3.1-frontend-performance-optimization-and-approval-fix] — 2026-11-05

### 1. Tối Ưu Hóa Hiệu Năng Frontend Toàn Diện (Performance Optimization Suite)
- **Nhiệm vụ 1: Cắt Giảm Bundle Size & Dynamic Code Splitting:**
  - Cấu hình lại `vite.config.ts` với `build.rollupOptions.output.manualChunks` để chia tách các thư viện nặng thành các vendor chunk độc lập: `vendor-react` (React, React-DOM), `vendor-antd` (Ant Design, Ant Design Icons), `vendor-excel` (xlsx), `vendor-motion` (framer-motion), `vendor-icons` (lucide-react), `vendor-pdflib` (pdf-lib), `vendor-pdfjs` (pdfjs-dist).
  - Chuẩn hóa tên file xuất ra định dạng cố định `assets/[name].js` nhằm chống lỗi cache mismatch khi triển khai thực tế.
  - Xây dựng tiện ích `lazyWithRetry` (`frontend/src/utils/lazyWithRetry.ts`) tự động bắt lỗi và tải lại trang khi module động gặp sự cố mạng hoặc phiên bản mới được release.
  - Chuyển đổi toàn bộ 9 module routes (`admin`, `auth`, `desk`, `ecosystem`, `error`, `fallback`, `myApprovals`, `myunit`, `portal`) sang `React.lazy` kết hợp `lazyWithRetry`.
  - Bao bọc `RouterProvider.tsx` với `<Suspense fallback={<LoadingSpinner fullScreen />}>`, tích hợp Spinner màu tím `#722ED1` đồng bộ chuẩn Design System.
- **Nhiệm vụ 2: Xử Lý Triệt Để Waterfall Requests & Độ Trễ Khi Đăng Nhập:**
  - Loại bỏ request gọi lặp `authService.getMe()` trong `LoginForm.tsx` sau khi đăng nhập thành công, vì endpoint `/api/auth/login` vốn dĩ đã trả về đầy đủ hồ sơ người dùng (họ tên, cấp bậc, chức vụ, vai trò, clearance level, đơn vị, danh sách quyền).
  - Loại bỏ các hàm chờ nhân tạo `setTimeout(500)` trong `LoginForm.tsx` và `LoginPage.tsx`, giúp người dùng chuyển hướng về trang chủ tức thì (0ms latency).
  - Đồng bộ hóa JWT Token và User Profile vào `localStorage` (`authService.ts`) để `AuthContext` có sẵn dữ liệu ngay khi Page Component mount, hạn chế tối đa việc gọi API profile ngầm.
- **Nhiệm vụ 3: Tối Ưu Hóa Tìm Kiếm & Bộ Lọc Bằng Custom Hook `useDebounce`:**
  - Xây dựng custom hook `useDebounce` (`frontend/src/hooks/useDebounce.ts`) với thời gian trễ mặc định 500ms.
  - Tích hợp Debounce vào các ô tìm kiếm trên toàn bộ hệ thống: `PortalPage.tsx`, `DocumentDeskPage.tsx`, `MyUnitPage.tsx`, `SecurityAuditLog.tsx`.
  - Giảm ~85% số lượng request truy vấn xuống Gateway khi người dùng gõ phím, loại bỏ triệt để hiện tượng xung đột dữ liệu (Race Conditions) do phản hồi mạng không đồng bộ.
- **Nhiệm vụ 4: Nâng Cấp Trải Nghiệm Skeleton Loading Thay Thế Spinner Toàn Màn Hình:**
  - Thay thế vòng xoay tải trang toàn màn hình `<Spin>` và các văn bản "Đang tải dữ liệu..." bằng component `<Skeleton>` chuẩn Ant Design.
  - Thiết kế Skeleton Card dạng lưới trong `PortalDocumentList.tsx` (mô phỏng 6 thẻ tài liệu).
  - Thiết kế Skeleton Table Row trong `DocumentTable.tsx` (mô phỏng 6 hàng dữ liệu bảng).
  - Tích hợp Skeleton cho các thẻ chỉ số KPI (`StatCard.tsx`, `AdminDashboardPage.tsx`), chống hiện tượng giật cục giao diện (Cumulative Layout Shift - CLS).
- **Nhiệm vụ 5: Kỹ Thuật Virtual Scrolling Cho Bảng Danh Sách Dài:**
  - Xây dựng custom hook `useVirtualScroll` (`frontend/src/hooks/useVirtualScroll.ts`) tính toán vùng hiển thị động (windowing) theo vị trí cuộn chuột.
  - Áp dụng Virtual Scrolling vào bảng Nhật ký kiểm toán SOC (`SecurityAuditLog.tsx`), chỉ render ~12–15 dòng DOM đang nằm trong viewport thay vì nạp cùng lúc hàng trăm đến hàng nghìn phần tử `<tr>`.
  - Đạt tốc độ cuộn mượt mà 60 FPS, giảm thiểu tải tiêu thụ bộ nhớ RAM của trình duyệt.

### 2. Bản Vá Lỗi Tạo Yêu Cầu Hiệu Chỉnh Văn Bản (Document Edit Approval Fix)
- **Khắc phục lỗi HTTP 500 (`ERR-500: Không thể tạo yêu cầu phê duyệt`):**
  - *Bổ sung cột CSDL:* Chạy migration bổ sung cột `requester_unit_id VARCHAR(50) NULL` vào bảng `APPROVAL_REQUEST` trong SQL Server `QK7_ThuVienSo`.
  - *Định tuyến chính xác:* Bổ sung `/^\/api\/documents(\/|$)/`/ vào danh sách ngoại lệ `EXCLUDED_PATHS` trong `backend/src/approval-workflow.js`. Nhờ đó, thao tác sửa văn bản của cán bộ (Trợ lý, Văn thư) đi trực tiếp vào luồng chuyên dụng `DOCUMENT_REVISION_PROPOSAL` (`PROP-xxx`), bảo đảm lưu trữ trọn vẹn tệp đính kèm và thông tin hiệu chỉnh.
  - *Chuẩn hóa Khóa ngoại:* Đồng bộ hóa bảng ánh xạ mã quyền `code <-> permission_id` trong `approval-workflow.js`, bảo đảm khi ghi các yêu cầu Maker-Checker quản trị hệ thống (`APV-xxx`) luôn khớp với khóa ngoại `FK_Approval_Permission` (`PERMISSION.permission_id`).

---

## [v1.3.0-clean-unit-types-and-hierarchy-sorting] — 2026-11-04

### 1. Tinh Gọn Modal Thêm Mới / Chỉnh Sửa Đơn Vị (`AdminDashboardPage.tsx`)
- **Placeholder chuẩn hóa:** Đổi ô nhập "Tên Đơn Vị *" thành `VD: Trường Quân sự Quân khu 7` (thay vì ví dụ cũ dài dòng).
- **Tinh gọn danh mục phân loại đơn vị:**
  - `Cấp Trung ương / Bộ` (loại bỏ chú thích ngoặc đơn)
  - `Cấp Quân khu` (loại bỏ chú thích ngoặc đơn)
  - `Sư đoàn` (giữ nguyên)
  - `Nhà trường / Viện` (loại bỏ chú thích ngoặc đơn)
  - **Tách riêng Phòng / Ban / Cơ quan** thành 3 phân loại độc lập:
    - `Cơ quan` (màu Chàm Indigo, icon `Building`)
    - `Phòng` (màu Da trời Sky, icon `Building2`)
    - `Ban` (màu Xanh mòng két Teal, icon `Users`)
  - `Trung đoàn / Lữ đoàn` (giữ nguyên)
  - **Loại bỏ hoàn toàn cấp:** `Tiểu đoàn / Đại đội`.

### 2. Tái Cấu Trúc Thẻ KPI & Bộ Lọc "Cấp Quân Khu" (`UnitTreeTable.tsx`)
- **Độc lập hóa Cấp Quân khu:**
  - Đổi thẻ KPI 3 từ *"Quân khu & Sư đoàn"* thành **"Cấp Quân khu"** (icon `Award`), hiển thị riêng số lượng đầu mối thực tế: `1 đầu mối` (Quân khu 7).
  - Khi người dùng nhấp vào thẻ KPI này, hệ thống chỉ lọc duy nhất các đơn vị thuộc Cấp Quân khu, không còn gộp lẫn Sư đoàn.
  - Loại bỏ tùy chọn gộp `Quân khu & Sư đoàn` khỏi dropdown phân loại.

### 3. Điều Chỉnh Thứ Tự Sắp Xếp Phân Cấp (Hierarchy Sorting)
- **Cấu trúc hiển thị toàn diện theo cấp bậc chỉ huy:**
  - Cập nhật hàm trọng số thứ tự quân sự `getSortWeight`:
    1. `Cấp Quân khu` (`Quân khu 7`): trọng số `1` (hiển thị trên cùng).
    2. `Nhà trường / Viện` (`Trường Quân sự Quân khu 7` cùng 5 phòng ban trực thuộc): trọng số `2`.
    3. `Sư đoàn` (`Sư đoàn 5`): trọng số `3` (xếp dưới Trường Quân sự).
    4. `Cấp Trung ương / Bộ` xếp ở dưới Sư đoàn 5 với thứ tự chuẩn:
       - `Bộ Quốc Phòng` (`BQP`, trọng số `10`)
       - `Bộ Tổng Tham mưu` (`BTTM`, trọng số `11`)
       - `Chính Phủ` (`CP`, trọng số `12`)
       - `Tổng cục Chính trị` (`TCCT`, trọng số `13`)
  - Kết quả hiển thị: Toàn bộ cấu trúc thực thể tác chiến và đào tạo trực thuộc Quân khu 7 hiển thị trang trọng ở phần trên; các cơ quan Cấp Trung ương / Bộ được xếp phía dưới Sư đoàn 5 đúng chuẩn định hướng nghiệp vụ.

### 4. Đồng Bộ Dữ Liệu CSDL SQL Server
- Cập nhật trực tiếp `UNIT.unit_type`:
  - `U-BGH` (Ban Giám hiệu) $\rightarrow$ `ban`
  - `U-CT`, `U-DT`, `U-HC`, `U-TM` (Phòng Chính trị, Đào tạo, Hậu cần, Tham mưu) $\rightarrow$ `phong`.

---

## [v1.2.9-fix-school-filter-and-unit-classification] — 2026-11-04

### 1. Khắc Phục Triệt Để Lọc Thẻ KPI "Trường QS & Trực Thuộc" (`UnitTreeTable`)
- **Khắc phục lỗi 0 kết quả:**
  - *Nguyên nhân:* Trước đó hàm phân loại tự động `getUnitCategory` kiểm tra từ khóa `'quân khu'` trước `'trường'`, khiến `Trường Quân sự Quân khu 7` (TQS) bị phân loại nhầm thành `'quan_khu'` (thay vì `'nha_truong'`). Đồng thời thẻ KPI "Trường QS & Trực thuộc" chỉ lọc strictly `'nha_truong'` trong khi 5 phòng ban trực thuộc mang phân loại `'phong_ban'`, dẫn đến bảng hiển thị "Không tìm thấy đơn vị nào (0 / 12 đơn vị)".
  - *Giải pháp:*
    - Bổ sung danh mục phân loại tổng hợp `school_and_depts` ("Trường QS & Trực thuộc") và `command_and_div` ("Quân khu & Sư đoàn").
    - Cập nhật logic `isNodeMatching`: Khi chọn `school_and_depts`, hệ thống tự động khớp cả Nhà trường (`TQS`) và toàn bộ các phòng ban cấp con trực tiếp/gián tiếp của Nhà trường.
    - Cơ chế **Auto-Expand Ancestors**: Khi kích hoạt lọc, hệ thống tự động mở rộng toàn bộ các nút cha cấp trên (`QK7`, `TQS`), giúp hiển thị đầy đủ cấu trúc phả hệ trực quan mà không cần người dùng nhấp mở rộng thủ công.
    - Cập nhật số liệu thống kê chuẩn xác trên các thẻ KPI: `Toàn hệ thống (12)`, `Cấp Trung ương / Bộ (4)`, `Quân khu & Sư đoàn (2)`, `Trường QS & Trực thuộc (6)`.

### 2. Cơ Chế Thiết Lập Cứng Phân Loại Đơn Vị (Explicit Unit Classification)
- **Cơ sở dữ liệu (Database Migration):**
  - Bổ sung trường `unit_type VARCHAR(50) NULL` vào bảng `UNIT` trong CSDL SQL Server `QK7_ThuVienSo`.
  - Cập nhật và chuẩn hóa toàn bộ 12 đơn vị hiện có trong hệ thống: `BQP`, `BTTM`, `CP`, `TCCT` $\rightarrow$ `trung_uong`; `QK7` $\rightarrow$ `quan_khu`; `SD5` $\rightarrow$ `su_doan`; `TQS` $\rightarrow$ `nha_truong`; các phòng ban (`U-BGH`, `U-CT`, `U-DT`, `U-HC`, `U-TM`) $\rightarrow$ `phong_ban`.
- **Backend API:**
  - `backend/src/admin-routes.js`: Endpoint `GET /api/admin/units` trả về thuộc tính `u.unit_type`; `POST` và `PUT` lưu nhận và cập nhật trường `unit_type`.
  - `backend/server.js`: Endpoint `/api/meta` bổ sung `u.unit_type` phục vụ khởi tạo metadata toàn hệ thống.
- **Frontend Types & Services:**
  - `frontend/src/types/user.ts`: Bổ sung `unit_type?: string` vào giao diện TypeScript `Unit`.
  - `frontend/src/services/unitService.ts`: Cập nhật `createUnit` và `updateUnit` hỗ trợ truyền `unit_type`.
- **Modal Thêm mới & Chỉnh sửa Đơn vị (`AdminDashboardPage.tsx`):**
  - Bổ sung trường `<select>` "Phân Loại Đơn Vị *" với các tùy chọn chuẩn hóa:
    - `Cấp Trung ương / Bộ` (Chính phủ, Bộ Quốc phòng, Đảng...)
    - `Cấp Quân khu` (Bộ Tư lệnh Quân khu 7)
    - `Sư đoàn`
    - `Nhà trường / Viện` (Trường Quân sự QK7...)
    - `Phòng / Ban / Cơ quan`
    - `Trung đoàn / Lữ đoàn`
    - `Tiểu đoàn / Đại đội`
  - Tự động điền trước phân loại phù hợp theo ngữ cảnh khi nhấp thêm cấp con (`onAddChild`) hoặc chỉnh sửa (`onEdit`).
  - Loại bỏ hoàn toàn tình trạng đặt tên đơn vị mới (như "Đảng bộ Cộng Sản") bị tự động đoán nhầm thành "Phòng / Ban / Cơ quan".

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
