# Danh Mục Kiểm Tra Bàn Giao Vận Hành (Handover Checklist)
## Hệ Thống Trợ Lý AI Tác Chiến & Văn Thư — QK7 DataHub

**Dự án:** Quản trị, Lưu trữ & Khai thác Dữ liệu Số (Bộ Tư Lệnh Quân Khu 7 - QK7 DataHub)  
**Phân hệ:** AI Boxchat Microservice (`boxchat` :8001), Gateway Express (:8000), Ollama Local (:11434)  
**Phiên bản phát hành:** `v1.1.0-boxchat-complete`  
**Ngày bàn giao:** 2026-10-27  
**Đối tượng bàn giao:** Kíp trực SOC, Cán bộ Quản trị Hệ thống (SysAdmin) & Cán bộ Tác chiến/Văn thư

---

## 1. Sơ Đồ Ánh Xạ Dịch Vụ & Cổng Mạng (Port Mapping)

| Dịch vụ | Cổng | Giao thức | Tiến trình thực thi | Mục đích nghiệp vụ |
| :--- | :---: | :---: | :--- | :--- |
| **Gateway Express** | `:8000` | HTTP / REST | `node server.js` | Cổng API tập trung, Auth JWT, Phân quyền 5 cấp, Audit `ACCESS_LOG`. |
| **AI Boxchat** | `:8001` | HTTP / FastAPI | `python main.py` | Trợ lý Tác chiến & Văn thư, Agentic RAG, Pre-filtering độ mật, Biometric Guard. |
| **Ollama Local** | `:11434`| HTTP / REST | `ollama serve` | LLM runtime cục bộ: `qwen2.5:3b` và `bge-m3` (GPU GTX 1650 4GB). |
| **Fingerprint Bridge**| `:9001`| WebSocket / HTTP| Python Local Agent | Cầu nối máy quét vân tay quang học ZKTeco ZK9500 (chỉ bind `127.0.0.1`). |
| **SQL Server** | `:1433` | TCP / TDS | `sqlservr.exe` | CSDL lưu trữ `QK7_ThuVienSo`, quản lý người dùng, văn bản, `ACCESS_LOG`. |

> [!IMPORTANT]
> **Nguyên tắc Air-Gapped:** Cả 4 dịch vụ đều hoạt động 100% cục bộ, không gửi bất kỳ dữ liệu quân sự nào ra mạng Internet.

---

## 2. Quy Trình Khởi Động & Vận Hành Hàng Ngày (Daily Runbook)

### 2.1. Khởi động AI Boxchat (`start-ai.bat`)
Chạy file script bằng quyền Administrator hoặc User có quyền hạn:
```bat
cd D:\QK7_DataHub\qk7-datahub
start-ai.bat
```
Script tự động thực thi 4 bước an toàn:
1. **Kiểm tra Ollama (`:11434`):** Nếu chưa chạy, tự kích hoạt `ollama serve` và chờ phản hồi.
2. **Kiểm tra thư viện Python:** Đảm bảo đủ `fastapi`, `uvicorn`, `qdrant-client`, `pymupdf`.
3. **Giải phóng an toàn cổng 8001 & khóa Qdrant:** Tự động gọi `boxchat/free-port.ps1`.
4. **Khởi động FastAPI (`:8001`):** Nạp vector store, warm-up LLM `qwen2.5:3b` thường trực vào VRAM.

### 2.2. Kiểm tra trạng thái hoạt động (Health Checks)
1. **Kiểm tra Microservice :8001:**
   ```bash
   curl.exe http://127.0.0.1:8001/ai/health
   # Kết quả mong đợi: {"status":"online","service":"boxchat","port":8001,"total_chunks_indexed":295,"ollama_connected":true}
   ```
2. **Kiểm tra Gateway Proxy :8000:**
   ```bash
   # Đăng nhập lấy token:
   # POST /api/auth/login với { user_id: "USR-001", password: "..." }
   # Gọi GET /api/ai/health với Authorization: Bearer <token>
   # Kết quả mong đợi: {"status":"online","gateway_mode":"active_microservice"}
   ```

