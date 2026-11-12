#!/usr/bin/env python3
"""
QK7 DataHub - Script kiểm tra môi trường OCR Microservice
Kiểm tra chi tiết:
  1. Phiên bản Python và đường dẫn runtime
  2. Trạng thái PyTorch (torch, torchvision, CUDA availability)
  3. Trạng thái Transformers, Accelerate, Qwen_VL_Utils
  4. Trạng thái PaddleOCR & PaddlePaddle (fallback engine)
  5. Thư mục trọng số mô hình MonkeyOCRv2 (./model_weight/MonkeyOCRv2-B-Parsing)
  6. Kết luận engine sẵn sàng hoạt động (MonkeyOCRv2 vs PaddleOCR)
"""

import os
import sys
import platform

# Đảm bảo UTF-8 encoding trên Windows console (tránh cp1252 UnicodeEncodeError)
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


def print_banner(title: str):
    print("\n" + "=" * 65)
    print(f"  {title}")
    print("=" * 65)


def check_python():
    print_banner("1. MÔI TRƯỜNG PYTHON RUNTIME")
    print(f"  • Hệ điều hành      : {platform.system()} {platform.release()} ({platform.machine()})")
    print(f"  • Phiên bản Python  : {platform.python_version()}")
    print(f"  • Đường dẫn Python  : {sys.executable}")
    is_venv = hasattr(sys, "real_prefix") or (hasattr(sys, "base_prefix") and sys.base_prefix != sys.prefix)
    print(f"  • Virtual Environment: {'Đang chạy trong venv' if is_venv else 'Chạy bằng Python toàn cục (Global)'}")


def check_torch():
    print_banner("2. KIỂM TRA PYTORCH (MONKEYOCRV2 PREREQUISITE)")
    try:
        import torch  # pyright: ignore[reportMissingImports] # type: ignore
        print(f"  [OK] PyTorch đã cài đặt: phiên bản {torch.__version__}")
        cuda_avail = torch.cuda.is_available()
        print(f"  • CUDA khả dụng     : {cuda_avail}")
        if cuda_avail:
            print(f"  • Thiết bị GPU      : {torch.cuda.get_device_name(0)}")
            print(f"  • Số lượng GPU      : {torch.cuda.device_count()}")
        else:
            print("  • Chế độ vận hành   : CPU (phù hợp máy không có NVIDIA GPU)")
        return True
    except ImportError:
        print("  [CHƯA CÀI ĐẶT] ❌ Chưa tìm thấy thư viện 'torch' trong môi trường này.")
        print("  👉 Khắc phục nhanh: Chạy file 'fix_torch.bat' trong thư mục ocr-service.")
        return False


def check_transformers_stack():
    print_banner("3. KIỂM TRA TRANSFORMERS & VISION-LANGUAGE STACK")
    packages = [
        ("transformers", "Thư viện mô hình HuggingFace"),
        ("accelerate", "Thư viện tối ưu hóa nạp model"),
        ("qwen_vl_utils", "Tiện ích xử lý đa phương thái Qwen-VL"),
        ("huggingface_hub", "Client tải model từ HuggingFace"),
        ("modelscope", "Client tải model từ ModelScope"),
    ]
    all_ok = True
    for pkg_name, desc in packages:
        try:
            mod = __import__(pkg_name)
            ver = getattr(mod, "__version__", "đã cài")
            print(f"  [OK] {pkg_name:<16}: v{ver:<10} ({desc})")
        except ImportError:
            print(f"  [THIẾU] ⚠️ {pkg_name:<14}: Chưa cài đặt ({desc})")
            all_ok = False
    return all_ok


def check_paddle_stack():
    print_banner("4. KIỂM TRA PADDLEOCR STACK (FALLBACK ENGINE)")
    all_ok = True
    for pkg_name, desc in [("paddle", "PaddlePaddle Deep Learning Engine"), ("paddleocr", "PaddleOCR Engine")]:
        try:
            mod = __import__(pkg_name)
            ver = getattr(mod, "__version__", "đã cài")
            print(f"  [OK] {pkg_name:<16}: v{ver:<10} ({desc})")
        except ImportError:
            print(f"  [THIẾU] ⚠️ {pkg_name:<14}: Chưa cài đặt ({desc})")
            all_ok = False
    return all_ok


