"""
reindex_all.py - Quét và nạp lại toàn bộ tài liệu PDF vào HybridVectorStore (bge-m3 1024-d)
Chỉ in các số liệu tổng hợp, file_id và cấp độ mật.
TUYỆT ĐỐI KHÔNG in nội dung văn bản thật ra màn hình báo cáo.
"""

import os
import sys
import re
from typing import List, Dict, Any

# Đảm bảo in tiếng Việt trên console Windows
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Thêm thư mục hiện tại vào sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from core.pdf_processor import PDFProcessor
from core.vector_store import HybridVectorStore


def assign_security_level(filename: str, index: int) -> int:
    """
    Phân bổ cấp độ mật 1-5 theo từ khóa hoặc chu kỳ đảm bảo có đủ 5 cấp để kiểm thử.
    """
    fn_lower = filename.lower()
    if "tuyetmat" in fn_lower or "tuyet_mat" in fn_lower:
        return 5
    if "toimat" in fn_lower or "toi_mat" in fn_lower:
        return 4
    if "mat" in fn_lower and "noi_bo" not in fn_lower:
        return 3

    # Phân bổ theo loại văn kiện quân sự
    if "_qd_" in fn_lower or "-qd-" in fn_lower:
        return 3  # Quyết định tác chiến / tổ chức biên chế (Cấp 3 Mật)
    elif "_ct_" in fn_lower or "-ct-" in fn_lower:
        return 4  # Chỉ thị sẵn sàng chiến đấu (Cấp 4 Tối mật)
    elif "_kh_" in fn_lower or "-kh-" in fn_lower:
        return 3  # Kế hoạch tác chiến / diễn tập (Cấp 3 Mật)
    elif "_bc_" in fn_lower or "-bc-" in fn_lower:
        return 2  # Báo cáo quân sự nội bộ (Cấp 2 Nội bộ)
    elif "_tb_" in fn_lower or "-tb-" in fn_lower or "_cv_" in fn_lower:
        return 1  # Thông báo, công văn phổ biến (Cấp 1 Công khai)

    # Chu kỳ cân bằng cho các file dạng document (X).pdf
    return (index % 5) + 1


def reindex_all():
    target_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "backend", "uploads", "2026", "10"))
    uploads_root = os.path.abspath(os.path.join(BASE_DIR, "..", "backend", "uploads"))
    storage_path = os.getenv("QDRANT_STORAGE_PATH", os.path.join(BASE_DIR, "local_storage", "qdrant_data"))

    print("=" * 80)
    print("QUY TRÌNH RE-INDEX TOÀN BỘ TÀI LIỆU VÀO HYBRID VECTOR STORE (QK7 DATAHUB)")
    print("=" * 80)
    print(f"Thư mục nguồn      : {target_dir}")
    print(f"Kho lưu trữ Qdrant : {storage_path}")

    if not os.path.exists(target_dir):
        print(f"[CẢNH BÁO] Không tìm thấy thư mục {target_dir}, chuyển sang quét {uploads_root}")
        target_dir = uploads_root

    pdf_files = []
    for root, _, files in os.walk(target_dir):
        for f in files:
            if f.lower().endswith(".pdf"):
                pdf_files.append(os.path.join(root, f))

    pdf_files.sort()
    print(f"Phát hiện tổng số  : {len(pdf_files)} tệp PDF hợp lệ.")

    # 1. Khởi tạo & Làm sạch kho dữ liệu cũ
    processor = PDFProcessor(uploads_dir=uploads_root)
    store = HybridVectorStore(storage_path=storage_path)

    print("\n[Bước 1/3] Đang làm sạch kho vector cũ để nạp lại sạch sẽ...")
    store.clear_all()
    print("Đã làm sạch metadata_chunks.json và tái tạo collection Qdrant.")

    # 2. Bóc tách và trích xuất chunks qua PDFProcessor mới
    print("\n[Bước 2/3] Bóc tách tài liệu qua PDFProcessor (áp dụng Overlap & Heading Packing)...")
    all_chunks = []
    file_summary = []

    for idx, fpath in enumerate(pdf_files):
        fname = os.path.basename(fpath)
        # Sinh file_id đồng nhất
        clean_name = re.sub(r'[^A-Za-z0-9]', '', fname.replace(".pdf", ""))
        file_id = f"PDF-{clean_name[:24]}"
        doc_code = fname.replace(".pdf", "")
        sec_level = assign_security_level(fname, idx)

        try:
            chunks = processor.extract_chunks(
                file_id=file_id,
                document_code=doc_code,
                title=f"Văn kiện {doc_code}",
                stored_path=fpath,
                security_level_id=sec_level
            )
            all_chunks.extend(chunks)
            file_summary.append({
                "file_id": file_id,
                "sec_level": sec_level,
                "chunks_count": len(chunks),
                "file_size_kb": round(os.path.getsize(fpath) / 1024, 1)
            })
        except Exception as err:
            print(f"[LỖI BÓC TÁCH] {fname}: {err}")

    # 3. Nạp vào HybridVectorStore (Embedding bge-m3 1024-d & Lưu metadata)
    print(f"\n[Bước 3/3] Đang tạo vector bge-m3 (1024-d) và lưu {len(all_chunks)} chunks vào kho...")
    total_added = store.add_chunks(all_chunks)

    # 4. In bảng báo cáo tổng hợp (Không in text thật)
    print("\n" + "=" * 80)
    print("BÁO CÁO KẾT QUẢ RE-INDEX TOÀN DIỆN")
    print("=" * 80)
    print(f"Tổng số tệp PDF đã xử lý : {len(pdf_files)}")
    print(f"Tổng số chunks trích xuất : {len(all_chunks)}")
    print(f"Tổng số chunks đã nạp kho : {total_added}")
    print(f"Số chunks trong cache    : {store.get_total_chunks()}")
    print("-" * 80)
    print(f"{'STT':<4} | {'Mã File (file_id)':<28} | {'Cấp độ':<8} | {'Số Chunks':<10} | {'Dung lượng'}")
    print("-" * 80)
    for i, s in enumerate(file_summary):
        print(f"{i+1:<4} | {s['file_id']:<28} | Cấp {s['sec_level']:<4} | {s['chunks_count']:<10} | {s['file_size_kb']} KB")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    reindex_all()
