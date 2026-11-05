#!/usr/bin/env python3
"""
QK7 DataHub - Script tải trọng số mô hình MonkeyOCRv2
Hỗ trợ 2 nguồn tải: Hugging Face và ModelScope (tối ưu cho mạng nội bộ/proxy)
Lưu mặc định vào: ./model_weight/MonkeyOCRv2-B-Parsing
"""

import os
import sys
import argparse

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

DEFAULT_REPO_HF = "zenosai/MonkeyOCRv2-B-Parsing"
DEFAULT_REPO_MODELSCOPE = "zenosai/MonkeyOCRv2-B-Parsing"
ALT_REPO_HF = "Yuliang-Liu/MonkeyOCRv2-B-Parsing"

TARGET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_weight", "MonkeyOCRv2-B-Parsing")

def download_from_huggingface(repo_id: str, local_dir: str) -> bool:
    print(f"\n[Hugging Face] Đang kết nối tải trọng số từ: '{repo_id}'...")
    print(f"[Hugging Face] Thư mục lưu đích: {local_dir}")
    try:
        from huggingface_hub import snapshot_download  # pyright: ignore[reportMissingImports] # type: ignore
        downloaded_path = snapshot_download(
            repo_id=repo_id,
            local_dir=local_dir,
        )
        print(f"\n✅ Tải thành công từ Hugging Face vào: {downloaded_path}")
        return True
    except ImportError:
        print("❌ Thư viện 'huggingface_hub' chưa được cài đặt. Đang tự động cài đặt...")
        os.system(f"{sys.executable} -m pip install huggingface_hub")
        try:
            from huggingface_hub import snapshot_download  # pyright: ignore[reportMissingImports] # type: ignore
            downloaded_path = snapshot_download(
                repo_id=repo_id,
                local_dir=local_dir,
            )
            print(f"\n✅ Tải thành công từ Hugging Face vào: {downloaded_path}")
            return True
        except Exception as e:
            print(f"❌ Không thể tải từ repo {repo_id}: {e}")
            return False
    except Exception as e:
        print(f"❌ Lỗi khi tải từ Hugging Face: {e}")
        return False

def download_from_modelscope(repo_id: str, local_dir: str) -> bool:
    print(f"\n[ModelScope] Đang kết nối tải trọng số từ: '{repo_id}'...")
    print(f"[ModelScope] Thư mục lưu đích: {local_dir}")
    try:
        from modelscope import snapshot_download  # pyright: ignore[reportMissingImports] # type: ignore
        downloaded_path = snapshot_download(
            model_id=repo_id,
            local_dir=local_dir,
        )
        print(f"\n✅ Tải thành công từ ModelScope vào: {downloaded_path}")
        return True
    except ImportError:
        print("❌ Thư viện 'modelscope' chưa được cài đặt. Đang tự động cài đặt...")
        os.system(f"{sys.executable} -m pip install modelscope")
        try:
            from modelscope import snapshot_download  # pyright: ignore[reportMissingImports] # type: ignore
            downloaded_path = snapshot_download(
                model_id=repo_id,
                local_dir=local_dir,
            )
            print(f"\n✅ Tải thành công từ ModelScope vào: {downloaded_path}")
            return True
        except Exception as e:
            print(f"❌ Không thể tải từ ModelScope: {e}")
            return False
    except Exception as e:
        print(f"❌ Lỗi khi tải từ ModelScope: {e}")
        return False

def verify_model(local_dir: str) -> bool:
    print(f"\n[Kiểm tra] Thử nghiệm nạp model từ: {local_dir}...")
    try:
        from transformers import AutoModel, AutoProcessor  # pyright: ignore[reportMissingImports] # type: ignore
        print("Đang nạp processor...")
        processor = AutoProcessor.from_pretrained(local_dir, trust_remote_code=True)
        print("Đang nạp model weights...")
        model = AutoModel.from_pretrained(local_dir, trust_remote_code=True, device_map="auto")
        del processor, model
        print("\n🎉 Model MonkeyOCRv2 nạp thành công vào bộ nhớ!")
        return True
    except ImportError:
        print("⚠️ Ghi chú: Thư viện 'transformers' chưa được cài đặt trong môi trường Python hiện tại.")
        print("   Vui lòng chạy 'fix_torch.bat' trong thư mục ocr-service để cài đặt torch & transformers.")
        return False
    except Exception as e:
        print(f"⚠️ Cảnh báo khi nạp thử model: {e}")
        return False

def main() -> None:
    parser = argparse.ArgumentParser(description="Tải trọng số mô hình MonkeyOCRv2 cho QK7 DataHub")
    parser.add_argument("-s", "--source", choices=["huggingface", "modelscope", "auto"], default="auto",
                        help="Nguồn tải (mặc định: auto - thử Hugging Face trước, fallback sang ModelScope)")
    parser.add_argument("-n", "--name", default=DEFAULT_REPO_HF,
                        help=f"Tên repo (mặc định: {DEFAULT_REPO_HF})")
    parser.add_argument("-d", "--dest", default=TARGET_DIR,
                        help=f"Thư mục lưu mô hình (mặc định: {TARGET_DIR})")
    parser.add_argument("--verify", action="store_true", help="Kiểm tra nạp model sau khi tải xong")

    args = parser.parse_args()

    os.makedirs(args.dest, exist_ok=True)

    success = False
    if args.source == "huggingface":
        success = download_from_huggingface(args.name, args.dest)
        if not success and args.name == DEFAULT_REPO_HF:
            print(f"Thử lại với repo dự phòng: {ALT_REPO_HF}...")
            success = download_from_huggingface(ALT_REPO_HF, args.dest)
    elif args.source == "modelscope":
        success = download_from_modelscope(DEFAULT_REPO_MODELSCOPE, args.dest)
    else:  # auto
        print("Chế độ 'auto': Thử tải qua Hugging Face trước...")
        success = download_from_huggingface(args.name, args.dest)
        if not success:
            print("\nKhông thể tải qua Hugging Face. Chuyển sang nguồn thay thế: ModelScope...")
            success = download_from_modelscope(DEFAULT_REPO_MODELSCOPE, args.dest)

    if success:
        print("\n=======================================================")
        print("  HOÀN TẤT: Trọng số mô hình đã được tải về thành công!")
        print(f"  Đường dẫn: {os.path.abspath(args.dest)}")
        print("=======================================================")
        if args.verify:
            verify_model(args.dest)
    else:
        print("\n❌ Không thể tải trọng số mô hình từ các nguồn. Vui lòng kiểm tra lại kết nối mạng.")
        sys.exit(1)

if __name__ == "__main__":
    main()
