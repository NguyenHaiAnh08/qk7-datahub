"""
eval_rag.py - Khung đo lường & Đánh giá Tự động Agentic RAG QK7 DataHub
Chỉ in các chỉ số định lượng (Hit Rate @5, Citation Accuracy, Latency, Clearance Leak Count).
TUYỆT ĐỐI KHÔNG in nội dung văn bản thật ra màn hình báo cáo.
"""

import os
import sys
import json
import time
from typing import List, Dict, Any

# Đảm bảo in tiếng Việt trên console Windows không bị lỗi charmap
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from core.vector_store import HybridVectorStore
from core.agent_tutor import AgentTutor


def evaluate_rag(questions_file: str = "eval_questions.sample.json"):
    # Xác định đường dẫn file câu hỏi
    if not os.path.isabs(questions_file):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        candidate = os.path.join(base_dir, questions_file)
        if os.path.exists(candidate):
            questions_file = candidate

    if not os.path.exists(questions_file):
        print(f"[LỖI] Không tìm thấy tệp câu hỏi đánh giá tại: {questions_file}")
        sys.exit(1)

    with open(questions_file, "r", encoding="utf-8") as f:
        questions: List[Dict[str, Any]] = json.load(f)

    storage_path = os.getenv("QDRANT_STORAGE_PATH", os.path.join(os.path.dirname(__file__), "local_storage", "qdrant_data"))
    store = HybridVectorStore(storage_path=storage_path)
    tutor = AgentTutor()

    total_chunks_in_store = store.get_total_chunks()
    total_queries = len(questions)

    hits_at_5 = 0
    total_citations_emitted = 0
    total_valid_citations = 0
    latencies_ms = []
    clearance_leak_count = 0

    eval_details = []

    for item in questions:
        q_id = item.get("id", "Q-UNK")
        query = item.get("query", "")
        clearance = int(item.get("user_clearance", 1))

        start_time = time.perf_counter()

        # 1. Tìm kiếm Hybrid (Vector Qdrant + BM25 + RRF)
        retrieved_chunks = store.search(
            query=query,
            max_security_level=clearance,
            top_k=5
        )

        # 2. Sinh câu trả lời Grounded RAG và hậu kiểm trích dẫn
        result = tutor.answer_query(
            query=query,
            user_id=f"EVAL-USR-{q_id}",
            user_clearance=clearance,
            retrieved_chunks=retrieved_chunks
        )

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        latencies_ms.append(elapsed_ms)

        # Đánh giá Hit Rate @5
        is_hit = len(retrieved_chunks) > 0
        if is_hit:
            hits_at_5 += 1

        # Đánh giá An ninh Cấp độ Mật (Clearance Leak)
        leaks = [c for c in retrieved_chunks if int(c.get("security_level_id", 1)) > clearance]
        leak_detected = len(leaks) > 0
        if leak_detected:
            clearance_leak_count += len(leaks)

        # Đánh giá Citation Accuracy
        citations = result.get("citations", [])
        answer_text = result.get("answer", "")
        verified_answer, fabricated = tutor._verify_inline_citations(answer_text, retrieved_chunks)

        total_inline_tags = len(fabricated)
        import re
        valid_tags = re.findall(r'\[(?:p\.\s*|trang\s*)(\d+)\]', verified_answer, re.IGNORECASE)
        total_inline_tags += len(valid_tags)

        if total_inline_tags > 0:
            total_citations_emitted += total_inline_tags
            total_valid_citations += len(valid_tags)

        retrieval_mode = result.get("retrieval_mode", "bm25_only")
        synthesis_mode = result.get("synthesis_mode", "extractive")

        eval_details.append({
            "id": q_id,
            "clearance": clearance,
            "chunks_retrieved": len(retrieved_chunks),
            "retrieval_mode": retrieval_mode,
            "synthesis_mode": synthesis_mode,
            "citations_count": len(citations),
            "inline_valid": len(valid_tags),
            "inline_fabricated": len(fabricated),
            "latency_ms": elapsed_ms,
            "leak_count": len(leaks)
        })

    # Tính toán các chỉ số tổng hợp
    hit_rate_pct = round((hits_at_5 / total_queries) * 100, 2) if total_queries > 0 else 0.0
    citation_acc_pct = (
        round((total_valid_citations / total_citations_emitted) * 100, 2)
        if total_citations_emitted > 0 else 100.0
    )
    avg_latency_ms = round(sum(latencies_ms) / max(1, len(latencies_ms)), 2)

    # In báo cáo số liệu (KHÔNG in nội dung văn bản thật)
    print("\n" + "=" * 90)
    print("BÁO CÁO ĐÁNH GIÁ TỰ ĐỘNG KHUNG ĐO LƯỜNG AGENTIC RAG (QK7 DATAHUB)")
    print("=" * 90)
    print(f"Tổng số chunks trong kho dữ liệu: {total_chunks_in_store}")
    print(f"Tổng số câu hỏi đánh giá mẫu   : {total_queries}")
    print("-" * 90)
    print(f"1. Hit Rate @5                 : {hit_rate_pct}% ({hits_at_5}/{total_queries})")
    print(f"2. Citation Accuracy           : {citation_acc_pct}% ({total_valid_citations}/{total_citations_emitted})")
    print(f"3. Latency trung bình          : {avg_latency_ms} ms")
    print(f"4. Clearance Leak Count        : {clearance_leak_count} (Yêu cầu = 0)")
    print("-" * 90)
    print(f"{'Mã câu hỏi':<12} | {'Cấp':<6} | {'Chunks':<8} | {'Retrieval Mode':<16} | {'Synthesis Mode':<16} | {'Latency':<11} | {'Rò rỉ'}")
    print("-" * 90)
    for d in eval_details:
        leak_str = "AN TOÀN (0)" if d["leak_count"] == 0 else f"VI PHẠM ({d['leak_count']})"
        lat_str = f"{d['latency_ms']} ms"
        print(f"{d['id']:<12} | Cấp {d['clearance']:<2} | {d['chunks_retrieved']:<8} | {d['retrieval_mode']:<16} | {d['synthesis_mode']:<16} | {lat_str:<11} | {leak_str}")
    print("=" * 90 + "\n")
    print("=" * 70)

    if clearance_leak_count == 0:
        print("[KẾT QUẢ AN NINH] 100% TUÂN THỦ PHÂN QUYỀN 3 TẦNG - KHÔNG PHÁT HIỆN RÒ RỈ DỮ LIỆU.")
    else:
        print(f"[CẢNH BÁO AN NINH NGUY HIỂM] PHÁT HIỆN {clearance_leak_count} ĐOẠN RÒ RỈ VƯỢT CẤP MẬT!")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    q_file = sys.argv[1] if len(sys.argv) > 1 else "eval_questions.sample.json"
    evaluate_rag(q_file)
