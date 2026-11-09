"""
QK7 DataHub - OCR Microservice v2.0 (MonkeyOCRv2 / PaddleOCR Fallback)
Port: 8002

Nâng cấp từ PaddleOCR → MonkeyOCRv2 (Yuliang-Liu/MonkeyOCRv2-B-Parsing):
  - Phân tích bố cục (Layout Analysis) chuẩn văn bản hành chính đa cột
  - Xử lý mộc đỏ, văn bản nghiêng, scan nhiễu
  - Trả về Markdown có cấu trúc (giữ thứ tự đọc)
  - Fallback tự động sang PaddleOCR khi MonkeyOCRv2 chưa được cài đặt

Architecture: FastAPI + PyMuPDF (render) + MonkeyOCRv2 (OCR) + PaddleOCR (fallback)
"""

import os
import io
import sys
import time

# Đảm bảo UTF-8 encoding trên Windows console để tránh UnicodeEncodeError (cp1252)
if sys.platform == "win32":
    try:
        reconfig_out = getattr(sys.stdout, "reconfigure", None)
        if callable(reconfig_out):
            reconfig_out(encoding="utf-8", errors="replace")
        reconfig_err = getattr(sys.stderr, "reconfigure", None)
        if callable(reconfig_err):
            reconfig_err(encoding="utf-8", errors="replace")
    except Exception:
        pass
import json
import re
import logging
from typing import List, Optional, Any, Tuple
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymupdf
import numpy as np
from PIL import Image

# ═══════════════════════════════════════════════════════════════
# Cấu hình logging
# ═══════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("ocr-service")

# ═══════════════════════════════════════════════════════════════
# Cấu hình từ biến môi trường
# ═══════════════════════════════════════════════════════════════
OCR_ENGINE = os.environ.get("OCR_ENGINE", "auto").lower()
# "auto"      → thử MonkeyOCRv2 trước, fallback về PaddleOCR
# "monkey"    → chỉ MonkeyOCRv2
# "paddleocr" → chỉ PaddleOCR (hành vi cũ)

LOCAL_MODEL_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "model_weight", "MonkeyOCRv2-B-Parsing"
)
if os.path.isdir(LOCAL_MODEL_DIR) and not os.environ.get("MONKEY_MODEL_ID"):
    MONKEY_MODEL_ID = LOCAL_MODEL_DIR
else:
    MONKEY_MODEL_ID = os.environ.get(
        "MONKEY_MODEL_ID", "zenosai/MonkeyOCRv2-B-Parsing"
    )
MONKEY_DEVICE = os.environ.get("MONKEY_DEVICE", "auto")  # "auto" | "cpu" | "cuda"
DEFAULT_DPI    = int(os.environ.get("OCR_DEFAULT_DPI", "150"))
MAX_DPI        = int(os.environ.get("OCR_MAX_DPI", "300"))
PORT           = int(os.environ.get("PORT", "8002"))



# ═══════════════════════════════════════════════════════════════
# State toàn cục cho OCR engine (lazy-load, singleton)
# ═══════════════════════════════════════════════════════════════
_monkey_model: Optional[Any] = None
_monkey_processor: Optional[Any] = None
_monkey_device: Optional[str] = None
_paddle_engine: Optional[Any] = None
_active_engine: Optional[str] = None   # "monkey" | "paddleocr" | None

# ─── MonkeyOCRv2 loader ───────────────────────────────────────
def _load_monkey():
    """
    Lazy-load MonkeyOCRv2 model (HuggingFace transformers).
    Tải về ~2.5GB lần đầu, cache tại ~/.cache/huggingface.
    """
    global _monkey_model, _monkey_processor, _monkey_device, _active_engine
    if _monkey_model is not None:
        return True

    try:
        import torch  # pyright: ignore[reportMissingImports] # type: ignore
        from transformers import AutoProcessor, AutoModelForCausalLM  # pyright: ignore[reportMissingImports] # type: ignore

        device = MONKEY_DEVICE
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"

        logger.info(
            f"[MonkeyOCRv2] Nạp model '{MONKEY_MODEL_ID}' lên {device}..."
        )
        _monkey_processor = AutoProcessor.from_pretrained(
            MONKEY_MODEL_ID, trust_remote_code=True
        )
        from transformers import AutoModel  # pyright: ignore[reportMissingImports] # type: ignore
        try:
            _monkey_model = AutoModelForCausalLM.from_pretrained(
                MONKEY_MODEL_ID,
                trust_remote_code=True,
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            ).to(device)
        except Exception as e_causal:
            logger.info(f"[MonkeyOCRv2] Thử nạp bằng AutoModel: {e_causal}")
            _monkey_model = AutoModel.from_pretrained(
                MONKEY_MODEL_ID,
                trust_remote_code=True,
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            ).to(device)

        if _monkey_model is not None:
            _monkey_model.eval()
        _monkey_device = device

        logger.info(f"[MonkeyOCRv2] ✅ Model sẵn sàng trên {device}!")
        _active_engine = "monkey"
        return True

    except ImportError as e:
        logger.error(
            f"[MonkeyOCRv2] ❌ Thiếu package (torch / transformers): {e}. "
            "Vui lòng chạy file 'fix_torch.bat' trong thư mục ocr-service để cài đặt! "
            "Hệ thống tạm thời chuyển sang PaddleOCR fallback."
        )
        return False
    except Exception as e:
        logger.error(f"[MonkeyOCRv2] ❌ Lỗi nạp model: {e}", exc_info=True)
        return False


