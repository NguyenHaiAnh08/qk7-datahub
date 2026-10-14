// src/admin-routes.js
const bcrypt = require('bcryptjs');
// Cung cấp API CRUD cho toàn bộ bảng danh mục + user + role + permission
module.exports = function (app, deps) {
    const { sql, getPool, writeAccessLog } = deps;

    // Middleware: yêu cầu clearance >= 4 (Tối mật / Tuyệt mật)
    const requireAdmin = (req, res, next) => {
        if ((req.user?.clearance_level_id || 0) < 4) {
            return res.status(403).json({ error: 'Cần quyền quản trị (mức 4+)' });
        }
        next();
    };
    app.use('/api/admin', requireAdmin);

    const log = (req, action, note) => writeAccessLog({
        userId: req.user.user_id, fileId: null,
        action, ip: req.ip || '', note
    });

    // ============================================================
    // 0. THỐNG KÊ DASHBOARD
    // ============================================================
    app.get('/api/admin/stats', async (req, res) => {
        try {
            const pool = await getPool();
            const [u, d, byLv, byType, byUnit, logs24] = await Promise.all([
                pool.request().query(`SELECT COUNT(*) AS n FROM [USER]`),
                pool.request().query(`SELECT COUNT(*) AS n, ISNULL(SUM(file_size),0) AS size FROM DOCUMENT`),
                pool.request().query(`SELECT sl.level_id AS lv, sl.name AS lvName, COUNT(d.file_id) AS n
                                      FROM SECURITY_LEVEL sl
                                      LEFT JOIN DOCUMENT d ON d.security_level_id = sl.level_id
                                      GROUP BY sl.level_id, sl.name ORDER BY sl.level_id`),
                pool.request().query(`SELECT dt.type_id AS id, dt.name, COUNT(d.file_id) AS n
                                      FROM DOCUMENT_TYPE dt
                                      LEFT JOIN DOCUMENT d ON d.doc_type_id = dt.type_id
                                      GROUP BY dt.type_id, dt.name ORDER BY n DESC`),
                pool.request().query(`SELECT u.unit_id AS id, u.name, COUNT(d.file_id) AS n
                                      FROM UNIT u
                                      LEFT JOIN DOCUMENT d ON d.issuing_unit_id = u.unit_id
                                      GROUP BY u.unit_id, u.name ORDER BY n DESC`),
                pool.request().query(`SELECT COUNT(*) AS n FROM ACCESS_LOG
                                      WHERE [timestamp] >= DATEADD(day,-1,GETDATE())`)
            ]);
            res.json({
                users: u.recordset[0].n,
                documents: d.recordset[0].n,
                totalSize: Number(d.recordset[0].size) || 0,
                byLevel: byLv.recordset,
                byType:  byType.recordset,
                byUnit:  byUnit.recordset,
                logs24h: logs24.recordset[0].n
            });
        } catch (e) {
            console.error('[GET /api/admin/stats]', e);
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 1. USER CRUD
    // ============================================================
    app.get('/api/admin/users', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`
                SELECT u.user_id, u.full_name, u.[rank] AS rank_name, u.[position],
                       u.unit_id, un.name AS unit_name,
                       u.status, u.clearance_level_id,
                       sl.name AS clearance_name, sl.code AS clearance_code
                FROM [USER] u
                LEFT JOIN UNIT un          ON un.unit_id = u.unit_id
                LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = u.clearance_level_id
                ORDER BY u.user_id
            `);
            res.json({ total: r.recordset.length, items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============================================================
// TẠO USER — có username + password
// ============================================================
// Admin nhập plaintext password, backend hash bcrypt rồi lưu.
// Password KHÔNG lưu plaintext vào DB, không log, không trả lại.
// ============================================================
app.post('/api/admin/users', async (req, res) => {
    try {
        const {
            user_id, username, password, full_name,
            rank_name, position, unit_id, status, clearance_level_id
        } = req.body;

        // Validate
        if (!user_id || !full_name) {
            return res.status(400).json({ error: 'Thiếu user_id hoặc full_name' });
        }
        if (!username || !username.trim()) {
            return res.status(400).json({ error: 'Thiếu username' });
        }
        if (!password || password.length < 8) {
            return res.status(400).json({ error: 'Mật khẩu cần ít nhất 8 ký tự' });
        }
        if (!clearance_level_id) {
            return res.status(400).json({ error: 'Thiếu mức bảo mật' });
        }

        // Hash password bằng bcrypt (10 rounds)
        const passwordHash = await bcrypt.hash(password, 10);

        const pool = await getPool();
        await pool.request()
            .input('user_id',            sql.VarChar(50),   user_id.trim())
            .input('username',           sql.VarChar(50),   username.trim().toLowerCase())
            .input('full_name',          sql.NVarChar(100), full_name)
            .input('rank',               sql.NVarChar(50),  rank_name || null)
            .input('position',           sql.NVarChar(100), position || null)
            .input('unit_id',            sql.VarChar(50),   unit_id || null)
            .input('status',             sql.VarChar(20),   status || 'active')
            .input('clearance_level_id', sql.Int,           parseInt(clearance_level_id, 10))
            .input('password_hash',      sql.VarChar(255),  passwordHash)
            .query(`
                INSERT INTO [USER]
                  (user_id, username, full_name, [rank], [position], unit_id,
                   status, clearance_level_id, password_hash)
                VALUES
                  (@user_id, @username, @full_name, @rank, @position, @unit_id,
                   @status, @clearance_level_id, @password_hash)
            `);

        await log(req, 'CREATE_USER', `Tạo user ${user_id} (${username})`);

        res.json({
            success: true,
            user_id: user_id.trim(),
            username: username.trim().toLowerCase(),
            note: 'Tài khoản đã tạo. Ghi lại mật khẩu và gửi cho user.'
        });

    } catch (e) {
        if (e.message.includes('PRIMARY KEY')) {
            return res.status(409).json({ error: 'user_id đã tồn tại' });
        }
        if (e.message.includes('UQ_USER_USERNAME') || e.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Username đã tồn tại' });
        }
        console.error('[POST /api/admin/users]', e);
        res.status(500).json({ error: e.message });
    }
});
    app.put('/api/admin/users/:id', async (req, res) => {
        try {
            const { full_name, rank_name, position, unit_id, status, clearance_level_id } = req.body;
            const pool = await getPool();
            const r = await pool.request()
                .input('user_id', sql.VarChar(50), req.params.id)
                .input('full_name', sql.NVarChar(100), full_name)
                .input('rank', sql.NVarChar(50), rank_name || null)
                .input('position', sql.NVarChar(100), position || null)
                .input('unit_id', sql.VarChar(50), unit_id || null)
                .input('status', sql.VarChar(20), status || 'active')
                .input('clearance_level_id', sql.Int, parseInt(clearance_level_id, 10))
                .query(`UPDATE [USER] SET full_name=@full_name, [rank]=@rank, [position]=@position,
                        unit_id=@unit_id, status=@status, clearance_level_id=@clearance_level_id
                        WHERE user_id=@user_id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy user' });
            await log(req, 'UPDATE_USER', `Sửa user ${req.params.id}`);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/users/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const uid = req.params.id;
            await pool.request().input('u', sql.VarChar(50), uid)
                .query(`DELETE FROM USER_ROLE WHERE user_id = @u`);
            const r = await pool.request().input('u', sql.VarChar(50), uid)
                .query(`DELETE FROM [USER] WHERE user_id = @u`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy user' });
            await log(req, 'DELETE_USER', `Xóa user ${uid}`);
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('REFERENCE')) {
                return res.status(409).json({ error: 'User đang được dùng trong ACCESS_LOG hoặc DOCUMENT' });
            }
            res.status(500).json({ error: e.message });
        }
    });

        // ============================================================
// CẬP NHẬT TÀI KHOẢN — đổi username và/hoặc password
// ============================================================
// - Nếu password rỗng: chỉ đổi username
// - Nếu có password: hash rồi cập nhật cả 2
// ============================================================
app.put('/api/admin/users/:id/credentials', async (req, res) => {
    try {
        const userId = req.params.id;
        const { username, password } = req.body;

        if (!username || !username.trim()) {
            return res.status(400).json({ error: 'Thiếu username' });
        }

        const pool = await getPool();

        // Kiểm tra user tồn tại
        const chk = await pool.request()
            .input('u', sql.VarChar(50), userId)
            .query(`SELECT user_id FROM [USER] WHERE user_id = @u`);

        if (chk.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy user' });
        }

        const reqUpdate = pool.request()
            .input('u',  sql.VarChar(50), userId)
            .input('un', sql.VarChar(50), username.trim().toLowerCase());

        let query = `UPDATE [USER] SET username = @un`;

        // Nếu có password → hash + thêm
        if (password && password.trim()) {
            if (password.length < 8) {
                return res.status(400).json({ error: 'Mật khẩu cần ít nhất 8 ký tự' });
            }
            const hash = await bcrypt.hash(password, 10);
            reqUpdate.input('ph', sql.VarChar(255), hash);
            query += `, password_hash = @ph`;
        }

        query += ` WHERE user_id = @u`;

        await reqUpdate.query(query);

        await log(req, 'UPDATE_CREDENTIALS',
            `Cập nhật tài khoản ${userId} (username: ${username})`);

        res.json({
            success: true,
            user_id: userId,
            username: username.trim().toLowerCase()
        });

    } catch (e) {
        if (e.message.includes('UQ_USER_USERNAME') || e.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Username đã tồn tại' });
        }
        console.error('[PUT /api/admin/users/:id/credentials]', e);
        res.status(500).json({ error: e.message });
    }
});

    // ============================================================
    // 2. USER_ROLE — assign / revoke
    // ============================================================
    app.get('/api/admin/users/:id/roles', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request()
                .input('u', sql.VarChar(50), req.params.id)
                .query(`SELECT r.role_id, r.name FROM USER_ROLE ur
                        JOIN [ROLE] r ON r.role_id = ur.role_id
                        WHERE ur.user_id = @u`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/users/:id/roles', async (req, res) => {
        try {
            const { role_id } = req.body;
            if (!role_id) return res.status(400).json({ error: 'Thiếu role_id' });
            const pool = await getPool();
            await pool.request()
                .input('u', sql.VarChar(50), req.params.id)
                .input('r', sql.VarChar(50), role_id)
                .query(`INSERT INTO USER_ROLE (user_id, role_id) VALUES (@u, @r)`);
            await log(req, 'ASSIGN_ROLE', `Gán role ${role_id} cho user ${req.params.id}`);
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('PRIMARY KEY')) return res.status(409).json({ error: 'Đã có role này' });
            res.status(500).json({ error: e.message });
        }
    });

    app.delete('/api/admin/users/:id/roles/:roleId', async (req, res) => {
        try {
            const pool = await getPool();
            await pool.request()
                .input('u', sql.VarChar(50), req.params.id)
                .input('r', sql.VarChar(50), req.params.roleId)
                .query(`DELETE FROM USER_ROLE WHERE user_id=@u AND role_id=@r`);
            await log(req, 'REVOKE_ROLE', `Bỏ role ${req.params.roleId} của user ${req.params.id}`);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============================================================
    // 3. ROLE CRUD
    // ============================================================
    app.get('/api/admin/roles', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(`SELECT role_id, name FROM [ROLE] ORDER BY role_id`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/roles', async (req, res) => {
        try {
            const { role_id, name } = req.body;
            if (!role_id || !name) return res.status(400).json({ error: 'Thiếu role_id/name' });
            const pool = await getPool();
            await pool.request()
                .input('id', sql.VarChar(50), role_id)
                .input('n', sql.NVarChar(100), name)
                .query(`INSERT INTO [ROLE] (role_id, name) VALUES (@id, @n)`);
            res.json({ success: true });
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
            await pool.request().input('id', sql.VarChar(50), id)
                .query(`DELETE FROM USER_ROLE WHERE role_id = @id`);
            await pool.request().input('id', sql.VarChar(50), id)
                .query(`DELETE FROM ROLE_PERMISSION WHERE role_id = @id`);
            const r = await pool.request().input('id', sql.VarChar(50), id)
                .query(`DELETE FROM [ROLE] WHERE role_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============================================================
    // 4. PERMISSION CRUD
    // ============================================================
    app.get('/api/admin/permissions', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(
                `SELECT permission_id, code, description FROM [PERMISSION] ORDER BY permission_id`);
            res.json({ items: r.recordset });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/permissions', async (req, res) => {
        try {
            const { permission_id, code, description } = req.body;
            if (!permission_id || !code) return res.status(400).json({ error: 'Thiếu permission_id/code' });
            const pool = await getPool();
            await pool.request()
                .input('id', sql.VarChar(50), permission_id)
                .input('c', sql.VarChar(50), code)
                .input('d', sql.NVarChar(200), description || null)
                .query(`INSERT INTO [PERMISSION] (permission_id, code, description) VALUES (@id, @c, @d)`);
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('PRIMARY KEY') || e.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Trùng id hoặc code' });
            }
            res.status(500).json({ error: e.message });
        }
    });

    app.delete('/api/admin/permissions/:id', async (req, res) => {
        try {
            const pool = await getPool();
            const id = req.params.id;
            await pool.request().input('id', sql.VarChar(50), id)
                .query(`DELETE FROM ROLE_PERMISSION WHERE permission_id = @id`);
            const r = await pool.request().input('id', sql.VarChar(50), id)
                .query(`DELETE FROM [PERMISSION] WHERE permission_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============================================================
    // 5. ROLE_PERMISSION — assign / revoke
    // ============================================================
    app.get('/api/admin/roles/:id/permissions', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request()
                .input('r', sql.VarChar(50), req.params.id)
                .query(`SELECT p.permission_id, p.code, p.description
                        FROM ROLE_PERMISSION rp
                        JOIN [PERMISSION] p ON p.permission_id = rp.permission_id
                        WHERE rp.role_id = @r`);
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
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============================================================
    // 6. UNIT CRUD
    // ============================================================
    app.get('/api/admin/units', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(
                `SELECT u.unit_id, u.name, u.parent_id, p.name AS parent_name
                 FROM UNIT u LEFT JOIN UNIT p ON p.unit_id = u.parent_id
                 ORDER BY u.name`);
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
            if (e.message.includes('PRIMARY KEY') || e.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Trùng unit_id hoặc tên' });
            }
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
            const r = await pool.request().input('id', sql.VarChar(50), req.params.id)
                .query(`DELETE FROM UNIT WHERE unit_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('REFERENCE')) {
                return res.status(409).json({ error: 'Đang có user/tài liệu dùng đơn vị này' });
            }
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 7. DOCUMENT_TYPE CRUD
    // ============================================================
    app.get('/api/admin/document-types', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(
                `SELECT type_id, name, description FROM DOCUMENT_TYPE ORDER BY name`);
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
            const r = await pool.request().input('id', sql.VarChar(20), req.params.id)
                .query(`DELETE FROM DOCUMENT_TYPE WHERE type_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('REFERENCE')) {
                return res.status(409).json({ error: 'Đang có tài liệu dùng loại này' });
            }
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 8. SECURITY_LEVEL CRUD
    // ============================================================
    app.get('/api/admin/security-levels', async (req, res) => {
        try {
            const pool = await getPool();
            const r = await pool.request().query(
                `SELECT level_id, code, name FROM SECURITY_LEVEL ORDER BY level_id`);
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
            if (e.message.includes('PRIMARY KEY') || e.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Trùng level_id hoặc code' });
            }
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
            const r = await pool.request().input('id', sql.Int, parseInt(req.params.id, 10))
                .query(`DELETE FROM SECURITY_LEVEL WHERE level_id = @id`);
            if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Không tìm thấy' });
            res.json({ success: true });
        } catch (e) {
            if (e.message.includes('REFERENCE')) {
                return res.status(409).json({ error: 'Đang có user/tài liệu dùng mức này' });
            }
            res.status(500).json({ error: e.message });
        }
    });

    // ============================================================
    // 9. ACCESS_LOG đọc (đã có ở route chính, thêm bản admin nếu cần)
    // ============================================================
    app.delete('/api/admin/access-logs/clear', async (req, res) => {
        try {
            const pool = await getPool();
            await pool.request().query(`DELETE FROM ACCESS_LOG`);
            await log(req, 'CLEAR_LOG', 'Xóa toàn bộ nhật ký');
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
};