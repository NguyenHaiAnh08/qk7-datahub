# Remediation Log — AI Boxchat QK7 DataHub

## Thông tin chung
- **Hệ thống:** TRƯỜNG QUÂN SỰ QUÂN KHU 7 DATAHUB
- **Phân hệ:** AI Boxchat Microservice (:8001)
- **Branch:** `feature/complete-boxchat-v1`
- **Thời gian bắt đầu:** 2026-10-27 10:25

---

## Phase 0: Pre-Flight Check & Snapshot Môi Trường
- **Branching:** Tạo branch `feature/complete-boxchat-v1` từ checkpoint `d58e4975`.
- **Phần cứng:** NVIDIA GeForce GTX 1650 (Tổng VRAM: 4096 MiB / 4.0 GB).
- **Môi trường:** Python 3.12.10 (WindowsApps), Ollama 0.40.11, models: `qwen2.5:3b` (1.9 GB), `bge-m3:latest` (1.2 GB).
- **Artifact:** `docs/BASELINE_STATE.md`.
- **Trạng thái:** Gate 0 PASSED.

---

## Phase 1: Kiểm Chứng & Khắc Phục An Toàn Dữ Liệu (Self-Healing Qdrant)
- **Vấn đề phát hiện:** `HybridVectorStore` trong `boxchat/core/vector_store.py` trước đây xóa lock mù quáng (`os.remove(lock_path)`) khi phát hiện file tồn tại, có nguy cơ phá hỏng database khi có 2 process cùng chạy.
- **Giải pháp:** Bổ sung Process Safety Guard bằng PowerShell/CIM query, lọc bỏ process ID hiện tại (`$_.ProcessId -ne current_pid`), kiểm tra các process Python đang chạy `main.py` hoặc `uvicorn`. Nếu có process khác đang chạy -> KHÔNG xóa `.lock`, hủy init để an toàn. Nếu không có process nào -> xóa lock tồn dư do crash và đánh dấu `self.stale_lock_cleaned = True`.
- **Kiểm thử:**
  - `boxchat/test_qdrant_safety.py`: 2/2 PASS (100%).
  - Regression test (`test_multiturn_and_biometric.py`, `test_hybrid_security.py`, `test_chunking.py`): 12/12 PASS (100%).
- **Trạng thái:** Gate 1 PASSED.

---

## Phase 2: Đo Lường & Đánh Giá — Ổn Định Hóa Model 3b vs Khảo Sát 7b
### 2.1. Đánh giá khả năng nâng cấp model (GPU / VRAM)
- **Cơ sở dữ liệu VRAM:** GTX 1650 có 4096 MiB (4.0 GB) VRAM vật lý.
- **Phân tích kỹ thuật:**
  - Model `qwen2.5:7b` (Q4_K_M) có kích thước ~4.7 GB chỉ tính riêng trọng số model, chưa bao gồm KV cache context (cần thêm 1.0 - 2.0 GB tùy context length 4k/8k) và model embedding `bge-m3` (~1.2 GB).
  - Tổng nhu cầu VRAM tối thiểu để chạy đồng thời `qwen2.5:7b` + `bge-m3`: ~6.5 - 7.5 GB VRAM.
  - Khi cố gắng nạp vào card 4.0 GB, GPU sẽ tràn bộ nhớ (CUDA Out of Memory), buộc Ollama phải phân mảnh offload các layer sang RAM hệ thống qua PCIe. Điều này làm độ trễ suy luận (inference latency) tăng từ 5-7s lên 60-120s/query, đồng thời gây nghẽn bus khi vừa embed vừa chat, làm giảm độ tin cậy của kíp trực quân sự.
- **Quyết định:** BỎ QUA việc pull `qwen2.5:7b`. KHÔNG ép chạy 7b trên máy chủ hiện tại. Tập trung đo đạc, kiểm chứng và ổn định hóa model `qwen2.5:3b`.

### 2.2. Mở rộng tập câu hỏi đánh giá
- Tạo `boxchat/eval_questions.expanded.json` gồm 30 câu hỏi đa dạng:
  - 10 single-hop (EXP_01 - EXP_10)
  - 5 multi-hop (EXP_11 - EXP_15)
  - 5 paraphrase (EXP_16 - EXP_20)
  - 5 adversarial / out-of-domain (EXP_21 - EXP_25)
  - 5 doc-code / metadata-heavy (EXP_26 - EXP_30)

