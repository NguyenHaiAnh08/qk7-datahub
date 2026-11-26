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

# ═══════════════════════════════════════════════════════════════
# Air-Gapped Hardening: Ép offline mode và triệt tiêu telemetry
# ═══════════════════════════════════════════════════════════════
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_DATASETS_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("DO_NOT_TRACK", "1")
os.environ.setdefault("DISABLE_TELEMETRY", "1")
os.environ.setdefault("SCARF_NO_ANALYTICS", "1")
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
os.environ.setdefault("DISABLE_PADDLE_UPDATE_CHECK", "1")
os.environ.setdefault("NO_ALBUMENTATIONS_UPDATE", "1")
os.environ.setdefault("FLAGS_use_mkldnn", "0")
# Bảo vệ VRAM trên GPU 4GB (GTX 1650) khi chạy song song với Ollama AI Boxchat:
# cấp phát tăng dần (auto_growth) và giới hạn tỷ lệ bộ nhớ GPU tối đa 25% (~1GB)
os.environ.setdefault("FLAGS_allocator_strategy", "auto_growth")
os.environ.setdefault("FLAGS_fraction_of_gpu_memory_to_use", "0.25")

import gc
import json
import re
import unicodedata
import logging
import concurrent.futures
from typing import List, Optional, Any, Tuple
from contextlib import asynccontextmanager

import cv2
import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.concurrency import run_in_threadpool
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
LOCAL_PADDLE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "model_weight", "paddleocr"
)
LOCAL_PADDLEX_CACHE = os.path.join(LOCAL_PADDLE_DIR, "paddlex_cache")
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", LOCAL_PADDLEX_CACHE)
LOCAL_VIETOCR_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "model_weight", "vietocr"
)
LOCAL_VIETOCR_WEIGHTS = os.path.join(LOCAL_VIETOCR_DIR, "vgg_seq2seq.pth")
PADDLE_DEVICE = os.environ.get("PADDLE_DEVICE", "auto")  # "auto" | "gpu:0" | "cpu"
USE_VIETOCR = os.environ.get("USE_VIETOCR", "1").strip().lower() not in ("0", "false", "no")
if os.path.isdir(LOCAL_MODEL_DIR) and not os.environ.get("MONKEY_MODEL_ID"):
    MONKEY_MODEL_ID = LOCAL_MODEL_DIR
else:
    MONKEY_MODEL_ID = os.environ.get(
        "MONKEY_MODEL_ID", "zenosai/MonkeyOCRv2-B-Parsing"
    )
MONKEY_DEVICE = os.environ.get("MONKEY_DEVICE", "auto")  # "auto" | "cpu" | "cuda"
DEFAULT_DPI    = int(os.environ.get("OCR_DEFAULT_DPI", "150"))
MAX_DPI        = int(os.environ.get("OCR_MAX_DPI", "300"))
# Ưu tiên OCR_PORT / PORT_OCR; tự bảo vệ khỏi rò rỉ PORT=8000 của Backend từ root .env
_explicit_ocr_port = os.environ.get("OCR_PORT") or os.environ.get("PORT_OCR")
if _explicit_ocr_port:
    PORT = int(_explicit_ocr_port)
else:
    _env_port = os.environ.get("PORT", "8002")
    if _env_port == "8000":
        logger.warning(
            "[CONFIG] Phát hiện PORT=8000 (cổng Backend) bị kế thừa từ biến môi trường cha. "
            "Tự động ép OCR Microservice về cổng chuẩn 8002 để tránh xung đột!"
        )
        PORT = 8002
    else:
        PORT = int(_env_port)
HOST           = os.environ.get("HOST", "0.0.0.0")



# ═══════════════════════════════════════════════════════════════
# State toàn cục cho OCR engine (lazy-load, singleton)
# ═══════════════════════════════════════════════════════════════
_monkey_model: Optional[Any] = None
_monkey_processor: Optional[Any] = None
_monkey_device: Optional[str] = None
_paddle_engine: Optional[Any] = None
_vietocr_predictor: Optional[Any] = None
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

        if os.environ.get("HF_HUB_OFFLINE") == "1":
            logger.info("[MonkeyOCRv2] Offline mode is enabled (HF_HUB_OFFLINE=1, TRANSFORMERS_OFFLINE=1)")

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


# ─── PaddleOCR loader (fallback / PaddlePaddle 3.3 + PP-OCRv5 GPU/CPU) ───
def _resolve_paddle_device() -> str:
    """Xác định thiết bị cho PaddleOCR 3.x ('gpu:0' nếu có CUDA, ngược lại 'cpu')."""
    if PADDLE_DEVICE and PADDLE_DEVICE != "auto":
        return PADDLE_DEVICE
    try:
        import paddle  # pyright: ignore[reportMissingImports] # type: ignore
        if paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0:
            return "gpu:0"
    except Exception:
        pass
    return "cpu"


