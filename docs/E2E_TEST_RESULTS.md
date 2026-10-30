# Báo Cáo Kết Quả Kiểm Thử Toàn Diện End-to-End (E2E) — AI Boxchat QK7 DataHub

**Dự án:** Quản trị, Lưu trữ & Khai thác Dữ liệu Số — Bộ Tư Lệnh Quân Khu 7 (QK7 DataHub)  
**Phân hệ:** Trợ Lý AI Tác Chiến & Văn Thư (`boxchat` :8001, Gateway Express :8000, Ollama :11434)  
**Thời gian kiểm thử:** 2026-10-27  
**Môi trường:** Windows 10 Pro (OS Build 26300.9711), NVIDIA GeForce GTX 1650 (4GB VRAM)  
**Branch:** `feature/complete-boxchat-v1`  
**Bộ kịch bản:** `boxchat/test_e2e_15_scenarios.py`

---

## 1. Tổng Quan Kết Quả

| Chỉ số | Giá trị | Đánh giá |
| :--- | :---: | :--- |
| **Tổng số kịch bản kiểm thử** | **15** | Toàn diện từ Microservice đến Gateway 3 tầng |
| **Số kịch bản đạt (PASS)** | **15** | **100.0%** |
| **Số kịch bản lỗi (FAIL)** | **0** | **0.0%** |
| **Độ trễ phản hồi trung bình** | **3,317 ms** | Rất nhanh (nhờ GPU Offloading & KV Cache) |
| **Tuân thủ phân quyền 5 cấp độ mật** | **100%** | Pre-filtering cứng: `security_level_id <= user_clearance` |
| **Bảo vệ Sinh trắc học 2FA (Cấp 3-5)** | **100%** | Khóa & che mờ 100% snippet nếu thiếu xác thực vân tay |
| **Độ chính xác trích dẫn (Citation Accuracy)**| **100%** | Toàn bộ trích dẫn có `file_id`, `page >= 1`, `document_code` |
| **Khả năng chống suy đoán (Adversarial Refusal)**| **100%** | Từ chối 100% câu hỏi ngoài phạm vi nghiệp vụ quân sự |

---

## 2. Bảng Chi Tiết 15 Kịch Bản E2E

