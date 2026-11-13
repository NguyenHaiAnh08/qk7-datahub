// backend/src/lecture-routes.js
// ============================================================
// Phân hệ Bài giảng số v1.2 — KHỚP SCHEMA THỰC TẾ
// - Bảng: DIGITAL_LECTURE, TEACHING_SCHEDULE, SCORM_TRACKING
// - Permission: LECTURE_VIEW / CREATE / APPROVE / DELETE / SCHEDULE_START
// - Role: ROL-01 Admin, ROL-02 BGH, ROL-07 Giảng viên
// - Trưởng bộ môn: nhận diện qua ROL-06 hoặc position
// - Live Monitor: LECTURE_VIEW + role (Admin/Commander/DeptHead)
// - Teaching History: query TEACHING_SCHEDULE status COMPLETED/CANCELLED
// - SCORM: commit vào SCORM_TRACKING
// ============================================================
const express = require('express');
const { sql, getPool } = require('./db');

const HANGING_THRESHOLD_MINUTES = 4 * 60; // 4 giờ

module.exports = function createLectureRoutes({
  requireAuth,
  requirePermission,
  writeAccessLog,
  getClientIp,
}) {
  const router = express.Router();

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
      const r = await pool.request()
        .input('u', sql.VarChar(50), user.user_id)
        .query(`SELECT role_id FROM USER_ROLE
                WHERE user_id = @u AND (expires_at IS NULL OR expires_at > GETDATE())`);
      return r.recordset.map((x) => x.role_id);
    } catch { return user?.roles || []; }
  }

  async function isDeptHead(pool, user) {
    const roles = await resolveUserRoles(pool, user);
    if (roles.includes('ROL-06')) return true;
    const pos = String(user.position || '').toLowerCase();
    return pos.includes('trưởng bộ môn') || pos.includes('trưởng khoa')
        || pos.includes('chủ nhiệm khoa') || pos.includes('trưởng phòng');
  }

  // Hàm phụ kiểm tra quyền Chỉ huy (Chỉ Admin, BGH, Trưởng BM mới được Lưu trữ/Khôi phục)
  async function requireCommander(pool, req, res) {
    const roles = await resolveUserRoles(pool, req.user);
    if (roles.includes('ROL-01') || roles.includes('ROL-02') || roles.includes('ROL-06')) {
      return true;
    }
    res.status(403).json({ error: 'Chỉ Chỉ huy cấp trên mới có quyền lưu trữ/khôi phục bài giảng.' });
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

  router.get('/catalogs/subjects', requireAuth, async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT s.*, u.name AS faculty_name
        FROM SUBJECT s
        LEFT JOIN UNIT u ON u.unit_id = s.faculty_unit_id
        WHERE s.active = 1
        ORDER BY s.name
      `);
      res.json({ items: result.recordset });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/catalogs/classes', requireAuth, async (req, res) => {
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
  router.get('/catalogs/venues', requireAuth, async (req, res) => {
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

  router.get('/', requireAuth, requirePermission('LECTURE_VIEW'), async (req, res) => {
    try {
      const pool = await getPool();
      const r = pool.request();
      const userId = req.user.user_id;
      const roles = await resolveUserRoles(pool, req.user);
      const isAdmin = roles.includes('ROL-01');
      const isCommander = roles.includes('ROL-02');
      const deptHead = await isDeptHead(pool, req.user);
      const userUnit = await getUserUnitId(pool, userId);
      const clearance = req.user.clearance_level_id || 1;

      let query = `
        SELECT l.lecture_id, l.lecture_code, l.title, l.subject_id, l.author_id,
               l.faculty_unit_id, l.security_level_id, l.content_type, l.scorm_entry_point,
               l.document_id, l.status, l.reject_reason, l.created_at, l.updated_at,
               s.name AS subject_name,
               u.full_name AS author_name, u.[rank] AS author_rank,
               un.name AS faculty_name,
               sl.name AS security_name
        FROM DIGITAL_LECTURE l
        JOIN SUBJECT s ON s.subject_id = l.subject_id
        JOIN [USER] u ON u.user_id = l.author_id
        JOIN UNIT un ON un.unit_id = l.faculty_unit_id
        JOIN SECURITY_LEVEL sl ON sl.level_id = l.security_level_id
        WHERE l.security_level_id <= @clearance
      `;
      r.input('clearance', sql.Int, clearance);

      if (!isAdmin && !isCommander) {
        if (deptHead && userUnit) {
          query += ` AND (l.faculty_unit_id = @userUnit OR l.author_id = @selfId)`;
          r.input('userUnit', sql.VarChar(50), userUnit);
          r.input('selfId', sql.VarChar(50), userId);
        } else {
          query += ` AND (l.status = 'PUBLISHED' OR l.author_id = @selfId`;
          r.input('selfId', sql.VarChar(50), userId);
          if (userUnit) {
            query += ` OR l.faculty_unit_id = @userUnit`;
            r.input('userUnit', sql.VarChar(50), userUnit);
          }
          query += `)`;
        }
      }

      if (req.query.status)           { query += ` AND l.status = @status`;         r.input('status', sql.VarChar(30), req.query.status); }
      if (req.query.subject_id)       { query += ` AND l.subject_id = @subId`;      r.input('subId', sql.VarChar(50), req.query.subject_id); }
      if (req.query.faculty_unit_id)  { query += ` AND l.faculty_unit_id = @fac`;   r.input('fac', sql.VarChar(50), req.query.faculty_unit_id); }
      if (req.query.q)                { query += ` AND (l.title LIKE N'%' + @q + N'%' OR l.lecture_code LIKE '%' + @q + '%')`; r.input('q', sql.NVarChar(200), req.query.q); }

      query += ` ORDER BY l.created_at DESC`;
      const result = await r.query(query);
      res.json({ total: result.recordset.length, items: result.recordset });
    } catch (err) {
      console.error('[GET /api/lectures]', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', requireAuth, requirePermission('LECTURE_VIEW'), async (req, res) => {
    try {
      const pool = await getPool();
      const r = await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .query(`
          SELECT l.*, s.name AS subject_name,
                 u.full_name AS author_name, u.[rank] AS author_rank, u.[position] AS author_position,
                 un.name AS faculty_name, sl.name AS security_name
          FROM DIGITAL_LECTURE l
          JOIN SUBJECT s ON s.subject_id = l.subject_id
          JOIN [USER] u ON u.user_id = l.author_id
          JOIN UNIT un ON un.unit_id = l.faculty_unit_id
          JOIN SECURITY_LEVEL sl ON sl.level_id = l.security_level_id
          WHERE l.lecture_id = @id
        `);
      if (r.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      const lec = r.recordset[0];
      if (lec.security_level_id > (req.user.clearance_level_id || 1)) {
        return res.status(403).json({ error: 'Không đủ cấp bảo mật để xem bài giảng này' });
      }
      res.json(lec);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/', requireAuth, requirePermission('LECTURE_CREATE'), async (req, res) => {
    try {
      const {
        title, subject_id, lecture_code, security_level_id,
        content_type, scorm_entry_point, document_id,
      } = req.body || {};
      if (!title || !subject_id) return res.status(400).json({ error: 'Thiếu tiêu đề hoặc môn học' });

      const validTypes = ['PDF', 'HTML5', 'SCORM'];
      const ctype = String(content_type || 'PDF').toUpperCase();
      if (!validTypes.includes(ctype)) return res.status(400).json({ error: 'Loại nội dung không hợp lệ' });
      if (ctype === 'SCORM' && !scorm_entry_point) {
        return res.status(400).json({ error: 'SCORM yêu cầu scorm_entry_point' });
      }

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
        .input('faculty_unit_id', sql.VarChar(50), facultyUnitId)
        .input('security_level_id', sql.Int, security_level_id || 2)
        .input('content_type', sql.VarChar(20), ctype)
        .input('scorm_entry_point', sql.NVarChar(255), scorm_entry_point || null)
        .input('document_id', sql.VarChar(50), document_id || null)
        .query(`
          INSERT INTO DIGITAL_LECTURE (
            lecture_id, lecture_code, title, subject_id, author_id, faculty_unit_id,
            security_level_id, content_type, scorm_entry_point, document_id
          ) VALUES (
            @id, @code, @title, @subject_id, @author_id, @faculty_unit_id,
            @security_level_id, @content_type, @scorm_entry_point, @document_id
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
        .query(`SELECT status, author_id FROM DIGITAL_LECTURE WHERE lecture_id = @id`);
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      const lec = check.recordset[0];
      if (lec.author_id !== req.user.user_id && !(req.user.roles || []).includes('ROL-01')) {
        return res.status(403).json({ error: 'Chỉ tác giả mới có quyền sửa bài giảng này' });
      }
      if (!['DRAFT', 'REJECTED'].includes(lec.status)) {
        return res.status(400).json({ error: 'Không thể sửa bài giảng đang chờ duyệt hoặc đã xuất bản' });
      }

      const { title, subject_id, security_level_id, content_type, scorm_entry_point, document_id } = req.body || {};
      const ctype = String(content_type || 'PDF').toUpperCase();
      if (!['PDF', 'HTML5', 'SCORM'].includes(ctype)) {
        return res.status(400).json({ error: 'Loại nội dung không hợp lệ' });
      }

      await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .input('title', sql.NVarChar(500), title)
        .input('subject_id', sql.VarChar(50), subject_id)
        .input('security_level_id', sql.Int, security_level_id)
        .input('content_type', sql.VarChar(20), ctype)
        .input('scorm_entry_point', sql.NVarChar(255), scorm_entry_point || null)
        .input('document_id', sql.VarChar(50), document_id || null)
        .query(`
          UPDATE DIGITAL_LECTURE
          SET title = @title, subject_id = @subject_id, security_level_id = @security_level_id,
              content_type = @content_type, scorm_entry_point = @scorm_entry_point,
              document_id = @document_id, updated_at = GETDATE()
          WHERE lecture_id = @id
        `);
      await logAudit(req, 'LECTURE_UPDATE', `Sửa bài giảng ${lectureId}`, lectureId);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // 1. API Lưu trữ (Archive) — CHẶN Ở BACKEND: chỉ Chỉ huy cấp trên
  router.delete('/:id', requireAuth, requirePermission('LECTURE_DELETE'), async (req, res) => {
    try {
      const pool = await getPool();
      // Kiểm tra quyền Chỉ huy
      if (!(await requireCommander(pool, req, res))) return;

      const r = await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .query(`UPDATE DIGITAL_LECTURE SET status = 'ARCHIVED', updated_at = GETDATE() WHERE lecture_id = @id`);
      if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      await logAudit(req, 'LECTURE_ARCHIVE', `Lưu trữ bài giảng ${req.params.id}`, req.params.id);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Gửi duyệt
  router.post('/:id/submit', requireAuth, requirePermission('LECTURE_CREATE'), async (req, res) => {
    try {
      const pool = await getPool();
      const check = await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .query(`SELECT status, author_id FROM DIGITAL_LECTURE WHERE lecture_id = @id`);
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy' });
      if (check.recordset[0].author_id !== req.user.user_id) {
        return res.status(403).json({ error: 'Chỉ tác giả mới có quyền gửi duyệt' });
      }
      if (!['DRAFT', 'REJECTED'].includes(check.recordset[0].status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ để gửi duyệt' });
      }
      await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .query(`UPDATE DIGITAL_LECTURE SET status='PENDING_FACULTY', reject_reason=NULL, updated_at=GETDATE() WHERE lecture_id=@id`);
      await logAudit(req, 'LECTURE_SUBMIT', `Gửi duyệt bài giảng ${req.params.id}`, req.params.id);
      res.json({ success: true, message: 'Đã gửi duyệt lên Khoa/Bộ môn' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // 2. API Khôi phục (Restore) — CHẶN Ở BACKEND: chỉ Chỉ huy cấp trên
  //    (Đưa RA NGOÀI handler submit — bản gốc bị lồng trong submit nên không được đăng ký)
  router.post('/:id/restore', requireAuth, requirePermission('LECTURE_DELETE'), async (req, res) => {
    try {
      const pool = await getPool();
      // Kiểm tra quyền Chỉ huy
      if (!(await requireCommander(pool, req, res))) return;

      const lectureId = req.params.id;
      const check = await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .query(`SELECT status FROM DIGITAL_LECTURE WHERE lecture_id = @id`);
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });

      if (check.recordset[0].status !== 'ARCHIVED') {
        return res.status(400).json({ error: 'Bài giảng không ở trạng thái lưu trữ' });
      }

      await pool.request()
        .input('id', sql.VarChar(50), lectureId)
        .query(`UPDATE DIGITAL_LECTURE SET status='DRAFT', updated_at=GETDATE() WHERE lecture_id=@id`);

      await logAudit(req, 'LECTURE_RESTORE', `Khôi phục bài giảng ${lectureId}`, lectureId);
      res.json({ success: true });
    } catch (err) {
      console.error('[POST restore]', err);
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
        .query(`SELECT status, faculty_unit_id, content_type,
                       pending_scorm_path, scorm_entry_point
                FROM DIGITAL_LECTURE WHERE lecture_id = @id`);                 // [1]
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });

      const lec = check.recordset[0];
      const roles = await resolveUserRoles(pool, req.user);
      const isAdmin = roles.includes('ROL-01');
      const isCommander = roles.includes('ROL-02');
      const deptHead = await isDeptHead(pool, req.user);

      let nextStatus = '';
      if (lec.status === 'PENDING_FACULTY') {
        if (!isAdmin && !isCommander && !deptHead) {
          return res.status(403).json({ error: 'Chỉ Trưởng bộ môn hoặc BGH mới duyệt cấp Khoa' });
        }
        if (!isAdmin && !isCommander && deptHead) {
          const userUnit = await getUserUnitId(pool, req.user.user_id);
          if (userUnit && lec.faculty_unit_id !== userUnit) {
            return res.status(403).json({ error: 'Chỉ được duyệt bài giảng thuộc khoa/bộ môn của mình' });
          }
        }
        nextStatus = 'PENDING_TRAINING';
      } else if (lec.status === 'PENDING_TRAINING') {
        if (!isAdmin && !isCommander) {
          return res.status(403).json({ error: 'Chỉ BGH/Admin mới duyệt cấp Trường' });
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
          if (!lec.document_id) {
            return res.status(400).json({
              error: 'Bài giảng PDF chưa có tệp tài liệu đính kèm (thiếu document_id)',
              code: 'NO_DOCUMENT',
            });
          }
        } else if (!lec.scorm_entry_point) {
          // Fallback tự động nhận diện nếu đã giải nén trong uploads/lectures/:lectureId
          const lectureDir = path.resolve(__dirname, '..', 'uploads', 'lectures', lectureId);
          if (fs.existsSync(lectureDir)) {
            const files = fs.readdirSync(lectureDir);
            const commonEntries = ['index.html', 'story.html', 'launch.html', 'demo.html'];
            const entry = commonEntries.find(f => files.includes(f)) || files.find(f => f.toLowerCase().endsWith('.html'));
            if (entry) {
              extractedEntryPoint = `uploads/lectures/${lectureId}/${entry}`;
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

      let updateSql = `UPDATE DIGITAL_LECTURE SET status=@st, reject_reason=NULL, updated_at=GETDATE()`;
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
        .query(`SELECT status FROM DIGITAL_LECTURE WHERE lecture_id = @id`);
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy' });
      if (!['PENDING_FACULTY', 'PENDING_TRAINING'].includes(check.recordset[0].status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ để từ chối' });
      }
      await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .input('reason', sql.NVarChar(500), reason.slice(0, 500))
        .query(`UPDATE DIGITAL_LECTURE SET status='REJECTED', reject_reason=@reason, updated_at=GETDATE() WHERE lecture_id=@id`);
      await logAudit(req, 'LECTURE_REJECTED', `Từ chối ${req.params.id}: ${reason}`, req.params.id);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ═════════════════════════════════════════════════════════════
  // PHẦN 3 — TEACHING SCHEDULE (Ca giảng dạy)
  // ═════════════════════════════════════════════════════════════

  // Bắt đầu ca
  router.post('/schedules/start', requireAuth, requirePermission('SCHEDULE_START'), async (req, res) => {
    try {
      const { lecture_id, class_id, venue_name, student_count, session_type, note } = req.body || {};
      const stype = String(session_type || 'TEACHER_LED').toUpperCase();

      if (!lecture_id || !class_id || !venue_name) {
        return res.status(400).json({ error: 'Thiếu bài giảng, lớp hoặc giảng đường' });
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
        .query(`SELECT status, title FROM DIGITAL_LECTURE WHERE lecture_id = @lid`);
      if (lecCheck.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      const lecture = lecCheck.recordset[0];
      if (lecture.status !== 'PUBLISHED') {
        return res.status(400).json({ error: 'Chỉ có thể mở ca với bài giảng đã PUBLISHED' });
      }

      // Kiểm tra giảng đường trống
      const busy = await pool.request()
        .input('v', sql.NVarChar(100), venue_name)
        .query(`SELECT TOP 1 schedule_id FROM TEACHING_SCHEDULE
                WHERE venue_name = @v AND status = 'ONGOING'`);
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
        `Bắt đầu ca ${stype}: "${lecture.title}" | sĩ số=${sc} | venue=${venue_name}`,
        lecture_id
      );

      res.json({
        success: true,
        schedule_id: scheduleId,
        session_type: hasSessionType ? stype : 'TEACHER_LED',
        start_time: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[POST /api/lectures/schedules/start]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Cập nhật tiến độ
  router.put('/schedules/:id/progress', requireAuth, requirePermission('SCHEDULE_START'), async (req, res) => {
    try {
      const page = parseInt(req.body?.current_page, 10);
      if (!Number.isFinite(page) || page < 1) {
        return res.status(400).json({ error: 'current_page không hợp lệ' });
      }
      const pool = await getPool();
      const hasCurrentPage = await hasColumn(pool, 'TEACHING_SCHEDULE', 'current_page');
      if (!hasCurrentPage) {
        return res.status(501).json({
          error: 'Chưa chạy migration v2: cột TEACHING_SCHEDULE.current_page chưa tồn tại',
        });
      }

      const check = await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .query(`SELECT presenter_id, status FROM TEACHING_SCHEDULE WHERE schedule_id = @id`);
      if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy ca' });
      const s = check.recordset[0];
      if (s.status !== 'ONGOING') return res.status(400).json({ error: 'Ca không ở trạng thái ONGOING' });
      if (s.presenter_id !== req.user.user_id && !(req.user.roles || []).includes('ROL-01')) {
        return res.status(403).json({ error: 'Chỉ người mở ca mới cập nhật được tiến độ' });
      }

      await pool.request()
        .input('id', sql.VarChar(50), req.params.id)
        .input('pg', sql.Int, page)
        .query(`UPDATE TEACHING_SCHEDULE SET current_page = @pg WHERE schedule_id = @id`);
      res.json({ success: true, current_page: page });
    } catch (err) { res.status(500).json({ error: err.message }); }
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

  // API Buộc kết thúc (Dành cho Chỉ huy/Admin xử lý ca treo của người khác)
  router.post('/schedules/:id/force-end', requireAuth, async (req, res) => {
    try {
      const pool = await getPool();
      const roles = await resolveUserRoles(pool, req.user);
      if (!roles.includes('ROL-01') && !roles.includes('ROL-02') && !roles.includes('ROL-06')) {
        return res.status(403).json({ error: 'Chỉ Chỉ huy/Admin mới có quyền buộc kết thúc ca của người khác.' });
      }

      const result = await endScheduleInternal({
        scheduleId: req.params.id,
        actorUser: req.user, // Đã được check quyền ở trên
        isForce: true,
      });

      await logAudit(req, 'SCHEDULE_FORCE_END',
        `Chỉ huy/Admin buộc kết thúc ca ${result.schedule_id} (${result.duration_minutes} phút)`);
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
  router.get('/schedules/live', requireAuth, requirePermission('LECTURE_VIEW'), async (req, res) => {
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
      const hasNote = await hasColumn(pool, 'TEACHING_SCHEDULE', 'note');

      const r = pool.request();
      let query = `
        SELECT s.schedule_id, s.lecture_id, s.presenter_id, s.class_id,
               s.venue_name, s.student_count, s.start_time, s.status,
               ${hasSessionType ? 's.session_type' : "'TEACHER_LED' AS session_type"},
               ${hasCurrentPage ? 's.current_page' : '1 AS current_page'},
               ${hasNote ? 's.note' : 'NULL AS note'},
               l.title AS lecture_title, l.content_type,
               sub.name AS subject_name,
               u.full_name AS presenter_name, u.[rank] AS presenter_rank, u.[position] AS presenter_position,
               c.class_name, un.name AS unit_name, un.unit_id AS unit_id,
               DATEDIFF(MINUTE, s.start_time, GETDATE()) AS duration_minutes,
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

      if (!isAdmin && !isCommander && deptHead) {
        const userUnit = await getUserUnitId(pool, req.user.user_id);
        if (userUnit) {
          query += ` AND un.unit_id = @userUnit`;
          r.input('userUnit', sql.VarChar(50), userUnit);
        } else {
          query += ` AND 1=0`;
        }
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
               c.class_name, un.name AS unit_name,
               DATEDIFF(MINUTE, s.start_time, s.end_time) AS duration_minutes
        FROM TEACHING_SCHEDULE s
        JOIN DIGITAL_LECTURE l ON l.lecture_id = s.lecture_id
        JOIN SUBJECT sub ON sub.subject_id = l.subject_id
        JOIN [USER] u ON u.user_id = s.presenter_id
        JOIN TRAINING_CLASS c ON c.class_id = s.class_id
        LEFT JOIN UNIT un ON un.unit_id = c.unit_id
        WHERE s.status IN ('COMPLETED','CANCELLED') AND s.end_time IS NOT NULL
      `;

      if (!isAdmin && !isCommander) {
        if (deptHead) {
          const userUnit = await getUserUnitId(pool, req.user.user_id);
          if (userUnit) {
            query += ` AND un.unit_id = @userUnit`;
            r.input('userUnit', sql.VarChar(50), userUnit);
          } else {
            query += ` AND 1=0`;
          }
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

  return router;
};