#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
QK7 PROJECT MERGER — Gộp TOÀN BỘ source code dự án vào 1 file text (v4.2)
================================================================================

CHẾ ĐỘ MẶC ĐỊNH: HYBRID (KHUYẾN NGHỊ)
    Bước 1 — Gộp EXPLICIT_FILES (thứ tự ưu tiên: routes → pages → services → components).
    Bước 2 — AUTO-SCAN backend/, frontend/, fingerprint/, boxchat/,
             ocr-service/, tools/ để bắt MỌI file còn lại.
    Kết quả: merged_code.txt chứa TOÀN BỘ code dự án.

THAY ĐỔI v4.2:
    - Bổ sung nhóm frontend routes/pages/contexts/hooks/constants/types/utils
      vào EXPLICIT_FILES để không bị cắt khi output giới hạn.
    - Loại trừ file base64 (touchid_assets.ts) gây phình output.
    - Truncate file text lớn (80KB–500KB): giữ phần đầu + cuối, cắt giữa.

CÁCH DÙNG:
    python scripts/mergecode.py                              # HYBRID (mặc định)
    python scripts/mergecode.py -o merged_full.txt           # đổi tên output
    python scripts/mergecode.py --explicit-only              # chỉ explicit
    python scripts/mergecode.py --include-only frontend/src/routes frontend/src/pages -o fe_routes.txt
    python scripts/mergecode.py --all                        # exclude mode

Yêu cầu: Python ≥ 3.8. Không cần cài thêm thư viện.
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

__version__ = "4.2.0"