def _load_paddle(set_active: bool = True):
    """Lazy-load PaddleOCR làm fallback hoặc engine chính (hỗ trợ cả PaddleOCR 3.x & 2.x, ưu tiên weights nội bộ)."""
    global _paddle_engine, _active_engine
    if _paddle_engine is not None:
        if set_active and not _active_engine:
            _active_engine = "paddleocr"
        return True
    try:
        import inspect
        from paddleocr import PaddleOCR  # pyright: ignore[reportMissingImports] # type: ignore

        init_params = inspect.signature(PaddleOCR.__init__).parameters
        is_v3_api = "text_detection_model_dir" in init_params

        if is_v3_api:
            paddle_device = _resolve_paddle_device()
            v5_mobile_det_dir = os.path.join(LOCAL_PADDLEX_CACHE, "official_models", "PP-OCRv5_mobile_det")
            v5_server_det_dir = os.path.join(LOCAL_PADDLEX_CACHE, "official_models", "PP-OCRv5_server_det")
            v5_rec_dir = os.path.join(LOCAL_PADDLEX_CACHE, "official_models", "latin_PP-OCRv5_mobile_rec")

            # Ưu tiên PP-OCRv5_mobile_det để tiết kiệm VRAM (~250MB thay vì ~2GB của server_det)
            # giúp chạy song song an toàn với Ollama trên GPU 4GB (GTX 1650)
            if os.path.isdir(v5_mobile_det_dir) and os.path.isdir(v5_rec_dir):
                det_name, det_path = "PP-OCRv5_mobile_det", v5_mobile_det_dir
            elif os.path.isdir(v5_server_det_dir) and os.path.isdir(v5_rec_dir):
                det_name, det_path = "PP-OCRv5_server_det", v5_server_det_dir
            else:
                det_name, det_path = None, None

            if det_name and det_path:
                logger.info(
                    f"[PaddleOCR v3] Sử dụng trọng số nội bộ {det_name} + latin_PP-OCRv5_mobile_rec "
                    f"({LOCAL_PADDLEX_CACHE}) trên {paddle_device}"
                )
                _paddle_engine = PaddleOCR(
                    text_detection_model_name=det_name,
                    text_detection_model_dir=det_path,
                    text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
                    text_recognition_model_dir=v5_rec_dir,
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=False,
                    device=paddle_device,
                )
            else:
                logger.info(
                    f"[PaddleOCR v3] Khởi tạo PaddleOCR(PP-OCRv5_mobile_det + latin_PP-OCRv5_mobile_rec, device='{paddle_device}')..."
                )
                _paddle_engine = PaddleOCR(
                    text_detection_model_name="PP-OCRv5_mobile_det",
                    text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=False,
                    device=paddle_device,
                )
        else:
            det_dir = os.path.join(LOCAL_PADDLE_DIR, "det", "en_PP-OCRv3_det_infer")
            rec_dir = os.path.join(LOCAL_PADDLE_DIR, "rec", "latin_PP-OCRv3_rec_infer")
            cls_dir = os.path.join(LOCAL_PADDLE_DIR, "cls", "ch_ppocr_mobile_v2.0_cls_infer")

            if os.path.isdir(det_dir) and os.path.isdir(rec_dir) and os.path.isdir(cls_dir):
                logger.info(f"[PaddleOCR v2] Sử dụng trọng số nội bộ: {LOCAL_PADDLE_DIR}")
                _paddle_engine = PaddleOCR(
                    use_angle_cls=True,
                    lang="vi",
                    det_model_dir=det_dir,
                    rec_model_dir=rec_dir,
                    cls_model_dir=cls_dir,
                    show_log=False,
                )
            else:
                logger.info("[PaddleOCR v2] Khởi tạo PaddleOCR(use_angle_cls=True, lang='vi')...")
                _paddle_engine = PaddleOCR(use_angle_cls=True, lang="vi", show_log=False)

        logger.info("[PaddleOCR] ✅ Sẵn sàng!")
        if USE_VIETOCR:
            _load_vietocr()
        if set_active:
            _active_engine = "paddleocr"
        return True
    except Exception as e:
        logger.error(f"[PaddleOCR] ❌ Không khởi tạo được: {e}", exc_info=True)
        return False


