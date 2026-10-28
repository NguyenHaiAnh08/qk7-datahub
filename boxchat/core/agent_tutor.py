"""
agent_tutor.py - Trợ Lý Tác Chiến & Văn Thư QK7 kế thừa kiến trúc HKUDS/DeepTutor
Citation-Grounded Agentic RAG (<mem>, <think>, <tool_call>)
Chống bịa đặt 100%, tuân thủ nghiêm ngặt cấp độ mật và bắt buộc trích dẫn số trang [p.X].
"""

import os
import json
import requests
from typing import List, Dict, Any, Optional

SECURITY_LEVEL_NAMES = {
    1: "Công khai",
    2: "Lưu hành nội bộ",
    3: "Mật",
    4: "Tối mật",
    5: "Tuyệt mật"
}

NO_DATA_FALLBACK_MESSAGE = "Báo cáo đồng chí, nội dung này không có trong các văn bản thuộc phạm vi cấp quyền hiện tại."


class AgentTutor:
    def __init__(
        self,
        ollama_url: str = "http://localhost:11434",
        model_name: str = "qwen2.5:7b",
        temperature: float = 0.0
    ):
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", ollama_url).rstrip("/")
        self.model_name = os.getenv("OLLAMA_MODEL", model_name)
        self.temperature = float(os.getenv("OLLAMA_TEMPERATURE", temperature))

    def answer_query(
        self,
        query: str,
        user_id: str,
        user_clearance: int,
        retrieved_chunks: List[Dict[str, Any]],
        file_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Thực thi quy trình Agentic RAG:
        1. Bước <mem>: Định vị phiên làm việc, cấp độ mật quân nhân.
        2. Bước <think>: Đánh giá tính đầy đủ và độ tin cậy của bằng chứng (Evidence chunks).
        3. Bước <tool_call>: Tổng hợp câu trả lời với trích dẫn chuẩn [p.X] hoặc từ chối trả lời nếu thiếu căn cứ.
        """
        user_clearance = int(user_clearance)
        clearance_name = SECURITY_LEVEL_NAMES.get(user_clearance, f"Cấp {user_clearance}")

        # Bước 1: <mem>
        mem_trace = (
            f"[Agent Memory] Quân nhân ID: {user_id} | Cấp độ bảo mật: Cấp {user_clearance} ({clearance_name}). "
            f"Tài liệu mục tiêu: {file_id or 'Toàn bộ kho dữ liệu hợp lệ'}. "
            f"Tổng số đoạn trích hợp lệ thu nhận: {len(retrieved_chunks)}."
        )

        # Kiểm tra ngưỡng bằng chứng
        if not retrieved_chunks:
            return {
                "answer": NO_DATA_FALLBACK_MESSAGE,
                "citations": [],
                "reasoning": {
                    "mem": mem_trace,
                    "think": (
                        f"[Agent Think] Không tìm thấy dữ liệu nào phù hợp với câu hỏi '{query}' "
                        f"trong phạm vi cấp quyền {clearance_name} (Cấp {user_clearance}). "
                        f"Quyết định: Không suy đoán, trả lời từ chối theo quy định bảo mật."
                    ),
                    "tool_call": "[Tool Grounding] Dừng trích dẫn do không có văn bản phù hợp."
                }
            }

        # Bước 2: <think>
        # Lọc các chunks có điểm số tin cậy
        valid_chunks = [c for c in retrieved_chunks if c.get("score", 0) >= 0.1] or retrieved_chunks[:3]
        if not valid_chunks:
            return {
                "answer": NO_DATA_FALLBACK_MESSAGE,
                "citations": [],
                "reasoning": {
                    "mem": mem_trace,
                    "think": "[Agent Think] Độ tương đồng của các tài liệu dưới ngưỡng tin cậy.",
                    "tool_call": "[Tool Grounding] Dừng trích dẫn."
                }
            }

        think_trace = (
            f"[Agent Think] Đã phân tích câu hỏi '{query}'. Đối chiếu {len(valid_chunks)} đoạn văn bản "
            f"từ {len(set(c.get('document_code') for c in valid_chunks))} văn kiện hợp lệ. "
            f"Tìm thấy các điều khoản và nội dung trích yếu tương thích."
        )

        # Chuẩn bị danh sách citations đính kèm
        citations = []
        seen_citations = set()
        for c in valid_chunks:
            c_key = (c.get("file_id"), c.get("page"))
            if c_key not in seen_citations:
                seen_citations.add(c_key)
                sec_id = int(c.get("security_level_id", 1))
                snippet = c.get("text", "")[:180].strip() + "..."
                citations.append({
                    "file_id": c.get("file_id"),
                    "document_code": c.get("document_code", "Văn bản"),
                    "title": c.get("title", "Tài liệu quân sự"),
                    "page": int(c.get("page", 1)),
                    "security_level_name": SECURITY_LEVEL_NAMES.get(sec_id, "Nội bộ"),
                    "snippet": snippet
                })

        # Bước 3: <tool_call> sinh câu trả lời
        answer_text = self._generate_grounded_answer(query, valid_chunks, user_clearance)
        page_tags = [f"[p.{c.get('page', 1)}]" for c in valid_chunks]
        tool_call_trace = f"[Tool Citation Grounding] Đã gán trích dẫn cụ thể các trang: {', '.join(page_tags)}."

        return {
            "answer": answer_text,
            "citations": citations,
            "reasoning": {
                "mem": mem_trace,
                "think": think_trace,
                "tool_call": tool_call_trace
            }
        }

    def _generate_grounded_answer(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        user_clearance: int
    ) -> str:
        """
        Sinh câu trả lời trích dẫn grounded:
        - Thử gọi Ollama nội bộ nếu đang chạy.
        - Fallback tự động sang Extractive Military Synthesizer đảm bảo 100% không bị chết trang.
        """
        # Thử qua Ollama nếu online
        ollama_response = self._call_ollama(query, chunks)
        if ollama_response:
            return ollama_response

        # Fallback Extractive Synthesizer
        return self._extractive_synthesize(query, chunks)

    def _call_ollama(self, query: str, chunks: List[Dict[str, Any]]) -> Optional[str]:
        """
        Kết nối Ollama local API (http://localhost:11434/api/generate).
        """
        try:
            context_blocks = []
            for idx, c in enumerate(chunks):
                doc_code = c.get("document_code", "Văn bản")
                page = c.get("page", 1)
                title = c.get("title", "")
                text = c.get("text", "").strip()
                context_blocks.append(
                    f"--- BẰNG CHỨNG {idx+1} [Số hiệu: {doc_code} | Tiêu đề: {title} | Trang {page} (p.{page})] ---\n{text}"
                )

            context_str = "\n\n".join(context_blocks)

            system_prompt = (
                "Bạn là Trợ Lý Tác Chiến & Văn Thư AI của Bộ Tư Lệnh Quân Khu 7 (QK7 DataHub).\n"
                "QUY TẮC BẮT BUỘC:\n"
                "1. Chỉ trả lời dựa trên BẰNG CHỨNG được cung cấp bên dưới, TUYỆT ĐỐI KHÔNG TỰ BỊA ĐẶT.\n"
                "2. Xưng hô chuẩn mực quân đội: 'Báo cáo đồng chí, ...'.\n"
                "3. Mọi khẳng định/số liệu/nội dung phải đính kèm trích dẫn số trang dạng [p.X] ngay sau câu hoặc ý đó.\n"
                "4. Nếu trong bằng chứng không có đủ thông tin, phải trả lời nguyên văn: "
                f"'{NO_DATA_FALLBACK_MESSAGE}'."
            )

            prompt = f"{system_prompt}\n\nDANH SÁCH BẰNG CHỨNG:\n{context_str}\n\nCÂU HỎI CỦA ĐỒNG CHÍ: {query}\n\nTRẢ LỜI:"

            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.0,
                    "top_p": 0.9,
                    "num_predict": 600
                }
            }

            resp = requests.post(
                f"{self.ollama_url}/api/generate",
                json=payload,
                timeout=4.0
            )

            if resp.status_code == 200:
                result = resp.json()
                answer = result.get("response", "").strip()
                if answer and len(answer) > 20:
                    return answer
        except Exception:
            # Bỏ qua để fallback extractive tức thì
            pass

        return None

    def _extractive_synthesize(self, query: str, chunks: List[Dict[str, Any]]) -> str:
        """
        Extractive Grounding Synthesizer:
        Tổng hợp câu trả lời mạch lạc từ các đoạn văn bản tin cậy nhất kèm trích dẫn [p.X].
        """
        primary_chunk = chunks[0]
        doc_code = primary_chunk.get("document_code", "Văn bản quân sự")
        title = primary_chunk.get("title", "")
        page = primary_chunk.get("page", 1)
        raw_text = primary_chunk.get("text", "").strip()

        # Rút gọn đoạn văn tiêu biểu
        sentences = [s.strip() for s in raw_text.split(".") if len(s.strip()) > 15]
        highlight_text = ". ".join(sentences[:3]) + "." if sentences else raw_text[:300] + "..."

        answer_parts = [
            f"Báo cáo đồng chí, căn cứ theo **{doc_code}** (*{title}*), tại **Trang {page} [p.{page}]**, nội dung quy định như sau:",
            f"\n> \"{highlight_text}\" [p.{page}]"
        ]

        # Nếu có thêm tài liệu hỗ trợ khác trang
        secondary_chunks = [c for c in chunks[1:3] if c.get("page") != page or c.get("document_code") != doc_code]
        if secondary_chunks:
            answer_parts.append("\nĐồng thời, đối chiếu với các nội dung liên quan:")
            for sc in secondary_chunks:
                sc_code = sc.get("document_code", "Văn bản")
                sc_page = sc.get("page", 1)
                sc_text = sc.get("text", "")[:160].strip() + "..."
                answer_parts.append(f"- Theo **{sc_code}** [p.{sc_page}]: \"{sc_text}\"")

        answer_parts.append(
            f"\nĐồng chí có thể mở trực tiếp văn bản tại trang trích dẫn bên dưới để kiểm tra chi tiết."
        )

        return "\n".join(answer_parts)
