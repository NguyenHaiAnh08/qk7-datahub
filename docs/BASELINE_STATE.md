# Baseline State — Trước khi hoàn thiện Chatbox

## Ngày: 2026-10-27 10:25

## 1. Môi trường
- **GPU:**
```csv
name, memory.total [MiB], memory.free [MiB]
NVIDIA GeForce GTX 1650, 4096 MiB, 1241 MiB
```
- **Python:**
```
Python 3.12.10
```
- **Python path:**
```
C:\Users\PC\AppData\Local\Microsoft\WindowsApps\python.exe
```
- **Ollama:**
```
ollama version is 0.40.11
```
- **Model đã cài:**
```
NAME             ID              SIZE      MODIFIED       
qwen2.5:3b       357c53fb659c    1.9 GB    46 minutes ago    
bge-m3:latest    790764642607    1.2 GB    14 hours ago      
```

## 2. Cấu hình hiện tại
- `.env` OLLAMA_MODEL: `qwen2.5:3b`
- `.env` OLLAMA_BASE_URL: `http://127.0.0.1:11434`
- `boxchat/core/agent_tutor.py` default model: `qwen2.5:3b` (kèm auto-discovery & fallback)

## 3. Baseline test results
- **pytest:**
```
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-9.1.1, pluggy-1.7.0 -- C:\Users\PC\AppData\Local\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\python.exe
cachedir: .pytest_cache
rootdir: D:\QK7_DataHub\qk7-datahub\boxchat
plugins: anyio-4.9.0
collecting ... collected 12 items

test_multiturn_and_biometric.py::test_query_rewriting_with_history PASSED [  8%]
test_multiturn_and_biometric.py::test_biometric_guard_blocks_classified_text_when_unverified PASSED [ 16%]
test_multiturn_and_biometric.py::test_biometric_guard_allows_classified_text_when_verified PASSED [ 25%]
test_multiturn_and_biometric.py::test_biometric_guard_allows_level_1_2_without_fingerprint PASSED [ 33%]
test_hybrid_security.py::test_security_clearance_levels_defense_in_depth PASSED [ 41%]
test_hybrid_security.py::test_content_deduplication PASSED               [ 50%]
test_hybrid_security.py::test_verify_inline_citations_removes_hallucinations PASSED [ 58%]
test_hybrid_security.py::test_pdf_processor_garbage_chunk_prevention PASSED [ 66%]
test_chunking.py::TestChunkingAndPacking::test_is_heading_exclusions PASSED [ 75%]
test_chunking.py::TestChunkingAndPacking::test_is_heading_valid PASSED   [ 83%]
test_chunking.py::TestChunkingAndPacking::test_synthetic_long_document_overlap_and_no_loss PASSED [ 91%]
test_chunking.py::TestChunkingAndPacking::test_reset_section_title_across_documents PASSED [100%]

============================= 12 passed in 16.49s =============================
```

- **eval_rag:**
```
==========================================================================================
BÁO CÁO ĐÁNH GIÁ TỰ ĐỘNG KHUNG ĐO LƯỜNG AGENTIC RAG (QK7 DATAHUB)
==========================================================================================
Tổng số chunks trong kho dữ liệu: 294
Tổng số câu hỏi đánh giá mẫu   : 5
------------------------------------------------------------------------------------------
1. Hit Rate @5                 : 100.0% (5/5)
2. Citation Accuracy           : 100.0% (1/1)
3. Latency trung bình          : 7078.47 ms
4. Clearance Leak Count        : 0 (Yêu cầu = 0)
------------------------------------------------------------------------------------------
Mã câu hỏi   | Cấp    | Chunks   | Retrieval Mode   | Synthesis Mode   | Latency     | Rò rỉ
------------------------------------------------------------------------------------------
Q1           | Cấp 1  | 5        | bm25_only        | llm              | 11232.43 ms | AN TOÀN (0)
Q2           | Cấp 2  | 5        | bm25_only        | llm              | 10750.83 ms | AN TOÀN (0)
Q3           | Cấp 2  | 5        | hybrid           | llm              | 5590.83 ms  | AN TOÀN (0)
Q4           | Cấp 3  | 5        | hybrid           | extractive       | 202.89 ms   | AN TOÀN (0)
Q5           | Cấp 2  | 5        | hybrid           | llm              | 7615.39 ms  | AN TOÀN (0)
==========================================================================================

======================================================================
[KẾT QUẢ AN NINH] 100% TUÂN THỦ PHÂN QUYỀN 3 TẦNG - KHÔNG PHÁT HIỆN RÒ RỈ DỮ LIỆU.
======================================================================
```

- **start-ai.bat (20 dòng cuối):**
```bat
REM --- 3. Giai phong triet de cong 8001 va khoa Qdrant ---
echo [3/4] Kiem tra va giai phong cong 8001...
if exist "%ROOT%boxchat\free-port.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%boxchat\free-port.ps1"
) else (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":8001[ ]" ^| findstr LISTENING') do (
        if not "%%a"=="0" taskkill /f /t /pid %%a >nul 2>&1
    )
    if exist "%ROOT%boxchat\local_storage\qdrant_data\.lock" (
        del /f /q "%ROOT%boxchat\local_storage\qdrant_data\.lock" >nul 2>&1
    )
)
ping 127.0.0.1 -n 2 >nul
echo [OK] Cong 8001 va Qdrant da san sang.

REM --- 4. Khoi dong FastAPI Boxchat ---
echo [4/4] Khoi dong Microservice AI Boxchat...
echo.
echo ==========================================
echo   TRANG THAI AI BOXCHAT:
echo   - Local API: http://127.0.0.1:8001
echo   - Swagger:   http://127.0.0.1:8001/docs
echo   - Health:    http://127.0.0.1:8001/ai/health
echo ==========================================
echo.

python main.py

pause
```

## 4. Quyết định GPU
- Nếu VRAM ≥ 8GB: CÓ THỂ nâng cấp lên qwen2.5:7b (cần test A/B ở Phase 2)
- Nếu VRAM 6-8GB: CẦN cân nhắc (7b cần ~4.7GB cho model + context)
- Nếu VRAM < 6GB: GIỮ 3b, bắt buộc ghi rõ trade-off trong tài liệu
- VRAM hiện tại của máy: **4.0 GB (4096 MiB - NVIDIA GeForce GTX 1650)**
- Kết luận: **KHÔNG** thể nâng cấp lên 7b (VRAM < 6GB, model 7b yêu cầu tối thiểu ~4.7GB VRAM, nếu ép chạy trên GPU 4GB sẽ bị tràn sang RAM hệ thống khiến latency suy luận tăng vọt lên 60-120s/query hoặc sập OOM khi có embedding đồng thời). Lựa chọn tối ưu kỹ thuật: **GIỮ `qwen2.5:3b`** cho môi trường máy chủ hiện tại và ghi rõ trade-off tài liệu.
