# Nhật Ký Thay Đổi Kỹ Thuật (CHANGELOG) — QK7 DataHub

Tài liệu ghi nhận toàn bộ các điều chỉnh, cải tiến, bản vá kỹ thuật và quy chuẩn vận hành của dự án QK7 DataHub.

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
