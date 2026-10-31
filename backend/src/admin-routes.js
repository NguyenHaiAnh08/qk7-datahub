// src/admin-routes.js
const bcrypt = require('bcryptjs');
const { AUTO_PERMISSIONS, getAutoRequiredPermission } = require('./route-permissions');
let invalidateCatalogCache;
try {
    invalidateCatalogCache = require('../pdf-parser').invalidateCatalogCache;
} catch (e) {}

module.exports = (app, deps) => {
    const {
        sql, getPool, writeAccessLog,
        requireAuth,
        requirePermission,
        requireAnyPermission,
        getUserPermissions,
        invalidateCache,
        listActiveSessions,
        killSessionById,
        revokeAllUserSessions,
        sessionIdleTimeoutMinutes = 30,
    } = deps;


    const getClientIp = (req) => {
        const raw = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '';
        let ip = String(Array.isArray(raw) ? raw[0] : raw).split(',')[0].trim();
        if (ip.startsWith('::ffff:')) ip = ip.slice(7);
        if (ip === '::1') ip = '127.0.0.1';
        return ip;
    };

    
    


    // ═══════════════════════════════════════════════════════════════
    // [v4.3] Approval Workflow
    // ═══════════════════════════════════════════════════════════════
    

    

    const approvalModule = require('./approval-workflow')({
        sql, getPool, writeAccessLog, getClientIp, getAutoRequiredPermission,
    });
    const { approvalInterceptor, loadProtectedPermissions, isProtectedAdmin } = approvalModule;


    // ═══════════════════════════════════════════════════════════════
    // [v4.3.2] Route xem yêu cầu của chính mình — dành cho IT
    // KHÔNG nằm dưới /api/admin → không cần permission đặc biệt,
    // chỉ cần authenticated (đã được middleware chung xử lý).
    // ═══════════════════════════════════════════════════════════════
    app.get('/api/my-approval-requests', requireAuth, async (req, res) => {
      try {
        const userId = req.user.user_id;
        const status = String(req.query.status || 'PENDING_REJECTED').toUpperCase();

        const validStatuses = [
          'PENDING', 'APPROVED', 'EXECUTING', 'EXECUTED', 'REJECTED', 'FAILED',
          'PENDING_REJECTED', 'ALL',
        ];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: 'Status không hợp lệ' });
        }

        const pool = await getPool();
        const request = pool.request().input('uid', sql.VarChar(50), userId);

        let query = `
          SELECT 
            request_id, requester_id, required_permission, http_method, http_path,
            target_summary, status, reviewed_by, reviewed_at, review_note,
            executed_at, execution_error, created_at
          FROM APPROVAL_REQUEST
          WHERE requester_id = @uid
        `;

        if (status === 'PENDING_REJECTED') {
          query += ` AND status IN ('PENDING', 'REJECTED')`;
        } else if (status !== 'ALL') {
          query += ` AND status = @status`;
          request.input('status', sql.VarChar(20), status);
        }

        query += ` ORDER BY created_at DESC`;

        const result = await request.query(query);

        res.json({
          total: result.recordset.length,
          items: result.recordset,
        });
      } catch (err) {
        console.error('[GET /api/my-approval-requests]', err);
        res.status(500).json({ error: err.message });
      }
    });


    // ═══ Cache invalidation helpers ═══
    const _invalidateUser = (uid) => {
        if (typeof invalidateCache === 'function') {
            try { invalidateCache(uid); console.log(`[Cache] Invalidated user ${uid}`); }
            catch (e) { console.warn('[Cache] invalidateUser failed:', e.message); }
        }
    };
    const _invalidateAll = () => {
        if (typeof invalidateCache === 'function') {
            try { invalidateCache(); console.log('[Cache] Cleared all'); }
            catch (e) { console.warn('[Cache] invalidateAll failed:', e.message); }
        }
    };

    

    const requireAdminPanelAccess = async (req, res, next) => {
        if (!req.user || !req.user.is_authenticated) {
            return res.status(401).json({ error: 'Cần đăng nhập để truy cập trang quản trị', code: 'UNAUTHORIZED' });
        }
        if ((req.user?.roles || []).includes('ROL-01')) return next();

        const fullPath = (req.originalUrl || '').split('?')[0].replace(/\/+$/, '') || '/';

        const rules = AUTO_PERMISSIONS[req.method] || [];
        const matched = rules.find(([regex]) => regex.test(fullPath));

        if (!matched) {
            console.warn(`[RBAC] Route chưa cấu hình: ${req.method} ${fullPath}`);
            return res.status(403).json({
                error: 'Route này chưa được cấu hình quyền truy cập',
                code: 'NO_RULE',
                method: req.method,
                path: fullPath,
            });
        }
        const requiredPerm = matched[1];

        try {
            const codes = await getUserPermissions(req.user.user_id);
            if (codes.includes(requiredPerm)) return next();
            return res.status(403).json({
                error: `Bạn không có quyền thực hiện thao tác này (thiếu: ${requiredPerm})`,
                code: 'PERMISSION_DENIED',
                required_permission: requiredPerm,
            });
        } catch (err) {
            console.error('[requireAdminPanelAccess]', err);
            return res.status(500).json({ error: 'Lỗi kiểm tra quyền' });
        }
    };
    app.use('/api/admin', requireAdminPanelAccess);

    const log = (req, action, note) => writeAccessLog({
        userId: req.user.user_id, fileId: null,
        action, ip: req.ip || '', note,
    });





    // ═══════════════════════════════════════════════════════════
    // 0. THỐNG KÊ DASHBOARD
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/stats', async (req, res) => {
        try {
            const pool = await getPool();
            const [u, d, byLv, byType, byUnit, logs24] = await Promise.all([
                pool.request().query(`SELECT COUNT(*) AS n FROM [USER]`),
                pool.request().query(`SELECT COUNT(*) AS n, ISNULL(SUM(file_size),0) AS size FROM DOCUMENT`),
                pool.request().query(`SELECT sl.level_id AS lv, sl.name AS lvName, COUNT(d.file_id) AS n FROM SECURITY_LEVEL sl LEFT JOIN DOCUMENT d ON d.security_level_id = sl.level_id GROUP BY sl.level_id, sl.name ORDER BY sl.level_id`),
                pool.request().query(`SELECT dt.type_id AS id, dt.name, COUNT(d.file_id) AS n FROM DOCUMENT_TYPE dt LEFT JOIN DOCUMENT d ON d.doc_type_id = dt.type_id GROUP BY dt.type_id, dt.name ORDER BY n DESC`),
                pool.request().query(`SELECT u.unit_id AS id, u.name, COUNT(d.file_id) AS n FROM UNIT u LEFT JOIN DOCUMENT d ON d.issuing_unit_id = u.unit_id GROUP BY u.unit_id, u.name ORDER BY n DESC`),
                pool.request().query(`SELECT COUNT(*) AS n FROM ACCESS_LOG WHERE [timestamp] >= DATEADD(day,-1,GETDATE())`),
            ]);
            res.json({
                users: u.recordset[0].n,
                documents: d.recordset[0].n,
                totalSize: Number(d.recordset[0].size) || 0,
                byLevel: byLv.recordset,
                byType: byType.recordset,
                byUnit: byUnit.recordset,
                logs24h: logs24.recordset[0].n,
            });
        } catch (e) {
            console.error('[GET /api/admin/stats]', e);
            res.status(500).json({ error: e.message });
        }
    });

    // ═══════════════════════════════════════════════════════════
    // 1. USER CRUD
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/users', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`
                SELECT u.user_id, u.username, u.full_name, u.[rank] AS rank_name, u.[position],
                       u.unit_id, un.name AS unit_name, u.status, u.clearance_level_id,
                       sl.name AS clearance_name, sl.code AS clearance_code,
                       CASE WHEN EXISTS (SELECT 1 FROM USER_FINGERPRINT uf WHERE uf.user_id = u.user_id AND uf.active = 1) THEN 1 ELSE 0 END AS has_fingerprint
                FROM [USER] u
                LEFT JOIN UNIT un ON un.unit_id = u.unit_id
                LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = u.clearance_level_id
                ORDER BY CASE WHEN u.user_id LIKE 'USR-%' THEN TRY_CAST(SUBSTRING(u.user_id, 5, 20) AS INT) ELSE 999999 END, u.user_id
            `);
            const rolesRes = await pool.request().query(`
                SELECT ur.user_id, r.role_id, r.name FROM USER_ROLE ur
                JOIN [ROLE] r ON r.role_id = ur.role_id
            `);
            const rolesByUser = {}, roleNamesByUser = {};
            for (const row of rolesRes.recordset) {
                (rolesByUser[row.user_id] ||= []).push(row.role_id);
                (roleNamesByUser[row.user_id] ||= []).push(row.name);
            }
            const items = r.recordset.map(u => ({
                ...u,
                has_fingerprint: u.has_fingerprint === 1,
                roles: rolesByUser[u.user_id] || [],
                role_names: roleNamesByUser[u.user_id] || [],
            }));
            res.json({ total: items.length, items });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/users', async (req, res) => {
        try {
            let { user_id, username, password, full_name, rank_name, position, unit_id, status, clearance_level_id, role_id, roles } = req.body;
            const pool = await getPool();

            // ═══ SECURITY CHECK — CHẠY TRƯỚC KHI INSERT ═══
            if (!clearance_level_id) {
                return res.status(400).json({ error: 'Thiếu mức bảo mật' });
            }

            // ═══════════════════════════════════════════════════════════
            // [NEW] PHÂN QUYỀN TẠO USER: Admin → toàn quyền | IT → giới hạn
            // ═══════════════════════════════════════════════════════════
            const { NON_ADMIN_CREATABLE_ROLES } = require('./user-roles');
            
            const callerIsAdmin = (req.user?.roles || []).includes('ROL-01');
            const callerClearance = req.user?.clearance_level_id || 1;
            const targetClearance = parseInt(clearance_level_id, 10);
            const targetRoles = role_id ? [role_id] : (Array.isArray(roles) ? roles : []);

            if (!callerIsAdmin) {
                // 1. Không được tạo user cấp bảo mật cao hơn mình
                if (targetClearance > callerClearance) {
                    return res.status(403).json({
                        error: `Không thể tạo user có cấp bảo mật cao hơn bạn (Cấp ${callerClearance})`,
                        code: 'PERMISSION_DENIED',
                    });
                }

                // 2. [NEW] Chỉ được gán role trong whitelist (Trợ lý + Chỉ huy)
                const invalidRoles = targetRoles.filter(
                    (r) => r && !NON_ADMIN_CREATABLE_ROLES.includes(r)
                );
                if (invalidRoles.length > 0) {
                    return res.status(403).json({
                        error: `Bạn chỉ được tạo tài khoản với vai trò "Trợ lý" hoặc "Chỉ huy". Vai trò không hợp lệ: ${invalidRoles.join(', ')}`,
                        code: 'ROLE_NOT_ALLOWED',
                        allowed_roles: NON_ADMIN_CREATABLE_ROLES,
                    });
                }

                // 3. [NEW] Bắt buộc phải chọn 1 role (không được để trống)
                if (targetRoles.length === 0) {
                    return res.status(400).json({
                        error: 'Vui lòng chọn vai trò cho tài khoản mới (Trợ lý hoặc Chỉ huy).',
                        code: 'ROLE_REQUIRED',
                        allowed_roles: NON_ADMIN_CREATABLE_ROLES,
                    });
                }
            }

            // Auto-gen user_id
            if (!user_id || !user_id.trim()) {
                const allUsers = await pool.request().query('SELECT user_id FROM [USER]');
                const existingNums = new Set();
                for (const r of allUsers.recordset) {
                    const m = (r.user_id || '').match(/USR-(\d+)/i);
                    if (m) { const n = parseInt(m[1], 10); if (!isNaN(n) && n > 0) existingNums.add(n); }
                }
                let candidate = 1;
                while (existingNums.has(candidate)) candidate++;
                user_id = `USR-${String(candidate).padStart(3, '0')}`;
                if (!username || !username.trim()) username = user_id.toLowerCase();
            }

            if (!user_id || !full_name) return res.status(400).json({ error: 'Thiếu user_id hoặc full_name' });
            if (!username || !username.trim()) return res.status(400).json({ error: 'Thiếu username' });
            if (!password || password.length < 8) return res.status(400).json({ error: 'Mật khẩu cần ít nhất 8 ký tự' });

            const passwordHash = await bcrypt.hash(password, 10);
            await pool.request()
                .input('user_id', sql.VarChar(50), user_id.trim())
                .input('username', sql.VarChar(50), username.trim().toLowerCase())
                .input('full_name', sql.NVarChar(100), full_name)
                .input('rank', sql.NVarChar(50), rank_name || null)
                .input('position', sql.NVarChar(100), position || null)
                .input('unit_id', sql.VarChar(50), unit_id || null)
                .input('status', sql.VarChar(20), status || 'active')
                .input('clearance_level_id', sql.Int, targetClearance)
                .input('password_hash', sql.VarChar(255), passwordHash)
                .query(`INSERT INTO [USER] (user_id, username, full_name, [rank], [position], unit_id, status, clearance_level_id, password_hash)
                        VALUES (@user_id, @username, @full_name, @rank, @position, @unit_id, @status, @clearance_level_id, @password_hash)`);

            for (const rId of targetRoles) {
                if (rId) {
                    await pool.request()
                        .input('u', sql.VarChar(50), user_id.trim())
                        .input('r', sql.VarChar(50), rId)
                        .query(`IF NOT EXISTS (SELECT 1 FROM USER_ROLE WHERE user_id = @u AND role_id = @r) INSERT INTO USER_ROLE (user_id, role_id) VALUES (@u, @r)`);
                }
            }

            await log(req, 'CREATE_USER', `Tạo user ${user_id} (${username})`);
            res.json({ success: true, user_id: user_id.trim(), username: username.trim().toLowerCase(), note: 'Tài khoản đã tạo.' });
        } catch (e) {
            if (e.message.includes('PRIMARY KEY')) return res.status(409).json({ error: 'user_id đã tồn tại' });
            if (e.message.includes('UQ_USER_USERNAME') || e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username đã tồn tại' });
            console.error('[POST /api/admin/users]', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/admin/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        // SECURITY: KHÔNG nhận role_id/roles — dùng POST /users/:id/roles
        const { full_name, rank_name, position, unit_id, status, clearance_level_id } = req.body;

        const pool = await getPool();

        const callerIsAdmin = (req.user?.roles || []).includes('ROL-01');
        const callerPerms = callerIsAdmin ? [] : await getUserPermissions(req.user.user_id);
        const canChangeClearance = callerIsAdmin || callerPerms.includes('USER_ROLE_ASSIGN');

        const targetUserRes = await pool.request()
            .input('u', sql.VarChar(50), userId)
            .query(`SELECT clearance_level_id, status FROM [USER] WHERE user_id = @u`);
        if (targetUserRes.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy user' });
        }
        const targetUser = targetUserRes.recordset[0];

        if (!canChangeClearance && clearance_level_id !== undefined &&
            parseInt(clearance_level_id, 10) !== targetUser.clearance_level_id) {
            return res.status(403).json({
                error: 'Chỉ người có quyền USER_ROLE_ASSIGN mới được đổi cấp độ bảo mật',
                code: 'PERMISSION_DENIED',
                required_permission: 'USER_ROLE_ASSIGN',
            });
        }

        const callerClearance = req.user?.clearance_level_id || 1;
        if (!callerIsAdmin && targetUser.clearance_level_id > callerClearance) {
            return res.status(403).json({
                error: `Không thể sửa user có cấp bảo mật cao hơn bạn (Cấp ${callerClearance})`,
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // [SECURITY FIX v4.3.1] Chặn leo thang đặc quyền qua PUT
        // Kiểm tra GIÁ TRỊ MỚI của clearance_level_id không được vượt cấp
        // của người thực hiện (trừ Admin).
        // ═══════════════════════════════════════════════════════════════
        const newClearance =
            clearance_level_id !== undefined
                ? parseInt(clearance_level_id, 10)
                : targetUser.clearance_level_id;

        if (!callerIsAdmin && newClearance > callerClearance) {
            return res.status(403).json({
                error: `Không thể gán cấp bảo mật (Cấp ${newClearance}) cao hơn cấp của bạn (Cấp ${callerClearance})`,
                code: 'CLEARANCE_ESCALATION_DENIED',
                caller_clearance: callerClearance,
                requested_clearance: newClearance,
            });
        }

        // [SECURITY FIX v4.3.1] Bổ sung: Admin chỉ được đổi clearance
        // nếu có quyền USER_ROLE_ASSIGN — nếu Admin tối cao ROL-01 thì bypass.

        if (!callerIsAdmin && status !== undefined && status !== targetUser.status) {
            const targetIsAdmin = await pool.request()
                .input('u', sql.VarChar(50), userId)
                .query(`SELECT 1 FROM USER_ROLE WHERE user_id = @u AND role_id = 'ROL-01'`);
            if (targetIsAdmin.recordset.length > 0) {
                return res.status(403).json({
                    error: 'Chỉ Admin mới có thể đổi trạng thái tài khoản Admin khác',
                });
            }
        }

        const r = await pool.request()
            .input('user_id', sql.VarChar(50), userId)
            .input('full_name', sql.NVarChar(100), full_name)
            .input('rank', sql.NVarChar(50), rank_name || null)
            .input('position', sql.NVarChar(100), position || null)
            .input('unit_id', sql.VarChar(50), unit_id || null)
            .input('status', sql.VarChar(20), status || targetUser.status || 'active')
            .input('clearance_level_id', sql.Int,
                canChangeClearance && clearance_level_id !== undefined
                    ? parseInt(clearance_level_id, 10)
                    : targetUser.clearance_level_id)
            .query(`UPDATE [USER] SET full_name=@full_name, [rank]=@rank, [position]=@position,
                    unit_id=@unit_id, status=@status, clearance_level_id=@clearance_level_id
                    WHERE user_id=@user_id`);
        if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy user' });

        await log(req, 'UPDATE_USER', `Sửa user ${userId}`);
        _invalidateUser(userId);
        res.json({ success: true });
    } catch (e) {
        console.error('[PUT /api/admin/users/:id]', e);
        res.status(500).json({ error: e.message });
    }
});

    app.delete('/api/admin/users/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const uid = req.params.id;
            const callerIsAdmin = (req.user?.roles || []).includes('ROL-01');
            const callerClearance = req.user?.clearance_level_id || 1;

            // SECURITY: Không xóa user cấp cao hơn mình
            if (!callerIsAdmin) {
                const targetRes = await pool.request()
                    .input('u', sql.VarChar(50), uid)
                    .query(`SELECT clearance_level_id FROM [USER] WHERE user_id = @u`);
                if (targetRes.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });
                if (targetRes.recordset[0].clearance_level_id > callerClearance) {
                    return res.status(403).json({
                        error: `Không thể xóa user có cấp bảo mật cao hơn bạn (Cấp ${callerClearance})`,
                        code: 'PERMISSION_DENIED',
                    });
                }
            }

            await pool.request().input('u', sql.VarChar(50), uid).query(`DELETE FROM USER_FINGERPRINT WHERE user_id = @u`);
            await pool.request().input('u', sql.VarChar(50), uid).query(`DELETE FROM USER_ROLE WHERE user_id = @u`);
            await pool.request().input('u', sql.VarChar(50), uid).query(`DELETE FROM USER_PERMISSION WHERE user_id = @u`);
            await pool.request().input('u', sql.VarChar(50), uid).query(`DELETE FROM USER_SESSION WHERE user_id = @u`);
            await pool.request().input('u', sql.VarChar(50), uid).query(`UPDATE ACCESS_LOG SET user_id = NULL WHERE user_id = @u`);
            await pool.request().input('u', sql.VarChar(50), uid).query(`UPDATE DOCUMENT SET uploaded_by = NULL WHERE uploaded_by = @u`);
            const r = await pool.request().input('u', sql.VarChar(50), uid).query(`DELETE FROM [USER] WHERE user_id = @u`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy user' });
            await log(req, 'DELETE_USER', `Xóa user ${uid}`);
            _invalidateUser(uid);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.put('/api/admin/users/:id/credentials', async (req, res) => {
    try {
        const userId = req.params.id;
        const { username, password } = req.body;
        const callerIsAdmin = (req.user?.roles || []).includes('ROL-01');
        if (!callerIsAdmin) {
            return res.status(403).json({
                error: 'Chỉ Quản trị viên tối cao được đổi mật khẩu quân nhân. ' +
                       'Cán bộ IT vui lòng liên hệ Admin để thực hiện.',
                code: 'CREDENTIALS_ADMIN_ONLY',
            });
        }

        if (!username || !username.trim()) {
            return res.status(400).json({ error: 'Thiếu username' });
        }

        const pool = await getPool();
        // ⚠️ KHÔNG khai báo lại callerIsAdmin — đã có ở trên
        const callerClearance = req.user?.clearance_level_id || 1;

        const chk = await pool.request()
            .input('u', sql.VarChar(50), userId)
            .query(`SELECT user_id, clearance_level_id FROM [USER] WHERE user_id = @u`);
        if (chk.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });

        // [defense-in-depth] Không đổi password user cấp cao hơn mình
        // Sau guard trên, callerIsAdmin luôn === true → block này thực tế
        // không trigger, nhưng giữ để phòng trường hợp logic ROL-01 thay đổi.
        if (!callerIsAdmin && chk.recordset[0].clearance_level_id > callerClearance) {
            return res.status(403).json({
                error: `Không thể đổi tài khoản user có cấp bảo mật cao hơn bạn (Cấp ${callerClearance})`,
                code: 'PERMISSION_DENIED',
            });
        }

        const reqUpdate = pool.request()
            .input('u', sql.VarChar(50), userId)
            .input('un', sql.VarChar(50), username.trim().toLowerCase());
        let query = `UPDATE [USER] SET username = @un`;

        if (password && password.trim()) {
            if (password.length < 8) return res.status(400).json({ error: 'Mật khẩu cần ít nhất 8 ký tự' });
            const hash = await bcrypt.hash(password, 10);
            reqUpdate.input('ph', sql.VarChar(255), hash);
            query += `, password_hash = @ph`;
        }
        query += ` WHERE user_id = @u`;
        await reqUpdate.query(query);

        await log(req, 'UPDATE_CREDENTIALS', `Cập nhật tài khoản ${userId} (username: ${username})`);
        res.json({ success: true, user_id: userId, username: username.trim().toLowerCase() });
    } catch (e) {
        if (e.message.includes('UQ_USER_USERNAME') || e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username đã tồn tại' });
        console.error('[PUT /api/admin/users/:id/credentials]', e);
        res.status(500).json({ error: e.message });
    }
});

    // ═══════════════════════════════════════════════════════════
    // 2. USER_ROLE — assign / revoke
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/users/:id/roles', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request()
                .input('u', sql.VarChar(50), req.params.id)
                .query(`SELECT r.role_id, r.name FROM USER_ROLE ur JOIN [ROLE] r ON r.role_id = ur.role_id WHERE ur.user_id = @u`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/users/:id/roles', async (req, res) => {
        const userId = req.params.id;
        const { role_id, duration_days, expires_at, force_revoke } = req.body;
        try {
            const pool = await getPool();

            // ═══ SECURITY CHECK ═══
            const callerIsAdmin = (req.user?.roles || []).includes('ROL-01');

            // 1. Không cho gán ROL-01 nếu caller không phải Admin
            if (!callerIsAdmin && !force_revoke && role_id === 'ROL-01') {
                return res.status(403).json({
                    error: 'Chỉ Admin mới có thể gán vai trò Admin (ROL-01)',
                    code: 'PERMISSION_DENIED',
                });
            }

            // 2. Không cho tự gán role cho chính mình (trừ Admin)
            if (!callerIsAdmin && userId === req.user.user_id && !force_revoke) {
                return res.status(403).json({
                    error: 'Không thể tự thay đổi vai trò của chính mình',
                    code: 'PERMISSION_DENIED',
                });
            }

            // 3. Không cho gỡ role Admin của người khác (trừ Admin)
            if (!callerIsAdmin && force_revoke && role_id === 'ROL-01') {
                return res.status(403).json({
                    error: 'Không thể gỡ vai trò Admin của người khác',
                    code: 'PERMISSION_DENIED',
                });
            }

            if (force_revoke) {
                await pool.request()
                    .input('uid', sql.VarChar(50), userId)
                    .input('rid', sql.VarChar(50), role_id)
                    .query(`DELETE FROM USER_ROLE WHERE user_id = @uid AND role_id = @rid`);
                await writeAccessLog({ userId: req.user.user_id, fileId: null, action: 'REVOKE_ROLE', ip: getClientIp(req), note: `Thu hồi quyền ${role_id} của ${userId}` });
                _invalidateUser(userId);
                return res.json({ success: true, revoked: true });
            }

            let finalExpiresAt = null;
            if (expires_at) {
                finalExpiresAt = new Date(expires_at);
                finalExpiresAt.setHours(23, 59, 59, 999);
            } else if (duration_days !== undefined && duration_days !== null) {
                if (Number(duration_days) > 0) {
                    finalExpiresAt = new Date();
                    finalExpiresAt.setDate(finalExpiresAt.getDate() + Number(duration_days));
                }
            }
            if (finalExpiresAt && finalExpiresAt <= new Date()) {
                return res.status(400).json({ error: 'Ngày hết hạn phải lớn hơn thời điểm hiện tại.', code: 'INVALID_EXPIRY' });
            }

            await pool.request()
                .input('uid', sql.VarChar(50), userId)
                .input('rid', sql.VarChar(50), role_id)
                .input('exp', sql.DateTime, finalExpiresAt)
                .query(`MERGE USER_ROLE AS target USING (SELECT @uid AS user_id, @rid AS role_id) AS source
                        ON target.user_id = source.user_id AND target.role_id = source.role_id
                        WHEN MATCHED THEN UPDATE SET expires_at = CASE
                            WHEN @exp IS NULL THEN NULL
                            WHEN target.expires_at IS NULL THEN NULL
                            WHEN @exp > target.expires_at THEN @exp
                            ELSE target.expires_at END
                        WHEN NOT MATCHED THEN INSERT (user_id, role_id, expires_at) VALUES (@uid, @rid, @exp);`);

            const result = await pool.request()
                .input('uid', sql.VarChar(50), userId)
                .input('rid', sql.VarChar(50), role_id)
                .query(`SELECT expires_at FROM USER_ROLE WHERE user_id = @uid AND role_id = @rid`);
            const actualExpiresAt = result.recordset[0]?.expires_at;

            await writeAccessLog({
                userId: req.user.user_id, fileId: null, action: 'ASSIGN_ROLE', ip: getClientIp(req),
                note: `Cấp quyền ${role_id} cho ${userId} ${actualExpiresAt ? `(Hết hạn: ${new Date(actualExpiresAt).toLocaleDateString('vi-VN')})` : '(Vĩnh viễn)'}`,
            });
            _invalidateUser(userId);

            res.json({ success: true, role_id, expires_at: actualExpiresAt });
        } catch (err) {
            console.error('[assign-role]', err);
            res.status(500).json({ error: err.message });
        }
    });

        app.delete('/api/admin/users/:id/roles/:roleId', async (req, res) => {
        try {
            const userId = req.params.id;
            const roleId = req.params.roleId;
            const callerIsAdmin = (req.user?.roles || []).includes('ROL-01');

            // SECURITY: Không cho gỡ role Admin của người khác (trừ Admin)
            if (!callerIsAdmin && roleId === 'ROL-01') {
                return res.status(403).json({
                    error: 'Không thể gỡ vai trò Admin của người khác',
                    code: 'PERMISSION_DENIED',
                });
            }

            const pool = await getPool();
            
            // ✅ FIX: Bọc try/catch để bắt lỗi Trigger từ SQL Server
            try {
                await pool.request()
                    .input('u', sql.VarChar(50), userId)
                    .input('r', sql.VarChar(50), roleId)
                    .query(`DELETE FROM USER_ROLE WHERE user_id=@u AND role_id=@r`);
            } catch (dbErr) {
                if (dbErr.message.includes('The transaction ended in the trigger') || dbErr.message.includes('Không thể gỡ vai trò Admin')) {
                    return res.status(403).json({ 
                        error: 'Hệ thống từ chối gỡ vai trò này. Tài khoản này đang giữ vai trò Quản trị viên cuối cùng hoặc bị khóa bởi quy tắc bảo vệ.', 
                        code: 'TRIGGER_BLOCKED' 
                    });
                }
                throw dbErr; // Nếu là lỗi DB khác thì ném ra ngoài
            }

            await log(req, 'REVOKE_ROLE', `Bỏ role ${roleId} của user ${userId}`);
            _invalidateUser(userId);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ═══════════════════════════════════════════════════════════
    // 2b. USER_PERMISSION — gán / gỡ quyền trực tiếp
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/users/:id/permissions', async (req, res) => {
        try {
            const pool = await getPool();
            const userId = req.params.id;
            const chk = await pool.request().input('u', sql.VarChar(50), userId).query(`SELECT user_id FROM [USER] WHERE user_id = @u`);
            if (chk.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });

            const fromRoles = await pool.request()
                .input('u', sql.VarChar(50), userId)
                .query(`SELECT p.permission_id, p.code, p.description, p.group_code, p.sort_order,
                        p.subgroup_key, p.subgroup_label, p.subgroup_order, p.subgroup_tone,
                        r.role_id, r.[name] AS role_name, ur.expires_at AS role_expires_at
                        FROM USER_ROLE ur
                        JOIN [ROLE] r ON r.role_id = ur.role_id
                        JOIN ROLE_PERMISSION rp ON rp.role_id = ur.role_id
                        JOIN [PERMISSION] p ON p.permission_id = rp.permission_id
                        WHERE ur.user_id = @u AND (ur.expires_at IS NULL OR ur.expires_at > GETDATE())
                        ORDER BY p.sort_order, p.subgroup_order, p.code`);

            const directGrants = await pool.request()
                .input('u', sql.VarChar(50), userId)
                .query(`SELECT up.permission_id, p.code, p.description, p.group_code, p.sort_order,
                        p.subgroup_key, p.subgroup_label, p.subgroup_order, p.subgroup_tone,
                        up.granted_by, up.granted_at, up.expires_at, up.note
                        FROM USER_PERMISSION up
                        JOIN [PERMISSION] p ON p.permission_id = up.permission_id
                        WHERE up.user_id = @u AND (up.expires_at IS NULL OR up.expires_at > GETDATE())
                        ORDER BY p.sort_order, p.subgroup_order, p.code`);

            const codeSet = new Set();
            for (const r of fromRoles.recordset) codeSet.add(r.code);
            for (const d of directGrants.recordset) codeSet.add(d.code);

            res.json({
                user_id: userId,
                effective_codes: Array.from(codeSet).sort(),
                from_roles: fromRoles.recordset,
                direct_grants: directGrants.recordset,
            });
        } catch (e) {
            console.error('[GET /api/admin/users/:id/permissions]', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/admin/users/:id/permissions', async (req, res) => {
        try {
            const userId = req.params.id;
            const { permission_id, expires_at, note } = req.body;
            if (!permission_id) return res.status(400).json({ error: 'Thiếu permission_id' });

            const pool = await getPool();
            const chkUser = await pool.request().input('u', sql.VarChar(50), userId).query(`SELECT user_id FROM [USER] WHERE user_id = @u`);
            if (chkUser.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });

            const chkPerm = await pool.request().input('p', sql.VarChar(50), permission_id).query(`SELECT permission_id FROM [PERMISSION] WHERE permission_id = @p`);
            if (chkPerm.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy permission' });

            let finalExpiresAt = null;
            if (expires_at) {
                finalExpiresAt = new Date(expires_at);
                finalExpiresAt.setHours(23, 59, 59, 999);
                if (finalExpiresAt <= new Date()) {
                    return res.status(400).json({ error: 'Ngày hết hạn phải lớn hơn hiện tại.', code: 'INVALID_EXPIRY' });
                }
            }

            await pool.request()
                .input('u', sql.VarChar(50), userId)
                .input('p', sql.VarChar(50), permission_id)
                .input('by', sql.VarChar(50), req.user.user_id)
                .input('exp', sql.DateTime, finalExpiresAt)
                .input('n', sql.NVarChar(255), note || null)
                .query(`MERGE USER_PERMISSION AS target USING (SELECT @u AS user_id, @p AS permission_id) AS source
                        ON target.user_id = source.user_id AND target.permission_id = source.permission_id
                        WHEN MATCHED THEN UPDATE SET granted_by = @by,
                            expires_at = CASE
                                WHEN @exp IS NULL THEN NULL
                                WHEN target.expires_at IS NULL THEN NULL
                                WHEN @exp > target.expires_at THEN @exp
                                ELSE target.expires_at END,
                            note = COALESCE(@n, target.note)
                        WHEN NOT MATCHED THEN INSERT (user_id, permission_id, granted_by, expires_at, note)
                            VALUES (@u, @p, @by, @exp, @n);`);

            const result = await pool.request()
                .input('u', sql.VarChar(50), userId)
                .input('p', sql.VarChar(50), permission_id)
                .query(`SELECT expires_at FROM USER_PERMISSION WHERE user_id = @u AND permission_id = @p`);
            const actualExpiresAt = result.recordset[0]?.expires_at;

            await writeAccessLog({
                userId: req.user.user_id, fileId: null, action: 'GRANT_PERMISSION', ip: getClientIp(req),
                note: `Gán quyền ${permission_id} cho ${userId} ${actualExpiresAt ? `(Hết hạn: ${new Date(actualExpiresAt).toLocaleDateString('vi-VN')})` : '(Vĩnh viễn)'}`,
            });
            _invalidateUser(userId);
            res.json({ success: true, user_id: userId, permission_id, expires_at: actualExpiresAt });
        } catch (e) {
            console.error('[POST /api/admin/users/:id/permissions]', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.delete('/api/admin/users/:id/permissions/:permId', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request()
                .input('u', sql.VarChar(50), req.params.id)
                .input('p', sql.VarChar(50), req.params.permId)
                .query(`DELETE FROM USER_PERMISSION WHERE user_id = @u AND permission_id = @p`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'User chưa được grant quyền này' });

            await writeAccessLog({
                userId: req.user.user_id, fileId: null, action: 'REVOKE_PERMISSION', ip: getClientIp(req),
                note: `Thu hồi quyền ${req.params.permId} của ${req.params.id}`,
            });
            _invalidateUser(req.params.id);
            res.json({ success: true, user_id: req.params.id, permission_id: req.params.permId });
        } catch (e) {
            console.error('[DELETE /api/admin/users/:id/permissions/:permId]', e);
            res.status(500).json({ error: e.message });
        }
    });

    // ═══════════════════════════════════════════════════════════
    // 3. ROLE CRUD
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/roles', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`SELECT role_id, name FROM [ROLE] ORDER BY role_id`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ═══════════════════════════════════════════════════════════
    // [NEW] Trả về role mà user hiện tại ĐƯỢC PHÉP gán khi tạo user
    // Admin (ROL-01): trả về TẤT CẢ roles
    // IT (non-admin): chỉ trả về Trợ lý + Chỉ huy
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/creatable-roles', async (req, res) => {
        try {
            const { NON_ADMIN_CREATABLE_ROLES } = require('./user-roles');
            const callerIsAdmin = (req.user?.roles || []).includes('ROL-01');
            
            const pool = await getPool();
            const allRolesRes = await pool.request().query(
                `SELECT role_id, name FROM [ROLE] ORDER BY role_id`
            );
            const allRoles = allRolesRes.recordset;

            // Admin → tất cả roles
            if (callerIsAdmin) {
                return res.json({
                    items: allRoles,
                    is_admin: true,
                    note: 'Toàn quyền chọn mọi vai trò',
                });
            }

            // IT → chỉ Trợ lý + Chỉ huy
            const filtered = allRoles.filter((r) =>
                NON_ADMIN_CREATABLE_ROLES.includes(r.role_id)
            );

            return res.json({
                items: filtered,
                is_admin: false,
                note: 'Chỉ được gán vai trò Trợ lý hoặc Chỉ huy',
            });
        } catch (e) {
            console.error('[GET /api/admin/creatable-roles]', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/admin/roles', async (req, res) => {
        try {
            let { role_id, name } = req.body;
            const pool = await getPool();
            if (!role_id || !role_id.trim()) {
                const allRoles = await pool.request().query('SELECT role_id FROM [ROLE]');
                const existingNums = new Set();
                for (const r of allRoles.recordset) {
                    const m = (r.role_id || '').match(/ROL-(\d+)/i);
                    if (m) { const n = parseInt(m[1], 10); if (!isNaN(n) && n > 0) existingNums.add(n); }
                }
                let candidate = 1;
                while (existingNums.has(candidate)) candidate++;
                role_id = `ROL-${String(candidate).padStart(2, '0')}`;
            }
            if (!name || !name.trim()) return res.status(400).json({ error: 'Thiếu tên vai trò' });
            await pool.request()
                .input('id', sql.VarChar(50), role_id)
                .input('n', sql.NVarChar(100), name.trim())
                .query(`INSERT INTO [ROLE] (role_id, name) VALUES (@id, @n)`);
            res.json({ success: true, role_id });
        } catch (e) {
            if (e.message.includes('PRIMARY KEY')) return res.status(409).json({ error: 'role_id đã tồn tại' });
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/admin/roles/:id', async (req, res) => {
        try {
            const { name } = req.body;
            const pool = await getPool();
            const r = await pool.request()
                .input('id', sql.VarChar(50), req.params.id)
                .input('n', sql.NVarChar(100), name)
                .query(`UPDATE [ROLE] SET name=@n WHERE role_id=@id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/roles/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const id = req.params.id;
            if (id === 'ROL-01') {
                return res.status(403).json({ error: 'Không thể xóa vai trò Admin (ROL-01)' });
            }
            await pool.request().input('id', sql.VarChar(50), id).query(`DELETE FROM USER_ROLE WHERE role_id = @id`);
            await pool.request().input('id', sql.VarChar(50), id).query(`DELETE FROM ROLE_PERMISSION WHERE role_id = @id`);
            const r = await pool.request().input('id', sql.VarChar(50), id).query(`DELETE FROM [ROLE] WHERE role_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            _invalidateAll();
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ═══════════════════════════════════════════════════════════
    // 4. PERMISSION CRUD
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/permissions', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`
                SELECT permission_id, code, description, group_code, is_system, sort_order,
                       subgroup_key, subgroup_label, subgroup_order, subgroup_tone
                FROM [PERMISSION]
                ORDER BY sort_order, group_code, subgroup_order, code
            `);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/permissions', async (req, res) => {
        try {
            const { permission_id, code, description, group_code, sort_order, subgroup_key, subgroup_label, subgroup_order, subgroup_tone } = req.body;
            if (!permission_id || !code) return res.status(400).json({ error: 'Thiếu permission_id/code' });
            const pool = await getPool();
            const tone = ['read', 'write', 'security', 'danger'].includes(subgroup_tone) ? subgroup_tone : 'read';
            const finalKey = subgroup_key?.trim() || `${(group_code || 'system').toLowerCase()}-custom`;
            const finalLabel = subgroup_label?.trim() || 'Tùy chỉnh';
            const finalOrder = typeof subgroup_order === 'number' ? subgroup_order : 50;

            await pool.request()
                .input('id', sql.VarChar(50), permission_id)
                .input('c', sql.VarChar(50), code)
                .input('d', sql.NVarChar(200), description || null)
                .input('g', sql.VarChar(30), group_code || 'SYSTEM')
                .input('so', sql.Int, sort_order || 0)
                .input('sk', sql.VarChar(30), finalKey)
                .input('sl', sql.NVarChar(50), finalLabel)
                .input('sor', sql.Int, finalOrder)
                .input('st', sql.VarChar(20), tone)
                .query(`INSERT INTO [PERMISSION] (permission_id, code, description, group_code, sort_order, subgroup_key, subgroup_label, subgroup_order, subgroup_tone)
                        VALUES (@id, @c, @d, @g, @so, @sk, @sl, @sor, @st)`);
            _invalidateAll();
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('PRIMARY KEY') || e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Trùng id hoặc code' });
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/admin/permissions/reorder', async (req, res) => {
        try {
            const { items } = req.body;
            if (!Array.isArray(items)) {
                return res.status(400).json({ error: 'items phải là một mảng danh sách quyền và sort_order' });
            }
            const pool = await getPool();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                for (const it of items) {
                    if (it.permission_id && typeof it.sort_order === 'number') {
                        await new sql.Request(transaction)
                            .input('id', sql.VarChar(50), it.permission_id)
                            .input('so', sql.Int, it.sort_order)
                            .query(`UPDATE [PERMISSION] SET sort_order = @so WHERE permission_id = @id`);
                    }
                }
                await transaction.commit();
                _invalidateAll();

                if (typeof writeAccessLog === 'function') {
                    writeAccessLog({
                        user_id: req.user?.user_id,
                        action: 'PERMISSION_REORDER',
                        resource: 'PERMISSION',
                        details: `Sắp xếp lại thứ tự cho ${items.length} quyền`,
                        severity: 'Info',
                        ip: req.ip,
                    }).catch(() => {});
                }

                res.json({ success: true, updated: items.length });
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (e) {
            console.error('[PUT /api/admin/permissions/reorder]', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/admin/permissions/:id', async (req, res) => {
        try {
            const { description, group_code, sort_order, subgroup_key, subgroup_label, subgroup_order, subgroup_tone } = req.body;
            const pool = await getPool();
            const r = await pool.request()
                .input('id', sql.VarChar(50), req.params.id)
                .input('d', sql.NVarChar(200), description || null)
                .input('g', sql.VarChar(30), group_code || 'SYSTEM')
                .input('so', sql.Int, sort_order || 0)
                .input('sk', sql.VarChar(30), subgroup_key || null)
                .input('sl', sql.NVarChar(50), subgroup_label || null)
                .input('sor', sql.Int, subgroup_order ?? 50)
                .input('st', sql.VarChar(20), ['read', 'write', 'security', 'danger'].includes(subgroup_tone) ? subgroup_tone : 'read')
                .query(`UPDATE [PERMISSION] SET description = @d, group_code = @g, sort_order = @so, subgroup_key = @sk, subgroup_label = @sl, subgroup_order = @sor, subgroup_tone = @st WHERE permission_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            _invalidateAll();
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/permissions/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const id = req.params.id;
            const chk = await pool.request().input('id', sql.VarChar(50), id).query(`SELECT is_system FROM [PERMISSION] WHERE permission_id = @id`);
            if (chk.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            if (chk.recordset[0].is_system) {
                return res.status(403).json({ error: 'Không thể xóa quyền hệ thống (is_system=1)' });
            }
            await pool.request().input('id', sql.VarChar(50), id).query(`DELETE FROM ROLE_PERMISSION WHERE permission_id = @id`);
            await pool.request().input('id', sql.VarChar(50), id).query(`DELETE FROM USER_PERMISSION WHERE permission_id = @id`);
            await pool.request().input('id', sql.VarChar(50), id).query(`DELETE FROM [PERMISSION] WHERE permission_id = @id`);
            _invalidateAll();
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ═══════════════════════════════════════════════════════════
    // 5. ROLE_PERMISSION — assign / revoke
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/roles/:id/permissions', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request()
                .input('r', sql.VarChar(50), req.params.id)
                .query(`SELECT p.permission_id, p.code, p.description FROM ROLE_PERMISSION rp JOIN [PERMISSION] p ON p.permission_id = rp.permission_id WHERE rp.role_id = @r`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/roles/:id/permissions', async (req, res) => {
        try {
            const { permission_id } = req.body;
            const pool = await getPool();
            await pool.request()
                .input('r', sql.VarChar(50), req.params.id)
                .input('p', sql.VarChar(50), permission_id)
                .query(`INSERT INTO ROLE_PERMISSION (role_id, permission_id) VALUES (@r, @p)`);
            const users = await pool.request().input('r', sql.VarChar(50), req.params.id).query(`SELECT user_id FROM USER_ROLE WHERE role_id = @r`);
            users.recordset.forEach((row) => _invalidateUser(row.user_id));
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('PRIMARY KEY')) return res.status(409).json({ error: 'Đã có quyền này' });
            res.status(500).json({ error: e.message });
        }
    });

    app.delete('/api/admin/roles/:id/permissions/:permId', async (req, res) => {
        try {
            const pool = await getPool();
            await pool.request()
                .input('r', sql.VarChar(50), req.params.id)
                .input('p', sql.VarChar(50), req.params.permId)
                .query(`DELETE FROM ROLE_PERMISSION WHERE role_id=@r AND permission_id=@p`);
            const users = await pool.request().input('r', sql.VarChar(50), req.params.id).query(`SELECT user_id FROM USER_ROLE WHERE role_id = @r`);
            users.recordset.forEach((row) => _invalidateUser(row.user_id));
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ═══════════════════════════════════════════════════════════
    // 6. UNIT CRUD
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/units', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`SELECT u.unit_id, u.name, u.parent_id, p.name AS parent_name FROM UNIT u LEFT JOIN UNIT p ON p.unit_id = u.parent_id ORDER BY u.name`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/units', async (req, res) => {
        try {
            const { unit_id, name, parent_id } = req.body;
            if (!unit_id || !name) return res.status(400).json({ error: 'Thiếu unit_id/name' });
            const pool = await getPool();
            await pool.request()
                .input('id', sql.VarChar(50), unit_id)
                .input('n', sql.NVarChar(200), name)
                .input('p', sql.VarChar(50), parent_id || null)
                .query(`INSERT INTO UNIT (unit_id, name, parent_id) VALUES (@id, @n, @p)`);
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('PRIMARY KEY') || e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Trùng unit_id hoặc tên' });
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/admin/units/:id', async (req, res) => {
        try {
            const { name, parent_id } = req.body;
            const pool = await getPool();
            const r = await pool.request()
                .input('id', sql.VarChar(50), req.params.id)
                .input('n', sql.NVarChar(200), name)
                .input('p', sql.VarChar(50), parent_id || null)
                .query(`UPDATE UNIT SET name=@n, parent_id=@p WHERE unit_id=@id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/units/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().input('id', sql.VarChar(50), req.params.id).query(`DELETE FROM UNIT WHERE unit_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('REFERENCE')) return res.status(409).json({ error: 'Đang có user/tài liệu dùng đơn vị này' });
            res.status(500).json({ error: e.message });
        }
    });

    // ═══════════════════════════════════════════════════════════
    // 7. DOCUMENT_TYPE CRUD
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/document-types', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`SELECT type_id, name, description FROM DOCUMENT_TYPE ORDER BY name`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/document-types', async (req, res) => {
        try {
            const { type_id, name, description } = req.body;
            if (!type_id || !name) return res.status(400).json({ error: 'Thiếu type_id/name' });
            const pool = await getPool();
            await pool.request()
                .input('id', sql.VarChar(20), type_id)
                .input('n', sql.NVarChar(100), name)
                .input('d', sql.NVarChar(200), description || null)
                .query(`INSERT INTO DOCUMENT_TYPE (type_id, name, description) VALUES (@id, @n, @d)`);
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('PRIMARY KEY')) return res.status(409).json({ error: 'type_id đã tồn tại' });
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/admin/document-types/:id', async (req, res) => {
        try {
            const { name, description } = req.body;
            const pool = await getPool();
            const r = await pool.request()
                .input('id', sql.VarChar(20), req.params.id)
                .input('n', sql.NVarChar(100), name)
                .input('d', sql.NVarChar(200), description || null)
                .query(`UPDATE DOCUMENT_TYPE SET name=@n, description=@d WHERE type_id=@id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/document-types/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().input('id', sql.VarChar(20), req.params.id).query(`DELETE FROM DOCUMENT_TYPE WHERE type_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('REFERENCE')) return res.status(409).json({ error: 'Đang có tài liệu dùng loại này' });
            res.status(500).json({ error: e.message });
        }
    });

    // ═══════════════════════════════════════════════════════════
    // 8. SECURITY_LEVEL CRUD
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/security-levels', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`SELECT level_id, code, name FROM SECURITY_LEVEL ORDER BY level_id`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/security-levels', async (req, res) => {
        try {
            const { level_id, code, name } = req.body;
            if (!level_id || !code || !name) return res.status(400).json({ error: 'Thiếu dữ liệu' });
            const pool = await getPool();
            await pool.request()
                .input('id', sql.Int, parseInt(level_id, 10))
                .input('c', sql.VarChar(30), code)
                .input('n', sql.NVarChar(50), name)
                .query(`INSERT INTO SECURITY_LEVEL (level_id, code, name) VALUES (@id, @c, @n)`);
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('PRIMARY KEY') || e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Trùng level_id hoặc code' });
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/admin/security-levels/:id', async (req, res) => {
        try {
            const { code, name } = req.body;
            const pool = await getPool();
            const r = await pool.request()
                .input('id', sql.Int, parseInt(req.params.id, 10))
                .input('c', sql.VarChar(30), code)
                .input('n', sql.NVarChar(50), name)
                .query(`UPDATE SECURITY_LEVEL SET code=@c, name=@n WHERE level_id=@id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/security-levels/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query(`DELETE FROM SECURITY_LEVEL WHERE level_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('REFERENCE')) return res.status(409).json({ error: 'Đang có user/tài liệu dùng mức này' });
            res.status(500).json({ error: e.message });
        }
    });

    // ═══════════════════════════════════════════════════════════
    // 10. MILITARY_RANK CRUD
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/ranks', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`SELECT rank_id, name, sort_order, active, created_at FROM MILITARY_RANK ORDER BY sort_order, name`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/ranks', async (req, res) => {
        try {
            let { rank_id, name, sort_order } = req.body;
            const pool = await getPool();
            if (!rank_id || !rank_id.trim()) {
                const allRanks = await pool.request().query('SELECT rank_id FROM MILITARY_RANK');
                const existingNums = new Set();
                for (const r of allRanks.recordset) {
                    const m = (r.rank_id || '').match(/R-(\d+)/i);
                    if (m) { const n = parseInt(m[1], 10); if (!isNaN(n) && n > 0) existingNums.add(n); }
                }
                let candidate = 1;
                while (existingNums.has(candidate)) candidate++;
                rank_id = `R-${String(candidate).padStart(2, '0')}`;
            }
            if (!name || !name.trim()) return res.status(400).json({ error: 'Thiếu tên cấp bậc' });
            await pool.request()
                .input('id', sql.VarChar(20), rank_id)
                .input('n', sql.NVarChar(100), name.trim())
                .input('sort', sql.Int, sort_order || 0)
                .query(`INSERT INTO MILITARY_RANK (rank_id, name, sort_order) VALUES (@id, @n, @sort)`);
            await log(req, 'CREATE_RANK', `Tạo cấp bậc ${rank_id} - ${name}`);
            res.json({ success: true, rank_id });
        } catch (e) {
            if (e.message.includes('PRIMARY KEY')) return res.status(409).json({ error: 'rank_id đã tồn tại' });
            if (e.message.includes('UQ_MRANK_NAME')) return res.status(409).json({ error: 'Tên cấp bậc đã tồn tại' });
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/admin/ranks/:id', async (req, res) => {
        try {
            const { name, sort_order, active } = req.body;
            const pool = await getPool();
            const r = await pool.request()
                .input('id', sql.VarChar(20), req.params.id)
                .input('n', sql.NVarChar(100), name)
                .input('sort', sql.Int, sort_order || 0)
                .input('act', sql.Bit, active === false ? 0 : 1)
                .query(`UPDATE MILITARY_RANK SET name = @n, sort_order = @sort, active = @act WHERE rank_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy cấp bậc' });
            await log(req, 'UPDATE_RANK', `Sửa cấp bậc ${req.params.id}`);
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('UQ_MRANK_NAME')) return res.status(409).json({ error: 'Tên cấp bậc đã tồn tại' });
            res.status(500).json({ error: e.message });
        }
    });

    app.delete('/api/admin/ranks/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const rankRow = await pool.request().input('id', sql.VarChar(20), req.params.id).query(`SELECT name FROM MILITARY_RANK WHERE rank_id = @id`);
            if (rankRow.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy cấp bậc' });
            const rankName = rankRow.recordset[0].name;
            const used = await pool.request().input('n', sql.NVarChar(100), rankName).query(`SELECT COUNT(*) AS n FROM [USER] WHERE [rank] = @n`);
            if (used.recordset[0].n > 0) {
                await pool.request().input('id', sql.VarChar(20), req.params.id).query(`UPDATE MILITARY_RANK SET active = 0 WHERE rank_id = @id`);
                return res.json({ success: true, soft_deleted: true, note: `${used.recordset[0].n} user đang dùng → chỉ ẩn khỏi dropdown` });
            }
            await pool.request().input('id', sql.VarChar(20), req.params.id).query(`DELETE FROM MILITARY_RANK WHERE rank_id = @id`);
            await log(req, 'DELETE_RANK', `Xóa cấp bậc ${req.params.id}`);
            res.json({ success: true, soft_deleted: false });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ═══════════════════════════════════════════════════════════
    // 11. MILITARY_POSITION CRUD
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/positions', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`SELECT position_id, name, sort_order, active, created_at FROM MILITARY_POSITION ORDER BY sort_order, name`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/positions', async (req, res) => {
        try {
            let { position_id, name, sort_order } = req.body;
            const pool = await getPool();
            if (!position_id || !position_id.trim()) {
                const allPos = await pool.request().query('SELECT position_id FROM MILITARY_POSITION');
                const existingNums = new Set();
                for (const r of allPos.recordset) {
                    const m = (r.position_id || '').match(/P-(\d+)/i);
                    if (m) { const n = parseInt(m[1], 10); if (!isNaN(n) && n > 0) existingNums.add(n); }
                }
                let candidate = 1;
                while (existingNums.has(candidate)) candidate++;
                position_id = `P-${String(candidate).padStart(2, '0')}`;
            }
            if (!name || !name.trim()) return res.status(400).json({ error: 'Thiếu tên chức vụ' });
            await pool.request()
                .input('id', sql.VarChar(20), position_id)
                .input('n', sql.NVarChar(100), name.trim())
                .input('sort', sql.Int, sort_order || 0)
                .query(`INSERT INTO MILITARY_POSITION (position_id, name, sort_order) VALUES (@id, @n, @sort)`);
            await log(req, 'CREATE_POSITION', `Tạo chức vụ ${position_id} - ${name}`);
            res.json({ success: true, position_id });
        } catch (e) {
            if (e.message.includes('PRIMARY KEY')) return res.status(409).json({ error: 'position_id đã tồn tại' });
            if (e.message.includes('UQ_MPOS_NAME')) return res.status(409).json({ error: 'Tên chức vụ đã tồn tại' });
            res.status(500).json({ error: e.message });
        }
    });

    app.put('/api/admin/positions/:id', async (req, res) => {
        try {
            const { name, sort_order, active } = req.body;
            const pool = await getPool();
            const r = await pool.request()
                .input('id', sql.VarChar(20), req.params.id)
                .input('n', sql.NVarChar(100), name)
                .input('sort', sql.Int, sort_order || 0)
                .input('act', sql.Bit, active === false ? 0 : 1)
                .query(`UPDATE MILITARY_POSITION SET name = @n, sort_order = @sort, active = @act WHERE position_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy chức vụ' });
            await log(req, 'UPDATE_POSITION', `Sửa chức vụ ${req.params.id}`);
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('UQ_MPOS_NAME')) return res.status(409).json({ error: 'Tên chức vụ đã tồn tại' });
            res.status(500).json({ error: e.message });
        }
    });

    app.delete('/api/admin/positions/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const row = await pool.request().input('id', sql.VarChar(20), req.params.id).query(`SELECT name FROM MILITARY_POSITION WHERE position_id = @id`);
            if (row.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy chức vụ' });
            const posName = row.recordset[0].name;
            const used = await pool.request().input('n', sql.NVarChar(100), posName).query(`SELECT COUNT(*) AS n FROM [USER] WHERE [position] = @n`);
            if (used.recordset[0].n > 0) {
                await pool.request().input('id', sql.VarChar(20), req.params.id).query(`UPDATE MILITARY_POSITION SET active = 0 WHERE position_id = @id`);
                return res.json({ success: true, soft_deleted: true, note: `${used.recordset[0].n} user đang dùng → chỉ ẩn khỏi dropdown` });
            }
            await pool.request().input('id', sql.VarChar(20), req.params.id).query(`DELETE FROM MILITARY_POSITION WHERE position_id = @id`);
            await log(req, 'DELETE_POSITION', `Xóa chức vụ ${req.params.id}`);
            res.json({ success: true, soft_deleted: false });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ═══════════════════════════════════════════════════════════
    // 12. MỞ KHÓA TÀI KHOẢN
    // ═══════════════════════════════════════════════════════════
    app.post('/api/admin/users/:id/unlock', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request()
                .input('uid', sql.VarChar(50), req.params.id)
                .query(`UPDATE [USER] SET status = 'active', failed_attempts = 0, locked_at = NULL, last_failed_at = NULL WHERE user_id = @uid`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy user' });
            await log(req, 'UNLOCK_USER', `Mở khóa tài khoản ${req.params.id}`);
            res.json({ success: true, user_id: req.params.id });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ═══════════════════════════════════════════════════════════
    // 13. IP BLOCKLIST
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/ip-blocklist', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`SELECT ip, blocked_until, reason, blocked_at FROM IP_BLOCKLIST WHERE blocked_until > GETDATE() ORDER BY blocked_at DESC`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/ip-blocklist/:ip', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().input('ip', sql.VarChar(50), req.params.ip).query(`DELETE FROM IP_BLOCKLIST WHERE ip = @ip`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'IP không tồn tại trong blocklist' });
            await log(req, 'UNBLOCK_IP', `Gỡ chặn IP ${req.params.ip}`);
            res.json({ success: true, ip: req.params.ip });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ═══════════════════════════════════════════════════════════
    // 14. LOGIN_ATTEMPT
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/login-attempts', async (req, res) => {
        try {
            const pool = await getPool();
            const r = pool.request();
            let query = `SELECT TOP 200 attempt_id, ip, username, result, attempted_at FROM LOGIN_ATTEMPT WHERE 1=1`;
            if (req.query.ip) { query += ` AND ip = @ip`; r.input('ip', sql.VarChar(50), req.query.ip); }
            if (req.query.result) { query += ` AND result = @result`; r.input('result', sql.VarChar(30), req.query.result); }
            query += ` ORDER BY attempted_at DESC`;
            const result = await r.query(query);
            res.json({ items: result.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ═══════════════════════════════════════════════════════════
    // 15. UNIT_ALIAS CRUD
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/unit-aliases', async (req, res) => {
        try {
            const pool = await getPool();
            const r = pool.request();
            let query = `SELECT ua.alias_id, ua.unit_id, u.name AS unit_name, ua.alias_text, ua.priority, ua.created_at FROM UNIT_ALIAS ua JOIN UNIT u ON u.unit_id = ua.unit_id WHERE 1=1`;
            if (req.query.unit_id) { query += ` AND ua.unit_id = @uid`; r.input('uid', sql.VarChar(50), req.query.unit_id); }
            query += ` ORDER BY ua.unit_id, ua.priority DESC, ua.alias_text`;
            const result = await r.query(query);
            res.json({ items: result.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/unit-aliases', async (req, res) => {
        try {
            const { unit_id, alias_text, priority } = req.body;
            if (!unit_id || !alias_text) return res.status(400).json({ error: 'Thiếu unit_id hoặc alias_text' });
            const pool = await getPool();
            const chk = await pool.request().input('uid', sql.VarChar(50), unit_id).query(`SELECT 1 FROM UNIT WHERE unit_id = @uid`);
            if (chk.recordset.length === 0) return res.status(404).json({ error: 'Đơn vị không tồn tại' });
            const dup = await pool.request()
                .input('uid', sql.VarChar(50), unit_id)
                .input('a', sql.NVarChar(200), alias_text.trim())
                .query(`SELECT 1 FROM UNIT_ALIAS WHERE unit_id = @uid AND alias_text = @a`);
            if (dup.recordset.length > 0) return res.status(409).json({ error: 'Alias này đã có cho đơn vị' });
            const r = await pool.request()
                .input('uid', sql.VarChar(50), unit_id)
                .input('a', sql.NVarChar(200), alias_text.trim())
                .input('p', sql.Int, priority || 0)
                .query(`INSERT INTO UNIT_ALIAS (unit_id, alias_text, priority) OUTPUT INSERTED.alias_id VALUES (@uid, @a, @p)`);
            await log(req, 'CREATE_UNIT_ALIAS', `Thêm alias "${alias_text}" cho ${unit_id}`); if (invalidateCatalogCache) invalidateCatalogCache();
            res.json({ success: true, alias_id: r.recordset[0].alias_id });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.put('/api/admin/unit-aliases/:id', async (req, res) => {
        try {
            const { alias_text, priority } = req.body;
            if (!alias_text) return res.status(400).json({ error: 'Thiếu alias_text' });
            const pool = await getPool();
            const r = await pool.request()
                .input('id', sql.Int, parseInt(req.params.id, 10))
                .input('a', sql.NVarChar(200), alias_text.trim())
                .input('p', sql.Int, priority || 0)
                .query(`UPDATE UNIT_ALIAS SET alias_text = @a, priority = @p WHERE alias_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy alias' });
            await log(req, 'UPDATE_UNIT_ALIAS', `Sửa alias #${req.params.id}`);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/unit-aliases/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().input('id', sql.Int, parseInt(req.params.id, 10)).query(`DELETE FROM UNIT_ALIAS WHERE alias_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy alias' });
            await log(req, 'DELETE_UNIT_ALIAS', `Xóa alias #${req.params.id}`); if (invalidateCatalogCache) invalidateCatalogCache();
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ═══════════════════════════════════════════════════════════
    // 16. SESSION MANAGEMENT
    // ═══════════════════════════════════════════════════════════
    app.get('/api/admin/sessions', async (req, res) => {
        try {
            if (typeof listActiveSessions !== 'function') {
                return res.status(500).json({ error: 'Session module chưa được wire vào admin-routes', code: 'SESSION_MODULE_NOT_WIRED' });
            }
            const userId = req.query.user_id || null;
            const items = await listActiveSessions(userId, sessionIdleTimeoutMinutes);
            res.json({
                items,
                total: items.length,
                idle_timeout_minutes: sessionIdleTimeoutMinutes,
            });
        } catch (e) {
            console.error('[GET /api/admin/sessions]', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.delete('/api/admin/sessions/:sessionId', async (req, res) => {
        try {
            if (typeof killSessionById !== 'function') {
                return res.status(500).json({ error: 'Session module chưa được wire', code: 'SESSION_MODULE_NOT_WIRED' });
            }
            const killedCount = await killSessionById(req.params.sessionId, req.user.user_id, 'ADMIN_KILL');
            await log(req, 'KILL_SESSION', `Kill session ${req.params.sessionId} (${killedCount} dòng)`);
            res.json({ success: true, killed_count: killedCount, session_id: req.params.sessionId });
        } catch (e) {
            console.error('[DELETE /api/admin/sessions/:id]', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.delete('/api/admin/sessions/user/:userId', async (req, res) => {
        try {
            if (typeof revokeAllUserSessions !== 'function') {
                return res.status(500).json({ error: 'Session module chưa được wire', code: 'SESSION_MODULE_NOT_WIRED' });
            }
            const revokedCount = await revokeAllUserSessions(req.params.userId, req.user.user_id, 'ADMIN_KILL_ALL');
            await log(req, 'KILL_ALL_SESSIONS', `Kill ${revokedCount} session của ${req.params.userId}`);
            res.json({ success: true, revoked_count: revokedCount, user_id: req.params.userId });
        } catch (e) {
            console.error('[DELETE /api/admin/sessions/user/:id]', e);
            res.status(500).json({ error: e.message });
        }
    });

        // ═══════════════════════════════════════════════════════════
    // APPROVAL WORKFLOW — Endpoints
    // ═══════════════════════════════════════════════════════════
    const requireProtectedAdmin = (req, res, next) => {
        if (!isProtectedAdmin(req.user)) {
            return res.status(403).json({
                error: 'Chỉ Quản trị viên tối cao mới được phê duyệt',
                code: 'PROTECTED_ADMIN_ONLY',
            });
        }
        next();
    };

    app.get('/api/admin/approval-requests', async (req, res) => {
        try {
            const status = (req.query.status || 'PENDING').toUpperCase();
            const pool = await getPool();
            const request = pool.request();
            let query = `
                SELECT ar.*, u.full_name AS requester_name, u.[rank] AS requester_rank,
                       rv.full_name AS reviewer_name
                FROM APPROVAL_REQUEST ar
                LEFT JOIN [USER] u ON u.user_id = ar.requester_id
                LEFT JOIN [USER] rv ON rv.user_id = ar.reviewed_by
            `;
            if (status !== 'ALL') {
                request.input('s', sql.VarChar(20), status);
                query += ` WHERE ar.status = @s`;
            }
            query += ` ORDER BY ar.created_at DESC`;
            const r = await request.query(query);
            res.json({ total: r.recordset.length, items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/admin/approval-requests/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request()
                .input('rid', sql.VarChar(50), req.params.id)
                .query(`SELECT ar.*, u.full_name AS requester_name FROM APPROVAL_REQUEST ar
                        LEFT JOIN [USER] u ON u.user_id = ar.requester_id
                        WHERE ar.request_id = @rid`);
            if (r.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json(r.recordset[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/approval-requests/:id/approve', requireProtectedAdmin, async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request()
                .input('rid', sql.VarChar(50), req.params.id)
                .input('by', sql.VarChar(50), req.user.user_id)
                .input('note', sql.NVarChar(500), req.body?.review_note || null)
                .query(`UPDATE APPROVAL_REQUEST SET status='APPROVED', reviewed_by=@by,
                        reviewed_at=GETDATE(), review_note=@note
                        WHERE request_id=@rid AND status='PENDING';
                        SELECT @@ROWCOUNT AS n;`);
            if (r.recordset[0].n === 0) return res.status(400).json({ error: 'Yêu cầu không ở trạng thái PENDING' });
            await log(req, 'APPROVAL_APPROVED', `Duyệt yêu cầu ${req.params.id}`);
            res.json({ success: true, request_id: req.params.id });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/approval-requests/:id/reject', requireProtectedAdmin, async (req, res) => {
        try {
            const note = req.body?.review_note;
            if (!note || !note.trim()) return res.status(400).json({ error: 'Cần ghi lý do từ chối' });
            const pool = await getPool();
            const r = await pool.request()
                .input('rid', sql.VarChar(50), req.params.id)
                .input('by', sql.VarChar(50), req.user.user_id)
                .input('note', sql.NVarChar(500), note.trim())
                .query(`UPDATE APPROVAL_REQUEST SET status='REJECTED', reviewed_by=@by,
                        reviewed_at=GETDATE(), review_note=@note
                        WHERE request_id=@rid AND status='PENDING';
                        SELECT @@ROWCOUNT AS n;`);
            if (r.recordset[0].n === 0) return res.status(400).json({ error: 'Yêu cầu không ở trạng thái PENDING' });
            await log(req, 'APPROVAL_REJECTED', `Từ chối ${req.params.id} — ${note}`);
            res.json({ success: true, request_id: req.params.id });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/approval-requests/:id/mark-executed', requireProtectedAdmin, async (req, res) => {
        try {
            const pool = await getPool();
            await pool.request()
                .input('rid', sql.VarChar(50), req.params.id)
                .query(`UPDATE APPROVAL_REQUEST SET status='EXECUTED' 
                        WHERE request_id=@rid AND status IN ('EXECUTING','APPROVED')`);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ─── Cấu hình PROTECTED_PERMISSION ───
    app.get('/api/admin/protected-permissions', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`SELECT permission_id, protected_by, protected_at, note FROM PROTECTED_PERMISSION`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/protected-permissions/:permissionId', requireProtectedAdmin, async (req, res) => {
        try {
            const pool = await getPool();
            await pool.request()
                .input('pid', sql.VarChar(50), req.params.permissionId)
                .input('by', sql.VarChar(50), req.user.user_id)
                .input('note', sql.NVarChar(255), req.body?.note || null)
                .query(`
                    MERGE PROTECTED_PERMISSION AS t
                    USING (SELECT @pid AS permission_id) AS s ON t.permission_id = s.permission_id
                    WHEN MATCHED THEN UPDATE SET protected_by=@by, protected_at=GETDATE(), note=@note
                    WHEN NOT MATCHED THEN INSERT (permission_id, protected_by, note) VALUES (@pid, @by, @note);
                `);
            await loadProtectedPermissions(true);
            await log(req, 'PROTECT_PERMISSION', `Bật bảo vệ ${req.params.permissionId}`);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/protected-permissions/:permissionId', requireProtectedAdmin, async (req, res) => {
        try {
            const pool = await getPool();
            await pool.request()
                .input('pid', sql.VarChar(50), req.params.permissionId)
                .query(`DELETE FROM PROTECTED_PERMISSION WHERE permission_id=@pid`);
            await loadProtectedPermissions(true);
            await log(req, 'UNPROTECT_PERMISSION', `Tắt bảo vệ ${req.params.permissionId}`);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

};