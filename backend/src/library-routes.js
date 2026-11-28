// backend/src/library-routes.js
// ═══════════════════════════════════════════════════════════════════════
// PHÂN HỆ THƯ VIỆN SỐ — /api/library
//
// Tài liệu thư viện là một dòng DOCUMENT (file_id 'LIB-…') kèm một dòng LIBRARY_ITEM.
// Thư viện MỞ CHO MỌI NGƯỜI (kể cả Đại biểu): tài liệu luôn là Cấp 1 – Công khai, không phân cấp mật.
// Dùng lại: xem/tải /api/files/:fileId/view, nhật ký, hàng chờ đề xuất
// /api/documents/proposals/* (duyệt, từ chối, thẩm định, người đăng xem trước).
// Tiến độ đọc của từng người lưu ở LIBRARY_READING.
// Số trang và ảnh bìa (tự lấy trang 1, người đăng đổi được) xem src/library-media.js.
//
// Quy tắc duyệt: chỉ Admin (ROL-01) hoặc Chỉ huy (ROL-02, khi quyền không bị khóa bảo vệ)
// được lưu thẳng. Người khác đăng tải / chỉnh sửa → đề xuất chờ duyệt.
//
// Cần chạy một lần:  node backend/migrations/create_library_module.cjs
// ═══════════════════════════════════════════════════════════════════════
'use strict';
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { sql, getPool } = require('./db');
const { getModuleUploadPath, MODULES } = require('./storage-helper');
const lifecycle = require('./document-lifecycle');
const { getSubtreeUnits } = require('./unit-scope');
const media = require('./library-media');

const LIB_ID_RX = /^LIB-[A-Za-z0-9-]{1,46}$/i;
const isLibraryId = (id) => /^LIB-/i.test(String(id || ''));
const CODE_RX = /^[A-Za-z0-9À-ỹ][A-Za-z0-9À-ỹ\-/._ ]{0,99}$/;
const EMPTY_TRASH_CONFIRM = 'DON-SACH-THUNG-RAC';
const PUBLIC_LEVEL = 1;
// Văn bản cấp Trường / Ban Giám hiệu dùng nhiều mã đơn vị (cùng cách gộp với Văn bản số)
const SCHOOL_BOARD_UNITS = ['BGH-TQSQK', 'U-BGH', 'TQS', 'TQS-QK7', 'U-TQS'];
const MAX_PAGES = 100000;
const COVER_PATH_RX = /^uploads\/thu-vien-so\/(?!.*\.\.)[A-Za-z0-9_\-./]+\.jpg$/;
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Nhận tệp PDF ("file") và ảnh bìa tùy chọn ("cover")
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname || '';
    if (file.fieldname === 'cover') {
      return COVER_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error('Ảnh bìa phải là JPG, PNG hoặc WebP'));
    }
    if (name.includes('\0') || name.includes('..') || !name.toLowerCase().endsWith('.pdf') || file.mimetype !== 'application/pdf') {
      return cb(new Error('Chỉ chấp nhận file PDF hợp lệ'));
    }
    return cb(null, true);
  },
}).fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }]);
const newId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

let readyCache = { ok: false, at: 0 };
async function libraryReady() {
  if (readyCache.ok || Date.now() - readyCache.at < 30 * 1000) return readyCache.ok;
  let ok = false;
  try {
    const r = await (await getPool()).request().query(
      `SELECT CASE WHEN OBJECT_ID('LIBRARY_CATEGORY') IS NOT NULL AND OBJECT_ID('LIBRARY_ITEM') IS NOT NULL
                    AND OBJECT_ID('LIBRARY_PROPOSAL') IS NOT NULL THEN 1 ELSE 0 END AS ok`);
    ok = r.recordset[0].ok === 1;
  } catch (e) {
    console.warn('[library] kiểm tra migration lỗi:', e.message);
  }
  readyCache = { ok, at: Date.now() };
  return ok;
}

let readingCache = { ok: false, at: 0 };
async function readingReady() {
  if (readingCache.ok || Date.now() - readingCache.at < 30 * 1000) return readingCache.ok;
  let ok = false;
  try {
    const r = await (await getPool()).request().query(`SELECT OBJECT_ID('LIBRARY_READING') AS id`);
    ok = Boolean(r.recordset[0].id);
  } catch (e) {
    console.warn('[library] kiểm tra bảng tiến độ đọc lỗi:', e.message);
  }
  readingCache = { ok, at: Date.now() };
  return ok;
}

let mediaCache = { ok: false, at: 0 };
/** Đã có cột số trang / ảnh bìa chưa. Chưa có thì thư viện vẫn chạy, chỉ không có bìa */
async function mediaReady() {
  if (mediaCache.ok || Date.now() - mediaCache.at < 30 * 1000) return mediaCache.ok;
  let ok = false;
  try {
    const r = await (await getPool()).request().query(`SELECT CASE WHEN
      COL_LENGTH('LIBRARY_ITEM','page_count') IS NOT NULL AND COL_LENGTH('LIBRARY_ITEM','cover_path') IS NOT NULL
      AND COL_LENGTH('LIBRARY_ITEM','cover_custom') IS NOT NULL AND COL_LENGTH('LIBRARY_PROPOSAL','page_count') IS NOT NULL
      AND COL_LENGTH('LIBRARY_PROPOSAL','cover_path') IS NOT NULL AND COL_LENGTH('LIBRARY_PROPOSAL','cover_custom') IS NOT NULL
      THEN 1 ELSE 0 END AS ok`);
    ok = r.recordset[0].ok === 1;
  } catch (e) {
    console.warn('[library] kiểm tra cột ảnh bìa lỗi:', e.message);
  }
  mediaCache = { ok, at: Date.now() };
  return ok;
}