| STT | Tên Kịch Bản | Phân Tầng / Endpoint | Độ Trễ (ms) | Kết Quả | Chi Tiết Nghiệp Vụ & Bằng Chứng |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **01** | Health Check Microservice | `GET :8001/ai/health` | 39 | **PASS** | `status: "online"`, `port: 8001`, `total_chunks_indexed: 295`, `ollama_connected: true`. |
| **02** | Swagger OpenAPI Docs | `GET :8001/docs` | 4 | **PASS** | HTTP 200, OpenAPI Swagger UI rendered đầy đủ contract API. |
| **03** | Chat Query Cấp 1 (Công khai) | `POST :8001/ai/chat` | 3,967 | **PASS** | `user_clearance: 1`, `requires_biometric: false`, 3 trích dẫn đều <= Cấp 1, câu trả lời đầy đủ. |
| **04** | Chat Query Cấp 2 (Nội bộ) | `POST :8001/ai/chat` | 741 | **PASS** | `user_clearance: 2`, `requires_biometric: false`, 3 trích dẫn đều <= Cấp 2. |
| **05** | Chat Query Cấp 3 KHÔNG vân tay | `POST :8001/ai/chat` | 631 | **PASS** | `requires_biometric: true`, snippet bị che mờ: `[Nội dung Mật - Yêu cầu xác thực vân tay ZK9500 để xem chi tiết]`. |
| **06** | Chat Query Cấp 3 CÓ vân tay | `POST :8001/ai/chat` | 12,318 | **PASS** | `biometric_verified: true`, snippet giải mã nội dung thật, LLM tổng hợp từ tài liệu Cấp 3 đầy đủ (1,658 ký tự). |
| **07** | Chat Query Cấp 4 CÓ vân tay (Tối Mật) | `POST :8001/ai/chat` | 3,606 | **PASS** | `user_clearance: 4`, truy xuất văn kiện Tối Mật thành công, tổng hợp chính xác. |
| **08** | Chat Query Cấp 5 (Tuyệt Mật) | `POST :8001/ai/chat` | 690 | **PASS** | `user_clearance: 5`, lọc dữ liệu Tuyệt Mật đúng phân quyền, không rò rỉ vượt cấp. |
| **09** | Multi-Turn Chat (Ngữ cảnh) | `POST :8001/ai/chat` | 6,630 | **PASS** | Query Rewriting lượt 2 chuyển "Cơ quan này" thành "Phòng Hậu cần - Kỹ thuật" dựa trên history. |
| **10** | Adversarial Refusal | `POST :8001/ai/chat` | 767 | **PASS** | Từ chối câu hỏi làm bánh pizza / hack wifi, zero citations, không bịa đặt thông tin. |
| **11** | Citation Verification | `POST :8001/ai/chat` | 7,930 | **PASS** | 100% trích dẫn chứa đầy đủ `file_id`, `page >= 1`, `document_code`, `security_level_name`. |
| **12** | Ingest Tài Liệu Mới | `POST :8001/ai/ingest` | 165 | **PASS** | Bóc tách PDF `20261009_QD_123-QD-BGH_a1b2c3d4.pdf` sinh 1 chunk, lưu thành công vào Vector Store. |
| **13** | Search After Ingest | `POST :8001/ai/chat` | 988 | **PASS** | Tra cứu tức thì tài liệu vừa nạp theo nội dung văn bản và `file_id`, trả về chính xác chunk vừa tạo. |
| **14** | Gateway Defense & Health Proxy | `GET :8000/api/ai/health` | 2,020 | **PASS** | Gateway Express xác thực Bearer JWT (`USR-001`), nhận diện `gateway_mode: "active_microservice"`. |
| **15** | Gateway Chat E2E Routing & Fallback | `POST :8000/api/ai/chat` | 9,260 | **PASS** | Gateway proxy câu hỏi sang :8001 thành công, kiểm toán nhật ký `ACCESS_LOG` (AI_QUERY), trả kết quả đầy đủ. |

---

## 3. Đánh Giá Độ Tin Cậy & Kiến Trúc Bảo Mật

### 3.1. Cơ chế Defense-in-Depth (Phòng thủ theo chiều sâu)
1. **Tầng 1 - Presentation SPA:** Hiển thị Guard khóa vân tay đối với tài liệu Cấp 3-5, yêu cầu quét ZK9500 trước khi mở snippet.
2. **Tầng 2 - Gateway Express (:8000):** 
   - Kiểm tra JWT hợp lệ, xác thực quyền `AI_QUERY`.
   - Kiểm tra `X-Fingerprint-Token` (JWT 5 phút) hoặc bản ghi `FINGERPRINT_OK` trong `ACCESS_LOG` trong vòng 5 phút gần nhất.
   - Ghi nhật ký kiểm toán `ACCESS_LOG` cho mọi câu hỏi hỏi AI.
   - Proxy thông minh sang `:8001` và tự kích hoạt Smart SQL Fallback với bộ lọc `security_level_id <= user_clearance` nếu `:8001` gặp sự cố.
3. **Tầng 3 - Microservice AI Boxchat (:8001):**
   - Pre-filtering cứng tại Qdrant Vector Search & BM25 (`security_level_id <= max_security_level`).
   - Khóa nội dung Cấp 3-5 tại tầng logic `AgentTutor` nếu `biometric_verified == False`.

### 3.2. Hiệu năng Vận hành Cục bộ (Local Air-Gapped)
- Mô hình: `qwen2.5:3b` chạy trên Ollama `:11434` với cấu hình GPU GTX 1650 (3.3 GB VRAM).
- Không có bất kỳ truy vấn hay dữ liệu quân sự nào đi ra ngoài mạng Internet.
- Tốc độ sinh câu trả lời trung bình: ~3.3 giây/truy vấn.
