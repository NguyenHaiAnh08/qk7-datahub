// backend/src/lecture-routes.js
// ============================================================
// Phân hệ Bài giảng số v1.2 — KHỚP SCHEMA THỰC TẾ
// - Bảng: DIGITAL_LECTURE, TEACHING_SCHEDULE, SCORM_TRACKING
// - Permission: LECTURE_VIEW / CREATE / APPROVE / DELETE / SCHEDULE_START
// - Role: ROL-01 Admin, ROL-02 BGH, ROL-07 Giảng viên
// - Trưởng bộ môn: nhận diện qua position (ROL-06 là Nhân viên IT, không phải trưởng bộ môn). CHỈ ROL-01/ROL-02 được duyệt
// - Live Monitor: LECTURE_VIEW + role (Admin/Commander/DeptHead)
// - Teaching History: query TEACHING_SCHEDULE status COMPLETED/CANCELLED
// - SCORM: commit vào SCORM_TRACKING
// ============================================================
const express = require('express');
const path = require('path');
const fs = require('fs');
const { memo } = require('./memo');         
const { sql, getPool } = require('./db');
const { getLectureScope, bindUnitIn, inScope, isPeerUnit, canManageLecture } = require('./lecture-scope');
const { delegatedReady, recordValidation } = require('./approval-authority');

const HANGING_THRESHOLD_MINUTES = 4 * 60; // 4 giờ

