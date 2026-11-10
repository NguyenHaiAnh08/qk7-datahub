#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
QK7 PROJECT MERGER — Gộp TOÀN BỘ source code dự án vào 1 file text (v4.0)
================================================================================

CHẾ ĐỘ MẶC ĐỊNH: HYBRID (KHUYẾN NGHỊ)
    Bước 1 — Gộp EXPLICIT_FILES (thứ tự ưu tiên cho tài liệu).
    Bước 2 — AUTO-SCAN backend/, frontend/, fingerprint/, boxchat/,
             ocr-service/, tools/ để bắt MỌI file còn lại (kể cả file mới).
    Kết quả: merged_code.txt chứa TOÀN BỘ code dự án.

CÁC CHẾ ĐỘ KHÁC:
    --explicit-only          → CHỈ gộp EXPLICIT_FILES (không auto-scan)
    --include-only <dir>...  → Gộp theo allowlist thư mục
    --all                    → Gộp gần hết dự án (exclude mode)

Cách dùng:
    python mergecode.py                              # HYBRID (mặc định)
    python mergecode.py -o merged_full.txt           # đổi tên output
    python mergecode.py --explicit-only              # chỉ explicit
    python mergecode.py --all                        # exclude mode
    python mergecode.py --include-only backend/src   # allowlist mode

Yêu cầu: Python ≥ 3.8. Không cần cài thêm thư viện.
================================================================================
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime
from fnmatch import fnmatch
from pathlib import Path
from typing import Iterator

__version__ = "4.0.0"

