"""
test_multiturn_and_biometric.py - Bộ kiểm thử tự động cho:
1. Hội thoại đa lượt & Viết lại truy vấn (Query Rewriting với History)
2. Khóa Bảo mật Sinh trắc học Vân tay ZK9500 cho văn kiện Cấp 3-5
TUYỆT ĐỐI KHÔNG in nội dung văn bản thật ra màn hình.
"""

import pytest
from core.agent_tutor import AgentTutor


@pytest.fixture
def agent_tutor():
    return AgentTutor()


def test_query_rewriting_with_history(agent_tutor):
    """
    1. Kiểm chứng Query Rewriting:
    Câu hỏi nối tiếp có đại từ tham chiếu ('đó', 'này'...) hoặc câu hỏi ngắn (< 8 từ)
    phải tự động kế thừa số hiệu văn bản / thực thể từ lượt trao đổi trước.
    """
    history = [
        {
            "role": "user",
            "content": "Tìm văn bản về công tác huấn luyện chiến đấu năm 2026?"
        },
        {
            "role": "assistant",
            "content": "Báo cáo đồng chí, căn cứ theo Quyết định số 123/QĐ-BGH ngày 10/10/2026 của Bộ Tư Lệnh Quân Khu 7 [p.1], kế hoạch huấn luyện bắt đầu từ tháng 11/2026."
        }
    ]

    # Câu hỏi ngắn chứa đại từ tham chiếu "đó"
    followup_query = "Ai ký quyết định đó?"
    rewritten = agent_tutor._rewrite_query_with_history(followup_query, history)

    # Đảm bảo câu truy vấn mở rộng giữ nguyên query gốc và bổ sung số hiệu/thực thể
    assert "Ai ký quyết định đó?" in rewritten
    assert ("123/QĐ-BGH" in rewritten or "123-QD-BGH" in rewritten)

    # Nếu history rỗng, query phải giữ nguyên 100%
    standalone_query = "Kế hoạch tuần hành quân sự?"
    assert agent_tutor._rewrite_query_with_history(standalone_query, []) == standalone_query
    assert agent_tutor._rewrite_query_with_history(standalone_query, None) == standalone_query


def test_biometric_guard_blocks_classified_text_when_unverified(agent_tutor):
    """
    2. Kiểm chứng Khóa Vân tay chặn tài liệu Cấp 3-5 khi biometric_verified=False:
    User Cấp 4 hỏi về tài liệu Cấp 3/4.
    Kết quả:
    - Câu trả lời và snippet TUYỆT ĐỐI KHÔNG chứa nội dung mật.
    - Cờ requires_biometric = True.
    - Snippet bị thay thế bằng thông báo yêu cầu vân tay ZK9500.
    """
    secret_text_1 = "KẾ HOẠCH TÁC CHIẾN TUYỆT MẬT ĐỊA BÀN CHIẾN LƯỢC SỐ 7 KHU VỰC BIÊN GIỚI ĐỢT 2"
    secret_text_2 = "CHỈ THỊ TỐI MẬT SỐ 05-CT VỀ ĐIỀU ĐỘNG TRUNG ĐOÀN ĐẶC CÔNG VÀ KHÍ TÀI BẢO VỆ"

    chunks = [
        {
            "chunk_id": "CHK-SEC-01",
            "file_id": "PDF-KH-001",
            "document_code": "145/KH-TQS",
            "title": "Kế hoạch tác chiến phòng thủ",
            "page": 2,
            "security_level_id": 3,
            "text": secret_text_1,
            "score": 0.85
        },
        {
            "chunk_id": "CHK-SEC-02",
            "file_id": "PDF-CT-002",
            "document_code": "05/CT-TQS",
            "title": "Chỉ thị điều động lực lượng",
            "page": 4,
            "security_level_id": 4,
            "text": secret_text_2,
            "score": 0.82
        }
    ]

    result = agent_tutor.answer_query(
        query="Nội dung chi tiết kế hoạch tác chiến và điều động?",
        user_id="USR-OFFICER-01",
        user_clearance=4,
        retrieved_chunks=chunks,
        biometric_verified=False
    )

    # Khóa bảo mật vân tay phải được kích hoạt
    assert result.get("requires_biometric") is True

    # Câu trả lời TUYỆT ĐỐI không chứa nội dung văn bản mật
    assert secret_text_1 not in result["answer"]
    assert secret_text_2 not in result["answer"]
    assert "ZKTeco ZK9500" in result["answer"]

    # Tất cả trích dẫn Cấp 3-5 phải bị che snippet
    citations = result.get("citations", [])
    assert len(citations) == 2
    for c in citations:
        assert c["requires_biometric"] is True
        assert c["snippet"] == "[Nội dung Mật - Yêu cầu xác thực vân tay ZK9500 để xem chi tiết]"
        assert secret_text_1 not in c["snippet"]
        assert secret_text_2 not in c["snippet"]


