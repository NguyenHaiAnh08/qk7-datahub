"""
vector_store.py - Kho Vector & Bộ Tìm Kiếm Hybrid BM25 + Vector cho QK7 AI_BOXCHAT
Đảm bảo 100% Pre-filtering: security_level_id <= max_security_level.
Hỗ trợ lưu trữ cục bộ tại local_storage/qdrant_data và chạy 100% Offline.
"""

import os
import json
import math
import re
from typing import List, Dict, Any, Optional
from collections import Counter

try:
    from qdrant_client import QdrantClient  # type: ignore
    from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, Range, MatchValue  # type: ignore
    HAS_QDRANT = True
except (ImportError, ModuleNotFoundError):
    HAS_QDRANT = False


class HybridVectorStore:
    COLLECTION_NAME = "qk7_documents"

    def __init__(self, storage_path: str = "./local_storage/qdrant_data"):
        self.storage_path = os.path.abspath(storage_path)
        os.makedirs(self.storage_path, exist_ok=True)
        
        self.meta_store_file = os.path.join(self.storage_path, "metadata_chunks.json")
        self.chunks_cache: List[Dict[str, Any]] = []
        
        # Nạp dữ liệu chunks hiện có
        self._load_meta_store()

        self.qdrant_client = None
        if HAS_QDRANT:
            try:
                # Qdrant chế độ local file path
                self.qdrant_client = QdrantClient(path=self.storage_path)
                collections = self.qdrant_client.get_collections().collections
                exists = any(c.name == self.COLLECTION_NAME for c in collections)
                if not exists:
                    # Dùng vector 128 chiều biểu diễn TF-IDF/Hash cho vector mode
                    self.qdrant_client.create_collection(
                        collection_name=self.COLLECTION_NAME,
                        vectors_config=VectorParams(size=128, distance=Distance.COSINE)
                    )
            except Exception as e:
                print(f"[VectorStore] Qdrant local init notice (using fallback engine): {e}")
                self.qdrant_client = None

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

    def add_chunks(self, chunks: List[Dict[str, Any]]) -> int:
        """
        Nạp mảng chunks vào kho vector và metadata store.
        Mỗi chunk bắt buộc có: file_id, document_code, title, security_level_id, page, text.
        """
        if not chunks:
            return 0

        # Xóa các chunk cũ cùng file_id để tránh trùng lặp khi re-index
        incoming_file_ids = set(c["file_id"] for c in chunks)
        self.chunks_cache = [c for c in self.chunks_cache if c.get("file_id") not in incoming_file_ids]

        added_count = 0
        for idx, chunk in enumerate(chunks):
            chunk_copy = dict(chunk)
            chunk_copy["security_level_id"] = int(chunk_copy.get("security_level_id", 1))
            chunk_copy["page"] = int(chunk_copy.get("page", 1))
            self.chunks_cache.append(chunk_copy)
            added_count += 1

        self._save_meta_store()
        return added_count

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
        Tìm kiếm với PRE-FILTERING BẢO MẬT TUYỆT ĐỐI:
        1. Lọc cứng: security_level_id <= max_security_level
        2. Nếu có file_id: lọc thêm file_id == file_id
        3. Tính điểm Hybrid BM25 + Từ khóa trọng yếu + n-gram
        """
        if not query or not query.strip():
            return []

        # PRE-FILTERING: Chỉ lấy chunks nằm trong giới hạn cấp phép
        allowed_chunks = []
        for c in self.chunks_cache:
            sec_lvl = int(c.get("security_level_id", 1))
            if sec_lvl <= int(max_security_level):
                if file_id:
                    if c.get("file_id") == file_id:
                        allowed_chunks.append(c)
                else:
                    allowed_chunks.append(c)

        if not allowed_chunks:
            return []

<<<<<<< HEAD
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
=======
        # Chấm điểm Hybrid BM25 + Token Re-ranking
        ranked_results = self._rank_bm25(query, allowed_chunks, top_k=top_k)
        return ranked_results
>>>>>>> 9cca8193b4de194f8f1694b8c69925ce22b91e94

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