# ═══════════════════════════════════════════════════════════════════════════════
# DANH SÁCH FILE CẦN GỘP — THỨ TỰ ĐỌC CHO AI
# ═══════════════════════════════════════════════════════════════════════════════
# • Đường dẫn tính từ gốc dự án (thư mục chứa mergecode.py).
# • File gộp ĐÚNG THỨ TỰ khai báo (tài liệu trước → code sau).
# • File không tồn tại → cảnh báo, bỏ qua.
# • File MỚI (chưa có trong list) → tự động bắt bởi AUTO-SCAN.
# ═══════════════════════════════════════════════════════════════════════════════
EXPLICIT_FILES: list[str] = [
    # ═══ 1. TÀI LIỆU KIẾN TRÚC (đọc trước để hiểu dự án) ═══
    "README.md",
    "AGENT_WORKFLOW.md",
    "DESIGN.md",
    "Routing convention .md",
    "Senior Multi-Role.md",
    "System Architect.md",
    "SYSTEM_ARCHITECTURE.md",
    "SETUP_SERVER.md",
    "TROUBLESHOOTING_HISTORY.md",
    "SECURITY_AUDIT_REPORT.md",
    "SKILL.md",
    "skills-lock.json",

    # ═══ 2. PROJECT ROOT — CONFIG ═══
    "package.json",
    "package-lock.json",
    ".env.example",
    ".gitleaks.toml",
    "tsconfig.json",
    "docker-compose.yml",
    "mergecode.py",

    # ═══ 3. PROJECT ROOT — SCRIPT KHỞI CHẠY ═══
    "s.bat",
    "s-dev.bat",
    "start-ai.bat",
    "load-env.bat",
    "generate-client-config.bat",

    # ═══ 4. BACKEND — ROOT (Express Gateway :8000) ═══
    "backend/s.bat",
    "backend/server.js",
    "backend/swagger.js",
    "backend/package.json",
    "backend/package-lock.json",
    "backend/pdf-parser.js",
    "backend/setupadmin.js",
    "backend/setuppw.js",
    "backend/test-pipeline.js",
    "backend/test-scan-parse.js",
    "backend/.env.example",

    # ═══ 5. BACKEND — CONFIG & MIGRATIONS ═══
    "backend/config/parser-patterns.json",
    "backend/migrations/create_revision_proposals.cjs",

    # ═══ 6. BACKEND — SRC (Logic nghiệp vụ) ═══
    "backend/src/db.js",
    "backend/src/clock-authority.js",
    "backend/src/fingerprint-ws.js",
    "backend/src/pdf-router.js",
    "backend/src/permissions.js",
    "backend/src/route-permissions.js",
    "backend/src/sessions.js",
    "backend/src/system-config.js",
    "backend/src/unit-scope.js",
    "backend/src/user-roles.js",
    "backend/src/approval-workflow.js",
    "backend/src/audit-log-cleaner.js",
    "backend/src/admin-routes.js",
    "backend/src/ai-routes.js",
    "backend/src/lecture-routes.js",

    # ═══ 7. FINGERPRINT — ZKTeco ZK9500 Agent (:9001) ═══
    "fingerprint/agent.py",
    "fingerprint/zk_service.py",
    "fingerprint/s-agent.bat",
    "fingerprint/requirements.txt",
    "fingerprint/device_id.txt",

    # ═══ 8. FRONTEND — ROOT CONFIG ═══
    "frontend/package.json",
    "frontend/package-lock.json",
    "frontend/postcss.config.js",
    "frontend/tailwind.config.js",
    "frontend/tsconfig.json",
    "frontend/vite.config.ts",
    "frontend/index.html",

    # ═══ 9. FRONTEND — SRC ROOT ═══
    "frontend/src/App.tsx",
    "frontend/src/main.tsx",
    "frontend/src/index.css",
    "frontend/src/vite-env.d.ts",

    # ═══ 10. FRONTEND — SERVICES (Tầng dịch vụ mạng) ═══
    "frontend/src/services/http.ts",
    "frontend/src/services/index.ts",
    "frontend/src/services/api.ts",
    "frontend/src/services/authService.ts",
    "frontend/src/services/dashboardApi.ts",
    "frontend/src/services/documentsApi.ts",
    "frontend/src/services/usersApi.ts",
    "frontend/src/services/documentService.ts",
    "frontend/src/services/documentTypeService.ts",
    "frontend/src/services/fileService.ts",
    "frontend/src/services/userService.ts",
    "frontend/src/services/roleService.ts",
    "frontend/src/services/permissionService.ts",
    "frontend/src/services/unitService.ts",
    "frontend/src/services/securityLevelService.ts",
    "frontend/src/services/militaryService.ts",
    "frontend/src/services/logService.ts",
    "frontend/src/services/systemService.ts",
    "frontend/src/services/sessionService.ts",
    "frontend/src/services/approvalService.ts",
    "frontend/src/services/fingerprintService.ts",
    "frontend/src/services/pinService.ts",
    "frontend/src/services/aiService.ts",

    # ═══ 11. FRONTEND — COMPONENTS (Admin modals) ═══
    "frontend/src/components/AssignRoleModal.tsx",
    "frontend/src/components/FingerprintEnrollModal.tsx",
    "frontend/src/components/FingerprintScanModal.tsx",
    "frontend/src/components/GrantPermissionModal.tsx",
    "frontend/src/components/PinManageModal.tsx",
    "frontend/src/components/PinVerifyModal.tsx",
    "frontend/src/components/RolePermissionModal.tsx",
    "frontend/src/components/UserCredentialsModal.tsx",
    "frontend/src/components/UserFormModal.tsx",
    "frontend/src/components/UserTable.tsx",
    "frontend/src/components/UserViewPinModal.tsx",
]

# ═══════════════════════════════════════════════════════════════════════════════
# THƯ MỤC QUÉT TỰ ĐỘNG (chỉ dùng trong HYBRID mode)
# ═══════════════════════════════════════════════════════════════════════════════
AUTO_SCAN_DIRS = [
    "backend",
    "frontend",
    "fingerprint",
    "boxchat",
    "ocr-service",
    "tools",
]

