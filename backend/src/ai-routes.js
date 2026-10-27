// ============================================================
// ai-routes.js — AI Gateway Proxy + Smart SQL Fallback
// Permission checks + Clearance Enforcement + Audit Trail
// ============================================================

const express = require('express');

module.exports = function createAIRoutes({ requirePermission, writeAccessLog, getClientIp }) {
  const router = express.Router();

  const AI_BASE = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';
  const AI_TIMEOUT_MS = 3000;

  async function callAI(path, method = 'GET', body = null) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch(`${AI_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`AI service ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const logAudit = async (req, action, note, fileId = null) => {
    if (typeof writeAccessLog === 'function') {
      try {
        const ip = typeof getClientIp === 'function' ? getClientIp(req) : (req.ip || '127.0.0.1');
        await writeAccessLog({
          userId: req.user?.user_id || 'GUEST',
          fileId,
          action,
          ip,
          note: String(note).slice(0, 255),
        });
      } catch (logErr) {
        console.warn('[AI Audit Log Error]', logErr.message);
      }
    }
  };

  // ─── 1. HEALTH (public inside authenticated mount) ───
  router.get('/health', async (req, res) => {
    try {
      const r = await callAI('/ai/health');
      res.json({
        ...r,
        gateway_mode: 'active_microservice',
      });
    } catch {
      res.json({
        status: 'offline',
        service: 'AI_BOXCHAT',
        gateway_mode: 'smart_sql_fallback',
        message: 'AI Service (:8001) đang offline, Gateway kích hoạt Smart SQL Fallback bảo mật.',
      });
    }
  });

  // ─── 2. CHAT (with Smart SQL Fallback & Audit Trail) ───
  router.post('/chat', requirePermission('AI_QUERY'), async (req, res) => {
    try {
      const { query, file_id } = req.body;
      if (!query || !query.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi' });

      const user_clearance = req.user.clearance_level_id || 1;

      // Ghi nhật ký kiểm toán hành động hỏi AI
      await logAudit(req, 'AI_QUERY', `Hỏi AI: ${query.slice(0, 80)} (Cấp ${user_clearance})`, file_id || null);

      // 1. Thử gọi sang microservice AI boxchat (:8001)
      try {
        const aiRes = await callAI('/ai/chat', 'POST', {
          query: query.trim(),
          user_id: req.user.user_id,
          user_clearance,
          file_id: file_id || null,
        });
        return res.json(aiRes);
      } catch (err) {
        console.warn('[AI chat] Microservice :8001 offline, chuyển sang Smart SQL Fallback:', err.message);
      }

      // 2. SMART SQL FALLBACK — Truy vấn SQL Server trực tiếp với Pre-filtering cấp mật
      const { sql, getPool } = require('./db');
      const pool = await getPool();

      let sqlQuery = `
        SELECT TOP 5 file_id, document_code, title, summary, security_level_id
        FROM DOCUMENT
        WHERE deleted_at IS NULL
          AND security_level_id <= @clr
      `;

      if (file_id) {
        sqlQuery += ` AND file_id = @fid`;
      } else {
        sqlQuery += ` AND (title LIKE @q OR summary LIKE @q OR document_code LIKE @q)`;
      }

      sqlQuery += ` ORDER BY issued_date DESC`;

      const request = pool.request()
        .input('clr', sql.Int, user_clearance);

      if (file_id) {
        request.input('fid', sql.VarChar(50), file_id);
      } else {
        request.input('q', sql.NVarChar(500), `%${query.trim()}%`);
      }

      const r = await request.query(sqlQuery);
      const items = r.recordset || [];
      const answer = items.length === 0
        ? 'Báo cáo đồng chí, không tìm thấy văn bản phù hợp trong phạm vi cấp quyền hiện tại.'
        : `Báo cáo đồng chí, tìm thấy ${items.length} văn bản liên quan:\n` +
          items.map((d, i) => `${i + 1}. ${d.document_code || d.file_id} — ${d.title}`).join('\n');

      res.json({
        answer,
        citations: items.map((d) => ({
          file_id: d.file_id,
          document_code: d.document_code || d.file_id,
          title: d.title,
          page: 1,
          security_level_name: `Cấp ${d.security_level_id}`,
          snippet: d.summary || '',
        })),
        reasoning: {
          mem: `[Smart SQL Fallback] User ${req.user.user_id} (mức ${user_clearance})`,
          think: '[Agent Think] Microservice AI offline, thực hiện truy vấn SQL an toàn với cấp phép tối đa.',
          tool_call: '[Tool Grounding] Query trực tiếp SQL Server với pre-filtering clearance_level_id <= user_clearance.',
        },
      });
    } catch (err) {
      console.error('[POST /api/ai/chat]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 3. STUDY BOOK (with Audit Trail) ───
  router.get('/study-book/:fileId', requirePermission('AI_STUDY_BOOK'), async (req, res) => {
    try {
      const fileId = req.params.fileId;
      await logAudit(req, 'AI_STUDY_BOOK', `Tạo tài liệu học tập văn bản ${fileId}`, fileId);

      const r = await callAI(
        `/ai/study-book/${encodeURIComponent(fileId)}`,
        'GET',
      );
      res.json(r);
    } catch (err) {
      res.status(503).json({ error: 'Trợ lý AI hiện không khả dụng', detail: err.message });
    }
  });

  // ─── 4. SYNC TO VECTOR STORE (with Audit Trail) ───
  router.post('/sync-all', requirePermission('AI_SYNC'), async (req, res) => {
    try {
      await logAudit(req, 'AI_SYNC', 'Đồng bộ toàn bộ văn bản sang kho Vector Qdrant');

      const { sql, getPool } = require('./db');
      const pool = await getPool();
      const r = await pool.request().query(`
        SELECT file_id, document_code, title, stored_path, security_level_id
        FROM DOCUMENT WHERE deleted_at IS NULL
      `);
      const docs = r.recordset.map((d) => ({
        file_id: d.file_id,
        document_code: d.document_code || d.file_id,
        title: d.title,
        stored_path: d.stored_path,
        security_level_id: d.security_level_id,
      }));

      const aiRes = await callAI('/ai/sync-all', 'POST', { documents: docs });
      res.json(aiRes);
    } catch (err) {
      console.error('[sync-all]', err);
      res.status(503).json({ error: 'Không đồng bộ được', detail: err.message });
    }
  });

  // ─── 5. MEDIA TIMELINE ───
  router.get('/media/search', requirePermission('AI_QUERY'), async (req, res) => {
    try {
      const q = req.query.q || '';
      const r = await callAI(`/ai/media/search?q=${encodeURIComponent(q)}`, 'GET');
      res.json(r);
    } catch (err) {
      res.json([]);
    }
  });

  return router;
};
