#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
QK7 PROJECT MERGER — Gộp Source Code Backend (BE) & Frontend (FE) Dự Án (v5.0)
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

CÁC CHẾ ĐỘ MỞ RỘNG (TÙY CHỌN):
    --all              → Gộp toàn bộ dự án (exclude mode)
    --full-stack       → Gộp BE, FE cùng boxchat, fingerprint, ocr-service
    --include-tests    → Cho phép gộp thêm tệp kiểm thử (test/spec)
    --include-scripts  → Cho phép gộp thêm scripts khởi chạy
    --include-docs     → Cho phép gộp thêm tài liệu markdown (.md)
    --include-only     → Gộp theo danh sách thư mục tự chọn

Cách dùng:
    python scripts/mergecode.py                     # Mặc định: Gộp toàn bộ BE & FE
    python scripts/mergecode.py -o merged_be_fe.txt # Đổi tên tệp đầu ra
    python scripts/mergecode.py --full-stack        # Gộp cả AI Boxchat & Fingerprint
================================================================================
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from datetime import datetime
from fnmatch import fnmatch
from pathlib import Path
from typing import Iterator

__version__ = "5.0.0"

# ═══════════════════════════════════════════════════════════════════════════════
# CẤU HÌNH LOẠI TRỪ (EXCLUSIONS)
# ═══════════════════════════════════════════════════════════════════════════════

# Thư mục loại trừ tuyệt đối trong BE & FE mode
EXCLUDE_DIRS = {
    # Thư viện & dependencies
    "node_modules", "bower_components", "vendor",
    # Build & artifacts
    "dist", "build", "out", "target", "bin", "obj", "release",
    ".next", ".nuxt", ".svelte-kit", ".cache", ".parcel-cache",
    "public", "assets", "uploads", "certs", "coverage", "htmlcov",
    # Git & IDEs
    ".git", ".svn", ".idea", ".vscode", ".vs", ".settings",
    # Python caches & virtualenvs
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "venv", ".venv", "env", "ENV",
    # Các phân hệ ngoài BE & FE (khi chạy BE-FE mode)
    "scripts", "tools", "docs", "reports", "data", "config",
    ".agents", ".agent", ".claude", ".design-references",
    # Thư mục kiểm thử (nếu không có flag --include-tests)
    "test", "tests", "__tests__", "testing", "spec", "specs",
}

# Các phân hệ mở rộng trong chế độ --full-stack
FULLSTACK_DIRS = {
    "backend", "frontend", "boxchat", "fingerprint", "ocr-service"
}

# Phần mở rộng loại trừ mặc định
EXCLUDE_EXTS = {
    # Tài liệu & tệp văn bản
    ".md", ".txt", ".rst", ".rtf", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    # Scripts khởi chạy & shell
    ".bat", ".ps1", ".sh", ".cmd", ".bash", ".vbs",
    # Ảnh & Media
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg", ".tiff", ".tif",
    ".mp3", ".mp4", ".wav", ".webm", ".avi", ".mov", ".mkv", ".flac", ".ogg",
    # Binaries & nén
    ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".tgz", ".zst",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".msi", ".dmg", ".app", ".o", ".a",
    ".pyc", ".pyo", ".pyd", ".whl", ".egg", ".class", ".jar",
    ".traineddata", ".safetensors", ".pdiparams", ".pdmodel",
    # Database cục bộ
    ".db", ".sqlite", ".sqlite3", ".mdb", ".accdb",
    # Fonts
    ".ttf", ".otf", ".woff", ".woff2", ".eot",
    # Logs & Locks
    ".log", ".tmp", ".cache", ".lock", ".lockb",
}

# Tệp cụ thể loại trừ
EXCLUDE_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "skills-lock.json",
    "tsconfig.tsbuildinfo", "Thumbs.db", ".DS_Store",
    "merged_code.txt", "QK7_FullSourceCode.txt",
}

