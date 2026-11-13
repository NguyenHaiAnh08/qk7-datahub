# Hướng Dẫn Thiết Lập Môi Trường & Cài Đặt MonkeyOCRv2
**Dự án:** QK7 DataHub — OCR Microservice v2.0  
**Tài liệu kỹ thuật:** Setup Environment & Model Deployment Guide  
**Mục tiêu:** Cài đặt môi trường Python, mô hình MonkeyOCRv2 (hỗ trợ phân tích layout, chữ viết scan, mộc đỏ, đa cột) cho hệ thống đọc PDF tự động điền form.

---

## 1. Yêu Cầu Hệ Thống

| Thành phần | Yêu cầu tối thiểu | Khuyến nghị (Production) |
| :--- | :--- | :--- |
| **Hệ điều hành** | Windows 10/11 (64-bit), Windows Server 2019/2022, Linux (Ubuntu 20.04/22.04 LTS) | Windows Server hoặc Ubuntu 22.04 LTS |
| **Python** | 3.10 | **3.11** (khuyến nghị cho độ tương thích cao nhất với PyTorch, transformers & vLLM) |
| **RAM** | 8 GB | **16 GB – 32 GB** (khi chạy suy luận trên CPU) |
| **CPU** | 4 Cores (x86_64 / AVX2) | 8 Cores trở lên |
| **GPU (Tùy chọn)** | Không bắt buộc (có thể chạy CPU) | NVIDIA GPU (VRAM $\ge$ 8GB, ví dụ RTX 3060/4060, RTX A4000, T4, A10) |
| **Dung lượng ổ đĩa** | Trống tối thiểu 10 GB (Model weights $\approx$ 2.5 GB - 3.5 GB + dependencies) | SSD NVMe tốc độ cao |

---

## 2. Quy Trình Cài Đặt Môi Trường (Conda)

### Bước 1: Tạo môi trường Conda với Python 3.11
Mở **Anaconda Prompt** (Windows) hoặc terminal (Linux) và chạy lệnh:

```bash
conda create -n MonkeyOCRv2Parsing python=3.11 -y
conda activate MonkeyOCRv2Parsing
```

---

### Bước 2: Cài đặt PyTorch

> **Lưu ý quan trọng:** Cần cài đặt PyTorch phù hợp với phần cứng trước khi cài đặt các thư viện khác.

#### Trường hợp 1: Máy chủ có GPU NVIDIA (CUDA 12.6 / 12.x) — Đã kiểm thử chuẩn trên Server-Online (RTX 2060 6GB)
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
```
*(Lệnh trên tự động lấy bản PyTorch CUDA 12.6 tương thích tối ưu với phiên bản Python trên máy chủ, ví dụ: `2.14.1+cu126` trên Python 3.13)*

#### Trường hợp 2: Máy chủ chỉ chạy CPU (Không có card đồ họa rời)
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

---

### Bước 3: Cài đặt các thư viện phụ thuộc

Cài đặt các gói cốt lõi cho MonkeyOCRv2 và xử lý tài liệu đa phương tiện:

```bash
# 1. Các thư viện mô hình Vision-Language
pip install transformers==4.57.1 accelerate==1.11.0 qwen_vl_utils==0.0.14

# 2. Xử lý ảnh, tokenization và layout
pip install opencv-python einops pypdfium2 gradio pillow sentencepiece

# 3. Phục vụ Microservice FastAPI & xử lý PDF
pip install fastapi>=0.110.0 uvicorn>=0.28.0 python-multipart>=0.0.9 pymupdf>=1.24.0

