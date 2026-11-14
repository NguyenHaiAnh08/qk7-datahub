#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
QK7 PROJECT MERGER — Gộp Source Code Backend (BE) & Frontend (FE) Dự án (v5.1)
================================================================================

CHẾ ĐỘ MẶC ĐỊNH: BE & FE SOURCE CODE (KHUYẾN NGHỊ)
    • Quét và gộp TOÀN BỘ file nguồn của Backend (backend/) và Frontend (frontend/).
    • TỰ ĐỘNG LOẠI TRỪ:
        - Thư viện / dependencies: node_modules, package-lock.json, dist, build, public/assets...
        - File môi trường: .env, .env.*, *.env...
        - Scripts & công cụ: scripts/, tools/, *.bat, *.ps1, *.sh...
        - Tệp văn bản & tài liệu: *.txt, *.md, *.rst, *.pdf...
        - Tệp kiểm thử: test/, tests/, __tests__/, *.test.*, *.spec.*, test-*.js...

    • TỰ ĐỘNG BẢO MẬT: Che mờ khóa nhạy cảm (JWT_SECRET, mật khẩu, private key, token).

    • TỰ ĐỘNG NÉN NỘI DUNG: Truncate các dòng base64 blob > 5000 ký tự
      (tránh file output bị phình lên bởi các asset base64 không có giá trị review).

    • MARKER KIỂM TRA: Mỗi file được đóng bằng `--- END OF FILE ---`.
      Nếu thấy một file KHÔNG có marker kết thúc → file đó BỊ CẮT CỤT trong output.

    • CHỐNG TRÀN: Nếu tổng dung lượng vượt `--max-total` (mặc định 100 MB),
      script tự động chia output thành nhiều phần `part-01.txt`, `part-02.txt`...
      (hoặc dừng hẳn nếu không bật `--split`).

CÁC CHẾ ĐỘ MỞ RỘNG (TÙY CHỌN):
    --all              → Gộp toàn bộ dự án (exclude mode)
    --full-stack       → Gộp BE, FE cùng boxchat, fingerprint, ocr-service
    --include-tests    → Cho phép gộp thêm tệp kiểm thử (test/spec)
    --include-scripts  → Cho phép gộp thêm scripts khởi chạy
    --include-docs     → Cho phép gộp thêm tài liệu markdown (.md)
    --split-mb N       → Chia output thành nhiều phần N MB (mặc định 40 MB)

Cách dùng:
    python scripts/mergecode.py                     # Mặc định: Gộp toàn bộ BE & FE
    python scripts/mergecode.py -o merged_be_fe.txt # Đổi tên tệp đầu ra
    python scripts/mergecode.py --full-stack        # Gộp cả AI Boxchat & Fingerprint
    python scripts/mergecode.py --split-mb 30       # Chia thành các phần 30 MB