# Mẫu tên tệp nhạy cảm (secrets)
DEFAULT_SECRET_PATTERNS = [
    ".env", ".env.*", "*.env",
    "*.pem", "*.key", "*.crt", "*.p12", "*.pfx", "*.jks",
    "id_rsa", "id_ed25519",
]

# Tệp ẩn được phép xem xét nếu cần
ALLOWED_HIDDEN_FILES = {
    ".gitignore", ".gitattributes", ".dockerignore", ".editorconfig",
    ".eslintrc", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs",
    ".prettierrc", ".prettierrc.json", ".prettierrc.js",
}

# Phần mở rộng mã nguồn hợp lệ của BE và FE
VALID_SOURCE_EXTS = {
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".html", ".sql"
}


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
    """Xác định tệp có phải tệp kiểm thử (test/spec) hay không."""
    name = path.name.lower()
    if name.startswith(("test-", "test_")):
        return True
    if name.endswith(("-test.js", "-test.ts", "-spec.js", "-spec.ts", ".test.js", ".test.ts", ".test.tsx", ".spec.js", ".spec.ts", ".spec.tsx")):
        return True
    if ".test." in name or ".spec." in name:
        return True
    for part in path.parts:
        if part.lower() in {"test", "tests", "__tests__", "testing", "spec", "specs"}:
            return True
    return False