# ═══════════════════════════════════════════════════════════════════════════════
# CẤU HÌNH CŨ — DÙNG CHO --include-only / --all
# ═══════════════════════════════════════════════════════════════════════════════

DEFAULT_INCLUDE_ONLY = [
    "backend/config", "backend/migrations", "backend/src",
    "boxchat", "fingerprint", "frontend", "tools",
]

DEFAULT_EXCLUDE_PATHS_IN_ALLOWLIST = [
    "frontend/public",
    "frontend/node_modules",
    "backend/node_modules",
    "boxchat/local_storage",
    "boxchat/venv",
    "ocr-service/venv",
]

DEFAULT_EXCLUDE_DIRS = {
    ".git", ".svn", ".hg", ".bzr",
    "node_modules", "bower_components", "jspm_packages",
    ".venv", ".venv32", ".venv64", "venv", "env", "ENV",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox",
    ".idea", ".vscode", ".vs", ".settings",
    "dist", "build", "out", "target", "bin", "obj", "release",
    ".next", ".nuxt", ".svelte-kit", ".cache", ".parcel-cache",
    "coverage", "htmlcov", ".nyc_output",
    "uploads",
    "logs", ".logs",
    "local_storage",
    "public",       # build output từ frontend
    "certs",        # SSL certs — nhạy cảm
    ".taste-skill",
}

DEFAULT_EXCLUDE_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".tiff", ".tif",
    ".mp3", ".mp4", ".wav", ".webm", ".avi", ".mov", ".mkv", ".flac", ".ogg",
    ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".tgz", ".zst",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".msi", ".dmg", ".app", ".o", ".a",
    ".pyc", ".pyo", ".pyd", ".whl", ".egg",
    ".class", ".jar", ".war", ".ear", ".nupkg",
    ".onnx", ".pt", ".pth", ".h5", ".pkl", ".ckpt", ".safetensors", ".gguf",
    ".npy", ".npz", ".joblib", ".pb", ".tflite",
    ".traineddata",
    ".db", ".sqlite", ".sqlite3", ".mdb", ".accdb",
    ".ttf", ".otf", ".woff", ".woff2", ".eot",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt",
    ".log", ".tmp", ".cache", ".lock",
}

DEFAULT_EXCLUDE_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "poetry.lock", "Pipfile.lock", "composer.lock",
    "Cargo.lock", "go.sum", "Gemfile.lock", "bun.lockb",
    ".DS_Store", "Thumbs.db",
    "merged_code.txt",
}

DEFAULT_SECRET_PATTERNS = [
    ".env", ".env.*", "*.env",
    "*.pem", "*.key", "*.crt", "*.p12", "*.pfx", "*.jks",
    "id_rsa", "id_ed25519",
]

ALLOWED_HIDDEN_FILES = {
    ".gitignore", ".gitattributes", ".gitmodules",
    ".dockerignore", ".editorconfig",
    ".eslintrc", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs",
    ".prettierrc", ".prettierrc.json", ".prettierrc.js",
    ".babelrc", ".babelrc.json",
    ".npmrc", ".nvmrc", ".yarnrc",
    ".flaskenv", ".htaccess",
    ".python-version", ".tool-versions",
    ".gitleaks.toml",
}


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
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
    text = chunk.decode("latin-1")
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


def _file_allowed(
    file_path: Path,
    rel: Path,
    exclude_exts: set[str],
    exclude_files: set[str],
    secret_patterns: list[str],
    include_hidden: bool,
    extra_lower: list[str],
) -> bool:
    name = file_path.name
    rel_posix = rel.as_posix()

    if name in exclude_files:
        return False
    if file_path.suffix.lower() in exclude_exts:
        return False
    if secret_patterns and (
        _match_any(name, secret_patterns)
        or _match_any(rel_posix, secret_patterns)
    ):
        return False
    if (
        not include_hidden
        and name.startswith(".")
        and name not in ALLOWED_HIDDEN_FILES
    ):
        return False
    if _match_any(rel_posix, extra_lower) or _match_any(name, extra_lower):
        return False
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# COLLECT — EXPLICIT MODE
# ═══════════════════════════════════════════════════════════════════════════════

