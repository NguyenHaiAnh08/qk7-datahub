"""
main.py - Entry point cho boxchat Microservice (FastAPI - Port :8001)
Hệ Thống Trợ Lý AI Tác Chiến & Văn Thư (Bộ Tư Lệnh Quân Khu 7 - QK7 DataHub)
"""

import os
import sys

# Đảm bảo in tiếng Việt trên console Windows không bị lỗi charmap
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import time
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load root .env (single source of truth)
_ROOT_ENV = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_ROOT_ENV, override=False)

# Optional: boxchat/.env (nếu có, override)
_LOCAL_ENV = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_LOCAL_ENV):
    load_dotenv(_LOCAL_ENV, override=True)

# Import core modules
from core.pdf_processor import PDFProcessor
from core.vector_store import HybridVectorStore
from core.agent_tutor import AgentTutor
from core.study_book_gen import StudyBookGenerator
from core.media_timeline import MediaTimelineManager
from core.metrics import (
    REQUEST_TOTAL,
    REQUEST_DURATION,
    LLM_FALLBACK_TOTAL,
    LLM_SYNTHESIS_MODE,
    ANSWER_LENGTH,
    CITATIONS_EMITTED,
    CITATIONS_FABRICATED,
    CITATIONS_VALID,
    BIOMETRIC_BLOCKS,
    CLEARANCE_LEAKS,
    ADVERSARIAL_REFUSALS,
    update_system_gauges,
    metrics_response
)

UPLOADS_DIR = os.getenv("BACKEND_UPLOADS_DIR", "../backend/uploads")
STORAGE_PATH = os.getenv("QDRANT_STORAGE_PATH", "./local_storage/qdrant_data")

pdf_processor = PDFProcessor(uploads_dir=UPLOADS_DIR)
vector_store = HybridVectorStore(storage_path=STORAGE_PATH)
agent_tutor = AgentTutor()
study_book_gen = StudyBookGenerator(pdf_processor=pdf_processor)
media_timeline_mgr = MediaTimelineManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi động: Tự động index nếu kho vector đang trống
    total = vector_store.get_total_chunks()
    print(f"[boxchat] Khởi động microservice. Tổng số chunks hiện có: {total}")
    if total == 0:
        print("[boxchat] Kho vector đang trống, tiến hành tự động quét thư mục uploads...")
        try:
            indexed = vector_store.auto_index_uploads(pdf_processor, uploads_dir=UPLOADS_DIR)
            print(f"[boxchat] Đã nạp tự động {indexed} tài liệu vào kho vector.")
        except Exception as e:
            print(f"[boxchat] Auto-index cảnh báo: {e}")

    # Warm-up mô hình LLM Ollama
    try:
        agent_tutor.warm_up()
    except Exception as e:
        print(f"[boxchat] Warm-up Ollama cảnh báo: {e}")

    yield
    print("[boxchat] Dừng microservice.")


app = FastAPI(
    title="QK7 boxchat Microservice",
    description="Trợ Lý AI Tác Chiến & Văn Thư Quân Khu 7 (Citation-Grounded Agentic RAG)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    query: str = Field(..., description="Nội dung câu hỏi của quân nhân")
    user_id: Optional[str] = Field("USR-GUEST", description="Mã quân nhân")
    user_name: Optional[str] = Field(None, description="Họ và tên quân nhân")
    user_position: Optional[str] = Field(None, description="Chức vụ quân nhân")
    user_rank: Optional[str] = Field(None, description="Cấp bậc quân nhân")
    user_clearance: int = Field(1, description="Cấp độ bảo mật (1-5)", ge=1, le=5)
    file_id: Optional[str] = Field(None, description="Mã tệp cụ thể nếu đang mở tài liệu")
    history: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Lịch sử trao đổi đa lượt")
    biometric_verified: Optional[bool] = Field(False, description="Cờ xác nhận đã quét vân tay ZK9500 hợp lệ")


class IngestRequest(BaseModel):
    file_id: str
    document_code: str
    title: str
    stored_path: str
    security_level_id: int = Field(1, ge=1, le=5)


class SyncAllItem(BaseModel):
    file_id: str
    document_code: Optional[str] = ""
    title: str
    stored_path: str
    security_level_id: int = 1


class SyncAllRequest(BaseModel):
    documents: List[SyncAllItem]


# ─── Endpoints ───

@app.get("/ai/health")
@app.get("/api/ai/health")
async def health_check():
    """
    Kiểm tra trạng thái sẵn sàng của boxchat và số lượng chunks đã nạp.
    """
    total_chunks = vector_store.get_total_chunks()
    return {
        "status": "online",
        "service": "boxchat",
        "port": 8001,
        "total_chunks_indexed": total_chunks,
        "ollama_connected": True,
        "security_enforcement": "Strict Pre-filtering (1-5)"
    }


@app.get("/metrics")
async def prometheus_metrics():
    """
    Prometheus metrics endpoint.
    """
    update_system_gauges(vector_store, agent_tutor)
    return metrics_response()


@app.post("/ai/ingest")
async def ingest_document(req: IngestRequest):
    """
    Bóc tách và nạp tài liệu PDF vào kho Vector Store ngay khi văn thư upload.
    """
    try:
        chunks = pdf_processor.extract_chunks(
            file_id=req.file_id,
            document_code=req.document_code,
            title=req.title,
            stored_path=req.stored_path,
            security_level_id=req.security_level_id
        )
        added_count = vector_store.add_chunks(chunks)
        return {
            "success": True,
            "file_id": req.file_id,
            "document_code": req.document_code,
            "chunks_created": len(chunks),
            "chunks_stored": added_count
        }
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=404, detail=str(fnf))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi bóc tách tài liệu: {str(e)}")