# ─── PaddleOCR loader (fallback) ─────────────────────────────
def _load_paddle():
    """Lazy-load PaddleOCR làm fallback hoặc engine chính."""
    global _paddle_engine, _active_engine
    if _paddle_engine is not None:
        return True
    try:
        logger.info("[PaddleOCR] Khởi tạo PaddleOCR(use_angle_cls=True, lang='vi')...")
        from paddleocr import PaddleOCR  # pyright: ignore[reportMissingImports] # type: ignore
        _paddle_engine = PaddleOCR(use_angle_cls=True, lang="vi", show_log=False)
        logger.info("[PaddleOCR] ✅ Sẵn sàng!")
        _active_engine = "paddleocr"
        return True
    except Exception as e:
        logger.error(f"[PaddleOCR] ❌ Không khởi tạo được: {e}")
        return False


def _ensure_engine():
    """
    Đảm bảo ít nhất 1 engine hoạt động.
    Trả về "monkey" | "paddleocr" | None
    """

    if OCR_ENGINE in ("monkey", "auto"):
        if _load_monkey():
            return "monkey"

    if OCR_ENGINE in ("paddleocr", "auto"):
        if _load_paddle():
            return "paddleocr"

    logger.error("[OCR] Không có engine nào khả dụng!")
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"=== QK7 OCR Microservice v2.0 khởi động (cổng {PORT}) ===")
    logger.info(f"OCR_ENGINE={OCR_ENGINE} | MODEL={MONKEY_MODEL_ID} | DEVICE={MONKEY_DEVICE}")
    try:
        engine = _ensure_engine()
        if engine:
            logger.info(f"[startup] Engine hoạt động: {engine}")
        else:
            logger.warning("[startup] Chưa có engine — sẽ thử lại khi nhận request đầu tiên.")
    except Exception as e:
        logger.warning(f"[startup] Pre-warm lỗi: {e}. Sẽ thử lại khi có request.")
    yield