def collect_files_explicit(
    root: Path,
    explicit_files: list[str],
    extra_excludes: list[str],
    secret_patterns: list[str],
) -> tuple[list[Path], list[str]]:
    extra_lower = [p.lower() for p in extra_excludes]
    found: list[Path] = []
    missing: list[str] = []
    seen: set[str] = set()

    for rel_str in explicit_files:
        full = (root / rel_str).resolve()

        if not full.exists() or not full.is_file():
            missing.append(rel_str)
            continue

        try:
            rel = full.relative_to(root)
        except ValueError:
            missing.append(rel_str)
            continue

        rel_posix = rel.as_posix()
        if rel_posix in seen:
            continue

        if _match_any(rel_posix, extra_lower) or _match_any(full.name, extra_lower):
            continue

        if secret_patterns and _match_any(full.name, secret_patterns):
            print(
                f"[SKIP] {rel_posix} — khớp secret pattern (dùng --include-env để gộp)",
                file=sys.stderr,
            )
            continue

        seen.add(rel_posix)
        found.append(rel)

    return found, missing


# ═══════════════════════════════════════════════════════════════════════════════
# COLLECT — AUTO-SCAN (HYBRID MODE fallback)
# ═══════════════════════════════════════════════════════════════════════════════

def collect_files_autoscan(
    root: Path,
    scan_dirs: list[str],
    already_seen: set[str],
    exclude_dirs: set[str],
    exclude_files: set[str],
    exclude_exts: set[str],
    extra_excludes: list[str],
) -> list[Path]:
    """
    Quét các thư mục dự án để tìm file MỚI chưa có trong EXPLICIT_FILES.
    Áp dụng đầy đủ bộ lọc an toàn: bỏ binary, .env, uploads, node_modules, ...
    """
    extra_lower = [p.lower() for p in extra_excludes]
    found: list[Path] = []

    for subdir_name in scan_dirs:
        subdir = root / subdir_name
        if not subdir.exists() or not subdir.is_dir():
            continue

        for current_dir_str, dirnames, filenames in os.walk(subdir, followlinks=False):
            current = Path(current_dir_str)

            # Prune excluded dirs (in-place to affect os.walk)
            dirnames[:] = [
                d for d in dirnames
                if d not in exclude_dirs
                and not _match_any(d, extra_lower)
                and not d.startswith(".")
            ]

            for name in filenames:
                file_path = current / name

                try:
                    rel = file_path.relative_to(root)
                except ValueError:
                    continue
                rel_posix = rel.as_posix()

                if rel_posix in already_seen:
                    continue

                if name in exclude_files:
                    continue
                if file_path.suffix.lower() in exclude_exts:
                    continue
                if _match_any(name, DEFAULT_SECRET_PATTERNS):
                    continue
                if _match_any(rel_posix, extra_lower):
                    continue
                if name.startswith(".") and name not in ALLOWED_HIDDEN_FILES:
                    continue
                if is_binary_file(file_path):
                    continue

                found.append(rel)

    return found


# ═══════════════════════════════════════════════════════════════════════════════
# COLLECT — ALLOWLIST MODE
# ═══════════════════════════════════════════════════════════════════════════════

