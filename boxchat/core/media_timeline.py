"""
media_timeline.py - Mô-đun tra cứu nội dung cuộc họp & video huấn luyện theo mốc thời gian (Timestamp)
Phục vụ các cuộc họp không giấy tờ (Paperless Meeting) và băng ghi âm/ghi hình tác chiến QK7.
"""

from typing import List, Dict, Any, Optional


class MediaTimelineManager:
    def __init__(self):
        # Bộ đệm dữ liệu mốc thời gian mẫu cho các phiên họp / video huấn luyện
        self.mock_timelines: Dict[str, List[Dict[str, Any]]] = {
            "MEETING-2026-01": [
                {
                    "timestamp": "02:15",
                    "seconds": 135,
                    "title": "Khai mạc hội nghị & Tuyên bố lý do",
                    "speaker": "Đại tá - Chánh Văn phòng",
                    "summary": "Quán triệt mục đích, yêu cầu hội nghị tác chiến quý IV/2026."
                },
                {
                    "timestamp": "04:12",
                    "seconds": 252,
                    "title": "Báo cáo công tác tác chiến & phòng thủ địa bàn",
                    "speaker": "Thiếu tướng - Phó Tư lệnh Tham mưu trưởng",
                    "summary": "Đánh giá tình hình an ninh trật tự, kế hoạch diễn tập và tuần tra ven biển."
                },
                {
                    "timestamp": "18:40",
                    "seconds": 1120,
                    "title": "Thảo luận phương án số hóa và bảo mật văn bản",
                    "speaker": "Trưởng phòng CNTT",
                    "summary": "Triển khai phần mềm QK7 DataHub và trợ lý AI BoxChat trên mạng truyền số liệu quân sự."
                },
                {
                    "timestamp": "35:20",
                    "seconds": 2120,
                    "title": "Ý kiến kết luận & Giao nhiệm vụ của Tư lệnh Quân Khu",
                    "speaker": "Trung tướng - Tư lệnh Quân Khu 7",
                    "summary": "Chỉ thị toàn quân khu đẩy mạnh chuyển đổi số, bảo đảm tuyệt đối bí mật quân sự."
                }
            ]
        }

    def search_by_keyword(self, keyword: str, media_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Tìm kiếm các mốc thời gian trong video/ghi âm khớp với từ khóa.
        """
        results = []
        kw = keyword.lower().strip()
        items_to_scan = []

        if media_id and media_id in self.mock_timelines:
            items_to_scan = [(media_id, item) for item in self.mock_timelines[media_id]]
        else:
            for m_id, item_list in self.mock_timelines.items():
                for item in item_list:
                    items_to_scan.append((m_id, item))

        for m_id, item in items_to_scan:
            text_to_check = f"{item['title']} {item['speaker']} {item['summary']}".lower()
            if kw in text_to_check:
                entry = dict(item)
                entry["media_id"] = m_id
                results.append(entry)

        return results

    def get_timeline(self, media_id: str) -> List[Dict[str, Any]]:
        return self.mock_timelines.get(media_id, [])