================================================================================
"""

from __future__ import annotations

import argparse
import math
import os
import re
import sys
import time
from datetime import datetime
from fnmatch import fnmatch
from pathlib import Path
from typing import Iterator

__version__ = "5.1.0"

# ═══════════════════════════════════════════════════════════════════════════════
# CẤU HÌNH LOẠI TRỪ (EXCLUSIONS)
# ═══════════════════════════════════════════════════════════════════════════════

EXCLUDE_DIRS = {
    "node_modules", "bower_components", "vendor",
    "dist", "build", "out", "target", "bin", "obj", "release",
    ".next", ".nuxt", ".svelte-kit", ".cache", ".parcel-cache",
    "public", "assets", "uploads", "certs", "coverage", "htmlcov",
    ".git", ".svn", ".idea", ".vscode", ".vs", ".settings",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "venv", ".venv", "env", "ENV",
    "scripts", "tools", "docs", "reports", "data", "config",
    ".agents", ".agent", ".claude", ".design-references",
    "test", "tests", "__tests__", "testing", "spec", "specs",
}

FULLSTACK_DIRS = {"backend", "frontend", "boxchat", "fingerprint", "ocr-service"}

EXCLUDE_EXTS = {
    ".md", ".txt", ".rst", ".rtf", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".bat", ".ps1", ".sh", ".cmd", ".bash", ".vbs",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg", ".tiff", ".tif",
    ".mp3", ".mp4", ".wav", ".webm", ".avi", ".mov", ".mkv", ".flac", ".ogg",
    ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".tgz", ".zst",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".msi", ".dmg", ".app", ".o", ".a",
    ".pyc", ".pyo", ".pyd", ".whl", ".egg", ".class", ".jar",
    ".traineddata", ".safetensors", ".pdiparams", ".pdmodel",
    ".db", ".sqlite", ".sqlite3", ".mdb", ".accdb",
    ".ttf", ".otf", ".woff", ".woff2", ".eot",
    ".log", ".tmp", ".cache", ".lock", ".lockb",
}

EXCLUDE_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "skills-lock.json",
    "tsconfig.tsbuildinfo", "Thumbs.db", ".DS_Store",
    "merged_code.txt", "QK7_FullSourceCode.txt",
}

DEFAULT_SECRET_PATTERNS = [
    ".env", ".env.*", "*.env",
    "*.pem", "*.key", "*.crt", "*.p12", "*.pfx", "*.jks",
    "id_rsa", "id_ed25519",
]

ALLOWED_HIDDEN_FILES = {
    ".gitignore", ".gitattributes", ".dockerignore", ".editorconfig",
    ".eslintrc", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs",
    ".prettierrc", ".prettierrc.json", ".prettierrc.js",
}

VALID_SOURCE_EXTS = {
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".html", ".sql"
}

# ═══════════════════════════════════════════════════════════════════════════════
# CẤU HÌNH NÉN NỘI DUNG (CONTENT COMPRESSION)
# ═══════════════════════════════════════════════════════════════════════════════

# Ngưỡng truncate dòng quá dài (thường là base64 blob trong touchid_assets.ts)
MAX_LINE_LENGTH = 5000

# Marker để nhận diện tệp bị cắt cụt trong tương lai
FILE_END_MARKER = "--- END OF FILE ---"


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS VÀ BỘ LỌC KIỂM THỬ
# ═══════════════════════════════════════════════════════════════════════════════

def _match_any(text: str, patterns: list[str]) -> bool:
    return any(fnmatch(text.lower(), p.lower()) for p in patterns)


def _is_under(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        try:
            Path(os.path.normcase(str(path))).relative_to(
                Path(os.path.normcase(str(parent)))
            )
            return True
        except ValueError:
            return False


def is_test_file(path: Path) -> bool:
    name = path.name.lower()
    if name.startswith(("test-", "test_")):
        return True
    if name.endswith(("-test.js", "-test.ts", "-spec.js", "-spec.ts",
                      ".test.js", ".test.ts", ".test.tsx",
                      ".spec.js", ".spec.ts", ".spec.tsx")):
        return True
    if ".test." in name or ".spec." in name:
        return True
    for part in path.parts:
        if part.lower() in {"test", "tests", "__tests__", "testing", "spec", "specs"}:
            return True
    return False


def is_binary_file(path: Path, sample_size: int = 8192) -> bool:
    try:
        with open(path, "rb") as f:
            chunk = f.read(sample_size)
    except OSError:
        return True
    if not chunk:
        return False
    if b"\x00" in chunk:
        return True
    try:
        chunk.decode("utf-8")
        return False
    except UnicodeDecodeError:
        pass
    text = chunk.decode("latin-1", errors="ignore")
    non_printable = sum(1 for c in text if ord(c) < 32 and c not in "\n\r\t\f\b")
    return (non_printable / max(len(text), 1)) > 0.30


def read_text_safe(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("utf-8", "utf-8-sig", "utf-16", "utf-16-le", "utf-16-be"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("latin-1", errors="replace")


def truncate_long_lines(text: str, max_len: int = MAX_LINE_LENGTH) -> tuple[str, int]:
    """
    Truncate các dòng quá dài (thường là base64 blob).
    Trả về (text_đã_truncate, số_dòng_bị_truncate).
    """
    lines = text.split("\n")
    truncated_count = 0
    for i, line in enumerate(lines):
        if len(line) > max_len:
            keep_head = line[:200]
            keep_tail = line[-120:]
            removed = len(line) - len(keep_head) - len(keep_tail)
            lines[i] = (
                f"{keep_head}"
                f"...[...TRUNCATED {removed} CHARS — BASE64/BLOB BỊ LƯỢC BỎ...]..."
                f"{keep_tail}"
            )
            truncated_count += 1
    return "\n".join(lines), truncated_count


# ═══════════════════════════════════════════════════════════════════════════════
# BỘ LỌC CHE MỜ BÍ MẬT (SECRET REDACTION)
# ═══════════════════════════════════════════════════════════════════════════════

SECRET_REDACT_RULES = [
    (re.compile(r'(?i)\b(FP_ENC_KEY|JWT_SECRET|API_KEY|SECRET_KEY|BRIDGE_TOKEN|FINGERPRINT_BRIDGE_TOKEN|ENCRYPTION_KEY|TOKEN_SECRET)\s*[:=]\s*["\']?([A-Za-z0-9+/=_\-\.]{12,})["\']?'),
     r'\1="[REDACTED_BY_SECURITY_POLICY]"'),
    (re.compile(r'(?i)\b(password|pwd|db_password|admin_password)\s*[:=]\s*["\']([^"\'\n\r]{3,})["\']'),
     r'\1="[REDACTED_PASSWORD]"'),
    (re.compile(r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'),
     '[REDACTED_PRIVATE_KEY]'),
    (re.compile(r'(?i)\bBearer\s+[A-Za-z0-9_\-\.]{20,}'),
     'Bearer [REDACTED_BEARER_TOKEN]'),
    (re.compile(r'(?i)(Server=[\w\.\-]+;.*Password=)([^;]+)(;)'),
     r'\1[REDACTED_DB_PWD]\3'),
]


def redact_sensitive_content(text: str) -> str:
    redacted = text
    for pattern, replacement in SECRET_REDACT_RULES:
        redacted = pattern.sub(replacement, redacted)
    return redacted


# ═══════════════════════════════════════════════════════════════════════════════
# THU THẬP FILE NGUỒN
# ═══════════════════════════════════════════════════════════════════════════════

def collect_be_fe_files(
    root: Path,
    include_tests: bool = False,
    include_scripts: bool = False,
    include_docs: bool = False,
    include_env: bool = False,
    full_stack: bool = False,
    extra_excludes: list[str] | None = None,
) -> list[Path]:
    extra_lower = [p.lower() for p in (extra_excludes or [])]
    target_names = ["backend", "frontend"]
    if full_stack:
        target_names.extend(["boxchat", "fingerprint", "ocr-service"])

    active_exclude_dirs = set(EXCLUDE_DIRS)
    if full_stack:
        active_exclude_dirs -= {"boxchat", "fingerprint", "ocr-service"}
    if include_scripts:
        active_exclude_dirs -= {"scripts", "tools"}

    active_exclude_exts = set(EXCLUDE_EXTS)
    if include_docs:
        active_exclude_exts.discard(".md")
    if include_scripts:
        active_exclude_exts -= {".bat", ".ps1", ".sh", ".cmd"}

    secret_patterns = [] if include_env else DEFAULT_SECRET_PATTERNS

    found: list[Path] = []
    seen: set[str] = set()

    for target_name in target_names:
        target_dir = root / target_name
        if not target_dir.exists() or not target_dir.is_dir():
            continue

        for current_dir_str, dirnames, filenames in os.walk(target_dir, followlinks=False):
            current = Path(current_dir_str)

            dirnames[:] = [
                d for d in dirnames
                if d not in active_exclude_dirs
                and not _match_any(d, extra_lower)
                and (include_tests or d.lower() not in {"test", "tests", "__tests__", "testing", "spec", "specs"})
                and not d.startswith(".")
            ]

            for name in filenames:
                file_path = current / name
                rel = file_path.relative_to(root)
                rel_posix = rel.as_posix()

                if rel_posix in seen:
                    continue

                if name in EXCLUDE_FILES or _match_any(name, extra_lower) or _match_any(rel_posix, extra_lower):
                    continue

                ext = file_path.suffix.lower()
                if ext in active_exclude_exts:
                    continue

                if ext not in VALID_SOURCE_EXTS:
                    if not (include_docs and ext == ".md") and not (include_scripts and ext in {".bat", ".ps1", ".sh"}):
                        continue

                if not include_tests and is_test_file(file_path):
                    continue

                if secret_patterns and (_match_any(name, secret_patterns) or _match_any(rel_posix, secret_patterns)):
                    continue

                if name.startswith(".") and name not in ALLOWED_HIDDEN_FILES:
                    continue

                if is_binary_file(file_path):
                    continue

                seen.add(rel_posix)
                found.append(rel)

    def _sort_key(p: Path) -> tuple:
        parts = p.parts
        top = parts[0]
        module_order = {"backend": 1, "frontend": 2, "boxchat": 3, "fingerprint": 4, "ocr-service": 5}
        mod_idx = module_order.get(top, 99)

        sub = parts[1] if len(parts) > 1 else ""
        sub_order = {
            "server.js": 1, "swagger.js": 2, "package.json": 3, "config": 4, "migrations": 5, "src": 6,
            "index.html": 1, "vite.config.ts": 2, "tailwind.config.js": 3, "tsconfig.json": 4,
            "App.tsx": 10, "main.tsx": 11, "types": 20, "services": 30, "contexts": 40,
            "hooks": 50, "utils": 60, "routes": 70, "components": 80, "pages": 90,
        }
        sub_idx = sub_order.get(sub, 999)
        return (mod_idx, sub_idx, p.as_posix().lower())

    found.sort(key=_sort_key)
    return found


# ═══════════════════════════════════════════════════════════════════════════════
# CÂY THƯ MỤC
# ═══════════════════════════════════════════════════════════════════════════════

def build_tree(paths: list[Path]) -> str:
    if not paths:
        return "(empty)"

    tree: dict = {}
    for p in paths:
        node = tree
        for part in p.parts[:-1]:
            node = node.setdefault(part, {})
        node[p.parts[-1]] = None

    lines: list[str] = []

    def _walk(node: dict, prefix: str) -> None:
        items = sorted(node.items(), key=lambda kv: (kv[1] is None, kv[0].lower()))
        for i, (name, child) in enumerate(items):
            is_last = i == len(items) - 1
            lines.append(f"{prefix}{'└── ' if is_last else '├── '}{name}")
            if child is not None:
                _walk(child, prefix + ("    " if is_last else "│   "))

    _walk(tree, "")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# XUẤT TỆP GỘP — VỚI SPLIT & END-MARKER
# ═══════════════════════════════════════════════════════════════════════════════

def _write_header(out, root: Path, file_count: int, mode: str, part_idx: int, total_parts: int) -> None:
    out.write("=" * 80 + "\n")
    out.write("QK7 DATAHUB — MERGED SOURCE CODE (CHỈ BACKEND & FRONTEND SOURCE)\n")
    out.write("TIÊU CHUẨN: Đã loại trừ node_modules, .env, scripts, txt, md, test files.\n")
    out.write("ĐÃ TRUNCATE: Các dòng base64 blob > 5000 ký tự (không có giá trị code review).\n")
    out.write("CẢNH BÁO: Toàn bộ bí mật, mật khẩu và API key đã được tự động REDACTED.\n")
    out.write("TUYỆT ĐỐI KHÔNG COMMIT TỆP NÀY LÊN HỆ THỐNG QUẢN LÝ PHIÊN BẢN (GIT)!\n")
    out.write(f"Generated : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    out.write(f"Root      : {root}\n")
    out.write(f"Mode      : {mode}\n")
    if total_parts > 1:
        out.write(f"Part      : {part_idx}/{total_parts}\n")
    out.write(f"Files     : {file_count}\n")
    out.write("=" * 80 + "\n\n")


def _write_file_block(out, root: Path, rel: Path, stats: dict) -> int:
    """
    Ghi 1 file vào output.
    Trả về kích thước byte đã ghi vào output (~ ước lượng).
    """
    abs_path = root / rel
    try:
        file_size = abs_path.stat().st_size
    except OSError as e:
        stats["errors"].append((rel.as_posix(), str(e)))
        out.write(f"\n{'=' * 80}\nFile: {rel.as_posix()}  [ERROR — {e}]\n{'=' * 80}\n")
        out.write(f"{FILE_END_MARKER}\n")
        return 0

    if file_size > stats["max_file_size"]:
        stats["skipped_size"] += 1
        out.write(f"\n{'=' * 80}\n")
        out.write(f"File: {rel.as_posix()}  [SKIPPED — {file_size / 1024 / 1024:.1f} MB > "
                  f"{stats['max_file_size'] / 1024 / 1024:.1f} MB]\n")
        out.write(f"{'=' * 80}\n")
        out.write(f"{FILE_END_MARKER}\n")
        return 0

    if is_binary_file(abs_path):
        stats["skipped_binary"] += 1
        out.write(f"\n{'=' * 80}\n")
        out.write(f"File: {rel.as_posix()}  [SKIPPED — binary]\n")
        out.write(f"{'=' * 80}\n")
        out.write(f"{FILE_END_MARKER}\n")
        return 0

    try:
        text = redact_sensitive_content(read_text_safe(abs_path))
    except OSError as e:
        stats["errors"].append((rel.as_posix(), str(e)))
        out.write(f"\n{'=' * 80}\nFile: {rel.as_posix()}  [READ ERROR — {e}]\n{'=' * 80}\n")
        out.write(f"{FILE_END_MARKER}\n")
        return 0

    # ── Truncate các dòng base64 quá dài ──
    text, truncated_lines = truncate_long_lines(text)
    if truncated_lines > 0:
        stats["truncated_blobs"] += truncated_lines
        stats["truncated_files"].append((rel.as_posix(), truncated_lines))

    if file_size > 500 * 1024:
        stats["large_files"].append((rel.as_posix(), file_size))

    header = f"\n{'=' * 80}\nFile: {rel.as_posix()}\n{'=' * 80}\n\n"
    out.write(header)
    out.write(text)
    if not text.endswith("\n"):
        out.write("\n")
    out.write(f"\n{FILE_END_MARKER}\n")

    # Flush ngay để đảm bảo dữ liệu xuống đĩa trước khi tiếp tục
    out.flush()

    stats["written"] += 1
    stats["written_files"].append((rel.as_posix(), file_size))
    stats["total_source_bytes"] += file_size

    # Ước lượng bytes ghi vào output (dùng text UTF-8 + header + marker)
    out_bytes_estimate = (
        len(header.encode("utf-8"))
        + len(text.encode("utf-8"))
        + len(f"\n{FILE_END_MARKER}\n".encode("utf-8"))
    )
    return out_bytes_estimate


def _write_summary(out, stats: dict, files: list[Path], elapsed: float | None = None) -> None:
    """Ghi SUMMARY — luôn được gọi từ finally."""
    try:
        out.write("\n" + "=" * 80 + "\n")
        out.write("=== SUMMARY ===\n")
        out.write(f"Files written : {stats['written']}/{len(files)}\n")
        out.write(f"Files skipped : {stats['skipped_binary'] + stats['skipped_size'] + len(stats['errors'])}\n")
        out.write(f"  - binary    : {stats['skipped_binary']}\n")
        out.write(f"  - size      : {stats['skipped_size']}\n")
        out.write(f"  - read error: {len(stats['errors'])}\n")
        out.write(f"Truncated lines (base64 blobs) : {stats.get('truncated_blobs', 0)}\n")
        out.write(f"Total content : {stats['total_source_bytes'] / 1024:.1f} KB "
                  f"({stats['total_source_bytes'] / 1024 / 1024:.2f} MB)\n")
        if elapsed is not None:
            out.write(f"Elapsed       : {elapsed:.2f}s\n")

        if stats.get("truncated_files"):
            out.write("\nFiles with truncated base64 blobs:\n")
            for rel, n in stats["truncated_files"]:
                out.write(f"  - {rel}: {n} dòng bị truncate\n")

        if stats["large_files"]:
            out.write("\nLarge files (>500KB):\n")
            for rel, sz in stats["large_files"]:
                out.write(f"  - {rel}: {sz / 1024 / 1024:.2f} MB\n")

        if stats["errors"]:
            out.write("\nRead errors:\n")
            for rel, err in stats["errors"]:
                out.write(f"  - {rel}: {err}\n")

        out.write("\n=== ALL MERGED FILES ===\n")
        for rel, sz in stats["written_files"]:
            out.write(f"  {sz / 1024:8.1f} KB  {rel}\n")
        out.write("=" * 80 + "\n")
        out.flush()
    except Exception as e:
        # Không bao giờ để summary làm hỏng cả quá trình
        try:
            out.write(f"\n[SUMMARY WRITE ERROR: {e}]\n")
        except Exception:
            pass


def write_merged(
    root: Path,
    files: list[Path],
    output: Path,
    max_file_size_mb: float,
    max_total_mb: float,
    mode: str,
    split_mb: float = 0.0,
    verbose: bool = True,
) -> dict:
    """
    Ghi toàn bộ nội dung vào tệp đích.
    Nếu split_mb > 0: chia thành nhiều tệp part-XX.txt.
    """
    max_file_size = int(max_file_size_mb * 1024 * 1024)
    max_total_size = int(max_total_mb * 1024 * 1024)
    split_bytes = int(split_mb * 1024 * 1024) if split_mb > 0 else 0

    stats = {
        "written": 0,
        "skipped_binary": 0,
        "skipped_size": 0,
        "errors": [],
        "total_source_bytes": 0,
        "large_files": [],
        "written_files": [],
        "truncated_blobs": 0,
        "truncated_files": [],
        "max_file_size": max_file_size,
        "parts_written": [],
    }

    output.parent.mkdir(parents=True, exist_ok=True)

    # Chia parts nếu cần
    parts: list[list[Path]] = []
    if split_bytes > 0:
        # Ước lượng: đo tổng kích thước các file gốc
        total_source = sum((root / f).stat().st_size for f in files if (root / f).exists())
        # Nhân 1.15 vì có header/marker
        est_total = int(total_source * 1.15)
        n_parts = max(1, math.ceil(est_total / split_bytes))
        # Chia đều theo số file (dựa trên dung lượng)
        target_per_part = total_source / n_parts
        current_part: list[Path] = []
        current_size = 0
        for f in files:
            try:
                sz = (root / f).stat().st_size
            except OSError:
                sz = 0
            if current_size + sz > target_per_part and current_part:
                parts.append(current_part)
                current_part = []
                current_size = 0
            current_part.append(f)
            current_size += sz
        if current_part:
            parts.append(current_part)
    else:
        parts = [files]

    total_parts = len(parts)
    part_files_out: list[Path] = []

    for part_idx, part_files in enumerate(parts, start=1):
        if total_parts > 1:
            out_path = output.with_name(
                f"{output.stem}-part{part_idx:02d}{output.suffix}"
            )
        else:
            out_path = output
        part_files_out.append(out_path)

        # Mỗi part có stats riêng để cộng dồn
        part_stats = {
            "written": 0,
            "skipped_binary": 0,
            "skipped_size": 0,
            "errors": [],
            "total_source_bytes": 0,
            "large_files": [],
            "written_files": [],
            "truncated_blobs": 0,
            "truncated_files": [],
            "max_file_size": max_file_size,
            "parts_written": [],
        }

        bytes_in_part = 0
        try:
            with open(out_path, "w", encoding="utf-8", newline="\n") as out:
                _write_header(out, root, len(part_files), mode, part_idx, total_parts)

                # Project tree chỉ ghi ở part 1
                if part_idx == 1:
                    out.write("=== PROJECT TREE (BE & FE) ===\n")
                    out.write(build_tree(files) + "\n\n")

                out.write(f"=== FILE CONTENTS (Part {part_idx}/{total_parts}) ===\n\n")

                try:
                    for i, rel in enumerate(part_files):
                        if verbose and (i + 1) % 25 == 0:
                            print(f"   [Part {part_idx}/{total_parts}] ... {i + 1}/{len(part_files)}",
                                  file=sys.stderr)

                        written_bytes = _write_file_block(out, root, rel, part_stats)
                        bytes_in_part += written_bytes

                        # Ngắt part nếu vượt split_bytes
                        if split_bytes > 0 and bytes_in_part >= split_bytes:
                            out.write(f"\n[PART LIMIT REACHED — {bytes_in_part / 1024 / 1024:.1f} MB]\n")
                            remaining = part_files[i + 1:]
                            if remaining:
                                parts.insert(part_idx, remaining)
                                total_parts += 1
                            break

                        # Hard stop nếu vượt max_total
                        if part_stats["total_source_bytes"] + stats["total_source_bytes"] > max_total_size:
                            out.write(f"\n[STOPPED — tổng dung lượng vượt {max_total_mb:.0f} MB]\n")
                            break
                finally:
                    # LUÔN ghi SUMMARY dù có exception
                    _write_summary(out, part_stats)

        except Exception as e:
            print(f"[ERR] Lỗi ghi part {part_idx}: {e}", file=sys.stderr)
            part_stats["errors"].append(("__PART__", str(e)))

        # Cộng dồn vào stats tổng
        stats["written"] += part_stats["written"]
        stats["skipped_binary"] += part_stats["skipped_binary"]
        stats["skipped_size"] += part_stats["skipped_size"]
        stats["errors"].extend(part_stats["errors"])
        stats["total_source_bytes"] += part_stats["total_source_bytes"]
        stats["large_files"].extend(part_stats["large_files"])
        stats["written_files"].extend(part_stats["written_files"])
        stats["truncated_blobs"] += part_stats["truncated_blobs"]
        stats["truncated_files"].extend(part_stats["truncated_files"])
        stats["parts_written"].append((str(out_path), part_stats["written"]))

    # ── VERIFY: Đối chiếu số file đã ghi với danh sách gốc ──
    written_names = {rel for rel, _ in stats["written_files"]}
    source_names = {f.as_posix() for f in files}
    missing = source_names - written_names
    stats["missing_from_output"] = sorted(missing)

    return stats


# ═══════════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════════

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="mergecode.py",
        description="Gộp source code BE & FE (loại trừ thư viện, env, scripts, txt, md, test).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Ví dụ:\n"
            "  python scripts/mergecode.py                     # Mặc định: Gộp BE & FE\n"
            "  python scripts/mergecode.py -o be_fe.txt        # Đổi tên file output\n"
            "  python scripts/mergecode.py --full-stack        # Gộp cả boxchat/fingerprint/ocr\n"
            "  python scripts/mergecode.py --split-mb 30       # Chia thành phần 30 MB\n"
            "  python scripts/mergecode.py --include-tests     # Gộp thêm file test\n"
        ),
    )
    script_dir = Path(__file__).resolve().parent
    default_root = ".." if Path.cwd().resolve() == script_dir else "."
    parser.add_argument("-r", "--root", default=default_root,
                        help=f"Thư mục gốc dự án (mặc định: {default_root})")
    parser.add_argument("-o", "--output", default="merged_code.txt",
                        help="File output (mặc định: merged_code.txt)")
    parser.add_argument("-m", "--max-size", type=float, default=10.0, metavar="MB",
                        help="Kích thước tối đa 1 file (mặc định: 10 MB)")
    parser.add_argument("--max-total", type=float, default=100.0, metavar="MB",
                        help="Tổng dung lượng output tối đa (mặc định: 100 MB)")
    parser.add_argument("--split-mb", type=float, default=0.0, metavar="MB",
                        help="Chia output thành nhiều phần N MB (0 = không chia)")
    parser.add_argument("--full-stack", action="store_true",
                        help="Gộp BE & FE kèm cả boxchat, fingerprint, ocr-service")
    parser.add_argument("--include-tests", action="store_true",
                        help="Cho phép gộp thêm tệp kiểm thử")
    parser.add_argument("--include-scripts", action="store_true",
                        help="Cho phép gộp thêm tệp scripts (.bat, .ps1, .sh)")
    parser.add_argument("--include-docs", action="store_true",
                        help="Cho phép gộp thêm tệp markdown (.md)")
    parser.add_argument("--include-env", action="store_true",
                        help="Cho phép gộp tệp .env (⚠ rò rỉ bí mật)")
    parser.add_argument("-e", "--exclude", nargs="+", default=[], metavar="PATTERN",
                        help="Pattern loại trừ thêm (fnmatch)")
    parser.add_argument("--quiet", action="store_true", help="Không in tiến trình")
    parser.add_argument("-V", "--version", action="version", version=f"%(prog)s {__version__}")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    root = Path(args.root).resolve()
    if not root.exists() or not root.is_dir():
        print(f"[ERR] Thư mục gốc không tồn tại: {root}", file=sys.stderr)
        sys.exit(1)

    output = Path(args.output).resolve()
    if output == root:
        print("[ERR] File output không được trùng thư mục gốc", file=sys.stderr)
        sys.exit(1)

    extra_excludes = list(args.exclude)
    if _is_under(output, root):
        extra_excludes.append(output.relative_to(root).as_posix())
    # Loại trừ luôn các file part cũ nếu có
    if args.split_mb > 0:
        for i in range(1, 20):
            p = output.with_name(f"{output.stem}-part{i:02d}{output.suffix}")
            if _is_under(p, root):
                extra_excludes.append(p.relative_to(root).as_posix())

    mode_parts = ["BE & FE Source Code"]
    if args.full_stack:
        mode_parts.append("+ FullStack Services")
    if args.include_tests:
        mode_parts.append("+ Tests")
    if args.include_scripts:
        mode_parts.append("+ Scripts")
    if args.include_docs:
        mode_parts.append("+ Docs")
    if args.split_mb > 0:
        mode_parts.append(f"+ Split {args.split_mb}MB")
    mode = " ".join(mode_parts)

    files = collect_be_fe_files(
        root=root,
        include_tests=args.include_tests,
        include_scripts=args.include_scripts,
        include_docs=args.include_docs,
        include_env=args.include_env,
        full_stack=args.full_stack,
        extra_excludes=extra_excludes,
    )

    if not files:
        print("[WARN] Không tìm thấy file mã nguồn nào phù hợp.", file=sys.stderr)
        sys.exit(0)

    be_count = sum(1 for f in files if f.parts[0] == "backend")
    fe_count = sum(1 for f in files if f.parts[0] == "frontend")
    other_count = len(files) - be_count - fe_count

    print(f"[INFO] Root         : {root}", file=sys.stderr)
    print(f"[INFO] Output       : {output}", file=sys.stderr)
    print(f"[INFO] Mode         : {mode}", file=sys.stderr)
    print(f"[INFO] Tổng số file : {len(files)} "
          f"(Backend: {be_count}, Frontend: {fe_count}"
          + (f", Khác: {other_count})" if other_count else ")"), file=sys.stderr)
    if args.split_mb > 0:
        print(f"[INFO] Split mode   : mỗi phần ~{args.split_mb} MB", file=sys.stderr)

    t0 = time.time()
    stats = write_merged(
        root=root,
        files=files,
        output=output,
        max_file_size_mb=args.max_size,
        max_total_mb=args.max_total,
        mode=mode,
        split_mb=args.split_mb,
        verbose=not args.quiet,
    )
    elapsed = time.time() - t0

    print("", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print(f"[OK] HOÀN TẤT trong {elapsed:.2f}s", file=sys.stderr)
    print(f"     Đã gộp         : {stats['written']}/{len(files)} file", file=sys.stderr)
    if stats["skipped_binary"]:
        print(f"     Bỏ qua (binary): {stats['skipped_binary']} file", file=sys.stderr)
    if stats["skipped_size"]:
        print(f"     Bỏ qua (size)  : {stats['skipped_size']} file", file=sys.stderr)
    if stats["errors"]:
        print(f"     Lỗi đọc        : {len(stats['errors'])} file", file=sys.stderr)
        for rel, err in stats["errors"][:5]:
            print(f"        - {rel}: {err}", file=sys.stderr)
    if stats.get("truncated_blobs"):
        print(f"     Truncate blob  : {stats['truncated_blobs']} dòng (>5000 ký tự)",
              file=sys.stderr)
    if stats["large_files"]:
        print(f"     File lớn >500KB: {len(stats['large_files'])} file", file=sys.stderr)
    if stats.get("missing_from_output"):
        print(f"     ⚠️  THIẾU     : {len(stats['missing_from_output'])} file không thấy trong output",
              file=sys.stderr)
        for m in stats["missing_from_output"][:10]:
            print(f"        - {m}", file=sys.stderr)

    if len(stats["parts_written"]) > 1:
        print(f"     Parts          : {len(stats['parts_written'])} phần", file=sys.stderr)
        for path, cnt in stats["parts_written"]:
            sz = Path(path).stat().st_size / 1024 / 1024
            print(f"        - {path}  ({cnt} file, {sz:.2f} MB)", file=sys.stderr)
    else:
        out_size = output.stat().st_size / 1024 / 1024
        print(f"     Kích thước     : {out_size:.2f} MB", file=sys.stderr)
        print(f"     File output    : {output}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[WARN] Đã hủy bởi người dùng.", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\n[ERR] Lỗi không mong muốn: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)