def collect_files_allowlist(
    root: Path,
    include_paths: list[str],
    exclude_paths: list[str],
    exclude_dirs: set[str],
    exclude_files: set[str],
    exclude_exts: set[str],
    extra_excludes: list[str],
    include_hidden: bool,
    include_env: bool,
) -> Iterator[Path]:
    extra_lower = [p.lower() for p in extra_excludes]
    secret_patterns = [] if include_env else DEFAULT_SECRET_PATTERNS

    include_abs: list[Path] = []
    for p in include_paths:
        full = (root / p).resolve()
        if full.exists():
            include_abs.append(full)
        else:
            print(f"[WARN] Include path không tồn tại: {p}", file=sys.stderr)

    if not include_abs:
        return

    exclude_abs: list[Path] = []
    for p in exclude_paths:
        exclude_abs.append((root / p).resolve())

    seen: set[str] = set()

    for inc_root in include_abs:
        if inc_root.is_file():
            try:
                rel = inc_root.relative_to(root)
            except ValueError:
                continue
            rel_posix = rel.as_posix()
            if rel_posix in seen:
                continue
            if any(_is_under(inc_root, ep) for ep in exclude_abs):
                continue
            if _file_allowed(inc_root, rel, exclude_exts, exclude_files,
                             secret_patterns, include_hidden, extra_lower):
                seen.add(rel_posix)
                yield rel
            continue

        if not inc_root.is_dir():
            continue

        for current_dir_str, dirnames, filenames in os.walk(inc_root, followlinks=False):
            current = Path(current_dir_str)

            kept: list[str] = []
            for d in dirnames:
                child = current / d
                child_abs = child.resolve()
                if any(_is_under(child_abs, ep) for ep in exclude_abs):
                    continue
                if d in exclude_dirs:
                    continue
                if _match_any(d, extra_lower):
                    continue
                if not include_hidden and d.startswith("."):
                    continue
                kept.append(d)
            dirnames[:] = kept

            for name in filenames:
                file_path = current / name
                file_abs = file_path.resolve()
                if any(_is_under(file_abs, ep) for ep in exclude_abs):
                    continue
                try:
                    rel = file_path.relative_to(root)
                except ValueError:
                    continue
                rel_posix = rel.as_posix()
                if rel_posix in seen:
                    continue
                if not _file_allowed(file_path, rel, exclude_exts, exclude_files,
                                     secret_patterns, include_hidden, extra_lower):
                    continue
                seen.add(rel_posix)
                yield rel


# ═══════════════════════════════════════════════════════════════════════════════
# COLLECT — EXCLUDE MODE
# ═══════════════════════════════════════════════════════════════════════════════

def collect_files_exclude(
    root: Path,
    exclude_dirs: set[str],
    exclude_files: set[str],
    exclude_exts: set[str],
    extra_excludes: list[str],
    include_hidden: bool,
    include_env: bool,
) -> Iterator[Path]:
    extra_lower = [p.lower() for p in extra_excludes]
    secret_patterns = [] if include_env else DEFAULT_SECRET_PATTERNS

    for current_dir_str, dirnames, filenames in os.walk(root, followlinks=False):
        current = Path(current_dir_str)
        dirnames[:] = [
            d for d in dirnames
            if d not in exclude_dirs
            and not _match_any(d, extra_lower)
            and (include_hidden or not d.startswith("."))
        ]
        for name in filenames:
            file_path = current / name
            try:
                rel = file_path.relative_to(root)
            except ValueError:
                continue
            if _file_allowed(file_path, rel, exclude_exts, exclude_files,
                             secret_patterns, include_hidden, extra_lower):
                yield rel


# ═══════════════════════════════════════════════════════════════════════════════
# TREE RENDERER
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
# WRITE MERGED
# ═══════════════════════════════════════════════════════════════════════════════