def test_biometric_guard_allows_classified_text_when_verified(agent_tutor):
    """
    3. Kiểm chứng Mở Khóa khi biometric_verified=True:
    Cùng User Cấp 4 khi đã quét vân tay ZK9500 thành công:
    - Cho phép trích xuất nội dung văn bản Cấp 3-5.
    - Cờ requires_biometric = False.
    - Snippet chứa đoạn văn bản thực tế.
    """
    classified_text = "Nội dung quy định phương án phối hợp hiệp đồng tác chiến quân binh chủng Cấp 3"

    chunks = [
        {
            "chunk_id": "CHK-VER-01",
            "file_id": "PDF-QD-003",
            "document_code": "263/QĐ-TQS",
            "title": "Quyết định hiệp đồng tác chiến",
            "page": 3,
            "security_level_id": 3,
            "text": classified_text,
            "score": 0.90
        }
    ]

    result = agent_tutor.answer_query(
        query="Phương án phối hợp hiệp đồng tác chiến?",
        user_id="USR-OFFICER-01",
        user_clearance=4,
        retrieved_chunks=chunks,
        biometric_verified=True
    )

    # Không bị chặn bởi Biometric Guard
    assert result.get("requires_biometric") is False

    citations = result.get("citations", [])
    assert len(citations) == 1
    assert citations[0]["requires_biometric"] is False
    assert "[Nội dung Mật - Yêu cầu xác thực vân tay" not in citations[0]["snippet"]
    assert citations[0]["page"] == 3


def test_biometric_guard_allows_level_1_2_without_fingerprint(agent_tutor):
    """
    4. Kiểm chứng Tài liệu Cấp 1 (Công khai) & Cấp 2 (Nội bộ):
    Luôn cho phép truy xuất và trả lời bình thường dù biometric_verified=False.
    """
    public_text = "Thông báo kế hoạch thi đua lập thành tích chào mừng ngày truyền thống lực lượng vũ trang."

    chunks = [
        {
            "chunk_id": "CHK-PUB-01",
            "file_id": "PDF-TB-001",
            "document_code": "111/TB-BTL",
            "title": "Thông báo thi đua",
            "page": 1,
            "security_level_id": 1,
            "text": public_text,
            "score": 0.88
        }
    ]

    result = agent_tutor.answer_query(
        query="Kế hoạch thi đua truyền thống?",
        user_id="USR-SOLDIER-01",
        user_clearance=2,
        retrieved_chunks=chunks,
        biometric_verified=False
    )

    # Cấp 1-2 không yêu cầu vân tay
    assert result.get("requires_biometric") is False
    citations = result.get("citations", [])
    assert len(citations) == 1
    assert citations[0]["requires_biometric"] is False
    assert "[Nội dung Mật - Yêu cầu xác thực vân tay" not in citations[0]["snippet"]