### 2.3. Quy trình tắt hoặc khởi động lại sạch (Clean Shutdown / Restart)
Nếu cổng 8001 bị treo hoặc cần khởi động lại, chạy script chuyên dụng:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\QK7_DataHub\qk7-datahub\boxchat\free-port.ps1
```
*Script sẽ tự động: Tìm PID chiếm cổng 8001 -> Tắt cây tiến trình -> Kiểm tra Process Safety Guard -> Xóa tệp khóa `.lock` tồn dư của Qdrant.*

---

## 3. Danh Mục Kiểm Tra An Ninh & Phân Quyền (Security Checklist)

| Hạng mục kiểm tra | Tiêu chuẩn bắt buộc | Cơ chế bảo vệ kỹ thuật | Trạng thái nghiệm thu |
| :--- | :--- | :--- | :---: |
| **Phân quyền 5 cấp độ mật** | Cán bộ chỉ được xem tài liệu $\le$ Cấp độ mật của mình. | Pre-filtering cứng tại Qdrant Vector & BM25 (`security_level_id <= user_clearance`). | **ĐẠT (0% rò rỉ)** |
| **Xác thực Sinh trắc học 2FA** | Văn bản Cấp 3 (Mật), Cấp 4 (Tối Mật), Cấp 5 (Tuyệt Mật) bắt buộc quét vân tay ZK9500. | Token `X-Fingerprint-Token` (hiệu lực 5 phút) gắn chặt `(user_id, file_id)`. Snippet bị che mờ 100% nếu thiếu token. | **ĐẠT (100% che mờ)** |
| **Smart SQL Fallback** | Khi Boxchat :8001 offline, Gateway tự fallback sang tìm kiếm SQL nhưng vẫn siết cấp mật. | Tầng Gateway `backend/src/ai-routes.js` áp `WHERE sl.level_id <= @clearance` vào truy vấn fallback. | **ĐẠT** |
| **Kiểm toán hành vi (Audit Log)** | Mọi thao tác xem, tải, hỏi AI, quét vân tay đều phải được lưu trữ vết. | Ghi nhận tức thì vào bảng `ACCESS_LOG` với IP, User ID, Action, Timestamp. | **ĐẠT** |
| **Không suy diễn ngoài nguồn (Hallucination Guard)** | AI không được bịa đặt văn kiện, số hiệu, nội dung chỉ thị. | Prompting với System Prompt nghiêm ngặt, Temperature = 0.1, từ chối câu hỏi ngoài luồng (Adversarial Refusal 100%). | **ĐẠT (94.4% Faithfulness)** |

---

## 4. Lệnh Kiểm Thử & Tái Xác Minh Tự Động (Regression Test Commands)

Khi có bất kỳ thay đổi cấu hình hạ tầng hoặc cập nhật dữ liệu, kíp trực có thể chạy lại các bộ kiểm thử tự động sau:

1. **Bộ kiểm thử an toàn khóa Qdrant (Phase 1):**
   ```bash
   python boxchat/test_qdrant_safety.py
   # Kết quả: 2/2 PASS
   ```
2. **Bộ kiểm thử hồi quy bảo mật & sinh trắc học:**
   ```bash
   python boxchat/test_hybrid_security.py
   python boxchat/test_multiturn_and_biometric.py
   # Kết quả: 12/12 PASS
   ```
3. **Bộ kiểm thử 15 kịch bản toàn diện End-to-End (Phase 4):**
   ```bash
   python boxchat/test_e2e_15_scenarios.py
   # Kết quả: 15/15 PASS (100.0%)
   ```
4. **Bộ đánh giá chất lượng RAGAS chuyên sâu (Phase 5):**
   ```bash
   python boxchat/eval_ragas_quality.py
   # Kết quả: Faithfulness 94.43%, Answer Relevance 98.20%, MRR 0.5833
   ```

---

## 5. Bảng Xử Lý Sự Cố Nhanh Cho Kíp Trực SOC (Troubleshooting Matrix)

| Hiện tượng | Nguyên nhân khả dĩ | Biện pháp xử lý ngay lập tức |
| :--- | :--- | :--- |
| **Lỗi `Port 8001 is already in use`** | Tiến trình Python cũ chưa tắt hết hoặc bị cô lập. | Chạy `powershell -File boxchat/free-port.ps1` để giải phóng cổng. |
| **Lỗi `Qdrant Storage is already locked`** | File `.lock` chưa được xóa sau sự cố tắt đột ngột. | Chạy `boxchat/free-port.ps1` (Script có Process Safety Guard, an toàn 100%). |
| **Lỗi `Gateway 504 AI_TIMEOUT`** | Ollama xử lý câu hỏi quá dài hoặc GPU bị chiếm dụng. | Kiểm tra `nvidia-smi`, đảm bảo `qwen2.5:3b` đang tải trên GPU; khởi động lại Ollama. |
| **Gateway trả lời ở chế độ `smart_sql_fallback`** | Microservice :8001 chưa được bật hoặc bị crash. | Chạy `start-ai.bat` để khởi động lại dịch vụ Boxchat. |
| **Lỗi không quét được vân tay ZK9500** | Cáp USB máy quét lỏng hoặc Agent :9001 chưa chạy. | Cắm lại cổng USB ZK9500, kiểm tra dịch vụ Fingerprint Agent tại port 9001. |

---

## 6. Ghi Nhận Nợ Kỹ Thuật & Khuyến Nghị Dài Hạn

1. **Python Runtime:**
   - *Hiện trạng:* Đang sử dụng Python từ WindowsApps UWP.
   - *Khuyến nghị:* Cài đặt Python 3.12 MSI chuẩn từ `python.org` vào `C:\Python312` khi có lịch bảo trì máy chủ định kỳ.
2. **Mở rộng phần cứng VRAM:**
   - *Hiện trạng:* GPU GTX 1650 (4.0 GB VRAM) vận hành hoàn hảo với `qwen2.5:3b` (~3.3s/lượt).
   - *Đề xuất:* Khi nâng cấp máy chủ lên GPU có $\ge 8\text{ GB}$ VRAM (như RTX 3060/4060 hoặc Quadro), có thể nâng cấp mô hình lên `qwen2.5:7b` theo phân tích tại [docs/MODEL_DECISION.md](file:///d:/QK7_DataHub/qk7-datahub/docs/MODEL_DECISION.md).
