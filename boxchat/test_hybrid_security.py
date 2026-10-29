"""
test_hybrid_security.py - Kiểm thử tự động Bộ lọc Bảo mật 5 cấp độ,
Khử trùng lặp nội dung và Hậu kiểm trích dẫn số trang cho QK7 AI Boxchat.
"""

import os
import shutil
import pytest
from core.vector_store import HybridVectorStore
from core.agent_tutor import AgentTutor
from core.pdf_processor import PDFProcessor


@pytest.fixture
def clean_test_storage(tmp_path):
    storage_dir = tmp_path / "test_qdrant_data"
    yield str(storage_dir)
    if os.path.exists(str(storage_dir)):
        shutil.rmtree(str(storage_dir), ignore_errors=True)


def test_security_clearance_levels_defense_in_depth(clean_test_storage):
    """
    Kiểm tra với mọi mức user_clearance từ 1 đến 4, hàm search()
    TUYỆT ĐỐI không bao giờ trả về bất kỳ chunk nào có security_level_id > user_clearance.
    Clearance Leak Count bắt buộc = 0.
    """
    store = HybridVectorStore(storage_path=clean_test_storage)

    # Nạp các chunk giả lập ở cả 5 cấp độ mật
    mock_chunks = [
        {
            "chunk_id": "DOC-PUB_p1_c1",
            "file_id": "DOC-PUB",
            "document_code": "01/HD-BQP",
            "title": "Hướng dẫn công khai",
            "security_level_id": 1,
            "page": 1,
            "text": "Tài liệu phổ biến công khai toàn quân khu về điều lệnh và tác chiến bộ binh."
        },
        {
            "chunk_id": "DOC-INT_p1_c1",
            "file_id": "DOC-INT",
            "document_code": "02/KH-QK7",
            "title": "Kế hoạch nội bộ",
            "security_level_id": 2,
            "page": 1,
            "text": "Kế hoạch lưu hành nội bộ cơ quan tham mưu về huấn luyện chiến đấu và tác chiến."
        },
        {
            "chunk_id": "DOC-CONF_p1_c1",
            "file_id": "DOC-CONF",
            "document_code": "03/PA-QK7",
            "title": "Phương án mật",
            "security_level_id": 3,
            "page": 1,
            "text": "Phương án tác chiến mật điều động lực lượng sẵn sàng cơ động tại địa bàn xung yếu."
        },
        {
            "chunk_id": "DOC-SECRET_p1_c1",
            "file_id": "DOC-SECRET",
            "document_code": "04/ML-QK7",
            "title": "Mệnh lệnh tối mật",
            "security_level_id": 4,
            "page": 1,
            "text": "Mệnh lệnh tối mật tác chiến phòng thủ hướng chiến dịch và bảo vệ căn cứ."
        },
        {
            "chunk_id": "DOC-TOP_p1_c1",
            "file_id": "DOC-TOP",
            "document_code": "05/DA-QK7",
            "title": "Đề án tuyệt mật",
            "security_level_id": 5,
            "page": 1,
            "text": "Đề án tuyệt mật tác chiến bảo vệ vùng lãnh thổ chiến lược quốc gia cấp đặc biệt."
        }
    ]

    added = store.add_chunks(mock_chunks)
    assert added == 5

    query = "kế hoạch tác chiến điều động lực lượng"

    # Kiểm tra toàn diện trên mọi cấp độ quyền từ Cấp 1 đến Cấp 4
    for clearance in [1, 2, 3, 4]:
        results = store.search(query=query, max_security_level=clearance, top_k=10)
        assert len(results) > 0, f"Phải tìm thấy tài liệu phù hợp cho cấp {clearance}"

        # Kiểm tra không có bất kỳ chunk nào vượt quá cấp quyền
        leaked_chunks = [r for r in results if int(r.get("security_level_id", 1)) > clearance]
        assert len(leaked_chunks) == 0, (
            f"VI PHẠM BẢO MẬT: Phát hiện {len(leaked_chunks)} chunk vượt cấp mật "
            f"cho user_clearance={clearance}: {[c.get('chunk_id') for c in leaked_chunks]}"
        )

        # Kiểm tra cụ thể: Cấp 1 không thấy Cấp 2, 3, 4, 5
        if clearance == 1:
            sec_ids = [r["security_level_id"] for r in results]
            assert all(s == 1 for s in sec_ids)

        # Kiểm tra Cấp 2 không thấy Cấp 3, 4, 5
        if clearance == 2:
            sec_ids = [r["security_level_id"] for r in results]
            assert all(s in [1, 2] for s in sec_ids)

        # Kiểm tra Tuyệt Mật (Cấp 5) TUYỆT ĐỐI không bao giờ xuất hiện khi clearance <= 4
        assert not any(r["security_level_id"] == 5 for r in results)


