# QK7 DataHub — OCR Microservice (:8002)

Dịch vụ trích xuất ký tự quang học (OCR) chuyên dụng phục vụ việc đọc tự động và điền form văn bản hành chính/quân sự quét scan, tích hợp PaddleOCR (PP-OCRv4) và PyMuPDF.

---

## 1. Tính Năng Chính

- **Nhận dạng tiếng Việt chính xác cao:** Sử dụng model `PP-OCRv4` kết hợp bộ phân loại góc xoay văn bản (`use_angle_cls=True`) và từ điển tiếng Việt (`lang='vi'`).
- **Phân tích bố cục văn bản hành chính:** Xử lý hiệu quả văn bản dạng 2 cột (Quốc hiệu / Cơ quan ban hành), bảng biểu, văn bản bị nghiêng hoặc có dấu mộc đỏ đè lên chữ.
- **Render ảnh siêu tốc:** Sử dụng `PyMuPDF` (fitz) viết bằng C render ảnh từ PDF trực tiếp trong bộ nhớ với độ phân giải tùy biến (150 DPI), không phụ thuộc binary Poppler ngoài.
- **Sắp xếp thứ tự đọc tự nhiên:** Tự động sắp xếp các khối chữ theo tọa độ hình học $(y, x)$, đảm bảo thứ tự đọc chuẩn xác cho văn bản hành chính.
- **Độc lập hoàn toàn:** Chạy trên tiến trình riêng biệt tại cổng `8002`, không block Event Loop của Node.js Gateway.

---

## 2. Thông Số Kỹ Thuật

| Thuộc tính | Giá trị |
| :--- | :--- |
| **Framework** | FastAPI + Uvicorn |
| **Cổng dịch vụ** | `8002` (mặc định) |
| **Engine OCR** | `paddleocr==2.9.1`, `paddlepaddle==2.6.2` |
| **Bộ render PDF** | `PyMuPDF` (fitz $\ge$ 1.24.0) |
| **Hỗ trợ định dạng** | PDF (Tất cả phiên bản, bao gồm nén JBIG2) |
| **Độ trễ xử lý trang** | ~4.5 giây / trang (trên CPU thông thường) |

---

## 3. Danh Sách Endpoint API

### `GET /health`
Kiểm tra trạng thái sẵn sàng của dịch vụ.

**Response:**
```json
{
  "status": "ok",
  "service": "ocr-service",
  "port": 8002,
  "engine": "PaddleOCR-v4",
  "lang": "vi"
}
```

### `POST /api/ocr/extract`
Trích xuất text từ các trang chỉ định của tệp PDF.

**Form Data:**
- `file`: Tệp PDF cần trích xuất (multipart/form-data).
- `pages`: Danh sách trang dạng JSON (ví dụ `"[1]"` hoặc `"[1, 2]"`) hoặc chuỗi phân tách bởi dấu phẩy `"1,2"`. Nếu để trống, mặc định xử lý trang 1.
- `dpi`: Độ phân giải render ảnh (mặc định `150`).

**Response mẫu:**
```json
{
  "success": true,
  "total_pages": 121,
  "pages_processed": [1],
  "results": [
    {
      "page": 1,
      "text": "CHÍNH PHỦ\nSố: 224/2026/NĐ-CP\nHà Nội, ngày 24 tháng 6 năm 2026\nNGHỊ ĐỊNH...",
      "line_count": 35,
      "confidence_avg": 0.954
    }
  ],
  "combined_text": "CHÍNH PHỦ\nSố: 224/2026/NĐ-CP...",
  "elapsed_seconds": 4.35,
  "error": null
}
```

---

## 4. Hướng Dẫn Cài Đặt & Vận Hành

### Cài đặt môi trường ảo (Virtualenv)
```powershell
cd d:\QK7_DataHub\qk7-datahub\ocr-service
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
```

### Khởi động dịch vụ
Chạy file batch tự động kiểm tra port và khởi động:
```powershell
.\start-ocr.bat
```
Hoặc khởi chạy thông qua `s.bat` từ thư mục gốc của dự án.