# ═══════════════════════════════════════════════════════════════════════════════
# DANH SÁCH FILE CẦN GỘP — THỨ TỰ ĐỌC CHO AI
# ═══════════════════════════════════════════════════════════════════════════════
EXPLICIT_FILES: list[str] = [
    # ═══ 1. HIẾN PHÁP & TÀI LIỆU KIẾN TRÚC ═══
    "ANTIGRAVITY_MASTER_BRAIN.md",
    "README.md",
    "docs/architecture/SYSTEM_ARCHITECTURE.md",
    "docs/security/SECURITY.md",
    "docs/security/SECURITY_AUDIT_REPORT.md",
    "docs/security/strix-pentest-instructions.md",
    "docs/guides/SETUP_SERVER.md",
    "docs/guides/TROUBLESHOOTING_HISTORY.md",
    "docs/guides/ROUTING_CONVENTION.md",
    "docs/guides/AGENT_WORKFLOW.md",
    "docs/guides/Senior Multi-Role.md",
    "docs/guides/ENTERPRISE_RESTRUCTURING_REPORT.md",
    "docs/design/DESIGN.md",
    "docs/design/SKILL.md",
    "docs/design/System Architect.md",

    # ═══ 2. PROJECT ROOT & CONFIG ═══
    "package.json",
    "docker-compose.yml",
    ".env.example",
    ".gitleaks.toml",
    ".semgrepignore",
    "config/tsconfig.json",
    "config/zap.yaml",
    "config/skills-lock.json",
    "config/package-lock.json",

    # ═══ 3. SCRIPTS ═══
    "scripts/s.bat",
    "scripts/s-dev.bat",
    "scripts/start-ai.bat",
    "scripts/load-env.bat",
    "scripts/generate-client-config.bat",
    "scripts/mergecode.py",

    # ═══ 4. BACKEND — ROOT ═══
    "backend/s.bat",
    "backend/server.js",
    "backend/swagger.js",
    "backend/package.json",
    "backend/pdf-parser.js",
    "backend/setupadmin.js",
    "backend/setuppw.js",
    "backend/test-pipeline.js",
    "backend/test-scan-parse.js",
    "backend/.env.example",

    # ═══ 5. BACKEND — CONFIG & MIGRATIONS ═══
    "backend/config/parser-patterns.json",
    "backend/migrations/create_revision_proposals.cjs",
    "backend/migrations/create_lecture_quiz_scorm.cjs",
    "backend/migrations/seed_lecture_permissions.cjs",

    # ═══ 6. BACKEND — SRC ═══
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
    "backend/src/security-headers.js",
    "backend/src/admin-routes.js",
    "backend/src/ai-routes.js",
    "backend/src/lecture-routes.js",
    "backend/src/lecture-extended-routes.js",
    "backend/src/lecture-package-helper.js",
    "backend/src/scorm-manifest.js",
    "backend/src/scorm-package-routes.js",

    # ═══ 7. FINGERPRINT ═══
    "fingerprint/agent.py",
    "fingerprint/zk_service.py",
    "fingerprint/s-agent.bat",
    "fingerprint/requirements.txt",
    "fingerprint/device_id.txt",

    # ═══ 8. BOXCHAT (AI Microservice) ═══
    "boxchat/main.py",
    "boxchat/requirements.txt",
    "boxchat/core/__init__.py",
    "boxchat/core/pdf_processor.py",
    "boxchat/core/vector_store.py",
    "boxchat/core/agent_tutor.py",
    "boxchat/core/study_book_gen.py",
    "boxchat/core/media_timeline.py",
    "boxchat/core/metrics.py",
    "boxchat/test_chunking.py",
    "boxchat/test_hybrid_security.py",
    "boxchat/test_multiturn_and_biometric.py",
    "boxchat/test_qdrant_safety.py",
    "boxchat/test_e2e_15_scenarios.py",
    "boxchat/measure_chunking.py",
    "boxchat/reindex_all.py",
    "boxchat/s.bat",

    # ═══ 9. FRONTEND — ROOT CONFIG ═══
    "frontend/package.json",
    "frontend/postcss.config.js",
    "frontend/tailwind.config.js",
    "frontend/tsconfig.json",
    "frontend/vite.config.ts",
    "frontend/index.html",

    # ═══ 10. FRONTEND — SRC ROOT ═══
    "frontend/src/App.tsx",
    "frontend/src/main.tsx",
    "frontend/src/index.css",
    "frontend/src/vite-env.d.ts",

    # ═══ 11. FRONTEND — ROUTES (quyết định SPA có chạy được không) ═══
    "frontend/src/routes/routePaths.ts",
    "frontend/src/routes/routeAccess.ts",
    "frontend/src/routes/getAppRoutes.ts",
    "frontend/src/routes/RouterProvider.tsx",
    "frontend/src/routes/modules/auth.routes.tsx",
    "frontend/src/routes/modules/portal.routes.tsx",
    "frontend/src/routes/modules/myunit.routes.tsx",
    "frontend/src/routes/modules/desk.routes.tsx",
    "frontend/src/routes/modules/ecosystem.routes.tsx",
    "frontend/src/routes/modules/admin.routes.tsx",
    "frontend/src/routes/modules/myApprovals.routes.tsx",
    "frontend/src/routes/modules/error.routes.tsx",
    "frontend/src/routes/modules/fallback.routes.tsx",

    # ═══ 12. FRONTEND — PAGES ═══
    "frontend/src/pages/LoginPage.tsx",
    "frontend/src/pages/PortalPage.tsx",
    "frontend/src/pages/MyUnitPage.tsx",
    "frontend/src/pages/DocumentDeskPage.tsx",
    "frontend/src/pages/LecturesPage.tsx",
    "frontend/src/pages/MaterialsPage.tsx",
    "frontend/src/pages/LibraryPage.tsx",
    "frontend/src/pages/AdminDashboardPage.tsx",
    "frontend/src/pages/UsersPage.tsx",
    "frontend/src/pages/SessionsPage.tsx",
    "frontend/src/pages/TrashPage.tsx",
    "frontend/src/pages/ApprovalQueuePage.tsx",
    "frontend/src/pages/MyApprovalsPage.tsx",
    "frontend/src/pages/HttpErrorPage.tsx",
    "frontend/src/pages/ProtectedPermissionsConfigPage.tsx",

    # ═══ 13. FRONTEND — CONTEXTS ═══
    "frontend/src/contexts/AuthContext.tsx",
    "frontend/src/contexts/AIChatContext.tsx",
    "frontend/src/contexts/ApprovalContext.tsx",
    "frontend/src/contexts/DeviceModeContext.tsx",
    "frontend/src/contexts/NetworkStatusContext.tsx",
    "frontend/src/contexts/ThemeContext.tsx",

    # ═══ 14. FRONTEND — HOOKS ═══
    "frontend/src/hooks/useAuth.ts",
    "frontend/src/hooks/useAntiScreenshot.ts",
    "frontend/src/hooks/useDeviceMode.ts",
    "frontend/src/hooks/useApprovalCount.ts",
    "frontend/src/hooks/useTheme.ts",
    "frontend/src/hooks/useDebounce.ts",
    "frontend/src/hooks/useVirtualScroll.ts",
    "frontend/src/hooks/useFloatingWatermark.ts",

    # ═══ 15. FRONTEND — CONSTANTS ═══
    "frontend/src/constants/apiEndpoints.ts",
    "frontend/src/constants/permissionSubGroups.ts",
    "frontend/src/constants/protectedAccounts.ts",

    # ═══ 16. FRONTEND — TYPES ═══
    "frontend/src/types/index.ts",
    "frontend/src/types/document.ts",
    "frontend/src/types/user.ts",
    "frontend/src/types/lecture.ts",

    # ═══ 17. FRONTEND — UTILS ═══
    "frontend/src/utils/unitTree.tsx",
    "frontend/src/utils/formatFileSize.ts",
    "frontend/src/utils/dateUtils.ts",
    "frontend/src/utils/pdfWatermark.ts",
    "frontend/src/utils/lazyWithRetry.ts",
    "frontend/src/utils/approvalUtils.ts",
    "frontend/src/utils/avatarUtils.ts",
    "frontend/src/utils/exportAuditReportExcel.ts",

    # ═══ 18. FRONTEND — SERVICES ═══
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
]

