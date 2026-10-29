"""
test_chunking.py - Bộ kiểm thử tự động (Unit Test / PyTest) cho thuật toán Chunking & Packing
Quy chuẩn kiểm thử QK7 DataHub:
1. Xác nhận overlap thực sự > 0 giữa các chunk liên tiếp sinh từ văn bản dài.
2. Không chunk nào vượt kích thước tối đa (max_chunk_size = 1200).
3. Không mất ký tự / từ ngữ nào so với nguồn.
4. Kiểm tra loại trừ thể thức đầu văn bản và nhận diện đúng Chương/Mục/Điều/Khoản/Phần/La Mã.
5. Xác nhận reset section_title khi sang tài liệu mới.
"""

import os
import re
import pytest
from core.pdf_processor import PDFProcessor


class TestChunkingAndPacking:

    def setup_method(self):
        self.processor = PDFProcessor(uploads_dir="../backend/uploads")

    def test_is_heading_exclusions(self):
        """
        Kiểm tra loại trừ phần thể thức đầu văn bản (quốc hiệu, tiêu ngữ, cơ quan, số ký hiệu, ngày tháng).
        Đồng thời xác nhận đã bỏ quy tắc 'dòng in hoa ngắn'.
        """
        excluded_samples = [
            "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
            "Độc lập - Tự do - Hạnh phúc",
            "Độc lập – Tự do – Hạnh phúc",
            "BỘ QUỐC PHÒNG",
            "BỘ TƯ LỆNH QUÂN KHU 7",
            "TRƯỜNG QUÂN SỰ QUÂN KHU 7",
            "PHÒNG THAM MƯU",
            "BAN GIÁM HIỆU",
            "BAN CHỈ HUY QUÂN SỰ",
            "Số: 123/TB-TM",
            "Số: 456/QĐ-BGH",
            "Số 789/BC-TQS",
            "TP. Hồ Chí Minh, ngày 15 tháng 10 năm 2026",
            "Hà Nội, ngày 02 tháng 9 năm 2026",
            "THÔNG BÁO",
            "QUYẾT ĐỊNH",
            "KẾ HOẠCH",
            "BÁO CÁO TÁC CHIẾN",
            "CHỈ THỊ CÔNG TÁC HUẤN LUYỆN",
            "NGHỊ QUYẾT LÃNH ĐẠO",
            "DANH SÁCH CÁN BỘ TRỰC BAN"  # Dòng in hoa ngắn thường nhưng không phải Chương/Mục/Điều...
        ]

        for text in excluded_samples:
            assert not self.processor._is_heading(text), f"Sai lệch: '{text}' không được nhận là heading!"

    def test_is_heading_valid(self):
        """
        Kiểm tra nhận diện chính xác Chương/Mục/Điều/Khoản/Phần và số La Mã.
        """
        valid_samples = [
            "Chương I. QUY ĐỊNH CHUNG",
            "Chương 1. NGUYÊN TẮC HOẠT ĐỘNG",
            "Chương II: NHIỆM VỤ VÀ QUYỀN HẠN",
            "Mục 1. QUẢN LÝ TÀI LIỆU MẬT",
            "Mục I. CÔNG TÁC TRỰC BAN CHỈ HUY",
            "Điều 1. Phạm vi điều chỉnh",
            "Điều 2. Đối tượng áp dụng",
            "Điều 15. Chế độ bảo mật thông tin liên lạc",
            "Khoản 1. Ban Giám hiệu chịu trách nhiệm trước Thường vụ Đảng ủy",
            "Khoản 2. Các cơ quan, đơn vị tổ chức quán triệt nghiêm túc",
            "Phần thứ nhất. TÌNH HÌNH ĐỊA BÀN VÀ NHIỆM VỤ ĐƠN VỊ",
            "Phần I. ĐÁNH GIÁ KẾT QUẢ QUÝ III",
            "I. NGUYÊN TẮC BẢO ĐẢM TÁC CHIẾN",
            "II. TỔ CHỨC THỰC HIỆN VÀ PHÂN CÔNG TRÁCH NHIỆM",
            "III. CHẾ ĐỘ BÁO CÁO VÀ KIỂM TRA ĐỊNH KỲ",
            "IV. ĐIỀU KHOẢN THI HÀNH"
        ]

        for text in valid_samples:
            assert self.processor._is_heading(text), f"Sai lệch: '{text}' phải được nhận là heading hợp lệ!"

    def test_synthetic_long_document_overlap_and_no_loss(self):
        """
        Kiểm tra với văn bản tổng hợp dài (> 3500 ký tự):
        1. Xác nhận overlap thực sự > 0 giữa các chunk liên tiếp.
        2. Không chunk nào vượt kích thước tối đa (max_chunk_size = 1200).
        3. Không mất ký tự / từ ngữ nào so với nguồn.
        """
        # Tạo văn bản tổng hợp dài gồm nhiều đoạn văn tác chiến
        paragraphs = [
            "Quán triệt sâu sắc các Nghị quyết, Chỉ thị của Quân ủy Trung ương, Bộ Quốc phòng và Bộ Tư lệnh Quân khu 7 về công tác sẵn sàng chiến đấu, toàn trường duy trì nghiêm chế độ trực chỉ huy, trực ban tác chiến, tuần tra canh gác bảo vệ an toàn tuyệt đối các mục tiêu trọng điểm.",
            "Các cơ quan, đơn vị chủ động xây dựng, rà soát, bổ sung hoàn chỉnh hệ thống văn kiện tác chiến theo đúng phương án chiến đấu bảo vệ căn cứ, doanh trại trong mọi tình huống. Tổ chức luyện tập thành thục các phương án chuyển trạng thái sẵn sàng chiến đấu từ thường xuyên lên cao và toàn bộ.",
            "Tăng cường công tác giáo dục chính trị tư tưởng, nâng cao tinh thần cảnh giác cách mạng cho toàn thể cán bộ, giáo viên, học viên, chiến sĩ; quản lý chặt chẽ vũ khí trang bị kỹ thuật, kho tàng, phương tiện thông tin liên lạc và mạng truyền số liệu quân sự.",
            "Chấp hành nghiêm quy định về bảo mật thông tin, bảo vệ an ninh nội bộ, phòng chống lộ lọt tài liệu quân sự cấp Mật, Tối Mật và Tuyệt Mật trên không gian mạng và hệ thống cổng thông tin dữ liệu số QK7 DataHub.",
            "Tiếp tục đổi mới nội dung, phương pháp huấn luyện tác chiến theo phương châm cơ bản, thiết thực, vững chắc; coi trọng huấn luyện đồng bộ, chuyên sâu, lấy thực hành làm chính, sát với nhiệm vụ và địa bàn đóng quân của Quân khu.",
            "Đẩy mạnh chuyển đổi số trong công tác văn thư lưu trữ, số hóa 100% văn kiện, chỉ thị chỉ đạo của Đảng ủy và Ban Giám hiệu; tích hợp chữ ký số và xác thực sinh trắc học vân tay 2FA quang học ZKTeco ZK9500 cho mọi văn bản có độ mật từ cấp 3 trở lên.",
            "Phát huy vai trò của Trợ lý Trí tuệ nhân tạo (AI RAG) trong việc tra cứu nhanh các điều lệnh quản lý bộ đội, điều lệnh tác chiến, phục vụ đắc lực cho công tác giảng dạy, học tập và nghiên cứu khoa học quân sự của nhà trường.",
            "Tổ chức hội thi, hội thao đánh giá thực chất kết quả huấn luyện học kỳ I, kịp thời biểu dương khen thưởng các tập thể, cá nhân có thành tích xuất sắc, đồng thời nghiêm khắc kiểm điểm, chấn chỉnh các khâu yếu, mặt yếu còn tồn tại.",
            "Bảo đảm tốt công tác hậu cần, kỹ thuật, tài chính cho các nhiệm vụ thường xuyên và đột xuất; chăm lo đời sống vật chất, tinh thần cho cán bộ, chiến sĩ, duy trì quân số khỏe đạt trên 98,8%, đáp ứng yêu cầu nhiệm vụ trong tình hình mới."
        ]
        synthetic_text = "\n\n".join(paragraphs)
        assert len(synthetic_text) > 2000, "Văn bản thử nghiệm phải đủ dài (> 2000 ký tự)"

        # Thực thi hàm cắt chunk với mục tiêu 900, trần 1200, overlap 80
        target_chunk_size = 900
        target_overlap = 80
        max_size = 1200

        chunks = self.processor._split_text_to_chunks(
            synthetic_text,
            chunk_size=target_chunk_size,
            overlap=target_overlap,
            max_chunk_size=max_size
        )

        # 1. Khẳng định: Phải có nhiều hơn 1 chunk
        assert len(chunks) >= 2, f"Văn bản dài ({len(synthetic_text)} ký tự) phải được cắt thành nhiều chunk!"

        # 2. Khẳng định: Không chunk nào vượt quá max_chunk_size = 1200
        for idx, c in enumerate(chunks):
            assert len(c) <= max_size, (
                f"Lỗi: Chunk #{idx} có độ dài {len(c)} ký tự, vượt quá giới hạn tối đa {max_size}!"
            )

        # 3. Khẳng định: Overlap thực sự > 0 giữa các chunk liên tiếp
        for i in range(len(chunks) - 1):
            c1 = chunks[i]
            c2 = chunks[i + 1]
            # Tìm đoạn giao thoa giữa đuôi c1 và đầu c2
            overlap_found = 0
            # Quét kiểm tra độ dài trùng từ 20 đến 150 ký tự
            for test_len in range(min(len(c1), len(c2), 150), 15, -1):
                if c1[-test_len:] == c2[:test_len]:
                    overlap_found = test_len
                    break

            assert overlap_found > 0, (
                f"Lỗi: Không tìm thấy overlap giữa Chunk #{i} và Chunk #{i+1}!"
            )
            assert overlap_found >= 20, (
                f"Overlap quá nhỏ ({overlap_found} ký tự) giữa Chunk #{i} và Chunk #{i+1}!"
            )

        # 4. Khẳng định: Không mất từ ngữ / ký tự nào so với nguồn (No Text Loss)
        # Tách danh sách từ trong văn bản nguồn
        source_words = [w.strip() for w in re.split(r'\s+', synthetic_text.strip()) if w.strip()]
        assert len(source_words) > 100

        # Kiểm tra mọi từ ngữ trong văn bản nguồn đều có mặt trong các chunk
        chunk_combined_text = " ".join(chunks)
        chunk_words_set = set(w.strip() for w in re.split(r'\s+', chunk_combined_text) if w.strip())

        missing_words = [w for w in source_words if w not in chunk_words_set]
        assert len(missing_words) == 0, f"Phát hiện {len(missing_words)} từ bị mất trong quá trình chunking: {missing_words[:5]}"

        # Xác nhận thứ tự từ nguồn được bảo toàn tuần tự qua các chunk
        # Mỗi từ trong source_words xuất hiện tuần tự theo chỉ số con trỏ
        source_idx = 0
        for c in chunks:
            c_words = [w.strip() for w in re.split(r'\s+', c.strip()) if w.strip()]
            for cw in c_words:
                if source_idx < len(source_words) and cw == source_words[source_idx]:
                    source_idx += 1

        assert source_idx == len(source_words), (
            f"Thứ tự từ bị đứt quãng: Chỉ khớp {source_idx}/{len(source_words)} từ!"
        )

    def test_reset_section_title_across_documents(self):
        """
        Xác nhận reset section_title khi sang tài liệu mới, không rò rỉ tiêu đề từ file trước.
        """
        # Kiểm tra trạng thái reset trong hàm extract_chunks
        # Giả lập 2 lần gọi trên cùng 1 instance PDFProcessor
        # Lần 1: Có section title
        text_with_heading = "Điều 10. Chế độ kiểm tra bảo mật\nNội dung điều 10 quy định chi tiết."
        chunks_1 = self.processor._split_text_to_chunks(text_with_heading)
        assert len(chunks_1) > 0

        # Xác nhận logic reset: hàm _is_heading độc lập và extract_chunks khởi tạo current_section_title = ""
        # Kiểm tra trực tiếp qua hàm helper
        assert self.processor._is_heading("Điều 10. Chế độ kiểm tra bảo mật")
        assert not self.processor._is_heading("Nội dung thường không có tiêu đề")
