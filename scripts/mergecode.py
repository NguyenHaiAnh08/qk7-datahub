#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QK7 PROJECT MERGER v6.0 — LEAN MODE
Tự động loại bỏ: base64 blob, @font-face, swagger schema, config chi tiết,
blank lines, comment divider, duplicate files.
"""
from __future__ import annotations
import argparse, json, math, os, re, sys, time
from datetime import datetime
from pathlib import Path

__version__ = "6.0.0"

# ═══════════════════════════════════════════════════════════════════
# 1. SKIP HOÀN TOÀN — không cần trong txt
# ═══════════════════════════════════════════════════════════════════
SKIP_FILES_EXACT = {
    "touchid_assets.ts",       # 250 KB base64 blob
    "fonts.css",               # 25 KB @font-face
    "AIChatWidget.tsx",        # duplicate — App.tsx dùng AIChatDrawer
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "skills-lock.json", "tsconfig.tsbuildinfo",
    "setuppw.js",              # đã comment out toàn bộ
}
SKIP_DIRS = {
    "node_modules", "dist", "build", "out", "public", "uploads", "certs",
    ".git", ".svn", ".idea", ".vscode", "__pycache__",
    "scripts", "tools", "docs", "reports", "data", "config",
    "test", "tests", "__tests__", "spec", "specs",
}
SKIP_EXTS = {
    ".md", ".txt", ".rst", ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".bat", ".ps1", ".sh", ".cmd",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".mp3", ".mp4", ".wav", ".webm",
    ".zip", ".rar", ".7z", ".tar", ".gz",
    ".exe", ".dll", ".so", ".bin", ".pyc", ".class", ".jar",
    ".db", ".sqlite", ".lock", ".ttf", ".otf", ".woff", ".woff2",
    ".log", ".tmp",
}
VALID_EXTS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
              ".json", ".css", ".html", ".sql"}
SUMMARIZE_CONFIG_FILES = {"package.json", "tsconfig.json",
                          "vite.config.ts", "vite.config.js",
                          "tailwind.config.js", "postcss.config.js"}

# ═══════════════════════════════════════════════════════════════════
# 2. TRANSFORMERS
# ═══════════════════════════════════════════════════════════════════
def strip_base64_and_blobs(text: str) -> tuple[str, int]:
    out, count = [], 0
    for line in text.split("\n"):
        # Data URI
        if re.search(r'data:image/[\w+]+;base64,', line):
            m = re.match(r'^(\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*["\']?)', line)
            prefix = m.group(1) if m else ""
            out.append(f'{prefix}"[DATA_URI_BLOB_REMOVED]"')
            count += 1
            continue
        # Dòng base64 thuần > 500 chars
        if len(line) > 500 and re.match(r'^\s*[A-Za-z0-9+/=]{500,}\s*$', line):
            out.append(f"  // [BASE64_BLOB_REMOVED — {len(line)} chars]")
            count += 1
            continue
        # Dòng dài bất kỳ > 2000 chars
        if len(line) > 2000:
            out.append(f"{line[:150]}...[{len(line)-150} CHARS REMOVED]")
            count += 1
            continue
        out.append(line)
    return "\n".join(out), count


def strip_blank_lines_and_decoration(text: str) -> str:
    """Nén blank ≤1, trim trailing, bỏ comment divider."""
    result, blank = [], 0
    for line in text.split("\n"):
        stripped = line.rstrip()
        # // ====, /* ====, # ====, // ----, // ****
        if re.match(r'^\s*(?://|#|/\*)\s*[=\-*#─━═•]{3,}\s*(?:\*/)?\s*$', stripped):
            continue
        # /* ===== */
        if re.match(r'^\s*/\*[=\-*#]{5,}\*/\s*$', stripped):
            continue
        if stripped == "":
            blank += 1
            if blank <= 1:
                result.append("")
        else:
            blank = 0
            result.append(stripped)
    return "\n".join(result)


def strip_font_faces(text: str) -> str:
    return re.sub(r'@font-face\s*\{[^{}]*?\}\s*',
                  '[FONT_FACE_REMOVED]\n', text, flags=re.DOTALL)


def summarize_swagger(text: str) -> str:
    paths = re.findall(r"['\"](/api/[^'\"]+)['\"]\s*:", text)
    seen = []
    for p in paths:
        if p not in seen:
            seen.append(p)
    lines = ["=== SWAGGER SUMMARY — đã lược bỏ toàn bộ schema/example ==="]
    lines += [f"  {p}" for p in seen]
    lines.append(f"\n[Total: {len(seen)} paths — schema/security/example đã bỏ]")
    return "\n".join(lines)


def summarize_config(text: str, filename: str) -> str:
    if filename == "package.json":
        try:
            data = json.loads(text)
            keep = {k: data.get(k) for k in
                    ("name", "version", "main", "type", "scripts", "engines")
                    if k in data}
            if "dependencies" in data:
                keep["dependencies_keys"] = sorted(data["dependencies"].keys())
            if "devDependencies" in data:
                keep["devDependencies_keys"] = sorted(data["devDependencies"].keys())
            return json.dumps(keep, indent=2, ensure_ascii=False)
        except json.JSONDecodeError:
            return text
    if filename == "tsconfig.json":
        try:
            data = json.loads(text)
            keep = {k: data[k] for k in
                    ("compilerOptions", "include", "exclude") if k in data}
            return json.dumps(keep, indent=2, ensure_ascii=False)
        except json.JSONDecodeError:
            return text
    return text


def is_binary_file(path: Path, sample: int = 8192) -> bool:
    try:
        with open(path, "rb") as f:
            chunk = f.read(sample)
    except OSError:
        return True
    if not chunk:
        return False
    if b"\x00" in chunk:
        return True
    try:
        chunk.decode("utf-8"); return False
    except UnicodeDecodeError:
        pass
    text = chunk.decode("latin-1", errors="ignore")
    non_print = sum(1 for c in text if ord(c) < 32 and c not in "\n\r\t\f\b")
    return (non_print / max(len(text), 1)) > 0.30


def read_text_safe(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("utf-8", "utf-8-sig", "utf-16", "utf-16-le", "utf-16-be"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("latin-1", errors="replace")


# ═══════════════════════════════════════════════════════════════════
# 3. REDACT
# ═══════════════════════════════════════════════════════════════════
SECRET_RULES = [
    (re.compile(r'(?i)\b(FP_ENC_KEY|JWT_SECRET|API_KEY|SECRET_KEY|BRIDGE_TOKEN|FINGERPRINT_BRIDGE_TOKEN|ENCRYPTION_KEY|TOKEN_SECRET)\s*[:=]\s*["\']?([A-Za-z0-9+/=_\-\.]{12,})["\']?'),
     r'\1="[REDACTED]"'),
    (re.compile(r'(?i)\b(password|pwd|db_password|admin_password)\s*[:=]\s*["\']([^"\'\n\r]{3,})["\']'),
     r'\1="[REDACTED]"'),
    (re.compile(r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'),
     '[PRIVATE_KEY_REDACTED]'),
    (re.compile(r'(?i)\bBearer\s+[A-Za-z0-9_\-\.]{20,}'),
     'Bearer [REDACTED]'),
]

def redact(text: str) -> str:
    for p, r in SECRET_RULES:
        text = p.sub(r, text)
    return text


# ═══════════════════════════════════════════════════════════════════
# 4. COLLECT
# ═══════════════════════════════════════════════════════════════════
def collect_files(root: Path, full_stack: bool = False) -> list[Path]:
    targets = ["backend", "frontend"]
    if full_stack:
        targets += ["boxchat", "fingerprint", "ocr-service"]
    found = []
    for t in targets:
        d = root / t
        if not d.exists():
            continue
        for cur_str, dirnames, filenames in os.walk(d, followlinks=False):
            cur = Path(cur_str)
            dirnames[:] = [x for x in dirnames
                           if x not in SKIP_DIRS and not x.startswith(".")]
            for name in filenames:
                if name in SKIP_FILES_EXACT:
                    continue
                fp = cur / name
                ext = fp.suffix.lower()
                if ext in SKIP_EXTS or ext not in VALID_EXTS:
                    continue
                if name.startswith(".") and name not in {
                        ".gitignore", ".eslintrc", ".prettierrc"}:
                    continue
                if is_binary_file(fp):
                    continue
                found.append(fp.relative_to(root))
    order = {"backend": 1, "frontend": 2, "boxchat": 3,
             "fingerprint": 4, "ocr-service": 5}
    found.sort(key=lambda p: (order.get(p.parts[0], 99), p.as_posix().lower()))
    return found


# ═══════════════════════════════════════════════════════════════════
# 5. TREE
# ═══════════════════════════════════════════════════════════════════
def build_tree(paths: list[Path]) -> str:
    tree: dict = {}
    for p in paths:
        node = tree
        for part in p.parts[:-1]:
            node = node.setdefault(part, {})
        node[p.parts[-1]] = None
    lines: list[str] = []
    def walk(node: dict, prefix: str = ""):
        items = sorted(node.items(), key=lambda kv: (kv[1] is None, kv[0].lower()))
        for i, (name, child) in enumerate(items):
            last = i == len(items) - 1
            lines.append(f"{prefix}{'└── ' if last else '├── '}{name}")
            if child is not None:
                walk(child, prefix + ("    " if last else "│   "))
    walk(tree)
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════
# 6. TRANSFORM + WRITE
# ═══════════════════════════════════════════════════════════════════
FILE_END = "--- END OF FILE ---"

def transform(text: str, rel: Path) -> tuple[str, dict]:
    st = {"blobs_removed": 0, "summarized": None}
    if rel.name == "swagger.js":
        return summarize_swagger(text), {**st, "summarized": "swagger"}
    if rel.name in SUMMARIZE_CONFIG_FILES:
        return summarize_config(text, rel.name), {**st, "summarized": "config"}
    text, n = strip_base64_and_blobs(text)
    st["blobs_removed"] = n
    text = strip_blank_lines_and_decoration(text)
    return text, st


def write_part(root, files, out_path, mode, part_idx, total_parts, tree_str=None):
    stats = {"written": 0, "errors": [], "blobs_removed": 0,
             "written_files": []}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="\n") as out:
        out.write("=" * 80 + "\n")
        out.write("QK7 DATAHUB — LEAN MERGED SOURCE CODE (BE & FE)\n")
        out.write(f"Mode     : {mode}\n")
        out.write(f"Part     : {part_idx}/{total_parts}\n")
        out.write(f"Files    : {len(files)}\n")
        out.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        out.write("ĐÃ LOẠI BỎ: base64 blob, @font-face, swagger schema,\n")
        out.write("            config chi tiết, blank lines, comment divider.\n")
        out.write("=" * 80 + "\n\n")
        if part_idx == 1 and tree_str:
            out.write("=== PROJECT TREE ===\n" + tree_str + "\n\n")
        out.write(f"=== FILE CONTENTS (Part {part_idx}/{total_parts}) ===\n\n")
        for rel in files:
            abs_path = root / rel
            try:
                if not abs_path.exists():
                    continue
                size = abs_path.stat().st_size
                text = redact(read_text_safe(abs_path))
                text, tr = transform(text, rel)
                stats["blobs_removed"] += tr["blobs_removed"]
                tag = ""
                if tr["summarized"]:
                    tag = f" [SUMMARIZED: {tr['summarized']}]"
                out.write(f"\n{'=' * 80}\nFile: {rel.as_posix()} ({size / 1024:.1f} KB){tag}\n{'=' * 80}\n\n")
                out.write(text)
                if not text.endswith("\n"):
                    out.write("\n")
                out.write(f"\n{FILE_END}\n")
                out.flush()
                stats["written"] += 1
                stats["written_files"].append(rel.as_posix())
            except Exception as e:
                stats["errors"].append((rel.as_posix(), str(e)))
                out.write(f"\n{'=' * 80}\nFile: {rel.as_posix()} [ERROR: {e}]\n{'=' * 80}\n{FILE_END}\n")
        out.write("\n" + "=" * 80 + "\n=== SUMMARY ===\n")
        out.write(f"Files written : {stats['written']}/{len(files)}\n")
        out.write(f"Blobs removed : {stats['blobs_removed']}\n")
        out.write(f"Errors        : {len(stats['errors'])}\n")
        out.write("=" * 80 + "\n")
    return stats


def write_merged(root, files, output, mode, split_mb=0.0):
    if split_mb > 0:
        sizes = [(f, (root/f).stat().st_size if (root/f).exists() else 0)
                 for f in files]
        total = sum(s for _, s in sizes)
        n_parts = max(1, math.ceil(total / (split_mb * 1024 * 1024)))
        target = total / n_parts
        parts, cur, cur_size = [], [], 0
        for f, sz in sizes:
            if cur_size + sz > target and cur:
                parts.append(cur); cur, cur_size = [], 0
            cur.append(f); cur_size += sz
        if cur:
            parts.append(cur)
    else:
        parts = [files]
    tree_str = build_tree(files)
    agg = {"written": 0, "blobs_removed": 0, "errors": []}
    out_files = []
    for i, p_files in enumerate(parts, 1):
        op = (output.with_name(f"{output.stem}-part{i:02d}{output.suffix}")
              if len(parts) > 1 else output)
        s = write_part(root, p_files, op, mode, i, len(parts), tree_str)
        agg["written"] += s["written"]
        agg["blobs_removed"] += s["blobs_removed"]
        agg["errors"].extend(s["errors"])
        out_files.append((op, s["written"]))
    return agg, out_files


# ═══════════════════════════════════════════════════════════════════
# 7. CLI
# ═══════════════════════════════════════════════════════════════════
def main():
    ap = argparse.ArgumentParser(
        prog="mergecode_lean.py",
        description="Merge BE & FE lean v6.0 — loại bỏ base64, fonts, swagger schema, config chi tiết.")
    ap.add_argument("-r", "--root", default=".")
    ap.add_argument("-o", "--output", default="merged_lean.txt")
    ap.add_argument("--split-mb", type=float, default=0.0,
                    help="Chia output thành part N MB (0 = không chia)")
    ap.add_argument("--full-stack", action="store_true")
    ap.add_argument("-V", "--version", action="version",
                    version=f"%(prog)s {__version__}")
    args = ap.parse_args()
    root = Path(args.root).resolve()
    files = collect_files(root, args.full_stack)
    if not files:
        print("Không tìm thấy file.", file=sys.stderr)
        sys.exit(0)
    print(f"[INFO] Root        : {root}", file=sys.stderr)
    print(f"[INFO] Total files : {len(files)}", file=sys.stderr)
    mode = "LEAN" + (" +FullStack" if args.full_stack else "")
    t0 = time.time()
    stats, outs = write_merged(root, files, Path(args.output).resolve(),
                                mode, args.split_mb)
    print(f"[OK] {time.time()-t0:.1f}s — "
          f"written {stats['written']}, "
          f"blobs removed {stats['blobs_removed']}", file=sys.stderr)
    for op, cnt in outs:
        sz = op.stat().st_size / 1024 / 1024
        print(f"     {op} ({cnt} files, {sz:.2f} MB)", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
    except Exception as e:
        print(f"ERR: {e}", file=sys.stderr)
        sys.exit(1)