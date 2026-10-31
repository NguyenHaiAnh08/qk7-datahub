// ============================================================
// ai-routes.js — AI Gateway Proxy + Smart SQL Fallback
// Permission checks + Clearance Enforcement + Audit Trail
// ============================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'qk7-secret-key-change-in-production-2026';

module.exports = function createAIRoutes({ requirePermission, writeAccessLog, getClientIp, JWT_SECRET: passedSecret }) {
  const effectiveJwtSecret = passedSecret || JWT_SECRET;
  const router = express.Router();

  const AI_BASE = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';
  const AI_HEALTH_TIMEOUT_MS = 2000;
  const AI_CHAT_TIMEOUT_MS = parseInt(process.env.AI_CHAT_TIMEOUT_MS || '75000', 10);

  // ✅ MỚI: Trích xuất file_id từ JWT token vân tay (dùng cho trường hợp chat chung không có file_id)
  async function getBiometricTokenFileId(req) {
    const userId = req.user?.user_id;
    if (!userId) return null;
    const fpToken = req.headers['x-fingerprint-token'] || req.headers['X-Fingerprint-Token'] || req.body?.fingerprint_token;
    if (!fpToken) return null;
    try {
      const decoded = jwt.verify(fpToken, effectiveJwtSecret);
      if (decoded && decoded.user_id === userId) {
        return decoded.file_id || null;
      }
    } catch (e) {}
    return null;
  }

  // Kiểm tra xác thực sinh trắc học vân tay ZK9500 (Header Token hoặc ACCESS_LOG trong 5 phút)
  async function checkBiometricVerified(req, allowLogFallback = false, targetFileId = null) {
    const userId = req.user?.user_id;
    if (!userId) return false;

    const fpToken = req.headers['x-fingerprint-token'] || req.headers['X-Fingerprint-Token'] || req.body?.fingerprint_token;
    if (fpToken) {
      try {
        const decoded = jwt.verify(fpToken, effectiveJwtSecret);
        if (decoded && decoded.user_id === userId) {
          if (targetFileId && decoded.file_id !== targetFileId) {
            console.warn(`[AI Security] Cảnh báo: User ${userId} dùng token của file ${decoded.file_id} để truy cập file ${targetFileId}`);
            return false;
          }
          return true;
        }
      } catch (tokenErr) {}
    }

    if (!allowLogFallback) {
      return false;
    }

    try {
      const pool = await getPool();
      const query = `
        SELECT TOP 1 log_id
        FROM ACCESS_LOG
        WHERE user_id = @userId
          AND action IN ('FINGERPRINT_OK', 'FINGERPRINT_VERIFY_OK')
          AND [timestamp] >= DATEADD(minute, -5, GETDATE())
        ORDER BY [timestamp] DESC
      `;
      const result = await pool.request()
        .input('userId', sql.VarChar(50), userId)
        .query(query);

      if (result.recordset && result.recordset.length > 0) {
        return true;
      }
    } catch (dbErr) {
      console.warn('[AI checkBiometricVerified] Lỗi tra cứu ACCESS_LOG:', dbErr.message);
    }

    return false;
  }

  async function callAI(path, method = 'GET', body = null, timeoutMs = 3000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${AI_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const err = new Error(`AI service ${res.status}`);
        err.status = res.status;
        throw err;
      }
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

  // ─── 1. HEALTH ───
  router.get('/health', async (req, res) => {
    try {
      const r = await callAI('/ai/health', 'GET', null, AI_HEALTH_TIMEOUT_MS);
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

  // ─── 2. CHAT (with Smart SQL Fallback & Audit Trail & Biometric Guard) ───
  router.post('/chat', requirePermission('AI_QUERY'), async (req, res) => {
    try {
      const { query, file_id } = req.body;
      if (!query || !query.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi' });

      const user_clearance = req.user.clearance_level_id || 1;
      const history = Array.isArray(req.body.history) ? req.body.history.slice(-6) : [];

      let user_name = req.user.full_name || '';
      let user_position = req.user.position || '';
      let user_rank = req.user.rank || '';

      try {
        const pool = await getPool();
        const uRes = await pool.request()
          .input('uid', sql.VarChar(50), req.user.user_id)
          .query('SELECT full_name, [rank] AS rank_name, [position] FROM [USER] WHERE user_id = @uid');
        if (uRes.recordset && uRes.recordset.length > 0) {
          user_name = uRes.recordset[0].full_name || user_name;
          user_position = uRes.recordset[0].position || user_position;
          user_rank = uRes.recordset[0].rank_name || user_rank;
        }
      } catch (uErr) {
        console.warn('[AI user info lookup error]:', uErr.message);
      }

      // Kiểm tra xác thực sinh trắc học vân tay ZK9500
      const biometric_verified = await checkBiometricVerified(req, false, file_id);
      // ✅ MỚI: Lấy file_id thực sự của token để xử lý đúng trường hợp chat chung
      const tokenFileId = biometric_verified ? await getBiometricTokenFileId(req) : null;

      // ✅ MỚI: Helper quyết định xem có được tin tưởng biometric cho citation này không
      // - Khi request có file_id: checkBiometricVerified đã validate token khớp file đó → tin tưởng
      // - Khi chat chung (không có file_id): chỉ tin tưởng nếu citation khớp tokenFileId
      const isBiometricTrustedForDoc = (d) => {
        if (!biometric_verified) return false;
        if (file_id) {
          return String(d.file_id) === String(file_id);
        }
        if (tokenFileId) {
          return String(d.file_id) === String(tokenFileId);
        }
        return false;
      };

      await logAudit(
        req,
        'AI_QUERY',
        `Hỏi AI: ${query.slice(0, 80)} (Cấp ${user_clearance}, Bio: ${biometric_verified ? 'OK' : 'NO'}, tokenFile: ${tokenFileId || 'none'})`,
        file_id || null
      );

      // Bước 1: Kiểm tra sống/chết :8001 với timeout nhanh <= 2s
      let isMicroserviceAlive = false;
      try {
        const health = await callAI('/ai/health', 'GET', null, AI_HEALTH_TIMEOUT_MS);
        if (health && health.status === 'online') {
          isMicroserviceAlive = true;
        }
      } catch (pingErr) {
        console.warn('[AI chat] Microservice :8001 kiểm tra sống/chết thất bại (<=2s):', pingErr.message);
        isMicroserviceAlive = false;
      }

      // Bước 2: Nếu :8001 còn sống, thử gọi LLM với timeout 60–90s (75s)
      if (isMicroserviceAlive) {
        try {
          const aiRes = await callAI('/ai/chat', 'POST', {
            query: query.trim(),
            user_id: req.user.user_id,
            user_name,
            user_position,
            user_rank,
            user_clearance,
            file_id: file_id || null,
            history,
            biometric_verified,
          }, AI_CHAT_TIMEOUT_MS);
          return res.json(aiRes);
        } catch (chatErr) {
          if (chatErr.name === 'AbortError') {
            console.error(`[AI chat] Quá thời gian chờ phản hồi LLM (${AI_CHAT_TIMEOUT_MS / 1000}s), từ chối fallback do chậm.`);
            return res.status(504).json({
              error: 'AI_TIMEOUT',
              message: `Trợ lý AI đang xử lý câu hỏi phức tạp vượt quá thời gian quy định (${AI_CHAT_TIMEOUT_MS / 1000}s). Vui lòng thử lại với câu hỏi ngắn gọn hoặc cụ thể hơn.`,
            });
          }
          console.warn('[AI chat] Microservice :8001 lỗi thực thi hoặc ngắt kết nối:', chatErr.message);
        }
      } else {
        console.warn('[AI chat] Microservice :8001 offline/5xx, kích hoạt Smart SQL Fallback an toàn.');
      }

      // 3. SMART SQL FALLBACK
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

      // Nhận diện số hiệu văn bản trong câu hỏi (Regex)
      const docCodeMatches = query.match(/(\d+[\/\-_][\w\/\-_]+)/);
      if (docCodeMatches) {
        const targetDocCode = docCodeMatches[0].toLowerCase();
        const hasDocMatch = items.some((d) => {
          const cCode = (d.document_code || '').toLowerCase();
          const cTitle = (d.title || '').toLowerCase();
          const cFid = (d.file_id || '').toLowerCase();
          return cCode.includes(targetDocCode) || cTitle.includes(targetDocCode) || cFid.includes(targetDocCode);
        });

        if (!hasDocMatch) {
          const clrNames = {
            1: 'Cấp 1 - Công khai',
            2: 'Cấp 2 - Nội bộ',
            3: 'Cấp 3 - Mật',
            4: 'Cấp 4 - Tối mật',
            5: 'Cấp 5 - Tuyệt mật',
          };
          const clrName = clrNames[user_clearance] || `Cấp ${user_clearance}`;
          const refusalAnswer = `Báo cáo đồng chí, tài liệu ${docCodeMatches[0]} không phù hợp với cấp bảo mật hiện tại của đồng chí (${clrName}). Xin đồng chí vui lòng kiểm tra lại hoặc tra cứu tài liệu khác cùng cấp độ bảo mật.`;
          return res.json({
            answer: refusalAnswer,
            citations: [],
            reasoning: {
              mem: `[Smart SQL Fallback] Cấp bảo mật: ${clrName}`,
              think: `[Clearance Guard] Phát hiện câu hỏi yêu cầu văn bản ${docCodeMatches[0]} nhưng không có trong danh mục được cấp quyền.`,
              tool_call: `[Security Refusal] Chặn trích dẫn văn bản ${docCodeMatches[0]}.`,
            },
            retrieval_mode: 'sql_fallback',
            synthesis_mode: 'clearance_blocked',
            requires_biometric: false,
          });
        }
      }

      // ✅ SỬA: Phân loại theo khả năng mở khóa (per-file) thay vì flat theo biometric_verified
      const publicItems = items.filter((d) => (d.security_level_id || 1) <= 2);
      const secretItems = items.filter((d) => (d.security_level_id || 1) >= 3);
      const unlockedSecretItems = secretItems.filter(isBiometricTrustedForDoc);
      const lockedSecretItems = secretItems.filter((d) => !isBiometricTrustedForDoc(d));
      const visibleItems = [...publicItems, ...unlockedSecretItems];

      let salutation = 'Báo cáo đồng chí,';
      if (user_name && user_position) {
        salutation = `Báo cáo Đồng chí ${user_name} - ${user_position},`;
      } else if (user_name) {
        salutation = `Báo cáo Đồng chí ${user_name},`;
      }

      let answer = '';
      // ✅ SỬA: requiresBiometric = true khi còn bất kỳ văn bản mật nào bị khóa
      const requiresBiometric = lockedSecretItems.length > 0;

      if (items.length === 0) {
        answer = `${salutation} không tìm thấy văn bản phù hợp trong phạm vi cấp quyền hiện tại.`;
      } else if (lockedSecretItems.length > 0) {
        if (visibleItems.length === 0) {
          answer = `${salutation} tài liệu liên quan thuộc danh mục văn bản bảo mật (Cấp 3 trở lên). Yêu cầu cán bộ xác thực vân tay trên máy quét ZKTeco ZK9500 (hoặc bấm vào thẻ trích dẫn văn bản bên dưới để quét vân tay) trước khi Trợ lý AI trích xuất nội dung mật.`;
        } else {
          answer = `${salutation} tìm thấy ${items.length} văn bản liên quan. Phần hiển thị được:\n` +
            visibleItems.map((d, i) => `${i + 1}. ${d.document_code || d.file_id} — ${d.title}`).join('\n') +
            `\n\n*(Lưu ý: Có ${lockedSecretItems.length} văn bản Cấp 3+ Mật/Tối mật/Tuyệt mật yêu cầu xác thực vân tay ZK9500 để xem nội dung chi tiết)*`;
        }
      } else {
        answer = `${salutation} tìm thấy ${items.length} văn bản liên quan:\n` +
          items.map((d, i) => `${i + 1}. ${d.document_code || d.file_id} — ${d.title}`).join('\n');
      }

      // ✅ SỬA: Citations map dùng per-file biometric trust
      const citations = items.map((d) => {
        const isSecret = (d.security_level_id || 1) >= 3;
        // Chỉ mở khóa khi: file này đã pass biometric (khớp file_id request hoặc khớp tokenFileId)
        const blocked = isSecret && !isBiometricTrustedForDoc(d);
        return {
          file_id: d.file_id,
          document_code: d.document_code || d.file_id,
          title: d.title,
          page: 1,
          security_level_name: `Cấp ${d.security_level_id}`,
          snippet: blocked
            ? '[Nội dung Mật - Yêu cầu xác thực vân tay ZK9500 để xem chi tiết]'
            : (d.summary || ''),
          requires_biometric: blocked,
        };
      });

      res.json({
        answer,
        citations,
        requires_biometric: requiresBiometric,
        reasoning: {
          mem: `[Smart SQL Fallback] User ${req.user.user_id} (mức ${user_clearance}) - Bio: ${biometric_verified ? 'VERIFIED' : 'UNVERIFIED'} - TokenFile: ${tokenFileId || 'none'} - ReqFile: ${file_id || 'none'}`,
          think: '[Agent Think] Microservice AI offline/lỗi kết nối, thực hiện truy vấn SQL an toàn với cấp phép tối đa và khóa bảo mật vân tay per-file.',
          tool_call: '[Tool Grounding] Query trực tiếp SQL Server với pre-filtering clearance_level_id <= user_clearance và per-file biometric check.',
        },
      });
    } catch (err) {
      console.error('[POST /api/ai/chat]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 3. STUDY BOOK ───
  router.get('/study-book/:fileId', requirePermission('AI_STUDY_BOOK'), async (req, res) => {
    try {
      const fileId = req.params.fileId;
      const pool = await getPool();
      const docRes = await pool.request()
        .input('fid', sql.VarChar(100), fileId)
        .query('SELECT security_level_id FROM DOCUMENT WHERE file_id = @fid AND deleted_at IS NULL');

      if (docRes.recordset && docRes.recordset.length > 0) {
        const secLvl = docRes.recordset[0].security_level_id || 1;
        const userClearance = req.user.clearance_level_id || 1;
        if (secLvl > userClearance) {
          await logAudit(req, 'AI_STUDY_BOOK_DENIED', `Từ chối tạo tài liệu ${fileId}: Không đủ cấp mật`, fileId);
          return res.status(403).json({ error: 'Không có quyền truy cập văn bản này' });
        }
        if (secLvl >= 3) {
          const bioOk = await checkBiometricVerified(req, false, fileId);
          if (!bioOk) {
            await logAudit(req, 'AI_STUDY_BOOK_DENIED', `Từ chối tạo tài liệu ${fileId}: Chưa quét vân tay`, fileId);
            return res.status(403).json({ error: 'Tài liệu Cấp 3+ yêu cầu xác thực vân tay', require_fingerprint: true });
          }
        }
      }

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

  // ─── 4. SYNC TO VECTOR STORE ───
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