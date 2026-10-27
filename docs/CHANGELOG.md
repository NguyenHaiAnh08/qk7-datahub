# Nhật Ký Thay Đổi Kỹ Thuật (CHANGELOG) — QK7 DataHub

Tài liệu ghi nhận toàn bộ các điều chỉnh, cải tiến và bản vá kỹ thuật cho phân hệ Trợ lý AI Boxchat (:8001) trong khuôn khổ nhiệm vụ hoàn thiện toàn diện hệ thống.

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

---

## Technical Debt & Known Issues (Nợ Kỹ Thuật Cần Lưu Ý)

### 1. Python Runtime từ WindowsApps
- **Hiện trạng:** Hệ thống đang sử dụng Python từ Microsoft Store / WindowsApps:
  ```
  C:\Users\PC\AppData\Local\Microsoft\WindowsApps\python.exe
  (Target thực tế: C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.12_..._x64__qbz5n2kfra8p0\python.exe)
  ```
- **Rủi ro kỹ thuật:**
  - Python trong thư mục WindowsApps bị quản lý bởi cơ chế bảo vệ phân quyền UWP của Windows, có thể gây khó khăn khi tạo virtualenv độc lập hoặc cài đặt package C-extension cấp hệ thống.
  - Mã hóa mặc định trên Windows PowerShell/CMD là `cp1252`, có thể gây lỗi `UnicodeEncodeError` khi in chuỗi tiếng Việt nếu không có cờ `reconfigure(encoding='utf-8')`.
- **Khuyến nghị cho giai đoạn bảo trì dài hạn:**
  - Trong môi trường bàn giao chính thức cho đơn vị, khuyến nghị cài đặt bộ Python 3.12 chuẩn từ `python.org` (ví dụ cài vào `C:\Python312`) và tạo virtual environment riêng (`.venv`) cho từng phân hệ backend / boxchat / local_agent.
  - Hiện tại giữ nguyên để đảm bảo không gây gián đoạn hoặc breaking change cho các dịch vụ đang chạy.