def _load_vietocr() -> bool:
    """
    Lazy-load VietOCR (vgg_seq2seq, 229 ký tự Quốc ngữ đủ 100% dấu tiếng Việt)
    chạy hoàn toàn Air-Gapped offline trên CPU (0 MB VRAM GPU) kết hợp với
    PP-OCRv5_mobile_det trên GPU CUDA 11.8.
    """
    global _vietocr_predictor
    if _vietocr_predictor is not None:
        return True
    if not USE_VIETOCR:
        return False
    try:
        from vietocr.tool.config import Cfg  # pyright: ignore[reportMissingImports] # type: ignore
        from vietocr.tool.predictor import Predictor  # pyright: ignore[reportMissingImports] # type: ignore

        cfg = Cfg.load_config_from_name("vgg_seq2seq")
        cfg["device"] = os.environ.get("VIETOCR_DEVICE", "cpu")
        cfg["cnn"]["pretrained"] = False
        cfg["predictor"]["beamsearch"] = False
        if os.path.isfile(LOCAL_VIETOCR_WEIGHTS):
            cfg["weights"] = LOCAL_VIETOCR_WEIGHTS
            logger.info(f"[VietOCR] Sử dụng trọng số Tiếng Việt nội bộ: {LOCAL_VIETOCR_WEIGHTS}")
        _vietocr_predictor = Predictor(cfg)
        logger.info(
            f"[VietOCR] ✅ Sẵn sàng (bộ chữ Quốc ngữ {len(cfg.get('vocab', ''))} ký tự, device={cfg['device']})!"
        )
        return True
    except Exception as e:
        logger.warning(f"[VietOCR] ⚠️ Không nạp được VietOCR (sẽ dùng bộ đọc mặc định của PaddleOCR): {e}")
        return False


def _should_use_paddle_first() -> bool:
    """
    Chế độ CPU Adaptive SLA:
    Khi OCR_ENGINE='auto' trên máy CPU (không GPU CUDA) và không ép MONKEY_FORCE_CPU_OCR=1,
    bỏ qua việc nạp MonkeyOCRv2 (~3.6GB RAM float32) vào CPU vì thực thi luôn chuyển sang
    PaddleOCR — tránh OOM crash trên máy 8GB RAM và giúp khởi động < 10s.
    """
    if OCR_ENGINE != "auto":
        return False
    if os.environ.get("MONKEY_FORCE_CPU_OCR") == "1":
        return False
    if MONKEY_DEVICE == "cpu":
        return True
    if MONKEY_DEVICE == "auto":
        try:
            import torch  # pyright: ignore[reportMissingImports] # type: ignore
            return not torch.cuda.is_available()
        except Exception:
            return True
    return False


def _ensure_engine():
    """
    Đảm bảo ít nhất 1 engine hoạt động.
    Trả về "monkey" | "paddleocr" | None
    """
    if _should_use_paddle_first():
        logger.info(
            "[OCR] Chế độ CPU Adaptive SLA (MONKEY_DEVICE=cpu / không CUDA): "
            "Sử dụng trực tiếp PaddleOCR nội bộ để tối ưu RAM và tốc độ < 5s/trang "
            "(đặt MONKEY_FORCE_CPU_OCR=1 hoặc OCR_ENGINE=monkey để ép nạp MonkeyOCRv2 trên CPU)."
        )
        if _load_paddle():
            return "paddleocr"

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
            if (
                engine == "monkey"
                and _monkey_device == "cpu"
                and OCR_ENGINE == "auto"
                and os.environ.get("MONKEY_FORCE_CPU_OCR") != "1"
            ):
                logger.info("[startup] Chế độ CPU Adaptive SLA: Pre-warm sẵn PaddleOCR cục bộ...")
                _load_paddle(set_active=False)
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
    allowed_origins_ocr.extend([
        f"http://{server_ip}:8000",
        f"http://{server_ip}:5173",
        f"https://{server_ip}:8000",
        f"https://{server_ip}",
    ])