def check_model_weights():
    print_banner("5. KIỂM TRA THƯ MỤC TRỌNG SỐ MÔ HÌNH (AIR-GAPPED COMPATIBILITY)")
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # 5.1 MonkeyOCRv2
    monkey_dir = os.path.join(base_dir, "model_weight", "MonkeyOCRv2-B-Parsing")
    print(f"  [MonkeyOCRv2] Thư mục kiểm tra: {monkey_dir}")
    if not os.path.exists(monkey_dir):
        print("  [CHƯA TẢI] Thư mục trọng số MonkeyOCRv2 cục bộ chưa tồn tại.")
        print("  👉 Gợi ý: Chạy lệnh: python download_model.py để tải trọng số.")
        monkey_ok = False
    else:
        m_files = os.listdir(monkey_dir)
        print(f"  [OK] Thư mục tồn tại ({len(m_files)} tệp/thư mục)")
        has_weights = any(f.endswith(".safetensors") or f.endswith(".bin") for f in m_files)
        has_config = "config.json" in m_files
        print(f"  • Tệp cấu hình config.json  : {'Có [OK]' if has_config else 'Thiếu'}")
        print(f"  • Tệp trọng số (.safetensors): {'Có [OK]' if has_weights else 'Thiếu'}")
        monkey_ok = has_weights and has_config

    # 5.2 PaddleOCR
    paddle_dir = os.path.join(base_dir, "model_weight", "paddleocr")
    print(f"\n  [PaddleOCR] Thư mục kiểm tra: {paddle_dir}")
    if not os.path.exists(paddle_dir):
        print("  [CHƯA TẢI] Thư mục trọng số PaddleOCR cục bộ chưa tồn tại.")
        paddle_ok = False
    else:
        det_dir = os.path.join(paddle_dir, "det", "en_PP-OCRv3_det_infer")
        rec_dir = os.path.join(paddle_dir, "rec", "latin_PP-OCRv3_rec_infer")
        cls_dir = os.path.join(paddle_dir, "cls", "ch_ppocr_mobile_v2.0_cls_infer")
        det_ok = os.path.isdir(det_dir)
        rec_ok = os.path.isdir(rec_dir)
        cls_ok = os.path.isdir(cls_dir)
        print(f"  • Detection model (det)     : {'Có [OK]' if det_ok else 'Thiếu'}")
        print(f"  • Recognition model (rec_vi): {'Có [OK]' if rec_ok else 'Thiếu'}")
        print(f"  • Classification model (cls): {'Có [OK]' if cls_ok else 'Thiếu'}")
        paddle_ok = det_ok and rec_ok and cls_ok
        if paddle_ok:
            print("  [OK] Trọng số PaddleOCR đóng gói đầy đủ (Sẵn sàng Air-Gapped)")

    return monkey_ok and paddle_ok


def main():
    print_banner("QK7 DATAHUB - KIỂM TRA MÔI TRƯỜNG OCR MICROSERVICE")
    check_python()
    has_torch = check_torch()
    has_transformers = check_transformers_stack()
    has_paddle = check_paddle_stack()
    has_weights = check_model_weights()

    print_banner("TỔNG KẾT & TRẠNG THÁI KHỞI ĐỘNG HỆ THỐNG")
    if has_torch and has_transformers:
        print("  🟢 MONKEYOCRV2 ENGINE: SẴN SÀNG HOẠT ĐỘNG")
        print("     Khi khởi động (start-ocr.bat hoặc s.bat), hệ thống sẽ chạy MonkeyOCRv2.")
        if not has_weights:
            print("     (Lưu ý: Lần đầu chạy sẽ tải trọng số ~2.5GB từ Hugging Face/ModelScope)")
    else:
        print("  🟡 MONKEYOCRV2 ENGINE: CHƯA ĐỦ ĐIỀU KIỆN (Thiếu torch/transformers)")
        if has_paddle:
            print("  🟢 PADDLEOCR ENGINE   : SẴN SÀNG (Phương án Fallback tự động kích hoạt)")
            print("     Service vẫn hoạt động bình thường ở cổng 8002 và nhận dạng tiếng Việt tốt.")
        else:
            print("  🔴 CẢ 2 ENGINE ĐỀU CHƯA SẴN SÀNG")

        print("\n  👉 HƯỚNG DẪN KÍCH HOẠT MONKEYOCRV2:")
        print("     Nhấp đúp chuột chạy tệp: ocr-service\\fix_torch.bat")
        print("     Script sẽ tự động cài PyTorch CPU và transformers tương thích.")

    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()