def is_binary_file(path: Path, sample_size: int = 8192) -> bool:
    """Kiểm tra tệp nhị phân."""
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
    """Đọc tệp văn bản an toàn đa bảng mã."""
    raw = path.read_bytes()
    for enc in ("utf-8", "utf-8-sig", "utf-16", "utf-16-le", "utf-16-be"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("latin-1", errors="replace")


# ═══════════════════════════════════════════════════════════════════════════════
# BỘ LỌC TỰ ĐỘNG CHE MỜ BÍ MẬT (SECRET REDACTION FILTER)
# ═══════════════════════════════════════════════════════════════════════════════

SECRET_REDACT_RULES = [
    (
        re.compile(r'(?i)\b(FP_ENC_KEY|JWT_SECRET|API_KEY|SECRET_KEY|BRIDGE_TOKEN|FINGERPRINT_BRIDGE_TOKEN|ENCRYPTION_KEY|TOKEN_SECRET)\s*[:=]\s*["\']?([A-Za-z0-9+/=_\-\.]{12,})["\']?'),
        r'\1="[REDACTED_BY_SECURITY_POLICY]"'
    ),
    (
        re.compile(r'(?i)\b(password|pwd|db_password|admin_password)\s*[:=]\s*["\']([^"\'\n\r]{3,})["\']'),
        r'\1="[REDACTED_PASSWORD]"'
    ),
    (
        re.compile(r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'),
        '[REDACTED_PRIVATE_KEY]'
    ),
    (
        re.compile(r'(?i)\bBearer\s+[A-Za-z0-9_\-\.]{20,}'),
        'Bearer [REDACTED_BEARER_TOKEN]'
    ),
    (
        re.compile(r'(?i)(Server=[\w\.\-]+;.*Password=)([^;]+)(;)'),
        r'\1[REDACTED_DB_PWD]\3'
    ),
]


def redact_sensitive_content(text: str) -> str:
    """Tự động phát hiện và che giấu các thông tin bí mật trước khi ghi vào tệp."""
    redacted = text
    for pattern, replacement in SECRET_REDACT_RULES:
        redacted = pattern.sub(replacement, redacted)
    return redacted


# ═══════════════════════════════════════════════════════════════════════════════
# BỘ THU THẬP FILE NGUỒN BE VÀ FE (CHÍNH)
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
    """
    Thu thập toàn bộ mã nguồn của Backend và Frontend (hoặc full-stack nếu bật).
    Loại trừ hoàn toàn thư viện, .env, scripts, txt, md, test files.
    """
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

            # Prune excluded directories
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

                # 1. Loại trừ theo danh mục tệp
                if name in EXCLUDE_FILES or _match_any(name, extra_lower) or _match_any(rel_posix, extra_lower):
                    continue

                # 2. Loại trừ theo phần mở rộng
                ext = file_path.suffix.lower()
                if ext in active_exclude_exts:
                    continue

                # 3. Chỉ lấy phần mở rộng mã nguồn hợp lệ (trừ khi có cờ đặc biệt)
                if ext not in VALID_SOURCE_EXTS:
                    if not (include_docs and ext == ".md") and not (include_scripts and ext in {".bat", ".ps1", ".sh"}):
                        continue

                # 4. Loại trừ tệp kiểm thử nếu không có cờ --include-tests
                if not include_tests and is_test_file(file_path):
                    continue

                # 5. Loại trừ các tệp bí mật .env
                if secret_patterns and (_match_any(name, secret_patterns) or _match_any(rel_posix, secret_patterns)):
                    continue

                # 6. Loại trừ tệp ẩn
                if name.startswith(".") and name not in ALLOWED_HIDDEN_FILES:
                    continue

                # 7. Loại trừ binary
                if is_binary_file(file_path):
                    continue

                seen.add(rel_posix)
                found.append(rel)

    # Sắp xếp logic: Backend trước, sau đó đến Frontend, ưu tiên cấu trúc tầng
    def _sort_key(p: Path) -> tuple:
        parts = p.parts
        top = parts[0]
        # Thứ tự module: backend -> frontend -> các phân hệ khác
        module_order = {"backend": 1, "frontend": 2, "boxchat": 3, "fingerprint": 4, "ocr-service": 5}
        mod_idx = module_order.get(top, 99)

        # Thứ tự trong module
        sub = parts[1] if len(parts) > 1 else ""
        sub_order = {
            # Backend priority
            "server.js": 1, "swagger.js": 2, "package.json": 3, "config": 4, "migrations": 5, "src": 6,
            # Frontend priority
            "index.html": 1, "vite.config.ts": 2, "tailwind.config.js": 3, "tsconfig.json": 4,
            "App.tsx": 10, "main.tsx": 11, "types": 20, "services": 30, "contexts": 40,
            "hooks": 50, "utils": 60, "routes": 70, "components": 80, "pages": 90,
        }
        sub_idx = sub_order.get(sub, 999)
        return (mod_idx, sub_idx, p.as_posix().lower())

    found.sort(key=_sort_key)
    return found


# ═══════════════════════════════════════════════════════════════════════════════
# CÂY THƯ MỤC & XUẤT TỆP GỘP
# ═══════════════════════════════════════════════════════════════════════════════

def build_tree(paths: list[Path]) -> str:
    """Xây dựng biểu đồ cây thư mục trực quan."""
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


def write_merged(
    root: Path,
    files: list[Path],
    output: Path,
    max_file_size_mb: float,
    max_total_mb: float,
    mode: str,
    verbose: bool = True,
) -> dict:
    """Ghi toàn bộ nội dung file đã thu thập vào tệp đích."""
    max_file_size = int(max_file_size_mb * 1024 * 1024)
    max_total_size = int(max_total_mb * 1024 * 1024)

    stats = {
        "written": 0, "skipped_binary": 0, "skipped_size": 0,
        "errors": [], "total_source_bytes": 0, "large_files": [],
        "written_files": [],
    }

    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, "w", encoding="utf-8", newline="\n") as out:
        out.write("=" * 80 + "\n")
        out.write("QK7 DATAHUB — MERGED SOURCE CODE (CHỈ BACKEND & FRONTEND SOURCE)\n")
        out.write("TIÊU CHUẨN: Đã loại trừ node_modules, .env, scripts, txt, md, test files.\n")
        out.write("CẢNH BÁO: Toàn bộ bí mật, mật khẩu và API key đã được tự động REDACTED.\n")
        out.write("TUYỆT ĐỐI KHÔNG COMMIT TỆP NÀY LÊN HỆ THỐNG QUẢN LÝ PHIÊN BẢN (GIT)!\n")
        out.write(f"Generated : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        out.write(f"Root      : {root}\n")
        out.write(f"Mode      : {mode}\n")
        out.write(f"Files     : {len(files)}\n")
        out.write("=" * 80 + "\n\n")

        out.write("=== PROJECT TREE (BE & FE) ===\n")
        out.write(build_tree(files) + "\n\n")
        out.write("=== FILE CONTENTS ===\n\n")

        for i, rel in enumerate(files):
            if verbose and (i + 1) % 25 == 0:
                print(f"   ... đã xử lý {i + 1}/{len(files)} file", file=sys.stderr)

            abs_path = root / rel
            try:
                file_size = abs_path.stat().st_size
            except OSError as e:
                stats["errors"].append((rel.as_posix(), str(e)))
                continue

            if file_size > max_file_size:
                stats["skipped_size"] += 1
                out.write(f"\n{'=' * 80}\n")
                out.write(f"File: {rel.as_posix()}  [SKIPPED — {file_size / 1024 / 1024:.1f} MB > {max_file_size_mb} MB]\n")
                out.write(f"{'=' * 80}\n")
                continue

            if is_binary_file(abs_path):
                stats["skipped_binary"] += 1
                out.write(f"\n{'=' * 80}\n")
                out.write(f"File: {rel.as_posix()}  [SKIPPED — binary]\n")
                out.write(f"{'=' * 80}\n")
                continue

            try:
                text = redact_sensitive_content(read_text_safe(abs_path))
            except OSError as e:
                stats["errors"].append((rel.as_posix(), str(e)))
                continue

            if file_size > 500 * 1024:
                stats["large_files"].append((rel.as_posix(), file_size))

            out.write(f"\n{'=' * 80}\n")
            out.write(f"File: {rel.as_posix()}\n")
            out.write(f"{'=' * 80}\n\n")
            out.write(text)
            if not text.endswith("\n"):
                out.write("\n")

            stats["written"] += 1
            stats["written_files"].append((rel.as_posix(), file_size))
            stats["total_source_bytes"] += file_size

            if stats["total_source_bytes"] > max_total_size:
                out.write(f"\n[STOPPED — tổng dung lượng vượt {max_total_mb:.0f} MB]\n")
                break

    with open(output, "a", encoding="utf-8", newline="\n") as out:
        out.write("\n" + "=" * 80 + "\n")
        out.write("=== SUMMARY ===\n")
        out.write(f"Files written : {stats['written']}\n")
        out.write(f"Files skipped : {stats['skipped_binary'] + stats['skipped_size'] + len(stats['errors'])}\n")
        out.write(f"Total content : {stats['total_source_bytes'] / 1024:.1f} KB ({stats['total_source_bytes'] / 1024 / 1024:.2f} MB)\n")

        if stats["large_files"]:
            out.write("\nLarge files (>500KB):\n")
            for rel, sz in stats["large_files"]:
                out.write(f"  - {rel}: {sz / 1024 / 1024:.2f} MB\n")

        out.write("\n=== ALL MERGED FILES ===\n")
        for rel, sz in stats["written_files"]:
            out.write(f"  {sz / 1024:8.1f} KB  {rel}\n")

        out.write("=" * 80 + "\n")

    return stats


# ═══════════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════════

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="mergecode.py",
        description="Gộp TOÀN BỘ source code Backend & Frontend dự án vào 1 file text (loại trừ thư viện, env, scripts, txt, md, test).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Ví dụ:\n"
            "  python scripts/mergecode.py                     # Mặc định: Gộp toàn bộ BE & FE code\n"
            "  python scripts/mergecode.py -o be_fe_code.txt   # Đổi tên file output\n"
            "  python scripts/mergecode.py --full-stack        # Gộp cả boxchat, fingerprint, ocr\n"
            "  python scripts/mergecode.py --include-tests     # Cho phép gộp thêm file test\n"
            "  python scripts/mergecode.py --include-docs      # Cho phép gộp thêm file markdown\n"
        ),
    )
    script_dir = Path(__file__).resolve().parent
    default_root = ".." if Path.cwd().resolve() == script_dir else "."
    parser.add_argument("-r", "--root", default=default_root, help=f"Thư mục gốc dự án (mặc định: {default_root})")
    parser.add_argument("-o", "--output", default="merged_code.txt", help="File output (mặc định: merged_code.txt)")
    parser.add_argument("-m", "--max-size", type=float, default=10.0, metavar="MB",
                        help="Kích thước tối đa 1 file (mặc định: 10 MB)")
    parser.add_argument("--max-total", type=float, default=200.0, metavar="MB",
                        help="Tổng dung lượng output tối đa (mặc định: 200 MB)")
    parser.add_argument("--full-stack", action="store_true",
                        help="Gộp BE & FE kèm cả boxchat, fingerprint, ocr-service")
    parser.add_argument("--include-tests", action="store_true",
                        help="Cho phép gộp thêm tệp kiểm thử (mặc định: LOẠI BỎ test/spec)")
    parser.add_argument("--include-scripts", action="store_true",
                        help="Cho phép gộp thêm tệp scripts (.bat, .ps1, .sh)")
    parser.add_argument("--include-docs", action="store_true",
                        help="Cho phép gộp thêm tệp tài liệu markdown (.md)")
    parser.add_argument("--include-env", action="store_true",
                        help="Cho phép gộp tệp .env (⚠ cảnh báo rò rỉ bí mật)")
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

    # Mode description
    mode_parts = ["BE & FE Source Code"]
    if args.full_stack:
        mode_parts.append("+ FullStack Services")
    if args.include_tests:
        mode_parts.append("+ Tests")
    if args.include_scripts:
        mode_parts.append("+ Scripts")
    if args.include_docs:
        mode_parts.append("+ Docs")
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

    print(f"[INFO] Root        : {root}", file=sys.stderr)
    print(f"[INFO] Output      : {output}", file=sys.stderr)
    print(f"[INFO] Mode        : {mode}", file=sys.stderr)
    print(f"[INFO] Tổng số file: {len(files)} (Backend: {be_count}, Frontend: {fe_count}" + (f", Khác: {other_count})" if other_count else ")"), file=sys.stderr)

    t0 = time.time()
    stats = write_merged(
        root=root,
        files=files,
        output=output,
        max_file_size_mb=args.max_size,
        max_total_mb=args.max_total,
        mode=mode,
        verbose=not args.quiet,
    )

    elapsed = time.time() - t0
    output_size_mb = output.stat().st_size / 1024 / 1024

    print("", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print(f"[OK] HOÀN TẤT trong {elapsed:.2f}s", file=sys.stderr)
    print(f"     Đã gộp         : {stats['written']} file (Backend: {be_count}, Frontend: {fe_count})", file=sys.stderr)
    if stats["skipped_binary"]:
        print(f"     Bỏ qua (binary): {stats['skipped_binary']} file", file=sys.stderr)
    if stats["skipped_size"]:
        print(f"     Bỏ qua (size)  : {stats['skipped_size']} file", file=sys.stderr)
    if stats["errors"]:
        print(f"     Lỗi đọc        : {len(stats['errors'])} file", file=sys.stderr)
        for rel, err in stats["errors"][:5]:
            print(f"        - {rel}: {err}", file=sys.stderr)
    if stats["large_files"]:
        print(f"     File lớn >500KB: {len(stats['large_files'])} file", file=sys.stderr)
        for rel, sz in stats["large_files"][:5]:
            print(f"        - {rel}: {sz / 1024 / 1024:.2f} MB", file=sys.stderr)
    print(f"     Kích thước     : {output_size_mb:.2f} MB", file=sys.stderr)
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