# 4. Engine dự phòng PaddleOCR (Fallback khi cần)
pip install paddlepaddle==2.6.2 paddleocr==2.9.1 opencv-python-headless
```

Hoặc cài nhanh toàn bộ từ file `requirements.txt`:
```bash
pip install -r requirements.txt
```

---

### Bước 4: (Tùy chọn) Cài đặt vLLM để tăng tốc suy luận (Chỉ dành cho GPU)
Nếu máy chủ có GPU NVIDIA hỗ trợ, có thể cài đặt **vLLM** để tăng tốc độ phân tích văn bản lên gấp 3–5 lần:

```bash
pip install vllm==0.11.2
```
*(Nếu chạy trên CPU, bỏ qua bước này)*

---

## 3. Tải Trọng Số Mô Hình (Model Weights)

Thư mục lưu trữ khuyến nghị trong dự án: `ocr-service/model_weight/MonkeyOCRv2-B-Parsing`

### Cách 1: Tải trực tiếp bằng `huggingface_hub` (Khuyến nghị, nhanh và đơn giản nhất)
Chạy script Python 1 dòng lệnh để tải trọn bộ trọng số:

```python
python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='zenosai/MonkeyOCRv2-B-Parsing', local_dir='./model_weight/MonkeyOCRv2-B-Parsing')"
```
*Hoặc nếu dùng model repo của tác giả:*
```python
python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Yuliang-Liu/MonkeyOCRv2-B-Parsing', local_dir='./model_weight/MonkeyOCRv2-B-Parsing')"
```

---

### Cách 2: Tải từ ModelScope (Tối ưu cho mạng nội bộ / Mạng có proxy Việt Nam)
Nếu kết nối tới Hugging Face bị chậm hoặc bị chặn trong mạng quân sự/nội bộ, ModelScope là lựa chọn thay thế cực kỳ ổn định:

```bash
pip install modelscope
```
Sau đó chạy lệnh:
```bash
python -c "from modelscope import snapshot_download; snapshot_download('zenosai/MonkeyOCRv2-B-Parsing', local_dir='./model_weight/MonkeyOCRv2-B-Parsing')"
```

---

### Cách 3: Sử dụng script tự động hóa `download_model.py` có sẵn trong thư mục
Trong thư mục `ocr-service`, chúng tôi đã đóng gói sẵn script tải model thông minh:

```bash
# Tải qua Hugging Face (mặc định)
python download_model.py

# Hoặc tải qua ModelScope
python download_model.py --source modelscope
```

---

## 4. Kiểm Tra Cài Đặt (Verification) & Khắc Phục Lỗi Nhanh

### 4.1. Chạy script kiểm tra môi trường tự động
Để kiểm tra trạng thái toàn diện (Python runtime, PyTorch, Transformers, PaddleOCR, thư mục trọng số):

```bash
python check_environment.py
```

### 4.2. Khắc phục nhanh lỗi thiếu PyTorch / Transformers (1-Click Fix)
Nếu log báo `[MonkeyOCRv2] ❌ Thiếu package (torch / transformers)`:
- **Trên Windows:** Chỉ cần nhấp đúp hoặc chạy file:
  ```bat
  fix_torch.bat
  ```
  File này sẽ tự động tải và cấu hình PyTorch CPU (`2.5.1+cpu`), `transformers==4.57.1`, `accelerate==1.11.0`, `qwen_vl_utils==0.0.14` vào môi trường ảo hiện tại.

### 4.3. Kiểm tra nạp mô hình vào bộ nhớ (Verification thủ công)
Sau khi tải xong trọng số mô hình, thực hiện kiểm tra nạp mô hình vào bộ nhớ:

```bash
python -c "from transformers import AutoModel; model = AutoModel.from_pretrained('./model_weight/MonkeyOCRv2-B-Parsing', trust_remote_code=True, device_map='auto'); print('>>> MonkeyOCRv2 Model loaded successfully!')"
```

Nếu màn hình xuất hiện thông báo:
```text
>>> MonkeyOCRv2 Model loaded successfully!
```
Nghĩa là môi trường và trọng số đã hoàn toàn sẵn sàng.

---

## 5. Khởi Động Microservice

Khởi động dịch vụ OCR trên cổng **8002**:

### Trên Windows:
```bat
start-ocr.bat
```

### Trên Linux:
```bash
chmod +x start-ocr.sh
./start-ocr.sh
```

### Kiểm tra trạng thái Microservice:
- Kiểm tra sức khỏe: `curl http://127.0.0.1:8002/health`
- Kiểm tra danh sách engine: `curl http://127.0.0.1:8002/api/ocr/engines`

---

## 6. Lưu Ý Quan Trọng Cho Triển Khai QK7 DataHub

1. **Phiên bản Python 3.11:** Đảm bảo sử dụng Python 3.11 để tránh xung đột ABI giữa C-extensions của PyMuPDF, OpenCV và PyTorch.
2. **Chế độ CPU trên máy chủ vật lý:**
   - Nếu không có GPU, thời gian xử lý 1 trang PDF scan phức tạp là khoảng 6–12 giây trên CPU Core i7/Xeon.
   - Nhờ kiến trúc không đồng bộ (Async) ở Gateway Node.js (:8000), tiến trình của người dùng khác **không bị block Event Loop**.
3. **Cơ chế Fallback nhiều tầng:**
   - Tầng 1: File số hóa (Digital) $\rightarrow$ Trích xuất text trực tiếp (< 100ms).
   - Tầng 2: File scan $\rightarrow$ MonkeyOCRv2 phân tích layout và đọc chữ.
   - Tầng 2b: Nếu MonkeyOCRv2 chưa cài xong $\rightarrow$ Tự động chuyển PaddleOCR (PP-OCRv4).
   - Tầng 2c: Nếu dịch vụ Python offline $\rightarrow$ Fallback Tesseract.js cục bộ đảm bảo không đứt gãy luồng nghiệp vụ.

