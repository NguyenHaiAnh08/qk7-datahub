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
        biometric_verified: bool = False,
        user_name: Optional[str] = None,
        user_position: Optional[str] = None,
        user_rank: Optional[str] = None
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

        # Chuẩn hóa chức danh quân sự xưng hô cá nhân hóa
        # Ví dụ: "Báo cáo Đồng chí Nguyễn Mạnh Nam - Tổ trưởng Công Nghệ Thông Tin,"
        pos_display = (user_position or "").strip()
        if pos_display.upper() == "CNTT" or "tổ trưởng cntt" in pos_display.lower():
            pos_display = "Tổ trưởng Công Nghệ Thông Tin"

        if user_name and pos_display:
            salutation = f"Báo cáo Đồng chí {user_name} - {pos_display},"
        elif user_name:
            salutation = f"Báo cáo Đồng chí {user_name},"
        else:
            salutation = "Báo cáo đồng chí,"

        # NGUYÊN TẮC FAIL CLOSED: Lọc bỏ tuyệt đối 100% chunks có security_level_id > user_clearance
        # Không bao giờ để tài liệu vượt cấp mật xuất hiện trong quá trình suy luận hoặc trả về citations
        authorized_chunks = [
            c for c in (retrieved_chunks or [])
            if int(c.get("security_level_id", 1)) <= user_clearance
        ]

        # Bước 1: <mem>
        bio_status_str = "Đã xác thực vân tay ZK9500" if biometric_verified else "Chưa xác thực vân tay"
        mem_trace = (
            f"[Agent Memory] Quân nhân ID: {user_id} | Họ tên: {user_name or 'N/A'} | Chức vụ: {pos_display or 'N/A'}. "
            f"Cấp độ bảo mật: Cấp {user_clearance} ({clearance_name}). "
            f"Sinh trắc học: {bio_status_str}. "
            f"Tài liệu mục tiêu: {file_id or 'Toàn bộ kho dữ liệu hợp lệ'}. "
            f"Tổng số đoạn trích hợp lệ thu nhận: {len(authorized_chunks)}."
        )

        # NHẬN DIỆN SỐ HIỆU VĂN BẢN TRONG CÂU HỎI (Vd: 880/KH-TQS, 333/KH-TQS, 145/KH-TQS)
        # Nếu câu hỏi có chứa số hiệu văn bản cụ thể NHƯNG authorized_chunks không chứa bất kỳ chunk nào thuộc văn bản đó
        # (nghĩa là đã bị Pre-filtering bảo mật chặn lại hoặc không tồn tại trong kho cấp quyền) -> TỪ CHỐI NGAY LẬP TỨC
        doc_code_matches = re.findall(r'(\d+[\/\-_][\w\/\-_]+)', query)
        if doc_code_matches:
            target_doc_code = doc_code_matches[0]
            doc_chunk_found = False
            for c in authorized_chunks:
                c_code = (c.get("document_code") or "").lower()
                c_title = (c.get("title") or "").lower()
                c_fid = (c.get("file_id") or "").lower()
                c_text = (c.get("text") or "").lower()
                for cm in doc_code_matches:
                    cm_lower = cm.lower()
                    if cm_lower in c_code or cm_lower in c_title or cm_lower in c_fid or cm_lower in c_text:
                        doc_chunk_found = True
                        break
                if doc_chunk_found:
                    break

            if not doc_chunk_found:
                refusal_answer = (
                    f"Báo cáo đồng chí, tài liệu {target_doc_code} không phù hợp với cấp bảo mật hiện tại của đồng chí "
                    f"(Cấp {user_clearance} - {'Nội bộ' if user_clearance == 2 else clearance_name}). Xin đồng chí vui lòng kiểm tra lại hoặc tra cứu tài liệu khác cùng cấp độ bảo mật."
                )
                return {
                    "answer": refusal_answer,
                    "citations": [],
                    "reasoning": {
                        "mem": mem_trace,
                        "think": (
                            f"[Clearance Guard] Phát hiện câu hỏi yêu cầu văn bản {target_doc_code}. "
                            f"Văn bản này không thuộc phạm vi cấp quyền Cấp {user_clearance} ({clearance_name}). "
                            f"Áp dụng nguyên tắc Fail Closed: Từ chối trích dẫn và không suy đoán bừa."
                        ),
                        "tool_call": f"[Security Refusal] Chặn trích dẫn văn bản {target_doc_code} do vượt cấp bảo mật."
                    },
                    "retrieval_mode": retrieval_mode,
                    "synthesis_mode": "clearance_blocked",
                    "requires_biometric": False
                }

        # Kiểm tra ngưỡng bằng chứng & Cấp quyền
        if not authorized_chunks:
            fallback_answer = (
                f"{salutation}\n\n{NO_DATA_FALLBACK_MESSAGE}"
                if salutation != "Báo cáo đồng chí,"
                else NO_DATA_FALLBACK_MESSAGE
            )
            return {
                "answer": fallback_answer,
                "citations": [],
                "reasoning": {
                    "mem": mem_trace,
                    "think": (
                        f"[Agent Think] Không tìm thấy dữ liệu nào phù hợp với câu hỏi '{query}' "
                        f"trong phạm vi cấp quyền {clearance_name} (Cấp {user_clearance}). "
                        f"Quyết định: Không suy đoán, trả lời từ chối theo quy định bảo mật (Fail Closed)."
                    ),
                    "tool_call": "[Tool Grounding] Dừng trích dẫn do không có văn bản phù hợp."
                },
                "retrieval_mode": retrieval_mode,
                "synthesis_mode": "extractive",
                "requires_biometric": False
            }

        # Bước 2: <think>
        raw_valid = [c for c in authorized_chunks if c.get("score", 0) > 0.001] or authorized_chunks

        # --- SINGLE-DOCUMENT FOCUS & DOMINANT DOCUMENT FILTERING ---
        # Đảm bảo chỉ gợi ý đúng 1 file phù hợp nhất khi người dùng tra cứu thông tin văn bản
        query_lower = query.lower()
        code_matches = re.findall(r'(\d+[\/\-][A-Za-z0-9\/\-]+|\b\d{2,4}\b)', query)
        target_file_id = None

        if code_matches and raw_valid:
            for chunk in raw_valid:
                chunk_code = (chunk.get("document_code") or "").lower()
                chunk_title = (chunk.get("title") or "").lower()
                chunk_fid = (chunk.get("file_id") or "").lower()
                for cm in code_matches:
                    cm_lower = cm.lower()
                    if cm_lower in chunk_code or cm_lower in chunk_title or cm_lower in chunk_fid:
                        target_file_id = chunk.get("file_id")
                        break
                if target_file_id:
                    break

        single_doc_keywords = [
            "ai ban hành", "đơn vị nào ban hành", "cơ quan nào ban hành", "người ký", "ai ký",
            "ngày phát hành", "ngày ban hành", "ngày tháng năm", "thời gian ban hành",
            "số hiệu", "ký hiệu", "kí hiệu", "số văn bản", "số quyết định", "số kế hoạch",
            "trích yếu", "nội dung là gì", "có nội dung gì", "loại văn bản", "văn bản gì"
        ]
        is_single_doc_query = any(kw in query_lower for kw in single_doc_keywords)

        if target_file_id:
            # Ưu tiên tuyệt đối văn bản có số hiệu khớp với câu hỏi
            valid_chunks = [c for c in raw_valid if c.get("file_id") == target_file_id] or raw_valid
        elif is_single_doc_query and raw_valid:
            # Câu hỏi tra cứu thuộc tính văn bản: Giữ duy nhất file đứng đầu (top 1)
            top_file_id = raw_valid[0].get("file_id")
            valid_chunks = [c for c in raw_valid if c.get("file_id") == top_file_id]
        elif raw_valid:
            # Câu hỏi tổng hợp đa tài liệu hoặc kiểm tra đa cấp mật:
            # Chỉ giữ các tài liệu có độ liên quan cao sát với top 1 (>= 0.75 * top_score)
            top_score = raw_valid[0].get("score", 0)
            if top_score > 0:
                valid_chunks = [c for c in raw_valid if c.get("score", 0) >= 0.75 * top_score]
            else:
                valid_chunks = raw_valid
        else:
            valid_chunks = raw_valid

        if not valid_chunks:
            fallback_answer = (
                f"{salutation}\n\n{NO_DATA_FALLBACK_MESSAGE}"
                if salutation != "Báo cáo đồng chí,"
                else NO_DATA_FALLBACK_MESSAGE
            )
            return {
                "answer": fallback_answer,
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

        # --- KHÓA BẢO MẬT VÂN TAY CHO NỘI DUNG CẤP 3-5 ĐƯỢC PHÉP TRUY CẬP ---
        # Chỉ áp dụng cho tài liệu mà user CÓ CLEARANCE (security_level_id <= user_clearance) nhưng là Cấp 3+
        classified_chunks = [c for c in valid_chunks if 3 <= int(c.get("security_level_id", 1)) <= user_clearance]
        unclassified_chunks = [c for c in valid_chunks if int(c.get("security_level_id", 1)) <= 2]

        # Trường hợp 1: Có tài liệu Cấp 3+ nhưng CHƯA xác thực vân tay ZK9500
        if classified_chunks and not biometric_verified:
            # 1A. Toàn bộ tài liệu đều thuộc Cấp 3+ (100% Cấp 3+) -> Khóa TOÀN BỘ câu trả lời
            if not unclassified_chunks:
                biometric_warning_msg = (
                    f"{salutation} tài liệu liên quan đến nội dung này thuộc danh mục văn bản bảo mật (Cấp 3 trở lên). "
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

            # 1B. Kết hợp cả Cấp 1-2 và Cấp 3+: Vẫn sinh câu trả lời dựa trên Cấp 1-2 (unclassified_chunks)
            prompt_chunks = unclassified_chunks
        else:
            # Trường hợp 2: Đã xác thực vân tay HOẶC chỉ có tài liệu Cấp 1-2
            prompt_chunks = valid_chunks

        think_trace = (
            f"[Agent Think] Đã phân tích câu hỏi '{query}'. Đối chiếu {len(prompt_chunks)} đoạn văn bản "
            f"từ {len(set(c.get('document_code') for c in prompt_chunks))} văn kiện hợp lệ. "
            f"Tìm thấy các điều khoản và nội dung trích yếu tương thích."
        )

        # Chuẩn bị danh sách citations đính kèm:
        citations = []
        seen_citations = set()
        for c in valid_chunks:
            c_key = (c.get("file_id"), c.get("page"))
            if c_key not in seen_citations:
                seen_citations.add(c_key)
                sec_id = int(c.get("security_level_id", 1))
                is_classified = sec_id >= 3

                # Nếu là cấp 3+ và chưa quét vân tay -> che snippet và gắn cờ requires_biometric
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
        answer_text, synthesis_mode = self._generate_grounded_answer(
            query, prompt_chunks, user_clearance, history,
            salutation=salutation, pos_display=pos_display,
            user_position=user_position, user_name=user_name
        )

        # Nếu có tài liệu cấp 3+ bị che trong trường hợp hỗn hợp: Chèn thông báo cảnh báo ở cuối câu trả lời
        if classified_chunks and not biometric_verified and unclassified_chunks:
            answer_text += (
                "\n\nLưu ý: Có các tài liệu Cấp 3+ liên quan đã bị ẩn. Vui lòng quét vân tay để xem chi tiết."
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

        # Nếu câu trả lời chứa NO_DATA_FALLBACK_MESSAGE: BẮT BUỘC xóa sạch citations (Fail Closed)
        if NO_DATA_FALLBACK_MESSAGE in verified_answer:
            citations = []

        # Chỉ khóa toàn bộ câu trả lời (requires_biometric=True) nếu 100% chunks tìm được đều thuộc Cấp 3+
        requires_bio_flag = bool(classified_chunks and not unclassified_chunks and not biometric_verified)

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
        history: Optional[List[Dict[str, Any]]] = None,
        salutation: str = "Báo cáo đồng chí,",
        pos_display: str = "",
        user_position: str = "",
        user_name: str = ""
    ) -> Tuple[str, str]:
        """
        Sinh câu trả lời trích dẫn grounded:
        - Thử gọi Ollama nội bộ nếu đang chạy.
        - Fallback tự động sang Extractive Military Synthesizer đảm bảo 100% không bị chết trang.
        Trả về tuple (answer_text, synthesis_mode).
        """
        # Thử qua Ollama nếu online
        ollama_response = self._call_ollama(
            query, chunks, history, salutation=salutation,
            pos_display=pos_display, user_position=user_position, user_name=user_name
        )
        if ollama_response and NO_DATA_FALLBACK_MESSAGE not in ollama_response:
            return ollama_response, "llm"

        # Fallback Extractive Synthesizer nếu Ollama offline hoặc từ chối dù có bằng chứng hợp lệ
        return self._extractive_synthesize(query, chunks, salutation=salutation), "extractive"

    def _call_ollama(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        history: Optional[List[Dict[str, Any]]] = None,
        salutation: str = "Báo cáo đồng chí,",
        pos_display: str = "",
        user_position: str = "",
        user_name: str = ""
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
                "1. Tập trung 100% vào việc phân tích, trích xuất và trả lời trực tiếp, chính xác, trung thực dựa trên DANH SÁCH BẰNG CHỨNG được cung cấp. Ưu tiên bám sát văn bản có số hiệu hoặc tiêu đề được hỏi.\n"
                "2. Quy tắc trích xuất thể thức văn bản hành chính - quân sự:\n"
                "   - Loại văn bản: Xác định chuẩn xác theo tên loại văn bản in hoa giữa trang (ví dụ: KẾ HOẠCH, BÁO CÁO, CHỈ THỊ, QUYẾT ĐỊNH, THÔNG BÁO, CÔNG VĂN).\n"
                "   - Đơn vị ban hành: Căn cứ vào cơ quan ban hành ở góc trên bên trái (ví dụ: QUÂN KHU 7 / TRƯỜNG QUÂN SỰ).\n"
                "   - Người ký / Chức vụ: Căn cứ vào chức vụ và họ tên người ký ở góc dưới bên phải (ví dụ: CHÍNH ỦY - Đại tá Bùi Đình Thành).\n"
                "   - Nội dung văn bản: Trích xuất trung thực nội dung thể hiện trong thân văn bản (kể cả khi văn bản ghi nội dung thử nghiệm như 'NỘI DUNG DEMO').\n"
                "   - Số hiệu, ngày tháng năm, trích yếu: Nêu chính xác theo thông tin ghi trên văn bản.\n"
                "3. TUYỆT ĐỐI KHÔNG tự bịa đặt, suy đoán ngoài văn bản, không nhầm lẫn thể loại văn bản khác.\n"
                f"4. Tác phong xưng hô chuẩn mực điều lệnh Quân đội nhân dân Việt Nam: Mở đầu câu trả lời đúng 1 lần duy nhất bằng '{salutation}'. TUYỆT ĐỐI KHÔNG lặp lại họ tên, cấp bậc hoặc chức vụ sau lời chào này.\n"
                "5. Mọi luận điểm, số liệu, trích dẫn bắt buộc phải kèm theo số trang chính xác dạng [p.X] ngay sau nội dung được trích xuất.\n"
                f"6. Chỉ khi 100% danh sách bằng chứng hoàn toàn không có thông tin liên quan đến câu hỏi, mới trả lời duy nhất câu: '{NO_DATA_FALLBACK_MESSAGE}'. Nếu đã trích xuất được thông tin, TUYỆT ĐỐI KHÔNG chèn thêm câu từ chối này vào cuối câu trả lời.\n"
                f"7. Nếu câu hỏi đề cập đến một số hiệu văn bản cụ thể mà số hiệu đó KHÔNG CÓ trong DANH SÁCH BẰNG CHỨNG, TUYỆT ĐỐI KHÔNG được suy đoán bừa (như tự nhận là Quân khu 7 hay bất kỳ cơ quan nào). Phải trả lời đúng mẫu từ chối quy định.\n"
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
                    salut_core = salutation.rstrip(",. ").strip()
                    if answer.lower().startswith(salut_core.lower()):
                        rest = answer[len(salut_core):]
                    else:
                        rest = re.sub(
                            r'^(?:báo cáo|kính gửi|thưa)\s+[^,\n.]*[,.:-]*\s*',
                            '',
                            answer,
                            flags=re.IGNORECASE
                        ).strip()

                    # Bóc tách triệt để mọi trường hợp lặp chức vụ, họ tên, hoặc xưng hô ở đầu nội dung
                    while True:
                        stripped = rest.lstrip(",.:- \t\n")
                        if pos_display and stripped.lower().startswith(pos_display.lower()):
                            rest = stripped[len(pos_display):]
                            continue
                        if user_position and stripped.lower().startswith(user_position.lower()):
                            rest = stripped[len(user_position):]
                            continue
                        if user_name and stripped.lower().startswith(user_name.lower()):
                            rest = stripped[len(user_name):]
                            continue
                        if stripped.lower().startswith("tổ trưởng công nghệ thông tin"):
                            rest = stripped[len("tổ trưởng công nghệ thông tin"):]
                            continue
                        if stripped.lower().startswith("tổ trưởng cntt"):
                            rest = stripped[len("tổ trưởng cntt"):]
                            continue
                        if stripped.lower().startswith("đồng chí"):
                            rest = stripped[len("đồng chí"):]
                            continue
                        rest = stripped
                        break

                    if rest and rest[0].islower():
                        rest = rest[0].upper() + rest[1:]
                    answer = f"{salutation}\n\n{rest}"

                    # Gỡ bỏ câu từ chối thừa ở cuối nếu mô hình đã trích xuất nội dung thực tế phía trước
                    fallback_phrases = [
                        NO_DATA_FALLBACK_MESSAGE.lower(),
                        "nội dung này không có trong các văn bản thuộc phạm vi cấp quyền hiện tại",
                        "nội dung này không có trong các văn bản thuộc phạm vi cấp quyền"
                    ]
                    for fb in fallback_phrases:
                        if fb in answer.lower():
                            fb_idx = answer.lower().rfind(fb)
                            prefix_part = answer[:fb_idx].strip()
                            if len(prefix_part) > len(salutation) + 25:
                                answer = prefix_part

                    return answer
        except Exception:
            pass

        return None

    def _extractive_synthesize(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        salutation: str = "Báo cáo đồng chí,"
    ) -> str:
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
            f"{salutation} căn cứ theo **{doc_code}** (*{title}*), tại **Trang {page} [p.{page}]**, nội dung quy định như sau:",
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
