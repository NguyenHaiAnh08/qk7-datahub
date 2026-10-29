<<<<<<< HEAD
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
  const AI_HEALTH_TIMEOUT_MS = 2000; // Kiểm tra sống/chết :8001 <= 2s
  const AI_CHAT_TIMEOUT_MS = parseInt(process.env.AI_CHAT_TIMEOUT_MS || '75000', 10); // Chờ LLM sinh câu trả lời 60–90s (mặc định 75s)

  // Kiểm tra xác thực sinh trắc học vân tay ZK9500 (Header Token hoặc ACCESS_LOG trong 5 phút)
  async function checkBiometricVerified(req, allowLogFallback = false) {
    const userId = req.user?.user_id;
    if (!userId) return false;

    // 1. Kiểm tra header X-Fingerprint-Token
    const fpToken = req.headers['x-fingerprint-token'] || req.headers['X-Fingerprint-Token'] || req.body?.fingerprint_token;
    if (fpToken) {
      try {
        const decoded = jwt.verify(fpToken, effectiveJwtSecret);
        if (decoded && decoded.user_id === userId) {
          return true;
        }
      } catch (tokenErr) {
        // Token không hợp lệ hoặc hết hạn
      }
    }

    if (!allowLogFallback) {
      return false;
    }

    // 2. Tra cứu ACCESS_LOG trong vòng 5 phút gần nhất
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

  // ─── 1. HEALTH (public inside authenticated mount) ───
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

      // Lấy thông tin họ tên, chức vụ, cấp bậc của người dùng đang đăng nhập
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
      const biometric_verified = await checkBiometricVerified(req, false);

      // Ghi nhật ký kiểm toán hành động hỏi AI
      await logAudit(
        req,
        'AI_QUERY',
        `Hỏi AI: ${query.slice(0, 80)} (Cấp ${user_clearance}, Bio: ${biometric_verified ? 'OK' : 'NO'})`,
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
          // Chỉ kích hoạt Smart SQL Fallback khi :8001 lỗi kết nối hoặc trả 5xx, KHÔNG kích hoạt vì chậm (timeout)
          if (chatErr.name === 'AbortError') {
            console.error(`[AI chat] Quá thời gian chờ phản hồi LLM (${AI_CHAT_TIMEOUT_MS / 1000}s), từ chối fallback do chậm.`);
            return res.status(504).json({
              error: 'AI_TIMEOUT',
              message: `Trợ lý AI đang xử lý câu hỏi phức tạp vượt quá thời gian quy định (${AI_CHAT_TIMEOUT_MS / 1000}s). Vui lòng thử lại với câu hỏi ngắn gọn hoặc cụ thể hơn.`,
            });
          }

          // Nếu trả về lỗi 5xx hoặc mất kết nối bất ngờ
          console.warn('[AI chat] Microservice :8001 lỗi thực thi hoặc ngắt kết nối:', chatErr.message);
          // Tiếp tục chảy xuống Smart SQL Fallback bên dưới
        }
      } else {
        console.warn('[AI chat] Microservice :8001 offline/5xx, kích hoạt Smart SQL Fallback an toàn.');
      }

      // 3. SMART SQL FALLBACK — Truy vấn SQL Server trực tiếp với Pre-filtering cấp mật nghiêm ngặt & Khóa Biometric
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
      const docCodeMatches = query.match(/(\\d+[\\/\\-_][\\w\\/\\-_]+)/);
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

      // Phân tách tài liệu Cấp 1-2 và Cấp 3-5 khi chưa xác thực vân tay
      const unclassifiedItems = items.filter((d) => (d.security_level_id || 1) <= 2);
      const classifiedItems = items.filter((d) => (d.security_level_id || 1) >= 3);

      let salutation = 'Báo cáo đồng chí,';
      if (user_name && user_position) {
        salutation = `Báo cáo Đồng chí ${user_name} - ${user_position},`;
      } else if (user_name) {
        salutation = `Báo cáo Đồng chí ${user_name},`;
      }

      let answer = '';
      let requiresBiometric = false;

      if (items.length === 0) {
        answer = `${salutation} không tìm thấy văn bản phù hợp trong phạm vi cấp quyền hiện tại.`;
      } else if (!biometric_verified && classifiedItems.length > 0) {
        requiresBiometric = true;
        if (unclassifiedItems.length === 0) {
          answer = `${salutation} tài liệu liên quan thuộc danh mục văn bản bảo mật (Cấp 3 trở lên). Yêu cầu cán bộ xác thực vân tay trên máy quét ZKTeco ZK9500 (hoặc bấm vào thẻ trích dẫn văn bản bên dưới để quét vân tay) trước khi Trợ lý AI trích xuất nội dung mật.`;
        } else {
          answer = `${salutation} tìm thấy ${items.length} văn bản liên quan. Phần công khai/nội bộ:\n` +
            unclassifiedItems.map((d, i) => `${i + 1}. ${d.document_code || d.file_id} — ${d.title}`).join('\n') +
            `\n\n*(Lưu ý: Có ${classifiedItems.length} văn bản Cấp 3+ Mật/Tối mật/Tuyệt mật yêu cầu xác thực vân tay ZK9500 để xem nội dung chi tiết)*`;
        }
      } else {
        answer = `${salutation} tìm thấy ${items.length} văn bản liên quan:\n` +
          items.map((d, i) => `${i + 1}. ${d.document_code || d.file_id} — ${d.title}`).join('\n');
      }

      const citations = items.map((d) => {
        const isSecret = (d.security_level_id || 1) >= 3;
        const blocked = isSecret && !biometric_verified;
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
          mem: `[Smart SQL Fallback] User ${req.user.user_id} (mức ${user_clearance}) - Bio: ${biometric_verified ? 'VERIFIED' : 'UNVERIFIED'}`,
          think: '[Agent Think] Microservice AI offline/lỗi kết nối, thực hiện truy vấn SQL an toàn với cấp phép tối đa và khóa bảo mật vân tay.',
          tool_call: '[Tool Grounding] Query trực tiếp SQL Server với pre-filtering clearance_level_id <= user_clearance và biometric check.',
        },
      });
    } catch (err) {
      console.error('[POST /api/ai/chat]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 3. STUDY BOOK (with Clearance Enforcement & Biometric & Audit Trail) ───
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
          const bioOk = await checkBiometricVerified(req);
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
=======
// // ============================================================
// // backend/src/ai-routes.js — AI Assistant Proxy & Smart SQL Fallback
// // Cổng giao tiếp giữa Express Gateway (:8000) và boxchat (:8001)
// // Tự động kiểm soát cấp độ mật (X-Clearance) & ghi vết ACCESS_LOG
// // ============================================================

// const express = require('express');
// const router = express.Router();
// const { sql, getPool } = require('./db');

// const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';

// // ─── Helper: lấy IP client ───
// function getClientIp(req) {
//     const forwarded = req.headers['x-forwarded-for'];
//     if (forwarded) return forwarded.split(',')[0].trim();
//     return req.socket?.remoteAddress || req.ip || '127.0.0.1';
// }

// // ─── Helper: ghi log kiểm toán ACCESS_LOG ───
// async function recordAccessLog({ userId, fileId, action, ip, note = null }) {
//     try {
//         const pool = await getPool();
//         const logId = 'LOG-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
//         const validUserId = (userId && userId !== 'GUEST') ? userId : null;
//         await pool.request()
//             .input('log_id',  sql.VarChar(50),   logId)
//             .input('user_id', sql.VarChar(50),   validUserId)
//             .input('file_id', sql.VarChar(50),   fileId || null)
//             .input('action',  sql.VarChar(50),   action)
//             .input('ip',      sql.VarChar(50),   ip || '')
//             .input('note',    sql.NVarChar(255), note ? String(note).slice(0, 255) : null)
//             .query(`
//                 INSERT INTO ACCESS_LOG (log_id, user_id, file_id, [action], ip, note)
//                 VALUES (@log_id, @user_id, @file_id, @action, @ip, @note)
//             `);
//     } catch (err) {
//         console.error('[AI recordAccessLog]', err.message);
//     }
// }

// // ─── Middleware: chuẩn hóa User & Clearance từ Header ───
// router.use((req, res, next) => {
//     const headerUserId = req.headers['x-user-id'] || req.query.uid || req.user?.user_id || 'USR-GUEST';
//     const headerClearance = parseInt(req.headers['x-clearance'] || req.query.clr || req.user?.clearance_level_id || '1', 10);

//     req.aiContext = {
//         userId: headerUserId,
//         clearance: isNaN(headerClearance) ? 1 : Math.max(1, Math.min(5, headerClearance)),
//         ip: getClientIp(req)
//     };
//     next();
// });

// // ============================================================
// // 1. HEALTH CHECK — KIỂM TRA TRẠNG THÁI AI
// // ============================================================
// router.get('/health', async (req, res) => {
//     try {
//         const controller = new AbortController();
//         const timeout = setTimeout(() => controller.abort(), 2000);

//         const response = await fetch(`${AI_SERVICE_URL}/ai/health`, {
//             signal: controller.signal
//         });
//         clearTimeout(timeout);

//         if (response.ok) {
//             const data = await response.json();
//             return res.json({
//                 ...data,
//                 gateway_mode: 'active_microservice'
//             });
//         }
//     } catch (err) {
//         // Fallback info khi AI microservice chưa bật
//     }

//     // Đếm số lượng tài liệu trong SQL Server để báo cáo
//     try {
//         const pool = await getPool();
//         const r = await pool.request().query('SELECT COUNT(*) AS total_docs FROM DOCUMENT');
//         const count = r.recordset[0]?.total_docs || 0;

//         return res.json({
//             status: 'fallback',
//             service: 'AI_BOXCHAT_FALLBACK (SQL Server Database Mode)',
//             port: 8000,
//             total_documents_in_db: count,
//             ollama_connected: false,
//             message: 'AI Service (:8001) đang offline, Gateway đang chạy chế độ Smart SQL Fallback ổn định 100%.'
//         });
//     } catch (dbErr) {
//         return res.json({
//             status: 'standby',
//             service: 'AI_BOXCHAT_GATEWAY',
//             message: 'Hệ thống đang chuẩn bị kết nối.'
//         });
//     }
// });

// // ============================================================
// // 2. CHAT VỚI TRỢ LÝ AI (POST /api/ai/chat & /api/ai/query)
// // ============================================================
// router.post(['/chat', '/query'], async (req, res) => {
//     const { query, file_id } = req.body;
//     const bodyClearance = req.body.user_clearance ? parseInt(req.body.user_clearance, 10) : null;
//     const userId = req.body.user_id || req.aiContext.userId;
//     const clearance = !isNaN(bodyClearance) && bodyClearance ? Math.max(1, Math.min(5, bodyClearance)) : req.aiContext.clearance;
//     const ip = req.aiContext.ip;

//     if (!query || !query.trim()) {
//         return res.status(400).json({ error: 'Thiếu nội dung câu hỏi' });
//     }

//     // Ghi vết Access Log kiểm toán
//     await recordAccessLog({
//         userId,
//         fileId: file_id || null,
//         action: 'AI_QUERY',
//         ip,
//         note: `AI Query: ${query.slice(0, 80)} (Clearance: ${clearance})`
//     });

//     // 1. Thử gọi sang microservice AI_BOXCHAT (:8001)
//     try {
//         const controller = new AbortController();
//         const timeout = setTimeout(() => controller.abort(), 6000);

//         const aiResponse = await fetch(`${AI_SERVICE_URL}/ai/chat`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 query: query.trim(),
//                 user_id: userId,
//                 user_clearance: clearance,
//                 file_id: file_id || null
//             }),
//             signal: controller.signal
//         });
//         clearTimeout(timeout);

//         if (aiResponse.ok) {
//             const aiData = await aiResponse.json();
//             return res.json(aiData);
//         }
//     } catch (err) {
//         console.warn(`[AI-ROUTES] Microservice :8001 chưa sẵn sàng (${err.message}). Kích hoạt Smart SQL Fallback.`);
//     }

//     // 2. SMART SQL FALLBACK — Truy vấn SQL Server trực tiếp, không bao giờ lỗi
//     try {
//         const pool = await getPool();
//         const searchPattern = `%${query.trim()}%`;

//         let sqlQuery = `
//             SELECT TOP 5
//                 d.file_id, d.document_code, d.title, d.security_level_id,
//                 d.summary, d.stored_path, d.signer,
//                 sl.name AS security_level_name
//             FROM DOCUMENT d
//             LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = d.security_level_id
//             WHERE d.security_level_id <= @clearance
//         `;

//         if (file_id) {
//             sqlQuery += ` AND d.file_id = @file_id`;
//         } else {
//             sqlQuery += ` AND (d.title LIKE @q OR d.summary LIKE @q OR d.document_code LIKE @q)`;
//         }

//         sqlQuery += ` ORDER BY d.created_at DESC`;

//         const request = pool.request()
//             .input('clearance', sql.Int, clearance)
//             .input('q', sql.NVarChar(200), searchPattern);

//         if (file_id) {
//             request.input('file_id', sql.VarChar(50), file_id);
//         }

//         const result = await request.query(sqlQuery);
//         const docs = result.recordset || [];

//         if (docs.length === 0) {
//             return res.json({
//                 answer: "Báo cáo đồng chí, nội dung này không có trong các văn bản thuộc phạm vi cấp quyền hiện tại.",
//                 citations: [],
//                 reasoning: {
//                     mem: `[SQL Fallback Memory] Cán bộ: ${userId} | Clearance: Cấp ${clearance}.`,
//                     think: `[SQL Fallback Think] Đã tra cứu bảng DOCUMENT với điều kiện cấp mật <= ${clearance}. Không có kết quả trùng khớp.`,
//                     tool_call: `[SQL Fallback] Trả về thông điệp bảo mật tiêu chuẩn.`
//                 }
//             });
//         }

//         // Tạo câu trả lời có cấu trúc và trích dẫn trang [p.1]
//         const primaryDoc = docs[0];
//         const docCode = primaryDoc.document_code || 'Văn bản';
//         const docTitle = primaryDoc.title || '';
//         const summary = primaryDoc.summary || 'Văn kiện chỉ đạo nghiệp vụ quân sự.';

//         const answerText = [
//             `Báo cáo đồng chí, căn cứ cơ sở dữ liệu văn bản quân sự thuộc quyền khai thác (Cấp ${clearance}):`,
//             `Theo **${docCode}** (*${docTitle}*), tại **Trang 1 [p.1]**:`,
//             `> "${summary}" [p.1]`,
//             docs.length > 1
//                 ? `\nĐồng thời, hệ thống ghi nhận ${docs.length - 1} văn bản liên quan khác trong phạm vi cấp quyền.`
//                 : '',
//             `\nĐồng chí có thể bấm nút bên dưới để mở trực tiếp văn bản tại đúng trang trích dẫn.`
//         ].filter(Boolean).join('\n');

//         const citations = docs.map((d, idx) => ({
//             file_id: d.file_id,
//             document_code: d.document_code || 'Tài liệu',
//             title: d.title || 'Văn bản quân sự',
//             page: 1,
//             security_level_name: d.security_level_name || 'Lưu hành nội bộ',
//             snippet: (d.summary || d.title || '').slice(0, 150) + '...'
//         }));

//         const thinkContent = `[Smart SQL Fallback] Microservice 8001 đang chờ; đã truy vấn trực tiếp bảng DOCUMENT với ${docs.length} kết quả hợp lệ.`;
//         return res.json({
//             answer: answerText,
//             citations,
//             think: thinkContent,
//             reasoning: {
//                 mem: `[Smart SQL Fallback] Cán bộ: ${userId} | Clearance: Cấp ${clearance}.`,
//                 think: thinkContent,
//                 tool_call: `[Database Grounding] Trích xuất metadata văn bản từ SQL Server.`
//             }
//         });

//     } catch (sqlErr) {
//         console.error('[AI Smart SQL Fallback Error]', sqlErr);
//         return res.json({
//             answer: "Báo cáo đồng chí, nội dung này không có trong các văn bản thuộc phạm vi cấp quyền hiện tại.",
//             citations: [],
//             reasoning: {
//                 mem: `[Fallback] Lỗi truy vấn cơ sở dữ liệu.`,
//                 think: sqlErr.message,
//                 tool_call: `Dừng tra cứu an toàn.`
//             }
//         });
//     }
// });

// // ============================================================
// // 3. TẠO CUỐN SÁCH RIÊNG 3 TAB (POST /api/ai/study-book/:fileId)
// // ============================================================
// router.all('/study-book/:fileId', async (req, res) => {
//     const { fileId } = req.params;
//     const { userId, clearance, ip } = req.aiContext;

//     // Ghi vết Access Log kiểm toán
//     await recordAccessLog({
//         userId,
//         fileId,
//         action: 'AI_STUDY_BOOK',
//         ip,
//         note: `AI Study Book: ${fileId} (Clearance: ${clearance})`
//     });

//     // 1. Thử gọi sang microservice AI_BOXCHAT (:8001)
//     try {
//         const controller = new AbortController();
//         const timeout = setTimeout(() => controller.abort(), 6000);

//         const aiResponse = await fetch(`${AI_SERVICE_URL}/ai/study-book/${fileId}?clearance=${clearance}`, {
//             method: 'GET',
//             headers: {
//                 'X-User-Id': userId,
//                 'X-Clearance': String(clearance)
//             },
//             signal: controller.signal
//         });
//         clearTimeout(timeout);

//         if (aiResponse.ok) {
//             const aiData = await aiResponse.json();
//             return res.json(aiData);
//         } else if (aiResponse.status === 403) {
//             return res.status(403).json({ error: 'Cán bộ không đủ cấp độ bảo mật để tạo cuốn sách học tập cho tài liệu này.' });
//         }
//     } catch (err) {
//         console.warn(`[AI-ROUTES] Study-book microservice :8001 offline (${err.message}). Kích hoạt Smart SQL Fallback.`);
//     }

//     // 2. Fallback sinh dữ liệu 3 tab từ SQL Server metadata
//     try {
//         const pool = await getPool();
//         const r = await pool.request()
//             .input('file_id', sql.VarChar(50), fileId)
//             .query(`
//                 SELECT d.file_id, d.document_code, d.title, d.security_level_id,
//                        d.summary, d.stored_path, sl.name AS security_level_name
//                 FROM DOCUMENT d
//                 LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = d.security_level_id
//                 WHERE d.file_id = @file_id
//             `);

//         if (r.recordset.length === 0) {
//             return res.status(404).json({ error: 'Không tìm thấy tài liệu yêu cầu' });
//         }

//         const doc = r.recordset[0];
//         if (doc.security_level_id > clearance) {
//             return res.status(403).json({ error: 'Cán bộ không đủ cấp độ bảo mật để khai thác tài liệu này' });
//         }

//         const docCode = doc.document_code || fileId;
//         const title = doc.title || 'Văn bản quân sự';
//         const summary = doc.summary || 'Tài liệu hướng dẫn tác chiến và văn thư quản lý.';

//         const fallbackStudyBook = {
//             file_id: fileId,
//             document_code: docCode,
//             title: title,
//             total_pages: 1,
//             tab_document: {
//                 overview: `Văn bản **${docCode}** quy định về *"${title}"*. ${summary}`,
//                 document_code: docCode,
//                 title: title,
//                 total_sections: 1,
//                 sections: [
//                     {
//                         section_id: "sec_p1",
//                         page: 1,
//                         title: `Nội dung cốt lõi — Trang 1 (p.1)`,
//                         summary: `${summary} [p.1]`,
//                         key_takeaways: [
//                             `Quán triệt mục tiêu và nguyên tắc thực hiện theo ${docCode}. [p.1]`,
//                             `Phân công cơ quan chủ trì và cơ chế phối hợp tác chiến. [p.1]`,
//                             `Quy định chế độ báo cáo và lưu trữ bảo mật. [p.1]`
//                         ]
//                     }
//                 ]
//             },
//             tab_diagram: {
//                 chart_type: "graph_td",
//                 mermaid_code: [
//                     "graph TD",
//                     `    Root["📄 ${docCode}<br/><b>${title.slice(0, 35)}</b>"]`,
//                     `    Root --> S1["🎯 Mục Tiêu & Căn Cứ Pháp Lý"]`,
//                     `    Root --> S2["⚖️ Phân Công Cơ Quan Chủ Trì"]`,
//                     `    Root --> S3["⚡ Quy Trình Thi Hành & Báo Cáo"]`,
//                     `    S1 --> S11["Căn cứ Mệnh lệnh BTL Quân Khu 7"]`,
//                     `    S2 --> S21["Phòng Tham Mưu & Các Đơn Vị Trực Thuộc"]`,
//                     `    S3 --> S31["Báo cáo định kỳ & Lưu kho Mật"]`
//                 ].join('\n'),
//                 description: `Sơ đồ luồng chỉ huy và tổ chức thực hiện văn kiện ${docCode}.`
//             },
//             tab_quiz: [
//                 {
//                     id: 1,
//                     question: `Văn bản ${docCode} quy định về nội dung trọng tâm nào?`,
//                     options: {
//                         A: `${title}`,
//                         B: "Công tác hậu cần thường xuyên",
//                         C: "Kế hoạch nghỉ phép quân nhân",
//                         D: "Quản lý doanh trại cơ sở"
//                     },
//                     correct_answer: "A",
//                     citation: "Trang 1 [p.1]",
//                     explanation: `Căn cứ theo trích yếu văn bản ${docCode} tại Trang 1 [p.1].`,
//                     agentic_steps: {
//                         mem: `[Agent Memory] Kiểm tra trích yếu văn kiện ${docCode}.`,
//                         think: `[Agent Think] Phương án A nêu chính xác trích yếu nội dung.`,
//                         tool_call: `[Tool Grounding] Đối chiếu chính xác [p.1].`
//                     }
//                 },
//                 {
//                     id: 2,
//                     question: `Cấp độ bảo mật được áp dụng cho tài liệu ${docCode} là gì?`,
//                     options: {
//                         A: "Công khai cho mọi đối tượng ngoài quân đội",
//                         B: `Mức bảo mật ${doc.security_level_name || 'Nội bộ'} (Cấp ${doc.security_level_id})`,
//                         C: "Không quy định mức độ mật",
//                         D: "Tài liệu phổ biến đại chúng"
//                     },
//                     correct_answer: "B",
//                     citation: "Trang 1 [p.1]",
//                     explanation: `Tài liệu được phân cấp bảo mật mức ${doc.security_level_name || 'Nội bộ'} (Cấp ${doc.security_level_id}).`,
//                     agentic_steps: {
//                         mem: `[Agent Memory] Xác minh cấp độ bảo mật trong CSDL.`,
//                         think: `[Agent Think] Tài liệu có level_id = ${doc.security_level_id}.`,
//                         tool_call: `[Tool Grounding] Đối chiếu bảng SECURITY_LEVEL.`
//                     }
//                 },
//                 {
//                     id: 3,
//                     question: `Yêu cầu về chế độ báo cáo và bảo đảm an toàn thông tin khi thực hiện ${docCode}?`,
//                     options: {
//                         A: "Báo cáo qua mạng quân sự nội bộ an toàn, tuyệt đối không tiết lộ bí mật",
//                         B: "Đăng tải công khai lên mạng xã hội",
//                         C: "Chỉ trao đổi qua tin nhắn thông thường",
//                         D: "Không cần báo cáo sau khi hoàn thành"
//                     },
//                     correct_answer: "A",
//                     citation: "Trang 1 [p.1]",
//                     explanation: `Chế độ báo cáo quân sự bắt buộc qua mạng chuyên dùng an toàn [p.1].`,
//                     agentic_steps: {
//                         mem: `[Agent Memory] Nguyên tắc an toàn thông tin QK7.`,
//                         think: `[Agent Think] Chỉ phương án A bảo đảm an toàn bí mật quân sự.`,
//                         tool_call: `[Tool Grounding] Quy chế an toàn thông tin QK7 [p.1].`
//                     }
//                 },
//                 {
//                     id: 4,
//                     question: `Đơn vị hoặc cá nhân nào chịu trách nhiệm tổ chức thực hiện văn kiện ${docCode}?`,
//                     options: {
//                         A: "Chỉ huy các cơ quan, đơn vị trực thuộc theo chức năng, nhiệm vụ",
//                         B: "Tùy ý cá nhân tự thực hiện",
//                         C: "Không quy định cơ quan thi hành",
//                         D: "Toàn bộ chuyển giao cho đơn vị ngoài quân khu"
//                     },
//                     correct_answer: "A",
//                     citation: "Trang 1 [p.1]",
//                     explanation: `Chỉ huy các cơ quan, đơn vị trực thuộc có trách nhiệm quán triệt và triển khai thực hiện [p.1].`,
//                     agentic_steps: {
//                         mem: `[Agent Memory] Phân cấp chỉ huy quân sự.`,
//                         think: `[Agent Think] Phương án A thể hiện đúng nguyên tắc chỉ huy tập trung.`,
//                         tool_call: `[Tool Grounding] Đối chiếu phần tổ chức thực hiện [p.1].`
//                     }
//                 },
//                 {
//                     id: 5,
//                     question: `Hiệu lực thi hành của văn bản ${docCode} được tính từ thời điểm nào?`,
//                     options: {
//                         A: "Sau 1 năm kể từ ngày ký",
//                         B: "Kể từ ngày ký ban hành theo quy định của Bộ Quốc phòng và Quân Khu 7",
//                         C: "Chỉ có hiệu lực trong vòng 48 giờ",
//                         D: "Không có giá trị bắt buộc thi hành"
//                     },
//                     correct_answer: "B",
//                     citation: "Trang 1 [p.1]",
//                     explanation: `Văn bản có hiệu lực thi hành kể từ ngày ký ban hành [p.1].`,
//                     agentic_steps: {
//                         mem: `[Agent Memory] Hiệu lực văn kiện quân sự.`,
//                         think: `[Agent Think] Hiệu lực chính thức tính từ ngày ký ban hành.`,
//                         tool_call: `[Tool Grounding] Xác nhận điều khoản thi hành [p.1].`
//                     }
//                 }
//             ]
//         };

//         return res.json(fallbackStudyBook);

//     } catch (sqlErr) {
//         console.error('[AI Study Book SQL Error]', sqlErr);
//         return res.status(500).json({ error: 'Không thể tạo tài liệu học tập: ' + sqlErr.message });
//     }
// });

// // ============================================================
// // 4. ĐỒNG BỘ TOÀN BỘ TÀI LIỆU SANG AI VECTOR STORE (POST /api/ai/sync-all)
// // ============================================================
// router.post('/sync-all', async (req, res) => {
//     try {
//         const pool = await getPool();
//         const r = await pool.request().query(`
//             SELECT file_id, document_code, title, stored_path, security_level_id
//             FROM DOCUMENT
//         `);

//         const documents = r.recordset || [];

//         try {
//             const aiResponse = await fetch(`${AI_SERVICE_URL}/ai/sync-all`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({ documents })
//             });

//             if (aiResponse.ok) {
//                 const aiData = await aiResponse.json();
//                 return res.json(aiData);
//             }
//         } catch (callErr) {
//             return res.json({
//                 success: true,
//                 synced_to_sql: documents.length,
//                 ai_service_online: false,
//                 message: `Đã nạp ${documents.length} tài liệu vào SQL Server. AI_BOXCHAT (:8001) đang offline.`
//             });
//         }

//         return res.json({
//             success: true,
//             total_documents: documents.length
//         });
//     } catch (err) {
//         console.error('[POST /api/ai/sync-all]', err);
//         return res.status(500).json({ error: err.message });
//     }
// });

// // ============================================================
// // 5. INGEST MỘT TÀI LIỆU CỤ THỂ (POST /api/ai/ingest)
// // ============================================================
// router.post('/ingest', async (req, res) => {
//     try {
//         const { file_id, document_code, title, stored_path, security_level_id } = req.body;
//         if (!file_id || !stored_path) {
//             return res.status(400).json({ error: 'Thiếu thông tin file_id hoặc stored_path' });
//         }

//         try {
//             const aiResponse = await fetch(`${AI_SERVICE_URL}/ai/ingest`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     file_id,
//                     document_code: document_code || file_id,
//                     title: title || 'Tài liệu',
//                     stored_path,
//                     security_level_id: parseInt(security_level_id || '1', 10)
//                 })
//             });

//             if (aiResponse.ok) {
//                 const data = await aiResponse.json();
//                 return res.json(data);
//             }
//         } catch (aiErr) {
//             console.warn(`[AI Ingest] Microservice :8001 chưa bật. Ghi nhận tài liệu ${file_id} vào SQL Server thành công.`);
//         }

//         return res.json({
//             success: true,
//             file_id,
//             status: 'queued_in_db'
//         });
//     } catch (err) {
//         return res.status(500).json({ error: err.message });
//     }
// });

// module.exports = router;





// ============================================================
// ai-routes.js — AI Gateway Proxy + Smart SQL Fallback
// Permission checks tùy endpoint
// ============================================================

const express = require('express');

module.exports = function createAIRoutes({ requirePermission }) {
  const router = express.Router();

  const AI_BASE = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';
  const AI_TIMEOUT_MS = 2500;

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

  // ─── HEALTH (public inside authenticated mount) ───
  router.get('/health', async (req, res) => {
    try {
      const r = await callAI('/ai/health');
      res.json(r);
    } catch {
      res.json({ status: 'offline', service: 'AI_BOXCHAT', gateway_mode: 'fallback' });
    }
  });

  // ─── CHAT (with Smart SQL Fallback) ───
  router.post('/chat', requirePermission('AI_QUERY'), async (req, res) => {
    try {
      const { query, file_id } = req.body;
      if (!query || !query.trim()) return res.status(400).json({ error: 'Thiếu câu hỏi' });

      const user_clearance = req.user.clearance_level_id;

      // Try AI service first
      try {
        const aiRes = await callAI('/ai/chat', 'POST', {
          query, user_id: req.user.user_id, user_clearance, file_id,
        });
        return res.json(aiRes);
      } catch (err) {
        console.warn('[AI chat] fallback:', err.message);
      }

      // ─── SMART SQL FALLBACK ───
      const { sql, getPool } = require('./db');
      const pool = await getPool();
      const r = await pool.request()
        .input('q', sql.NVarChar(500), `%${query}%`)
        .input('clr', sql.Int, user_clearance)
        .query(`
          SELECT TOP 5 file_id, document_code, title, summary, security_level_id
          FROM DOCUMENT
          WHERE deleted_at IS NULL
            AND security_level_id <= @clr
            AND (title LIKE @q OR summary LIKE @q OR document_code LIKE @q)
          ORDER BY issued_date DESC
        `);

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
          think: '[Agent Think] Microservice AI offline, chuyển sang truy vấn SQL an toàn.',
          tool_call: '[Tool Grounding] Query trực tiếp SQL Server với pre-filtering clearance.',
        },
      });
    } catch (err) {
      console.error('[POST /api/ai/chat]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── STUDY BOOK ───
  router.get('/study-book/:fileId', requirePermission('AI_STUDY_BOOK'), async (req, res) => {
    try {
      const r = await callAI(
        `/ai/study-book/${encodeURIComponent(req.params.fileId)}`,
        'GET',
      );
      res.json(r);
    } catch (err) {
      res.status(503).json({ error: 'Trợ lý AI hiện không khả dụng', detail: err.message });
    }
  });

  // ─── SYNC ───
  router.post('/sync-all', requirePermission('AI_SYNC'), async (req, res) => {
    try {
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

  // ─── MEDIA TIMELINE ───
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
>>>>>>> 9cca8193b4de194f8f1694b8c69925ce22b91e94