module.exports = function createLectureRoutes({
  requireAuth,
  requirePermission,
  requireAnyPermission,
  writeAccessLog,
  getClientIp,
}) {
  const router = express.Router();

  // scorm_entry_point từ client chỉ hợp lệ khi nằm trong uploads/bai-giang-so/ (chống path traversal:
  // "../../.env", đường dẫn tuyệt đối...). Giá trị thật do BE sinh khi giải nén gói nên hợp lệ.
  const isSafeEntryPoint = (ep) => {
    if (ep === undefined || ep === null || ep === '') return true; // không gửi = bỏ qua
    const s = String(ep).replace(/\\/g, '/');
    return s.startsWith('uploads/bai-giang-so/') && !s.split('/').includes('..') && !/^[a-zA-Z]:/.test(s);
  };

  // API ĐỌC của phần giám sát (sơ đồ giảng đường, ca đang diễn ra): chỉ huy thuần chỉ có
  // COMMAND_VIEW (không có LECTURE_VIEW) vẫn xem được. Kiểm tra vai trò trong từng handler giữ nguyên.
  const monitorReadGuard = typeof requireAnyPermission === 'function'
    ? requireAnyPermission(['LECTURE_VIEW', 'COMMAND_VIEW'])
    : requirePermission('LECTURE_VIEW');

  const getIp = (req) => {
    if (typeof getClientIp === 'function') return getClientIp(req);
    const raw = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '';
    let ip = String(Array.isArray(raw) ? raw[0] : raw).split(',')[0].trim();
    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    if (ip === '::1') ip = '127.0.0.1';
    return ip;
  };

  const logAudit = (req, action, note, fileId = null) => {
    if (typeof writeAccessLog !== 'function') return Promise.resolve();
    return writeAccessLog({
      userId: req.user?.user_id || 'GUEST',
      fileId,
      action,
      ip: getIp(req),
      note: String(note || '').slice(0, 500),
    }).catch(() => {});
  };

  // ─── HELPERS ───────────────────────────────────────────────
  async function getUserUnitId(pool, userId) {
    const r = await pool.request()
      .input('u', sql.VarChar(50), userId)
      .query(`SELECT unit_id FROM [USER] WHERE user_id = @u`);
    return r.recordset[0]?.unit_id || null;
  }

  async function resolveUserRoles(pool, user) {
    if (!user?.user_id) return user?.roles || [];
    try {
      // Cache 15s + gộp request trùng: hàm này bị gọi ở hầu hết route bài giảng (có route gọi 2 lần)
      const roles = await memo(`roles-active:${user.user_id}`, 15 * 1000, async () => {
        const r = await pool.request()
          .input('u', sql.VarChar(50), user.user_id)
          .query(`SELECT role_id FROM USER_ROLE
                  WHERE user_id = @u AND (expires_at IS NULL OR expires_at > GETDATE())`);
        return r.recordset.map((x) => x.role_id);
      });
      return roles.slice();
    } catch { return user?.roles || []; }
  }

  async function isDeptHead(pool, user) {
    const roles = await resolveUserRoles(pool, user);
    // ROL-06 trên hệ thống thật là "Nhân viên IT", KHÔNG phải trưởng bộ môn → không còn tính là trưởng bộ môn
    const pos = String(user.position || '').toLowerCase();
    return pos.includes('trưởng bộ môn') || pos.includes('trưởng khoa')
        || pos.includes('chủ nhiệm khoa') || pos.includes('trưởng phòng');
  }

  // Hàm phụ kiểm tra quyền Chỉ huy (Chỉ Admin, BGH, Trưởng BM mới được Lưu trữ/Khôi phục)
  async function requireCommander(pool, req, res) {
    const roles = await resolveUserRoles(pool, req.user);
    if (roles.includes('ROL-01') || roles.includes('ROL-02')) {
      return true;
    }
    res.status(403).json({ error: 'Chỉ Chỉ huy cấp trên mới có quyền lưu trữ/khôi phục bài giảng.' });
    return false;
  }

  // Khôi phục / Xóa vĩnh viễn bài giảng trong thùng rác: CHỈ Admin (ROL-01), thao tác ở trang Quản trị → Thùng rác
  async function requireAdminOnly(pool, req, res) {
    const roles = await resolveUserRoles(pool, req.user);
    if (roles.includes('ROL-01')) return true;
    res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới được khôi phục hoặc xóa vĩnh viễn bài giảng trong thùng rác.' });
    return false;
  }

  // Check cột có tồn tại (dùng cho fallback nếu chưa chạy migration v2)
  async function hasColumn(pool, table, column) {
    const r = await pool.request()
      .input('t', sql.VarChar(100), table)
      .input('c', sql.VarChar(100), column)
      .query(`SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_NAME=@t AND COLUMN_NAME=@c`);
    return r.recordset.length > 0;
  }

  // ═════════════════════════════════════════════════════════════
  // PHẦN 1 — CATALOGS
  // ═════════════════════════════════════════════════════════════

  router.get('/catalogs/subjects', async (req, res) => {
    try {
      // Danh mục môn học ít thay đổi: cache 10s (mọi người dùng chung) thay vì truy vấn ở từng request
      const items = await memo('catalog:subjects', 10 * 1000, async () => {
        const pool = await getPool();
        const result = await pool.request().query(`
          SELECT s.*, u.name AS faculty_name
          FROM SUBJECT s
          LEFT JOIN UNIT u ON u.unit_id = s.faculty_unit_id
          WHERE s.active = 1
          ORDER BY s.name
        `);
        return result.recordset;
      });
      res.json({ items });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/catalogs/classes', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT c.*, u.name AS unit_name
        FROM TRAINING_CLASS c
        JOIN UNIT u ON u.unit_id = c.unit_id
        WHERE c.active = 1
        ORDER BY c.class_name
      `);
      res.json({ items: result.recordset });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Gợi ý giảng đường từ lịch sử (vì không có bảng HALL)
  router.get('/catalogs/venues', async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT DISTINCT venue_name, COUNT(*) AS usage_count
        FROM TEACHING_SCHEDULE
        WHERE venue_name IS NOT NULL AND LTRIM(RTRIM(venue_name)) <> ''
        GROUP BY venue_name
        ORDER BY usage_count DESC, venue_name
      `);
      res.json({ items: result.recordset });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ═════════════════════════════════════════════════════════════
  // PHẦN 2 — LECTURE CRUD + APPROVAL 2 TẦNG
  // ═════════════════════════════════════════════════════════════

  router.get('/', async (req, res) => {
    try {
      const pool = await getPool();
      const r = pool.request();
      const isGuest = !req.user || !req.user.is_authenticated || req.user.user_id === 'GUEST' || req.user.user_id === 'ANONYMOUS';
      const userId = req.user?.user_id || 'GUEST';
      const roles = isGuest ? [] : await resolveUserRoles(pool, req.user);
      const isAdmin = roles.includes('ROL-01');
      const isCommander = roles.includes('ROL-02');
      const deptHead = isGuest ? false : await isDeptHead(pool, req.user);
      const composeMode = String(req.query.scope || '') === 'compose';
      const dReady = await delegatedReady();

      const clearance = req.user?.clearance_level_id || 1;

      let query = `
        SELECT l.lecture_id, l.lecture_code, l.title, l.subject_id, l.author_id,
               l.faculty_unit_id, l.security_level_id, l.content_type, l.scorm_entry_point,
               l.document_id, l.status, l.reject_reason, l.created_at, l.updated_at,
               CAST(CASE WHEN l.pdf_path IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_pdf,
               l.pdf_name, l.pdf_size,
               s.name AS subject_name,
               u.full_name AS author_name, u.[rank] AS author_rank,
               un.name AS faculty_name,
               sl.name AS security_name,
               sch.class_name,
               sch.venue_name${dReady ? ', l.validated_by, l.validated_at, l.validate_decision, l.validate_note, vb.full_name AS validated_by_name' : ''}
        FROM DIGITAL_LECTURE l
        JOIN SUBJECT s ON s.subject_id = l.subject_id
        JOIN [USER] u ON u.user_id = l.author_id
        JOIN UNIT un ON un.unit_id = l.faculty_unit_id
        JOIN SECURITY_LEVEL sl ON sl.level_id = l.security_level_id
        ${dReady ? 'LEFT JOIN [USER] vb ON vb.user_id = l.validated_by' : ''}
        OUTER APPLY (
          SELECT TOP 1 ts.venue_name, tc.class_name
          FROM TEACHING_SCHEDULE ts
          LEFT JOIN TRAINING_CLASS tc ON tc.class_id = ts.class_id
          WHERE ts.lecture_id = l.lecture_id
          ORDER BY CASE WHEN ts.status = 'ONGOING' THEN 0 ELSE 1 END, ts.start_time DESC
        ) sch
        WHERE l.security_level_id <= @clearance
      `;
      r.input('clearance', sql.Int, clearance);

      let scope = { all: false, unitIds: [] };
      if (isGuest) {
        // Đại biểu / Khách chỉ được xem các bài giảng đã xuất bản (PUBLISHED) và ở mức bảo mật Cấp 1 (Công khai)
        query += ` AND l.status = 'PUBLISHED' AND l.security_level_id = 1`;
      } else {
        scope = await getLectureScope({ userId, roles, deptHead, includeSiblings: true });
        if (!scope.all) {
          const inList = bindUnitIn(r, scope.unitIds);
          if (composeMode) {
            // Trang Soạn & duyệt: khoa nào khoa đấy lo — chỉ bài của đơn vị mình (và cấp dưới / ngang cấp liền kề) hoặc do mình đăng
            query += ` AND (l.faculty_unit_id IN (${inList}) OR l.author_id = @selfId)`;
          } else {
            // Trang chung (Danh sách bài giảng): thấy MỌI bài đã xuất bản của mọi khoa + bài thuộc phạm vi của mình
            query += ` AND (l.status = 'PUBLISHED' OR l.author_id = @selfId OR l.faculty_unit_id IN (${inList}))`;
          }
          r.input('selfId', sql.VarChar(50), userId);
        }

        if (req.query.status) {
          query += ` AND l.status = @status`;
          r.input('status', sql.VarChar(30), req.query.status);
        } else {
          // Mặc định: Ẩn các bài giảng đã bị xóa mềm
          query += ` AND l.status != 'DELETED'`;
        }
        // Bài trong thùng rác CHỈ Admin xem (ở trang Quản trị → Thùng rác); giáo viên/chỉ huy không còn thấy
        if (!isAdmin) {
          query += ` AND l.status != 'DELETED'`;
        }
      }
      if (req.query.subject_id)       { query += ` AND l.subject_id = @subId`;      r.input('subId', sql.VarChar(50), req.query.subject_id); }
      if (req.query.faculty_unit_id)  { query += ` AND l.faculty_unit_id = @fac`;   r.input('fac', sql.NVarChar(50), req.query.faculty_unit_id); }
      if (req.query.q)                { query += ` AND (l.title LIKE N'%' + @q + N'%' OR l.lecture_code LIKE '%' + @q + '%')`; r.input('q', sql.NVarChar(200), req.query.q); }

      query += ` ORDER BY l.created_at DESC`;
      const result = await r.query(query);
      result.recordset.forEach((row) => {
        row.peer_unit = isGuest ? false : isPeerUnit(scope, row.faculty_unit_id);
        // Bài của khoa/đơn vị mình (hoặc do mình đăng) → dùng để xếp lên đầu và cho phép CRUD ở trang Soạn
        row.in_my_faculty = isGuest ? false : (inScope(scope, row.faculty_unit_id) || row.author_id === userId);
        // Mở ca dạy: bài đã xuất bản thì AI cũng mở được (kể cả bài của khoa khác); chưa xuất bản thì chỉ trong phạm vi của mình
        row.can_teach = isGuest ? false : (row.status === 'PUBLISHED' || row.in_my_faculty);
      });
      // Bài của khoa mình lên đầu, bài khoa khác xuống dưới (sort ổn định: giữ thứ tự mới nhất trước trong từng nhóm)
      if (!isGuest) result.recordset.sort((a, b) => (b.in_my_faculty ? 1 : 0) - (a.in_my_faculty ? 1 : 0));
      res.json({ total: result.recordset.length, items: result.recordset });
    } catch (err) {
      console.error('[GET /api/lectures]', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const pool = await getPool();
      const isGuest = !req.user || !req.user.is_authenticated || req.user.user_id === 'GUEST' || req.user.user_id === 'ANONYMOUS';
      const clearance = req.user?.clearance_level_id || 1;

      const r = await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .query(`
          SELECT l.*, s.name AS subject_name,
                 u.full_name AS author_name, u.[rank] AS author_rank, u.[position] AS author_position,
                 un.name AS faculty_name, sl.name AS security_name,
                 sch.class_name, sch.venue_name
          FROM DIGITAL_LECTURE l
          JOIN SUBJECT s ON s.subject_id = l.subject_id
          JOIN [USER] u ON u.user_id = l.author_id
          JOIN UNIT un ON un.unit_id = l.faculty_unit_id
          JOIN SECURITY_LEVEL sl ON sl.level_id = l.security_level_id
          OUTER APPLY (
            SELECT TOP 1 ts.venue_name, tc.class_name
            FROM TEACHING_SCHEDULE ts
            LEFT JOIN TRAINING_CLASS tc ON tc.class_id = ts.class_id
            WHERE ts.lecture_id = l.lecture_id
            ORDER BY CASE WHEN ts.status = 'ONGOING' THEN 0 ELSE 1 END, ts.start_time DESC
          ) sch
          WHERE l.lecture_id = @id
        `);
      if (r.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      const lec = r.recordset[0];
      if (lec.security_level_id > clearance) {
        return res.status(403).json({ error: 'Không đủ cấp bảo mật để xem bài giảng này' });
      }
      if (isGuest) {
        if (lec.status !== 'PUBLISHED' || lec.security_level_id !== 1) {
          return res.status(403).json({ error: 'Đại biểu chỉ được xem các bài giảng công khai đã xuất bản' });
        }
      } else {
        const roles = await resolveUserRoles(pool, req.user);
        const isAdmin = roles.includes('ROL-01');
        const scope = await getLectureScope({
          userId: req.user.user_id, roles, deptHead: await isDeptHead(pool, req.user), includeSiblings: true,
        });
        const isPublished = (lec.status === 'PUBLISHED');
        if (!isPublished && !isAdmin && !inScope(scope, lec.faculty_unit_id) && lec.author_id !== req.user.user_id) {
          return res.status(403).json({ error: 'Bài giảng không thuộc đơn vị của bạn' });
        }
      }
      // Không lộ đường dẫn lưu trữ nội bộ ra client — chỉ báo có/không có PDF
      lec.has_pdf = !!lec.pdf_path;
      delete lec.pdf_path;
      delete lec.pdf_sha256;
      res.json(lec);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/', requireAuth, requirePermission('LECTURE_CREATE'), async (req, res) => {
    try {
      const {
        title, subject_id, lecture_code, security_level_id,
        content_type, scorm_entry_point,
      } = req.body || {};
      if (!title || !subject_id) return res.status(400).json({ error: 'Thiếu tiêu đề hoặc môn học' });
      if (lecture_code && String(lecture_code).trim().length > 30) {
        return res.status(400).json({ error: 'Mã bài giảng không được vượt quá 30 ký tự' });
      }
      if (!isSafeEntryPoint(scorm_entry_point)) {
        return res.status(400).json({ error: 'scorm_entry_point không hợp lệ' });
      }

      const validTypes = ['PDF', 'HTML5', 'SCORM'];
      const ctype = String(content_type || 'PDF').toUpperCase();
      if (!validTypes.includes(ctype)) return res.status(400).json({ error: 'Loại nội dung không hợp lệ' });
      // SCORM: scorm_entry_point KHÔNG bắt buộc lúc tạo — web tạo bản nháp trước rồi mới tải gói .zip
      // lên (POST /:id/package/upload), khi đó BE tự đọc imsmanifest.xml và ghi entry point.
      // Việc "bài chưa có gói" đã được chặn ở bước gửi duyệt (kiểm tra thiếu gói học liệu).

      const pool = await getPool();
      const lectureId = 'LEC-' + Date.now();
      const authorId = req.user.user_id;
      const facultyUnitId = await getUserUnitId(pool, authorId);
      if (!facultyUnitId) return res.status(400).json({ error: 'Tài khoản chưa được gán khoa/bộ môn' });

      await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .input('code', sql.NVarChar(100), lecture_code || lectureId)
        .input('title', sql.NVarChar(500), title)
        .input('subject_id', sql.VarChar(50), subject_id)
        .input('author_id', sql.VarChar(50), authorId)
        .input('faculty_unit_id', sql.NVarChar(50), facultyUnitId)
        .input('security_level_id', sql.Int, security_level_id || 2)
        .input('content_type', sql.VarChar(20), ctype)
        .input('scorm_entry_point', sql.NVarChar(255), scorm_entry_point || null)
        .query(`
          INSERT INTO DIGITAL_LECTURE (
            lecture_id, lecture_code, title, subject_id, author_id, faculty_unit_id,
            security_level_id, content_type, scorm_entry_point
          ) VALUES (
            @id, @code, @title, @subject_id, @author_id, @faculty_unit_id,
            @security_level_id, @content_type, @scorm_entry_point
          )
        `);

      await logAudit(req, 'LECTURE_CREATE', `Tạo bài giảng: ${title}`, lectureId);
      res.json({ success: true, lecture_id: lectureId });
    } catch (err) {
      if (err.message?.includes('UQ') || err.message?.includes('PRIMARY KEY')) {
        return res.status(409).json({ error: 'Mã bài giảng đã tồn tại' });
      }
      console.error('[POST /api/lectures]', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', requireAuth, requirePermission('LECTURE_CREATE'), async (req, res) => {
    try {
      const lectureId = req.params.id;
      const pool = await getPool();
      const check = await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .query(`SELECT status, author_id, content_type, faculty_unit_id FROM DIGITAL_LECTURE WHERE lecture_id = @id`);
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      const lec = check.recordset[0];
      // Admin: sửa mọi bài, mọi trạng thái (xử lý bài lỗi/hư hỏng). Tác giả và thành viên cùng khoa/phòng: sửa bài của khoa mình.
      // Bài đã xuất bản do người không phải Admin sửa: có phải qua Chỉ huy duyệt hay không do quyền bị Admin khóa quyết định.
      const roles = await resolveUserRoles(pool, req.user);
      const mg = await canManageLecture({ userId: req.user.user_id, roles, deptHead: await isDeptHead(pool, req.user), lecture: lec });
      if (!mg.ok) {
        return res.status(403).json({ error: 'Chỉ tác giả, thành viên cùng khoa/đơn vị hoặc Admin mới được sửa bài giảng này' });
      }
      const editable = mg.admin
        ? ['DRAFT', 'REJECTED', 'PENDING_FACULTY', 'PENDING_TRAINING', 'PUBLISHED']
        : ['DRAFT', 'REJECTED', 'PUBLISHED'];
      if (!editable.includes(lec.status)) {
        return res.status(400).json({ error: lec.status === 'DELETED'
          ? 'Bài giảng đang nằm trong thùng rác'
          : 'Không thể sửa bài giảng đang chờ duyệt (hãy đợi duyệt xong hoặc nhờ Admin)' });
      }

      const { title, subject_id, lecture_code, security_level_id, content_type, scorm_entry_point } = req.body || {};
      if (lecture_code && String(lecture_code).trim().length > 30) {
        return res.status(400).json({ error: 'Mã bài giảng không được vượt quá 30 ký tự' });
      }
      // Trường nào client không gửi thì GIỮ NGUYÊN giá trị cũ (COALESCE) — tránh xóa nhầm
      // scorm_entry_point khi form sửa không đính kèm lại tệp. Tệp PDF chỉ đổi qua POST /:id/pdf/upload.
      if (!isSafeEntryPoint(scorm_entry_point)) {
        return res.status(400).json({ error: 'scorm_entry_point không hợp lệ' });
      }
      const ctype = String(content_type || lec.content_type || 'PDF').toUpperCase();
      if (!['PDF', 'HTML5', 'SCORM'].includes(ctype)) {
        return res.status(400).json({ error: 'Loại nội dung không hợp lệ' });
      }

      await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .input('title', sql.NVarChar(500), title ?? null)
        .input('lecture_code', sql.NVarChar(100), lecture_code ? String(lecture_code).trim() : null)
        .input('subject_id', sql.VarChar(50), subject_id ?? null)
        .input('security_level_id', sql.Int, security_level_id ?? null)
        .input('content_type', sql.VarChar(20), ctype)
        .input('scorm_entry_point', sql.NVarChar(255), scorm_entry_point || null)
        .query(`
          UPDATE DIGITAL_LECTURE
          SET title = COALESCE(@title, title),
              lecture_code = COALESCE(@lecture_code, lecture_code),
              subject_id = COALESCE(@subject_id, subject_id),
              security_level_id = COALESCE(@security_level_id, security_level_id),
              content_type = @content_type,
              scorm_entry_point = COALESCE(@scorm_entry_point, scorm_entry_point),
              updated_at = GETDATE()
          WHERE lecture_id = @id
        `);
      await logAudit(req, 'LECTURE_UPDATE',
        `Sửa bài giảng ${lectureId}${lec.author_id !== req.user.user_id ? ` (của ${lec.author_id}, ${mg.admin ? 'Admin' : 'cùng khoa'})` : ''}${lec.status === 'PUBLISHED' ? ' — bài đã xuất bản' : ''}`,
        lectureId);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // 1. API Xoá mềm → chuyển vào THÙNG RÁC của trang Quản trị (chỉ Admin khôi phục / xóa vĩnh viễn ở đó)
  //    Ai được xóa mềm: Admin/Chỉ huy (mọi bài chưa chờ duyệt/xuất bản) hoặc TÁC GIẢ (bài của mình đang Bản nháp/Cần sửa)
  router.delete('/:id', requireAuth, requirePermission('LECTURE_DELETE'), async (req, res) => {
    try {
      const pool = await getPool();
      const lectureId = req.params.id;

      const cur = await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .query(`SELECT status, author_id, faculty_unit_id FROM DIGITAL_LECTURE WHERE lecture_id = @id`);
      if (cur.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      const { status: curStatus } = cur.recordset[0];

      // Admin: xóa mềm mọi bài, mọi trạng thái. Tác giả / thành viên cùng khoa-phòng (và Chỉ huy cấp trên): xóa bài của khoa mình.
      // Bài đã xuất bản do người không phải Admin xóa: có phải qua Chỉ huy duyệt hay không do quyền bị Admin khóa quyết định.
      const roles = await resolveUserRoles(pool, req.user);
      const mg = await canManageLecture({
        userId: req.user.user_id, roles, deptHead: await isDeptHead(pool, req.user), lecture: cur.recordset[0],
      });
      if (!mg.ok) {
        return res.status(403).json({ error: 'Chỉ tác giả, thành viên cùng khoa/đơn vị hoặc Admin mới được xóa bài giảng này.' });
      }
      if (!mg.admin && ['PENDING_FACULTY', 'PENDING_TRAINING'].includes(curStatus)) {
        return res.status(400).json({ error: 'Không thể xóa bài giảng đang chờ duyệt.' });
      }
      if (curStatus === 'DELETED') return res.status(400).json({ error: 'Bài giảng đã nằm trong thùng rác.' });

      const r = await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .query(`UPDATE DIGITAL_LECTURE SET status = 'DELETED', updated_at = GETDATE() WHERE lecture_id = @id`);

      if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });

      await logAudit(req, 'LECTURE_SOFT_DELETE',
        `Chuyển bài giảng ${lectureId} vào thùng rác${curStatus === 'PUBLISHED' ? ' (bài đã xuất bản)' : ''}${mg.admin ? ' — Admin' : ''}`,
        lectureId);
      res.json({ success: true, message: 'Đã chuyển bài giảng vào thùng rác' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Gửi duyệt
  router.post('/:id/submit', requireAuth, requirePermission('LECTURE_CREATE'), async (req, res) => {
    try {
      const pool = await getPool();
      const check = await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .query(`SELECT status, author_id, content_type, pending_scorm_path, scorm_entry_point, pdf_path
                FROM DIGITAL_LECTURE WHERE lecture_id = @id`);
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy' });
      if (check.recordset[0].author_id !== req.user.user_id) {
        return res.status(403).json({ error: 'Chỉ tác giả mới có quyền gửi duyệt' });
      }
      if (!['DRAFT', 'REJECTED'].includes(check.recordset[0].status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ để gửi duyệt' });
      }
      // Chặn gửi duyệt bài chưa có tệp/gói học liệu (nếu không, cấp trên duyệt sẽ báo thiếu gói)
      const lc = check.recordset[0];
      const hasContent = lc.content_type === 'PDF'
        ? !!lc.pdf_path
        : !!(lc.pending_scorm_path || lc.scorm_entry_point);
      if (!hasContent) {
        return res.status(400).json({
          error: 'Bài giảng chưa có tệp/gói học liệu. Hãy tải lên (Chỉnh sửa → chọn tệp) trước khi gửi duyệt.',
          code: 'NO_PACKAGE',
        });
      }
      await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .query(`UPDATE DIGITAL_LECTURE SET status='PENDING_FACULTY', reject_reason=NULL, updated_at=GETDATE()${(await delegatedReady()) ? ', validated_by=NULL, validated_at=NULL, validate_decision=NULL, validate_note=NULL' : ''} WHERE lecture_id=@id`);
      await logAudit(req, 'LECTURE_SUBMIT', `Gửi duyệt bài giảng ${req.params.id}`, req.params.id);
      res.json({ success: true, message: 'Đã gửi duyệt lên Khoa/Bộ môn' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // 2. API KHÔI PHỤC BÀI GIẢNG TỪ THÙNG RÁC
  router.post('/:id/restore', requireAuth, requirePermission('LECTURE_DELETE'), async (req, res) => {
    try {
      const pool = await getPool();
      if (!(await requireAdminOnly(pool, req, res))) return;

      const lectureId = req.params.id;
      const r = await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .query(`UPDATE DIGITAL_LECTURE SET status = 'DRAFT', updated_at = GETDATE() WHERE lecture_id = @id AND status = 'DELETED'`);

      if (r.rowsAffected[0] === 0) {
        return res.status(400).json({ error: 'Bài giảng không ở trạng thái đã xóa' });
      }

      await logAudit(req, 'LECTURE_RESTORE', `Khôi phục bài giảng ${lectureId} từ thùng rác`, lectureId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


  // 3. API XÓA VĨNH VIỄN (CHỈ DÀNH CHO BÀI GIẢNG ĐÃ Ở TRONG THÙNG RÁC)
  router.delete('/:id/purge', requireAuth, requirePermission('LECTURE_DELETE'), async (req, res) => {
    try {
      const pool = await getPool();
      if (!(await requireAdminOnly(pool, req, res))) return;

      const lectureId = req.params.id;

      // Lấy thông tin để xóa file vật lý
      const check = await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .query(`SELECT title, created_at, status, pending_scorm_path, pdf_path FROM DIGITAL_LECTURE WHERE lecture_id = @id`);

      if (check.recordset.length === 0 || check.recordset[0].status !== 'DELETED') {
        return res.status(400).json({ error: 'Chỉ có thể xóa vĩnh viễn bài giảng đang ở trong thùng rác' });
      }
      const lec = check.recordset[0];

      // Không cho xóa nếu còn ca đang diễn ra
      const ongoing = await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .query(`SELECT COUNT(*) AS n FROM TEACHING_SCHEDULE
                WHERE lecture_id = @id AND status = 'ONGOING'`);
      if (ongoing.recordset[0].n > 0) {
        return res.status(409).json({ error: 'Bài giảng đang có ca giảng dạy diễn ra, hãy kết thúc ca trước khi xóa vĩnh viễn' });
      }

      // Xóa DB trong 1 transaction: bảng con không có CASCADE xử lý trước, bảng cha xóa sau
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        const run = (text) => new sql.Request(tx)
          .input('id', sql.VarChar(50), lectureId)
          .query(text);
        await run(`DELETE FROM SCORM_TRACKING WHERE lecture_id = @id`);
        await run(`UPDATE TEACHING_HISTORY SET lecture_id = NULL WHERE lecture_id = @id`);
        await run(`DELETE FROM TEACHING_SCHEDULE WHERE lecture_id = @id`);   // kéo theo LECTURE_QUIZ_ATTEMPT (CASCADE)
        await run(`DELETE FROM DIGITAL_LECTURE WHERE lecture_id = @id`);     // kéo theo Quiz, SCORM_PACKAGE (CASCADE)
        await tx.commit();
      } catch (e) {
        await tx.rollback().catch(() => {});
        throw e;
      }

      // Xóa File Vật Lý
      const { getModuleUploadPath, MODULES, sanitizeFolderName } = require('./storage-helper');
      const folderName = `${sanitizeFolderName(lec.title || 'Bai_Giang')}_${lectureId}`;
      const date = lec.created_at ? new Date(lec.created_at) : new Date();
      const { absPath: targetDir } = getModuleUploadPath(MODULES.LECTURES, date, folderName);

      if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });

      if (lec.pending_scorm_path) {
        const pendingAbs = path.resolve(__dirname, '..', lec.pending_scorm_path);
        if (fs.existsSync(pendingAbs)) fs.unlinkSync(pendingAbs);
      }

      // Tệp PDF giáo án: xóa đúng đường dẫn đã lưu (có thể nằm ở thư mục tháng/tiêu đề khác
      // với thư mục tính từ created_at ở trên), rồi dọn thư mục nếu đã trống.
      if (lec.pdf_path) {
        const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
        const pdfAbs = path.resolve(__dirname, '..', lec.pdf_path);
        if (pdfAbs.startsWith(uploadsRoot + path.sep)) {
          try {
            if (fs.existsSync(pdfAbs)) fs.unlinkSync(pdfAbs);
            const dir = path.dirname(pdfAbs);
            if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
          } catch (e) {
            console.warn('[lecture purge] Không xóa được PDF:', lec.pdf_path, e.message);
          }
        }
      }

      await logAudit(req, 'LECTURE_PURGE', `Xóa vĩnh viễn bài giảng ${lectureId} khỏi hệ thống`, lectureId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


  // Duyệt 2 tầng
  router.post('/:id/approve', requireAuth, requirePermission('LECTURE_APPROVE'), async (req, res) => {
    try {
      const pool = await getPool();
      const lectureId = req.params.id;
      const check = await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .query(`SELECT status, faculty_unit_id, author_id, content_type,
                       pending_scorm_path, scorm_entry_point,
                       title, created_at, pdf_path
                FROM DIGITAL_LECTURE WHERE lecture_id = @id`);                 // [1]
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });

      const lec = check.recordset[0];
      const roles = await resolveUserRoles(pool, req.user);
      const isAdmin = roles.includes('ROL-01');
      const isCommander = roles.includes('ROL-02');
      const deptHead = await isDeptHead(pool, req.user);

      // Người được cấp quyền LECTURE_APPROVE trong bảng quyền nhưng KHÔNG phải Admin/Chỉ huy → chỉ THẨM ĐỊNH:
      // ghi nhận người thẩm định, bài vẫn chờ; Chỉ huy cấp trên xác nhận mới chính thức duyệt.
      if (!isAdmin && !isCommander) {
        if (!['PENDING_FACULTY', 'PENDING_TRAINING'].includes(lec.status)) {
          return res.status(400).json({ error: 'Trạng thái không hợp lệ để duyệt' });
        }
        if (!(await delegatedReady())) {
          return res.status(403).json({ error: 'Chỉ Admin hoặc Chỉ huy mới được duyệt bài giảng' });
        }
        if (lec.author_id === req.user.user_id) {
          return res.status(403).json({ error: 'Bạn không thể tự thẩm định bài giảng của chính mình', code: 'SELF_VALIDATE' });
        }
        const dScope = await getLectureScope({ userId: req.user.user_id, roles, deptHead: true }); // đơn vị mình + cấp dưới
        if (!inScope(dScope, lec.faculty_unit_id)) {
          return res.status(403).json({ error: 'Bài giảng không thuộc đơn vị của bạn hoặc cấp dưới' });
        }
        const n = await recordValidation({
          table: 'DIGITAL_LECTURE', id: lectureId, userId: req.user.user_id, decision: 'APPROVE',
          note: req.body?.note || req.body?.review_note,
        });
        if (n === 0) return res.status(400).json({ error: 'Bài giảng không còn ở trạng thái chờ duyệt' });
        await logAudit(req, 'LECTURE_VALIDATED', `Thẩm định (đề nghị duyệt) bài giảng ${lectureId}`, lectureId);
        return res.json({
          success: true, validated: true, final: false,
          message: 'Đã thẩm định — bài giảng chờ Chỉ huy cấp trên xác nhận mới chính thức',
        });
      }

      let nextStatus = '';
      if (lec.status === 'PENDING_FACULTY') {
        // Quy tắc thống nhất: CHỈ Admin (ROL-01) và Chỉ huy (ROL-02) được duyệt (trưởng bộ môn theo chức vụ không duyệt)
        if (!isAdmin && !isCommander) {
          return res.status(403).json({ error: 'Chỉ Admin hoặc Chỉ huy mới được duyệt bài giảng' });
        }
        if (!isAdmin) {
          const scope = await getLectureScope({ userId: req.user.user_id, roles, deptHead });
          if (!inScope(scope, lec.faculty_unit_id)) {
            return res.status(403).json({ error: 'Chỉ được duyệt bài giảng thuộc đơn vị của mình hoặc cấp dưới' });
          }
        }
        nextStatus = 'PENDING_TRAINING';
      } else if (lec.status === 'PENDING_TRAINING') {
        if (!isAdmin && !isCommander) {
          return res.status(403).json({ error: 'Chỉ BGH/Admin mới duyệt cấp Trường' });
        }
        if (!isAdmin) {
          const scope = await getLectureScope({ userId: req.user.user_id, roles, deptHead });
          if (!inScope(scope, lec.faculty_unit_id)) {
            return res.status(403).json({ error: 'Bài giảng không thuộc đơn vị của bạn' });
          }
        }
        nextStatus = 'PUBLISHED';
      } else {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ để duyệt' });
      }

      // ══════════════════════════════════════════════════════════════════
      // [2] GIẢI NÉN GÓI ZIP (SCORM/HTML5) TRƯỚC KHI SET PUBLISHED
      // Chỉ chạy ở tầng 2 (PUBLISHED) — tầng 1 (PENDING_TRAINING) chưa
      // cần extract vì còn phải chờ Chỉ huy cấp Trường duyệt.
      // Fail → trả 500, giữ nguyên PENDING_TRAINING, KHÔNG publish nửa vời.
      // ══════════════════════════════════════════════════════════════════
      let extractedEntryPoint = null;
      let extractedContentType = null;

      if (nextStatus === 'PUBLISHED') {
        if (lec.pending_scorm_path) {
          try {
            const { extractAndParse } = require('./lecture-package-helper');
            const out = await extractAndParse({
              lectureId,
              pendingPath: lec.pending_scorm_path,
              title:     lec.title,
              createdAt: lec.created_at,
            });
            console.log(`[lecture approve] Extracted ${lectureId} → ${out.entry_point} (${out.content_type})`);
            extractedEntryPoint = out.entry_point;
            extractedContentType = out.content_type;
          } catch (ex) {
            console.error(`[lecture approve] Extract failed ${lectureId}:`, ex);
            return res.status(500).json({
              error: 'Không giải nén được gói học liệu: ' + ex.message,
              code: 'EXTRACT_FAILED',
            });
          }
        } else if (lec.content_type === 'PDF') {
          if (!lec.pdf_path) {
            return res.status(400).json({
              error: 'Bài giảng PDF chưa có tệp tài liệu đính kèm (chưa tải lên tệp PDF)',
              code: 'NO_DOCUMENT',
            });
          }
        } else if (!lec.scorm_entry_point) {
          // Fallback tự động nhận diện trong thư mục chuẩn mới:
          // uploads/bai-giang-so/YYYY/MM/<Ten_Bai_Giang>_<MaLecture>/
          const { getModuleUploadPath, MODULES, sanitizeFolderName } = require('./storage-helper');
          const folderName = `${sanitizeFolderName(lec.title || 'Bai_Giang')}_${lectureId}`; // Thêm _lectureId
          const date = lec.created_at ? new Date(lec.created_at) : new Date();
          const { absPath: lectureDir, relPath: baseRelPath } =
            getModuleUploadPath(MODULES.LECTURES, date, folderName);

          if (fs.existsSync(lectureDir)) {
            const files = fs.readdirSync(lectureDir);
            const commonEntries = ['index.html', 'story.html', 'launch.html', 'demo.html'];
            const entry = commonEntries.find(f => files.includes(f))
              || files.find(f => f.toLowerCase().endsWith('.html'));
            if (entry) {
              extractedEntryPoint = `${baseRelPath}/${entry}`.replace(/\\/g, '/');
            }
          }
          if (!extractedEntryPoint) {
            // Không có ZIP pending và cũng chưa có entry point → không thể publish
            return res.status(400).json({
              error: 'Bài giảng chưa có gói học liệu (thiếu pending_scorm_path và scorm_entry_point)',
              code: 'NO_PACKAGE',
            });
          }
        }
      }

      let updateSql = `UPDATE DIGITAL_LECTURE SET status=@st, reject_reason=NULL, updated_at=GETDATE()${(await delegatedReady()) ? ', validated_by=NULL, validated_at=NULL, validate_decision=NULL, validate_note=NULL' : ''}`;
      const updateReq = pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .input('st', sql.VarChar(30), nextStatus);

      if (extractedEntryPoint) {
        updateSql += `, scorm_entry_point=@ep, pending_scorm_path=NULL`;
        updateReq.input('ep', sql.NVarChar(500), extractedEntryPoint);
        if (extractedContentType) {
          updateSql += `, content_type=@ct`;
          updateReq.input('ct', sql.VarChar(20), extractedContentType);
        }
      }

      updateSql += ` WHERE lecture_id=@id`;
      await updateReq.query(updateSql);

      await logAudit(
        req,
        nextStatus === 'PUBLISHED' ? 'LECTURE_PUBLISHED' : 'LECTURE_APPROVED_TIER',
        `Duyệt bài giảng ${lectureId} → ${nextStatus}`,
        lectureId
      );
      res.json({ success: true, new_status: nextStatus });
    } catch (err) {
      console.error('[POST approve]', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/reject', requireAuth, requirePermission('LECTURE_APPROVE'), async (req, res) => {
    try {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) return res.status(400).json({ error: 'Cần nhập lý do từ chối' });
      const pool = await getPool();
      const check = await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .query(`SELECT status, faculty_unit_id, author_id FROM DIGITAL_LECTURE WHERE lecture_id = @id`);
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy' });
      {
        const roles = await resolveUserRoles(pool, req.user);
        // Từ chối cũng là quyết định duyệt: Admin/Chỉ huy từ chối CHÍNH THỨC; người khác có quyền duyệt chỉ ĐỀ NGHỊ từ chối
        if (!roles.includes('ROL-01') && !roles.includes('ROL-02')) {
          const cur = check.recordset[0];
          if (!(await delegatedReady())) {
            return res.status(403).json({ error: 'Chỉ Admin hoặc Chỉ huy mới được từ chối bài giảng' });
          }
          if (!['PENDING_FACULTY', 'PENDING_TRAINING'].includes(cur.status)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ để từ chối' });
          }
          if (cur.author_id === req.user.user_id) {
            return res.status(403).json({ error: 'Bạn không thể tự thẩm định bài giảng của chính mình', code: 'SELF_VALIDATE' });
          }
          const dScope = await getLectureScope({ userId: req.user.user_id, roles, deptHead: true });
          if (!inScope(dScope, cur.faculty_unit_id)) {
            return res.status(403).json({ error: 'Bài giảng không thuộc đơn vị của bạn hoặc cấp dưới' });
          }
          const n = await recordValidation({
            table: 'DIGITAL_LECTURE', id: req.params.id, userId: req.user.user_id, decision: 'REJECT', note: reason,
          });
          if (n === 0) return res.status(400).json({ error: 'Bài giảng không còn ở trạng thái chờ duyệt' });
          await logAudit(req, 'LECTURE_VALIDATE_REJECT', `Thẩm định (đề nghị từ chối) ${req.params.id}: ${reason}`, req.params.id);
          return res.json({
            success: true, validated: true, final: false,
            message: 'Đã thẩm định — đề nghị từ chối chờ Chỉ huy cấp trên xác nhận',
          });
        }
        const scope = await getLectureScope({
          userId: req.user.user_id, roles, deptHead: await isDeptHead(pool, req.user),
        });
        if (!inScope(scope, check.recordset[0].faculty_unit_id)) {
          return res.status(403).json({ error: 'Bài giảng không thuộc đơn vị của bạn' });
        }
      }
      if (!['PENDING_FACULTY', 'PENDING_TRAINING'].includes(check.recordset[0].status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ để từ chối' });
      }
      await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .input('reason', sql.NVarChar(500), reason.slice(0, 500))
        .query(`UPDATE DIGITAL_LECTURE SET status='REJECTED', reject_reason=@reason, updated_at=GETDATE()${(await delegatedReady()) ? ', validated_by=NULL, validated_at=NULL, validate_decision=NULL, validate_note=NULL' : ''} WHERE lecture_id=@id`);
      await logAudit(req, 'LECTURE_REJECTED', `Từ chối ${req.params.id}: ${reason}`, req.params.id);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ═════════════════════════════════════════════════════════════
  // PHẦN 3 — TEACHING SCHEDULE (Ca giảng dạy)
  // ═════════════════════════════════════════════════════════════

  // Danh sách giảng đường CHỌN ĐƯỢC khi mở ca (thay cho ô nhập tay): phòng đang hoạt động,
  // kèm khu, sức chứa, trạng thái bảo trì và có ca đang diễn ra hay không.
  router.get('/catalogs/rooms', async (req, res) => {
    try {
      const pool = await getPool();
      const catalog = await loadBuildingCatalog(pool);
      const catalogByCode = new Map(catalog.map((b) => [b.building_code, b]));
      const inactiveCodes = new Set(catalog.filter((b) => !b.active).map((b) => b.building_code));

      const r = await pool.request().query(`
        SELECT c.room_id, c.room_name, c.room_type, c.capacity, c.building_code, c.building_name,
               c.floor_number, c.display_order, c.is_maintenance, c.maintenance_reason,
               CAST(CASE WHEN EXISTS (
                 SELECT 1 FROM TEACHING_SCHEDULE s
                 WHERE s.status = 'ONGOING' AND (s.room_id = c.room_id OR s.venue_name = c.room_name)
               ) THEN 1 ELSE 0 END AS BIT) AS is_busy
        FROM CLASSROOM c
        WHERE c.active = 1
        ORDER BY c.building_code, c.floor_number, c.display_order, c.room_name
      `);

      const items = r.recordset
        .filter((x) => !inactiveCodes.has(x.building_code || 'H1'))
        .map((x) => {
          const code = x.building_code || 'H1';
          const cat = catalogByCode.get(code);
          return {
            room_id: x.room_id,
            room_name: x.room_name,
            room_type: x.room_type,
            capacity: x.capacity,
            building_code: code,
            building_name: cat?.building_name || x.building_name || `Khu ${code}`,
            building_order: cat?.display_order ?? 999,
            is_maintenance: !!x.is_maintenance,
            maintenance_reason: x.maintenance_reason || null,
            is_busy: !!x.is_busy,
          };
        })
        .sort((a, b) => a.building_order - b.building_order || a.building_code.localeCompare(b.building_code));

      res.json({ items });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Bắt đầu ca
  router.post('/schedules/start', requireAuth, requirePermission('SCHEDULE_START'), async (req, res) => {
    try {
      const { lecture_id, class_id, room_id, student_count, session_type, note } = req.body || {};
      const stype = String(session_type || 'TEACHER_LED').toUpperCase();

      if (!lecture_id || !class_id) {
        return res.status(400).json({ error: 'Thiếu bài giảng hoặc lớp' });
      }
      // Giảng đường phải chọn từ danh sách (mã phòng), không nhận tên gõ tay để sơ đồ giám sát luôn khớp
      if (!room_id) {
        return res.status(400).json({
          error: 'Vui lòng chọn giảng đường từ danh sách',
          code: 'ROOM_REQUIRED',
        });
      }
      if (!['TEACHER_LED', 'SELF_STUDY'].includes(stype)) {
        return res.status(400).json({ error: 'Loại ca dạy không hợp lệ' });
      }
      const sc = parseInt(student_count, 10);
      if (!Number.isFinite(sc) || sc < 0) {
        return res.status(400).json({ error: 'Sĩ số không hợp lệ (>=0)' });
      }

      const pool = await getPool();

      // Kiểm tra bài giảng
      const lecCheck = await pool.request()
        .input('lid', sql.VarChar(50), lecture_id)
        .query(`SELECT status, title, security_level_id, faculty_unit_id
                FROM DIGITAL_LECTURE WHERE lecture_id = @lid`);
      if (lecCheck.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      const lecture = lecCheck.recordset[0];
      if (lecture.status !== 'PUBLISHED') {
        return res.status(400).json({ error: 'Chỉ có thể mở ca với bài giảng đã PUBLISHED' });
      }
      // Bài đã xuất bản thuộc kho chung: giáo viên MỌI khoa đều mở ca được (kể cả bài của khoa khác),
      // miễn là có quyền mở ca và đủ cấp bảo mật. Quản lý (sửa/xóa) mới bị giới hạn theo khoa.
      if (lecture.security_level_id > (req.user.clearance_level_id || 1)) {
        return res.status(403).json({ error: 'Không đủ cấp bảo mật để mở ca với bài giảng này' });
      }

      // 🛡️ CHỐT CHẶN BẢO MẬT: Bài giảng Cấp 3+ bắt buộc phải có token vân tay hợp lệ
      // Ngăn chặn việc dùng Postman gọi thẳng API mà bỏ qua bước quét vân tay ở FE
      if (lecture.security_level_id >= 3) {
        const fpToken = req.headers['x-fingerprint-token'];
        if (!fpToken) {
          return res.status(403).json({
            error: 'Bài giảng cấp 3+ yêu cầu xác thực sinh trắc học (vân tay) trước khi mở ca dạy.',
            require_fingerprint: true,
          });
        }
        try {
          const jwt = require('jsonwebtoken');
          const JWT_SECRET = process.env.JWT_SECRET;
          if (!JWT_SECRET || JWT_SECRET.length < 32) {
            throw new Error('[FATAL] JWT_SECRET missing or < 32 chars');
          }
          const decoded = jwt.verify(fpToken, JWT_SECRET);
          if (decoded.purpose !== 'file_access') throw new Error('Sai purpose');

          // Xác thực chéo: token phải khớp đúng bài giảng VÀ đúng user đang đăng nhập
          if (decoded.file_id !== String(lecture_id).trim()) throw new Error('Token không khớp bài giảng');
          if (decoded.user_id !== req.user.user_id) throw new Error('Token không khớp user');
        } catch (err) {
          console.warn('[POST schedules/start] token vân tay bị từ chối:', err.name, '-', err.message);
          return res.status(403).json({
            error: 'Phiên xác thực vân tay không hợp lệ hoặc đã hết hạn. Vui lòng quét lại.',
            require_fingerprint: true,
          });
        }
      }

      // Giảng đường phải có thật, đang hoạt động, khu không bị tắt và không bảo trì
      const roomRes = await pool.request()
        .input('rid', sql.VarChar(50), String(room_id))
        .query(`SELECT room_id, room_name, building_code, is_maintenance, maintenance_reason, active
                FROM CLASSROOM WHERE room_id = @rid`);
      const room = roomRes.recordset[0];
      if (!room || !room.active) {
        return res.status(400).json({ error: 'Giảng đường không tồn tại hoặc đã ngừng sử dụng', code: 'ROOM_NOT_FOUND' });
      }
      const buildingCatalogStart = await loadBuildingCatalog(pool);
      if (buildingCatalogStart.some((b) => b.building_code === (room.building_code || 'H1') && !b.active)) {
        return res.status(400).json({ error: 'Khu của giảng đường này đã ngừng sử dụng', code: 'BUILDING_INACTIVE' });
      }
      if (room.is_maintenance) {
        return res.status(409).json({
          error: `Giảng đường đang bảo trì${room.maintenance_reason ? `: ${room.maintenance_reason}` : ''}`,
          code: 'ROOM_MAINTENANCE',
        });
      }
      const venue_name = room.room_name; // tên hiển thị lấy từ danh mục, không tin dữ liệu client

      // Kiểm tra giảng đường trống (theo mã phòng; kèm tên để bắt các ca cũ ghi tên tự do)
      const busy = await pool.request()
        .input('rid', sql.VarChar(50), room.room_id)
        .input('v', sql.NVarChar(100), venue_name)
        .query(`SELECT TOP 1 schedule_id FROM TEACHING_SCHEDULE
                WHERE status = 'ONGOING' AND (room_id = @rid OR venue_name = @v)`);
      if (busy.recordset.length > 0) {
        return res.status(409).json({
          error: 'Giảng đường đang có ca giảng dạy khác chưa kết thúc',
          ongoing_schedule_id: busy.recordset[0].schedule_id,
        });
      }

      // Kiểm tra cột mở rộng (nếu có migration v2)
      const hasSessionType = await hasColumn(pool, 'TEACHING_SCHEDULE', 'session_type');
      const hasCurrentPage = await hasColumn(pool, 'TEACHING_SCHEDULE', 'current_page');
      const hasNote = await hasColumn(pool, 'TEACHING_SCHEDULE', 'note');
      const hasRoomId = await hasColumn(pool, 'TEACHING_SCHEDULE', 'room_id');

      const scheduleId = 'SCH-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      const presenterId = req.user.user_id;

      const columns = ['schedule_id', 'lecture_id', 'presenter_id', 'class_id', 'venue_name', 'student_count', 'start_time', 'status'];
      const values  = ['@id', '@lid', '@pid', '@cid', '@v', '@cnt', 'GETDATE()', "'ONGOING'"];
      const request = pool.request()
        .input('id', sql.VarChar(50), scheduleId)
        .input('lid', sql.VarChar(50), lecture_id)
        .input('pid', sql.VarChar(50), presenterId)
        .input('cid', sql.VarChar(50), class_id)
        .input('v', sql.NVarChar(100), venue_name)
        .input('cnt', sql.Int, sc);

      if (hasRoomId) {
        columns.push('room_id'); values.push('@rid');
        request.input('rid', sql.VarChar(50), room.room_id);
      }
      if (hasSessionType) {
        columns.push('session_type'); values.push('@stype');
        request.input('stype', sql.VarChar(20), stype);
      }
      if (hasCurrentPage) {
        columns.push('current_page'); values.push('1');
      }
      if (hasNote) {
        columns.push('note'); values.push('@note');
        request.input('note', sql.NVarChar(500), (note || '').slice(0, 500) || null);
      }

      await request.query(`
        INSERT INTO TEACHING_SCHEDULE (${columns.join(', ')})
        VALUES (${values.join(', ')})
      `);

      await logAudit(
        req,
        'SCHEDULE_START',
        `Bắt đầu ca ${stype}: "${lecture.title}" | sĩ số=${sc} | phòng=${room.room_id} (${venue_name})`,
        lecture_id
      );

      res.json({
        success: true,
        schedule_id: scheduleId,
        session_type: hasSessionType ? stype : 'TEACHER_LED',
        room_id: room.room_id,
        venue_name,
        start_time: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[POST /api/lectures/schedules/start]', err);
      res.status(500).json({ error: err.message });
    }
  });



  

  // Cập nhật tiến độ bài giảng trực tiếp (slide_index, slide_total, scorm_progress)
  router.put('/schedules/:id/progress', requireAuth, requirePermission('SCHEDULE_START'), async (req, res) => {
    try {
      const rawIndex = req.body?.slide_index ?? req.body?.current_page;
      const slideIndex = parseInt(rawIndex, 10);
      const slideTotal = req.body?.slide_total ? parseInt(req.body.slide_total, 10) : null;
      let scormProgress = req.body?.scorm_progress !== undefined && req.body?.scorm_progress !== null
        ? parseFloat(req.body.scorm_progress)
        : null;

      if (scormProgress === null && Number.isFinite(slideIndex) && slideTotal && slideTotal > 0) {
        scormProgress = Math.min(1, +(slideIndex / slideTotal).toFixed(4));
      }

      if (!Number.isFinite(slideIndex) || slideIndex < 1) {
        return res.status(400).json({ error: 'slide_index hoặc current_page không hợp lệ' });
      }

      const pool = await getPool();
      const check = await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .query(`SELECT presenter_id, status FROM TEACHING_SCHEDULE WHERE schedule_id = @id`);
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy ca' });
      const s = check.recordset[0];
      if (s.status !== 'ONGOING') return res.status(400).json({ error: 'Ca không ở trạng thái ONGOING' });
      if (s.presenter_id !== req.user.user_id && !(req.user.roles || []).includes('ROL-01')) {
        return res.status(403).json({ error: 'Chỉ người mở ca mới cập nhật được tiến độ' });
      }

      const hasSlideIndex = await hasColumn(pool, 'TEACHING_SCHEDULE', 'slide_index');
      const hasCurrentPage = await hasColumn(pool, 'TEACHING_SCHEDULE', 'current_page');

      const updates = [];
      const r = pool.request().input('id', sql.VarChar(50), req.params.id);

      if (hasSlideIndex) {
        updates.push('slide_index = @si', 'slide_total = @st', 'scorm_progress = @sp');
        r.input('si', sql.Int, slideIndex);
        r.input('st', sql.Int, slideTotal);
        r.input('sp', sql.Float, scormProgress);
      }
      if (hasCurrentPage) {
        updates.push('current_page = @pg');
        r.input('pg', sql.Int, slideIndex);
      }

      if (updates.length > 0) {
        await r.query(`UPDATE TEACHING_SCHEDULE SET ${updates.join(', ')} WHERE schedule_id = @id`);
      }

      res.json({
        success: true,
        slide_index: slideIndex,
        slide_total: slideTotal,
        scorm_progress: scormProgress,
        current_page: slideIndex,
      });
    } catch (err) {
      console.error('[PUT /schedules/:id/progress]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Kết thúc ca — LÕI XỬ LÝ CHUNG
  //   isForce = false → chỉ người mở ca (hoặc Admin) mới được kết thúc
  //   isForce = true  → bỏ qua check presenter (dùng cho Force End bởi Chỉ huy/Admin)
  async function endScheduleInternal({ scheduleId, actorUser, isForce = false }) {
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.VarChar(50), scheduleId)
      .query(`SELECT s.*, l.title AS lecture_title
              FROM TEACHING_SCHEDULE s
              JOIN DIGITAL_LECTURE l ON l.lecture_id = s.lecture_id
              WHERE s.schedule_id = @id`);

    if (r.recordset.length === 0) { const e = new Error('Không tìm thấy ca'); e.code = 'NOT_FOUND'; throw e; }
    const s = r.recordset[0];
    if (s.status !== 'ONGOING') { const e = new Error('Ca không ở trạng thái ONGOING'); e.code = 'BAD_STATE'; throw e; }

    // Nếu KHÔNG PHẢI là Force End, thì phải là người tạo ca (hoặc Admin)
    const isAdmin = (actorUser.roles || []).includes('ROL-01');
    if (!isForce && s.presenter_id !== actorUser.user_id && !isAdmin) {
      const e = new Error('Không có quyền kết thúc ca này'); e.code = 'FORBIDDEN'; throw e;
    }

    const endTime = new Date();
    const durationMinutes = Math.max(0, Math.floor((endTime - new Date(s.start_time)) / 60000));

    await pool.request()
      .input('id', sql.VarChar(50), scheduleId)
      .input('et', sql.DateTime, endTime)
      .query(`UPDATE TEACHING_SCHEDULE SET status='COMPLETED', end_time=@et WHERE schedule_id=@id`);

    return { schedule_id: scheduleId, duration_minutes: durationMinutes, lecture_title: s.lecture_title };
  }

  // Người mở ca tự kết thúc ca của mình
  router.post('/schedules/:id/end', requireAuth, requirePermission('SCHEDULE_START'), async (req, res) => {
    try {
      const result = await endScheduleInternal({
        scheduleId: req.params.id,
        actorUser: req.user,
      });
      await logAudit(
        req,
        'SCHEDULE_END',
        `Kết thúc ca ${result.schedule_id} (${result.duration_minutes} phút)`
      );
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
      if (err.code === 'BAD_STATE') return res.status(400).json({ error: err.message });
      if (err.code === 'FORBIDDEN') return res.status(403).json({ error: err.message });
      console.error('[POST schedule end]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // API Buộc kết thúc (Dành cho Quản trị viên Admin kết thúc ca tại phòng giám sát)
  router.post('/schedules/:id/force-end', requireAuth, async (req, res) => {
    try {
      const pool = await getPool();
      const roles = await resolveUserRoles(pool, req.user);
      if (!roles.includes('ROL-01')) {
        return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền kết thúc ca tại phòng giám sát.' });
      }

      const result = await endScheduleInternal({
        scheduleId: req.params.id,
        actorUser: req.user, // Đã được check quyền ở trên
        isForce: true,
      });

      await logAudit(req, 'SCHEDULE_FORCE_END',
        `Quản trị viên (Admin) kết thúc ca ${result.schedule_id} (${result.duration_minutes} phút)`);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
      if (err.code === 'BAD_STATE') return res.status(400).json({ error: err.message });
      if (err.code === 'FORBIDDEN') return res.status(403).json({ error: err.message });
      console.error('[POST force-end]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Live Monitor — LECTURE_VIEW + role check
  router.get('/schedules/live', requireAuth, monitorReadGuard, async (req, res) => {
    try {
      const pool = await getPool();
      const roles = await resolveUserRoles(pool, req.user);
      const isAdmin = roles.includes('ROL-01');
      const isCommander = roles.includes('ROL-02');
      const deptHead = await isDeptHead(pool, req.user);

      if (!isAdmin && !isCommander && !deptHead) {
        return res.status(403).json({ error: 'Chỉ BGH / Admin / Trưởng bộ môn mới được giám sát giảng đường' });
      }

      const hasSessionType = await hasColumn(pool, 'TEACHING_SCHEDULE', 'session_type');
      const hasCurrentPage = await hasColumn(pool, 'TEACHING_SCHEDULE', 'current_page');
      const hasSlideIndex = await hasColumn(pool, 'TEACHING_SCHEDULE', 'slide_index');
      const hasSlideTotal = await hasColumn(pool, 'TEACHING_SCHEDULE', 'slide_total');
      const hasScormProgress = await hasColumn(pool, 'TEACHING_SCHEDULE', 'scorm_progress');
      const hasNote = await hasColumn(pool, 'TEACHING_SCHEDULE', 'note');

      const r = pool.request();
      let query = `
        SELECT s.schedule_id, s.lecture_id, s.presenter_id, s.class_id,
               s.venue_name, s.student_count, s.start_time, s.status,
               ${hasSessionType ? 's.session_type' : "'TEACHER_LED' AS session_type"},
               ${hasSlideIndex ? 's.slide_index' : 'NULL AS slide_index'},
               ${hasSlideTotal ? 's.slide_total' : 'NULL AS slide_total'},
               ${hasScormProgress ? 's.scorm_progress' : 'NULL AS scorm_progress'},
               ${hasCurrentPage ? 's.current_page' : 'COALESCE(s.slide_index, 1) AS current_page'},
               ${hasNote ? 's.note' : 'NULL AS note'},
               l.title AS lecture_title, l.content_type,
               sub.name AS subject_name,
               u.full_name AS presenter_name, u.[rank] AS presenter_rank, u.[position] AS presenter_position,
               c.class_name, c.student_total AS class_student_total,
               un.name AS unit_name, un.unit_id AS unit_id,
               FLOOR(DATEDIFF(SECOND, s.start_time, GETDATE()) / 60.0) AS duration_minutes,
               CASE WHEN DATEDIFF(MINUTE, s.start_time, GETDATE()) > ${HANGING_THRESHOLD_MINUTES}
                    THEN 1 ELSE 0 END AS is_hanging
        FROM TEACHING_SCHEDULE s
        JOIN DIGITAL_LECTURE l ON l.lecture_id = s.lecture_id
        JOIN SUBJECT sub ON sub.subject_id = l.subject_id
        JOIN [USER] u ON u.user_id = s.presenter_id
        JOIN TRAINING_CLASS c ON c.class_id = s.class_id
        LEFT JOIN UNIT un ON un.unit_id = c.unit_id
        WHERE s.status = 'ONGOING'
      `;

      if (!isAdmin) {
        const scope = await getLectureScope({ userId: req.user.user_id, roles, deptHead });
        query += ` AND un.unit_id IN (${bindUnitIn(r, scope.unitIds)})`;
      }

      if (req.query.venue_name)   { query += ` AND s.venue_name = @venue`;   r.input('venue', sql.NVarChar(100), req.query.venue_name); }
      if (req.query.class_id)     { query += ` AND s.class_id = @cid`;       r.input('cid', sql.VarChar(50), req.query.class_id); }
      if (hasSessionType && req.query.session_type) {
        query += ` AND s.session_type = @stype`;
        r.input('stype', sql.VarChar(20), req.query.session_type);
      }

      query += ` ORDER BY s.start_time DESC`;
      const result = await r.query(query);

      res.json({
        total: result.recordset.length,
        items: result.recordset.map((row) => ({ ...row, is_hanging: row.is_hanging === 1 })),
        hanging_threshold_minutes: HANGING_THRESHOLD_MINUTES,
        server_time: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[GET /api/lectures/schedules/live]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ═════════════════════════════════════════════════════════════
  // PHẦN 3B — QK7 LECTURE HALL RADAR (REAL-TIME CLASSROOM MONITORING)
  // ═════════════════════════════════════════════════════════════

  // Danh mục khu lấy từ bảng CLASSROOM_BUILDING (quản lý trong Quản trị, không còn viết cứng).
  // Chưa có bảng (chưa chạy migration) → trả [] và dùng tên ghi kèm từng phòng.
  async function loadBuildingCatalog(pool) {
    try {
      const r = await pool.request().query(
        `SELECT building_code, building_name, display_order, active
         FROM CLASSROOM_BUILDING ORDER BY display_order, building_code`);
      return r.recordset;
    } catch (_) {
      return [];
    }
  }

  function sanitizeSessionForClearance(session, userClearance) {
    if (!session) return null;
    const isRestricted = session.security_level_id && session.security_level_id > userClearance;
    return {
      ...session,
      lecture_title: isRestricted ? '[Tài liệu có độ mật cao - Đã mã hóa]' : session.lecture_title,
      is_restricted: Boolean(isRestricted),
    };
  }

  // 1. Radar Overview: KPIs + Danh sách các Khu & Tầng
  router.get('/radar/overview', requireAuth, monitorReadGuard, async (req, res) => {
    try {
      const pool = await getPool();
      const roles = await resolveUserRoles(pool, req.user);
      const isAdmin = roles.includes('ROL-01');
      const isCommander = roles.includes('ROL-02');
      const deptHead = await isDeptHead(pool, req.user);

      if (!isAdmin && !isCommander && !deptHead) {
        return res.status(403).json({ error: 'Chỉ BGH / Admin / Trưởng bộ môn mới được giám sát giảng đường' });
      }

      const userClearance = req.user.clearance_level_id || 1;

      // Toàn bộ phòng học đang hoạt động
      const roomsResult = await pool.request().query(`
        SELECT room_id, room_name, room_type, capacity, building_name, building_code,
               floor_number, grid_col, grid_row, is_maintenance, maintenance_reason, display_order
        FROM CLASSROOM WITH (NOLOCK)
        WHERE active = 1
        ORDER BY building_code, floor_number, display_order
      `);
      // Khu đã bị tắt thì ẩn cả các phòng của khu đó khỏi sơ đồ và KPI
      const buildingCatalog = await loadBuildingCatalog(pool);
      const catalogByCode = new Map(buildingCatalog.map((b) => [b.building_code, b]));
      const inactiveCodes = new Set(buildingCatalog.filter((b) => !b.active).map((b) => b.building_code));
      const allRooms = roomsResult.recordset.filter((r) => !inactiveCodes.has(r.building_code || 'H1'));

      // Các ca đang diễn ra (ONGOING)
      const ongoingResult = await pool.request().query(`
        SELECT s.schedule_id, s.lecture_id, s.room_id, s.venue_name, s.presenter_id,
               s.start_time, s.slide_index, s.slide_total, s.scorm_progress, s.student_count,
               s.class_id,
               FLOOR(DATEDIFF(SECOND, s.start_time, GETDATE()) / 60.0) AS duration_minutes,
               CASE WHEN DATEDIFF(MINUTE, s.start_time, GETDATE()) > ${HANGING_THRESHOLD_MINUTES}
                    THEN 1 ELSE 0 END AS is_hanging,
               l.title AS lecture_title, l.security_level_id,
               u.full_name AS presenter_name, u.[rank] AS presenter_rank, u.[position] AS presenter_position,
               c.class_name
        FROM TEACHING_SCHEDULE s WITH (NOLOCK)
        JOIN DIGITAL_LECTURE l WITH (NOLOCK) ON l.lecture_id = s.lecture_id
        JOIN [USER] u WITH (NOLOCK) ON u.user_id = s.presenter_id
        JOIN TRAINING_CLASS c WITH (NOLOCK) ON c.class_id = s.class_id
        WHERE s.status = 'ONGOING'
      `);
      const ongoingSessions = ongoingResult.recordset;

      // Các ca sắp diễn ra trong vòng 2 giờ
      const upcomingResult = await pool.request().query(`
        SELECT s.schedule_id, s.lecture_id, s.room_id, s.venue_name, s.presenter_id,
               s.start_time, s.class_id,
               l.title AS lecture_title, l.security_level_id,
               u.full_name AS presenter_name, u.[rank] AS presenter_rank,
               c.class_name
        FROM TEACHING_SCHEDULE s WITH (NOLOCK)
        JOIN DIGITAL_LECTURE l WITH (NOLOCK) ON l.lecture_id = s.lecture_id
        JOIN [USER] u WITH (NOLOCK) ON u.user_id = s.presenter_id
        JOIN TRAINING_CLASS c WITH (NOLOCK) ON c.class_id = s.class_id
        WHERE s.status = 'SCHEDULED'
          AND s.start_time > GETDATE()
          AND s.start_time <= DATEADD(HOUR, 2, GETDATE())
      `);
      const upcomingSessions = upcomingResult.recordset;

      const sessionByRoomId = new Map();
      const upcomingByRoomId = new Map();

      for (const s of ongoingSessions) {
        const key = s.room_id || allRooms.find(r => r.room_name === s.venue_name)?.room_id;
        if (key && !sessionByRoomId.has(key)) {
          sessionByRoomId.set(key, sanitizeSessionForClearance(s, userClearance));
        }
      }

      for (const s of upcomingSessions) {
        const key = s.room_id || allRooms.find(r => r.room_name === s.venue_name)?.room_id;
        if (key && !upcomingByRoomId.has(key)) {
          upcomingByRoomId.set(key, sanitizeSessionForClearance(s, userClearance));
        }
      }

      const total_rooms = allRooms.length;
      let in_session = 0;
      let maintenance = 0;
      let alert = 0;
      let upcoming = 0;

      for (const r of allRooms) {
        if (r.is_maintenance) {
          maintenance++;
        } else if (sessionByRoomId.has(r.room_id)) {
          in_session++;
          if (sessionByRoomId.get(r.room_id).is_hanging === 1) alert++;
        } else if (upcomingByRoomId.has(r.room_id)) {
          upcoming++;
        }
      }
      const available = Math.max(0, total_rooms - in_session - maintenance);

      const makeBuilding = (code, name) => ({
        building_code: code,
        building_name: name,
        total_rooms: 0,
        in_session_count: 0,
        maintenance_count: 0,
        floors: new Set(),
      });
      const buildingsMap = new Map();
      // Khu trong danh mục (đang bật) luôn hiện, kể cả khi chưa có phòng nào
      for (const c of buildingCatalog) {
        if (c.active) buildingsMap.set(c.building_code, makeBuilding(c.building_code, c.building_name));
      }
      for (const r of allRooms) {
        const bCode = r.building_code || 'H1';
        if (!buildingsMap.has(bCode)) {
          buildingsMap.set(
            bCode,
            makeBuilding(bCode, catalogByCode.get(bCode)?.building_name || r.building_name || `Khu ${bCode}`)
          );
        }
        const b = buildingsMap.get(bCode);
        b.total_rooms++;
        b.floors.add(r.floor_number || 1);
        if (sessionByRoomId.has(r.room_id)) b.in_session_count++;
        if (r.is_maintenance) b.maintenance_count++;
      }

      const buildings = Array.from(buildingsMap.values()).map(b => ({
        ...b,
        floors: Array.from(b.floors).sort((x, y) => x - y),
      }));

      res.json({
        kpis: {
          total_rooms,
          in_session,
          available,
          upcoming,
          maintenance,
          alert,
        },
        buildings,
        server_time: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[GET /api/lectures/radar/overview]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Radar Floor Plan: Sơ đồ phòng học và trạng thái theo Khu và Tầng
  router.get('/radar/floor-plan', requireAuth, monitorReadGuard, async (req, res) => {
    try {
      const pool = await getPool();
      const roles = await resolveUserRoles(pool, req.user);
      const isAdmin = roles.includes('ROL-01');
      const isCommander = roles.includes('ROL-02');
      const deptHead = await isDeptHead(pool, req.user);

      if (!isAdmin && !isCommander && !deptHead) {
        return res.status(403).json({ error: 'Chỉ BGH / Admin / Trưởng bộ môn mới được giám sát giảng đường' });
      }

      const userClearance = req.user.clearance_level_id || 1;
      const buildingCode = String(req.query.building_code || 'H1').trim();
      const floorNumber = parseInt(req.query.floor_number || '1', 10);
      const timeShift = String(req.query.time_shift || 'live').toLowerCase();

      const rReq = pool.request()
        .input('b', sql.VarChar(20), buildingCode)
        .input('f', sql.Int, floorNumber);

      const roomsRes = await rReq.query(`
        SELECT room_id, room_name, room_type, capacity, building_name, building_code,
               floor_number, grid_col, grid_row, is_maintenance, maintenance_reason, display_order
        FROM CLASSROOM WITH (NOLOCK)
        WHERE active = 1 AND building_code = @b AND floor_number = @f
        ORDER BY display_order, grid_row, grid_col
      `);
      const rooms = roomsRes.recordset;

      let sessionQuery = `
        SELECT s.schedule_id, s.lecture_id, s.room_id, s.venue_name, s.presenter_id,
               s.start_time, s.end_time, s.status, s.slide_index, s.slide_total, s.scorm_progress,
               s.student_count, s.class_id,
               FLOOR(DATEDIFF(SECOND, s.start_time, GETDATE()) / 60.0) AS duration_minutes,
               CASE WHEN DATEDIFF(MINUTE, s.start_time, GETDATE()) > ${HANGING_THRESHOLD_MINUTES}
                    THEN 1 ELSE 0 END AS is_hanging,
               l.title AS lecture_title, l.security_level_id,
               u.full_name AS presenter_name, u.[rank] AS presenter_rank, u.[position] AS presenter_position,
               c.class_name
        FROM TEACHING_SCHEDULE s WITH (NOLOCK)
        JOIN DIGITAL_LECTURE l WITH (NOLOCK) ON l.lecture_id = s.lecture_id
        JOIN [USER] u WITH (NOLOCK) ON u.user_id = s.presenter_id
        JOIN TRAINING_CLASS c WITH (NOLOCK) ON c.class_id = s.class_id
        WHERE 1 = 1
      `;

      if (timeShift === 'live') {
        sessionQuery += ` AND s.status = 'ONGOING'`;
      } else {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (timeShift === 'morning') {
          sessionQuery += ` AND s.start_time >= '${todayStr} 07:00:00' AND s.start_time <= '${todayStr} 11:30:00'`;
        } else if (timeShift === 'afternoon') {
          sessionQuery += ` AND s.start_time >= '${todayStr} 13:30:00' AND s.start_time <= '${todayStr} 17:00:00'`;
        } else if (timeShift === 'evening') {
          sessionQuery += ` AND s.start_time >= '${todayStr} 19:00:00' AND s.start_time <= '${todayStr} 21:30:00'`;
        }
      }

      const sessionsRes = await pool.request().query(sessionQuery);
      const allSessions = sessionsRes.recordset;

      const upcomingRes = await pool.request().query(`
        SELECT s.schedule_id, s.lecture_id, s.room_id, s.venue_name, s.presenter_id,
               s.start_time, s.class_id,
               l.title AS lecture_title, l.security_level_id,
               u.full_name AS presenter_name, u.[rank] AS presenter_rank,
               c.class_name
        FROM TEACHING_SCHEDULE s WITH (NOLOCK)
        JOIN DIGITAL_LECTURE l WITH (NOLOCK) ON l.lecture_id = s.lecture_id
        JOIN [USER] u WITH (NOLOCK) ON u.user_id = s.presenter_id
        JOIN TRAINING_CLASS c WITH (NOLOCK) ON c.class_id = s.class_id
        WHERE s.status = 'SCHEDULED'
          AND s.start_time > GETDATE()
          AND s.start_time <= DATEADD(HOUR, 2, GETDATE())
      `);
      const upcomingSessions = upcomingRes.recordset;

      const resultRooms = rooms.map((room) => {
        const session = allSessions.find(
          (s) => s.room_id === room.room_id || (!s.room_id && s.venue_name === room.room_name)
        );
        const upcoming = upcomingSessions.find(
          (s) => s.room_id === room.room_id || (!s.room_id && s.venue_name === room.room_name)
        );

        let computed_status = 'AVAILABLE';
        if (room.is_maintenance) {
          computed_status = 'MAINTENANCE';
        } else if (session) {
          if (session.status === 'ONGOING' && session.is_hanging === 1) {
            computed_status = 'ALERT';
          } else {
            computed_status = 'IN_SESSION';
          }
        } else if (upcoming) {
          computed_status = 'UPCOMING';
        }

        return {
          ...room,
          computed_status,
          current_session: session ? sanitizeSessionForClearance(session, userClearance) : null,
          upcoming_session: upcoming ? sanitizeSessionForClearance(upcoming, userClearance) : null,
        };
      });

      res.json({
        building_code: buildingCode,
        building_name:
          (await loadBuildingCatalog(pool)).find((b) => b.building_code === buildingCode)?.building_name
          || `Khu ${buildingCode}`,
        floor_number: floorNumber,
        time_shift: timeShift,
        rooms: resultRooms,
        server_time: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[GET /api/lectures/radar/floor-plan]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Radar Room Detail: Chi tiết giảng đường cho Inspector
  router.get('/radar/rooms/:roomId/detail', requireAuth, monitorReadGuard, async (req, res) => {
    try {
      const pool = await getPool();
      const roles = await resolveUserRoles(pool, req.user);
      const isAdmin = roles.includes('ROL-01');
      const isCommander = roles.includes('ROL-02');
      const deptHead = await isDeptHead(pool, req.user);

      if (!isAdmin && !isCommander && !deptHead) {
        return res.status(403).json({ error: 'Chỉ BGH / Admin / Trưởng bộ môn mới được xem chi tiết' });
      }

      const userClearance = req.user.clearance_level_id || 1;
      const roomId = req.params.roomId;

      const roomRes = await pool.request()
        .input('rid', sql.VarChar(50), roomId)
        .query(`
          SELECT room_id, room_name, room_type, capacity, building_name, building_code,
                 floor_number, grid_col, grid_row, is_maintenance, maintenance_reason, display_order
          FROM CLASSROOM WITH (NOLOCK)
          WHERE room_id = @rid AND active = 1
        `);

      if (roomRes.recordset.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy phòng học' });
      }
      const room = roomRes.recordset[0];
      room.building_name =
        (await loadBuildingCatalog(pool)).find((b) => b.building_code === room.building_code)?.building_name
        || room.building_name;

      const hasNote = await hasColumn(pool, 'TEACHING_SCHEDULE', 'note');

      const sessionRes = await pool.request()
        .input('rid', sql.VarChar(50), roomId)
        .input('vname', sql.NVarChar(100), room.room_name)
        .query(`
          SELECT s.schedule_id, s.lecture_id, s.room_id, s.venue_name, s.presenter_id,
                 s.start_time, s.end_time, s.status, s.slide_index, s.slide_total, s.scorm_progress,
                 s.student_count, s.class_id, ${hasNote ? 's.note' : 'NULL AS note'},
                 FLOOR(DATEDIFF(SECOND, s.start_time, GETDATE()) / 60.0) AS duration_minutes,
                 CASE WHEN DATEDIFF(MINUTE, s.start_time, GETDATE()) > ${HANGING_THRESHOLD_MINUTES}
                      THEN 1 ELSE 0 END AS is_hanging,
                 l.title AS lecture_title, l.security_level_id, l.content_type,
                 sub.name AS subject_name,
                 u.full_name AS presenter_name, u.[rank] AS presenter_rank, u.[position] AS presenter_position,
                 c.class_name, c.student_total AS class_student_total,
                 un.name AS unit_name
          FROM TEACHING_SCHEDULE s WITH (NOLOCK)
          JOIN DIGITAL_LECTURE l WITH (NOLOCK) ON l.lecture_id = s.lecture_id
          JOIN SUBJECT sub WITH (NOLOCK) ON sub.subject_id = l.subject_id
          JOIN [USER] u WITH (NOLOCK) ON u.user_id = s.presenter_id
          JOIN TRAINING_CLASS c WITH (NOLOCK) ON c.class_id = s.class_id
          LEFT JOIN UNIT un WITH (NOLOCK) ON un.unit_id = c.unit_id
          WHERE (s.room_id = @rid OR s.venue_name = @vname) AND s.status = 'ONGOING'
        `);

      const current_session = sessionRes.recordset[0]
        ? sanitizeSessionForClearance(sessionRes.recordset[0], userClearance)
        : null;

      const todayRes = await pool.request()
        .input('rid', sql.VarChar(50), roomId)
        .input('vname', sql.NVarChar(100), room.room_name)
        .query(`
          SELECT s.schedule_id, s.lecture_id, s.start_time, s.end_time, s.status,
                 l.title AS lecture_title, l.security_level_id,
                 u.full_name AS presenter_name, c.class_name
          FROM TEACHING_SCHEDULE s WITH (NOLOCK)
          JOIN DIGITAL_LECTURE l WITH (NOLOCK) ON l.lecture_id = s.lecture_id
          JOIN [USER] u WITH (NOLOCK) ON u.user_id = s.presenter_id
          JOIN TRAINING_CLASS c WITH (NOLOCK) ON c.class_id = s.class_id
          WHERE (s.room_id = @rid OR s.venue_name = @vname)
            AND CAST(s.start_time AS DATE) = CAST(GETDATE() AS DATE)
          ORDER BY s.start_time ASC
        `);

      const today_schedules = todayRes.recordset.map((s) =>
        sanitizeSessionForClearance(s, userClearance)
      );

      res.json({
        room,
        current_session,
        today_schedules,
      });
    } catch (err) {
      console.error('[GET /api/lectures/radar/rooms/:roomId/detail]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Bật / Tắt trạng thái Bảo trì cho phòng học (Admin / Chỉ huy / Trưởng BM)
  router.post('/radar/rooms/:roomId/maintenance', requireAuth, async (req, res) => {
    try {
      const pool = await getPool();
      const roles = await resolveUserRoles(pool, req.user);
      const isAdmin = roles.includes('ROL-01');
      const isCommander = roles.includes('ROL-02');
      const deptHead = await isDeptHead(pool, req.user);

      if (!isAdmin && !isCommander && !deptHead) {
        return res.status(403).json({ error: 'Chỉ Quản trị viên hoặc Chỉ huy mới có quyền cập nhật trạng thái bảo trì' });
      }

      const roomId = req.params.roomId;
      const isMaintenance = Boolean(req.body.is_maintenance);
      const maintenanceReason = req.body.maintenance_reason ? String(req.body.maintenance_reason).trim() : null;

      await pool.request()
        .input('rid', sql.VarChar(50), roomId)
        .input('im', sql.Bit, isMaintenance ? 1 : 0)
        .input('mr', sql.NVarChar(255), isMaintenance ? (maintenanceReason || 'Bảo trì kỹ thuật định kỳ') : null)
        .query(`
          UPDATE CLASSROOM
          SET is_maintenance = @im, maintenance_reason = @mr
          WHERE room_id = @rid
        `);

      await logAudit(
        req,
        'CLASSROOM_MAINTENANCE_TOGGLE',
        `${isMaintenance ? 'BẬT' : 'TẮT'} bảo trì phòng ${roomId}: ${maintenanceReason || 'N/A'}`
      );

      res.json({
        success: true,
        room_id: roomId,
        is_maintenance: isMaintenance,
        maintenance_reason: isMaintenance ? maintenanceReason : null,
      });
    } catch (err) {
      console.error('[POST /api/lectures/radar/rooms/:roomId/maintenance]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // History — query chính TEACHING_SCHEDULE
  router.get('/schedules/history', requireAuth, requirePermission('LECTURE_VIEW'), async (req, res) => {
    try {
      const pool = await getPool();
      const roles = await resolveUserRoles(pool, req.user);
      const isAdmin = roles.includes('ROL-01');
      const isCommander = roles.includes('ROL-02');
      const deptHead = await isDeptHead(pool, req.user);
      const hasSessionType = await hasColumn(pool, 'TEACHING_SCHEDULE', 'session_type');

      const r = pool.request();
      let query = `
        SELECT s.schedule_id, s.lecture_id, s.presenter_id, s.class_id,
               s.venue_name, s.student_count, s.start_time, s.end_time, s.status,
               ${hasSessionType ? 's.session_type' : "'TEACHER_LED' AS session_type"},
               l.title AS lecture_title, sub.name AS subject_name,
               u.full_name AS presenter_name, u.[rank] AS presenter_rank,
               c.class_name, c.student_total AS class_student_total,
               un.name AS unit_name,
               FLOOR(DATEDIFF(SECOND, s.start_time, s.end_time) / 60.0) AS duration_minutes
        FROM TEACHING_SCHEDULE s
        JOIN DIGITAL_LECTURE l ON l.lecture_id = s.lecture_id
        JOIN SUBJECT sub ON sub.subject_id = l.subject_id
        JOIN [USER] u ON u.user_id = s.presenter_id
        JOIN TRAINING_CLASS c ON c.class_id = s.class_id
        LEFT JOIN UNIT un ON un.unit_id = c.unit_id
        WHERE s.status IN ('COMPLETED','CANCELLED') AND s.end_time IS NOT NULL
      `;

      if (!isAdmin) {
        if (deptHead || isCommander) {
          const scope = await getLectureScope({ userId: req.user.user_id, roles, deptHead });
          query += ` AND un.unit_id IN (${bindUnitIn(r, scope.unitIds)})`;
        } else {
          query += ` AND s.presenter_id = @selfId`;
          r.input('selfId', sql.VarChar(50), req.user.user_id);
        }
      }

      if (req.query.presenter_id) { query += ` AND s.presenter_id = @pid`;   r.input('pid', sql.VarChar(50), req.query.presenter_id); }
      if (req.query.lecture_id)   { query += ` AND s.lecture_id = @lid`;     r.input('lid', sql.VarChar(50), req.query.lecture_id); }
      if (req.query.venue_name)   { query += ` AND s.venue_name = @v`;       r.input('v', sql.NVarChar(100), req.query.venue_name); }
      if (req.query.from)         { query += ` AND s.start_time >= @from`;   r.input('from', sql.Date, req.query.from); }
      if (req.query.to)           { query += ` AND s.end_time <= @to`;       r.input('to', sql.Date, req.query.to); }

      query += ` ORDER BY s.start_time DESC`;
      const result = await r.query(query);

      const kpi = result.recordset.reduce(
        (a, x) => {
          a.total_sessions += 1;
          a.total_minutes += x.duration_minutes || 0;
          a.total_students += x.student_count || 0;
          if (x.session_type === 'SELF_STUDY') a.self_study_sessions += 1;
          else a.teacher_led_sessions += 1;
          return a;
        },
        { total_sessions: 0, total_minutes: 0, total_students: 0, self_study_sessions: 0, teacher_led_sessions: 0 }
      );

      res.json({
        total: result.recordset.length,
        items: result.recordset,
        kpi: { ...kpi, total_hours: +(kpi.total_minutes / 60).toFixed(2) },
      });
    } catch (err) {
      console.error('[GET /api/lectures/schedules/history]', err);
      res.status(500).json({ error: err.message });
    }
  });

      // API nhẹ: Lấy thông tin 1 ca dạy cụ thể (Dùng để phục hồi khi F5)
  router.get('/schedules/:id', requireAuth, requirePermission('LECTURE_VIEW'), async (req, res, next) => {
    // Phòng vệ bổ sung tránh route động :id nuốt các route tĩnh như /schedules/monitor
    if (req.params.id === 'monitor' || req.params.id === 'live' || req.params.id === 'history') {
      return next();
    }
    try {
      const pool = await getPool();
      const r = await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .query(`
          SELECT s.*, l.title AS lecture_title, l.content_type, c.class_name 
          FROM TEACHING_SCHEDULE s 
          JOIN DIGITAL_LECTURE l ON l.lecture_id = s.lecture_id 
          LEFT JOIN TRAINING_CLASS c ON c.class_id = s.class_id 
          WHERE s.schedule_id = @id
        `);
      
      if (r.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy ca dạy' });
      
      const session = r.recordset[0];
      // Chỉ người tạo ca, BGH hoặc Admin mới được xem
      if (session.presenter_id !== req.user.user_id && !(req.user.roles || []).includes('ROL-01') && !(req.user.roles || []).includes('ROL-02')) {
        return res.status(403).json({ error: 'Không có quyền xem ca dạy này' });
      }
      
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═════════════════════════════════════════════════════════════
  // PHẦN 4 — SCORM TRACKING (Proxy cho SCORM RTE)
  // ═════════════════════════════════════════════════════════════
  // FE gọi sau mỗi LMSCommit() để lưu tiến độ SCORM
  router.post('/schedules/:id/scorm/commit', requireAuth, requirePermission('SCHEDULE_START'), async (req, res) => {
    try {
      const scheduleId = req.params.id;
      const { lesson_status, score_raw, suspend_data } = req.body || {};

      const pool = await getPool();
      const check = await pool.request()
        .input('id', sql.VarChar(50), scheduleId)
        .query(`SELECT s.presenter_id, s.status, s.lecture_id, l.content_type
                FROM TEACHING_SCHEDULE s
                JOIN DIGITAL_LECTURE l ON l.lecture_id = s.lecture_id
                WHERE s.schedule_id = @id`);
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy ca' });
      const s = check.recordset[0];
      if (s.content_type !== 'SCORM') {
        return res.status(400).json({ error: 'Ca này không phải bài giảng SCORM' });
      }
      if (s.status !== 'ONGOING') {
        return res.status(400).json({ error: 'Ca không ở trạng thái ONGOING' });
      }
      if (s.presenter_id !== req.user.user_id && !(req.user.roles || []).includes('ROL-01')) {
        return res.status(403).json({ error: 'Chỉ người mở ca mới cập nhật SCORM' });
      }

      const validStatuses = ['not attempted', 'passed', 'completed', 'failed', 'incomplete'];
      const lstatus = validStatuses.includes(String(lesson_status || '').toLowerCase())
        ? String(lesson_status).toLowerCase()
        : 'incomplete';
      const score = score_raw !== undefined && score_raw !== null ? Number(score_raw) : null;
      const sdata = suspend_data ? String(suspend_data).slice(0, 1000000) : null;

      // Upsert theo (session_id, lecture_id)
      await pool.request()
        .input('sid', sql.VarChar(50), scheduleId)
        .input('lid', sql.VarChar(50), s.lecture_id)
        .input('st', sql.VarChar(30), lstatus)
        .input('sc', sql.Float, Number.isFinite(score) ? score : null)
        .input('sd', sql.NVarChar(sql.MAX), sdata)
        .query(`
          MERGE SCORM_TRACKING AS t
          USING (SELECT @sid AS session_id, @lid AS lecture_id) AS src
          ON t.session_id = src.session_id AND t.lecture_id = src.lecture_id
          WHEN MATCHED THEN UPDATE SET
            lesson_status = @st, score_raw = @sc, suspend_data = @sd, last_accessed = GETDATE()
          WHEN NOT MATCHED THEN INSERT (session_id, lecture_id, lesson_status, score_raw, suspend_data)
            VALUES (@sid, @lid, @st, @sc, @sd);
        `);

      res.json({ success: true });
    } catch (err) {
      console.error('[POST scorm commit]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Lấy SCORM data (để FE resume suspend_data)
  router.get('/schedules/:id/scorm/tracking', requireAuth, requirePermission('LECTURE_VIEW'), async (req, res) => {
    try {
      const pool = await getPool();
      const r = await pool.request()
        .input('sid', sql.VarChar(50), req.params.id)
        .query(`SELECT * FROM SCORM_TRACKING WHERE session_id = @sid`);
      res.json({ items: r.recordset });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

    // ═════════════════════════════════════════════════════════════
  // WATCHDOG: Tự động ngắt các ca giảng dạy treo quá HARD_LIMIT
  // ═════════════════════════════════════════════════════════════
  const HARD_LIMIT_MINUTES = 300; // 5 giờ — vượt xa HANGING_THRESHOLD_MINUTES (4 giờ)

  const autoCloseHangingSchedules = async () => {
    try {
      const pool = await getPool();
      const hasNote = await hasColumn(pool, 'TEACHING_SCHEDULE', 'note');

      // Tìm ca ONGOING đã vượt ngưỡng cứng
      const r = await pool.request()
        .input('limit', sql.Int, HARD_LIMIT_MINUTES)
        .query(`
          SELECT schedule_id, presenter_id, lecture_id,
                 DATEDIFF(MINUTE, start_time, GETDATE()) AS elapsed
          FROM TEACHING_SCHEDULE
          WHERE status = 'ONGOING'
            AND DATEDIFF(MINUTE, start_time, GETDATE()) >= @limit
        `);

      if (r.recordset.length === 0) return;

      for (const row of r.recordset) {
        try {
          if (hasNote) {
            await pool.request()
              .input('id', sql.VarChar(50), row.schedule_id)
              .query(`
                UPDATE TEACHING_SCHEDULE
                SET status = 'COMPLETED',
                    end_time = GETDATE(),
                    note = ISNULL(note, '') + ' [Hệ thống tự động đóng do treo quá ${HARD_LIMIT_MINUTES} phút]'
                WHERE schedule_id = @id AND status = 'ONGOING'
              `);
          } else {
            await pool.request()
              .input('id', sql.VarChar(50), row.schedule_id)
              .query(`
                UPDATE TEACHING_SCHEDULE
                SET status = 'COMPLETED', end_time = GETDATE()
                WHERE schedule_id = @id AND status = 'ONGOING'
              `);
          }

          console.log(`[Watchdog] ⏱ Tự động đóng ca treo: ${row.schedule_id} (${row.elapsed} phút)`);

          // Audit log — dùng writeAccessLog có sẵn trong closure
          if (typeof writeAccessLog === 'function') {
            writeAccessLog({
              userId: 'SYSTEM',
              fileId: row.lecture_id,
              action: 'SCHEDULE_AUTO_CLOSE',
              ip: '127.0.0.1',
              note: `[Watchdog] Tự động đóng ca ${row.schedule_id} treo ${row.elapsed} phút`,
            }).catch(() => {});
          }
        } catch (rowErr) {
          console.error(`[Watchdog] Lỗi đóng ca ${row.schedule_id}:`, rowErr.message);
        }
      }
    } catch (err) {
      console.error('[Watchdog] Lỗi quét ca treo:', err.message);
    }
  };

  // Chạy kiểm tra định kỳ mỗi 5 phút
  const watchdogTimer = setInterval(autoCloseHangingSchedules, 5 * 60 * 1000);
  if (typeof watchdogTimer.unref === 'function') watchdogTimer.unref();

  // Chạy 1 lần sau 30 giây khởi động (không đợi 5 phút)
  const watchdogBootTimer = setTimeout(autoCloseHangingSchedules, 30 * 1000);
  if (typeof watchdogBootTimer.unref === 'function') watchdogBootTimer.unref();

  return router;

};