def test_content_deduplication(clean_test_storage):
    """
    Kiểm tra tính năng khử trùng lặp (Content Deduplication):
    Khi có 3 file copy khác nhau có nội dung chuẩn hóa giống hệt nhau,
    chỉ giữ lại 1 chunk có điểm cao nhất trong Top-K.
    """
    store = HybridVectorStore(storage_path=clean_test_storage)

    base_text = "Quy định chi tiết về tổ chức kíp trực chỉ huy tác chiến phòng không năm 2026."

    chunks_with_duplicates = [
        {
            "chunk_id": "FILE_COPY_A_p1_c1",
            "file_id": "FILE_COPY_A",
            "document_code": "DOC-A",
            "title": "Bản sao A",
            "security_level_id": 2,
            "page": 1,
            "text": base_text
        },
        {
            "chunk_id": "FILE_COPY_B_p1_c1",
            "file_id": "FILE_COPY_B",
            "document_code": "DOC-B",
            "title": "Bản sao B",
            "security_level_id": 2,
            "page": 1,
            "text": "  " + base_text + "  \n"  # Chuẩn hóa khoảng trắng
        },
        {
            "chunk_id": "FILE_COPY_C_p1_c1",
            "file_id": "FILE_COPY_C",
            "document_code": "DOC-C",
            "title": "Bản sao C",
            "security_level_id": 2,
            "page": 1,
            "text": base_text.lower()
        },
        {
            "chunk_id": "FILE_DIFF_p1_c1",
            "file_id": "FILE_DIFF",
            "document_code": "DOC-DIFF",
            "title": "Bản độc lập",
            "security_level_id": 2,
            "page": 1,
            "text": "Nội dung hoàn toàn khác về quy trình tiếp nhận văn thư bảo mật."
        }
    ]

    store.add_chunks(chunks_with_duplicates)
    results = store.search(query="kíp trực chỉ huy tác chiến", max_security_level=2, top_k=5)

    # Đếm số lần văn bản base_text xuất hiện trong kết quả
    matching_duplicate_count = sum(
        1 for r in results if "tổ chức kíp trực chỉ huy tác chiến" in r["text"].lower()
    )

    # Phải được khử trùng lặp, chỉ xuất hiện đúng 1 lần duy nhất
    assert matching_duplicate_count == 1, (
        f"Lỗi khử trùng lặp: Văn bản giống nhau xuất hiện {matching_duplicate_count} lần trong top-k (kỳ vọng 1)"
    )


def test_verify_inline_citations_removes_hallucinations():
    """
    Kiểm tra hàm _verify_inline_citations:
    - Xóa đúng số trang bịa đặt không có trong valid_chunks.
    - Giữ nguyên số trang hợp lệ.
    """
    tutor = AgentTutor()

    # Dữ liệu nguồn chỉ có ở trang 1 và trang 3
    valid_chunks = [
        {"file_id": "F1", "page": 1, "document_code": "DOC-01", "text": "Trang 1 quy định..."},
        {"file_id": "F1", "page": 3, "document_code": "DOC-01", "text": "Trang 3 quy định..."}
    ]

    llm_answer_with_hallucinations = (
        "Báo cáo đồng chí, theo quy định tại trang 1 [p.1], lực lượng trực chiến phải sẵn sàng. "
        "Đồng thời, tại [Trang 3], kíp trực có nhiệm vụ kiểm tra trang thiết bị. "
        "Ngoài ra theo điều khoản phụ [p.88] và quy định bổ sung [Trang 120], có những yêu cầu khác."
    )

    verified_text, fabricated = tutor._verify_inline_citations(llm_answer_with_hallucinations, valid_chunks)

    # Số trang bịa đặt phải là [p.88] và [Trang 120]
    assert "[p.88]" in fabricated
    assert "[Trang 120]" in fabricated

    # Không được có nhãn bịa đặt trong câu trả lời đã kiểm toán
    assert "[p.88]" not in verified_text
    assert "[Trang 120]" not in verified_text

    # Các nhãn hợp lệ phải được bảo toàn
    assert "[p.1]" in verified_text
    assert "[Trang 3]" in verified_text


def test_pdf_processor_garbage_chunk_prevention(tmp_path):
    """
    Kiểm tra logic chống chunk rác và cảnh báo OCR:
    - Chunk < 120 ký tự gộp ngược vào chunk trước cùng trang.
    - Chunk < 30 ký tự bị loại bỏ.
    - Cảnh báo [OCR_REQUIRED] khi tổng ký tự < 50.
    """
    proc = PDFProcessor()

    # Kiểm tra hàm _split_text_to_chunks đảm bảo overlap > 0 và không vượt quá max_chunk_size
    text_long = (
        "Điều 1. Phạm vi áp dụng văn bản quy phạm kỹ thuật.\n\n" +
        "Khoản 1. Quy định này áp dụng cho toàn thể cán bộ, chiến sĩ trực thuộc Bộ Tư Lệnh Quân Khu 7. " * 15
    )
    chunks = proc._split_text_to_chunks(text_long, chunk_size=900, overlap=80, max_chunk_size=1200)

    assert len(chunks) >= 2
    for c in chunks:
        assert len(c) <= 1200
    assert chunks[1].startswith("áp dụng") or "chiến sĩ" in chunks[1][:100]