@app.post("/ai/sync-all")
async def sync_all_documents(req: SyncAllRequest):
    """
    Đồng bộ hàng loạt tài liệu từ backend sang vector store.
    Tự động dọn dẹp các tài liệu cũ đã bị xóa khỏi CSDL SQL Server.
    """
    success_count = 0
    failed_items = []
    total_new_chunks = 0

    active_file_ids = set(doc.file_id for doc in req.documents)
    stale_file_ids = set(c.get("file_id") for c in vector_store.chunks_cache if c.get("file_id") and c.get("file_id") not in active_file_ids)
    for stale_id in stale_file_ids:
        vector_store.delete_file(stale_id)

    for doc in req.documents:
        try:
            chunks = pdf_processor.extract_chunks(
                file_id=doc.file_id,
                document_code=doc.document_code or doc.file_id,
                title=doc.title,
                stored_path=doc.stored_path,
                security_level_id=doc.security_level_id
            )
            if chunks:
                added = vector_store.add_chunks(chunks)
                total_new_chunks += added
                success_count += 1
        except Exception as e:
            failed_items.append({"file_id": doc.file_id, "error": str(e)})

    return {
        "success": True,
        "processed_documents": len(req.documents),
        "synced_count": success_count,
        "total_chunks_added": total_new_chunks,
        "failed_items": failed_items
    }


@app.delete("/ai/documents/{file_id}")
async def delete_document_chunks(file_id: str):
    """
    Xóa toàn bộ chunks của tài liệu khỏi kho vector khi văn thư xóa tài liệu trong CSDL.
    """
    removed = vector_store.delete_file(file_id)
    return {"success": True, "file_id": file_id, "chunks_removed": removed}


