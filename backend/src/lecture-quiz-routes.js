// backend/src/lecture-quiz-routes.js
// Quiz PP — Câu hỏi trắc nghiệm gắn với bài giảng số
const express = require('express');
const { sql, getPool } = require('./db');

module.exports = function createLectureQuizRoutes({ requireAuth, requirePermission, writeAccessLog, getClientIp }) {
  const router = express.Router();
  const getIp = (req) => (typeof getClientIp === 'function' ? getClientIp(req) : (req.ip || '127.0.0.1'));
  const logAudit = (req, action, note, fileId = null) =>
    (typeof writeAccessLog === 'function'
      ? writeAccessLog({ userId: req.user?.user_id || 'GUEST', fileId, action, ip: getIp(req), note: String(note || '').slice(0, 500) }).catch(() => {})
      : Promise.resolve());

  // Helper: kiểm tra quyền sở hữu / cùng khoa
  async function canEditLecture(pool, user, lectureId) {
    const isAdmin = (user.roles || []).includes('ROL-01');
    const r = await pool.request()
      .input('id', sql.VarChar(50), lectureId)
      .query(`SELECT author_id, faculty_unit_id, status FROM DIGITAL_LECTURE WHERE lecture_id = @id`);
    if (r.recordset.length === 0) return { ok: false, code: 'NOT_FOUND' };
    const lec = r.recordset[0];
    if (isAdmin) return { ok: true, lecture: lec };
    if (lec.author_id === user.user_id) return { ok: true, lecture: lec };
    // Cho phép Trưởng bộ môn (ROL-06) cùng khoa
    const rolesRes = await pool.request()
      .input('uid', sql.VarChar(50), user.user_id)
      .query(`SELECT role_id FROM USER_ROLE WHERE user_id = @uid AND (expires_at IS NULL OR expires_at > GETDATE())`);
    const roles = rolesRes.recordset.map((x) => x.role_id);
    if (roles.includes('ROL-06')) {
      const userUnit = await pool.request()
        .input('uid', sql.VarChar(50), user.user_id)
        .query(`SELECT unit_id FROM [USER] WHERE user_id = @uid`);
      if (userUnit.recordset[0]?.unit_id === lec.faculty_unit_id) return { ok: true, lecture: lec };
    }
    return { ok: false, code: 'FORBIDDEN' };
  }

  // ─── GET: Danh sách câu hỏi ───
  router.get('/:lectureId/quiz', requireAuth, requirePermission('LECTURE_VIEW'), async (req, res) => {
    try {
      const pool = await getPool();
      const lecRes = await pool.request()
        .input('id', sql.VarChar(50), req.params.lectureId)
        .query(`SELECT security_level_id FROM DIGITAL_LECTURE WHERE lecture_id = @id`);
      if (lecRes.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      if (lecRes.recordset[0].security_level_id > (req.user.clearance_level_id || 1)) {
        return res.status(403).json({ error: 'Không đủ cấp bảo mật' });
      }

      const r = await pool.request()
        .input('lid', sql.VarChar(50), req.params.lectureId)
        .query(`
          SELECT quiz_id, lecture_id, question_text, option_a, option_b, option_c, option_d,
                 correct_answer, explanation, slide_ref, sort_order, created_at
          FROM LECTURE_QUIZ WHERE lecture_id = @lid
          ORDER BY sort_order, created_at
        `);

      // Giảng viên đang trình chiếu → có thể ẩn correct_answer nếu cần (mặc định trả về, client tự xử lý)
      res.json({ total: r.recordset.length, items: r.recordset });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST: Tạo 1 câu hỏi ───
  router.post('/:lectureId/quiz', requireAuth, requirePermission('LECTURE_CREATE'), async (req, res) => {
    try {
      const pool = await getPool();
      const check = await canEditLecture(pool, req.user, req.params.lectureId);
      if (!check.ok) return res.status(check.code === 'NOT_FOUND' ? 404 : 403).json({ error: 'Không có quyền' });

      const { question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, slide_ref, sort_order } = req.body || {};
      if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
        return res.status(400).json({ error: 'Thiếu trường bắt buộc' });
      }
      if (!['A','B','C','D'].includes(String(correct_answer).toUpperCase())) {
        return res.status(400).json({ error: 'correct_answer phải là A/B/C/D' });
      }

      const quizId = 'QZ-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      await pool.request()
        .input('id',        sql.VarChar(50),    quizId)
        .input('lid',       sql.VarChar(50),    req.params.lectureId)
        .input('qt',        sql.NVarChar(sql.MAX), question_text)
        .input('oa',        sql.NVarChar(500),  option_a)
        .input('ob',        sql.NVarChar(500),  option_b)
        .input('oc',        sql.NVarChar(500),  option_c)
        .input('od',        sql.NVarChar(500),  option_d)
        .input('ca',        sql.Char(1),        String(correct_answer).toUpperCase())
        .input('ex',        sql.NVarChar(1000), explanation || null)
        .input('sr',        sql.NVarChar(100),  slide_ref || null)
        .input('so',        sql.Int,            Number(sort_order) || 0)
        .query(`
          INSERT INTO LECTURE_QUIZ (quiz_id, lecture_id, question_text, option_a, option_b, option_c, option_d,
                                    correct_answer, explanation, slide_ref, sort_order)
          VALUES (@id, @lid, @qt, @oa, @ob, @oc, @od, @ca, @ex, @sr, @so)
        `);

      await logAudit(req, 'LECTURE_QUIZ_CREATE', `Tạo câu hỏi Quiz cho bài giảng ${req.params.lectureId}`, req.params.lectureId);
      res.json({ success: true, quiz_id: quizId });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── PUT: Sửa câu hỏi ───
  router.put('/:lectureId/quiz/:quizId', requireAuth, requirePermission('LECTURE_CREATE'), async (req, res) => {
    try {
      const pool = await getPool();
      const check = await canEditLecture(pool, req.user, req.params.lectureId);
      if (!check.ok) return res.status(check.code === 'NOT_FOUND' ? 404 : 403).json({ error: 'Không có quyền' });

      const { question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, slide_ref, sort_order } = req.body || {};
      const r = await pool.request()
        .input('qid', sql.VarChar(50), req.params.quizId)
        .input('lid', sql.VarChar(50), req.params.lectureId)
        .input('qt',  sql.NVarChar(sql.MAX), question_text)
        .input('oa',  sql.NVarChar(500), option_a)
        .input('ob',  sql.NVarChar(500), option_b)
        .input('oc',  sql.NVarChar(500), option_c)
        .input('od',  sql.NVarChar(500), option_d)
        .input('ca',  sql.Char(1), String(correct_answer || 'A').toUpperCase())
        .input('ex',  sql.NVarChar(1000), explanation || null)
        .input('sr',  sql.NVarChar(100),  slide_ref || null)
        .input('so',  sql.Int,            Number(sort_order) || 0)
        .query(`
          UPDATE LECTURE_QUIZ
          SET question_text=@qt, option_a=@oa, option_b=@ob, option_c=@oc, option_d=@od,
              correct_answer=@ca, explanation=@ex, slide_ref=@sr, sort_order=@so
          WHERE quiz_id=@qid AND lecture_id=@lid
        `);
      if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy câu hỏi' });

      await logAudit(req, 'LECTURE_QUIZ_UPDATE', `Sửa câu hỏi Quiz ${req.params.quizId}`, req.params.lectureId);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── DELETE: Xóa câu hỏi ───
  router.delete('/:lectureId/quiz/:quizId', requireAuth, requirePermission('LECTURE_CREATE'), async (req, res) => {
    try {
      const pool = await getPool();
      const check = await canEditLecture(pool, req.user, req.params.lectureId);
      if (!check.ok) return res.status(check.code === 'NOT_FOUND' ? 404 : 403).json({ error: 'Không có quyền' });

      const r = await pool.request()
        .input('qid', sql.VarChar(50), req.params.quizId)
        .input('lid', sql.VarChar(50), req.params.lectureId)
        .query(`DELETE FROM LECTURE_QUIZ WHERE quiz_id=@qid AND lecture_id=@lid`);
      if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy câu hỏi' });

      await logAudit(req, 'LECTURE_QUIZ_DELETE', `Xóa câu hỏi Quiz ${req.params.quizId}`, req.params.lectureId);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── POST /:lectureId/quiz/reorder: Sắp xếp lại thứ tự ───
  router.post('/:lectureId/quiz/reorder', requireAuth, requirePermission('LECTURE_CREATE'), async (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!items) return res.status(400).json({ error: 'items phải là mảng' });

      const pool = await getPool();
      const check = await canEditLecture(pool, req.user, req.params.lectureId);
      if (!check.ok) return res.status(check.code === 'NOT_FOUND' ? 404 : 403).json({ error: 'Không có quyền' });

      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        for (const it of items) {
          if (it.quiz_id && typeof it.sort_order === 'number') {
            await new sql.Request(transaction)
              .input('qid', sql.VarChar(50), it.quiz_id)
              .input('lid', sql.VarChar(50), req.params.lectureId)
              .input('so',  sql.Int,         it.sort_order)
              .query(`UPDATE LECTURE_QUIZ SET sort_order=@so WHERE quiz_id=@qid AND lecture_id=@lid`);
          }
        }
        await transaction.commit();
        await logAudit(req, 'LECTURE_QUIZ_REORDER', `Sắp xếp lại ${items.length} câu hỏi`, req.params.lectureId);
        res.json({ success: true, updated: items.length });
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};