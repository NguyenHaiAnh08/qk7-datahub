// backend/src/duplicate-docs.js
// Báo cáo "Tài liệu trùng" (CHỈ ĐỌC — không xóa, không sửa tệp hay dữ liệu).
//   Gom theo NỘI DUNG tệp (SHA-256 của tệp thật trên đĩa; tệp đã mất thì dùng SHA-256 lưu trong DB).
//   Một nhóm là "trùng" khi cùng nội dung mà có ≥ 2 bản ghi văn bản, hoặc ≥ 2 tệp trên đĩa.
//   Không quét uploads/bai-giang-so: gói bài giảng có nhiều tệp giống nhau một cách hợp lệ.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPool } = require('./db');

const BACKEND_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(BACKEND_DIR, 'uploads');
const SKIP_DIRS = new Set(['bai-giang-so', 'hoc-lieu-so', '_cach-ly']);

const hashCache = new Map(); // relPath → { size, mtimeMs, sha } — chỉ băm lại khi tệp thay đổi

async function listPdfFiles(dir, top = true, out = []) {
  let entries = [];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!(top && SKIP_DIRS.has(e.name))) await listPdfFiles(abs, false, out);
    } else if (e.isFile() && /\.pdf$/i.test(e.name)) {
      out.push({ abs, rel: path.relative(BACKEND_DIR, abs).split(path.sep).join('/') });
    }
  }
  return out;
}

async function hashFile({ abs, rel }) {
  const st = await fs.promises.stat(abs);
  const cached = hashCache.get(rel);
  if (cached && cached.size === st.size && cached.mtimeMs === st.mtimeMs) return cached;
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(abs)) hash.update(chunk); // đọc theo luồng, không chặn server
  const entry = { size: st.size, mtimeMs: st.mtimeMs, sha: hash.digest('hex') };
  hashCache.set(rel, entry);
  return entry;
}

const docState = (d) => {
  if (!d.deleted_at) return 'ACTIVE';
  return d.deleted_reason === 'PENDING_APPROVAL' ? 'PENDING' : 'TRASH';
};

async function buildDuplicateReport({ clearance }) {
  const pool = await getPool();
  const [docsRes, propRes, verRes] = await Promise.all([
    pool.request().query(`
      SELECT d.file_id, d.document_code, d.title, d.security_level_id, d.stored_path, d.sha256, d.file_size,
             d.created_at, d.deleted_at, d.deleted_reason, u.full_name AS uploader_name, un.name AS unit_name
      FROM DOCUMENT d
      LEFT JOIN [USER] u ON u.user_id = d.uploaded_by
      LEFT JOIN UNIT un ON un.unit_id = d.issuing_unit_id`),
    pool.request().query(`SELECT proposal_id, file_id, status, new_stored_path
                          FROM DOCUMENT_REVISION_PROPOSAL WHERE new_stored_path IS NOT NULL`),
    // Bảng phiên bản (nếu có dữ liệu) cũng giữ tham chiếu tới tệp
    pool.request().query(`IF OBJECT_ID('DOCUMENT_VERSION') IS NOT NULL
                          SELECT stored_path FROM DOCUMENT_VERSION WHERE stored_path IS NOT NULL
                          ELSE SELECT CAST(NULL AS NVARCHAR(500)) AS stored_path WHERE 1 = 0`),
  ]);

  const files = new Map(); // relPath → { path, size, sha }
  for (const f of await listPdfFiles(UPLOADS_DIR)) {
    try {
      const h = await hashFile(f);
      files.set(f.rel, { path: f.rel, size: h.size, sha: h.sha });
    } catch (e) {
      console.warn('[duplicate-docs] không đọc được', f.rel, e.message);
    }
  }

  const groups = new Map(); // sha → { files: Map, documents: [] }
  const groupOf = (sha) => {
    if (!groups.has(sha)) groups.set(sha, { sha, files: new Map(), documents: [] });
    return groups.get(sha);
  };

  const referenced = new Set();
  for (const f of files.values()) {
    groupOf(f.sha).files.set(f.path, { path: f.path, size: f.size, refs: 0, proposals: 0 });
  }

  let missingRecords = 0;
  for (const d of docsRes.recordset) {
    const file = files.get(d.stored_path);
    if (!file) missingRecords += 1;
    referenced.add(d.stored_path);
    const sha = file?.sha || String(d.sha256 || '').trim().toLowerCase();
    if (!sha) continue;
    const g = groupOf(sha);
    if (file) g.files.get(file.path).refs += 1;
    const hidden = Number(d.security_level_id) > clearance;
    g.documents.push({
      file_id: d.file_id,
      document_code: hidden ? null : d.document_code,
      title: hidden ? '(Vượt cấp độ mật của bạn)' : d.title,
      security_level_id: d.security_level_id,
      uploader_name: d.uploader_name,
      unit_name: d.unit_name,
      created_at: d.created_at,
      state: docState(d),
      stored_path: d.stored_path,
      file_missing: !file,
    });
  }

  for (const p of propRes.recordset) {
    referenced.add(p.new_stored_path);
    const file = files.get(p.new_stored_path);
    if (file) groupOf(file.sha).files.get(file.path).proposals += 1;
  }
  for (const v of verRes.recordset) {
    referenced.add(v.stored_path);
    const file = files.get(v.stored_path);
    if (file) groupOf(file.sha).files.get(file.path).refs += 1;
  }

  const duplicates = [...groups.values()]
    .filter((g) => g.documents.length > 1 || g.files.size > 1)
    .map((g) => {
      const list = [...g.files.values()].map((f) => ({ ...f, orphan: !referenced.has(f.path) }));
      const size = list[0]?.size || 0;
      return {
        sha256: g.sha,
        size,
        extra_files: Math.max(0, list.length - 1),
        extra_bytes: Math.max(0, list.length - 1) * size,
        active_count: g.documents.filter((d) => d.state === 'ACTIVE').length,
        files: list,
        documents: g.documents.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
      };
    })
    .sort((a, b) => b.active_count - a.active_count || b.documents.length - a.documents.length);

  return {
    summary: {
      scanned_files: files.size,
      groups: duplicates.length,
      extra_files: duplicates.reduce((s, g) => s + g.extra_files, 0),
      extra_bytes: duplicates.reduce((s, g) => s + g.extra_bytes, 0),
      orphan_files: [...files.keys()].filter((k) => !referenced.has(k)).length,
      missing_records: missingRecords,
    },
    groups: duplicates,
  };
}

// GET /api/documents/duplicates — chỉ Quản trị viên (ROL-01)
function createDuplicateReportHandler({ resolveUserRoles }) {
  return async (req, res) => {
    try {
      const roles = await resolveUserRoles(req.user);
      if (!roles.includes('ROL-01')) {
        return res.status(403).json({ error: 'Chỉ Quản trị viên được kiểm tra tài liệu trùng.' });
      }
      res.json(await buildDuplicateReport({ clearance: Number(req.user.clearance_level_id) || 1 }));
    } catch (err) {
      console.error('[GET /api/documents/duplicates]', err);
      res.status(500).json({ error: 'Không thể kiểm tra tài liệu trùng.' });
    }
  };
}

module.exports = { buildDuplicateReport, createDuplicateReportHandler };