def write_merged(
    root: Path,
    files: list[Path],
    output: Path,
    max_file_size_mb: float,
    max_total_mb: float,
    mode: str,
    verbose: bool = True,
) -> dict:
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
        out.write("QK7 DATAHUB — MERGED SOURCE CODE\n")
        out.write(f"Generated : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        out.write(f"Root      : {root}\n")
        out.write(f"Mode      : {mode}\n")
        out.write(f"Files     : {len(files)}\n")
        out.write("=" * 80 + "\n\n")

        out.write("=== PROJECT TREE ===\n")
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
                text = read_text_safe(abs_path)
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
        out.write(f"Total content : {stats['total_source_bytes'] / 1024:.1f} KB\n")

        if stats["large_files"]:
            out.write(f"\nLarge files (>500KB):\n")
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
        description="Gộp TOÀN BỘ source code dự án vào 1 file text. Mặc định dùng HYBRID (explicit + auto-scan).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Ví dụ:\n"
            "  python mergecode.py                         # HYBRID (khuyến nghị)\n"
            "  python mergecode.py -o merged_full.txt      # đổi tên output\n"
            "  python mergecode.py --explicit-only         # chỉ file trong EXPLICIT_FILES\n"
            "  python mergecode.py --all                   # gộp gần hết dự án\n"
            "  python mergecode.py --include-only backend/src frontend/src\n"
        ),
    )
    parser.add_argument("-r", "--root", default=".", help="Thư mục gốc (mặc định: .)")
    parser.add_argument("-o", "--output", default="merged_code.txt", help="File output (mặc định: merged_code.txt)")
    parser.add_argument("-m", "--max-size", type=float, default=10.0, metavar="MB",
                        help="Kích thước tối đa 1 file (mặc định: 10 MB)")
    parser.add_argument("--max-total", type=float, default=200.0, metavar="MB",
                        help="Tổng dung lượng output tối đa (mặc định: 200 MB)")
    parser.add_argument("--explicit-only", action="store_true",
                        help="CHỈ gộp EXPLICIT_FILES (không auto-scan)")
    parser.add_argument("--include-only", nargs="+", default=None, metavar="PATH",
                        help="ALLOWLIST MODE — gộp theo danh sách thư mục/file")
    parser.add_argument("--exclude-paths", nargs="+", default=None, metavar="PATH",
                        help="(allowlist mode) loại trừ path con")
    parser.add_argument("--all", action="store_true",
                        help="EXCLUDE MODE — gộp gần hết dự án")
    parser.add_argument("-e", "--exclude", nargs="+", default=[], metavar="PATTERN",
                        help="Pattern loại trừ thêm (fnmatch) — áp dụng cho mọi mode")
    parser.add_argument("--include-env", action="store_true",
                        help="Gộp cả file .env (⚠ nguy hiểm)")
    parser.add_argument("--include-hidden", action="store_true",
                        help="(allowlist/exclude mode) gộp cả file/thư mục hidden")
    parser.add_argument("--quiet", action="store_true", help="Không in tiến trình")
    parser.add_argument("-V", "--version", action="version", version=f"%(prog)s {__version__}")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    root = Path(args.root).resolve()
    if not root.exists() or not root.is_dir():
        print(f"[ERR] Thư mục không tồn tại hoặc không phải dir: {root}", file=sys.stderr)
        sys.exit(1)

    output = Path(args.output).resolve()
    if output == root:
        print("[ERR] File output không được trùng thư mục gốc", file=sys.stderr)
        sys.exit(1)

    extra_excludes = list(args.exclude)
    if _is_under(output, root):
        extra_excludes.append(output.relative_to(root).as_posix())

    secret_patterns = [] if args.include_env else DEFAULT_SECRET_PATTERNS
    missing: list[str] = []
    auto_files: list[Path] = []

    # ═══════════════════════════════════════════════════════════
    # QUYẾT ĐỊNH MODE
    # ═══════════════════════════════════════════════════════════
    if args.all:
        mode = "EXCLUDE (--all)"
        files = sorted(
            collect_files_exclude(
                root=root,
                exclude_dirs=DEFAULT_EXCLUDE_DIRS,
                exclude_files=DEFAULT_EXCLUDE_FILES,
                exclude_exts=DEFAULT_EXCLUDE_EXTS,
                extra_excludes=extra_excludes,
                include_hidden=args.include_hidden,
                include_env=args.include_env,
            ),
            key=lambda p: p.as_posix().lower(),
        )

    elif args.include_only:
        mode = "ALLOWLIST (--include-only)"
        exclude_paths = args.exclude_paths if args.exclude_paths is not None \
            else DEFAULT_EXCLUDE_PATHS_IN_ALLOWLIST
        files = sorted(
            collect_files_allowlist(
                root=root,
                include_paths=args.include_only,
                exclude_paths=exclude_paths,
                exclude_dirs=DEFAULT_EXCLUDE_DIRS,
                exclude_files=DEFAULT_EXCLUDE_FILES,
                exclude_exts=DEFAULT_EXCLUDE_EXTS,
                extra_excludes=extra_excludes,
                include_hidden=args.include_hidden,
                include_env=args.include_env,
            ),
            key=lambda p: p.as_posix().lower(),
        )

    elif args.explicit_only:
        mode = "EXPLICIT-ONLY (--explicit-only)"
        files, missing = collect_files_explicit(
            root=root,
            explicit_files=EXPLICIT_FILES,
            extra_excludes=extra_excludes,
            secret_patterns=secret_patterns,
        )

    else:
        # ═══════════════════════════════════════════════════════════
        # HYBRID MODE (MẶC ĐỊNH) — Explicit + Auto-scan
        # ═══════════════════════════════════════════════════════════
        mode = "HYBRID (explicit + auto-scan)"

        # Bước 1: Explicit files (giữ thứ tự đọc)
        files, missing = collect_files_explicit(
            root=root,
            explicit_files=EXPLICIT_FILES,
            extra_excludes=extra_excludes,
            secret_patterns=secret_patterns,
        )
        seen = {p.as_posix() for p in files}

        # Bước 2: Auto-scan bắt file còn lại
        auto_files = collect_files_autoscan(
            root=root,
            scan_dirs=AUTO_SCAN_DIRS,
            already_seen=seen,
            exclude_dirs=DEFAULT_EXCLUDE_DIRS,
            exclude_files=DEFAULT_EXCLUDE_FILES,
            exclude_exts=DEFAULT_EXCLUDE_EXTS,
            extra_excludes=extra_excludes,
        )
        auto_files.sort(key=lambda p: p.as_posix().lower())

        if auto_files:
            print(f"[INFO] Auto-scan bắt thêm {len(auto_files)} file MỚI:", file=sys.stderr)
            for f in auto_files[:15]:
                print(f"    + {f.as_posix()}", file=sys.stderr)
            if len(auto_files) > 15:
                print(f"    ... và {len(auto_files) - 15} file khác", file=sys.stderr)

        files.extend(auto_files)

    # ─── Báo cáo file thiếu ───
    if missing:
        print(f"[WARN] {len(missing)} file trong EXPLICIT_FILES không tồn tại:", file=sys.stderr)
        for m in missing:
            print(f"    - {m}", file=sys.stderr)

    if not files:
        print("[WARN] Không có file nào để gộp.", file=sys.stderr)
        sys.exit(0)

    print(f"[INFO] Root        : {root}", file=sys.stderr)
    print(f"[INFO] Output      : {output}", file=sys.stderr)
    print(f"[INFO] Mode        : {mode}", file=sys.stderr)
    print(f"[INFO] Tổng số file: {len(files)} (explicit: {len(files) - len(auto_files)}, auto-scan: {len(auto_files)})", file=sys.stderr)

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
    print(f"     Đã gộp         : {stats['written']} file", file=sys.stderr)
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
    if missing:
        print(f"     File thiếu     : {len(missing)} file (xem ở trên)", file=sys.stderr)
    print(f"     Kích thước     : {output_size_mb:.2f} MB", file=sys.stderr)
    print(f"     File output    : {output}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[WARN] Đã hủy bởi người dùng.", file=sys.stderr)
        sys.exit(130)
    except Exception as e:  # noqa: BLE001
        print(f"\n[ERR] Lỗi không mong muốn: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)