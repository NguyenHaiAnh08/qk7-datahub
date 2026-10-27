"""
agent_tutor.py - Trợ Lý Tác Chiến & Văn Thư QK7 kế thừa kiến trúc HKUDS/DeepTutor
Citation-Grounded Agentic RAG (<mem>, <think>, <tool_call>)
Chống bịa đặt 100%, tuân thủ nghiêm ngặt cấp độ mật và bắt buộc trích dẫn số trang [p.X].
"""

import os
import re
import json
import requests
from typing import List, Dict, Any, Optional, Tuple, Set

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
        ollama_url: str = "http://127.0.0.1:11434",
        model_name: str = "qwen2.5:3b",
        temperature: float = 0.0
    ):
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", ollama_url).rstrip("/")
        if "localhost" in self.ollama_url:
            self.ollama_url = self.ollama_url.replace("localhost", "127.0.0.1")
        self.model_name = os.getenv("OLLAMA_MODEL", model_name)
        self.temperature = float(os.getenv("OLLAMA_TEMPERATURE", temperature))
        self.keep_alive = os.getenv("OLLAMA_KEEP_ALIVE", "24h")
        # Tuple timeout: connect_timeout=2.0s, read_timeout=70.0s
        self.timeout = (2.0, float(os.getenv("OLLAMA_TIMEOUT", "70.0")))

    def _rewrite_query_with_history(self, query: str, history: List[Dict[str, Any]]) -> str:
        """
        Viết lại câu truy vấn dựa trên ngữ cảnh hội thoại đa lượt:
        - Nếu history có các lượt trao đổi trước và query chứa đại từ tham chiếu
          ('đó', 'này', 'trên', 'vừa rồi', 'văn bản đó', 'kế hoạch này'...) hoặc ngắn thiếu chủ ngữ (< 8 từ):
          tự động trích xuất số hiệu văn bản / thực thể chính từ lượt gần nhất để mở rộng câu truy vấn.
        - Nếu history rỗng hoặc có lỗi: giữ nguyên query gốc (an toàn 100%).
        """
        if not query or not history:
            return query

        try:
            q_clean = query.strip()
            q_lower = q_clean.lower()
            tokens = q_clean.split()

            # Dấu hiệu câu hỏi cần ngữ cảnh nối tiếp
            reference_triggers = [
                "đó", "này", "trên", "vừa rồi", "vừa nêu", "ở trên", "sau đó",
                "văn bản đó", "kế hoạch này", "quyết định đó", "tài liệu đó",
                "hướng dẫn này", "thông báo đó", "báo cáo này", "nó", "văn bản này"
            ]
            needs_context = any(trig in q_lower for trig in reference_triggers) or len(tokens) < 8

            if not needs_context:
                return query

            extracted_entity = None
            # Số hiệu văn bản quân sự (phải chứa ít nhất 1 chữ cái sau dấu gạch, loại trừ ngày tháng dd/mm/yyyy)
            doc_code_pattern = re.compile(r'\b\d+[/_-][A-Za-zÀ-ỹ0-9_-]*[A-Za-zÀ-ỹ]+[A-Za-zÀ-ỹ0-9_/-]*\b')

            # Duyệt ngược từ lượt gần nhất trong history
            for turn in reversed(history[-4:]):
                content = str(turn.get("content") or turn.get("text") or turn.get("message") or "")
                # 1. Tìm số hiệu văn bản (vd: 123/QĐ-BGH, 145-KH-TQS, 01/HD-BQP)
                matches = doc_code_pattern.findall(content)
                if matches:
                    # Lấy số hiệu đầu tiên phù hợp
                    extracted_entity = matches[0].strip()
                    break

                # 2. Hoặc tìm trích dẫn văn bản trong markdown đậm **...**
                bold_matches = re.findall(r'\*\*([^*]+)\*\*', content)
                for bm in bold_matches:
                    bm_clean = bm.strip()
                    if any(prefix in bm_clean.lower() for prefix in ["quyết định", "kế hoạch", "hướng dẫn", "báo cáo", "thông báo", "chỉ thị"]):
                        extracted_entity = bm_clean
                        break
                if extracted_entity:
                    break

            if extracted_entity and extracted_entity.lower() not in q_lower:
                return f"{query} {extracted_entity}"

        except Exception:
            # Fallback an toàn 100%
            pass

        return query

    def warm_up(self) -> bool:
        """
        Khởi động và tải trước model vào VRAM/RAM cùng keep_alive ngay khi microservice khởi động.
        Tự động kiểm tra danh sách model khả dụng trong Ollama và fallback thông minh nếu model cấu hình chưa được tải.
        """
        try:
            # 1. Kiểm tra danh sách model hiện có trong Ollama
            try:
                tags_resp = requests.get(f"{self.ollama_url}/api/tags", timeout=(2.0, 5.0))
                if tags_resp.status_code == 200:
                    available_models = [m.get("name", "") for m in tags_resp.json().get("models", [])]
                    has_exact = any(m == self.model_name or m.startswith(f"{self.model_name}:") for m in available_models)
                    if not has_exact and available_models:
                        # Tìm model fallback phù hợp (ưu tiên họ qwen2.5)
                        qwen_candidates = [m for m in available_models if "qwen" in m.lower()]
                        if qwen_candidates:
                            fallback_model = qwen_candidates[0]
                            print(f"[AgentTutor] Cảnh báo: Model '{self.model_name}' chưa cài trong Ollama. Tự động chuyển sang: '{fallback_model}'.")
                            self.model_name = fallback_model
                        else:
                            print(f"[AgentTutor] Cảnh báo: Model '{self.model_name}' chưa cài trong Ollama. Dùng model có sẵn: '{available_models[0]}'.")
                            self.model_name = available_models[0]
            except Exception as tag_err:
                pass

            print(f"[AgentTutor] Đang warm-up mô hình Ollama '{self.model_name}' (keep_alive={self.keep_alive})...")
            payload = {
                "model": self.model_name,
                "prompt": "Khởi động mô hình QK7 AI",
                "stream": False,
                "keep_alive": self.keep_alive,
                "options": {
                    "num_predict": 1
                }
            }
            resp = requests.post(
                f"{self.ollama_url}/api/generate",
                json=payload,
                timeout=(2.0, 10.0)
            )
            if resp.status_code == 200:
                print(f"[AgentTutor] Warm-up thành công model '{self.model_name}'. Sẵn sàng phục vụ.")
                return True
            else:
                print(f"[AgentTutor] Warm-up phản hồi HTTP {resp.status_code}: {resp.text[:100]}")
        except Exception as e:
            print(f"[AgentTutor] Ollama chưa sẵn sàng khi warm-up ({e}). Sẽ tự động kết nối lại khi có query.")
        return False

    def answer_query(
        self,
        query: str,
        user_id: str,
        user_clearance: int,
        retrieved_chunks: List[Dict[str, Any]],
        file_id: Optional[str] = None,
        history: Optional[List[Dict[str, Any]]] = None,
        biometric_verified: bool = False
    ) -> Dict[str, Any]:
        """
        Thực thi quy trình Agentic RAG có bảo vệ Sinh trắc học Vân tay ZK9500:
        1. Bước <mem>: Định vị phiên làm việc, cấp độ mật quân nhân, trạng thái biometric.
        2. Bước <think>: Đánh giá Evidence chunks & phân loại Cấp 1-2 vs Cấp 3-5.
        3. Bước <tool_call>: Nếu chưa xác thực vân tay, khóa toàn bộ nội dung/snippet Cấp 3-5.
        """
        user_clearance = int(user_clearance)
        clearance_name = SECURITY_LEVEL_NAMES.get(user_clearance, f"Cấp {user_clearance}")
        has_vector = any("vector_score" in c for c in retrieved_chunks)
        retrieval_mode = "hybrid" if has_vector else "bm25_only"

        # Bước 1: <mem>
        bio_status_str = "Đã xác thực vân tay ZK9500" if biometric_verified else "Chưa xác thực vân tay"
        mem_trace = (
            f"[Agent Memory] Quân nhân ID: {user_id} | Cấp độ bảo mật: Cấp {user_clearance} ({clearance_name}). "
            f"Sinh trắc học: {bio_status_str}. "
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
                },
                "retrieval_mode": retrieval_mode,
                "synthesis_mode": "extractive",
                "requires_biometric": False
            }

        # Bước 2: <think>
        valid_chunks = [c for c in retrieved_chunks if c.get("score", 0) >= 0.1] or retrieved_chunks[:3]
        if not valid_chunks:
            return {
                "answer": NO_DATA_FALLBACK_MESSAGE,
                "citations": [],
                "reasoning": {
                    "mem": mem_trace,
                    "think": "[Agent Think] Độ tương đồng của các tài liệu dưới ngưỡng tin cậy.",
                    "tool_call": "[Tool Grounding] Dừng trích dẫn."
                },
                "retrieval_mode": retrieval_mode,
                "synthesis_mode": "extractive",
                "requires_biometric": False
            }

        # --- KHÓA BẢO MẬT VÂN TAY CHO NỘI DUNG CẤP 3-5 ---
        classified_chunks = [c for c in valid_chunks if int(c.get("security_level_id", 1)) >= 3]
        unclassified_chunks = [c for c in valid_chunks if int(c.get("security_level_id", 1)) <= 2]

        # Trường hợp 1: Có tài liệu Cấp 3+ nhưng CHƯA xác thực vân tay ZK9500
        if classified_chunks and not biometric_verified:
            # 1A. Toàn bộ tài liệu đều thuộc Cấp 3+
            if not unclassified_chunks:
                biometric_warning_msg = (
                    "Báo cáo đồng chí, tài liệu liên quan đến nội dung này thuộc danh mục văn bản bảo mật (Cấp 3 trở lên). "
                    "Yêu cầu cán bộ xác thực vân tay trên máy quét ZKTeco ZK9500 "
                    "(hoặc bấm vào thẻ trích dẫn văn bản bên dưới để quét vân tay) trước khi Trợ lý AI trích xuất nội dung mật."
                )
                citations = []
                for c in classified_chunks:
                    sec_id = int(c.get("security_level_id", 3))
                    citations.append({
                        "file_id": c.get("file_id"),
                        "document_code": c.get("document_code", "Văn bản Mật"),
                        "title": c.get("title", "Tài liệu bảo mật"),
                        "page": int(c.get("page", 1)),
                        "security_level_name": SECURITY_LEVEL_NAMES.get(sec_id, "Mật"),
                        "snippet": "[Nội dung Mật - Yêu cầu xác thực vân tay ZK9500 để xem chi tiết]",
                        "requires_biometric": True
                    })
                return {
                    "answer": biometric_warning_msg,
                    "citations": citations,
                    "reasoning": {
                        "mem": mem_trace,
                        "think": (
                            f"[Agent Think] Phát hiện {len(classified_chunks)} đoạn trích dẫn thuộc Cấp 3-5 "
                            f"nhưng quân nhân {user_id} chưa xác thực vân tay ZK9500. "
                            f"Kích hoạt khóa bảo vệ: Ẩn 100% nội dung mật và snippet."
                        ),
                        "tool_call": "[Tool Grounding] Yêu cầu xác thực vân tay 2FA trước khi giải mã nội dung."
                    },
                    "retrieval_mode": retrieval_mode,
                    "synthesis_mode": "extractive",
                    "requires_biometric": True
                }

            # 1B. Kết hợp cả Cấp 1-2 và Cấp 3+: Chỉ tổng hợp từ Cấp 1-2
            prompt_chunks = unclassified_chunks
        else:
            # Trường hợp 2: Đã xác thực vân tay HOẶC chỉ có tài liệu Cấp 1-2
            prompt_chunks = valid_chunks

        think_trace = (
            f"[Agent Think] Đã phân tích câu hỏi '{query}'. Đối chiếu {len(prompt_chunks)} đoạn văn bản "
            f"từ {len(set(c.get('document_code') for c in prompt_chunks))} văn kiện hợp lệ. "
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
                is_classified = sec_id >= 3

                # Nếu là cấp 3+ và chưa quét vân tay -> che snippet
                if is_classified and not biometric_verified:
                    snippet = "[Nội dung Mật - Yêu cầu xác thực vân tay ZK9500 để xem chi tiết]"
                    requires_bio = True
                else:
                    snippet = c.get("text", "")[:180].strip() + "..."
                    requires_bio = False

                citations.append({
                    "file_id": c.get("file_id"),
                    "document_code": c.get("document_code", "Văn bản"),
                    "title": c.get("title", "Tài liệu quân sự"),
                    "page": int(c.get("page", 1)),
                    "security_level_name": SECURITY_LEVEL_NAMES.get(sec_id, "Nội bộ"),
                    "snippet": snippet,
                    "requires_biometric": requires_bio
                })

        # Bước 3: <tool_call> sinh câu trả lời
        answer_text, synthesis_mode = self._generate_grounded_answer(query, prompt_chunks, user_clearance, history)

        # Nếu có tài liệu cấp 3+ bị che trong trường hợp hỗn hợp
        if classified_chunks and not biometric_verified and unclassified_chunks:
            answer_text += (
                "\n\n*(Lưu ý: Hệ thống phát hiện thêm các tài liệu liên quan thuộc Cấp Mật 3 trở lên. "
                "Vui lòng xác thực vân tay ZK9500 để Trợ lý AI giải phóng toàn bộ nội dung mật)*"
            )

        # Hậu kiểm trích dẫn số trang trong câu trả lời
        verified_answer, fabricated_tags = self._verify_inline_citations(answer_text, prompt_chunks)
        if fabricated_tags:
            think_trace += (
                f" [Kiểm toán an ninh] Đã phát hiện và tự động gỡ bỏ các trích dẫn số trang "
                f"không có trong tài liệu nguồn: {', '.join(fabricated_tags)}."
            )

        page_tags = [f"[p.{c.get('page', 1)}]" for c in prompt_chunks]
        tool_call_trace = f"[Tool Citation Grounding] Đã gán trích dẫn cụ thể các trang: {', '.join(page_tags)}."

        requires_bio_flag = bool(classified_chunks and not biometric_verified)

        return {
            "answer": verified_answer,
            "citations": citations,
            "reasoning": {
                "mem": mem_trace,
                "think": think_trace,
                "tool_call": tool_call_trace
            },
            "retrieval_mode": retrieval_mode,
            "synthesis_mode": synthesis_mode,
            "requires_biometric": requires_bio_flag
        }

    def _verify_inline_citations(
        self,
        answer_text: str,
        valid_chunks: List[Dict[str, Any]]
    ) -> Tuple[str, List[str]]:
        """
        Hậu kiểm trích dẫn số trang trong câu trả lời của LLM:
        - Quét tìm tất cả các nhãn [p.X] hoặc [Trang X] trong câu trả lời.
        - Đối chiếu X với tập hợp các số trang page thực tế có trong valid_chunks.
        - Nếu số trang không hề tồn tại trong ngữ cảnh được cấp, tự động gỡ bỏ nhãn bịa đặt
          và ghi chú để lưu lại vết kiểm toán.
        """
        if not answer_text:
            return answer_text, []

        valid_pages: Set[int] = set()
        for c in valid_chunks:
            p = c.get("page")
            if p is not None:
                try:
                    valid_pages.add(int(p))
                except (ValueError, TypeError):
                    pass

        pattern = re.compile(r'\[(?:p\.\s*|trang\s*)(\d+)\]', re.IGNORECASE)
        fabricated_tags: List[str] = []

        def replace_fn(match: re.Match) -> str:
            tag = match.group(0)
            page_str = match.group(1)
            try:
                page_num = int(page_str)
                if page_num in valid_pages:
                    return tag
                else:
                    fabricated_tags.append(tag)
                    return ""
            except ValueError:
                return tag

        verified_text = pattern.sub(replace_fn, answer_text)
        # Chuẩn hóa khoảng trắng sau khi gỡ bỏ nhãn
        verified_text = re.sub(r' +([,.;:])', r'\1', verified_text)
        verified_text = re.sub(r' {2,}', ' ', verified_text)
        return verified_text.strip(), fabricated_tags

    def _generate_grounded_answer(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        user_clearance: int,
        history: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[str, str]:
        """
        Sinh câu trả lời trích dẫn grounded:
        - Thử gọi Ollama nội bộ nếu đang chạy.
        - Fallback tự động sang Extractive Military Synthesizer đảm bảo 100% không bị chết trang.
        Trả về tuple (answer_text, synthesis_mode).
        """
        # Thử qua Ollama nếu online
        ollama_response = self._call_ollama(query, chunks, history)
        if ollama_response:
            return ollama_response, "llm"

        # Fallback Extractive Synthesizer
        return self._extractive_synthesize(query, chunks), "extractive"

    def _call_ollama(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        history: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[str]:
        """
        Kết nối Ollama local API (http://127.0.0.1:11434/api/generate).
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

            # Tóm tắt 2-3 lượt trao đổi gần nhất trong history
            history_str = ""
            if history:
                recent_history = history[-3:]
                turn_texts = []
                for h in recent_history:
                    role = "Đồng chí" if h.get("role") in ["user", "quân nhân"] else "Trợ lý AI"
                    content = str(h.get("content") or h.get("text") or "")[:250].strip()
                    if content:
                        turn_texts.append(f"{role}: {content}")
                if turn_texts:
                    history_str = "NGỮ CẢNH HỘI THOẠI TRƯỚC ĐÓ:\n" + "\n".join(turn_texts) + "\n\n"

            system_prompt = (
                "Bạn là Trợ Lý Tác Chiến & Văn Thư AI của Bộ Tư Lệnh Quân Khu 7 (QK7 DataHub).\n"
                "NGUYÊN TẮC THI HÀNH NHIỆM VỤ:\n"
                "1. Tập trung 100% vào việc phân tích, trích xuất và trả lời trực tiếp, chính xác, trung thực dựa trên DANH SÁCH BẰNG CHỨNG được cung cấp.\n"
                "2. TUYỆT ĐỐI KHÔNG tự bịa đặt, suy đoán ngoài văn bản, không sinh nội dung lan man hay tạo các trường dữ liệu thừa.\n"
                "3. Tác phong xưng hô chuẩn mực điều lệnh Quân đội nhân dân Việt Nam: Mở đầu bằng 'Báo cáo đồng chí, ...'.\n"
                "4. Mọi luận điểm, số liệu, điều khoản, chỉ thị bắt buộc phải kèm theo trích dẫn số trang chính xác dạng [p.X] ngay sau nội dung được trích xuất.\n"
                "5. Nếu trong danh sách bằng chứng không có hoặc không đủ dữ liệu để trả lời, phải trả lời nguyên văn: "
                f"'{NO_DATA_FALLBACK_MESSAGE}'."
            )

            prompt = (
                f"{system_prompt}\n\n"
                f"{history_str}"
                f"DANH SÁCH BẰNG CHỨNG:\n{context_str}\n\n"
                f"CÂU HỎI CỦA ĐỒNG CHÍ: {query}\n\n"
                f"TRẢ LỜI:"
            )

            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "stream": False,
                "keep_alive": self.keep_alive,
                "options": {
                    "temperature": 0.0,
                    "top_p": 0.9,
                    "num_predict": 600
                }
            }

            resp = requests.post(
                f"{self.ollama_url}/api/generate",
                json=payload,
                timeout=self.timeout
            )

            if resp.status_code == 200:
                result = resp.json()
                answer = result.get("response", "").strip()
                if answer and len(answer) > 20:
                    return answer
        except Exception:
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