/** Xóa ảnh bìa khi không còn tài liệu hay đề xuất đang chờ nào dùng */
async function removeCoverIfUnused(relPath) {
  if (!relPath || !COVER_PATH_RX.test(relPath)) return;
  const r = await (await getPool()).request().input('p', sql.NVarChar(500), relPath)
    .query(`SELECT (SELECT COUNT(*) FROM LIBRARY_ITEM WHERE cover_path = @p)
                 + (SELECT COUNT(*) FROM LIBRARY_PROPOSAL lp
                      JOIN DOCUMENT_REVISION_PROPOSAL p ON p.proposal_id = lp.proposal_id
                     WHERE lp.cover_path = @p AND p.status IN ('PENDING', 'PENDING_OWNER')) AS n`);
  if (r.recordset[0].n !== 0) return;
  try {
    const abs = path.join(__dirname, '..', relPath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    console.warn('[library] xóa ảnh bìa:', e.message);
  }
}

/**
 * Bổ sung các trường riêng của thư viện vào danh sách đề xuất chờ duyệt (chỉ truy vấn khi
 * có đề xuất thư viện, nên máy chưa chạy migration không bị ảnh hưởng).
 */
async function enrichLibraryProposals(items) {
  const libs = (items || []).filter((p) => isLibraryId(p.file_id));
  if (!libs.length || !(await libraryReady())) return items;
  const req = (await getPool()).request();
  const params = libs.map((p, i) => { req.input(`p${i}`, sql.VarChar(50), p.proposal_id); return `@p${i}`; });
  const r = await req.query(`
    SELECT p.proposal_id,
           np.publisher, np.publish_year, nc.name AS library_category_name,
           li.publisher AS current_publisher, li.publish_year AS current_publish_year,
           cc.name AS current_library_category_name
    FROM DOCUMENT_REVISION_PROPOSAL p
    JOIN LIBRARY_PROPOSAL np ON np.proposal_id = p.proposal_id
    JOIN LIBRARY_CATEGORY nc ON nc.category_id = np.category_id
    LEFT JOIN LIBRARY_ITEM li ON li.file_id = p.file_id
    LEFT JOIN LIBRARY_CATEGORY cc ON cc.category_id = li.category_id
    WHERE p.proposal_id IN (${params.join(', ')})`);
  const byId = new Map(r.recordset.map((x) => [x.proposal_id, x]));
  for (const p of libs) Object.assign(p, byId.get(p.proposal_id) || {});
  if (await mediaReady()) {
    const mreq = (await getPool()).request();
    const names = libs.map((p, i) => { mreq.input(`m${i}`, sql.VarChar(50), p.proposal_id); return `@m${i}`; });
    const m = await mreq.query(`
      SELECT lp.proposal_id,
             ISNULL(lp.page_count, li.page_count) AS page_count, li.page_count AS current_page_count,
             RIGHT(ISNULL(lp.cover_path, li.cover_path), 24) AS cover_version,
             RIGHT(li.cover_path, 24) AS current_cover_version
      FROM LIBRARY_PROPOSAL lp
      JOIN DOCUMENT_REVISION_PROPOSAL p ON p.proposal_id = lp.proposal_id
      LEFT JOIN LIBRARY_ITEM li ON li.file_id = p.file_id
      WHERE lp.proposal_id IN (${names.join(', ')})`);
    const mediaById = new Map(m.recordset.map(({ proposal_id: id, ...rest }) => [id, rest]));
    for (const p of libs) p.library_media = mediaById.get(p.proposal_id);
  }
  return items;
}

/** Áp phần thông tin riêng của thư viện khi đề xuất được duyệt */
async function applyLibraryProposal(proposalId, fileId) {
  if (!isLibraryId(fileId) || !(await libraryReady())) return;
  await (await getPool()).request()
    .input('pid', sql.VarChar(50), proposalId)
    .input('fid', sql.VarChar(50), fileId)
    .query(`UPDATE li SET li.category_id = p.category_id, li.publisher = p.publisher, li.publish_year = p.publish_year
            FROM LIBRARY_ITEM li JOIN LIBRARY_PROPOSAL p ON p.proposal_id = @pid
            WHERE li.file_id = @fid`);
  if (!(await mediaReady())) return;
  // Trường để trống trong đề xuất nghĩa là giữ nguyên
  const r = await (await getPool()).request()
    .input('pid', sql.VarChar(50), proposalId)
    .input('fid', sql.VarChar(50), fileId)
    .query(`DECLARE @old NVARCHAR(500) = (SELECT cover_path FROM LIBRARY_ITEM WHERE file_id = @fid);
            UPDATE li SET li.page_count = ISNULL(p.page_count, li.page_count),
                          li.cover_path = ISNULL(p.cover_path, li.cover_path),
                          li.cover_custom = ISNULL(p.cover_custom, li.cover_custom)
            FROM LIBRARY_ITEM li JOIN LIBRARY_PROPOSAL p ON p.proposal_id = @pid
            WHERE li.file_id = @fid;
            SELECT CASE WHEN cover_path IS NOT NULL THEN @old END AS old_cover FROM LIBRARY_PROPOSAL WHERE proposal_id = @pid;`);
  await removeCoverIfUnused(r.recordset?.[0]?.old_cover);
}

function createLibraryRouter(deps) {
  const {
    upload, validateUploadedPdf, validateStoredPath, safePathJoin, rootDir,
    requireAuth, requirePermission, getUserPermissions, resolveUserRoles,
    writeAccessLog, getClientIp, isPermissionLocked, ownerFlowReady, syncToAI, unitExists,
    parseHandler, parseLimiter,
  } = deps;
  const router = express.Router();

  // ─── Tiện ích ───────────────────────────────────────────────
  const fail = (res, status, error, code, extra) => res.status(status).json({ error, code, ...extra });
  const wrap = (label, fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(`[library ${label}]`, err);
      if (!res.headersSent) res.status(500).json({ error: 'Lỗi máy chủ khi xử lý Thư viện số', code: 'LIBRARY_ERROR' });
    }
  };
  const log = (req, fileId, action, note) => writeAccessLog({
    userId: req.user.user_id, fileId, action, ip: getClientIp(req), note,
  });

  async function actorOf(req) {
    const authed = Boolean(req.user?.is_authenticated);
    const roles = authed ? await resolveUserRoles(req.user) : [];
    const all = new Set([...(roles || []), ...(authed ? req.user.roles || [] : [])]);
    const isAdmin = all.has('ROL-01') || (authed && req.user.user_id === 'USR-001');
    return {
      authed,
      userId: authed ? req.user.user_id : null,
      isAdmin,
      isCommander: all.has('ROL-02'),
    };
  }

  const holds = async (actor, code) => actor.isAdmin
    || (actor.authed && (await getUserPermissions(actor.userId)).includes(code));

  const SELECT_ITEM = `
    d.file_id, d.document_code, d.title, d.summary, d.signer AS author,
    li.category_id, c.name AS category_name, li.publisher, li.publish_year,
    d.issuing_unit_id, u.name AS unit_name, d.security_level_id,
    d.original_name, d.file_size, d.uploaded_by, up.full_name AS uploaded_by_name,
    d.created_at, d.updated_at`;
  // Không lộ đường dẫn ảnh bìa: chỉ trả "phiên bản" (đuôi tên tệp) để trình duyệt tải lại khi đổi bìa
  const selectItem = async () => SELECT_ITEM + ((await mediaReady())
    ? ', li.page_count, RIGHT(li.cover_path, 24) AS cover_version, li.cover_custom'
    : ', NULL AS page_count, NULL AS cover_version, 0 AS cover_custom');
  const FROM_ITEM = `
    FROM DOCUMENT d
    JOIN LIBRARY_ITEM li ON li.file_id = d.file_id
    JOIN LIBRARY_CATEGORY c ON c.category_id = li.category_id
    LEFT JOIN UNIT u ON u.unit_id = d.issuing_unit_id
    LEFT JOIN [USER] up ON up.user_id = d.uploaded_by`;

  /** Nạp một tài liệu để thao tác; tự trả lỗi 404 và trả null nếu không có */
  async function loadItem(req, res) {
    const id = req.params.fileId;
    const r = LIB_ID_RX.test(id) ? await (await getPool()).request()
      .input('fid', sql.VarChar(50), id)
      .query(`SELECT ${await selectItem()}, d.stored_path, d.mime_type, d.sha256, d.deleted_at, d.deleted_reason
              ${(await mediaReady()) ? ', li.cover_path' : ''}
              ${FROM_ITEM} WHERE d.file_id = @fid AND d.security_level_id = ${PUBLIC_LEVEL}`) : { recordset: [] };
    const item = r.recordset[0];
    if (!item) { fail(res, 404, 'Không tìm thấy tài liệu thư viện', 'LIBRARY_NOT_FOUND'); return null; }
    return item;
  }

  // Đọc & kiểm tra thông tin nhập. current = giá trị cũ khi sửa (trường không gửi thì giữ nguyên)
  async function readFields(req, res, current) {
    const body = req.body || {};
    const pick = (key, old) => (body[key] === undefined ? old : String(body[key] ?? '').trim());
    const f = {
      title: pick('title', current?.title) || '',
      categoryId: pick('category_id', current?.category_id) || '',
      level: PUBLIC_LEVEL, // thư viện không phân cấp mật; giá trị gửi lên (nếu có) bị bỏ qua
      code: pick('document_code', current?.document_code) || null,
      author: pick('author', current?.author) || null,
      publisher: pick('publisher', current?.publisher) || null,
      year: pick('publish_year', current?.publish_year) || null,
      unitId: pick('issuing_unit_id', current?.issuing_unit_id) || null,
      summary: pick('summary', current?.summary) || null,
    };
    const bad = (msg, code) => { fail(res, 400, msg, code); return null; };
    if (!f.title) return bad('Thiếu tên tài liệu', 'MISSING_TITLE');
    if (f.title.length > 500) return bad('Tên tài liệu tối đa 500 ký tự', 'TITLE_TOO_LONG');
    if (!f.categoryId) return bad('Thiếu thể loại', 'MISSING_CATEGORY');
    if (f.code && !CODE_RX.test(f.code)) return bad('Mã tài liệu chỉ gồm chữ, số, gạch ngang, gạch chéo, dấu chấm', 'INVALID_DOCUMENT_CODE');
    if (f.author && f.author.length > 100) return bad('Tên tác giả tối đa 100 ký tự', 'AUTHOR_TOO_LONG');
    if (f.publisher && f.publisher.length > 200) return bad('Nhà xuất bản tối đa 200 ký tự', 'PUBLISHER_TOO_LONG');
    if (f.year !== null) {
      const y = Number(f.year);
      if (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear() + 1) return bad('Năm xuất bản không hợp lệ', 'INVALID_YEAR');
      f.year = y;
    }
    const cat = await (await getPool()).request()
      .input('c', sql.VarChar(30), f.categoryId)
      .query('SELECT active FROM LIBRARY_CATEGORY WHERE category_id = @c');
    const keepsOld = current && current.category_id === f.categoryId;
    if (!cat.recordset.length || (!cat.recordset[0].active && !keepsOld)) return bad('Thể loại không tồn tại hoặc đã ngừng sử dụng', 'INVALID_CATEGORY');
    if (f.unitId && !(await unitExists(f.unitId))) return bad('Đơn vị không có trong danh mục', 'INVALID_ISSUING_UNIT');
    return f;
  }

  // Ghi tệp PDF vào uploads/thu-vien-so/YYYY/MM/ — tên có đuôi ngẫu nhiên để hai bản ghi không dùng chung tệp
  function saveFile(file, code) {
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const now = new Date();
    const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const safe = String(code || 'TL').replace(/[\/\\\s]/g, '-').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40) || 'TL';
    const name = `${day}_TV_${safe}_${sha256.slice(0, 8)}_${crypto.randomBytes(3).toString('hex')}.pdf`;
    const { absPath: dir, relPath: relDir } = getModuleUploadPath(MODULES.LIBRARY, now);
    const relPath = `${relDir}/${name}`;
    if (!validateStoredPath(relPath)) throw new Error('Đường dẫn lưu tệp không hợp lệ');
    const absPath = path.join(dir, name);
    fs.writeFileSync(absPath, file.buffer);
    return { relPath, absPath, sha256, originalName: file.originalname.slice(0, 255), mime: file.mimetype, size: file.size };
  }

  const removeIfExists = (abs) => {
    try { if (abs && fs.existsSync(abs)) fs.unlinkSync(abs); } catch (e) { console.warn('[library] xóa tệp:', e.message); }
  };

  // Thư viện công khai: không nhận tệp đã có trong hệ thống ở cấp mật cao hơn, kể cả khi chọn "vẫn đăng"
  async function blockClassified(req, res, sha256) {
    const r = await (await getPool()).request().input('sha', sql.Char(64), sha256)
      .query(`SELECT TOP 1 x.file_id FROM (
                SELECT file_id FROM DOCUMENT WHERE sha256 = @sha AND security_level_id > ${PUBLIC_LEVEL}
                UNION ALL
                SELECT file_id FROM DOCUMENT_REVISION_PROPOSAL WHERE new_sha256 = @sha AND security_level_id > ${PUBLIC_LEVEL}
              ) x`);
    if (!r.recordset.length) return false;
    await log(req, r.recordset[0].file_id, 'LIB_CLASSIFIED_BLOCKED', 'Chặn đưa tệp trùng tài liệu có độ mật vào thư viện công khai');
    fail(res, 409, 'Tệp này trùng với một tài liệu có độ mật trong hệ thống nên không được đưa vào thư viện công khai.', 'CLASSIFIED_DUPLICATE');
    return true;
  }

  async function unitIdsWithChildren(unitId) {
    const subtree = await getSubtreeUnits(unitId);
    const ids = new Set(subtree.length ? subtree : [unitId]);
    if (unitId === 'U-BGH' || unitId === 'BGH-TQSQK') SCHOOL_BOARD_UNITS.forEach((u) => ids.add(u));
    return [...ids];
  }

  // Chỉ xóa tệp khi không còn bản ghi nào trỏ tới
  async function removeUnreferenced(relPath) {
    if (!relPath || !validateStoredPath(relPath)) return;
    const r = await (await getPool()).request()
      .input('p', sql.NVarChar(500), relPath)
      .query(`SELECT (SELECT COUNT(*) FROM DOCUMENT WHERE stored_path = @p)
                   + (SELECT COUNT(*) FROM DOCUMENT_REVISION_PROPOSAL WHERE new_stored_path = @p
                        AND status IN ('PENDING', 'PENDING_OWNER')) AS n`);
    if (r.recordset[0].n === 0) removeIfExists(safePathJoin(rootDir, relPath));
  }

  // Nhận tệp tải lên; lỗi của multer trả 400 rõ nghĩa
  const receiveFiles = (req, res, next) => mediaUpload(req, res, (err) => {
    if (err) {
      return fail(res, 400, err.code === 'LIMIT_FILE_SIZE' ? 'Tệp vượt giới hạn 50 MB' : err.message, 'INVALID_UPLOAD');
    }
    req.file = req.files?.file?.[0];
    req.coverFile = req.files?.cover?.[0];
    return next();
  });

  const readStored = (relPath) => {
    const abs = relPath && validateStoredPath(relPath) ? safePathJoin(rootDir, relPath) : null;
    return abs && fs.existsSync(abs) ? fs.readFileSync(abs) : null;
  };

  /**
   * Quyết định số trang và ảnh bìa. Ưu tiên: ảnh người đăng chọn → yêu cầu dùng lại bìa tự động →
   * bìa tự động theo tệp mới (chỉ khi bìa hiện tại không phải do người dùng chọn).
   * Trả null nếu đã trả lỗi cho người gửi.
   */
  async function planMedia(req, res, item) {
    if (!(await mediaReady())) {
      if (!req.coverFile) return {};
      fail(res, 503, 'Chưa bật ảnh bìa. Chạy lại backend/migrations/create_library_module.sql', 'COVER_NOT_INITIALIZED');
      return null;
    }
    let custom = null;
    if (req.coverFile) {
      custom = await media.coverFromImage(req.coverFile.buffer);
      if (!custom) { fail(res, 400, 'Ảnh bìa phải là JPG, PNG hoặc WebP, tối đa 5 MB', 'INVALID_COVER'); return null; }
    }
    const revert = !custom && Boolean(item) && String(req.body?.cover_auto) === '1';
    let info = { pageCount: null, cover: null };
    if (req.file || revert) {
      const buffer = req.file ? req.file.buffer : readStored(item.stored_path);
      if (buffer) info = await media.inspectPdf(buffer);
    }
    const plan = {};
    if (req.file) plan.pageCount = info.pageCount || 0; // 0 = không đếm được
    if (custom) Object.assign(plan, { cover: custom, custom: true });
    else if (revert) {
      if (!info.cover) { fail(res, 422, 'Không tạo được ảnh bìa từ trang 1 của tệp', 'COVER_RENDER_FAILED'); return null; }
      Object.assign(plan, { cover: info.cover, custom: false });
    } else if (info.cover && (!item || !item.cover_custom)) Object.assign(plan, { cover: info.cover, custom: false });
    return plan;
  }

  function saveCover(jpeg, code) {
    const now = new Date();
    const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const safe = String(code || 'TL').replace(/[\/\\\s]/g, '-').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40) || 'TL';
    const name = `${day}_TV_${safe}_cover_${crypto.randomBytes(6).toString('hex')}.jpg`;
    const { absPath: dir, relPath: relDir } = getModuleUploadPath(MODULES.LIBRARY, now);
    const relPath = `${relDir}/${name}`;
    if (!COVER_PATH_RX.test(relPath)) throw new Error('Đường dẫn ảnh bìa không hợp lệ');
    const absPath = path.join(dir, name);
    fs.writeFileSync(absPath, jpeg);
    return { relPath, absPath };
  }

  /** Ghi số trang / bìa vào LIBRARY_ITEM (trường không có trong kế hoạch thì giữ nguyên) hoặc LIBRARY_PROPOSAL */
  async function writeMedia(q, table, id, plan, cover) {
    if (plan.pageCount === undefined && !cover) return;
    const key = table === 'LIBRARY_ITEM' ? 'file_id' : 'proposal_id';
    await q().input('id', sql.VarChar(50), id)
      .input('pc', sql.Int, plan.pageCount ?? null)
      .input('cp', sql.NVarChar(500), cover?.relPath || null)
      .input('cc', sql.Bit, cover ? Boolean(plan.custom) : null)
      .query(`UPDATE ${table} SET page_count = ISNULL(@pc, page_count), cover_path = ISNULL(@cp, cover_path),
                cover_custom = ISNULL(@cc, cover_custom) WHERE ${key} = @id`);
  }

  // Đếm trang và tạo bìa cho tài liệu đăng trước khi có tính năng này (chạy nền một lần mỗi lần khởi động)
  let backfillStarted = false;
  async function backfillMedia() {
    if (backfillStarted || !(await mediaReady()) || backfillStarted) return;
    backfillStarted = true;
    const pool = await getPool();
    const rows = (await pool.request().query(`SELECT li.file_id, li.cover_path, d.stored_path, d.document_code
      FROM LIBRARY_ITEM li JOIN DOCUMENT d ON d.file_id = li.file_id WHERE li.page_count IS NULL`)).recordset;
    let done = 0;
    for (const row of rows) {
      try {
        const buffer = readStored(row.stored_path);
        if (!buffer) continue;
        const info = await media.inspectPdf(buffer);
        const cover = info.cover && !row.cover_path ? saveCover(info.cover, row.document_code) : null;
        const r = await pool.request().input('id', sql.VarChar(50), row.file_id)
          .input('pc', sql.Int, info.pageCount || 0).input('cp', sql.NVarChar(500), cover?.relPath || null)
          .query(`UPDATE LIBRARY_ITEM SET page_count = @pc, cover_path = ISNULL(cover_path, @cp)
                  WHERE file_id = @id AND page_count IS NULL`);
        if (r.rowsAffected[0]) done += 1;
        else if (cover) removeIfExists(cover.absPath);
      } catch (e) {
        console.warn('[library] bổ sung bìa', row.file_id, e.message);
      }
    }
    if (rows.length) console.log(`[library] Đã bổ sung số trang / ảnh bìa cho ${done}/${rows.length} tài liệu`);
  }

  async function inTransaction(work) {
    const tx = new sql.Transaction(await getPool());
    await tx.begin();
    try {
      await work(() => new sql.Request(tx));
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }

  const bindFields = (request, f) => request
    .input('code', sql.NVarChar(100), f.code)
    .input('title', sql.NVarChar(500), f.title)
    .input('author', sql.NVarChar(100), f.author)
    .input('unit', sql.NVarChar(50), f.unitId)
    .input('summary', sql.NVarChar(sql.MAX), f.summary)
    .input('level', sql.Int, f.level)
    .input('cat', sql.VarChar(30), f.categoryId)
    .input('publisher', sql.NVarChar(200), f.publisher)
    .input('year', sql.Int, f.year);

  async function insertProposal(q, { proposalId, fileId, requesterId, status, ownerId, note, f, file }) {
    await bindFields(q(), f)
      .input('pid', sql.VarChar(50), proposalId)
      .input('fid', sql.VarChar(50), fileId)
      .input('req', sql.VarChar(50), requesterId)
      .input('path', sql.NVarChar(500), file?.relPath || null)
      .input('orig', sql.NVarChar(255), file?.originalName || null)
      .input('mime', sql.VarChar(100), file?.mime || null)
      .input('size', sql.BigInt, file?.size ?? null)
      .input('sha', sql.Char(64), file?.sha256 || null)
      .input('status', sql.VarChar(20), status)
      .input('note', sql.NVarChar(500), String(note).slice(0, 500))
      .query(`INSERT INTO DOCUMENT_REVISION_PROPOSAL (proposal_id, file_id, requester_id, document_code, title,
                issuing_unit_id, signer, summary, security_level_id, new_stored_path, new_original_name,
                new_mime_type, new_file_size, new_sha256, status, note, created_at, updated_at)
              VALUES (@pid, @fid, @req, @code, @title, @unit, @author, @summary, @level, @path, @orig,
                @mime, @size, @sha, @status, @note, GETDATE(), GETDATE());
              INSERT INTO LIBRARY_PROPOSAL (proposal_id, category_id, publisher, publish_year)
              VALUES (@pid, @cat, @publisher, @year)`);
    if (ownerId) {
      await q().input('pid', sql.VarChar(50), proposalId).input('o', sql.VarChar(50), ownerId)
        .query('UPDATE DOCUMENT_REVISION_PROPOSAL SET owner_id = @o WHERE proposal_id = @pid');
    }
  }

  const aiDoc = (fileId, f, storedPath) => ({
    file_id: fileId, document_code: f.code || fileId, title: f.title,
    stored_path: storedPath, security_level_id: f.level,
  });

  // ─── Chặn sớm khi chưa chạy migration ───────────────────────
  router.use(async (req, res, next) => {
    if (await libraryReady()) {
      backfillMedia().catch((e) => console.warn('[library] bổ sung bìa:', e.message));
      return next();
    }
    return fail(res, 503, 'Thư viện số chưa được khởi tạo cơ sở dữ liệu. Chạy: node backend/migrations/create_library_module.cjs', 'LIBRARY_NOT_INITIALIZED');
  });

  // ─── Danh mục thể loại ──────────────────────────────────────
  router.get('/categories', wrap('GET categories', async (req, res) => {
    const r = await (await getPool()).request()
      .query(`SELECT c.category_id, c.name, c.description, c.sort_order, c.active,
                (SELECT COUNT(*) FROM LIBRARY_ITEM li JOIN DOCUMENT d ON d.file_id = li.file_id
                  WHERE li.category_id = c.category_id AND d.deleted_at IS NULL AND d.security_level_id = ${PUBLIC_LEVEL}) AS item_count
              FROM LIBRARY_CATEGORY c ORDER BY c.sort_order, c.name`);
    res.json({ total: r.recordset.length, items: r.recordset });
  }));

  function readCategory(req, res) {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim() || null;
    const sort = parseInt(req.body?.sort_order ?? 100, 10);
    const active = !(req.body?.active === false || req.body?.active === 'false' || req.body?.active === 0);
    if (!name || name.length > 150) { fail(res, 400, 'Tên thể loại bắt buộc, tối đa 150 ký tự', 'INVALID_CATEGORY_NAME'); return null; }
    if (description && description.length > 500) { fail(res, 400, 'Mô tả tối đa 500 ký tự', 'DESCRIPTION_TOO_LONG'); return null; }
    if (!Number.isInteger(sort) || sort < 0 || sort > 100000) { fail(res, 400, 'Thứ tự không hợp lệ', 'INVALID_SORT_ORDER'); return null; }
    return { name, description, sort, active };
  }
  const isDuplicateKey = (err) => err?.number === 2627 || err?.number === 2601;

  async function saveCategory(req, res, id, isNew) {
    const c = readCategory(req, res);
    if (!c) return;
    try {
      const r = await (await getPool()).request()
        .input('id', sql.VarChar(30), id).input('n', sql.NVarChar(150), c.name)
        .input('d', sql.NVarChar(500), c.description).input('s', sql.Int, c.sort).input('a', sql.Bit, c.active)
        .query(isNew
          ? `INSERT INTO LIBRARY_CATEGORY (category_id, name, description, sort_order, active) VALUES (@id, @n, @d, @s, @a)`
          : `UPDATE LIBRARY_CATEGORY SET name = @n, description = @d, sort_order = @s, active = @a WHERE category_id = @id`);
      if (!r.rowsAffected[0]) return fail(res, 404, 'Không tìm thấy thể loại', 'CATEGORY_NOT_FOUND');
    } catch (err) {
      if (isDuplicateKey(err)) return fail(res, 409, 'Tên thể loại đã tồn tại', 'CATEGORY_DUPLICATE');
      throw err;
    }
    await log(req, null, isNew ? 'LIB_CATEGORY_CREATE' : 'LIB_CATEGORY_UPDATE', `${id}: ${c.name}`);
    return res.status(isNew ? 201 : 200).json({ success: true, category_id: id });
  }

  router.post('/categories', requireAuth, requirePermission('LIB_CATEGORY_MANAGE'),
    wrap('POST categories', (req, res) => saveCategory(req, res, `CAT-${Date.now().toString(36).toUpperCase()}`, true)));
  router.put('/categories/:categoryId', requireAuth, requirePermission('LIB_CATEGORY_MANAGE'),
    wrap('PUT categories', (req, res) => saveCategory(req, res, req.params.categoryId, false)));
  router.delete('/categories/:categoryId', requireAuth, requirePermission('LIB_CATEGORY_MANAGE'),
    wrap('DELETE categories', async (req, res) => {
      const id = req.params.categoryId;
      const pool = await getPool();
      const used = await pool.request().input('id', sql.VarChar(30), id)
        .query(`SELECT (SELECT COUNT(*) FROM LIBRARY_ITEM WHERE category_id = @id)
                     + (SELECT COUNT(*) FROM LIBRARY_PROPOSAL WHERE category_id = @id) AS n`);
      if (used.recordset[0].n > 0) {
        return fail(res, 409, 'Thể loại đang có tài liệu (kể cả trong thùng rác hoặc đề xuất). Hãy chuyển sang "ngừng sử dụng".', 'CATEGORY_IN_USE');
      }
      const r = await pool.request().input('id', sql.VarChar(30), id)
        .query('DELETE FROM LIBRARY_CATEGORY WHERE category_id = @id');
      if (!r.rowsAffected[0]) return fail(res, 404, 'Không tìm thấy thể loại', 'CATEGORY_NOT_FOUND');
      await log(req, null, 'LIB_CATEGORY_DELETE', id);
      return res.json({ success: true, category_id: id });
    }));

  // ─── Danh sách ──────────────────────────────────────────────
  router.get('/', wrap('GET list', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 20));
    const r = (await getPool()).request()
      .input('off', sql.Int, (page - 1) * pageSize)
      .input('size', sql.Int, pageSize);
    const where = ['d.deleted_at IS NULL', `d.security_level_id = ${PUBLIC_LEVEL}`];
    const q = String(req.query.q || '').trim().slice(0, 200);
    if (q) {
      r.input('q', sql.NVarChar(500), `%${q.replace(/[\\%_[]/g, '\\$&')}%`);
      where.push(`(${['d.title', 'd.document_code', 'd.signer', 'li.publisher', 'd.summary']
        .map((col) => `${col} LIKE @q ESCAPE '\\'`).join(' OR ')})`);
    }
    if (req.query.category) { where.push('li.category_id = @cat'); r.input('cat', sql.VarChar(30), String(req.query.category)); }
    if (req.query.unit) {
      const unit = String(req.query.unit).slice(0, 50);
      const withChildren = ['1', 'true'].includes(String(req.query.include_children));
      const ids = withChildren ? await unitIdsWithChildren(unit) : [unit];
      const names = ids.map((id, i) => { r.input(`u${i}`, sql.NVarChar(50), id); return `@u${i}`; });
      where.push(`d.issuing_unit_id IN (${names.join(', ')})`);
    }
    const year = parseInt(req.query.year, 10);
    if (year) { where.push('li.publish_year = @year'); r.input('year', sql.Int, year); }
    const filter = `WHERE ${where.join(' AND ')}`;
    const result = await r.query(`
      SELECT COUNT(*) AS total ${FROM_ITEM} ${filter};
      SELECT ${await selectItem()} ${FROM_ITEM} ${filter}
      ORDER BY d.created_at DESC, d.file_id OFFSET @off ROWS FETCH NEXT @size ROWS ONLY;`);
    res.json({ total: result.recordsets[0][0].total, page, page_size: pageSize, items: result.recordsets[1] });
  }));

  // ─── Thùng rác (khai báo TRƯỚC '/:fileId') ──────────────────
  // Tài liệu đang chờ duyệt không nằm trong thùng rác
  const TRASH_WHERE = `${lifecycle.trashCondition('d')} AND d.security_level_id = ${PUBLIC_LEVEL}`;

  router.get('/trash', requireAuth, requirePermission('LIB_TRASH_VIEW'), wrap('GET trash', async (req, res) => {
    const r = await (await getPool()).request()
      .query(`SELECT ${await selectItem()}, d.deleted_at, d.deleted_reason, del.full_name AS deleted_by_name
              ${FROM_ITEM} LEFT JOIN [USER] del ON del.user_id = d.deleted_by
              WHERE ${TRASH_WHERE} ORDER BY d.deleted_at DESC`);
    res.json({ total: r.recordset.length, items: r.recordset });
  }));

  async function purgeItem(fileId) {
    const pool = await getPool();
    const paths = await pool.request().input('fid', sql.VarChar(50), fileId)
      .query(`SELECT stored_path AS p FROM DOCUMENT WHERE file_id = @fid
              UNION SELECT new_stored_path FROM DOCUMENT_REVISION_PROPOSAL
                    WHERE file_id = @fid AND new_stored_path IS NOT NULL`);
    const covers = (await mediaReady()) ? (await pool.request().input('fid', sql.VarChar(50), fileId)
      .query(`SELECT cover_path AS p FROM LIBRARY_ITEM WHERE file_id = @fid AND cover_path IS NOT NULL
              UNION SELECT lp.cover_path FROM LIBRARY_PROPOSAL lp
                JOIN DOCUMENT_REVISION_PROPOSAL r ON r.proposal_id = lp.proposal_id
               WHERE r.file_id = @fid AND lp.cover_path IS NOT NULL`)).recordset : [];
    // LIBRARY_ITEM, đề xuất và LIBRARY_PROPOSAL xóa theo (ON DELETE CASCADE)
    const r = await pool.request().input('fid', sql.VarChar(50), fileId)
      .query('DELETE FROM DOCUMENT WHERE file_id = @fid AND deleted_at IS NOT NULL');
    if (!r.rowsAffected[0]) return false;
    for (const row of paths.recordset) await removeUnreferenced(row.p);
    for (const row of covers) await removeCoverIfUnused(row.p);
    syncToAI('delete', { file_id: fileId });
    return true;
  }

  router.delete('/trash', requireAuth, requirePermission('LIB_PURGE'), wrap('DELETE trash', async (req, res) => {
    if (String(req.body?.confirm || req.query.confirm || '') !== EMPTY_TRASH_CONFIRM) {
      return fail(res, 400, `Xác nhận không khớp. Gửi { "confirm": "${EMPTY_TRASH_CONFIRM}" } để dọn thùng rác.`, 'CONFIRM_MISMATCH');
    }
    const r = await (await getPool()).request()
      .query(`SELECT d.file_id, d.title ${FROM_ITEM} WHERE ${TRASH_WHERE}`);
    let purged = 0;
    for (const it of r.recordset) {
      if (await purgeItem(it.file_id)) {
        purged += 1;
        await log(req, null, 'LIB_PURGE', `XÓA VĨNH VIỄN (dọn thùng rác): ${it.file_id} — ${it.title}`);
      }
    }
    return res.json({ success: true, purged });
  }));

  // ─── AI điền sẵn thông tin ──────────────────────────────────
  router.post('/parse', parseLimiter, requireAuth, requirePermission('LIB_PARSE'),
    upload.single('file'), validateUploadedPdf, parseHandler);

  // ─── Thống kê (khai báo TRƯỚC '/:fileId') ───────────────────
  const ACTIVE_FROM = `FROM DOCUMENT d JOIN LIBRARY_ITEM li ON li.file_id = d.file_id
    WHERE d.deleted_at IS NULL AND d.security_level_id = ${PUBLIC_LEVEL}`;

  router.get('/stats', wrap('GET stats', async (req, res) => {
    const actor = await actorOf(req);
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT COUNT(*) AS total, ISNULL(SUM(d.file_size), 0) AS total_bytes,
             ISNULL(SUM(CASE WHEN d.created_at >= DATEADD(DAY, -30, GETDATE()) THEN 1 ELSE 0 END), 0) AS new_30_days,
             ISNULL(SUM(CASE WHEN NULLIF(d.signer, N'') IS NOT NULL AND d.issuing_unit_id IS NOT NULL
                              AND li.publish_year IS NOT NULL THEN 1 ELSE 0 END), 0) AS standardized,
             MAX(ISNULL(d.updated_at, d.created_at)) AS latest_at
      ${ACTIVE_FROM};
      SELECT c.category_id, c.name, COUNT(x.file_id) AS count
      FROM LIBRARY_CATEGORY c
      LEFT JOIN (SELECT li.category_id, d.file_id ${ACTIVE_FROM}) x ON x.category_id = c.category_id
      WHERE c.active = 1 OR x.file_id IS NOT NULL
      GROUP BY c.category_id, c.name, c.sort_order ORDER BY COUNT(x.file_id) DESC, c.sort_order;
      SELECT d.issuing_unit_id AS unit_id, COUNT(*) AS count ${ACTIVE_FROM} GROUP BY d.issuing_unit_id;
      SELECT li.publish_year AS year, COUNT(*) AS count ${ACTIVE_FROM} GROUP BY li.publish_year ORDER BY li.publish_year DESC;`);
    const [totals, categories, units, years] = r.recordsets;
    let mine = null;
    if (actor.authed && (await readingReady())) {
      const m = await pool.request().input('uid', sql.VarChar(50), actor.userId).query(`
        SELECT ISNULL(SUM(CASE WHEN rd.completed = 0 THEN 1 ELSE 0 END), 0) AS reading,
               ISNULL(SUM(CASE WHEN rd.completed = 1 THEN 1 ELSE 0 END), 0) AS completed
        FROM LIBRARY_READING rd JOIN DOCUMENT d ON d.file_id = rd.file_id
        WHERE rd.user_id = @uid AND d.deleted_at IS NULL AND d.security_level_id = ${PUBLIC_LEVEL}`);
      mine = m.recordset[0];
    }
    res.json({
      ...totals[0], total_bytes: Number(totals[0].total_bytes) || 0,
      by_category: categories, by_unit: units, by_year: years, my_reading: mine,
    });
  }));

  // ─── Lịch sử đọc của người đang đăng nhập ───────────────────
  const needReadingTable = async (req, res, next) => ((await readingReady()) ? next()
    : fail(res, 503, 'Chưa có bảng lưu tiến độ đọc. Chạy lại backend/migrations/create_library_module.sql', 'READING_NOT_INITIALIZED'));

  router.get('/reading', requireAuth, needReadingTable, wrap('GET reading list', async (req, res) => {
    const r = await (await getPool()).request().input('uid', sql.VarChar(50), req.user.user_id)
      .query(`SELECT ${await selectItem()}, rd.last_page, rd.max_page, rd.total_pages, rd.completed, rd.first_read_at, rd.last_read_at
              ${FROM_ITEM} JOIN LIBRARY_READING rd ON rd.file_id = d.file_id AND rd.user_id = @uid
              WHERE d.deleted_at IS NULL AND d.security_level_id = ${PUBLIC_LEVEL}
              ORDER BY rd.last_read_at DESC`);
    res.json({ total: r.recordset.length, items: r.recordset });
  }));

  const forMine = async (req) => (await getPool()).request()
    .input('uid', sql.VarChar(50), req.user.user_id)
    .input('fid', sql.VarChar(50), LIB_ID_RX.test(req.params.fileId) ? req.params.fileId : '');

  router.get('/:fileId/reading', requireAuth, needReadingTable, wrap('GET reading', async (req, res) => {
    const r = await (await forMine(req)).query(`SELECT last_page, max_page, total_pages, completed, last_read_at
              FROM LIBRARY_READING WHERE user_id = @uid AND file_id = @fid`);
    res.json({ progress: r.recordset[0] || null });
  }));

  router.put('/:fileId/reading', requireAuth, needReadingTable, wrap('PUT reading', async (req, res) => {
    const page = Number(req.body?.page);
    const total = Number(req.body?.total_pages);
    const valid = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_PAGES;
    if (!valid(page) || !valid(total)) return fail(res, 400, 'Số trang không hợp lệ', 'INVALID_PAGE');
    // Giữ "đã đọc xong" và trang xa nhất; nếu tệp bị thay (đổi số trang) thì tính lại theo tệp mới
    const r = await (await forMine(req))
      .input('page', sql.Int, Math.min(page, total))
      .input('total', sql.Int, total)
      .input('done', sql.Bit, req.body?.completed === true)
      .query(`
        SET XACT_ABORT ON;
        DECLARE @n INT;
        BEGIN TRANSACTION;
          UPDATE LIBRARY_READING WITH (UPDLOCK, HOLDLOCK)
          SET last_page = @page,
              max_page = CASE WHEN max_page <= @page THEN @page WHEN max_page > @total THEN @total ELSE max_page END,
              completed = CASE WHEN @done = 1 OR (completed = 1 AND total_pages = @total) THEN 1 ELSE 0 END,
              total_pages = @total, last_read_at = GETDATE()
          WHERE user_id = @uid AND file_id = @fid;
          SET @n = @@ROWCOUNT;
          IF @n = 0
          BEGIN
            INSERT INTO LIBRARY_READING (user_id, file_id, last_page, max_page, total_pages, completed)
            SELECT @uid, d.file_id, @page, @page, @total, @done ${ACTIVE_FROM} AND d.file_id = @fid;
            SET @n = @@ROWCOUNT;
          END
        COMMIT TRANSACTION;
        SELECT @n AS n;`);
    if (!r.recordset[0].n) return fail(res, 404, 'Không tìm thấy tài liệu thư viện', 'LIBRARY_NOT_FOUND');
    return res.json({ success: true });
  }));

  router.delete('/:fileId/reading', requireAuth, needReadingTable, wrap('DELETE reading', async (req, res) => {
    const r = await (await forMine(req)).query('DELETE FROM LIBRARY_READING WHERE user_id = @uid AND file_id = @fid');
    res.json({ success: true, removed: r.rowsAffected[0] });
  }));

  // ─── Ảnh bìa ────────────────────────────────────────────────
  const sendCover = (res, relPath, cache) => {
    const abs = relPath && COVER_PATH_RX.test(relPath) ? safePathJoin(rootDir, relPath) : null;
    if (!abs || !fs.existsSync(abs)) return fail(res, 404, 'Không có ảnh bìa', 'COVER_NOT_FOUND');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', cache);
    return fs.createReadStream(abs).pipe(res);
  };

  // Ảnh bìa theo đề xuất đang chờ duyệt: người gửi, người đăng gốc và người duyệt
  router.get('/proposals/:proposalId/cover', requireAuth, wrap('GET proposal cover', async (req, res) => {
    if (!(await mediaReady())) return fail(res, 404, 'Không có ảnh bìa', 'COVER_NOT_FOUND');
    const r = await (await getPool()).request().input('pid', sql.VarChar(50), req.params.proposalId)
      .query(`SELECT p.requester_id, p.owner_id, ISNULL(lp.cover_path, li.cover_path) AS cover_path
              FROM DOCUMENT_REVISION_PROPOSAL p
              JOIN LIBRARY_PROPOSAL lp ON lp.proposal_id = p.proposal_id
              LEFT JOIN LIBRARY_ITEM li ON li.file_id = p.file_id
              WHERE p.proposal_id = @pid`);
    const row = r.recordset[0];
    const actor = await actorOf(req);
    const allowed = row && (actor.isCommander || [row.requester_id, row.owner_id].includes(actor.userId)
      || await holds(actor, 'APPROVAL_VALIDATE'));
    if (!allowed) return fail(res, 404, 'Không có ảnh bìa', 'COVER_NOT_FOUND');
    return sendCover(res, row.cover_path, 'private, no-store');
  }));

  router.get('/:fileId/cover', wrap('GET cover', async (req, res) => {
    const id = req.params.fileId;
    const row = LIB_ID_RX.test(id) && (await mediaReady()) ? (await (await getPool()).request()
      .input('fid', sql.VarChar(50), id)
      .query(`SELECT li.cover_path, d.deleted_at, d.deleted_reason, d.uploaded_by FROM LIBRARY_ITEM li
              JOIN DOCUMENT d ON d.file_id = li.file_id
              WHERE li.file_id = @fid AND d.security_level_id = ${PUBLIC_LEVEL}`)).recordset[0] : null;
    if (!row) return fail(res, 404, 'Không có ảnh bìa', 'COVER_NOT_FOUND');
    if (row.deleted_at) {
      const actor = await actorOf(req);
      const pending = row.deleted_reason === 'PENDING_APPROVAL';
      const allowed = (pending && actor.authed && (actor.isAdmin || actor.isCommander || row.uploaded_by === actor.userId))
        || (!pending && await holds(actor, 'LIB_TRASH_VIEW'));
      if (!allowed) return fail(res, 404, 'Không có ảnh bìa', 'COVER_NOT_FOUND');
      return sendCover(res, row.cover_path, 'private, no-store');
    }
    return sendCover(res, row.cover_path, 'public, max-age=86400');
  }));

  // ─── Chi tiết ───────────────────────────────────────────────
  router.get('/:fileId', wrap('GET detail', async (req, res) => {
    const actor = await actorOf(req);
    const item = await loadItem(req, res);
    if (!item) return;
    if (item.deleted_at) {
      const pending = item.deleted_reason === 'PENDING_APPROVAL';
      const allowed = (pending && actor.authed && (actor.isAdmin || actor.isCommander || item.uploaded_by === actor.userId))
        || (!pending && await holds(actor, 'LIB_TRASH_VIEW'));
      if (!allowed) return fail(res, 404, 'Không tìm thấy tài liệu thư viện', 'LIBRARY_NOT_FOUND');
    }
    const { stored_path: _path, cover_path: _cover, ...safe } = item; // không lộ đường dẫn lưu tệp
    return res.json(safe);
  }));

  // ─── Đăng tải ───────────────────────────────────────────────
  router.post('/', requireAuth, requirePermission('LIB_UPLOAD'), receiveFiles, validateUploadedPdf,
    wrap('POST create', async (req, res) => {
      if (!req.file) return fail(res, 400, 'Thiếu file PDF', 'MISSING_FILE');
      const actor = await actorOf(req);
      const f = await readFields(req, res, null);
      if (!f) return undefined;

      const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      if (await blockClassified(req, res, sha256)) return undefined;
      const force = req.body.force_upload === '1' || req.body.force_upload === 'true';
      if (!force) {
        const dup = await (await getPool()).request().input('sha', sql.Char(64), sha256)
          .query(`SELECT TOP 1 file_id, document_code, title, security_level_id FROM DOCUMENT
                  WHERE sha256 = @sha AND (deleted_at IS NULL OR deleted_reason = 'PENDING_APPROVAL')`);
        const ex = dup.recordset[0];
        if (ex) {
          await log(req, ex.file_id, 'UPLOAD_DUPLICATE', `Thư viện: trùng nội dung với ${ex.file_id}`);
          return fail(res, 409, 'Tệp này đã có trong hệ thống', 'DUPLICATE_FILE', { is_duplicate: true, existing: ex });
        }
      }

      const plan = await planMedia(req, res, null);
      if (!plan) return undefined;
      const direct = actor.isAdmin || (actor.isCommander && !(await isPermissionLocked('LIB_UPLOAD')));
      const fileId = newId('LIB');
      const proposalId = direct ? null : newId('PROP');
      const file = saveFile(req.file, f.code);
      let cover = null;
      try {
        if (plan.cover) cover = saveCover(plan.cover, f.code);
        await inTransaction(async (q) => {
          await bindFields(q(), f)
            .input('fid', sql.VarChar(50), fileId)
            .input('orig', sql.NVarChar(255), file.originalName)
            .input('path', sql.NVarChar(500), file.relPath)
            .input('mime', sql.VarChar(100), file.mime)
            .input('size', sql.BigInt, file.size)
            .input('sha', sql.Char(64), file.sha256)
            .input('by', sql.VarChar(50), actor.userId)
            .input('pending', sql.Bit, direct ? 0 : 1)
            .query(`INSERT INTO DOCUMENT (file_id, document_code, title, issuing_unit_id, signer, summary,
                      security_level_id, original_name, stored_path, mime_type, file_size, sha256, uploaded_by,
                      deleted_at, deleted_reason)
                    VALUES (@fid, @code, @title, @unit, @author, @summary, @level, @orig, @path, @mime, @size, @sha, @by,
                      CASE WHEN @pending = 1 THEN GETDATE() END, CASE WHEN @pending = 1 THEN 'PENDING_APPROVAL' END);
                    INSERT INTO LIBRARY_ITEM (file_id, category_id, publisher, publish_year)
                    VALUES (@fid, @cat, @publisher, @year)`);
          await writeMedia(q, 'LIBRARY_ITEM', fileId, plan, cover);
          if (!direct) {
            await insertProposal(q, {
              proposalId, fileId, requesterId: actor.userId, status: 'PENDING', f, file,
              note: req.body.note || 'Đăng tải tài liệu thư viện mới chờ duyệt',
            });
          }
        });
      } catch (err) {
        removeIfExists(file.absPath);
        removeIfExists(cover?.absPath);
        throw err;
      }

      if (direct) {
        await log(req, fileId, 'UPLOAD', `Thư viện số: ${file.originalName}`);
        syncToAI('ingest', aiDoc(fileId, f, file.relPath));
        return res.status(201).json({ success: true, file_id: fileId });
      }
      await log(req, fileId, 'UPLOAD_PROPOSAL_CREATED', `Thư viện số chờ duyệt: ${f.title}`);
      return res.status(201).json({
        success: true, pending_approval: true, file_id: fileId, proposal_id: proposalId,
        message: 'Tài liệu đã được tiếp nhận và chuyển vào hàng chờ Chỉ huy / Quản trị viên phê duyệt.',
      });
    }));

  // ─── Chỉnh sửa / đề xuất chỉnh sửa ──────────────────────────
  router.put('/:fileId', requireAuth, requirePermission('LIB_EDIT'), receiveFiles, validateUploadedPdf,
    wrap('PUT update', async (req, res) => {
      const actor = await actorOf(req);
      const item = await loadItem(req, res);
      if (!item) return undefined;
      if (item.deleted_at) {
        return fail(res, 409, item.deleted_reason === 'PENDING_APPROVAL'
          ? 'Tài liệu đang chờ duyệt, chưa thể chỉnh sửa'
          : 'Tài liệu đang ở thùng rác, hãy khôi phục trước khi sửa', 'ITEM_NOT_EDITABLE');
      }
      const f = await readFields(req, res, item);
      if (!f) return undefined;
      if (req.file && (await blockClassified(req, res, crypto.createHash('sha256').update(req.file.buffer).digest('hex')))) return undefined;
      const fileId = item.file_id;
      const direct = actor.isAdmin || (actor.isCommander && !(await isPermissionLocked('LIB_EDIT')));
      const pool = await getPool();

      // Mỗi tài liệu chỉ một đề xuất đang chờ, tránh đề xuất duyệt sau ghi đè đề xuất trước
      const active = await pool.request().input('fid', sql.VarChar(50), fileId)
        .query(`SELECT TOP 1 proposal_id, status, requester_id FROM DOCUMENT_REVISION_PROPOSAL
                WHERE file_id = @fid AND status IN ('PENDING_OWNER', 'PENDING') ORDER BY created_at DESC`);
      const ap = active.recordset[0];
      if (ap) {
        return fail(res, 409, ap.requester_id === actor.userId
          ? 'Bạn đã gửi đề xuất sửa tài liệu này và đang chờ duyệt.'
          : 'Tài liệu đã có đề xuất sửa đang chờ duyệt. Vui lòng chờ đề xuất đó được xử lý.',
        'PROPOSAL_ALREADY_PENDING', { proposal_id: ap.proposal_id });
      }

      const plan = await planMedia(req, res, item);
      if (!plan) return undefined;
      const file = req.file ? saveFile(req.file, f.code) : null;
      let cover = null;
      let ownerId = null;
      const proposalId = direct ? null : newId('PROP');
      try {
        if (plan.cover) cover = saveCover(plan.cover, f.code);
        if (direct) {
          await inTransaction(async (q) => {
            await bindFields(q(), f)
              .input('fid', sql.VarChar(50), fileId)
              .input('path', sql.NVarChar(500), file?.relPath || item.stored_path)
              .input('orig', sql.NVarChar(255), file?.originalName || item.original_name)
              .input('mime', sql.VarChar(100), file?.mime || item.mime_type)
              .input('size', sql.BigInt, file?.size ?? item.file_size)
              .input('sha', sql.Char(64), file?.sha256 || item.sha256)
              .query(`UPDATE DOCUMENT SET document_code = @code, title = @title, issuing_unit_id = @unit,
                        signer = @author, summary = @summary, security_level_id = @level, stored_path = @path,
                        original_name = @orig, mime_type = @mime, file_size = @size, sha256 = @sha, updated_at = GETDATE()
                      WHERE file_id = @fid;
                      UPDATE LIBRARY_ITEM SET category_id = @cat, publisher = @publisher, publish_year = @year
                      WHERE file_id = @fid`);
            await writeMedia(q, 'LIBRARY_ITEM', fileId, plan, cover);
          });
        } else {
          // Sửa tài liệu của người khác: người đăng xem trước rồi mới chuyển lên cấp duyệt
          if (item.uploaded_by && item.uploaded_by !== actor.userId && !actor.isCommander && (await ownerFlowReady())) {
            const ok = await pool.request().input('o', sql.VarChar(50), item.uploaded_by)
              .query(`SELECT 1 AS ok FROM [USER] WHERE user_id = @o AND status = 'active'`);
            if (ok.recordset.length) ownerId = item.uploaded_by;
          }
          await inTransaction(async (q) => {
            await insertProposal(q, {
              proposalId, fileId, requesterId: actor.userId, ownerId, f, file,
              status: ownerId ? 'PENDING_OWNER' : 'PENDING',
              note: req.body.note || 'Đề xuất chỉnh sửa tài liệu thư viện',
            });
            await writeMedia(q, 'LIBRARY_PROPOSAL', proposalId, plan, cover);
          });
        }
      } catch (err) {
        if (file) removeIfExists(file.absPath);
        removeIfExists(cover?.absPath);
        throw err;
      }

      if (direct) {
        if (file) await removeUnreferenced(item.stored_path);
        if (cover) await removeCoverIfUnused(item.cover_path);
        await log(req, fileId, 'UPDATE', file ? `Thư viện: sửa thông tin + thay tệp ${file.originalName}` : `Thư viện: sửa thông tin ${f.title}`);
        syncToAI('ingest', aiDoc(fileId, f, file?.relPath || item.stored_path));
        return res.json({ success: true, file_id: fileId, replaced_file: Boolean(file) });
      }
      await log(req, fileId, 'PROPOSAL_CREATED', `Đề xuất chỉnh sửa tài liệu thư viện ${fileId}: ${f.title}`);
      return res.json({
        success: true, pending_approval: true, proposal_id: proposalId, awaiting_owner: Boolean(ownerId),
        message: ownerId
          ? 'Đề xuất đã gửi tới người đăng tài liệu xem xét, sau đó được chuyển lên cấp trên duyệt.'
          : 'Đề xuất chỉnh sửa đã được chuyển vào hàng chờ Chỉ huy / Quản trị viên duyệt.',
      });
    }));

  // ─── Xóa mềm / khôi phục / xóa vĩnh viễn ────────────────────
  router.delete('/:fileId', requireAuth, requirePermission('LIB_DELETE'), wrap('DELETE soft', async (req, res) => {
    const actor = await actorOf(req);
    const item = await loadItem(req, res);
    if (!item) return undefined;
    if (item.deleted_at) return fail(res, 400, 'Tài liệu đã được xóa hoặc đang chờ duyệt', 'ALREADY_DELETED');
    const reason = String(req.body?.reason || req.query.reason || '').trim().slice(0, 500);
    const result = await lifecycle.softDeleteDocument({
      pool: await getPool(), sql, fileId: item.file_id, userId: actor.userId, reason,
    });
    if (!result.deleted) return fail(res, 400, 'Tài liệu đã được xóa trước đó', 'ALREADY_DELETED');
    await log(req, item.file_id, 'DELETE_SOFT', `Thư viện: ${item.title}${reason ? ` — Lý do: ${reason}` : ''}`
      + (result.closed ? ` (đóng ${result.closed} đề xuất đang chờ)` : ''));
    syncToAI('delete', { file_id: item.file_id });
    return res.json({ success: true, file_id: item.file_id, soft_deleted: true, closed_proposals: result.closed });
  }));

  router.post('/:fileId/restore', requireAuth, requirePermission('LIB_RESTORE'), wrap('POST restore', async (req, res) => {
    const actor = await actorOf(req);
    const item = await loadItem(req, res);
    if (!item) return undefined;
    if (!item.deleted_at) return fail(res, 400, 'Tài liệu không ở trong thùng rác', 'NOT_IN_TRASH');
    if (item.deleted_reason === 'PENDING_APPROVAL') return fail(res, 409, 'Tài liệu đang chờ duyệt, không thể khôi phục', 'PENDING_APPROVAL');
    if (item.deleted_reason === lifecycle.REJECTED && !actor.isAdmin && !actor.isCommander) {
      return fail(res, 403, 'Tài liệu đã bị từ chối duyệt, chỉ Chỉ huy / Quản trị viên được khôi phục', 'REJECTED_ITEM');
    }
    await (await getPool()).request().input('fid', sql.VarChar(50), item.file_id)
      .query(`UPDATE DOCUMENT SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL, updated_at = GETDATE() WHERE file_id = @fid`);
    await log(req, item.file_id, 'DOC_RESTORE', `Thư viện: khôi phục ${item.title}`);
    syncToAI('ingest', {
      file_id: item.file_id, document_code: item.document_code || item.file_id, title: item.title,
      stored_path: item.stored_path, security_level_id: item.security_level_id,
    });
    return res.json({ success: true, file_id: item.file_id, restored: true });
  }));

  router.delete('/:fileId/purge', requireAuth, requirePermission('LIB_PURGE'), wrap('DELETE purge', async (req, res) => {
    const item = await loadItem(req, res);
    if (!item) return undefined;
    if (String(req.body?.confirm || req.query.confirm || '').trim() !== item.file_id) {
      return fail(res, 400, 'Xác nhận không khớp. Gửi { "confirm": "<fileId>" } để xác nhận.', 'CONFIRM_MISMATCH');
    }
    if (!item.deleted_at || item.deleted_reason === 'PENDING_APPROVAL') {
      return fail(res, 400, 'Chỉ xóa vĩnh viễn được tài liệu đang ở thùng rác', 'NOT_IN_TRASH');
    }
    await purgeItem(item.file_id);
    await log(req, null, 'LIB_PURGE', `XÓA VĨNH VIỄN: ${item.file_id} — ${item.title} (${item.original_name})`);
    return res.json({ success: true, file_id: item.file_id, purged: true });
  }));

  return router;
}

module.exports = {
  createLibraryRouter, isLibraryId, libraryReady, enrichLibraryProposals, applyLibraryProposal,
  EMPTY_TRASH_CONFIRM,
};