# ═══════════════════════════════════════════════════════════════
# FastAPI App
# ═══════════════════════════════════════════════════════════════
app = FastAPI(
    title="QK7 DataHub - OCR Microservice v2",
    description=(
        "OCR Microservice sử dụng MonkeyOCRv2 (phân tích bố cục) "
        "với PaddleOCR làm fallback, chuyên xử lý văn bản hành chính/quân sự "
        "scan đa cột, có mộc đỏ, nghiêng."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# CORS Middleware [FIX CWE-942: Chi chap nhan internal gateway va local origins]
allowed_origins_ocr = [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
server_ip = os.environ.get("SERVER_IP")
if server_ip:
    allowed_origins_ocr.append(f"http://{server_ip}:8000")
    allowed_origins_ocr.append(f"http://{server_ip}:5173")

env_cors = os.environ.get("CORS_ALLOWED_ORIGINS", "")
if env_cors:
    allowed_origins_ocr.extend([o.strip() for o in env_cors.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(allowed_origins_ocr)),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)



# ═══════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════
class PageOcrResult(BaseModel):
    page: int
    text: str
    lines: List[str]
    line_count: int
    confidence_avg: float
    engine_used: str = "unknown"


class OcrExtractResponse(BaseModel):
    success: bool
    total_pages: int
    pages_processed: List[int]
    results: List[PageOcrResult]
    combined_text: str
    elapsed_seconds: float
    engine_used: str = "unknown"
    error: Optional[str] = None


# ═══════════════════════════════════════════════════════════════
# Tiện ích: Render PDF trang → PIL Image
# ═══════════════════════════════════════════════════════════════
def _render_page_to_image(doc: pymupdf.Document, page_idx: int, dpi: int) -> Image.Image:
    """Render 1 trang PDF thành PIL Image (RGB)."""
    page = doc[page_idx]
    pix  = page.get_pixmap(dpi=dpi)
    img_bytes = pix.tobytes("png")
    return Image.open(io.BytesIO(img_bytes)).convert("RGB")


# ═══════════════════════════════════════════════════════════════
# OCR bằng MonkeyOCRv2 (trả về Markdown có cấu trúc)
# ═══════════════════════════════════════════════════════════════
def _ocr_with_monkey(pil_image: Image.Image) -> Tuple[str, float]:
    """
    OCR 1 ảnh bằng MonkeyOCRv2.
    Trả về: (markdown_text, avg_confidence)
    
    MonkeyOCRv2 hiểu bố cục, giữ thứ tự đọc tự nhiên,
    xuất Markdown (tiêu đề # ## ###, bảng |, text thường).
    """
    if _monkey_processor is None or _monkey_model is None:
        raise RuntimeError("MonkeyOCRv2 model hoặc processor chưa được khởi tạo!")

    import torch  # pyright: ignore[reportMissingImports] # type: ignore

    prompt = (
        "<|im_start|>system\nYou are a helpful assistant.<|im_end|>\n"
        "<|im_start|>user\n<image>\n"
        "Please recognize the text in this document image. "
        "Preserve the reading order and layout structure. "
        "Output structured text with correct Vietnamese diacritics. "
        "For two-column layout, output left column first then right column.\n"
        "<|im_end|>\n<|im_start|>assistant\n"
    )

    inputs = _monkey_processor(
        text=prompt,
        images=pil_image,
        return_tensors="pt",
    ).to(_monkey_device)

    with torch.no_grad():
        output_ids = _monkey_model.generate(
            **inputs,
            max_new_tokens=2048,
            do_sample=False,
            temperature=1.0,
            repetition_penalty=1.05,
        )

    # Chỉ lấy phần sinh ra (bỏ input tokens)
    input_len  = inputs["input_ids"].shape[1]
    output_ids = output_ids[:, input_len:]
    text = _monkey_processor.batch_decode(output_ids, skip_special_tokens=True)[0]

    # Làm sạch nhẹ: bỏ prefix/suffix thừa do template
    text = text.strip()

    # Confidence = 1.0 (MonkeyOCRv2 không trả confidence score)
    return text, 1.0


# ═══════════════════════════════════════════════════════════════
# OCR bằng PaddleOCR (fallback, trả về text thuần)
# ═══════════════════════════════════════════════════════════════
def _sort_reading_order(boxes_with_text, row_tolerance_px: int = 12):
    """
    Sắp xếp các khối OCR theo thứ tự đọc tự nhiên (top→bottom, left→right).
    Hỗ trợ layout 2 cột phổ biến trong văn bản hành chính VN.
    """
    if not boxes_with_text:
        return [], []

    items = []
    for item in boxes_with_text:
        box       = item[0]
        text_info = item[1]
        text      = text_info[0]
        score     = float(text_info[1])
        y_top     = min(p[1] for p in box)
        x_left    = min(p[0] for p in box)
        items.append({"y": y_top, "x": x_left, "text": text, "score": score})

    items.sort(key=lambda it: it["y"])
    lines, current_line, current_y = [], [], None

    for it in items:
        if current_y is None or abs(it["y"] - current_y) <= row_tolerance_px:
            current_line.append(it)
            current_y = it["y"] if current_y is None else (current_y + it["y"]) / 2
        else:
            current_line.sort(key=lambda x: x["x"])
            lines.append(current_line)
            current_line = [it]
            current_y = it["y"]

    if current_line:
        current_line.sort(key=lambda x: x["x"])
        lines.append(current_line)

    sorted_text_lines = []
    for line in lines:
        line_str = " ".join(it["text"] for it in line).strip()
        if line_str:
            sorted_text_lines.append(line_str)

    flat_items = [it for line in lines for it in line]
    return sorted_text_lines, flat_items


def _ocr_with_paddle(pil_image: Image.Image) -> Tuple[str, float]:
    """
    OCR 1 ảnh bằng PaddleOCR. Trả về: (text, avg_confidence)
    """
    if _paddle_engine is None:
        raise RuntimeError("PaddleOCR engine chưa được khởi tạo!")

    img_np  = np.array(pil_image)
    ocr_res = _paddle_engine.ocr(img_np, cls=True)

    if ocr_res and len(ocr_res) > 0 and ocr_res[0]:
        sorted_lines, flat_items = _sort_reading_order(ocr_res[0])
        page_text = "\n".join(sorted_lines)
        avg_conf  = (
            sum(it["score"] for it in flat_items) / len(flat_items)
            if flat_items else 0.0
        )
    else:
        page_text = ""
        avg_conf  = 0.0

    return page_text, avg_conf


# ═══════════════════════════════════════════════════════════════
# Tiện ích: Chuyển Markdown MonkeyOCR → plain text sạch
# (giữ thứ tự, bỏ ký tự markdown thừa nhưng vẫn giữ nội dung)
# ═══════════════════════════════════════════════════════════════
def _markdown_to_plain(md: str) -> str:
    """Chuyển Markdown output của MonkeyOCRv2 sang plain-text có cấu trúc."""
    lines_out = []
    for line in md.splitlines():
        # Bỏ ký tự heading markdown nhưng giữ text
        line = re.sub(r'^#{1,6}\s*', '', line)
        # Bỏ **bold** / *italic*
        line = re.sub(r'\*{1,2}([^*]+)\*{1,2}', r'\1', line)
        # Bỏ ký tự pipe đầu/cuối bảng
        if line.startswith('|') and line.endswith('|'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            line  = '  '.join(c for c in cells if c and not re.match(r'^[-:]+$', c))
        if line.strip():
            lines_out.append(line.strip())
    return "\n".join(lines_out)


# ═══════════════════════════════════════════════════════════════
# Phân tích danh sách trang từ request
# ═══════════════════════════════════════════════════════════════
def _parse_pages_param(pages: str, total_pages: int) -> List[int]:
    """Parse tham số 'pages' thành list số trang hợp lệ (1-indexed)."""
    if pages.strip().lower() == "all":
        return list(range(1, total_pages + 1))

    result = []
    try:
        parsed = json.loads(pages)
        if isinstance(parsed, list):
            result = [int(p) for p in parsed if 1 <= int(p) <= total_pages]
        elif isinstance(parsed, int):
            result = [parsed] if 1 <= parsed <= total_pages else []
    except Exception:
        parts = pages.replace("[", "").replace("]", "").split(",")
        for p in parts:
            p = p.strip()
            if p.isdigit():
                p_int = int(p)
                if 1 <= p_int <= total_pages:
                    result.append(p_int)

    return result if result else ([1] if total_pages >= 1 else [])


# ═══════════════════════════════════════════════════════════════
# Health endpoint
# ═══════════════════════════════════════════════════════════════
@app.get("/health")
def health_check():
    engine_name = _active_engine or "not_loaded"
    return {
        "status": "ok",
        "service": "ocr-service",
        "version": "2.0.0",
        "port": PORT,
        "engine_configured": OCR_ENGINE,
        "engine_active": engine_name,
        "monkey_model": MONKEY_MODEL_ID,
        "device": _monkey_device or "n/a",
    }


# ═══════════════════════════════════════════════════════════════
# POST /api/ocr/extract — Endpoint chính
# ═══════════════════════════════════════════════════════════════
@app.post("/api/ocr/extract", response_model=OcrExtractResponse)
async def extract_ocr(
    file:  UploadFile = File(...),
    pages: str        = Form(default="[1]"),
    dpi:   int        = Form(default=DEFAULT_DPI),
):
    """
    Trích xuất text từ các trang PDF được chỉ định.

    **Form Data:**
    - `file`  : Tệp PDF (multipart/form-data)
    - `pages` : JSON array hoặc chuỗi phân tách dấu phẩy, hoặc "all"
                Ví dụ: "[1]", "[1,2]", "1,2", "all"
    - `dpi`   : Độ phân giải render (mặc định 150, tối đa 300)

    **Response:** `OcrExtractResponse` với `combined_text` là text sạch
    kết hợp tất cả trang đã xử lý.
    """
    t0 = time.time()
    logger.info(
        f"[POST /api/ocr/extract] File={file.filename!r} pages={pages!r} dpi={dpi}"
    )

    # Clamp DPI
    dpi = max(72, min(dpi, MAX_DPI))

    # ── 1. Đảm bảo có engine ──────────────────────────────────
    engine = _ensure_engine()
    if not engine:
        raise HTTPException(
            status_code=503,
            detail="Không có OCR engine nào khả dụng. Vui lòng kiểm tra cài đặt.",
        )

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Tệp tải lên rỗng")

        # ── 2. Mở PDF bằng PyMuPDF ───────────────────────────
        doc         = pymupdf.open(stream=content, filetype="pdf")
        total_pages = len(doc)

        # ── 3. Parse danh sách trang ─────────────────────────
        pages_to_process = _parse_pages_param(pages, total_pages)
        logger.info(
            f"[OCR] Engine={engine}, {len(pages_to_process)} trang cần xử lý: {pages_to_process}"
        )

        page_results    = []
        all_text_blocks = []

        # ── 4. OCR từng trang ────────────────────────────────
        for p_num in pages_to_process:
            p_idx = p_num - 1
            t_page = time.time()

            try:
                pil_img = _render_page_to_image(doc, p_idx, dpi)
            except Exception as render_err:
                logger.error(f"[OCR] Render trang {p_num} lỗi: {render_err}")
                continue

            # ── Gọi engine tương ứng ──
            page_text   = ""
            avg_conf    = 0.0
            engine_used = engine

            if engine == "monkey":
                try:
                    raw_md, avg_conf = _ocr_with_monkey(pil_img)
                    page_text = _markdown_to_plain(raw_md)
                except Exception as mono_err:
                    logger.warning(
                        f"[MonkeyOCRv2] Trang {p_num} lỗi: {mono_err}. "
                        "Thử PaddleOCR fallback..."
                    )
                    # Fallback ngay tại chỗ về PaddleOCR
                    if _load_paddle():
                        try:
                            page_text, avg_conf = _ocr_with_paddle(pil_img)
                            engine_used = "paddleocr_fallback"
                        except Exception as pad_err:
                            logger.error(f"[PaddleOCR fallback] Trang {p_num} lỗi: {pad_err}")
                    else:
                        logger.error(f"[OCR] Trang {p_num}: cả 2 engine đều thất bại")

            elif engine == "paddleocr":
                try:
                    page_text, avg_conf = _ocr_with_paddle(pil_img)
                    engine_used = "paddleocr"
                except Exception as pad_err:
                    logger.error(f"[PaddleOCR] Trang {p_num} lỗi: {pad_err}")

            elapsed_page = round(time.time() - t_page, 2)
            lines_list   = [l for l in page_text.splitlines() if l.strip()]

            logger.info(
                f"[OCR] Trang {p_num}: {len(lines_list)} dòng, "
                f"conf={avg_conf:.3f}, engine={engine_used}, {elapsed_page}s"
            )

            page_results.append(PageOcrResult(
                page=p_num,
                text=page_text,
                lines=lines_list,
                line_count=len(lines_list),
                confidence_avg=round(avg_conf, 3),
                engine_used=engine_used,
            ))
            all_text_blocks.append(page_text)

        doc.close()

        elapsed      = round(time.time() - t0, 2)
        combined     = "\n\n".join(b for b in all_text_blocks if b)

        logger.info(
            f"[OCR] ✅ Hoàn tất {len(pages_to_process)} trang "
            f"({len(combined)} ký tự) trong {elapsed}s"
        )

        return OcrExtractResponse(
            success=True,
            total_pages=total_pages,
            pages_processed=pages_to_process,
            results=page_results,
            combined_text=combined,
            elapsed_seconds=elapsed,
            engine_used=engine,
            error=None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[POST /api/ocr/extract] Lỗi không xác định: {e}", exc_info=True)
        return OcrExtractResponse(
            success=False,
            total_pages=0,
            pages_processed=[],
            results=[],
            combined_text="",
            elapsed_seconds=round(time.time() - t0, 2),
            engine_used=_active_engine or "none",
            error=str(e),
        )


# ═══════════════════════════════════════════════════════════════
# GET /api/ocr/engines — Danh sách engine khả dụng
# ═══════════════════════════════════════════════════════════════
@app.get("/api/ocr/engines")
def list_engines():
    """Kiểm tra trạng thái từng OCR engine."""
    monkey_ok = _monkey_model is not None
    paddle_ok = _paddle_engine is not None

    return {
        "configured": OCR_ENGINE,
        "active": _active_engine or "none",
        "engines": {
            "monkey_ocr_v2": {
                "loaded": monkey_ok,
                "model": MONKEY_MODEL_ID,
                "device": _monkey_device or "n/a",
            },
            "paddleocr": {
                "loaded": paddle_ok,
                "lang": "vi",
            },
        },
    }


# ═══════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=PORT,
        reload=False,
        workers=1,
        log_level="info",
    )