# ═══════════════════════════════════════════════════════════════════════════════
# THƯ MỤC QUÉT TỰ ĐỘNG (HYBRID mode)
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
# CẤU HÌNH LOẠI TRỪ
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
    "public",
    "certs",
    ".taste-skill",
    "model_weight",
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

# v4.2: loại trừ file base64 gây phình output, khiến file sau bị cắt
DEFAULT_EXCLUDE_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "poetry.lock", "Pipfile.lock", "composer.lock",
    "Cargo.lock", "go.sum", "Gemfile.lock", "bun.lockb",
    ".DS_Store", "Thumbs.db",
    "merged_code.txt",
    # v4.2: base64/asset nội tuyến gây phình output
    "touchid_assets.ts",
    "dongson-drum-assets.ts",
    "svg-assets.ts",
    "icons-bundle.ts",
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


# v4.2: truncate file text lớn (giữ đầu + cuối, cắt giữa)
def truncate_large_text(text: str, file_size: int) -> tuple[str, bool]:
    if file_size <= 80 * 1024:
        return text, False
    if file_size > 500 * 1024:
        # Quá lớn — chỉ lấy 20KB đầu để lấy import/interface
        head = text[:20_000]
        return head + "\n\n[... TRUNCATED — file > 500KB, chỉ giữ 20KB đầu ...]\n", True
    # 80KB–500KB — giữ 40KB đầu + 20KB cuối, cắt giữa
    head = text[:40_000]
    tail = text[-20_000:]
    return (
        head
        + f"\n\n[... TRUNCATED — file {file_size // 1024}KB, cắt phần giữa ...]\n\n"
        + tail,
        True,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# BỘ LỌC CHE MỜ BÍ MẬT
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
    redacted = text
    for pattern, replacement in SECRET_REDACT_RULES:
        redacted = pattern.sub(replacement, redacted)
    return redacted


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
# COLLECT — AUTO-SCAN
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
    extra_lower = [p.lower() for p in extra_excludes]
    found: list[Path] = []

    for subdir_name in scan_dirs:
        subdir = root / subdir_name
        if not subdir.exists() or not subdir.is_dir():
            continue

        for current_dir_str, dirnames, filenames in os.walk(subdir, followlinks=False):
            current = Path(current_dir_str)

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
        "truncated": 0,
        "errors": [], "total_source_bytes": 0, "large_files": [],
        "written_files": [],
    }

    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, "w", encoding="utf-8", newline="\n") as out:
        out.write("=" * 80 + "\n")
        out.write("QK7 DATAHUB — MERGED SOURCE CODE (MẬT QUÂN SỰ / LƯU HÀNH NỘI BỘ)\n")
        out.write("CẢNH BÁO: Toàn bộ bí mật, API key và mật khẩu đã được tự động REDACTED.\n")
        out.write("TUYỆT ĐỐI KHÔNG COMMIT TỆP NÀY LÊN HỆ THỐNG QUẢN LÝ PHIÊN BẢN (GIT)!\n")
        out.write(f"Generated : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        out.write(f"Root      : {root}\n")
        out.write(f"Mode      : {mode}\n")
        out.write(f"Files     : {len(files)}\n")
        out.write(f"Version   : mergecode.py v{__version__}\n")
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
                text = redact_sensitive_content(read_text_safe(abs_path))
            except OSError as e:
                stats["errors"].append((rel.as_posix(), str(e)))
                continue

            # v4.2: truncate file text lớn thay vì gộp nguyên
            text, was_truncated = truncate_large_text(text, file_size)
            if was_truncated:
                stats["truncated"] += 1

            if file_size > 500 * 1024:
                stats["large_files"].append((rel.as_posix(), file_size))

            out.write(f"\n{'=' * 80}\n")
            out.write(f"File: {rel.as_posix()}\n")
            if was_truncated:
                out.write(f"NOTE: File lớn {file_size // 1024}KB — đã truncate (giữ đầu + cuối).\n")
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
        out.write(f"Files truncated: {stats['truncated']}\n")
        out.write(f"Files skipped : {stats['skipped_binary'] + stats['skipped_size'] + len(stats['errors'])}\n")
        out.write(f"Total content : {stats['total_source_bytes'] / 1024:.1f} KB\n")

        if stats["large_files"]:
            out.write(f"\nLarge files (>500KB) — đã truncate:\n")
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
            "  python mergecode.py --include-only frontend/src/routes frontend/src/pages -o fe.txt\n"
        ),
    )
    script_dir = Path(__file__).resolve().parent
    default_root = ".." if Path.cwd().resolve() == script_dir else "."
    parser.add_argument("-r", "--root", default=default_root, help=f"Thư mục gốc (mặc định: {default_root})")
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
        mode = "HYBRID (explicit + auto-scan)"
        files, missing = collect_files_explicit(
            root=root,
            explicit_files=EXPLICIT_FILES,
            extra_excludes=extra_excludes,
            secret_patterns=secret_patterns,
        )
        seen = {p.as_posix() for p in files}

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
    if stats["truncated"]:
        print(f"     Truncate       : {stats['truncated']} file lớn", file=sys.stderr)
    if stats["skipped_binary"]:
        print(f"     Bỏ qua (binary): {stats['skipped_binary']} file", file=sys.stderr)
    if stats["skipped_size"]:
        print(f"     Bỏ qua (size)  : {stats['skipped_size']} file", file=sys.stderr)
    if stats["errors"]:
        print(f"     Lỗi đọc        : {len(stats['errors'])} file", file=sys.stderr)
        for rel, err in stats["errors"][:5]:
            print(f"        - {rel}: {err}", file=sys.stderr)
    if stats["large_files"]:
        print(f"     File lớn >500KB: {len(stats['large_files'])} file (đã truncate)", file=sys.stderr)
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
    except Exception as e:
        print(f"\n[ERR] Lỗi không mong muốn: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)