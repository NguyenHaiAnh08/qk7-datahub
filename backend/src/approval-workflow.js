/**
 * approval-workflow.js — Nguyên tắc 4 mắt cho hành động nguy hiểm.
 * Hỗ trợ STRICT_APPROVAL để chặn fail-open cho route write chưa khai báo quyền.
 */

const PROTECTED_ADMIN_USER_ID = process.env.PROTECTED_ADMIN_USER_ID || 'USR-001';
const PROTECTED_ADMIN_ROLE_ID = process.env.PROTECTED_ADMIN_ROLE_ID || 'ROL-01';

// 'false' | 'dry-run' | 'true'
const STRICT_MODE = (process.env.STRICT_APPROVAL || 'false').toLowerCase();
const STRICT_APPROVAL = STRICT_MODE === 'true' || STRICT_MODE === 'dry-run';
const STRICT_DRY_RUN = STRICT_MODE === 'dry-run';

// Danh sách route được miễn strict (regex). VD: /api/guest/,/api/security/screenshot-alert
const STRICT_ALLOWLIST = (process.env.STRICT_APPROVAL_ALLOWLIST || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((pattern) => {
    try {
      return new RegExp(pattern);
    } catch (err) {
      console.error(
        `[approval] STRICT_APPROVAL_ALLOWLIST pattern không hợp lệ: "${pattern}" — ${err.message}`
      );
      return null;
    }
  })
  .filter(Boolean);

// Route không áp dụng duyệt
const EXCLUDED_PATHS = [
  /^\/api\/admin\/approval-requests/,
  /^\/api\/admin\/protected-permissions/,
  /^\/api\/auth\//,
  /^\/api\/admin\/creatable-roles$/,
  // Văn bản: chỉ miễn các route có luồng đề xuất riêng. Xóa mềm / khôi phục / xóa vĩnh viễn
  // (DELETE|POST restore) ĐI QUA bộ chặn duyệt khi quyền DOC_DELETE/DOC_RESTORE/DOC_PURGE bị khóa.
  /^\/api\/documents\/upload$/,
  /^\/api\/documents\/parse$/,
  /^\/api\/documents\/proposals(\/|$)/,
];

// PUT /api/documents/:id (sửa văn bản) có luồng đề xuất riêng → miễn
const isExcludedWrite = (method, fullPath) =>
  EXCLUDED_PATHS.some((rx) => rx.test(fullPath))
  || (method === 'PUT' && /^\/api\/documents\/[^/]+$/.test(fullPath));

// Route không bao giờ bị khóa xem: trang duyệt phải luôn mở được, nếu không người duyệt bị khóa vòng
const VIEW_GATE_EXCLUDED = [
  /^\/api\/admin\/approval-requests/,
  /^\/api\/admin\/protected-permissions/,
  /^\/api\/my-approval-requests/,
  /^\/api\/auth\//,
  /^\/api\/admin\/creatable-roles$/,
];

// Path có handler execute riêng sau khi được duyệt
const LECTURE_UPLOAD_PATH = /^\/api\/lectures\/upload-scorm$/;

// ─── Khóa bảo vệ cho quyền XEM/ĐỌC (GET) ───
// APPROVAL_VIEW_GATE: 'true' (mặc định) | 'dry-run' (chỉ ghi log) | 'false' (tắt)
const VIEW_GATE_MODE = (process.env.APPROVAL_VIEW_GATE || 'true').toLowerCase();
// Một lần duyệt cho phép xem đối tượng đó trong N phút (một trang gọi nhiều API cùng đối tượng)
const VIEW_GRANT_MINUTES = parseInt(process.env.APPROVAL_VIEW_GRANT_MINUTES || '60', 10);
// Trần số yêu cầu đang chờ duyệt của MỖI người (chặn tràn hàng đợi)
const MAX_PENDING_PER_USER = parseInt(process.env.APPROVAL_MAX_PENDING_PER_USER || '200', 10);

// Khóa tuần tự theo khóa (user+thao tác): các request song song cùng thao tác xếp hàng,
// request sau thấy yêu cầu của request trước nên không chèn thêm bản trùng.
const keyLocks = new Map();
async function acquireKeyLock(key) {
  const prev = keyLocks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((r) => { release = r; });
  const tail = prev.then(() => next);
  keyLocks.set(key, tail);
  await prev;
  return () => { release(); if (keyLocks.get(key) === tail) keyLocks.delete(key); };
}
// Bị từ chối thì trong N phút không tạo yêu cầu mới (tránh spam người duyệt)
const VIEW_REJECT_COOLDOWN_MINUTES = parseInt(process.env.APPROVAL_VIEW_REJECT_COOLDOWN_MINUTES || '10', 10);

// Quyền tách nhỏ (CREATE/EDIT/DELETE) thừa hưởng khóa của quyền *_MANAGE
const PROTECTION_ALIASES = {
  UNIT_CREATE: 'UNIT_MANAGE', UNIT_EDIT: 'UNIT_MANAGE', UNIT_DELETE: 'UNIT_MANAGE',
  DOCTYPE_CREATE: 'DOCTYPE_MANAGE', DOCTYPE_EDIT: 'DOCTYPE_MANAGE', DOCTYPE_DELETE: 'DOCTYPE_MANAGE',
  RANK_CREATE: 'RANK_MANAGE', RANK_EDIT: 'RANK_MANAGE', RANK_DELETE: 'RANK_MANAGE',
  POSITION_CREATE: 'POSITION_MANAGE', POSITION_EDIT: 'POSITION_MANAGE', POSITION_DELETE: 'POSITION_MANAGE',
  UNIT_ALIAS_CREATE: 'UNIT_ALIAS_MANAGE', UNIT_ALIAS_EDIT: 'UNIT_ALIAS_MANAGE', UNIT_ALIAS_DELETE: 'UNIT_ALIAS_MANAGE',
};

// So sánh nội dung body (bỏ qua thứ tự khóa) giữa yêu cầu đã duyệt và request thực thi
function canonicalBody(v) {
  if (v === undefined || v === null || v === '') return '{}';
  let obj = v;
  if (typeof v === 'string') {
    try { obj = JSON.parse(v); } catch { return v; }
  }
  const sortKeys = (o) => {
    if (Array.isArray(o)) return o.map(sortKeys);
    if (o && typeof o === 'object') {
      return Object.keys(o).sort().reduce((acc, k) => { acc[k] = sortKeys(o[k]); return acc; }, {});
    }
    return o;
  };
  const out = JSON.stringify(sortKeys(obj));
  return out === undefined ? '{}' : out;
}

const normPath = (p) => (String(p || '').split('?')[0].replace(/\/+$/, '') || '/');

module.exports = function createApprovalWorkflow({
  sql, getPool, writeAccessLog, getClientIp, getAutoRequiredPermission, getUserPermissions,
}) {
  let protectedSet = new Set();
  let codeToIdMap = new Map();
  let cacheLoadedAt = 0;
  const CACHE_TTL_MS = 30 * 1000;

  // Gộp các lần tải đồng thời: khi cache hết hạn, hàng chục request cùng lúc chỉ chạy 1 truy vấn (trước đây mỗi request 1 truy vấn + 1 dòng log)
  let inflightLoad = null;
  let lastLoggedKey = '';
  async function loadProtectedPermissions(force = false) {
    if (!force && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return protectedSet;
    if (inflightLoad) return inflightLoad;
    inflightLoad = doLoadProtectedPermissions().finally(() => { inflightLoad = null; });
    return inflightLoad;
  }

  async function doLoadProtectedPermissions() {
    try {
      const pool = await getPool();
      const r = await pool.request().query(`
        SELECT pp.permission_id, p.code
        FROM PROTECTED_PERMISSION pp
        JOIN [PERMISSION] p ON p.permission_id = pp.permission_id
      `);
      protectedSet = new Set();
      codeToIdMap = new Map();
      for (const row of r.recordset) {
        if (row.code) {
          protectedSet.add(row.code);
          codeToIdMap.set(row.code, row.permission_id);
        }
        if (row.permission_id) {
          protectedSet.add(row.permission_id);
          codeToIdMap.set(row.permission_id, row.permission_id);
        }
      }
      cacheLoadedAt = Date.now();
      if (protectedSet.size === 0) {
        console.warn('[approval] ⚠️  protectedSet rỗng — kiểm tra migration v4.3');
      } else {
        // Chỉ ghi log khi danh sách khóa bảo vệ THAY ĐỔI (không lặp lại mỗi 30 giây)
        const sorted = Array.from(protectedSet).sort().join(', ');
        if (sorted !== lastLoggedKey) {
          lastLoggedKey = sorted;
          console.log(`[approval] 🔒 Loaded ${protectedSet.size} protected codes: ` + sorted);
        }
      }
    } catch (err) {
      console.error('[approval] loadProtectedPermissions:', err.message);
    }
    return protectedSet;
  }

  function isProtectedAdmin(user) {
    if (!user) return false;
    if (user.user_id === PROTECTED_ADMIN_USER_ID) return true;
    if ((user.roles || []).includes(PROTECTED_ADMIN_ROLE_ID)) return true;
    return false;
  }

  // Trích lecture_id từ body / query / target_summary
  function extractLectureId(request) {
    if (!request) throw new Error('extractLectureId: request rỗng');

    if (request.http_body) {
      try {
        const body = JSON.parse(request.http_body);
        const id = body.lecture_id || body.lectureId;
        if (id) return id;
      } catch { /* body không phải JSON */ }
    }

    const qs = (request.http_path || '').split('?')[1] || '';
    if (qs) {
      const params = new URLSearchParams(qs);
      const id = params.get('lecture_id') || params.get('lectureId');
      if (id) return id;
    }

    const m = /lecture_id=([A-Za-z0-9_\-]+)/.exec(request.target_summary || '');
    if (m) return m[1];

    throw new Error(
      `extractLectureId: không tìm thấy lecture_id (request=${request.request_id || '?'})`
    );
  }

  // Execute sau khi duyệt: giải nén SCORM → PUBLISHED, xoá ZIP tạm
  async function executeLectureUpload(request, deps = {}) {
    const { getPool: gp = getPool, sql: _sql = sql } = deps;
    const lectureId = extractLectureId(request);
    const pool = await gp();

    const r = await pool.request()
      .input('id', _sql.VarChar(50), lectureId)
      .query(`
        SELECT lecture_id, pending_scorm_path, title, created_at
        FROM DIGITAL_LECTURE
        WHERE lecture_id = @id
      `);

    if (!r.recordset.length) {
      throw new Error(`executeLectureUpload: không tìm thấy lecture ${lectureId}`);
    }
    const lecture = r.recordset[0];
    if (!lecture.pending_scorm_path) {
      throw new Error(
        `executeLectureUpload: lecture ${lectureId} không có pending_scorm_path`
      );
    }

    const { extractAndParse } = require('./lecture-package-helper');
    const out = await extractAndParse({
      lectureId,
      pendingPath: lecture.pending_scorm_path,
      title: lecture.title,
      createdAt: lecture.created_at,
    });

    await pool.request()
      .input('id', _sql.VarChar(50), lectureId)
      .input('launch', _sql.NVarChar(500), out.entry_point)
      .input('ct', _sql.VarChar(20), out.content_type)
      .query(`
        UPDATE DIGITAL_LECTURE
        SET status = 'PUBLISHED',
            scorm_entry_point = @launch,
            content_type = @ct,
            pending_scorm_path = NULL,
            updated_at = GETDATE()
        WHERE lecture_id = @id
      `);

    return {
      lectureId,
      entryPoint: out.entry_point,
      content_type: out.content_type,
      status: 'PUBLISHED',
    };
  }

  // Reject sau khi từ chối: đánh dấu REJECTED, lưu lý do
  async function rejectLectureUpload(request, reason, deps = {}) {
    const { getPool: gp = getPool, sql: _sql = sql } = deps;
    const lectureId = extractLectureId(request);
    const pool = await gp();

    await pool.request()
      .input('id', _sql.VarChar(50), lectureId)
      .input('reason', _sql.NVarChar(500), reason || null)
      .query(`
        UPDATE DIGITAL_LECTURE
        SET status = 'REJECTED',
            reject_reason = @reason,
            updated_at = GETDATE()
        WHERE lecture_id = @id
      `);

    return { lectureId, status: 'REJECTED' };
  }

  // Dispatcher cho admin approve/reject endpoint
  async function executeApprovedRequest(request, deps = {}) {
    const p = (request.http_path || '').split('?')[0];
    if (LECTURE_UPLOAD_PATH.test(p)) {
      return executeLectureUpload(request, deps);
    }
    return null;
  }

  async function rejectApprovedRequest(request, reason, deps = {}) {
    const p = (request.http_path || '').split('?')[0];
    if (LECTURE_UPLOAD_PATH.test(p)) {
      return rejectLectureUpload(request, reason, deps);
    }
    return null;
  }

  // Quyền có đang bị admin khóa duyệt không (dùng cho luồng văn bản có đề xuất riêng)
  async function isPermissionLocked(code) {
    await loadProtectedPermissions();
    return isCodeProtected(code);
  }

  function isCodeProtected(code) {
    if (protectedSet.has(code)) return true;
    const alias = PROTECTION_ALIASES[code];
    return Boolean(alias && protectedSet.has(alias));
  }

  /**
   * TẦNG 2 cho quyền XEM/ĐỌC (GET/HEAD): nếu quyền đang bị admin khóa bảo vệ thì
   * người dùng phải được duyệt cho đúng đối tượng (đường dẫn) này mới xem được.
   * Trả về true nếu cho đi tiếp; false nếu đã trả lời 403 (VIEW_APPROVAL_REQUIRED).
   * `codes` = các quyền người dùng đang giữ cho route này (chỉ cần 1 quyền không khóa là qua).
   */
  async function enforceViewGate(req, res, codes) {
    let releaseLock = null;
    try {
      if (VIEW_GATE_MODE === 'false') return true;
      if (!['GET', 'HEAD'].includes(req.method)) return true;
      const user = req.user;
      if (!user || !user.is_authenticated || user.user_id === 'GUEST') return true;
      if (isProtectedAdmin(user)) return true;

      const fullPath = normPath(req.originalUrl || req.url);
      // /api/documents KHÔNG miễn ở đây (miễn của bộ chặn GHI chỉ vì văn bản có luồng đề xuất riêng)
      if (VIEW_GATE_EXCLUDED.some((rx) => rx.test(fullPath))) return true;

      const list = (Array.isArray(codes) ? codes : [codes]).filter(Boolean);
      if (list.length === 0) return true;
      await loadProtectedPermissions();
      if (list.some((c) => !isCodeProtected(c))) return true;
      const code = list[0];
      const permId = codeToIdMap.get(code) || codeToIdMap.get(PROTECTION_ALIASES[code]) || code;

      // Trang thường bắn nhiều GET song song: xếp hàng để chỉ tạo 1 yêu cầu xem
      releaseLock = await acquireKeyLock(`V|${user.user_id}|${fullPath}|${permId}`);
      const pool = await getPool();
      const last = (await pool.request()
        .input('uid', sql.VarChar(50), user.user_id)
        .input('perm', sql.VarChar(50), permId)
        .input('path', sql.VarChar(500), fullPath)
        .query(`SELECT TOP 1 request_id, status, reviewed_at, review_note
                FROM APPROVAL_REQUEST
                WHERE requester_id = @uid AND http_method = 'GET'
                  AND required_permission = @perm AND http_path = @path
                ORDER BY created_at DESC`)).recordset[0];

      const minutesSince = (d) => (Date.now() - new Date(d).getTime()) / 60000;
      if (last && ['APPROVED', 'EXECUTED'].includes(last.status)
          && last.reviewed_at && minutesSince(last.reviewed_at) <= VIEW_GRANT_MINUTES) {
        return true;
      }

      if (VIEW_GATE_MODE === 'dry-run') {
        console.warn(`[approval][VIEW-DRY] user=${user.user_id} cần duyệt để xem ${fullPath} (quyền ${code})`);
        return true;
      }

      if (last && last.status === 'PENDING') {
        res.status(403).json({
          error: `Quyền ${code} đang được khóa bảo vệ. Yêu cầu xem ${fullPath} (${last.request_id}) đang chờ cấp trên duyệt.`,
          code: 'VIEW_APPROVAL_REQUIRED', state: 'PENDING', request_id: last.request_id, required_permission: code,
        });
        return false;
      }
      if (last && last.status === 'REJECTED' && last.reviewed_at
          && minutesSince(last.reviewed_at) <= VIEW_REJECT_COOLDOWN_MINUTES) {
        res.status(403).json({
          error: `Yêu cầu xem đã bị từ chối${last.review_note ? `: ${last.review_note}` : ''}.`,
          code: 'VIEW_APPROVAL_REQUIRED', state: 'REJECTED', request_id: last.request_id, required_permission: code,
        });
        return false;
      }

      const unitRes = await pool.request()
        .input('uid', sql.VarChar(50), user.user_id)
        .query(`SELECT unit_id FROM [USER] WHERE user_id = @uid`);
      const requestId = 'APV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      await pool.request()
        .input('rid', sql.VarChar(50), requestId)
        .input('uid', sql.VarChar(50), user.user_id)
        .input('unit', sql.NVarChar(50), unitRes.recordset[0]?.unit_id || null)
        .input('perm', sql.VarChar(50), permId)
        .input('path', sql.VarChar(500), fullPath)
        .input('summary', sql.NVarChar(500), `XEM ${fullPath} (quyền ${code})`)
        .query(`INSERT INTO APPROVAL_REQUEST
                (request_id, requester_id, requester_unit_id, required_permission, http_method, http_path, target_summary, status)
                VALUES (@rid, @uid, @unit, @perm, 'GET', @path, @summary, 'PENDING')`);
      res.status(403).json({
        error: `Quyền ${code} đang được khóa bảo vệ. Đã gửi yêu cầu xem ${fullPath} (${requestId}) tới cấp trên, vui lòng chờ duyệt.`,
        code: 'VIEW_APPROVAL_REQUIRED', state: 'PENDING', request_id: requestId, required_permission: code,
      });
      return false;
    } catch (err) {
      console.error('[approval] enforceViewGate:', err.message);
      // Fail-closed: lỗi kiểm tra thì KHÔNG cho xem dữ liệu đang bị khóa bảo vệ
      res.status(503).json({ error: 'Không kiểm tra được trạng thái phê duyệt. Vui lòng thử lại.', code: 'APPROVAL_GATE_ERROR' });
      return false;
    } finally {
      if (releaseLock) releaseLock();
    }
  }

  async function approvalInterceptor(req, res, next) {
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();

    const fullPath = (req.originalUrl || req.url || '').split('?')[0];
    if (isExcludedWrite(req.method, fullPath)) return next();
    if (isProtectedAdmin(req.user)) return next();

    // Cho phép thực thi lại request đã được duyệt (mã override).
    // Mã chỉ dùng được đúng 1 lần, đúng phương thức + đường dẫn + nội dung của yêu cầu gốc,
    // và chỉ bởi người yêu cầu hoặc người đã duyệt.
    const overrideId = req.headers['x-approval-override'];
    if (overrideId) {
      try {
        const pool = await getPool();
        const r = await pool.request()
          .input('rid', sql.VarChar(50), overrideId)
          .query(`SELECT status, requester_id, reviewed_by, http_method, http_path, http_body
                  FROM APPROVAL_REQUEST WHERE request_id = @rid`);
        const row = r.recordset[0];
        const callerId = req.user?.user_id;
        const matches = row
          && row.status === 'APPROVED'
          && String(row.http_method).toUpperCase() === req.method
          && normPath(row.http_path) === normPath(fullPath)
          && (callerId === row.requester_id || callerId === row.reviewed_by)
          && canonicalBody(row.http_body) === canonicalBody(req.body);
        if (matches) {
          const u = await pool.request()
            .input('rid', sql.VarChar(50), overrideId)
            .query(`UPDATE APPROVAL_REQUEST SET status='EXECUTING', executed_at=GETDATE()
                    WHERE request_id=@rid AND status='APPROVED';
                    SELECT @@ROWCOUNT AS n;`);
          if (u.recordset[0].n === 1) return next();
        } else if (row) {
          console.warn(`[approval] override ${overrideId} bị từ chối: không khớp yêu cầu gốc (user=${callerId}, ${req.method} ${fullPath})`);
        }
      } catch (err) {
        console.error('[approval] override:', err.message);
      }
      return res.status(403).json({ error: 'Mã phê duyệt không hợp lệ, không khớp thao tác hoặc đã dùng' });
    }

    const requiredPerm = getAutoRequiredPermission(req.method, fullPath);

    // Route write không có trong AUTO_PERMISSIONS → chặn hoặc cảnh báo tùy STRICT_MODE
    if (!requiredPerm) {
      if (!STRICT_APPROVAL) return next();

      if (STRICT_ALLOWLIST.some((rx) => rx.test(fullPath))) return next();

      const userId = req.user?.user_id || 'ANONYMOUS';
      const tag = STRICT_DRY_RUN ? 'STRICT-DRY' : 'STRICT';
      console.warn(
        `[approval][${tag}] ⛔ Route write chưa khai báo AUTO_PERMISSIONS: ` +
        `${req.method} ${fullPath} (user=${userId}, ip=${getClientIp(req)})`
      );

      writeAccessLog({
        userId: req.user?.user_id || null,
        fileId: null,
        action: STRICT_DRY_RUN ? 'APPROVAL_STRICT_WOULD_BLOCK' : 'APPROVAL_STRICT_BLOCKED',
        ip: getClientIp(req),
        note: `Route chưa khai báo quyền: ${req.method} ${fullPath}`,
      }).catch(() => {});

      if (STRICT_DRY_RUN) return next();

      return res.status(403).json({
        error:
          'Thao tác bị chặn: Route chưa được khai báo quyền trong hệ thống. ' +
          'Liên hệ Quản trị viên để bổ sung vào AUTO_PERMISSIONS hoặc STRICT_APPROVAL_ALLOWLIST.',
        code: 'ROUTE_NOT_REGISTERED',
        method: req.method,
        path: fullPath,
      });
    }

    const protectedList = await loadProtectedPermissions();
    if (!isCodeProtected(requiredPerm)) return next();

    // TẦNG 1: người gọi phải có quyền thì mới được xin duyệt. Không có quyền → 403 ngay.
    if (typeof getUserPermissions === 'function') {
      const held = await getUserPermissions(req.user?.user_id);
      if (!held.includes(requiredPerm)) {
        writeAccessLog({
          userId: req.user?.user_id || null, fileId: null, action: 'PERMISSION_DENIED',
          ip: getClientIp(req), note: `Thiếu quyền: ${requiredPerm} (${req.method} ${fullPath})`,
        }).catch(() => {});
        return res.status(403).json({
          error: `Bạn không có quyền thực hiện thao tác này (thiếu: ${requiredPerm})`,
          code: 'PERMISSION_DENIED',
          required_permission: requiredPerm,
        });
      }
    }

    const permId = codeToIdMap.get(requiredPerm) || codeToIdMap.get(PROTECTION_ALIASES[requiredPerm]) || requiredPerm;

    // Ghi lecture_id (nếu có) để execute handler giải nén đúng bài giảng
    const lectureIdHint =
      req.lectureId ||
      (req.res && req.res.locals && req.res.locals.lectureId) ||
      (req.body && (req.body.lecture_id || req.body.lectureId)) ||
      (req.query && (req.query.lecture_id || req.query.lectureId)) ||
      null;
    const targetSummary = lectureIdHint
      ? `${req.method} ${fullPath} lecture_id=${lectureIdHint}`
      : `${req.method} ${fullPath}`;

    const requestId = 'APV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const bodyJson = (req.is('application/json') && req.body) ? JSON.stringify(req.body) : null;

    const releaseLock = await acquireKeyLock(`W|${req.user.user_id}|${req.method}|${normPath(fullPath)}|${permId}`);
    try {
      const pool = await getPool();

      const userRes = await pool.request()
        .input('uid', sql.VarChar(50), req.user.user_id)
        .query(`SELECT unit_id FROM [USER] WHERE user_id = @uid`);
      const requesterUnitId = userRes.recordset[0]?.unit_id || null;

      // CHỐNG CHỒNG YÊU CẦU (1): cùng người + cùng thao tác + cùng nội dung đang chờ duyệt
      // → trả lại yêu cầu cũ, không tạo thêm (bấm đúp / thử lại / bấm lại khi đang chờ).
      const pending = (await pool.request()
        .input('uid', sql.VarChar(50), req.user.user_id)
        .input('perm', sql.VarChar(50), permId)
        .input('method', sql.VarChar(10), req.method)
        .query(`SELECT request_id, http_path, http_body FROM APPROVAL_REQUEST
                WHERE requester_id = @uid AND status = 'PENDING'
                  AND required_permission = @perm AND http_method = @method
                ORDER BY created_at DESC`)).recordset;

      const myBody = canonicalBody(req.body);
      const dup = pending.find((p) =>
        normPath(p.http_path) === normPath(fullPath) && canonicalBody(p.http_body) === myBody);
      if (dup) {
        return res.status(202).json({
          code: 'APPROVAL_REQUIRED',
          request_id: dup.request_id,
          duplicate: true,
          message: 'Thao tác này đã được gửi và đang chờ phê duyệt, không tạo yêu cầu mới.',
          required_permission: requiredPerm,
        });
      }

      // CHỐNG CHỒNG YÊU CẦU (2): trần số yêu cầu đang chờ của mỗi người
      if (pending.length >= MAX_PENDING_PER_USER) {
        return res.status(429).json({
          error: `Bạn đang có ${pending.length} yêu cầu chờ duyệt (tối đa ${MAX_PENDING_PER_USER}). Vui lòng chờ cấp trên duyệt bớt rồi gửi tiếp.`,
          code: 'APPROVAL_QUEUE_FULL',
        });
      }

      await pool.request()
        .input('rid', sql.VarChar(50), requestId)
        .input('uid', sql.VarChar(50), req.user.user_id)
        .input('req_unit', sql.NVarChar(50), requesterUnitId)
        .input('perm', sql.VarChar(50), permId)
        .input('method', sql.VarChar(10), req.method)
        .input('path', sql.VarChar(500), req.originalUrl || req.url)
        .input('body', sql.NVarChar(sql.MAX), bodyJson)
        .input('summary', sql.NVarChar(500), targetSummary)
        .input('status', sql.VarChar(20), 'PENDING')
        .query(`
          INSERT INTO APPROVAL_REQUEST
          (request_id, requester_id, requester_unit_id, required_permission, http_method, http_path, http_body, target_summary, status)
          VALUES (@rid, @uid, @req_unit, @perm, @method, @path, @body, @summary, @status)
        `);

      // Không ghi ACCESS_LOG cho bài giảng để tránh nhiễu
      if (!fullPath.startsWith('/api/lectures/')) {
        await writeAccessLog({
          userId: req.user.user_id, fileId: null, action: 'APPROVAL_REQUESTED',
          ip: getClientIp(req),
          note: `[${requestId}] ${req.method} ${fullPath} — cần duyệt (perm=${requiredPerm})`,
        });
      }

      return res.status(202).json({
        code: 'APPROVAL_REQUIRED',
        request_id: requestId,
        message: 'Thao tác cần được Quản trị viên phê duyệt trước khi thực thi.',
        required_permission: requiredPerm,
      });
    } catch (err) {
      console.error('[approval] create:', err.message);
      return res.status(500).json({ error: 'Không thể tạo yêu cầu phê duyệt' });
    } finally {
      releaseLock();
    }
  }

  // Log mode strict khi khởi động để vận hành xác nhận
  if (STRICT_APPROVAL) {
    console.log(
      `[approval] 🔒 STRICT_APPROVAL=${STRICT_DRY_RUN ? 'DRY-RUN' : 'ON'} — ` +
      `route write chưa khai báo AUTO_PERMISSIONS sẽ ` +
      `${STRICT_DRY_RUN ? 'bị LOG (vẫn cho qua)' : 'bị 403'}. ` +
      `Allowlist: ${STRICT_ALLOWLIST.length} pattern(s)` +
      (STRICT_ALLOWLIST.length === 0 && !STRICT_DRY_RUN
        ? ' ⚠️  (rỗng — mọi route chưa khai báo sẽ bị chặn)'
        : '')
    );
  } else {
    console.log(
      '[approval] ⚠️  STRICT_APPROVAL=OFF — route write chưa khai báo AUTO_PERMISSIONS sẽ BYPASS. ' +
      'Bật STRICT_APPROVAL=dry-run ở staging để thu thập inventory trước khi bật true.'
    );
  }

  return {
    approvalInterceptor,
    enforceViewGate,
    isPermissionLocked,
    loadProtectedPermissions,
    isProtectedAdmin,
    extractLectureId,
    executeLectureUpload,
    rejectLectureUpload,
    executeApprovedRequest,
    rejectApprovedRequest,
    PROTECTED_ADMIN_USER_ID,
  };
};