def test_biometric_guard_mixed_clearance_answers_unclassified_and_masks_classified(agent_tutor):
    """
    5. Kiểm chứng Khi có sự pha trộn giữa Cấp 1/2 và Cấp 3+:
    - Vẫn sinh câu trả lời dựa trên Cấp 1/2 (không khóa toàn bộ).
    - Cấp 3+ bị che snippet và gắn requires_biometric = True.
    - Cuối câu trả lời có thông báo yêu cầu quét vân tay để xem chi tiết tài liệu Cấp 3+.
    - Cờ requires_biometric ở cấp root là False.
    """
    public_text = "Quy định về thời gian công tác và trực ban cơ quan hàng ngày tại Trường Quân sự."
    secret_text = "KẾ HOẠCH TÁC CHIẾN TUYỆT MẬT ĐỊA BÀN CHIẾN LƯỢC SỐ 7 KHU VỰC BIÊN GIỚI"

    chunks = [
        {
            "chunk_id": "CHK-PUB-01",
            "file_id": "PDF-TB-001",
            "document_code": "111/TB-BTL",
            "title": "Thông báo thi đua",
            "page": 1,
            "security_level_id": 1,
            "text": public_text,
            "score": 0.88
        },
        {
            "chunk_id": "CHK-SEC-01",
            "file_id": "PDF-KH-001",
            "document_code": "145/KH-TQS",
            "title": "Kế hoạch tác chiến phòng thủ",
            "page": 2,
            "security_level_id": 3,
            "text": secret_text,
            "score": 0.85
        }
    ]

    result = agent_tutor.answer_query(
        query="Quy định trực ban và kế hoạch tác chiến?",
        user_id="USR-OFFICER-01",
        user_clearance=3,
        retrieved_chunks=chunks,
        biometric_verified=False
    )

    # 1. Câu trả lời KHÔNG bị khóa toàn bộ (vẫn sinh từ Cấp 1)
    assert secret_text not in result["answer"]
    assert "Lưu ý: Có các tài liệu Cấp 3+ liên quan đã bị ẩn. Vui lòng quét vân tay để xem chi tiết" in result["answer"]

    # 2. Cờ requires_biometric ở cấp root là False vì đã trả lời phần công khai
    assert result.get("requires_biometric") is False

    # 3. Danh sách citations
    citations = result.get("citations", [])
    assert len(citations) == 2

    # Chunk Cấp 1: requires_biometric = False, snippet thật
    pub_c = next(c for c in citations if c["file_id"] == "PDF-TB-001")
    assert pub_c["requires_biometric"] is False
    assert "[Nội dung Mật" not in pub_c["snippet"]

    # Chunk Cấp 3: requires_biometric = True, snippet bị che
    sec_c = next(c for c in citations if c["file_id"] == "PDF-KH-001")
    assert sec_c["requires_biometric"] is True
    assert sec_c["snippet"] == "[Nội dung Mật - Yêu cầu xác thực vân tay ZK9500 để xem chi tiết]"
    assert secret_text not in sec_c["snippet"]


def test_personalized_military_salutation(agent_tutor):
    """
    6. Kiểm chứng xưng hô cá nhân hóa chuẩn điều lệnh:
    - User có tên và chức vụ: Báo cáo Đồng chí {user_name} - {user_position}, ...
    - CNTT được chuẩn hóa thành 'Công Nghệ Thông Tin'.
    - Kiểm tra cả khi có dữ liệu hoặc không có dữ liệu hoặc yêu cầu vân tay.
    """
    sample_chunk = [
        {
            "chunk_id": "CHK-01",
            "file_id": "PDF-001",
            "document_code": "01/KH-TQS",
            "title": "Kế hoạch huấn luyện kỹ thuật",
            "page": 1,
            "security_level_id": 1,
            "text": "Nội dung huấn luyện công nghệ thông tin và chuyển đổi số năm 2026.",
            "score": 0.9
        }
    ]

    # Trường hợp 1: Có tên và chức vụ Tổ trưởng CNTT
    res1 = agent_tutor.answer_query(
        query="Nội dung kế hoạch 01/KH-TQS?",
        user_id="USR-001",
        user_name="Nguyễn Mạnh Nam",
        user_position="Tổ trưởng CNTT",
        user_clearance=2,
        retrieved_chunks=sample_chunk
    )
    assert res1["answer"].startswith("Báo cáo Đồng chí Nguyễn Mạnh Nam - Tổ trưởng Công Nghệ Thông Tin,")

    # Trường hợp 2: Không tìm thấy dữ liệu
    res2 = agent_tutor.answer_query(
        query="Kế hoạch tác chiến vùng biển ngoài khơi?",
        user_id="USR-001",
        user_name="Nguyễn Mạnh Nam",
        user_position="Tổ trưởng CNTT",
        user_clearance=2,
        retrieved_chunks=[]
    )
    assert res2["answer"].startswith("Báo cáo Đồng chí Nguyễn Mạnh Nam - Tổ trưởng Công Nghệ Thông Tin,")

    # Trường hợp 3: Khóa vân tay 100% Cấp 3+
    secret_chunk = [
        {
            "chunk_id": "CHK-SEC-01",
            "file_id": "PDF-SEC-001",
            "document_code": "99/TM-BTL",
            "title": "Kế hoạch tác chiến tối mật",
            "page": 1,
            "security_level_id": 4,
            "text": "Nội dung tối mật phòng thủ bờ biển.",
            "score": 0.95
        }
    ]
    res3 = agent_tutor.answer_query(
        query="Kế hoạch tối mật phòng thủ?",
        user_id="USR-001",
        user_name="Nguyễn Mạnh Nam",
        user_position="Tổ trưởng CNTT",
        user_clearance=4,
        retrieved_chunks=secret_chunk,
        biometric_verified=False
    )
    assert res3["answer"].startswith("Báo cáo Đồng chí Nguyễn Mạnh Nam - Tổ trưởng Công Nghệ Thông Tin,")