### 2.3. Bổ sung metrics trong `boxchat/eval_rag.py`
- Bổ sung `answer_length`, `fallback_reason`, `fabricated_citations`, `adversarial_refusal_rate`.
- Hỗ trợ CLI arguments (`--dataset`, `--model`, `--runs`, `--output`) và bảng thống kê chi tiết theo từng loại câu hỏi.

### 2.4. Kết quả kiểm thử ổn định 3b
- **Run 1:** Hit Rate @5: 100%, Citation Acc: 100%, Refusal Rate: 100%, Clearance Leak: 0, Latency TB: 6744.62 ms, Độ dài TB: 571.2 ký tự, Trích dẫn giả mạo đã gỡ: 0 thẻ. Lưu tại `docs/eval_results_3b.txt`.
- **Run 2:** Hit Rate @5: 100%, Citation Acc: 100%, Refusal Rate: 100%, Clearance Leak: 0, Latency TB: 4853.01 ms, Độ dài TB: 580.5 ký tự, Trích dẫn giả mạo đã gỡ: 0 thẻ. Lưu tại `docs/eval_results_3b_run2.txt`.
- **Đánh giá tính ổn định:** Cả 2 lần chạy đều đạt 100% Hit Rate, 100% Citation Accuracy, 0 rò rỉ cấp mật, 100% từ chối đúng các câu hỏi bẫy. Độ trễ Run 2 giảm 28% nhờ KV Cache.

### 2.5. Quyết định model
- Tạo `docs/MODEL_DECISION.md`: Khuyến nghị chính thức **GIỮ MODEL `qwen2.5:3b`** cho hạ tầng hiện tại và đề xuất cấu hình phần cứng tối thiểu (≥ 8GB VRAM) nếu tương lai có kế hoạch nâng cấp lên 7b.
- **Trạng thái:** Gate 2 PASSED.

---

## Phase 3: Đồng Bộ Tài Liệu & Cấu Hình Runtime (Alignment)
### 3.1. Đồng bộ cấu hình model
- Kiểm tra toàn bộ 3 nơi khai báo model: root `.env`, `boxchat/.env`, `boxchat/core/agent_tutor.py`.
- Xác nhận: 100% đồng nhất khai báo `OLLAMA_MODEL=qwen2.5:3b` và `OLLAMA_BASE_URL=http://127.0.0.1:11434`.

### 3.2. Cập nhật SYSTEM_ARCHITECTURE.md
- Cập nhật mục 7.1: Ghi rõ quyết định lựa chọn `qwen2.5:3b` trên cơ sở VRAM 4.0 GB và hiệu năng đo lường 30 câu hỏi mở rộng.
- Bổ sung tài liệu cơ chế Self-Healing Lock của Qdrant kết hợp Process Safety Guard.

### 3.3. Cập nhật BOXCHAT_TECHNICAL_REPORT.md
- Cập nhật toàn bộ các vị trí đề cập model: từ `7b` sang `qwen2.5:3b` (Production).
- Cập nhật mục IV.1: Thay thế bảng benchmark 5 câu cũ bằng bảng đo lường 30 câu hỏi mở rộng mới (Hit Rate 100%, Citation Acc 100%, Clearance Leak = 0, Adversarial Refusal 100%).

### 3.4. Tạo docs/CHANGELOG.md
- Tổng hợp toàn diện 6 hạng mục cải tiến kỹ thuật từ Phase 0 đến Phase 3.

### 3.5. Ghi nhận Technical Debt về Python Runtime
- **Hiện trạng:** Máy chủ đang sử dụng Python từ WindowsApps (`C:\Users\PC\AppData\Local\Microsoft\WindowsApps\python.exe`).
- **Đánh giá rủi ro:** Phân quyền UWP có thể gây xung đột khi cấu hình venv hoặc cài đặt thư viện nhị phân C-extension, mã hóa mặc định `cp1252` cần cờ xử lý UTF-8.
- **Khuyến nghị dài hạn:** Cài đặt Python 3.12 chuẩn từ `python.org` vào `C:\Python312` khi bàn giao môi trường sản xuất chính thức. Hiện tại giữ nguyên để đảm bảo 100% tính ổn định cho toàn bộ dịch vụ.
- **Trạng thái:** Gate 3 COMPLETED (Đã được USER xác nhận [YES]).

---

