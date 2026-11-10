"""
vector_store.py - Kho Vector & Bộ Tìm Kiếm Hybrid BM25 + Vector Qdrant cho QK7 AI_BOXCHAT
Đảm bảo 100% Pre-filtering: security_level_id <= max_security_level.
Hỗ trợ embedding bge-m3 (1024-d) qua Ollama cục bộ, Qdrant collection qk7_documents_v2,
thuật toán kết hợp Reciprocal Rank Fusion (RRF k=60) và khử trùng lặp nội dung.
"""

import os
import sys
import json
import math
import re
import uuid
import hashlib
from typing import List, Dict, Any, Optional, Set
from collections import Counter

# Đảm bảo in tiếng Việt trên console Windows không bị lỗi charmap
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import requests

try:
    from qdrant_client import QdrantClient  # type: ignore
    from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, Range, MatchValue  # type: ignore
    HAS_QDRANT = True
except (ImportError, ModuleNotFoundError):
    HAS_QDRANT = False


class HybridVectorStore:
    COLLECTION_NAME = "qk7_documents_v2"

    def __init__(
        self,
        storage_path: str = "./local_storage/qdrant_data",
        ollama_url: str = "http://127.0.0.1:11434",
        embed_model: str = "bge-m3"
    ):
        self.storage_path = os.path.abspath(storage_path)
        os.makedirs(self.storage_path, exist_ok=True)

        self.meta_store_file = os.path.join(self.storage_path, "metadata_chunks.json")
        self.chunks_cache: List[Dict[str, Any]] = []

        self.ollama_url = os.getenv("OLLAMA_BASE_URL", ollama_url).rstrip("/")
        if "localhost" in self.ollama_url:
            self.ollama_url = self.ollama_url.replace("localhost", "127.0.0.1")
        self.embed_model = os.getenv("OLLAMA_EMBED_MODEL", embed_model)
        # Tuple timeout (connect_timeout=1.5s, read_timeout=30.0s)
        self.embed_timeout = (1.5, float(os.getenv("OLLAMA_EMBED_TIMEOUT", "30.0")))

        # Cơ chế Circuit Breaker cho kết nối Ollama Embed
        self.ollama_embed_available = True
        self.last_circuit_break_time = 0.0

        # Nạp dữ liệu chunks hiện có
        self._load_meta_store()

        self.last_search_mode = "bm25_only"
        self.qdrant_client = None
        self.stale_lock_cleaned = False
        if HAS_QDRANT:
            lock_path = os.path.join(self.storage_path, ".lock")
            if os.path.exists(lock_path):
                import subprocess
                try:
                    current_pid = os.getpid()
                    check = subprocess.run(
                        ['powershell', '-NoProfile', '-Command',
                         f"Get-CimInstance Win32_Process -Filter \"Name LIKE 'python%'\" | "
                         f"Where-Object {{ $_.ProcessId -ne {current_pid} -and ($_.CommandLine -like '*main.py*' -or $_.CommandLine -like '*uvicorn*') }} | "
                         f"Select-Object -First 1 -ExpandProperty ProcessId"],
                        capture_output=True, text=True, timeout=5
                    )
                    other_pids = check.stdout.strip()
                    if other_pids:
                        print(f"[VectorStore] Qdrant đang được process khác sử dụng (PID: {other_pids}). KHÔNG xóa .lock.")
                        self.qdrant_client = None
                        return
                except subprocess.TimeoutExpired:
                    print("[VectorStore] Không check được process khác, KHÔNG xóa lock để an toàn")
                    self.qdrant_client = None
                    return
                except Exception as check_err:
                    print(f"[VectorStore] Lỗi kiểm tra process khác ({check_err}), KHÔNG xóa lock để an toàn")
                    self.qdrant_client = None
                    return

                # Nếu không có process khác, xóa lock tồn dư
                print(f"[VectorStore] Xóa lock tồn dư (đã xác nhận không có process khác): {lock_path}")
                try:
                    os.remove(lock_path)
                    self.stale_lock_cleaned = True
                except Exception as re:
                    print(f"[VectorStore] Không xóa được lock: {re}")
                    self.qdrant_client = None
                    return

            try:
                # Qdrant chế độ local file path
                self.qdrant_client = QdrantClient(path=self.storage_path)
            except Exception as e:
                error_msg = str(e).lower()
                # BẮT BUỘC: chỉ xử lý nếu là lock error
                if "lock" not in error_msg and "already" not in error_msg:
                    print(f"[VectorStore] Qdrant init failed (không phải lock): {e}")
                    self.qdrant_client = None
                    return

                print(f"[VectorStore] Qdrant local init thất bại ({e}).")
                self.qdrant_client = None

            if self.qdrant_client:
                try:
                    collections = [c.name for c in self.qdrant_client.get_collections().collections]
                    if self.COLLECTION_NAME not in collections:
                        # Tạo collection mới qk7_documents_v2 với 1024 chiều (bge-m3)
                        self.qdrant_client.create_collection(
                            collection_name=self.COLLECTION_NAME,
                            vectors_config=VectorParams(size=1024, distance=Distance.COSINE)
                        )
                except Exception as ce:
                    print(f"[VectorStore] Qdrant collection check notice: {ce}")

    def _load_meta_store(self):
        if os.path.exists(self.meta_store_file):
            try:
                with open(self.meta_store_file, "r", encoding="utf-8") as f:
                    self.chunks_cache = json.load(f)
            except Exception as e:
                print(f"[VectorStore] Lỗi đọc {self.meta_store_file}: {e}")
                self.chunks_cache = []

    def _save_meta_store(self):
        try:
            with open(self.meta_store_file, "w", encoding="utf-8") as f:
                json.dump(self.chunks_cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[VectorStore] Lỗi lưu {self.meta_store_file}: {e}")

    def clear_all(self):
        """
        Làm sạch kho vector và metadata chunks để sẵn sàng re-index từ đầu.
        """
        self.chunks_cache = []
        self._save_meta_store()
        if self.qdrant_client and HAS_QDRANT:
            try:
                collections = [c.name for c in self.qdrant_client.get_collections().collections]
                if self.COLLECTION_NAME in collections:
                    self.qdrant_client.delete_collection(self.COLLECTION_NAME)
                self.qdrant_client.create_collection(
                    collection_name=self.COLLECTION_NAME,
                    vectors_config=VectorParams(size=1024, distance=Distance.COSINE)
                )
                print(f"[VectorStore] Đã tạo mới collection Qdrant '{self.COLLECTION_NAME}' (1024-d).")
            except Exception as e:
                print(f"[VectorStore] clear_all notice: {e}")

    def _get_embeddings(self, texts: List[str]) -> Optional[List[List[float]]]:
        """
        Gọi API Ollama /api/embed để trích xuất vector bge-m3 (1024 chiều).
        Hỗ trợ fallback sang /api/embeddings nếu là phiên bản Ollama cũ.
        Timeout (connect=1.5s, read=30.0s). Kèm Circuit Breaker 30 giây khi mất kết nối TCP.
        Trả về None nếu không kết nối được để Graceful Degradation.
        """
        if not texts:
            return []

        # Circuit Breaker: nếu Ollama vừa mất kết nối, tạm ngừng gọi trong 30s
        import time
        now = time.time()
        if not self.ollama_embed_available:
            if now - self.last_circuit_break_time < 30.0:
                return None
            self.ollama_embed_available = True

        try:
            # 1. Thử Ollama /api/embed (chuẩn từ v0.1.34+)
            payload = {
                "model": self.embed_model,
                "input": texts
            }
            resp = requests.post(
                f"{self.ollama_url}/api/embed",
                json=payload,
                timeout=self.embed_timeout
            )
            if resp.status_code == 200:
                self.ollama_embed_available = True
                data = resp.json()
                embeddings = data.get("embeddings")
                if embeddings and len(embeddings) == len(texts):
                    return embeddings

            # 2. Fallback sang /api/embeddings (chạy từng đoạn nếu /api/embed trả 404)
            if resp.status_code == 404:
                embeddings = []
                for t in texts:
                    old_payload = {"model": self.embed_model, "prompt": t}
                    r_old = requests.post(
                        f"{self.ollama_url}/api/embeddings",
                        json=old_payload,
                        timeout=self.embed_timeout
                    )
                    if r_old.status_code == 200:
                        embeddings.append(r_old.json().get("embedding", []))
                    else:
                        return None
                if len(embeddings) == len(texts):
                    self.ollama_embed_available = True
                    return embeddings
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            # Kích hoạt Circuit Breaker trong 30s khi lỗi kết nối mạng
            self.ollama_embed_available = False
            self.last_circuit_break_time = time.time()
        except Exception:
            pass
        return None

    def delete_file(self, file_id: str) -> int:
        """
        Xóa toàn bộ các chunk của một file_id khỏi Qdrant và metadata store.
        """
        if not file_id:
            return 0
        initial_count = len(self.chunks_cache)
        if self.qdrant_client and HAS_QDRANT:
            try:
                self.qdrant_client.delete(
                    collection_name=self.COLLECTION_NAME,
                    points_selector=Filter(
                        must=[FieldCondition(key="file_id", match=MatchValue(value=file_id))]
                    )
                )
            except Exception as e:
                print(f"[VectorStore] Qdrant delete notice cho file_id {file_id}: {e}")

        self.chunks_cache = [c for c in self.chunks_cache if c.get("file_id") != file_id]
        self._save_meta_store()
        return initial_count - len(self.chunks_cache)

    def add_chunks(self, chunks: List[Dict[str, Any]]) -> int:
        """
        Nạp mảng chunks vào kho vector và metadata store.
        - Xóa toàn bộ các chunk cũ có cùng file_id trong chunks_cache và trong Qdrant qk7_documents_v2.
        - Gọi Ollama /api/embed theo batch để lấy vector 1024 chiều và upsert vào Qdrant kèm payload.
        - Nếu Ollama /api/embed không phản hồi, vẫn lưu chunks_cache (Graceful Degradation).
        """
        if not chunks:
            return 0

        incoming_file_ids = set(c["file_id"] for c in chunks if "file_id" in c)

        # 1. Xóa các chunk cũ cùng file_id trong Qdrant (qk7_documents_v2)
        if self.qdrant_client and incoming_file_ids:
            for fid in incoming_file_ids:
                try:
                    self.qdrant_client.delete(
                        collection_name=self.COLLECTION_NAME,
                        points_selector=Filter(
                            must=[FieldCondition(key="file_id", match=MatchValue(value=fid))]
                        )
                    )
                except Exception as e:
                    print(f"[VectorStore] Qdrant delete notice cho file_id {fid}: {e}")

        # 2. Xóa các chunk cũ cùng file_id trong chunks_cache
        self.chunks_cache = [c for c in self.chunks_cache if c.get("file_id") not in incoming_file_ids]

        # 3. Chuẩn bị chunks chuẩn hóa
        normalized_chunks = []
        for chunk in chunks:
            chunk_copy = dict(chunk)
            chunk_copy["security_level_id"] = int(chunk_copy.get("security_level_id", 1))
            chunk_copy["page"] = int(chunk_copy.get("page", 1))
            chunk_copy["bbox"] = chunk_copy.get("bbox") or [0, 0, 0, 0]
            chunk_copy["section_title"] = chunk_copy.get("section_title", "")
            normalized_chunks.append(chunk_copy)

        # 4. Upsert vào Qdrant theo batch
        if self.qdrant_client:
            batch_size = 16
            for i in range(0, len(normalized_chunks), batch_size):
                batch = normalized_chunks[i:i + batch_size]
                batch_texts = [b.get("text", "") for b in batch]
                embeddings = self._get_embeddings(batch_texts)

                if embeddings and len(embeddings) == len(batch):
                    points = []
                    for c_item, vec in zip(batch, embeddings):
                        # Sinh UUIDv5 xác định từ chunk_id để chống trùng lặp điểm
                        pt_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(c_item["chunk_id"])))
                        payload = {
                            "chunk_id": c_item["chunk_id"],
                            "file_id": c_item["file_id"],
                            "document_code": c_item.get("document_code", ""),
                            "title": c_item.get("title", ""),
                            "security_level_id": int(c_item.get("security_level_id", 1)),
                            "page": int(c_item.get("page", 1)),
                            "bbox": c_item.get("bbox", [0, 0, 0, 0]),
                            "section_title": c_item.get("section_title", ""),
                            "text": c_item.get("text", "")
                        }
                        points.append(PointStruct(id=pt_id, vector=vec, payload=payload))
                    try:
                        self.qdrant_client.upsert(collection_name=self.COLLECTION_NAME, points=points)
                    except Exception as e:
                        print(f"[VectorStore] Qdrant upsert notice: {e}")

        # 5. Lưu vào chunks_cache (đảm bảo BM25 hoạt động dù Ollama offline)
        self.chunks_cache.extend(normalized_chunks)
        self._save_meta_store()
        return len(normalized_chunks)

    def get_total_chunks(self) -> int:
        return len(self.chunks_cache)

    def get_document_chunks(self, file_id: str, max_security_level: int) -> List[Dict[str, Any]]:
        """
        Lấy toàn bộ chunks của 1 tài liệu có kiểm tra quyền truy cập.
        """
        results = []
        for c in self.chunks_cache:
            if c.get("file_id") == file_id:
                if int(c.get("security_level_id", 1)) <= int(max_security_level):
                    results.append(c)
        results.sort(key=lambda x: x.get("page", 1))
        return results

    def search(
        self,
        query: str,
        max_security_level: int,
        file_id: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Tìm kiếm Hybrid (Vector Qdrant 1024-d + BM25 + RRF) với BẢO MẬT TUYỆT ĐỐI:
        1. Pre-filtering cả 2 nhánh: security_level_id <= max_security_level.
        2. Nhánh Vector: top 15 qua Qdrant với query_filter Range(lte=max_security_level).
        3. Nhánh BM25: top 15 từ chunks_cache đã lọc cấp độ mật.
        4. Reciprocal Rank Fusion (RRF, k=60).
        5. Khử trùng lặp nội dung (Content Deduplication qua SHA-256 text đã normalize).
        """
        if not query or not query.strip():
            return []

        max_security_level = int(max_security_level)
        self.last_search_mode = "bm25_only"

        # --- NHÁNH 1: BM25 SEARCH (TOP 15) ---
        bm25_candidates = []
        for c in self.chunks_cache:
            sec_lvl = int(c.get("security_level_id", 1))
            if sec_lvl <= max_security_level:
                if file_id:
                    if c.get("file_id") == file_id:
                        bm25_candidates.append(c)
                else:
                    bm25_candidates.append(c)

        bm25_top15 = []
        if bm25_candidates:
            bm25_top15 = self._rank_bm25(query, bm25_candidates, top_k=15)

        # --- NHÁNH 2: QDRANT VECTOR SEARCH (TOP 15) ---
        vector_top15 = []
        if self.qdrant_client:
            try:
                query_vecs = self._get_embeddings([query.strip()])
                if query_vecs and len(query_vecs) == 1 and query_vecs[0]:
                    # Pre-filtering nghiêm ngặt tại tầng vector
                    must_conds = [
                        FieldCondition(
                            key="security_level_id",
                            range=Range(lte=max_security_level)
                        )
                    ]
                    if file_id:
                        must_conds.append(
                            FieldCondition(key="file_id", match=MatchValue(value=file_id))
                        )
                    q_filter = Filter(must=must_conds)

                    # Truy vấn điểm vector
                    if hasattr(self.qdrant_client, "query_points"):
                        res = self.qdrant_client.query_points(
                            collection_name=self.COLLECTION_NAME,
                            query=query_vecs[0],
                            query_filter=q_filter,
                            limit=15
                        )
                        pts = res.points if hasattr(res, "points") else res
                    elif hasattr(self.qdrant_client, "search"):
                        pts = self.qdrant_client.search(
                            collection_name=self.COLLECTION_NAME,
                            query_vector=query_vecs[0],
                            query_filter=q_filter,
                            limit=15
                        )
                    else:
                        pts = []

                    for pt in pts:
                        payload = dict(pt.payload or {})
                        # Đảm bảo phòng thủ chiều sâu (Defense-in-depth)
                        if int(payload.get("security_level_id", 1)) <= max_security_level:
                            payload["vector_score"] = float(pt.score) if hasattr(pt, "score") else 0.0
                            vector_top15.append(payload)

                    if vector_top15:
                        self.last_search_mode = "hybrid"
            except Exception:
                # Nếu vector search lỗi, giữ nguyên bm25_only
                pass

        # --- RRF FUSION (k=60) ---
        rrf_k = 60
        scores: Dict[str, float] = {}
        chunk_map: Dict[str, Dict[str, Any]] = {}

        # Chấm điểm từ BM25
        for rank_idx, item in enumerate(bm25_top15):
            cid = str(item.get("chunk_id", f"{item.get('file_id')}_{rank_idx}"))
            rrf_score = 1.0 / (rrf_k + rank_idx + 1)
            scores[cid] = scores.get(cid, 0.0) + rrf_score
            if cid not in chunk_map:
                chunk_map[cid] = dict(item)

        # Chấm điểm từ Vector
        for rank_idx, item in enumerate(vector_top15):
            cid = str(item.get("chunk_id", f"{item.get('file_id')}_{rank_idx}"))
            rrf_score = 1.0 / (rrf_k + rank_idx + 1)
            scores[cid] = scores.get(cid, 0.0) + rrf_score
            if cid not in chunk_map:
                chunk_map[cid] = dict(item)

        if not scores:
            return []

        # Sắp xếp theo điểm RRF giảm dần
        sorted_chunk_ids = sorted(scores.keys(), key=lambda cid: scores[cid], reverse=True)

        # --- KHỬ TRÙNG LẶP NỘI DUNG (Content Deduplication) ---
        # Nếu 2 chunk từ 2 file copy khác nhau có nội dung chuẩn hóa giống hệt nhau (trùng SHA-256),
        # chỉ giữ lại 1 chunk có điểm cao nhất
        seen_content_hashes: Set[str] = set()
        final_results = []

        for cid in sorted_chunk_ids:
            chunk_data = chunk_map[cid]
            # Defense-in-depth: Lọc cấp mật lần 3
            if int(chunk_data.get("security_level_id", 1)) > max_security_level:
                continue

            text = chunk_data.get("text", "")
            norm_text = re.sub(r'\s+', ' ', text.strip().lower())
            content_hash = hashlib.sha256(norm_text.encode('utf-8')).hexdigest()

            if content_hash in seen_content_hashes:
                continue

            seen_content_hashes.add(content_hash)
            chunk_out = dict(chunk_data)
            chunk_out["score"] = round(scores[cid], 5)
            chunk_out["rrf_score"] = round(scores[cid], 5)
            final_results.append(chunk_out)

            if len(final_results) >= top_k:
                break

        # Defense-in-depth: Đảm bảo 100% không có chunk nào vượt max_security_level lọt qua
        safe_results = [
            c for c in final_results
            if int(c.get("security_level_id", 1)) <= max_security_level
        ]
        return safe_results

    def _rank_bm25(self, query: str, candidates: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Thuật toán BM25 nâng cao tối ưu cho tiếng Việt quân sự:
        Tính điểm kết hợp tiêu đề, số hiệu văn bản và nội dung đoạn văn.
        """
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        k1 = 1.5
        b = 0.75
        doc_count = len(candidates)

        # Tính Document Frequency (DF)
        df = Counter()
        doc_lengths = []
        for c in candidates:
            text = f"{c.get('document_code', '')} {c.get('title', '')} {c.get('text', '')}"
            tokens = self._tokenize(text)
            doc_lengths.append(len(tokens))
            unique_tokens = set(tokens)
            for t in unique_tokens:
                df[t] += 1

        avg_dl = sum(doc_lengths) / max(1, doc_count)

        scored_items = []
        for i, c in enumerate(candidates):
            text = c.get("text", "")
            title = c.get("title", "")
            doc_code = c.get("document_code", "")
            tokens = self._tokenize(f"{doc_code} {title} {text}")
            token_counts = Counter(tokens)
            dl = len(tokens)

            score = 0.0
            for qt in query_tokens:
                if qt in token_counts:
                    f = token_counts[qt]
                    n = df.get(qt, 1)
                    idf = math.log(1 + (doc_count - n + 0.5) / (n + 0.5))
                    numerator = f * (k1 + 1)
                    denominator = f + k1 * (1 - b + b * (dl / avg_dl))
                    term_score = idf * (numerator / max(0.001, denominator))

                    # Trọng số ưu tiên nếu xuất hiện trong số hiệu hoặc tiêu đề
                    if qt in self._tokenize(doc_code):
                        term_score *= 2.5
                    elif qt in self._tokenize(title):
                        term_score *= 1.8

                    score += term_score

            # Kiểm tra exact phrase match bonus
            clean_q = self._normalize_vietnamese(query)
            clean_content = self._normalize_vietnamese(f"{doc_code} {title} {text}")
            if clean_q in clean_content:
                score += 5.0

            if score > 0.05:
                item_copy = dict(c)
                item_copy["score"] = round(score, 4)
                scored_items.append(item_copy)

        scored_items.sort(key=lambda x: x["score"], reverse=True)
        return scored_items[:top_k]

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        if not text:
            return []
        text = text.lower()
        # Giữ lại từ tiếng Việt và chữ số, dấu gạch nối (cho số hiệu ví dụ 123/QĐ-BGH)
        words = re.findall(r'[a-zA-Z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ\-]+', text)
        return words

    @staticmethod
    def _normalize_vietnamese(text: str) -> str:
        if not text:
            return ""
        return " ".join(text.lower().split())

    def auto_index_uploads(self, pdf_processor, uploads_dir: str = "../backend/uploads"):
        """
        Quét và nạp toàn bộ các file PDF hiện có nếu kho vector đang trống
        hoặc khi được yêu cầu đồng bộ.
        """
        abs_uploads = os.path.abspath(uploads_dir)
        if not os.path.exists(abs_uploads):
            return 0

        indexed_files = set(c.get("file_id") for c in self.chunks_cache)
        count_new_files = 0

        for root, _, files in os.walk(abs_uploads):
            for file_name in files:
                if file_name.lower().endswith(".pdf"):
                    full_path = os.path.join(root, file_name)
                    # Tạo file_id tạm nếu chưa có
                    rel_path = os.path.relpath(full_path, os.path.dirname(abs_uploads)).replace("\\", "/")
                    file_id = "PDF-" + re.sub(r'[^A-Za-z0-9]', '', file_name)[:20]

                    if file_id in indexed_files:
                        continue

                    # Suy đoán độ mật từ tên file hoặc mặc định cấp 2
                    sec_level = 2
                    if "tuyetmat" in file_name.lower() or "tuyet_mat" in full_path.lower():
                        sec_level = 5
                    elif "toimat" in file_name.lower() or "toi_mat" in full_path.lower():
                        sec_level = 4
                    elif "mat" in file_name.lower():
                        sec_level = 3

                    # Trích xuất số hiệu từ tên file
                    doc_code = file_name.replace(".pdf", "")

                    try:
                        chunks = pdf_processor.extract_chunks(
                            file_id=file_id,
                            document_code=doc_code,
                            title=f"Tài liệu {doc_code}",
                            stored_path=full_path,
                            security_level_id=sec_level
                        )
                        if chunks:
                            self.add_chunks(chunks)
                            count_new_files += 1
                    except Exception as err:
                        print(f"[VectorStore] Auto-index skip {file_name}: {err}")

        return count_new_files
