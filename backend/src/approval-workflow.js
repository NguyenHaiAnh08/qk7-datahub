/**
 * approval-workflow.js — Nguyên tắc 4 mắt cho hành động nguy hiểm
 */

const fs = require('fs');
const path = require('path');

const PROTECTED_ADMIN_USER_ID = process.env.PROTECTED_ADMIN_USER_ID || 'USR-001';
const PROTECTED_ADMIN_ROLE_ID = process.env.PROTECTED_ADMIN_ROLE_ID || 'ROL-01';

// Route KHÔNG áp dụng duyệt
const EXCLUDED_PATHS = [
  /^\/api\/admin\/approval-requests/,
  /^\/api\/admin\/protected-permissions/,
  /^\/api\/auth\//,
  /^\/api\/admin\/creatable-roles$/,
  /^\/api\/documents(\/|$)/,
];

// Path có handler execute riêng sau khi được duyệt
const LECTURE_UPLOAD_PATH = /^\/api\/lectures\/upload-scorm$/;

module.exports = function createApprovalWorkflow({ 
  sql, getPool, writeAccessLog, getClientIp, getAutoRequiredPermission 
}) {
  let protectedSet = new Set();
  let codeToIdMap = new Map();
  let cacheLoadedAt = 0;
  const CACHE_TTL_MS = 30 * 1000;

  async function loadProtectedPermissions(force = false) {
    if (!force && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return protectedSet;
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
        console.log(
          `[approval] 🔒 Loaded ${protectedSet.size} protected codes: ` +
          Array.from(protectedSet).sort().join(', ')
        );
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

  // ─────────────────────────────────────────────────────────────
  // Trích lecture_id để handler execute biết cập nhật bản ghi nào
  // ─────────────────────────────────────────────────────────────
  function extractLectureId(request) {
    if (!request) throw new Error('extractLectureId: request rỗng');

    // 1. http_body JSON (trường hợp JSON payload có lecture_id)
    if (request.http_body) {
      try {
        const body = JSON.parse(request.http_body);
        const id = body.lecture_id || body.lectureId;
        if (id) return id;
      } catch { /* body không phải JSON — bỏ qua */ }
    }

    // 2. Query string trong http_path: /api/lectures/upload-scorm?lecture_id=...
    const qs = (request.http_path || '').split('?')[1] || '';
    if (qs) {
      const params = new URLSearchParams(qs);
      const id = params.get('lecture_id') || params.get('lectureId');
      if (id) return id;
    }

    // 3. target_summary dạng: "POST /api/lectures/upload-scorm lecture_id=LEC-xxx"
    const m = /lecture_id=([A-Za-z0-9_\-]+)/.exec(request.target_summary || '');
    if (m) return m[1];

    throw new Error(
      `extractLectureId: không tìm thấy lecture_id (request=${request.request_id || '?'})`
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Execute sau khi DUYỆT: giải nén SCORM → PUBLISHED, xoá zip tạm
  // ─────────────────────────────────────────────────────────────
  async function executeLectureUpload(request, deps = {}) {
    const {
      getPool: gp = getPool,
      sql: _sql = sql,
      extractAndParse,
      baseDir = process.cwd(),
    } = deps;

    if (typeof extractAndParse !== 'function') {
      throw new Error(
        'executeLectureUpload: cần truyền extractAndParse(zipPath, targetDir) trong deps'
      );
    }

    const lectureId = extractLectureId(request);
    const pool = await gp();

    const r = await pool.request()
      .input('id', _sql.VarChar(50), lectureId)
      .query(`
        SELECT lecture_id, pending_scorm_path
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

    const zipPath = path.isAbsolute(lecture.pending_scorm_path)
      ? lecture.pending_scorm_path
      : path.join(baseDir, lecture.pending_scorm_path);

    const targetDir = path.join(baseDir, 'uploads', 'lectures', lectureId);

    const { launchFile } = await extractAndParse(zipPath, targetDir);

    await pool.request()
      .input('id', _sql.VarChar(50), lectureId)
      .input('launch', _sql.NVarChar(500), launchFile)
      .query(`
        UPDATE DIGITAL_LECTURE
        SET status = 'PUBLISHED',
            scorm_entry_point = @launch,
            pending_scorm_path = NULL,
            updated_at = GETDATE()
        WHERE lecture_id = @id
      `);

    // Xoá zip tạm (best-effort — không chặn thành công của giao dịch)
    try {
      fs.unlinkSync(zipPath);
    } catch (err) {
      console.warn('[approval] không xoá được zip tạm:', zipPath, '—', err.message);
    }

    return { lectureId, launchFile, status: 'PUBLISHED' };
  }

  // ─────────────────────────────────────────────────────────────
  // Reject sau khi TỪ CHỐI: đánh dấu REJECTED, lưu lý do
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // Dispatcher cho admin approve/reject endpoint
  // ─────────────────────────────────────────────────────────────
  async function executeApprovedRequest(request, deps = {}) {
    const p = (request.http_path || '').split('?')[0];
    if (LECTURE_UPLOAD_PATH.test(p)) {
      return executeLectureUpload(request, deps);
    }
    return null; // không có handler riêng — admin endpoint tự đánh dấu EXECUTED
  }

  async function rejectApprovedRequest(request, reason, deps = {}) {
    const p = (request.http_path || '').split('?')[0];
    if (LECTURE_UPLOAD_PATH.test(p)) {
      return rejectLectureUpload(request, reason, deps);
    }
    return null;
  }

  async function approvalInterceptor(req, res, next) {
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();

    const fullPath = (req.originalUrl || req.url || '').split('?')[0];
    if (EXCLUDED_PATHS.some(rx => rx.test(fullPath))) return next();
    if (isProtectedAdmin(req.user)) return next();

    const overrideId = req.headers['x-approval-override'];
    if (overrideId) {
      try {
        const pool = await getPool();
        const r = await pool.request()
          .input('rid', sql.VarChar(50), overrideId)
          .query(`SELECT status FROM APPROVAL_REQUEST WHERE request_id = @rid`);
        if (r.recordset.length > 0 && r.recordset[0].status === 'APPROVED') {
          await pool.request()
            .input('rid', sql.VarChar(50), overrideId)
            .query(`UPDATE APPROVAL_REQUEST SET status='EXECUTING', executed_at=GETDATE() WHERE request_id=@rid`);
          return next();
        }
      } catch (err) { console.error('[approval] override:', err.message); }
      return res.status(403).json({ error: 'Mã phê duyệt không hợp lệ hoặc đã dùng' });
    }

    const requiredPerm = getAutoRequiredPermission(req.method, fullPath);
    if (!requiredPerm) return next();

    const protectedList = await loadProtectedPermissions();
    if (!protectedList.has(requiredPerm)) return next();

    const permId = codeToIdMap.get(requiredPerm) || requiredPerm;

    // ─── Ghi lecture_id (nếu có) vào target_summary để execute giải nén đúng ───
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

    try {
      const pool = await getPool();

      const userRes = await pool.request()
        .input('uid', sql.VarChar(50), req.user.user_id)
        .query(`SELECT unit_id FROM [USER] WHERE user_id = @uid`);
      const requesterUnitId = userRes.recordset[0]?.unit_id || null;

      await pool.request()
        .input('rid', sql.VarChar(50), requestId)
        .input('uid', sql.VarChar(50), req.user.user_id)
        .input('req_unit', sql.VarChar(50), requesterUnitId)
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

      // Chỉ ghi ACCESS_LOG cho tài liệu/admin, KHÔNG ghi cho bài giảng (uploads SCORM)
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
    }
  }

  return {
    approvalInterceptor,
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