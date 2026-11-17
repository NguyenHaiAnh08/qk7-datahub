#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PROJECT MERGER — FULL SOURCE MODE

Gộp các file văn bản trong toàn bộ dự án thành một file TXT.
Chỉ loại trừ thư viện phụ thuộc, thư mục build/cache/VCS và file nhị phân.
Không tự cắt dòng dài, không xóa comment, không rút gọn config/schema.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

VERSION = "7.0.0"
FILE_END = "--- END OF FILE ---"

# Thư mục thường chứa thư viện bên ngoài, dependency hoặc dữ liệu build/cache.
# Có thể bổ sung bằng --exclude-dir.
DEFAULT_SKIP_DIRS = {
    ".git", ".svn", ".hg",
    "node_modules", "bower_components", "vendor",
    ".venv", "venv", "virtualenv", "env",
    "__pycache__", ".pytest_cache", ".mypy_cache",
    ".ruff_cache", ".tox", ".nox",
    "dist", "build", "out", "target",
    ".next", ".nuxt", ".output", ".angular",
    ".turbo", ".cache", "coverage",
    ".idea", ".vscode", ".gradle",
    "Pods", "Carthage",
}

# Các phần mở rộng nhị phân phổ biến. File không nằm trong danh sách vẫn
# được kiểm tra nội dung để nhận diện nhị phân trước khi đọc.
DEFAULT_SKIP_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff",
    ".webp", ".ico", ".icns",
    ".mp3", ".mp4", ".wav", ".ogg", ".flac", ".aac", ".m4a",
    ".avi", ".mov", ".mkv", ".webm",
    ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".dat",
    ".pyc", ".pyo", ".class", ".jar", ".war",
    ".db", ".sqlite", ".sqlite3",
    ".ttf", ".otf", ".woff", ".woff2", ".eot",
    ".pdf", ".psd", ".ai", ".sketch", ".fig",
    ".lockb",
}

SECRET_PATTERNS = [
    # Biến môi trường / cấu hình có tên thường dùng cho secret.
    (re.compile(
        r'(?i)\b(FP_ENC_KEY|JWT_SECRET|API_KEY|SECRET_KEY|BRIDGE_TOKEN|'
        r'FINGERPRINT_BRIDGE_TOKEN|ENCRYPTION_KEY|TOKEN_SECRET|'
        r'ACCESS_TOKEN|REFRESH_TOKEN|CLIENT_SECRET)\s*([=:]\s*)'
        r'(["\']?)([A-Za-z0-9+/=_\-\.]{12,})(["\']?)'
    ), r'\1\2\3[REDACTED]\5'),
    (re.compile(
        r'(?i)\b(password|passwd|pwd|db_password|admin_password)\s*'
        r'([=:]\s*)(["\'])([^"\']{3,})(["\'])'
    ), r'\1\2\3[REDACTED]\5'),
    (re.compile(
        r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'
        r'[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'
    ), '[PRIVATE_KEY_REDACTED]'),
    (re.compile(r'(?i)\bBearer\s+[A-Za-z0-9_\-\.]{20,}'),
     'Bearer [REDACTED]'),
]


def is_binary_file(path: Path, sample_size: int = 8192) -> bool:
    try:
        sample = path.open("rb").read(sample_size)
    except OSError:
        return True

    if not sample:
        return False
    if b"\x00" in sample:
        return True

    try:
        sample.decode("utf-8")
        return False
    except UnicodeDecodeError:
        # File có thể là văn bản ở encoding khác; kiểm tra tỷ lệ control chars.
        decoded = sample.decode("latin-1", errors="ignore")
        controls = sum(
            1 for ch in decoded
            if ord(ch) < 32 and ch not in "\n\r\t\f\b"
        )
        return controls / max(len(decoded), 1) > 0.30


def read_text(path: Path) -> str:
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "utf-16", "utf-16-le",
                     "utf-16-be", "cp1252"):
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            pass
    return raw.decode("utf-8", errors="replace")


def redact_secrets(text: str) -> str:
    for pattern, replacement in SECRET_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def is_excluded_dir(name: str, skip_dirs: set[str]) -> bool:
    lowered = name.lower()
    return (
        name in skip_dirs
        or lowered in {item.lower() for item in skip_dirs}
        or lowered.startswith(".git")
        or lowered in {"__macosx", "system volume information"}
    )


def collect_files(
    root: Path,
    output_path: Path,
    skip_dirs: set[str],
    skip_exts: set[str],
    include_hidden: bool = True,
) -> tuple[list[Path], list[str]]:
    files: list[Path] = []
    skipped_binary: list[str] = []
    output_resolved = output_path.resolve()

    for current, dirnames, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)

        dirnames[:] = [
            dirname for dirname in dirnames
            if not is_excluded_dir(dirname, skip_dirs)
            and not (not include_hidden and dirname.startswith("."))
            and not (current_path / dirname).is_symlink()
        ]

        for filename in filenames:
            path = current_path / filename

            if path.is_symlink():
                continue
            if path.resolve() == output_resolved:
                continue
            if path.suffix.lower() in skip_exts:
                skipped_binary.append(path.relative_to(root).as_posix())
                continue
            if not include_hidden and filename.startswith("."):
                continue
            if is_binary_file(path):
                skipped_binary.append(path.relative_to(root).as_posix())
                continue

            files.append(path.relative_to(root))

    files.sort(key=lambda item: item.as_posix().lower())
    return files, skipped_binary


