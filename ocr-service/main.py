"""
QK7 DataHub - OCR Microservice (PaddleOCR)
Port: 8002
Chuyên xử lý OCR văn bản scan, phân tích layout, xử lý ảnh nghiêng, mộc đỏ cho các tài liệu hành chính/quân sự.
"""

import os
import io
import sys
import time
import json
import logging
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymupdf
import numpy as np
from PIL import Image

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ocr-service")

app = FastAPI(
    title="QK7 DataHub - OCR Microservice",
    description="Microservice OCR sử dụng PaddleOCR cho tài liệu số QK7",
    version="1.0.0"
)

# Cho phép CORS cho Gateway (:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo PaddleOCR Engine toàn cục
ocr_engine = None

def get_ocr_engine():
    global ocr_engine
    if ocr_engine is None:
        logger.info("[OCR Engine] Khởi tạo PaddleOCR(use_angle_cls=True, lang='vi')...")
        from paddleocr import PaddleOCR
        ocr_engine = PaddleOCR(use_angle_cls=True, lang='vi', show_log=False)
        logger.info("[OCR Engine] PaddleOCR sẵn sàng!")
    return ocr_engine

@app.on_event("startup")
async def startup_event():
    logger.info("Khởi động OCR Microservice trên cổng 8002...")
    try:
        # Pre-warm OCR engine
        get_ocr_engine()
    except Exception as e:
        logger.warning(f"[OCR Engine] Cảnh báo pre-warm: {e}. Sẽ khởi tạo lại khi có request đầu tiên.")

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "ocr-service",
        "port": 8002,
        "engine": "PaddleOCR-v4",
        "lang": "vi"
    }

class PageOcrResult(BaseModel):
    page: int
    text: str
    lines: List[str]
    line_count: int
    confidence_avg: float

class OcrExtractResponse(BaseModel):
    success: bool
    total_pages: int
    pages_processed: List[int]
    results: List[PageOcrResult]
    combined_text: str
    elapsed_seconds: float
    error: Optional[str] = None

def sort_reading_order(boxes_with_text, row_tolerance_px=12):
    """
    Sắp xếp các khối văn bản theo thứ tự đọc tự nhiên (từ trên xuống dưới, từ trái sang phải).
    boxes_with_text: list of (box, (text, score))
    box: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
    """
    if not boxes_with_text:
        return []

    items = []
    for item in boxes_with_text:
        box = item[0]
        text_info = item[1]
        text = text_info[0]
        score = float(text_info[1])
        y_top = min(p[1] for p in box)
        x_left = min(p[0] for p in box)
        items.append({
            "y": y_top,
            "x": x_left,
            "text": text,
            "score": score
        })

    # Gom theo dòng (line clustering)
    items.sort(key=lambda it: it["y"])
    lines = []
    current_line = []
    current_y = None

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

    return sorted_text_lines, items

@app.post("/api/ocr/extract", response_model=OcrExtractResponse)
async def extract_ocr(
    file: UploadFile = File(...),
    pages: str = Form(default="[1]"),
    dpi: int = Form(default=150)
):
    """
    Trích xuất text từ các trang PDF được chỉ định bằng PaddleOCR
    - file: Tệp PDF
    - pages: JSON array hoặc chuỗi phân tách dấu phẩy (vd "[1,2]" hoặc "1,2" hoặc "all")
    - dpi: Độ phân giải render (mặc định 150 DPI cân bằng hoàn hảo giữa tốc độ và độ sắc nét)
    """
    t0 = time.time()
    logger.info(f"[POST /api/ocr/extract] File: {file.filename}, pages: {pages}, dpi: {dpi}")

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Tệp tải lên rỗng")

        doc = pymupdf.open(stream=content, filetype="pdf")
        total_pages = len(doc)

        # Parse danh sách trang cần OCR
        pages_to_process = []
        if pages.strip().lower() == "all":
            pages_to_process = list(range(1, total_pages + 1))
        else:
            try:
                # Thử parse JSON
                parsed_pages = json.loads(pages)
                if isinstance(parsed_pages, list):
                    pages_to_process = [int(p) for p in parsed_pages if 1 <= int(p) <= total_pages]
                elif isinstance(parsed_pages, int):
                    pages_to_process = [parsed_pages] if 1 <= parsed_pages <= total_pages else []
            except Exception:
                # Fallback parse dấu phẩy
                parts = pages.replace("[", "").replace("]", "").split(",")
                for p in parts:
                    p = p.strip()
                    if p.isdigit():
                        p_int = int(p)
                        if 1 <= p_int <= total_pages:
                            pages_to_process.append(p_int)

        if not pages_to_process:
            pages_to_process = [1] if total_pages >= 1 else []

        engine = get_ocr_engine()
        page_results = []
        all_text_blocks = []

        for p_num in pages_to_process:
            p_idx = p_num - 1
            page = doc[p_idx]
            pix = page.get_pixmap(dpi=dpi)
            img_bytes = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            img_np = np.array(img)

            ocr_res = engine.ocr(img_np, cls=True)

            if ocr_res and len(ocr_res) > 0 and ocr_res[0]:
                sorted_lines, items = sort_reading_order(ocr_res[0])
                page_text = "\n".join(sorted_lines)
                avg_conf = sum(it["score"] for it in items) / len(items) if items else 0.0
            else:
                sorted_lines = []
                page_text = ""
                avg_conf = 0.0

            page_results.append(PageOcrResult(
                page=p_num,
                text=page_text,
                lines=sorted_lines,
                line_count=len(sorted_lines),
                confidence_avg=round(avg_conf, 3)
            ))
            all_text_blocks.append(page_text)

        doc.close()
        elapsed = round(time.time() - t0, 2)
        combined_text = "\n\n".join(all_text_blocks)

        logger.info(f"[POST /api/ocr/extract] Hoàn tất {len(pages_to_process)} trang trong {elapsed}s")

        return OcrExtractResponse(
            success=True,
            total_pages=total_pages,
            pages_processed=pages_to_process,
            results=page_results,
            combined_text=combined_text,
            elapsed_seconds=elapsed,
            error=None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[POST /api/ocr/extract] Lỗi: {e}", exc_info=True)
        return OcrExtractResponse(
            success=False,
            total_pages=0,
            pages_processed=[],
            results=[],
            combined_text="",
            elapsed_seconds=round(time.time() - t0, 2),
            error=str(e)
        )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8002))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False, workers=1)

