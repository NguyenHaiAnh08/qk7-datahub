// backend/src/lecture-extended-routes.js
const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');           // npm i adm-zip
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sql, getPool } = require('./db');

module.exports = function createLectureExtendedRoutes({
  requireAuth, requirePermission, writeAccessLog, getClientIp,
}) {
  const router = express.Router();
  const SCORM_ROOT = path.join(__dirname, '..', 'uploads', 'scorm');
  fs.mkdirSync(SCORM_ROOT, { recursive: true });

  const getIp = (req) => {
    const raw = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    let ip = String(raw).split(',')[0].trim();
    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    if (ip === '::1') ip = '127.0.0.1';
    return ip;
  };

  const log = (req, action, note) => writeAccessLog({
    userId: req.user?.user_id || 'GUEST',
    fileId: null, action, ip: getIp(req), note: String(note).slice(0, 500),
  }).catch(() => {});

  // ══════════════════════════════════════════════════════════
  // NHÓM 1: QUIZ CRUD (GV tự click khi trình chiếu)
  // ══════════════════════════════════════════════════════════

  router.get('/:lectureId/quiz', requireAuth, requirePermission('LECTURE_VIEW'),
    async (req, res) => {
      try {
        const pool = await getPool();
        const r = await pool.request()
          .input('lid', sql.VarChar(50), req.params.lectureId)
          .query(`SELECT * FROM LECTURE_QUIZ_QUESTION
                  WHERE lecture_id = @lid AND active = 1
                  ORDER BY question_order, question_id`);
        res.json({ total: r.recordset.length, items: r.recordset });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

  router.post('/:lectureId/quiz', requireAuth, requirePermission('LECTURE_QUIZ_MANAGE'),
    async (req, res) => {
      try {
        const {
          question_text, option_a, option_b, option_c, option_d,
          correct_answer, explanation, slide_index, points, question_order,
        } = req.body;
        if (!question_text || !option_a || !option_b || !correct_answer) {
          return res.status(400).json({ error: 'Thiếu trường bắt buộc (question_text, option_a, option_b, correct_answer)' });
        }
        const pool = await getPool();
        // Verify ownership
        const own = await pool.request()
          .input('lid', sql.VarChar(50), req.params.lectureId)
          .input('uid', sql.VarChar(50), req.user.user_id)
          .query(`SELECT 1 FROM DIGITAL_LECTURE WHERE lecture_id=@lid AND author_id=@uid`);
        if (own.recordset.length === 0) {
          return res.status(403).json({ error: 'Chỉ tác giả bài giảng mới được tạo Quiz' });
        }

        const qid = 'QZ-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
        await pool.request()
          .input('id', sql.VarChar(50), qid)
          .input('lid', sql.VarChar(50), req.params.lectureId)
          .input('ord', sql.Int, question_order || 1)
          .input('qt', sql.NVarChar(sql.MAX), question_text)
          .input('a', sql.NVarChar(500), option_a)
          .input('b', sql.NVarChar(500), option_b)
          .input('c', sql.NVarChar(500), option_c || null)
          .input('d', sql.NVarChar(500), option_d || null)
          .input('ans', sql.Char(1), correct_answer)
          .input('exp', sql.NVarChar(sql.MAX), explanation || null)
          .input('slide', sql.Int, slide_index || null)
          .input('pts', sql.Int, points || 1)
          .query(`INSERT INTO LECTURE_QUIZ_QUESTION
                  (question_id, lecture_id, question_order, question_text,
                   option_a, option_b, option_c, option_d,
                   correct_answer, explanation, slide_index, points)
                  VALUES (@id, @lid, @ord, @qt, @a, @b, @c, @d, @ans, @exp, @slide, @pts);
                  UPDATE DIGITAL_LECTURE SET quiz_count = quiz_count + 1 WHERE lecture_id = @lid;`);
        await log(req, 'LECTURE_QUIZ_CREATE', `Tạo câu hỏi ${qid} cho bài giảng ${req.params.lectureId}`);
        res.json({ success: true, question_id: qid });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

  router.put('/:lectureId/quiz/:questionId', requireAuth, requirePermission('LECTURE_QUIZ_MANAGE'),
    async (req, res) => {
      try {
        const pool = await getPool();
        const own = await pool.request()
          .input('lid', sql.VarChar(50), req.params.lectureId)
          .input('uid', sql.VarChar(50), req.user.user_id)
          .query(`SELECT 1 FROM DIGITAL_LECTURE WHERE lecture_id=@lid AND author_id=@uid`);
        if (own.recordset.length === 0) return res.status(403).json({ error: 'Không có quyền' });

        const { question_text, option_a, option_b, option_c, option_d,
                correct_answer, explanation, slide_index, points, question_order } = req.body;
        await pool.request()
          .input('id', sql.VarChar(50), req.params.questionId)
          .input('lid', sql.VarChar(50), req.params.lectureId)
          .input('ord', sql.Int, question_order || 1)
          .input('qt', sql.NVarChar(sql.MAX), question_text)
          .input('a', sql.NVarChar(500), option_a)
          .input('b', sql.NVarChar(500), option_b)
          .input('c', sql.NVarChar(500), option_c || null)
          .input('d', sql.NVarChar(500), option_d || null)
          .input('ans', sql.Char(1), correct_answer)
          .input('exp', sql.NVarChar(sql.MAX), explanation || null)
          .input('slide', sql.Int, slide_index || null)
          .input('pts', sql.Int, points || 1)
          .query(`UPDATE LECTURE_QUIZ_QUESTION
                  SET question_order=@ord, question_text=@qt, option_a=@a, option_b=@b,
                      option_c=@c, option_d=@d, correct_answer=@ans, explanation=@exp,
                      slide_index=@slide, points=@pts, updated_at=GETDATE()
                  WHERE question_id=@id AND lecture_id=@lid`);
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

  router.delete('/:lectureId/quiz/:questionId', requireAuth, requirePermission('LECTURE_QUIZ_MANAGE'),
    async (req, res) => {
      try {
        const pool = await getPool();
        const own = await pool.request()
          .input('lid', sql.VarChar(50), req.params.lectureId)
          .input('uid', sql.VarChar(50), req.user.user_id)
          .query(`SELECT 1 FROM DIGITAL_LECTURE WHERE lecture_id=@lid AND author_id=@uid`);
        if (own.recordset.length === 0) return res.status(403).json({ error: 'Không có quyền' });

        await pool.request()
          .input('id', sql.VarChar(50), req.params.questionId)
          .input('lid', sql.VarChar(50), req.params.lectureId)
          .query(`UPDATE LECTURE_QUIZ_QUESTION SET active=0 WHERE question_id=@id AND lecture_id=@lid;
                  UPDATE DIGITAL_LECTURE SET quiz_count = CASE WHEN quiz_count>0 THEN quiz_count-1 ELSE 0 END
                  WHERE lecture_id=@lid;`);
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

  // GV bấm "Kích hoạt Quiz" khi đang dạy — lưu attempt
  router.post('/schedules/:scheduleId/quiz/:questionId/activate', requireAuth,
    requirePermission('SCHEDULE_START'), async (req, res) => {
      try {
        const { student_count_yes = 0, student_count_no = 0 } = req.body;
        const pool = await getPool();
        const r = await pool.request()
          .input('sid', sql.VarChar(50), req.params.scheduleId)
          .input('qid', sql.VarChar(50), req.params.questionId)
          .input('yes', sql.Int, student_count_yes)
          .input('no', sql.Int, student_count_no)
          .query(`INSERT INTO LECTURE_QUIZ_ATTEMPT (question_id, schedule_id, student_count_yes, student_count_no)
                  VALUES (@qid, @sid, @yes, @no);
                  SELECT SCOPE_IDENTITY() AS id;`);
        res.json({ success: true, attempt_id: r.recordset[0].id });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

  // ══════════════════════════════════════════════════════════
  // NHÓM 2: XEM BÀI GIẢNG CÙNG KHOA (GV đồng nghiệp)
  // ══════════════════════════════════════════════════════════

  router.get('/faculty/:facultyUnitId', requireAuth, requirePermission('LECTURE_VIEW'),
    async (req, res) => {
      try {
        const pool = await getPool();
        // Verify: user phải thuộc cùng khoa HOẶC có SCHEDULE_MONITOR_ALL
        const userUnit = await pool.request()
          .input('uid', sql.VarChar(50), req.user.user_id)
          .query(`SELECT unit_id FROM [USER] WHERE user_id = @uid`);
        const myUnit = userUnit.recordset[0]?.unit_id;
        const canViewAll = (req.user.permissions || []).includes('SCHEDULE_MONITOR_ALL');
        if (!canViewAll && myUnit !== req.params.facultyUnitId) {
          return res.status(403).json({ error: 'Chỉ xem được bài giảng của khoa mình' });
        }

        const r = await pool.request()
          .input('fac', sql.VarChar(50), req.params.facultyUnitId)
          .input('clr', sql.Int, req.user.clearance_level_id || 1)
          .query(`
            SELECT l.lecture_id, l.lecture_code, l.title, l.status,
                   l.security_level_id, l.content_type, l.quiz_count,
                   l.created_at, l.updated_at,
                   s.name AS subject_name,
                   u.full_name AS author_name, u.[rank] AS author_rank,
                   un.name AS faculty_name
            FROM DIGITAL_LECTURE l
            JOIN SUBJECT s ON s.subject_id = l.subject_id
            JOIN [USER] u ON u.user_id = l.author_id
            JOIN UNIT un ON un.unit_id = l.faculty_unit_id
            WHERE l.faculty_unit_id = @fac
              AND l.status = 'PUBLISHED'
              AND l.security_level_id <= @clr
            ORDER BY l.updated_at DESC
          `);
        res.json({ total: r.recordset.length, items: r.recordset });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

  // ══════════════════════════════════════════════════════════
  // NHÓM 3: LIVE MONITOR NÂNG CAO (BGH / Trưởng BM)
  // Trả thêm: đang ở slide nào, tiến độ SCORM %, sĩ số, môn học
  // ══════════════════════════════════════════════════════════

  router.get('/schedules/monitor', requireAuth, requirePermission('SCHEDULE_MONITOR_ALL'),
    async (req, res) => {
      try {
        const pool = await getPool();
        const r = await pool.request().query(`
          SELECT
            s.schedule_id, s.lecture_id, s.presenter_id, s.class_id,
            s.venue_name, s.student_count, s.start_time, s.status,
            s.session_type, s.slide_index, s.slide_total, s.scorm_progress,
            DATEDIFF(MINUTE, s.start_time, GETDATE()) AS duration_minutes,
            CASE WHEN DATEDIFF(MINUTE, s.start_time, GETDATE()) > 240 THEN 1 ELSE 0 END AS is_hanging,

            -- Thông tin bài giảng
            l.lecture_code, l.title AS lecture_title, l.content_type,
            l.security_level_id, sl.name AS security_name,
            sub.name AS subject_name,

            -- Thông tin giảng viên
            u.full_name AS presenter_name, u.[rank] AS presenter_rank, u.[position] AS presenter_position,
            un.name AS faculty_unit_name,

            -- Thông tin lớp
            c.class_name, c.course_year,

            -- Quiz đã kích hoạt
            (SELECT COUNT(*) FROM LECTURE_QUIZ_ATTEMPT a
             WHERE a.schedule_id = s.schedule_id) AS quiz_activated_count,
            (SELECT COUNT(*) FROM LECTURE_QUIZ_QUESTION q
             WHERE q.lecture_id = s.lecture_id AND q.active = 1) AS quiz_total_count
          FROM TEACHING_SCHEDULE s
          JOIN DIGITAL_LECTURE l ON l.lecture_id = s.lecture_id
          JOIN SUBJECT sub ON sub.subject_id = l.subject_id
          JOIN SECURITY_LEVEL sl ON sl.level_id = l.security_level_id
          JOIN [USER] u ON u.user_id = s.presenter_id
          LEFT JOIN UNIT un ON un.unit_id = u.unit_id
          JOIN TRAINING_CLASS c ON c.class_id = s.class_id
          WHERE s.status = 'ONGOING'
          ORDER BY s.start_time DESC
        `);
        res.json({
          total: r.recordset.length,
          server_time: new Date().toISOString(),
          items: r.recordset.map(row => ({ ...row, is_hanging: row.is_hanging === 1 })),
        });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

  // Cập nhật slide_index khi GV trình chiếu (để BGH thấy "đang dạy đến đâu")
  router.put('/schedules/:scheduleId/slide', requireAuth, requirePermission('SCHEDULE_START'),
    async (req, res) => {
      try {
        const { slide_index, slide_total, scorm_progress } = req.body;
        const pool = await getPool();
        await pool.request()
          .input('sid', sql.VarChar(50), req.params.scheduleId)
          .input('si', sql.Int, slide_index)
          .input('st', sql.Int, slide_total || null)
          .input('sp', sql.Float, scorm_progress ?? null)
          .query(`UPDATE TEACHING_SCHEDULE
                  SET slide_index=@si, slide_total=@st, scorm_progress=@sp
                  WHERE schedule_id=@sid AND presenter_id=@uid AND status='ONGOING'`
                  .replace('@uid', `'${req.user.user_id}'`));
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

  // ══════════════════════════════════════════════════════════
  // NHÓM 4: SCORM PACKAGE UPLOAD + EXTRACT + RTE
  // ══════════════════════════════════════════════════════════

  /**
   * Giải nén an toàn: Chống Zip Slip (CWE-22) & Zip Bomb (CWE-409)
   * @param {Buffer} zipBuffer - Dữ liệu buffer file zip
   * @param {string} targetDir - Thư mục đích giải nén
   * @param {number} maxTotalBytes - Kích thước tối đa sau giải nén (mặc định 300MB)
   */
  function extractZipSafely(zipBuffer, targetDir, maxTotalBytes = 300 * 1024 * 1024) {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    const resolvedTarget = path.resolve(targetDir);
    let totalUncompressedSize = 0;

    // Duyệt qua tất cả entries để thẩm định trước khi ghi bất kỳ byte nào ra đĩa
    for (const entry of entries) {
      const entryName = entry.entryName;

      // 1. Chống Zip Slip: Chặn đường dẫn trỏ ra ngoài targetDir
      const destPath = path.resolve(resolvedTarget, entryName);
      if (!destPath.startsWith(resolvedTarget + path.sep) && destPath !== resolvedTarget) {
        throw new Error(`Phát hiện đường dẫn Zip Slip bất hợp pháp: "${entryName}"`);
      }

      // 2. Chống Zip Bomb: Tích lũy dung lượng uncompressed
      totalUncompressedSize += entry.header.size;
      if (totalUncompressedSize > maxTotalBytes) {
        throw new Error(`Gói SCORM vượt quá giới hạn giải nén tối đa cho phép (${Math.round(maxTotalBytes / (1024 * 1024))}MB)`);
      }

      // 3. Ngăn chặn file thực thi nguy hiểm
      const ext = path.extname(entryName).toLowerCase();
      if (['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.py', '.php', '.jar', '.com'].includes(ext)) {
        throw new Error(`Gói SCORM chứa định dạng file thực thi bị cấm: ${ext}`);
      }
    }

    // Đạt toàn bộ kiểm tra an toàn -> giải nén
    zip.extractAllTo(resolvedTarget, true);
  }

  const scormUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 },  // 200MB
    fileFilter: (req, file, cb) => {
      if (!file.originalname.toLowerCase().endsWith('.zip')) {
        return cb(new Error('Chỉ chấp nhận file .zip chứa gói SCORM'));
      }
      cb(null, true);
    },
  });

  router.post('/:lectureId/scorm/upload',
    requireAuth, requirePermission('LECTURE_CREATE'),
    scormUpload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'Thiếu file .zip' });
        const pool = await getPool();
        const lectureId = req.params.lectureId;

        // Verify ownership
        const own = await pool.request()
          .input('lid', sql.VarChar(50), lectureId)
          .input('uid', sql.VarChar(50), req.user.user_id)
          .query(`SELECT 1 FROM DIGITAL_LECTURE WHERE lecture_id=@lid AND author_id=@uid`);
        if (own.recordset.length === 0) return res.status(403).json({ error: 'Không có quyền' });

        // Giải nén ZIP an toàn (chống Zip Slip & Zip Bomb)
        const packageId = 'PKG-' + Date.now();
        const extractDir = path.join(SCORM_ROOT, packageId);
        fs.mkdirSync(extractDir, { recursive: true });
        extractZipSafely(req.file.buffer, extractDir);

        // Parse imsmanifest.xml
        const manifestPath = path.join(extractDir, 'imsmanifest.xml');
        if (!fs.existsSync(manifestPath)) {
          return res.status(400).json({ error: 'Gói không có imsmanifest.xml — không phải SCORM chuẩn' });
        }
        const manifestXml = fs.readFileSync(manifestPath, 'utf-8');

        // Tìm entry point: ưu tiên <resource href="..."> đầu tiên
        let entryPoint = 'index.html';
        const hrefMatch = manifestXml.match(/<resource[^>]+href=["']([^"']+)["']/i);
        if (hrefMatch) {
          entryPoint = hrefMatch[1].trim();
        } else if (fs.existsSync(path.join(extractDir, 'index.html'))) {
          entryPoint = 'index.html';
        } else {
          // Fallback: tìm file .html đầu tiên
          const findHtml = (dir) => {
            for (const f of fs.readdirSync(dir)) {
              const full = path.join(dir, f);
              if (fs.statSync(full).isDirectory()) {
                const r = findHtml(full);
                if (r) return r;
              } else if (f.endsWith('.html')) return f;
            }
            return null;
          };
          const found = findHtml(extractDir);
          if (!found) return res.status(400).json({ error: 'Không tìm thấy file HTML khởi đầu' });
          entryPoint = found;
        }

        const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
        const relPath = `uploads/scorm/${packageId}`;

        // Upsert vào SCORM_PACKAGE
        await pool.request()
          .input('pid', sql.VarChar(50), packageId)
          .input('lid', sql.VarChar(50), lectureId)
          .input('orig', sql.NVarChar(255), req.file.originalname)
          .input('sp', sql.NVarChar(500), relPath)
          .input('ep', sql.NVarChar(500), entryPoint)
          .input('mx', sql.NVarChar(sql.MAX), manifestXml)
          .input('sz', sql.BigInt, req.file.size)
          .input('sha', sql.Char(64), sha256)
          .input('uid', sql.VarChar(50), req.user.user_id)
          .query(`
            MERGE SCORM_PACKAGE AS t
            USING (SELECT @lid AS lecture_id) AS s ON t.lecture_id = s.lecture_id
            WHEN MATCHED THEN UPDATE SET
              package_id=@pid, original_name=@orig, stored_path=@sp, entry_point=@ep,
              manifest_xml=@mx, file_size=@sz, sha256=@sha,
              uploaded_by=@uid, uploaded_at=GETDATE()
            WHEN NOT MATCHED THEN INSERT
              (package_id, lecture_id, original_name, stored_path, entry_point,
               manifest_xml, file_size, sha256, uploaded_by)
              VALUES (@pid, @lid, @orig, @sp, @ep, @mx, @sz, @sha, @uid);
            UPDATE DIGITAL_LECTURE SET content_type='SCORM', scorm_entry_point=@ep
            WHERE lecture_id=@lid;
          `);

        await log(req, 'SCORM_UPLOAD', `Upload SCORM cho ${lectureId} (${req.file.size} bytes)`);
        res.json({ success: true, package_id: packageId, entry_point: entryPoint });
      } catch (e) {
        console.error('[SCORM upload]', e);
        res.status(500).json({ error: e.message });
      }
    });

  // Serve file tĩnh của SCORM package (cho RTE iframe load) - Gia cố chống Path Traversal (CWE-22)
  router.get('/scorm/:packageId/*splat', requireAuth, async (req, res) => {
    try {
      const packageId = req.params.packageId;
      // 1. Validate packageId: chỉ chấp nhận alphanumeric, gạch dưới, gạch ngang
      if (!packageId || !/^[A-Za-z0-9_-]+$/.test(packageId)) {
        return res.status(400).json({ error: 'Mã gói SCORM không hợp lệ' });
      }

      const subPath = (req.params[0] || 'index.html').replace(/\\/g, '/');
      // Chặn ký tự path traversal trực tiếp
      if (subPath.includes('..') || subPath.startsWith('/')) {
        return res.status(403).json({ error: 'Đường dẫn tệp bị từ chối' });
      }

      const resolvedBase = path.resolve(SCORM_ROOT, packageId);
      const resolvedTarget = path.resolve(resolvedBase, subPath);

      // 2. Chống Path Traversal: Đảm bảo resolvedTarget nằm trọn trong resolvedBase
      if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
        return res.status(403).json({ error: 'Truy cập ngoài phạm vi cho phép' });
      }

      if (!fs.existsSync(resolvedTarget) || fs.statSync(resolvedTarget).isDirectory()) {
        return res.status(404).json({ error: 'Không tìm thấy tệp' });
      }

      // 3. Header an toàn
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(resolvedTarget);
    } catch (e) {
      res.status(500).json({ error: 'Lỗi máy chủ khi tải tệp SCORM' });
    }
  });

  // Lấy entry point để FE biết iframe URL
  router.get('/:lectureId/scorm/info', requireAuth, requirePermission('LECTURE_VIEW'),
    async (req, res) => {
      try {
        const pool = await getPool();
        const r = await pool.request()
          .input('lid', sql.VarChar(50), req.params.lectureId)
          .query(`SELECT package_id, entry_point, schema_version, file_size
                  FROM SCORM_PACKAGE WHERE lecture_id = @lid`);
        if (r.recordset.length === 0) {
          return res.status(404).json({ error: 'Bài giảng chưa có gói SCORM' });
        }
        res.json(r.recordset[0]);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

  return router;
};