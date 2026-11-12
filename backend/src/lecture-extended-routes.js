// backend/src/lecture-extended-routes.js
const express = require('express');
const { sql, getPool } = require('./db');

module.exports = function createLectureExtendedRoutes({
  requireAuth, requirePermission,
}) {
  const router = express.Router();

  // ══════════════════════════════════════════════════════════
  // NHÓM 1: QUIZ CRUD (GV tự click khi trình chiếu)
  // Dùng LECTURE_QUIZ_QUESTION + LECTURE_QUIZ_ATTEMPT
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
  // ⚠️ REQUIREMENT — TEACHING_SCHEDULE phải có cột:
  //    slide_index INT NULL, slide_total INT NULL, scorm_progress FLOAT NULL
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
            l.lecture_code, l.title AS lecture_title, l.content_type,
            l.security_level_id, sl.name AS security_name,
            sub.name AS subject_name,
            u.full_name AS presenter_name, u.[rank] AS presenter_rank, u.[position] AS presenter_position,
            un.name AS faculty_unit_name,
            c.class_name, c.course_year,
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

  router.put('/schedules/:scheduleId/slide', requireAuth, requirePermission('SCHEDULE_START'),
    async (req, res) => {
      try {
        const { slide_index, slide_total, scorm_progress } = req.body;
        const pool = await getPool();
        await pool.request()
          .input('sid', sql.VarChar(50), req.params.scheduleId)
          .input('uid', sql.VarChar(50), req.user.user_id)
          .input('si',  sql.Int, slide_index)
          .input('st',  sql.Int, slide_total ?? null)
          .input('sp',  sql.Float, scorm_progress ?? null)
          .query(`UPDATE TEACHING_SCHEDULE
                  SET slide_index=@si, slide_total=@st, scorm_progress=@sp
                  WHERE schedule_id=@sid AND presenter_id=@uid AND status='ONGOING'`);
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: e.message }); }
    });

  return router;
};