def build_tree(paths: list[Path]) -> str:
    tree: dict = {}
    for path in paths:
        node = tree
        for part in path.parts[:-1]:
            node = node.setdefault(part, {})
        node[path.parts[-1]] = None

    lines: list[str] = []

    def walk(node: dict, prefix: str = "") -> None:
        items = sorted(node.items(), key=lambda pair: (pair[1] is None, pair[0].lower()))
        for index, (name, child) in enumerate(items):
            last = index == len(items) - 1
            lines.append(f"{prefix}{'└── ' if last else '├── '}{name}")
            if child is not None:
                walk(child, prefix + ("    " if last else "│   "))

    walk(tree)
    return "\n".join(lines)


def merge_project(
    root: Path,
    output: Path,
    skip_dirs: set[str],
    skip_exts: set[str],
    do_redact: bool,
    include_hidden: bool,
) -> int:
    files, skipped_binary = collect_files(
        root, output, skip_dirs, skip_exts, include_hidden
    )

    if not files:
        print("Không tìm thấy file văn bản nào trong dự án.", file=sys.stderr)
        return 1

    output.parent.mkdir(parents=True, exist_ok=True)
    tree = build_tree(files)
    written = 0
    errors: list[tuple[str, str]] = []

    with output.open("w", encoding="utf-8", newline="\n") as merged:
        merged.write("=" * 88 + "\n")
        merged.write("FULL PROJECT SOURCE MERGE\n")
        merged.write(f"Generated : {datetime.now().astimezone().isoformat(timespec='seconds')}\n")
        merged.write(f"Root      : {root}\n")
        merged.write(f"Files     : {len(files)}\n")
        merged.write(f"Redaction : {'ON' if do_redact else 'OFF'}\n")
        merged.write("Excluded  : dependency/vendor folders, build/cache/VCS folders, binary files\n")
        merged.write("=" * 88 + "\n\n")
        merged.write("=== PROJECT TREE ===\n")
        merged.write(tree + "\n\n")
        merged.write("=== FILE CONTENTS ===\n")

        for index, relative_path in enumerate(files, 1):
            absolute_path = root / relative_path
            try:
                content = read_text(absolute_path)
                if do_redact:
                    content = redact_secrets(content)

                merged.write("\n" + "=" * 88 + "\n")
                merged.write(
                    f"File [{index}/{len(files)}]: {relative_path.as_posix()} "
                    f"({absolute_path.stat().st_size:,} bytes)\n"
                )
                merged.write("=" * 88 + "\n\n")
                merged.write(content)
                if not content.endswith("\n"):
                    merged.write("\n")
                merged.write(f"\n{FILE_END}\n")
                written += 1
            except Exception as exc:
                errors.append((relative_path.as_posix(), str(exc)))
                merged.write("\n" + "=" * 88 + "\n")
                merged.write(f"File: {relative_path.as_posix()} [READ ERROR: {exc}]\n")
                merged.write(f"{FILE_END}\n")

        merged.write("\n" + "=" * 88 + "\n")
        merged.write("=== MERGE SUMMARY ===\n")
        merged.write(f"Files discovered : {len(files)}\n")
        merged.write(f"Files written    : {written}\n")
        merged.write(f"Binary skipped   : {len(skipped_binary)}\n")
        merged.write(f"Read errors      : {len(errors)}\n")
        merged.write("=" * 88 + "\n")

    print(f"[OK] Đã gộp {written}/{len(files)} file vào: {output}")
    print(f"[INFO] Bỏ qua {len(skipped_binary)} file nhị phân/định dạng nhị phân.")
    print(f"[INFO] Lỗi đọc: {len(errors)}")

    if errors:
        print("\nCác file không đọc được:", file=sys.stderr)
        for name, error in errors:
            print(f" - {name}: {error}", file=sys.stderr)

    return 0 if not errors else 2


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Gộp toàn bộ file văn bản của dự án, loại trừ thư viện và file nhị phân."
    )
    parser.add_argument("-r", "--root", default=".",
                        help="Thư mục gốc dự án (mặc định: thư mục hiện tại)")
    parser.add_argument("-o", "--output", default="merged_full.txt",
                        help="File TXT đầu ra (mặc định: merged_full.txt)")
    parser.add_argument("--exclude-dir", action="append", default=[],
                        help="Thêm thư mục cần loại trừ; có thể dùng nhiều lần")
    parser.add_argument("--exclude-ext", action="append", default=[],
                        help="Thêm phần mở rộng cần loại trừ, ví dụ .map")
    parser.add_argument("--no-redact", action="store_true",
                        help="Không che secret/password/token (cẩn thận khi chia sẻ file)")
    parser.add_argument("--no-hidden", action="store_true",
                        help="Bỏ qua file/thư mục ẩn")
    parser.add_argument("-V", "--version", action="version",
                        version=f"%(prog)s {VERSION}")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"Thư mục dự án không tồn tại: {root}", file=sys.stderr)
        return 1

    output = Path(args.output).expanduser()
    if not output.is_absolute():
        output = (Path.cwd() / output).resolve()

    skip_dirs = set(DEFAULT_SKIP_DIRS)
    skip_dirs.update(args.exclude_dir)
    skip_exts = set(DEFAULT_SKIP_EXTS)
    skip_exts.update(
        ext.lower() if ext.startswith(".") else "." + ext.lower()
        for ext in args.exclude_ext
    )

    started = time.time()
    result = merge_project(
        root=root,
        output=output,
        skip_dirs=skip_dirs,
        skip_exts=skip_exts,
        do_redact=not args.no_redact,
        include_hidden=not args.no_hidden,
    )
    print(f"[TIME] {time.time() - started:.1f}s")
    return result


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