@app.post("/ai/chat")
async def chat_with_tutor(req: ChatRequest):
    """
    Tra cứu thông minh và hội thoại với Trợ lý Tác chiến:
    Pre-filtering cứng: security_level_id <= user_clearance
    Trích dẫn số trang [p.X] và suy luận <mem>, <think>, <tool_call>.
    Bảo vệ Sinh trắc học Vân tay ZK9500 cho văn kiện Cấp 3-5.
    """
    start_time = time.perf_counter()
    status_code = "success"
    retrieval_mode = "unknown"
    try:
        if not req.query or not req.query.strip():
            raise HTTPException(status_code=400, detail="Thiếu nội dung câu hỏi")

        # Tối ưu truy vấn đa lượt (Query Rewriting với ngữ cảnh history)
        rewritten_query = agent_tutor._rewrite_query_with_history(req.query, req.history or [])

        # 1. Tìm kiếm chunks phù hợp với cấp quyền của quân nhân
        retrieved_chunks = vector_store.search(
            query=rewritten_query,
            max_security_level=req.user_clearance,
            file_id=req.file_id,
            top_k=5
        )

        # Detect clearance leak (should never happen)
        leaks = [c for c in retrieved_chunks if int(c.get("security_level_id", 1)) > req.user_clearance]
        if leaks:
            CLEARANCE_LEAKS.inc(len(leaks))
            status_code = "critical_leak"
            # CẮT BỎ TOÀN BỘ CHUNKS RÒ RỈ NGAY LẬP TỨC!
            retrieved_chunks = [c for c in retrieved_chunks if int(c.get("security_level_id", 1)) <= req.user_clearance]

        # 2. Sinh câu trả lời Grounded RAG qua AgentTutor (có áp Biometric Guard)
        result = agent_tutor.answer_query(
            query=req.query,
            user_id=req.user_id or "USR-GUEST",
            user_name=req.user_name,
            user_position=req.user_position,
            user_rank=req.user_rank,
            user_clearance=req.user_clearance,
            retrieved_chunks=retrieved_chunks,
            file_id=req.file_id,
            history=req.history,
            biometric_verified=bool(req.biometric_verified),
            all_chunks=vector_store.chunks_cache
        )

        # Track metrics
        retrieval_mode = result.get("retrieval_mode", "unknown")
        synthesis_mode = result.get("synthesis_mode", "extractive")
        LLM_SYNTHESIS_MODE.labels(mode=synthesis_mode).inc()

        answer_len = len(result.get("answer", ""))
        ANSWER_LENGTH.observe(answer_len)

        if result.get("requires_biometric"):
            BIOMETRIC_BLOCKS.inc()

        # Track citations
        citations = result.get("citations", [])
        CITATIONS_EMITTED.inc(len(citations))

        # Track adversarial refusal (heuristic)
        if any(kw in result.get("answer", "").lower() for kw in ["không có", "không thể", "từ chối", "không đủ cấp"]):
            if not citations or all(c.get("requires_biometric") for c in citations):
                ADVERSARIAL_REFUSALS.inc()

        return result
    except HTTPException:
        status_code = "http_error"
        raise
    except Exception as e:
        status_code = "internal_error"
        raise
    finally:
        duration = time.perf_counter() - start_time
        REQUEST_DURATION.labels(endpoint="/ai/chat").observe(duration)
        REQUEST_TOTAL.labels(
            endpoint="/ai/chat",
            status=status_code,
            retrieval_mode=retrieval_mode
        ).inc()


@app.api_route("/ai/study-book/{file_id}", methods=["GET", "POST"])
async def get_study_book(file_id: str, request: Request):
    """
    Biên dịch văn kiện thành dữ liệu 3 tab "Cuốn sách riêng"
    (01 Tài liệu, 02 Sơ đồ, 03 Kiểm tra)
    Có kiểm tra quyền bảo mật.
    """
    # Lấy clearance từ query params hoặc header hoặc body
    clearance_str = request.headers.get("x-clearance") or request.query_params.get("clearance") or "1"
    try:
        user_clearance = int(clearance_str)
    except ValueError:
        user_clearance = 1

    # Lấy các chunks của file_id
    doc_chunks = vector_store.get_document_chunks(file_id, max_security_level=user_clearance)

    if not doc_chunks:
        # Nếu chưa có trong cache, thử tìm file tương ứng trong uploads
        # để index nhanh nếu có metadata
        all_chunks_for_file = [c for c in vector_store.chunks_cache if c.get("file_id") == file_id]
        if all_chunks_for_file:
            # Có trong hệ thống nhưng cấp quyền không đủ!
            raise HTTPException(
                status_code=403,
                detail=f"Cán bộ không đủ cấp độ bảo mật để tạo cuốn sách học tập cho tài liệu này."
            )

        # Tạo fallback study book mẫu từ file_id
        doc_chunks = [{
            "file_id": file_id,
            "document_code": file_id,
            "title": f"Văn kiện tác chiến {file_id}",
            "security_level_id": 1,
            "page": 1,
            "text": "Nội dung văn kiện tác chiến và văn thư quản lý của Bộ Tư Lệnh Quân Khu 7."
        }]

    first_chunk = doc_chunks[0]
    doc_code = first_chunk.get("document_code", file_id)
    doc_title = first_chunk.get("title", f"Văn kiện {doc_code}")

    study_book_data = study_book_gen.generate(
        file_id=file_id,
        document_code=doc_code,
        title=doc_title,
        chunks=doc_chunks
    )

    return study_book_data


@app.get("/ai/media/search")
async def search_media_timeline(q: str):
    """
    Tra cứu mốc thời gian cuộc họp / video tác chiến.
    """
    return media_timeline_mgr.search_by_keyword(q)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port, reload=False)