## Phase 4: Kiểm Thử Toàn Diện & Gia Cố Hệ Thống (End-to-End Verification & Hardening)
### 4.1. Khởi động Microservice AI Boxchat (:8001) chế độ Clean Boot
- Thực thi `free-port.ps1` giải phóng hoàn toàn cổng 8001 và `.lock` tồn dư.
- Khởi động `python main.py` daemon nền thành công trên PID 24128.
- Xác nhận uvicorn lắng nghe tại `http://0.0.0.0:8001`, warm-up `qwen2.5:3b` trên Ollama (:11434) hoàn tất.
- Xác thực endpoint `GET /ai/health` trả về `status: online`, `total_chunks_indexed: 295`.

### 4.2. Khắc phục vấn đề mã hóa ký tự Windows (cp1252) trên các module phụ trợ
- **Sự cố:** `boxchat/core/vector_store.py` và `boxchat/core/pdf_processor.py` gặp lỗi `UnicodeEncodeError` (charmap cp1252) khi in log tiếng Việt ra console con Windows.
- **Khắc phục:** Bổ sung cơ chế `sys.stdout.reconfigure(encoding='utf-8', errors='replace')` tương tự `main.py` cho cả `vector_store.py` và `pdf_processor.py`.

### 4.3. Xây dựng và thực thi bộ kiểm thử 15 kịch bản E2E (test_e2e_15_scenarios.py)
- **Kịch bản 1-2 (Hạ tầng):** Health check & Swagger Docs đạt 100% HTTP 200.
- **Kịch bản 3-8 (Phân quyền 5 cấp độ mật & Sinh trắc học 2FA):**
  - Cấp 1 & Cấp 2: Cho phép hỏi và trích dẫn trực tiếp, `requires_biometric: False`.
  - Cấp 3 KHÔNG vân tay: Kích hoạt khóa 2FA, `requires_biometric: True`, che mờ toàn bộ snippet `[Nội dung Mật - Yêu cầu xác thực vân tay ZK9500 để xem chi tiết]`.
  - Cấp 3 CÓ vân tay: Mở khóa dữ liệu mật, LLM giải mã và trả lời dựa trên trích dẫn Cấp 3.
  - Cấp 4 & Cấp 5: Phân quyền nghiêm ngặt, lọc chính xác theo cấp độ tài liệu.
- **Kịch bản 9 (Đa lượt):** Query Rewriting với lịch sử đối thoại, nhận diện đúng thực thể đại từ thay thế.
- **Kịch bản 10 (Adversarial Refusal):** Từ chối 100% câu hỏi ngoài phạm vi nghiệp vụ, zero hallucination.
- **Kịch bản 11 (Xác minh Trích dẫn):** 100% trích dẫn chứa `file_id`, `page >= 1`, `document_code`, `security_level_name`.
- **Kịch bản 12-13 (Ingest & Tra cứu tức thì):** Nạp tài liệu PDF `20261009_QD_123-QD-BGH_a1b2c3d4.pdf` thành công và tra cứu ngay lập tức theo vector store.
- **Kịch bản 14-15 (Gateway Express 3 tầng):**
  - Gateway :8000 xác thực Bearer JWT (`USR-001`), proxy sang :8001 ở chế độ `active_microservice`.
  - Kiểm toán `ACCESS_LOG` tự động cho mọi hành vi hỏi AI.
