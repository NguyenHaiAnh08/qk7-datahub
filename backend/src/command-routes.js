// backend/src/command-routes.js
// ═══════════════════════════════════════════════════════════════════════
// KHÔNG GIAN CHỈ HUY — số liệu giám sát tổng hợp, CHỈ ĐỌC.
//
// Nguyên tắc:
//   - Quyền COMMAND_VIEW (không kiểm tra cứng tên vai trò).
//   - Phạm vi theo cây đơn vị của người xem (unit-scope.js). Admin/ROL-04: toàn bộ.
//   - Độ mật: chỉ đếm tài liệu có security_level_id <= cấp của người xem,
//     để không lộ sự tồn tại của tài liệu cao hơn cấp được phép.
//   - Chỉ trả số liệu tổng hợp. KHÔNG trả IP, phiên đăng nhập, danh sách người dùng,
//     nội dung tài liệu hay thông số kỹ thuật hạ tầng (đó là phạm vi của Admin).
// ═══════════════════════════════════════════════════════════════════════
const express = require('express');
const { sql, getPool } = require('./db');
const { getUserUnitScope } = require('./unit-scope');

const HANGING_MINUTES = 4 * 60; // đồng bộ với lecture-routes.js

module.exports = function createCommandRoutes({ requirePermission }) {
  const router = express.Router();

  // Gắn tham số IN (...) cho 1 request; trả '' nếu không giới hạn đơn vị.
  function unitFilter(request, column, unitIds, prefix) {
    if (!unitIds) return '';
    const names = unitIds.map((id, i) => {
      request.input(`${prefix}${i}`, sql.VarChar(50), id);
      return `@${prefix}${i}`;
    });
    return names.length ? ` AND ${column} IN (${names.join(',')})` : ' AND 1 = 0';
  }

  router.get('/overview', requirePermission('COMMAND_VIEW'), async (req, res) => {
    try {
      const pool = await getPool();
      const scope = await getUserUnitScope(req.user);
      const isAdmin = (scope.roles || []).includes('ROL-01');

      if (!isAdmin && scope.no_unit) {
        return res.status(403).json({ error: 'Tài khoản chưa được gán đơn vị.', no_unit: true });
      }
      const unitIds = scope.restricted ? scope.unit_ids : null;
      const clearance = Number(req.user.clearance_level_id) || 1;
      const degraded = [];

      const safe = async (name, fn, fallback) => {
        try { return await fn(); }
        catch (e) {
          console.error(`[command/overview:${name}]`, e.message);
          degraded.push(name);
          return fallback;
        }
      };
      const q = () => pool.request().input('cl', sql.Int, clearance);

      const [documents, byLevel, byUnit, byType, approvals, lectures, teaching, rooms, security] =
        await Promise.all([
          safe('documents', async () => {
            const r = q();
            const f = unitFilter(r, 'd.issuing_unit_id', unitIds, 'du');
            const out = await r.query(`
              SELECT COUNT(*) AS total,
                     ISNULL(SUM(CASE WHEN d.created_at >= DATEADD(day,-7,GETDATE())  THEN 1 ELSE 0 END),0) AS new_7d,
                     ISNULL(SUM(CASE WHEN d.created_at >= DATEADD(day,-30,GETDATE()) THEN 1 ELSE 0 END),0) AS new_30d
              FROM DOCUMENT d
              WHERE d.deleted_at IS NULL AND d.file_id NOT LIKE 'DOC-LEC-%' AND d.file_id NOT LIKE 'LIB-%'
                AND d.security_level_id <= @cl ${f}`);
            return out.recordset[0];
          }, { total: 0, new_7d: 0, new_30d: 0 }),

          safe('byLevel', async () => {
            const r = q();
            const f = unitFilter(r, 'd.issuing_unit_id', unitIds, 'lu');
            const out = await r.query(`
              SELECT sl.level_id AS level_id, sl.name AS name, COUNT(d.file_id) AS n
              FROM SECURITY_LEVEL sl
              LEFT JOIN DOCUMENT d ON d.security_level_id = sl.level_id
                   AND d.deleted_at IS NULL AND d.file_id NOT LIKE 'DOC-LEC-%' AND d.file_id NOT LIKE 'LIB-%' ${f}
              WHERE sl.level_id <= @cl
              GROUP BY sl.level_id, sl.name ORDER BY sl.level_id`);
            return out.recordset;
          }, []),

          safe('byUnit', async () => {
            const r = q();
            const f = unitFilter(r, 'd.issuing_unit_id', unitIds, 'uu');
            const out = await r.query(`
              SELECT TOP 10 u.unit_id AS unit_id, u.name AS name, COUNT(d.file_id) AS n
              FROM DOCUMENT d JOIN UNIT u ON u.unit_id = d.issuing_unit_id
              WHERE d.deleted_at IS NULL AND d.file_id NOT LIKE 'DOC-LEC-%' AND d.file_id NOT LIKE 'LIB-%'
                AND d.security_level_id <= @cl ${f}
              GROUP BY u.unit_id, u.name ORDER BY n DESC`);
            return out.recordset;
          }, []),

          safe('byType', async () => {
            const r = q();
            const f = unitFilter(r, 'd.issuing_unit_id', unitIds, 'tu');
            const out = await r.query(`
              SELECT TOP 10 dt.type_id AS type_id, dt.name AS name, COUNT(d.file_id) AS n
              FROM DOCUMENT d JOIN DOCUMENT_TYPE dt ON dt.type_id = d.doc_type_id
              WHERE d.deleted_at IS NULL AND d.file_id NOT LIKE 'DOC-LEC-%' AND d.file_id NOT LIKE 'LIB-%'
                AND d.security_level_id <= @cl ${f}
              GROUP BY dt.type_id, dt.name ORDER BY n DESC`);
            return out.recordset;
          }, []),

          safe('approvals', async () => {
            const r1 = q();
            const f1 = unitFilter(r1, 'ar.requester_unit_id', unitIds, 'au');
            const reqs = await r1.query(
              `SELECT COUNT(*) AS n FROM APPROVAL_REQUEST ar WHERE ar.status = 'PENDING' ${f1}`);
            const r2 = q();
            const f2 = unitFilter(r2, 'd.issuing_unit_id', unitIds, 'pu');
            const props = await r2.query(`
              SELECT COUNT(*) AS n FROM DOCUMENT_REVISION_PROPOSAL p
              JOIN DOCUMENT d ON d.file_id = p.file_id
              WHERE p.status = 'PENDING' AND d.security_level_id <= @cl ${f2}`);
            return { pending_requests: reqs.recordset[0].n, pending_proposals: props.recordset[0].n };
          }, { pending_requests: 0, pending_proposals: 0 }),

          safe('lectures', async () => {
            const r = q();
            const f = unitFilter(r, 'l.faculty_unit_id', unitIds, 'lu');
            const out = await r.query(`
              SELECT l.status AS status, COUNT(*) AS n
              FROM DIGITAL_LECTURE l
              WHERE l.status <> 'DELETED' AND l.security_level_id <= @cl ${f}
              GROUP BY l.status`);
            const byStatus = {};
            for (const row of out.recordset) byStatus[row.status] = row.n;
            return { by_status: byStatus };
          }, { by_status: {} }),

          safe('teaching', async () => {
            const r = q().input('hang', sql.Int, HANGING_MINUTES);
            const f = unitFilter(r, 'l.faculty_unit_id', unitIds, 'tu');
            const out = await r.query(`
              SELECT
                ISNULL(SUM(CASE WHEN s.status = 'ONGOING' THEN 1 ELSE 0 END),0) AS ongoing_now,
                ISNULL(SUM(CASE WHEN s.status = 'ONGOING'
                                 AND DATEDIFF(MINUTE, s.start_time, GETDATE()) > @hang THEN 1 ELSE 0 END),0) AS hanging,
                ISNULL(SUM(CASE WHEN s.status = 'COMPLETED'
                                 AND CAST(s.start_time AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END),0) AS completed_today,
                ISNULL(SUM(CASE WHEN s.status = 'COMPLETED' AND s.end_time IS NOT NULL
                                 AND CAST(s.start_time AS DATE) = CAST(GETDATE() AS DATE)
                                THEN DATEDIFF(MINUTE, s.start_time, s.end_time) ELSE 0 END),0) AS minutes_today,
                ISNULL(SUM(CASE WHEN s.status = 'COMPLETED' AND s.end_time IS NOT NULL
                                 AND s.start_time >= DATEADD(day,-30,GETDATE())
                                THEN DATEDIFF(MINUTE, s.start_time, s.end_time) ELSE 0 END),0) AS minutes_30d
              FROM TEACHING_SCHEDULE s
              JOIN DIGITAL_LECTURE l ON l.lecture_id = s.lecture_id
              WHERE l.security_level_id <= @cl ${f}`);
            return out.recordset[0];
          }, { ongoing_now: 0, hanging: 0, completed_today: 0, minutes_today: 0, minutes_30d: 0 }),

          safe('rooms', async () => {
            const out = await pool.request().query(`
              SELECT
                (SELECT COUNT(*) FROM CLASSROOM WHERE active = 1) AS total,
                (SELECT COUNT(*) FROM CLASSROOM WHERE active = 1 AND is_maintenance = 1) AS maintenance,
                (SELECT COUNT(DISTINCT room_id) FROM TEACHING_SCHEDULE
                  WHERE status = 'ONGOING' AND room_id IS NOT NULL) AS in_session`);
            return out.recordset[0];
          }, { total: 0, maintenance: 0, in_session: 0 }),

          safe('security', async () => {
            const r = q();
            const f = unitFilter(r, 'u.unit_id', unitIds, 'su');
            const out = await r.query(`
              SELECT
                ISNULL(SUM(CASE WHEN l.[action] IN ('LOGIN_FAIL','LOGIN_FAIL_FP') THEN 1 ELSE 0 END),0) AS failed_logins_24h,
                ISNULL(SUM(CASE WHEN l.[action] = 'SCREENSHOT_ATTEMPT' THEN 1 ELSE 0 END),0) AS screenshot_attempts_24h,
                ISNULL(SUM(CASE WHEN l.[action] = 'VIEW' AND d.security_level_id >= 3
                                 AND d.security_level_id <= @cl THEN 1 ELSE 0 END),0) AS sensitive_views_24h
              FROM ACCESS_LOG l
              LEFT JOIN [USER] u ON u.user_id = l.user_id
              LEFT JOIN DOCUMENT d ON d.file_id = l.file_id
              WHERE l.[timestamp] >= DATEADD(day,-1,GETDATE()) ${f}`);
            return out.recordset[0];
          }, { failed_logins_24h: 0, screenshot_attempts_24h: 0, sensitive_views_24h: 0 }),
        ]);

      res.json({
        generated_at: new Date().toISOString(),
        scope: { restricted: !!scope.restricted, root_unit: scope.root_unit || null },
        clearance,
        documents, by_level: byLevel, by_unit: byUnit, by_type: byType,
        approvals, lectures, teaching, rooms, security,
        degraded,
      });
    } catch (err) {
      console.error('[GET /api/command/overview]', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