server_domain = os.environ.get("SERVER_DOMAIN")
if server_domain:
    allowed_origins_ocr.extend([
        f"https://{server_domain}",
        f"https://{server_domain}:8000",
        f"http://{server_domain}",
        f"http://{server_domain}:8000",
    ])

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

    if _monkey_device == "cpu" and os.environ.get("MONKEY_FORCE_CPU_OCR") != "1":
        raise RuntimeError(
            "Môi trường hiện tại vận hành trên CPU (không có CUDA). "
            "Tự động kích hoạt PaddleOCR fallback để đảm bảo SLA tốc độ < 10s theo quy chuẩn QK7."
        )

    import torch  # pyright: ignore[reportMissingImports] # type: ignore

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": pil_image},
                {
                    "type": "text",
                    "text": (
                        "Please recognize the text in this document image. "
                        "Preserve the reading order and layout structure. "
                        "Output structured text with correct Vietnamese diacritics. "
                        "For two-column layout, output left column first then right column."
                    ),
                },
            ],
        }
    ]
    prompt = _monkey_processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )

    inputs = _monkey_processor(
        text=[prompt],
        images=[pil_image],
        padding=True,
        return_tensors="pt",
    ).to(_monkey_device)

    def _do_generate():
        with torch.no_grad():
            return _monkey_model.generate(
                **inputs,
                max_new_tokens=int(os.environ.get("MONKEY_MAX_NEW_TOKENS", "512")),
                do_sample=False,
                temperature=1.0,
                repetition_penalty=1.05,
            )

    timeout = float(os.environ.get("MONKEY_TIMEOUT", "4.0" if _monkey_device == "cpu" else "60.0"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_do_generate)
        try:
            output_ids = future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            raise TimeoutError(
                f"MonkeyOCRv2 vượt quá ngưỡng thời gian {timeout}s trên {_monkey_device}. "
                "Tự động kích hoạt PaddleOCR fallback để đảm bảo SLA < 10s."
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


# ═══════════════════════════════════════════════════════════════
# TỪ ĐIỂN CHUẨN HÓA CHÍNH TẢ HÀNH CHÍNH - QUÂN SỰ QK7 (VIETNAMESE LEXICON)
# Khôi phục dấu tiếng Việt và chuẩn hóa thuật ngữ quân đội bị nhiễu khi scan/mộc đỏ
# ═══════════════════════════════════════════════════════════════
_VIETNAMESE_MILITARY_LEXICON: List[Tuple[re.Pattern, str]] = [
    # Quốc hiệu, Tiêu ngữ, Đảng hiệu
    (re.compile(r"\bĐ[ẢAĂÂ]?NG\s+C[ỘOỌÔ]?NG\s+S[ẢAĂ]?N\s+VI[ỆEÊ]?T\s+NAM\b", re.IGNORECASE), "ĐẢNG CỘNG SẢN VIỆT NAM"),
    (re.compile(r"\bC[ỘOỌÔ]?NG\s+H[ÒOỌ]A\s+X[ÃA]\s+H[ỘOỌÔ]?I\s+CH[ỦU]\s+NGH[ĨI]A\s+VI[ỆEÊ]?T\s+NAM\b", re.IGNORECASE), "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"),
    (re.compile(r"\bĐ[ộo]c\s+l[ậa]p\s*[-–—]\s*T[ựu]\s+do\s*[-–—]\s*H[ạa]nh\s+ph[úu]c\b", re.IGNORECASE), "Độc lập - Tự do - Hạnh phúc"),
    # Cơ quan, đơn vị Quân khu 7 & Trường Quân sự
    (re.compile(r"\bĐ[ẢAĂÂ]?NG\s+B[ỘOỌÔ]?\s+QU[ÂAĂ]?N\s+KHU\s*7\b", re.IGNORECASE), "ĐẢNG BỘ QUÂN KHU 7"),
    (re.compile(r"\bB[ỘOỌÔ]?\s+T[ƯU]\s+L[ỆEÊ]?NH\s+QU[ÂAĂ]?N\s+KHU\s*7\b", re.IGNORECASE), "BỘ TƯ LỆNH QUÂN KHU 7"),
    (re.compile(r"\bQU[ÂAĂ]?N\s+KHU\s*7\b"), "QUÂN KHU 7"),
    (re.compile(r"\bĐ[ẢAĂÂ]?NG\s+[ỦUỶY]?\s+TR[ƯU][ỜOÒ]NG\s+QU[ÂAĂ]?N\s+S[ỰU]\b", re.IGNORECASE), "ĐẢNG ỦY TRƯỜNG QUÂN SỰ"),
    (re.compile(r"\bTR[ƯU][ỜOÒ]NG\s+QU[ÂAĂ]?N\s+S[ỰU]\s+QU[ÂAĂ]?N\s+KHU\s*7\b", re.IGNORECASE), "TRƯỜNG QUÂN SỰ QUÂN KHU 7"),
    (re.compile(r"\bTR[ƯU][ỜOÒ]NG\s+QU[ÂAĂ]?N\s+S[ỰU]\b"), "TRƯỜNG QUÂN SỰ"),
    (re.compile(r"\bTh[àa]nh\s+ph[ốoóò]\s+H[ồoò]\s+Ch[íi]\s+Minh\b", re.IGNORECASE), "Thành phố Hồ Chí Minh"),
    # Tên loại văn bản hành chính - quân sự (in hoa đầu dòng)
    (re.compile(r"^\s*K[ẾEÊ]?\s+HO[ẠA]CH\s*$"), "KẾ HOẠCH"),
    (re.compile(r"^\s*QUY[ẾEÊ]?T\s+Đ[ỊI]NH\s*$"), "QUYẾT ĐỊNH"),
    (re.compile(r"^\s*NGH[ỊI]\s+QUY[ẾEÊ]?T\s*$"), "NGHỊ QUYẾT"),
    (re.compile(r"^\s*CH[ỈI]\s+TH[ỊI]\s*$"), "CHỈ THỊ"),
    (re.compile(r"^\s*B[ÁA]O\s+C[ÁA]O\s*$"), "BÁO CÁO"),
    (re.compile(r"^\s*T[ỜO]\s+TR[ÌI]NH\s*$"), "TỜ TRÌNH"),
    (re.compile(r"^\s*TH[ÔO]NG\s+B[ÁA]O\s*$"), "THÔNG BÁO"),
    (re.compile(r"^\s*H[ƯU][ỚO]NG\s+D[ẪA]N\s*$"), "HƯỚNG DẪN"),
    (re.compile(r"^\s*C[ÔO]NG\s+V[ĂA]N\s*$"), "CÔNG VĂN"),
    (re.compile(r"^\s*QUY\s+CH[ẾEÊ]?\s*$"), "QUY CHẾ"),
    (re.compile(r"^\s*QUY\s+Đ[ỊI]NH\s*$"), "QUY ĐỊNH"),
    (re.compile(r"^\s*CH[ƯU][ƠO]NG\s+TR[ÌI]NH\s*$"), "CHƯƠNG TRÌNH"),
    # Đề mục & Thể thức ký duyệt
    (re.compile(r"\bN[ỘOỌQ]I\s+DUNG\b"), "NỘI DUNG"),
    (re.compile(r"\bTH[ỬUÚỨ]\s*'\s*NGHI[ỆEÊ]?M\b|\bTH[ỬUÚỨ]\s+NGHI[ỆEÊ]?M\b"), "THỬ NGHIỆM"),
    (re.compile(r"\bT/M\s+BAN\s+TH[ƯU][ỜOÒ'\s]*NG\s+V[ỤU]?\b", re.IGNORECASE), "T/M BAN THƯỜNG VỤ"),
    (re.compile(r"\bTM\.?\s+BAN\s+TH[ƯU][ỜOÒ'\s]*NG\s+V[ỤU]?\b", re.IGNORECASE), "TM. BAN THƯỜNG VỤ"),
    (re.compile(r"\bBAN\s+TH[ƯU][ỜOÒ'\s]*NG\s+V[ỤU]\b"), "BAN THƯỜNG VỤ"),
    (re.compile(r"\bB[ÍI]\s+TH[ƯUÚ]'?\b"), "BÍ THƯ"),
    (re.compile(r"\bPH[ÓO]\s+B[ÍI]\s+TH[ƯUÚ]'?\b"), "PHÓ BÍ THƯ"),
    (re.compile(r"\bHI[ỆEÊ]?U\s+TR[ƯU][ỞO]NG\b"), "HIỆU TRƯỞNG"),
    (re.compile(r"\bCH[ÍI]NH\s+[ỦUỶY]\b"), "CHÍNH ỦY"),
    (re.compile(r"\bN[ơo]i\s+nh[ậa]n\s*:", re.IGNORECASE), "Nơi nhận:"),
    (re.compile(r"\bK[íi]nh\s+g[ửu]i\s*:", re.IGNORECASE), "Kính gửi:"),
    # Cụm từ chuyên ngành & đơn vị trực thuộc
    (re.compile(r"\bTh[ưưu][ờo]ng\s+v[ụu]\s+ĐUQK\b", re.IGNORECASE), "Thường vụ ĐUQK"),
    (re.compile(r"\bC[ụu]c\s+Ch[íi]nh\s+tr[ịi]\b", re.IGNORECASE), "Cục Chính trị"),
    (re.compile(r"\bB[ộo]\s+Tham\s+m[ưu]u\b", re.IGNORECASE), "Bộ Tham mưu"),
    (re.compile(r"\bC[ụu]c\s+H[ậa]u\s+c[ầa]n\s*[-–]\s*K[ỹy]\s+thu[ậa]t\b", re.IGNORECASE), "Cục Hậu cần - Kỹ thuật"),
    (re.compile(r"\bchuyn\s+đ[ổo]i\s+s[ốo]?\b|\bchuy[ểe]n\s+đ[ổo]i\s+s[ốo]?\b", re.IGNORECASE), "chuyển đổi số"),
    (re.compile(r"\bĐ[ảa]ng\s+b[ộo]\s+Nh[àa]\s+tr[ưưu][ờo]ng\b", re.IGNORECASE), "Đảng bộ Nhà trường"),
    (re.compile(r"\(\s*đ[ểe]\s+b/c\s*\)", re.IGNORECASE), "(để b/c)"),
]


def _correct_vietnamese_military_text(text: str) -> str:
    """
    Chuẩn hóa Unicode NFC và áp dụng Từ điển Chính tả Hành chính - Quân sự QK7
    cho từng dòng văn bản sau OCR.
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    corrected_lines: List[str] = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        # Loại bỏ dấu nháy đơn rác do OCR nhầm râu chữ Ư/Ơ (ví dụ: TRU'ỜNG -> TRƯỜNG, BÍ THU' -> BÍ THƯ)
        s = re.sub(r"([UuƯưOoƠơ])'", r"\1", s)
        for pattern, replacement in _VIETNAMESE_MILITARY_LEXICON:
            s = pattern.sub(replacement, s)
        corrected_lines.append(s)
    return "\n".join(corrected_lines)


def _crop_polygon_to_pil(img_np: np.ndarray, poly: Any, pad_x: int = 4, pad_y: int = 3) -> Optional[Image.Image]:
    """
    Cắt và nắn thẳng (perspective transform) vùng dòng chữ 4 đỉnh từ ảnh gốc
    kèm đệm biên (padding) để không mất dấu mũ/dấu nặng tiếng Việt.
    """
    try:
        pts = np.array(poly, dtype=np.float32)
        if pts.shape != (4, 2):
            x_min = max(0, int(np.min(pts[:, 0])) - pad_x)
            y_min = max(0, int(np.min(pts[:, 1])) - pad_y)
            x_max = min(img_np.shape[1], int(np.max(pts[:, 0])) + pad_x)
            y_max = min(img_np.shape[0], int(np.max(pts[:, 1])) + pad_y)
            if x_max <= x_min or y_max <= y_min:
                return None
            return Image.fromarray(img_np[y_min:y_max, x_min:x_max])

        # Mở rộng nhẹ 4 đỉnh ra ngoài để giữ nguyên vẹn dấu tiếng Việt (Ấ, Ể, Ộ, Ự...)
        h_img, w_img = img_np.shape[:2]
        pts[0, 0] = max(0, pts[0, 0] - pad_x)
        pts[0, 1] = max(0, pts[0, 1] - pad_y)
        pts[1, 0] = min(w_img, pts[1, 0] + pad_x)
        pts[1, 1] = max(0, pts[1, 1] - pad_y)
        pts[2, 0] = min(w_img, pts[2, 0] + pad_x)
        pts[2, 1] = min(h_img, pts[2, 1] + pad_y)
        pts[3, 0] = max(0, pts[3, 0] - pad_x)
        pts[3, 1] = min(h_img, pts[3, 1] + pad_y)

        crop_w = int(max(np.linalg.norm(pts[0] - pts[1]), np.linalg.norm(pts[2] - pts[3])))
        crop_h = int(max(np.linalg.norm(pts[0] - pts[3]), np.linalg.norm(pts[1] - pts[2])))
        if crop_w < 4 or crop_h < 4:
            return None

        dst_pts = np.array(
            [[0, 0], [crop_w, 0], [crop_w, crop_h], [0, crop_h]],
            dtype=np.float32,
        )
        matrix = cv2.getPerspectiveTransform(pts, dst_pts)
        warped = cv2.warpPerspective(
            img_np,
            matrix,
            (crop_w, crop_h),
            borderMode=cv2.BORDER_REPLICATE,
            flags=cv2.INTER_CUBIC,
        )
        if crop_h > crop_w * 1.8:
            warped = np.rot90(warped)
        return Image.fromarray(warped)
    except Exception:
        return None


def _ocr_with_paddle(pil_image: Image.Image) -> Tuple[str, float]:
    """
    Hybrid OCR chuyên biệt Tiếng Việt:
      - Bước 1: Dùng PaddleOCR (PP-OCRv5_mobile_det trên GPU CUDA 11.8) để phát hiện tọa độ các hộp chữ.
      - Bước 2: Dùng VietOCR (vgg_seq2seq, 229 ký tự Quốc ngữ đủ 100% dấu) để nhận dạng từng hộp chữ.
      - Bước 3: Sắp xếp thứ tự đọc 2 cột hành chính và chuẩn hóa qua Từ điển Chính tả Quân sự QK7.
    Trả về: (text, avg_confidence)
    """
    if _paddle_engine is None:
        raise RuntimeError("PaddleOCR engine chưa được khởi tạo!")

    img_np = np.array(pil_image)
    boxes_with_text = []

    if hasattr(_paddle_engine, "predict"):
        # PaddleOCR 3.x (PaddleX backend + PaddlePaddle 3.3.x)
        results = list(_paddle_engine.predict(img_np))
        if results:
            res0 = results[0]
            rec_texts = res0.get("rec_texts", []) if hasattr(res0, "get") else getattr(res0, "rec_texts", [])
            rec_scores = res0.get("rec_scores", []) if hasattr(res0, "get") else getattr(res0, "rec_scores", [])
            rec_polys = res0.get("rec_polys", None) if hasattr(res0, "get") else getattr(res0, "rec_polys", None)
            if rec_polys is None:
                rec_polys = res0.get("dt_polys", []) if hasattr(res0, "get") else getattr(res0, "dt_polys", [])

            raw_entries = []
            for poly, txt, score in zip(rec_polys, rec_texts, rec_scores):
                pts = poly.tolist() if hasattr(poly, "tolist") else poly
                raw_entries.append((pts, str(txt), float(score)))

            # Nếu VietOCR sẵn sàng -> nhận dạng lại các hộp chữ bằng bộ từ vựng Quốc ngữ 229 ký tự
            if _vietocr_predictor is not None and raw_entries:
                crops: List[Image.Image] = []
                valid_indices: List[int] = []
                for idx, (pts, _, _) in enumerate(raw_entries):
                    crop_pil = _crop_polygon_to_pil(img_np, pts)
                    if crop_pil is not None:
                        crops.append(crop_pil)
                        valid_indices.append(idx)

                if crops:
                    try:
                        vi_texts, vi_probs = _vietocr_predictor.predict_batch(crops, return_prob=True)
                        for idx, vi_txt, vi_prob in zip(valid_indices, vi_texts, vi_probs):
                            pts, fallback_txt, fallback_score = raw_entries[idx]
                            clean_vi = str(vi_txt).strip()
                            prob_val = float(vi_prob) if vi_prob is not None else fallback_score
                            if clean_vi:
                                raw_entries[idx] = (pts, clean_vi, prob_val)
                    except Exception as vi_err:
                        logger.warning(f"[VietOCR] Batch predict lỗi, fallback từng dòng: {vi_err}")
                        for idx, crop_pil in zip(valid_indices, crops):
                            try:
                                vi_txt, vi_prob = _vietocr_predictor.predict(crop_pil, return_prob=True)
                                clean_vi = str(vi_txt).strip()
                                if clean_vi:
                                    pts, _, _ = raw_entries[idx]
                                    raw_entries[idx] = (pts, clean_vi, float(vi_prob))
                            except Exception:
                                pass

            for pts, txt, score in raw_entries:
                boxes_with_text.append((pts, (txt, score)))
    else:
        # PaddleOCR 2.x legacy fallback
        ocr_res = _paddle_engine.ocr(img_np, cls=True)
        if ocr_res and len(ocr_res) > 0 and ocr_res[0]:
            boxes_with_text = ocr_res[0]

    if boxes_with_text:
        sorted_lines, flat_items = _sort_reading_order(boxes_with_text)
        raw_page_text = "\n".join(sorted_lines)
        page_text = _correct_vietnamese_military_text(raw_page_text)
        avg_conf = (
            sum(it["score"] for it in flat_items) / len(flat_items)
            if flat_items else 0.0
        )
    else:
        page_text = ""
        avg_conf = 0.0

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

        # ── 2-4. Thực thi render + OCR trong threadpool để không block Event Loop FastAPI ──
        def _process_pdf_sync() -> Tuple[int, List[int], List[PageOcrResult], List[str], str]:
            doc = pymupdf.open(stream=content, filetype="pdf")
            try:
                total_pages_local = len(doc)
                pages_to_process_local = _parse_pages_param(pages, total_pages_local)
                logger.info(
                    f"[OCR] Engine={engine}, {len(pages_to_process_local)} trang cần xử lý: {pages_to_process_local}"
                )

                page_results_local: List[PageOcrResult] = []
                all_text_blocks_local: List[str] = []
                effective_engine_local = engine

                for p_num in pages_to_process_local:
                    p_idx = p_num - 1
                    t_page = time.time()

                    try:
                        pil_img = _render_page_to_image(doc, p_idx, dpi)
                    except Exception as render_err:
                        logger.error(f"[OCR] Render trang {p_num} lỗi: {render_err}")
                        continue

                    page_text = ""
                    avg_conf = 0.0
                    engine_used = engine

                    if engine == "monkey":
                        # Nếu chạy CPU và không ép MONKEY_FORCE_CPU_OCR=1 -> chuyển trực tiếp sang PaddleOCR đã pre-warm
                        if _monkey_device == "cpu" and os.environ.get("MONKEY_FORCE_CPU_OCR") != "1":
                            if _load_paddle(set_active=False):
                                try:
                                    page_text, avg_conf = _ocr_with_paddle(pil_img)
                                    engine_used = "paddleocr_fallback"
                                except Exception as pad_err:
                                    logger.error(f"[PaddleOCR fallback] Trang {p_num} lỗi: {pad_err}")
                            else:
                                logger.error(f"[OCR] Trang {p_num}: không khởi tạo được PaddleOCR fallback")
                        else:
                            try:
                                raw_md, avg_conf = _ocr_with_monkey(pil_img)
                                page_text = _markdown_to_plain(raw_md)
                            except Exception as mono_err:
                                logger.warning(
                                    f"[MonkeyOCRv2] Trang {p_num} lỗi: {mono_err}. "
                                    "Thử PaddleOCR fallback..."
                                )
                                if _load_paddle(set_active=False):
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

                    effective_engine_local = engine_used
                    elapsed_page = round(time.time() - t_page, 2)
                    lines_list = [l for l in page_text.splitlines() if l.strip()]

                    logger.info(
                        f"[OCR] Trang {p_num}: {len(lines_list)} dòng, "
                        f"conf={avg_conf:.3f}, engine={engine_used}, {elapsed_page}s"
                    )

                    page_results_local.append(PageOcrResult(
                        page=p_num,
                        text=page_text,
                        lines=lines_list,
                        line_count=len(lines_list),
                        confidence_avg=round(avg_conf, 3),
                        engine_used=engine_used,
                    ))
                    all_text_blocks_local.append(page_text)
                    del pil_img

                return (
                    total_pages_local,
                    pages_to_process_local,
                    page_results_local,
                    all_text_blocks_local,
                    effective_engine_local,
                )
            finally:
                doc.close()
                gc.collect()
                # Giải phóng VRAM GPU tồn dư sau mỗi phiên OCR để nhường bộ nhớ cho Ollama AI Boxchat
                try:
                    import paddle  # pyright: ignore[reportMissingImports] # type: ignore
                    if paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0:
                        paddle.device.cuda.empty_cache()
                except Exception:
                    pass

        (
            total_pages,
            pages_to_process,
            page_results,
            all_text_blocks,
            effective_engine,
        ) = await run_in_threadpool(_process_pdf_sync)

        elapsed      = round(time.time() - t0, 2)
        combined     = "\n\n".join(b for b in all_text_blocks if b)

        logger.info(
            f"[OCR] ✅ Hoàn tất {len(pages_to_process)} trang "
            f"({len(combined)} ký tự, engine={effective_engine}) trong {elapsed}s"
        )

        return OcrExtractResponse(
            success=True,
            total_pages=total_pages,
            pages_processed=pages_to_process,
            results=page_results,
            combined_text=combined,
            elapsed_seconds=elapsed,
            engine_used=effective_engine,
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
# GET /api/ocr/weights-status — Trạng thái trọng số Air-Gapped
# ═══════════════════════════════════════════════════════════════
@app.get("/api/ocr/weights-status")
def weights_status():
    """Kiểm tra sự tồn tại và tính sẵn sàng của weights trong môi trường Air-Gapped."""
    det_dir = os.path.join(LOCAL_PADDLE_DIR, "det", "en_PP-OCRv3_det_infer")
    rec_dir = os.path.join(LOCAL_PADDLE_DIR, "rec", "latin_PP-OCRv3_rec_infer")
    cls_dir = os.path.join(LOCAL_PADDLE_DIR, "cls", "ch_ppocr_mobile_v2.0_cls_infer")
    v5_mobile_det_dir = os.path.join(LOCAL_PADDLEX_CACHE, "official_models", "PP-OCRv5_mobile_det")
    v5_server_det_dir = os.path.join(LOCAL_PADDLEX_CACHE, "official_models", "PP-OCRv5_server_det")
    v5_rec_dir = os.path.join(LOCAL_PADDLEX_CACHE, "official_models", "latin_PP-OCRv5_mobile_rec")
    paddle_v3_complete = os.path.isdir(det_dir) and os.path.isdir(rec_dir) and os.path.isdir(cls_dir)
    paddle_v5_complete = (os.path.isdir(v5_mobile_det_dir) or os.path.isdir(v5_server_det_dir)) and os.path.isdir(v5_rec_dir)
    paddle_complete = paddle_v5_complete or paddle_v3_complete

    monkey_safetensors = os.path.join(LOCAL_MODEL_DIR, "model.safetensors")
    monkey_complete = os.path.isdir(LOCAL_MODEL_DIR) and os.path.isfile(monkey_safetensors)

    return {
        "status": "ok",
        "air_gapped_ready": monkey_complete and paddle_complete,
        "engine_active": _active_engine or "not_loaded",
        "monkey": {
            "model_id": MONKEY_MODEL_ID,
            "is_local_path": os.path.isdir(MONKEY_MODEL_ID),
            "local_dir": LOCAL_MODEL_DIR,
            "exists": monkey_complete,
            "safetensors_present": os.path.isfile(monkey_safetensors),
            "loaded": _monkey_model is not None,
            "device": _monkey_device or "n/a",
        },
        "paddleocr": {
            "local_dir": LOCAL_PADDLE_DIR,
            "exists": paddle_complete,
            "det_exists": os.path.isdir(det_dir),
            "rec_exists": os.path.isdir(rec_dir),
            "cls_exists": os.path.isdir(cls_dir),
            "loaded": _paddle_engine is not None,
        },
    }


# ═══════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=False,
        workers=1,
        log_level="info",
    )
