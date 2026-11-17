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
  /^\/api\/documents(\/|$)/,
];

// Path có handler execute riêng sau khi được duyệt
const LECTURE_UPLOAD_PATH = /^\/api\/lectures\/upload-scorm$/;

module.exports = function createApprovalWorkflow({
  sql, getPool, writeAccessLog, getClientIp, getAutoRequiredPermission,
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

  async function approvalInterceptor(req, res, next) {
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();

    const fullPath = (req.originalUrl || req.url || '').split('?')[0];
    if (EXCLUDED_PATHS.some((rx) => rx.test(fullPath))) return next();
    if (isProtectedAdmin(req.user)) return next();

    // Cho phép thực thi lại request đã được duyệt (mã override)
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
      } catch (err) {
        console.error('[approval] override:', err.message);
      }
      return res.status(403).json({ error: 'Mã phê duyệt không hợp lệ hoặc đã dùng' });
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
    if (!protectedList.has(requiredPerm)) return next();

    const permId = codeToIdMap.get(requiredPerm) || requiredPerm;

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

    try {
      const pool = await getPool();

      const userRes = await pool.request()
        .input('uid', sql.VarChar(50), req.user.user_id)
        .query(`SELECT unit_id FROM [USER] WHERE user_id = @uid`);
      const requesterUnitId = userRes.recordset[0]?.unit_id || null;

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