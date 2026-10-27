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
        chunk_size: int = 900,
        chunk_overlap: int = 80,
        max_chunk_size: int = 1200
    ) -> List[Dict[str, Any]]:
        """
        Trích xuất văn bản từ tệp PDF thành các chunks có gán nhãn:
        - Packing các block cùng trang, cùng section_title đến mục tiêu ~900 ký tự (max 1200).
        - Gộp bbox tương ứng.
        - Giữ nguyên định dạng: chunk_id, file_id, page, bbox.
        """
        resolved_path = self.resolve_file_path(stored_path)
        if not os.path.exists(resolved_path):
            raise FileNotFoundError(f"Không tìm thấy file PDF tại: {resolved_path} (stored_path={stored_path})")

        chunks: List[Dict[str, Any]] = []
        current_section_title = ""  # Reset section_title khi sang tài liệu mới

        if not HAS_FITZ:
            # Fallback nếu môi trường chưa cài PyMuPDF (đọc dạng text thô)
            try:
                import pypdf  # type: ignore
                reader = pypdf.PdfReader(resolved_path)
                c_counter = 0
                for page_idx, page in enumerate(reader.pages):
                    page_num = page_idx + 1
                    text = page.extract_text() or ""
                    clean_text = self._clean_text(text)
                    if not clean_text:
                        continue
                    page_chunks_raw = self._split_text_to_chunks(clean_text, chunk_size, chunk_overlap, max_chunk_size)
                    page_items = []
                    for ct in page_chunks_raw:
                        ct = ct.strip()
                        if not ct:
                            continue
                        if len(ct) < 120 and page_items:
                            merged = f"{page_items[-1]['text']}\n\n{ct}"
                            if len(merged) <= 1250:
                                page_items[-1]["text"] = merged
                                continue
                        if len(ct) < 30 and not page_items:
                            continue
                        sec = self._extract_section_title(ct) if self._is_heading(ct) else current_section_title
                        if self._is_heading(ct):
                            current_section_title = sec
                        page_items.append({"text": ct, "section_title": current_section_title})

                    for it in page_items:
                        c_counter += 1
                        chunks.append({
                            "chunk_id": f"{file_id}_p{page_num}_c{c_counter}",
                            "file_id": file_id,
                            "document_code": document_code,
                            "title": title,
                            "section_title": it["section_title"],
                            "security_level_id": int(security_level_id),
                            "page": page_num,
                            "bbox": [0, 0, 0, 0],
                            "text": it["text"]
                        })

                total_chars = sum(len(c.get("text", "")) for c in chunks)
                if total_chars < 50:
                    print(f"[OCR_REQUIRED] file_id={file_id} - Tệp PDF có ít hơn 50 ký tự văn bản ({total_chars} ký tự), nhận diện là tệp scan ảnh.")
                return chunks
            except Exception as e:
                raise RuntimeError(f"Lỗi đọc PDF không có PyMuPDF: {e}")

        # PyMuPDF xử lý chuyên sâu với blocks & bbox
        doc = fitz.open(resolved_path)
        try:
            total_pages = doc.page_count
            c_counter = 0

            for page_idx in range(total_pages):
                page_num = page_idx + 1
                page = doc.load_page(page_idx)
                
                # Trích xuất blocks: (x0, y0, x1, y1, text, block_no, block_type)
                blocks = page.get_text("blocks")
                raw_text_blocks = []
                for b in blocks:
                    # block_type 0 = Text, 1 = Image
                    if b[6] == 0:
                        block_text = self._clean_text(b[4])
                        if block_text and len(block_text) > 10:
                            raw_text_blocks.append({
                                "text": block_text,
                                "bbox": [round(b[0], 2), round(b[1], 2), round(b[2], 2), round(b[3], 2)]
                            })

                if not raw_text_blocks:
                    # Thử lấy plain text toàn trang nếu blocks rỗng
                    full_page_text = self._clean_text(page.get_text())
                    if full_page_text:
                        raw_text_blocks.append({
                            "text": full_page_text,
                            "bbox": [0, 0, round(page.rect.width, 2), round(page.rect.height, 2)]
                        })

                # PACKING & CHỐNG CHUNK RÁC:
                # 1. Gộp các block liền kề cùng trang (cùng section_title) tới mục tiêu ~900 ký tự (max 1200).
                # 2. Nếu một chunk ở cuối trang/mục < 120 ký tự: ưu tiên gộp ngược vào chunk trước cùng trang (nếu <= 1250).
                # 3. Loại bỏ chunk nhiễu < 30 ký tự.
                page_chunks: List[Dict[str, Any]] = []

                def add_to_page_chunks(c_text: str, c_box: Optional[List[float]], c_sec: str):
                    c_text = c_text.strip()
                    if not c_text:
                        return

                    # Nếu chunk ngắn < 120 ký tự
                    if len(c_text) < 120:
                        # Ưu tiên gộp ngược vào chunk liền trước trên cùng trang nếu sau gộp <= 1250 ký tự
                        if page_chunks:
                            prev = page_chunks[-1]
                            candidate_merged = f"{prev['text']}\n\n{c_text}"
                            if len(candidate_merged) <= 1250:
                                prev["text"] = candidate_merged
                                if c_box and prev.get("bbox"):
                                    prev["bbox"] = [
                                        min(prev["bbox"][0], c_box[0]),
                                        min(prev["bbox"][1], c_box[1]),
                                        max(prev["bbox"][2], c_box[2]),
                                        max(prev["bbox"][3], c_box[3]),
                                    ]
                                return

                        # Nếu không thể gộp ngược: loại bỏ nếu là chunk nhiễu < 30 ký tự
                        if len(c_text) < 30:
                            return

                    # Nếu độ dài chunk thỏa mãn
                    if len(c_text) <= max_chunk_size:
                        page_chunks.append({
                            "text": c_text,
                            "bbox": c_box or [0, 0, 0, 0],
                            "section_title": c_sec
                        })
                    else:
                        sub_chunks = self._split_text_to_chunks(
                            c_text,
                            chunk_size=chunk_size,
                            overlap=chunk_overlap,
                            max_chunk_size=max_chunk_size
                        )
                        for sub_t in sub_chunks:
                            add_to_page_chunks(sub_t, c_box, c_sec)

                current_pack_text = ""
                current_pack_box = None
                current_pack_sec = current_section_title

                for b in raw_text_blocks:
                    b_text = b["text"].strip()
                    b_box = b["bbox"]

                    # Kiểm tra xem block này có mở đầu bằng tiêu đề Điều/Khoản/Mục/Chương/Phần/La Mã không
                    if self._is_heading(b_text):
                        new_sec_title = self._extract_section_title(b_text)
                        # Nếu đã có pack trước đó thuộc section khác, emit ngay
                        if current_pack_text:
                            add_to_page_chunks(current_pack_text, current_pack_box, current_pack_sec)
                            current_pack_text = ""
                            current_pack_box = None
                        current_section_title = new_sec_title
                        current_pack_sec = new_sec_title

                    # Thêm b_text vào pack hiện tại
                    if not current_pack_text:
                        current_pack_text = b_text
                        current_pack_box = list(b_box)
                        current_pack_sec = current_section_title
                    else:
                        candidate = f"{current_pack_text}\n\n{b_text}"
                        if len(candidate) <= max_chunk_size:
                            current_pack_text = candidate
                            current_pack_box = [
                                min(current_pack_box[0], b_box[0]),
                                min(current_pack_box[1], b_box[1]),
                                max(current_pack_box[2], b_box[2]),
                                max(current_pack_box[3], b_box[3])
                            ]
                            # Nếu đã đạt ngưỡng mục tiêu ~900 ký tự, ngắt ở ranh giới đoạn
                            if len(current_pack_text) >= chunk_size:
                                add_to_page_chunks(current_pack_text, current_pack_box, current_pack_sec)
                                current_pack_text = ""
                                current_pack_box = None
                        else:
                            # Nếu thêm vào sẽ vượt trần 1200 ký tự -> ngắt đoạn, emit pack cũ
                            add_to_page_chunks(current_pack_text, current_pack_box, current_pack_sec)
                            current_pack_text = b_text
                            current_pack_box = list(b_box)
                            current_pack_sec = current_section_title

                # Cuối trang: emit nốt pack còn lại nếu có
                if current_pack_text:
                    add_to_page_chunks(current_pack_text, current_pack_box, current_pack_sec)
                    current_pack_text = ""
                    current_pack_box = None

                # Đóng gói danh sách chunks hoàn chỉnh của trang
                for item in page_chunks:
                    c_counter += 1
                    chunks.append({
                        "chunk_id": f"{file_id}_p{page_num}_c{c_counter}",
                        "file_id": file_id,
                        "document_code": document_code,
                        "title": title,
                        "section_title": item["section_title"],
                        "security_level_id": int(security_level_id),
                        "page": page_num,
                        "bbox": item["bbox"],
                        "text": item["text"]
                    })
        finally:
            doc.close()

        # Kiểm tra tổng số ký tự của tài liệu, cảnh báo nếu là scan ảnh
        total_doc_chars = sum(len(c.get("text", "")) for c in chunks)
        if total_doc_chars < 50:
            print(f"[OCR_REQUIRED] file_id={file_id} - Tệp PDF có ít hơn 50 ký tự văn bản ({total_doc_chars} ký tự), nhận diện là tệp scan ảnh.")

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
    def _is_heading(text: str) -> bool:
        t = text.strip()
        if not t:
            return False

        t_lower = t.lower()

        # 1. Danh sách loại trừ phần thể thức đầu văn bản (quốc hiệu, tiêu ngữ, cơ quan ban hành, số ký hiệu, ngày tháng)
        admin_excludes = [
            r'cộng\s*hòa\s*xã\s*hội\s*chủ\s*nghĩa\s*việt\s*nam',
            r'độc\s*lập\s*[-–—\s]+\s*tự\s*do\s*[-–—\s]+\s*hạnh\s*phúc',
            r'^(bộ\s*quốc\s*phòng|bộ\s*tư\s*lệnh|quân\s*khu\s*7|quân\s*khu|trường\s*quân\s*sự|phòng\s*tham\s*mưu|ban\s*chỉ\s*huy|ban\s*giám\s*hiệu|cơ\s*quan|tiểu\s*đoàn|trung\s*đoàn|sư\s*đoàn|lữ\s*đoàn)',
            r'^(thông\s*báo|kế\s*hoạch|báo\s*cáo|quyết\s*định|chỉ\s*thị|nghị\s*quyết|công\s*văn)(\s+về\s+việc|\s+số|\s*$)',
            r'^số\s*:\s*|^số\s+\d+',
            r'(ngày\s+\d+\s+tháng\s+\d+\s+năm\s+\d+|.*,\s*ngày\s+\d+\s+tháng\s+\d+)',
        ]
        for pattern in admin_excludes:
            if re.search(pattern, t_lower):
                return False

        # 2. Bỏ quy tắc "dòng in hoa ngắn". Chỉ nhận Chương/Mục/Điều/Khoản/Phần và số La Mã
        heading_pattern = r'^(Chương|Mục|Điều|Khoản|Phần)\s+([0-9IVXLCDM]+|[a-zA-Zà-ỹÀ-Ỹ0-9]+)|^([IVXLCDM]+)\.\s+'
        if re.match(heading_pattern, t, re.IGNORECASE):
            return True

        return False

    @staticmethod
    def _extract_section_title(text: str) -> str:
        first_line = text.strip().split("\n")[0].strip()
        return first_line[:150]

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
    def _split_text_to_chunks(
        text: str,
        chunk_size: int = 900,
        overlap: int = 80,
        max_chunk_size: int = 1200
    ) -> List[str]:
        if not text:
            return []
        clean = text.strip()
        if len(clean) <= max_chunk_size:
            return [clean]

        # Khống chế overlap hợp lý (< 35% chunk_size)
        overlap = max(0, min(overlap, int(chunk_size * 0.35)))
        paragraphs = clean.split("\n")
        chunks = []
        current = ""

        def _get_overlap_prefix(source_chunk: str, target_overlap: int) -> str:
            if not source_chunk or target_overlap <= 0:
                return ""
            tail = source_chunk[-target_overlap:].strip()
            # Tìm khoảng trắng đầu tiên trong tail để tránh cắt ngang từ
            space_idx = tail.find(" ")
            if space_idx != -1 and space_idx < len(tail) - 5:
                tail = tail[space_idx + 1:].strip()
            return tail

        for p in paragraphs:
            p_str = p.strip()
            if not p_str:
                continue

            if len(p_str) > chunk_size:
                words = p_str.split(" ")
                for w in words:
                    if not w:
                        continue
                    candidate = (current + " " + w).strip() if current else w
                    if len(candidate) <= chunk_size:
                        current = candidate
                    else:
                        if current:
                            chunks.append(current)
                            prefix = _get_overlap_prefix(current, overlap)
                            current = (prefix + " " + w).strip() if prefix else w
                        else:
                            current = w
            else:
                candidate = (current + "\n" + p_str).strip() if current else p_str
                if len(candidate) <= max_chunk_size and len(current) < chunk_size:
                    current = candidate
                else:
                    if current:
                        chunks.append(current)
                        prefix = _get_overlap_prefix(current, overlap)
                        current = (prefix + "\n" + p_str).strip() if prefix else p_str
                    else:
                        current = p_str

        if current and (not chunks or chunks[-1] != current):
            if len(current) <= max_chunk_size:
                chunks.append(current)
            else:
                for i in range(0, len(current), max_chunk_size - overlap):
                    sub = current[i:i + max_chunk_size].strip()
                    if sub and (not chunks or chunks[-1] != sub):
                        chunks.append(sub)

        return chunks
