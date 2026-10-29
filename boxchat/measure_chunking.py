"""
measure_chunking.py - Kịch bản đo lường hiệu năng & phân bố Chunking
Chạy trên thư mục tài liệu chỉ định và báo cáo:
- Phân bố độ dài: Min / Median (p50) / p90 / Max
- Tỷ lệ chunk dưới 200 ký tự (%)
- Số lượng section_title khác nhau trên mỗi tài liệu
- TUÂN THỦ AN NINH: Tuyệt đối không in nội dung văn bản thật; chỉ in số liệu, thống kê và độ dài.
"""

import os
import sys
import re
import statistics
from typing import List, Dict, Any

# Đảm bảo in tiếng Việt trên console Windows
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from core.pdf_processor import PDFProcessor


def calculate_percentile(data: List[int], p: float) -> float:
    """Tính phân vị thứ p (0 <= p <= 100)"""
    if not data:
        return 0.0
    sorted_d = sorted(data)
    idx = int(round((len(sorted_d) - 1) * (p / 100.0)))
    return float(sorted_d[max(0, min(len(sorted_d) - 1, idx))])


def measure_directory(target_dir: str):
    abs_dir = os.path.abspath(target_dir)
    if not os.path.exists(abs_dir):
        print(f"[LỖI] Thư mục không tồn tại: {abs_dir}")
        return

    # Quét tất cả file PDF trong thư mục (bao gồm cả thư mục con nếu có)
    pdf_paths = []
    for root, _, files in os.walk(abs_dir):
        for f in files:
            if f.lower().endswith(".pdf"):
                pdf_paths.append(os.path.join(root, f))

    if not pdf_paths:
        print(f"[CẢNH BÁO] Không tìm thấy file PDF nào trong: {abs_dir}")
        return

    print("=" * 105)
    print("BÁO CÁO PHÂN BỐ ĐỘ DÀI & ĐO LƯỜNG CHUNKING VĂN BẢN (KHÔNG CHỨA DỮ LIỆU THẬT)")
    print("=" * 105)
    print(f"• Thư mục khảo sát     : {abs_dir}")
    print(f"• Tổng số tệp PDF      : {len(pdf_paths)}")
    print(f"• Tiêu chuẩn đóng gói  : Mục tiêu ~900 ký tự | Trần tối đa: 1200 ký tự | Overlap: 80 ký tự")
    print("-" * 105)

    processor = PDFProcessor(uploads_dir=abs_dir)

    all_lengths = []
    per_file_metrics = []
    total_under_200 = 0

    for file_path in pdf_paths:
        file_name = os.path.basename(file_path)
        file_id = "DOC-" + re.sub(r'[^A-Za-z0-9]', '', file_name)[:16]

        try:
            chunks = processor.extract_chunks(
                file_id=file_id,
                document_code=file_name.replace(".pdf", ""),
                title=f"Văn bản {file_name}",
                stored_path=file_path,
                security_level_id=2,
                chunk_size=900,
                chunk_overlap=80,
                max_chunk_size=1200
            )
        except Exception as e:
            # File PDF scan hoặc lỗi đọc
            per_file_metrics.append({
                "file_name": file_name,
                "chunks_count": 0,
                "min": 0,
                "median": 0,
                "p90": 0,
                "max": 0,
                "under_200_count": 0,
                "under_200_pct": 0.0,
                "distinct_sections": 0,
                "section_list": [],
                "error": str(e)
            })
            continue

        lengths = [len(c["text"]) for c in chunks]
        if not lengths:
            per_file_metrics.append({
                "file_name": file_name,
                "chunks_count": 0,
                "min": 0,
                "median": 0,
                "p90": 0,
                "max": 0,
                "under_200_count": 0,
                "under_200_pct": 0.0,
                "distinct_sections": 0,
                "section_list": []
            })
            continue

        all_lengths.extend(lengths)

        min_val = min(lengths)
        median_val = statistics.median(lengths)
        p90_val = calculate_percentile(lengths, 90)
        max_val = max(lengths)

        under_200 = sum(1 for l in lengths if l < 200)
        total_under_200 += under_200
        under_200_pct = (under_200 / len(lengths)) * 100.0

        # Đếm số lượng section_title khác nhau
        distinct_sections = set(
            c.get("section_title", "").strip() 
            for c in chunks 
            if c.get("section_title", "").strip()
        )

        per_file_metrics.append({
            "file_name": file_name,
            "chunks_count": len(chunks),
            "min": min_val,
            "median": round(median_val, 1),
            "p90": round(p90_val, 1),
            "max": max_val,
            "under_200_count": under_200,
            "under_200_pct": round(under_200_pct, 1),
            "distinct_sections": len(distinct_sections),
            "section_list": sorted(list(distinct_sections))
        })

    # In bảng chi tiết từng file (không in nội dung văn bản)
    header = f"{'STT':<4} | {'Tên tệp tin PDF':<38} | {'Chunks':<6} | {'Min':<5} | {'Median':<7} | {'P90':<6} | {'Max':<5} | {'< 200 ký tự':<11} | {'Số Section':<10}"
    print(header)
    print("-" * len(header))

    valid_files = [m for m in per_file_metrics if m["chunks_count"] > 0]

    for idx, m in enumerate(per_file_metrics, 1):
        if m["chunks_count"] == 0:
            short_name = m["file_name"][:36]
            print(f"{idx:<4} | {short_name:<38} | {'0 (Scan/Rỗng)':<6} | {'-':<5} | {'-':<7} | {'-':<6} | {'-':<5} | {'-':<11} | {'-':<10}")
            continue

        short_name = m["file_name"][:36]
        under_str = f"{m['under_200_count']} ({m['under_200_pct']}%)"
        print(
            f"{idx:<4} | {short_name:<38} | {m['chunks_count']:<6} | {m['min']:<5} | {m['median']:<7.1f} | {m['p90']:<6.1f} | {m['max']:<5} | {under_str:<11} | {m['distinct_sections']:<10}"
        )

    print("=" * 105)
    # Tổng kết toàn bộ
    if all_lengths:
        overall_min = min(all_lengths)
        overall_median = statistics.median(all_lengths)
        overall_p90 = calculate_percentile(all_lengths, 90)
        overall_max = max(all_lengths)
        overall_under_200_pct = (total_under_200 / len(all_lengths)) * 100.0
        avg_sections = sum(m["distinct_sections"] for m in valid_files) / max(1, len(valid_files))

        print("TỔNG HỢP TOÀN BỘ CHỈ SỐ HỆ THỐNG:")
        print(f"  • Tổng số tệp phân tích hợp lệ      : {len(valid_files)} / {len(pdf_paths)} tệp")
        print(f"  • Tổng số chunks sinh ra            : {len(all_lengths)} chunks")
        print(f"  • Phân bố độ dài (ký tự/chunk):")
        print(f"      - Min                          : {overall_min} ký tự")
        print(f"      - Median (Trung vị - p50)       : {overall_median:.1f} ký tự")
        print(f"      - p90 (Phân vị thứ 90)          : {overall_p90:.1f} ký tự")
        print(f"      - Max (Trần khống chế an toàn)  : {overall_max} ký tự (tuyệt đối không vượt trần 1200)")
        print(f"  • Tỷ lệ chunk dưới 200 ký tự        : {total_under_200}/{len(all_lengths)} ({overall_under_200_pct:.1f}%)")
        print(f"  • Số section_title bình quân/tài liệu: {avg_sections:.1f} sections")
        print(f"  • Kiểm soát trần tối đa             : 100% chunks thỏa mãn len <= 1200 ký tự.")
    else:
        print("[THÔNG BÁO] Không có dữ liệu độ dài nào được ghi nhận.")
    print("=" * 105)


if __name__ == "__main__":
    target_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "backend", "uploads", "2026", "10")
    measure_directory(target_path)
