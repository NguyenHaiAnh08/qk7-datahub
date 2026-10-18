"""
pdf_processor.py - Module bóc tách tệp PDF đa trang cho QK7 AI_BOXCHAT
Sử dụng PyMuPDF (fitz) để đọc tài liệu, bảo toàn số trang [p.X] và tọa độ bbox.
Gắn cứng metadata bảo mật (security_level_id 1-5) vào từng chunk văn bản.
"""

import os
import re
from typing import List, Dict, Any, Optional

try:
    import pymupdf as fitz
    HAS_FITZ = True
except ImportError:
    try:
        import fitz
        HAS_FITZ = True
    except ImportError:
        HAS_FITZ = False


class PDFProcessor:
    def __init__(self, uploads_dir: str = "../backend/uploads"):
        self.uploads_dir = os.path.abspath(uploads_dir)

    def resolve_file_path(self, stored_path: str) -> str:
        """
        Chuẩn hóa đường dẫn tệp tin PDF, hỗ trợ đường dẫn tương đối từ backend/uploads
        hoặc đường dẫn tuyệt đối.
        """
        if os.path.isabs(stored_path):
            if os.path.exists(stored_path):
                return stored_path
            # Thử map lại với uploads_dir nếu là path từ máy khác
            base_name = os.path.basename(stored_path)
            candidate = os.path.join(self.uploads_dir, base_name)
            if os.path.exists(candidate):
                return candidate
            return stored_path

        # Tương đối so với uploads_dir hoặc project root
        clean_rel = stored_path.replace("\\", "/").lstrip("/")
        if clean_rel.startswith("uploads/"):
            clean_rel = clean_rel[len("uploads/"):]

        direct_candidate = os.path.join(self.uploads_dir, clean_rel)
        if os.path.exists(direct_candidate):
            return direct_candidate

        # Thử tìm theo base path của backend
        backend_base = os.path.dirname(self.uploads_dir)
        backend_candidate = os.path.join(backend_base, stored_path.replace("\\", "/"))
        if os.path.exists(backend_candidate):
            return backend_candidate

        # Quét tìm kiếm file theo tên trong uploads nếu không khớp thư mục con
        file_name = os.path.basename(stored_path)
        for root, _, files in os.walk(self.uploads_dir):
            if file_name in files:
                return os.path.join(root, file_name)

        return direct_candidate

    def extract_chunks(
        self,
        file_id: str,
        document_code: str,
        title: str,
        stored_path: str,
        security_level_id: int = 1,
        chunk_size: int = 500,
        chunk_overlap: int = 80
    ) -> List[Dict[str, Any]]:
        """
        Trích xuất văn bản từ tệp PDF thành các chunks có gán nhãn:
        - file_id
        - document_code
        - title
        - security_level_id (int 1..5)
        - page: int (1-indexed)
        - bbox: [x0, y0, x1, y1]
        - text: nội dung
        """
        resolved_path = self.resolve_file_path(stored_path)
        if not os.path.exists(resolved_path):
            raise FileNotFoundError(f"Không tìm thấy file PDF tại: {resolved_path} (stored_path={stored_path})")

        chunks: List[Dict[str, Any]] = []

        if not HAS_FITZ:
            # Fallback nếu môi trường chưa cài PyMuPDF (đọc dạng text thô)
            try:
                import pypdf  # type: ignore
                reader = pypdf.PdfReader(resolved_path)
                for page_idx, page in enumerate(reader.pages):
                    page_num = page_idx + 1
                    text = page.extract_text() or ""
                    clean_text = self._clean_text(text)
                    if not clean_text:
                        continue
                    page_chunks = self._split_text_to_chunks(clean_text, chunk_size, chunk_overlap)
                    for c_idx, chunk_text in enumerate(page_chunks):
                        chunks.append({
                            "chunk_id": f"{file_id}_p{page_num}_c{c_idx+1}",
                            "file_id": file_id,
                            "document_code": document_code,
                            "title": title,
                            "security_level_id": int(security_level_id),
                            "page": page_num,
                            "bbox": [0, 0, 0, 0],
                            "text": chunk_text
                        })
                return chunks
            except Exception as e:
                raise RuntimeError(f"Lỗi đọc PDF không có PyMuPDF: {e}")

        # PyMuPDF xử lý chuyên sâu với blocks & bbox
        doc = fitz.open(resolved_path)
        try:
            total_pages = doc.page_count
            for page_idx in range(total_pages):
                page_num = page_idx + 1
                page = doc.load_page(page_idx)
                
                # Trích xuất blocks: (x0, y0, x1, y1, text, block_no, block_type)
                blocks = page.get_text("blocks")
                text_blocks = []
                for b in blocks:
                    # block_type 0 = Text, 1 = Image
                    if b[6] == 0:
                        block_text = self._clean_text(b[4])
                        if block_text and len(block_text) > 10:
                            text_blocks.append({
                                "text": block_text,
                                "bbox": [round(b[0], 2), round(b[1], 2), round(b[2], 2), round(b[3], 2)]
                            })

                if not text_blocks:
                    # Thử lấy plain text toàn trang nếu blocks rỗng
                    full_page_text = self._clean_text(page.get_text())
                    if full_page_text:
                        text_blocks.append({
                            "text": full_page_text,
                            "bbox": [0, 0, round(page.rect.width, 2), round(page.rect.height, 2)]
                        })

                # Gom hoặc chia blocks thành chunks hợp lý
                c_counter = 0
                for block in text_blocks:
                    b_text = block["text"]
                    b_box = block["bbox"]

                    if len(b_text) <= chunk_size * 1.5:
                        c_counter += 1
                        chunks.append({
                            "chunk_id": f"{file_id}_p{page_num}_c{c_counter}",
                            "file_id": file_id,
                            "document_code": document_code,
                            "title": title,
                            "security_level_id": int(security_level_id),
                            "page": page_num,
                            "bbox": b_box,
                            "text": b_text
                        })
                    else:
                        sub_chunks = self._split_text_to_chunks(b_text, chunk_size, chunk_overlap)
                        for sub_text in sub_chunks:
                            c_counter += 1
                            chunks.append({
                                "chunk_id": f"{file_id}_p{page_num}_c{c_counter}",
                                "file_id": file_id,
                                "document_code": document_code,
                                "title": title,
                                "security_level_id": int(security_level_id),
                                "page": page_num,
                                "bbox": b_box,
                                "text": sub_text
                            })
        finally:
            doc.close()

        return chunks

    def get_document_full_text_by_pages(self, stored_path: str) -> List[Dict[str, Any]]:
        """
        Lấy toàn bộ nội dung tài liệu theo từng trang phục vụ sinh Sơ đồ và Đề kiểm tra.
        """
        resolved_path = self.resolve_file_path(stored_path)
        if not os.path.exists(resolved_path):
            return []

        pages_data = []
        if HAS_FITZ:
            doc = fitz.open(resolved_path)
            try:
                for idx in range(doc.page_count):
                    page = doc.load_page(idx)
                    text = self._clean_text(page.get_text())
                    pages_data.append({
                        "page": idx + 1,
                        "text": text
                    })
            finally:
                doc.close()
        return pages_data

    @staticmethod
    def _clean_text(raw_text: str) -> str:
        if not raw_text:
            return ""
        # Chuẩn hóa khoảng trắng và ngắt dòng
        text = re.sub(r'\r\n', '\n', raw_text)
        text = re.sub(r'[\t ]+', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    @staticmethod
    def _split_text_to_chunks(text: str, chunk_size: int, overlap: int) -> List[str]:
        if len(text) <= chunk_size:
            return [text]

        paragraphs = text.split("\n")
        chunks = []
        current = ""

        for p in paragraphs:
            p = p.strip()
            if not p:
                continue
            if len(current) + len(p) + 1 <= chunk_size:
                current = (current + " " + p).strip()
            else:
                if current:
                    chunks.append(current)
                # Overlap
                if len(p) > chunk_size:
                    # Cắt tiếp theo từ nếu paragraph quá dài
                    words = p.split(" ")
                    temp = ""
                    for w in words:
                        if len(temp) + len(w) + 1 <= chunk_size:
                            temp = (temp + " " + w).strip()
                        else:
                            if temp:
                                chunks.append(temp)
                            temp = w
                    if temp:
                        current = temp
                else:
                    current = p

        if current and (not chunks or chunks[-1] != current):
            chunks.append(current)

        return chunks