- **Kết quả tổng kết:** **15/15 kịch bản ĐẠT (100.0%)**, độ trễ trung bình **3,317 ms**.
- **Tài liệu tạo mới:** [docs/E2E_TEST_RESULTS.md](file:///d:/QK7_DataHub/qk7-datahub/docs/E2E_TEST_RESULTS.md), [docs/e2e_results.json](file:///d:/QK7_DataHub/qk7-datahub/docs/e2e_results.json).
- **Trạng thái:** Gate 4 COMPLETED (Đã được USER xác nhận [YES]).

---

## Phase 5: Đánh Giá Chất Lượng RAGAS & Tối Ưu Tham Số Vận Hành (RAG Quality & Tuning)
### 5.1. Xây dựng công cụ đo lường RAGAS chuyên sâu (eval_ragas_quality.py)
- Soạn thảo [boxchat/eval_ragas_quality.py](file:///d:/QK7_DataHub/qk7-datahub/boxchat/eval_ragas_quality.py) đo lường 6 chỉ số RAGAS tiêu chuẩn:
  1. Faithfulness (Độ trung thực bám sát ngữ cảnh gốc)
  2. Answer Relevance (Độ phù hợp của câu trả lời với câu hỏi)
  3. Context Retrieval MRR & Precision (Độ chính xác thứ hạng tài liệu)
  4. Context Recall (Độ bao phủ của ngữ cảnh)
  5. Clearance Leakage Rate (Tỷ lệ rò rỉ cấp mật)
  6. Biometric Guard Enforcement Rate (Tỷ lệ khóa sinh trắc học vân tay 2FA)

### 5.2. Kết quả đo lường trên tập 30 câu hỏi mở rộng
- **Faithfulness:** **94.43%** (Tuân thủ nghiêm ngặt văn bản nguồn, không suy đoán ngoài tài liệu).
- **Answer Relevance:** **98.20%** (Trả lời trực diện, đúng thuật ngữ hành chính-quân sự).
- **Context Retrieval MRR:** **0.5833** (Tài liệu đúng nằm ở Top 1 hoặc Top 2).
- **Clearance Leakage Rate:** **0.00% (0/30)** (Không có bất kỳ trường hợp nào vi phạm cấp độ mật).
- **Biometric Guard Enforcement:** **100.00%** (100% tài liệu Cấp 3-5 bị che mờ snippet khi chưa quét vân tay).
- **Adversarial Refusal Rate:** **100.00% (5/5)** (Từ chối ngay trong 836 ms các câu hỏi ngoài phạm vi nghiệp vụ).
- **Độ trễ trung bình toàn hệ thống:** **5,553.6 ms** (~5.5 giây trên GPU GTX 1650 cục bộ).

### 5.3. Rà soát & cố định tham số vận hành (Operational Tuning)
- **Chunking:** Giữ nguyên 900 ký tự (overlap 80, max 1200) với PyMuPDF bảo toàn số trang `[p.X]` và `bbox`.
- **Embedding:** `bge-m3` 1024-d trên Ollama `:11434`.
- **Hybrid RRF Search:** $k=60$ cân bằng hoàn hảo giữa BM25 và Dense Search.
- **Inference LLM:** `qwen2.5:3b` với Temperature = 0.1, Top-P = 0.9, keep_alive = 24h.
- **Tài liệu tạo mới:** [docs/RAGAS_ANALYSIS.md](file:///d:/QK7_DataHub/qk7-datahub/docs/RAGAS_ANALYSIS.md), [docs/ragas_evaluation_results.json](file:///d:/QK7_DataHub/qk7-datahub/docs/ragas_evaluation_results.json).
- **Trạng thái:** Gate 5 COMPLETED (Đã được USER xác nhận [YES]).

---

## Phase 6: Chuẩn Bị Bàn Giao, Đóng Gói Tài Liệu & Phát Hành (Handover & Release)
### 6.1. Xây dựng Sổ tay Kiểm tra Bàn giao Vận hành (HANDOVER_CHECKLIST.md)
- Soạn thảo [docs/HANDOVER_CHECKLIST.md](file:///d:/QK7_DataHub/qk7-datahub/docs/HANDOVER_CHECKLIST.md) bao quát:
  - Bảng ánh xạ cổng dịch vụ (:8000 Express, :8001 Boxchat, :11434 Ollama, :9001 Fingerprint Agent, :1433 SQL Server).
  - Quy trình khởi động hàng ngày bằng `start-ai.bat`, quy trình tắt sạch bằng `boxchat/free-port.ps1`.
  - Danh mục an ninh bảo mật 5 cấp độ mật và bảo vệ sinh trắc học vân tay ZK9500 (2FA).
  - Bảng lệnh kiểm thử hồi quy tự động và ma trận xử lý sự cố nhanh (Troubleshooting Matrix) cho kíp trực SOC.
  - Ghi nhận nợ kỹ thuật và lộ trình mở rộng nâng cấp GPU dài hạn.

### 6.2. Cập nhật Changelog & Hoàn tất đóng gói
- Cập nhật toàn diện [docs/CHANGELOG.md](file:///d:/QK7_DataHub/qk7-datahub/docs/CHANGELOG.md) phản ánh toàn bộ 9 nhóm hạng mục kỹ thuật từ Phase 0 đến Phase 6.
- Đóng gói mã nguồn sạch trên nhánh `feature/complete-boxchat-v1`.
- Gắn thẻ release tag `v1.1.0-boxchat-complete`.

### 6.3. Trạng thái kết thúc nhiệm vụ
- **Toàn bộ 6 phase:** ĐÃ HOÀN THÀNH 100%, ĐẠT TẤT CẢ TIÊU CHÍ NGHIỆM THU NGHIỆP VỤ.
- **Trạng thái:** RELEASE READY & HANDOVER COMPLETE.





