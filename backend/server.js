// server.js - QK7 Paperless Gateway
// Nguồn dữ liệu: SQL Server (metadata) + ổ đĩa server (file PDF)
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { sql, getPool, closePool, testConnection } = require('./src/db');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 8000;

const ROOT_DIR = __dirname;
const PDF_ROOT = path.join(ROOT_DIR, 'uploads');
const publicDir = path.join(ROOT_DIR, 'public');

// ─── Login Check ───
const LOCKOUT_MAX_ATTEMPTS = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '6', 10);
const LOCKOUT_WINDOW_MINUTES = parseInt(process.env.LOCKOUT_WINDOW_MINUTES || '15', 10);
const IPBLOCK_MAX_ATTEMPTS = parseInt(process.env.IPBLOCK_MAX_ATTEMPTS || '6', 10);
const IPBLOCK_WINDOW_MINUTES = parseInt(process.env.IPBLOCK_WINDOW_MINUTES || '15', 10);
const IPBLOCK_DURATION_MINUTES = parseInt(process.env.IPBLOCK_DURATION_MINUTES || '30', 10);

app.use(cors());
app.use(express.json());
app.disable('x-powered-by');   // tắt header X-Powered-By để tránh lộ thông tin server

// Đảm bảo mọi response text trả UTF-8
app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return originalJson(data);
    };
    const originalSend = res.send.bind(res);
    res.send = function (data) {
        if (typeof data === 'string' && !res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        return originalSend(data);
    };
    next();
});

app.use(express.static(publicDir));

// ─── Swagger ───
// Bật/tắt qua biến ENABLE_SWAGGER trong .env
// Mặc định: bật (nếu không set hoặc set khác 'false')
const ENABLE_SWAGGER = (process.env.ENABLE_SWAGGER || 'true').toLowerCase() === 'true';

if (ENABLE_SWAGGER) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: `
            .swagger-ui .topbar { display: none }
            .swagger-ui .info { margin: 20px 0 }
            .swagger-ui .info .title { font-size: 28px }
        `,
        customSiteTitle: 'QK7 DataHub API',
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            tryItOutEnabled: true,
            docExpansion: 'list',
            defaultModelsExpandDepth: 1,
            defaultModelExpandDepth: 1,
            deepLinking: true
        }
    }));
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
    console.log('[SWAGGER] Enabled at /api-docs');
} else {
    console.log('[SWAGGER] Disabled (ENABLE_SWAGGER=false)');
}

// ─── Trang chủ ───
app.get('/', (req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send('Không tìm thấy public/index.html');
});

// ─── Multer: upload file vào memory ───
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },   // 50 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Chỉ chấp nhận file PDF'));
    }
});

// ─── Middleware user + chống cache API ───
app.use('/api', (req, res, next) => {
    // ═══════════════════════════════════════════════════════════════
    // Chống 304 cho API — mọi response /api đều 200
    // Static files (JS/CSS/font) KHÔNG bị ảnh hưởng → vẫn cache bình thường
    // ═══════════════════════════════════════════════════════════════
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.removeHeader('ETag');           // Xóa ETag nếu có
    res.removeHeader('Last-Modified');  // Xóa Last-Modified nếu có

    // Bỏ qua auth login (không cần user)
    if (req.path.startsWith('/auth/login')) return next();

    req.user = {
        user_id: req.headers['x-user-id'] || req.query.uid || 'GUEST',
        clearance_level_id: parseInt(
            req.headers['x-clearance'] || req.query.clr || '1', 10
        )
    };
    next();
});

// ─── Ghi nhật ký ───
async function writeAccessLog({ userId, fileId, action, ip, note = null }) {
    try {
        const pool = await getPool();
        const logId = 'LOG-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        const validUserId = (userId && userId !== 'GUEST') ? userId : null;
        await pool.request()
            .input('log_id',  sql.VarChar(50),   logId)
            .input('user_id', sql.VarChar(50),   validUserId)
            .input('file_id', sql.VarChar(50),   fileId || null)
            .input('action',  sql.VarChar(50),   action)
            .input('ip',      sql.VarChar(50),   ip || '')
            .input('note',    sql.NVarChar(255), note || null)
            .query(`
                INSERT INTO ACCESS_LOG (log_id, user_id, file_id, [action], ip, note)
                VALUES (@log_id, @user_id, @file_id, @action, @ip, @note)
            `);
    } catch (err) {
        console.error('[writeAccessLog]', err.message);
    }
}

// ─── Helper: sinh đường dẫn file theo quy ước ───
function buildStoredPath({ docTypeId, documentCode, fallbackId }) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyymmdd = `${yyyy}${mm}${String(now.getDate()).padStart(2, '0')}`;
    const typeSafe = String(docTypeId || 'XX').replace(/[^A-Za-z0-9]/g, '');
    const codeSafe = String(documentCode || fallbackId)
        .replace(/[\/\\\s]/g, '-')
        .replace(/[^A-Za-z0-9\-]/g, '');
    return { yyyy, mm, yyyymmdd, typeSafe, codeSafe };
}


// ============================================================
// 0. AUTH — ĐĂNG NHẬP
// ============================================================
app.post('/api/auth/login', async (req, res) => {
    const ip = getClientIp(req);
    try {
        const { user_id, password } = req.body;

        if (!user_id || !password) {
            return res.status(400).json({ error: 'Thiếu user_id hoặc password' });
        }

        const username = user_id.trim().toLowerCase();

        // ── Bước 1: Check IP blocklist ──
        const ipCheck = await checkIpBlocked(ip);
        if (ipCheck.blocked) {
            const minsLeft = Math.max(1, Math.ceil((new Date(ipCheck.blocked_until) - Date.now()) / 60000));
            return res.status(429).json({
                error: `IP của bạn tạm thời bị chặn do nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ${minsLeft} phút.`
            });
        }

        const pool = await getPool();

        // ── Bước 2: Query user ──
        const r = await pool.request()
            .input('u', sql.VarChar(50), username)
            .query(`
                SELECT u.user_id, u.username, u.full_name, u.[rank] AS rank_name,
                       u.[position], u.unit_id, u.status,
                       u.password_hash, u.pin_hash,
                       u.clearance_level_id,
                       u.failed_attempts, u.locked_at, u.last_failed_at,
                       un.name AS unit_name,
                       sl.name AS clearance_name, sl.code AS clearance_code
                FROM [USER] u
                LEFT JOIN UNIT un           ON un.unit_id  = u.unit_id
                LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = u.clearance_level_id
                WHERE LOWER(u.username) = @u OR LOWER(u.user_id) = @u
            `);

        // ── Bước 3: Username không tồn tại → dò username ──
        if (r.recordset.length === 0) {
            await writeLoginAttempt({ ip, username, result: 'USERNAME_NOT_FOUND' });
            await checkAndBlockIp(ip);

            await writeAccessLog({
                userId: 'UNKNOWN', fileId: null,
                action: 'LOGIN_FAIL', ip,
                note: `Username không tồn tại: ${username}`
            });

            return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
        }

        const user = r.recordset[0];

        // ── Bước 4: Check status ──
        if (user.status !== 'active') {
            await writeLoginAttempt({ ip, username, result: 'LOCKED' });
            await writeAccessLog({
                userId: user.user_id, fileId: null,
                action: 'LOGIN_FAIL', ip,
                note: `Tài khoản bị khóa (status = ${user.status})`
            });
            const msg = user.status === 'locked'
                ? 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên để mở khóa.'
                : 'Tài khoản đã bị vô hiệu hóa.';
            return res.status(403).json({ error: msg });
        }

        // ── Bước 6: Sliding window — reset counter nếu quá hạn ──
        let currentFailed = user.failed_attempts || 0;
        if (user.last_failed_at && currentFailed > 0) {
            const minsSince = (Date.now() - new Date(user.last_failed_at).getTime()) / 60000;
            if (minsSince > LOCKOUT_WINDOW_MINUTES) {
                await pool.request()
                    .input('uid', sql.VarChar(50), user.user_id)
                    .query(`UPDATE [USER] SET failed_attempts = 0, last_failed_at = NULL WHERE user_id = @uid`);
                currentFailed = 0;
            }
        }

        // ── Bước 7: bcrypt compare ──
        const pwdHash = user.password_hash || user.pin_hash;
        if (!pwdHash) {
            await writeLoginAttempt({ ip, username, result: 'WRONG_PASSWORD' });
            return res.status(403).json({ error: 'Tài khoản chưa được cấp mật khẩu' });
        }

        const ok = await bcrypt.compare(password, pwdHash);

        // ── Bước 7a: SAI mật khẩu ──
        if (!ok) {
            // Kiểm tra user có phải Admin (ROL-01) → không khóa tự động
            const adminCheck = await pool.request()
                .input('uid', sql.VarChar(50), user.user_id)
                .query(`SELECT COUNT(*) AS n FROM USER_ROLE
                        WHERE user_id = @uid AND role_id = 'ROL-01'`);
            const isAdminAccount = adminCheck.recordset[0].n > 0;

            const newFailed = currentFailed + 1;
            const willLock = !isAdminAccount && newFailed >= LOCKOUT_MAX_ATTEMPTS;

            const query = willLock
                ? `UPDATE [USER]
                   SET failed_attempts = @n,
                       last_failed_at = GETDATE(),
                       locked_at = GETDATE(),
                       status = 'locked'
                   WHERE user_id = @uid`
                : `UPDATE [USER]
                   SET failed_attempts = @n,
                       last_failed_at = GETDATE()
                   WHERE user_id = @uid`;

            await pool.request()
                .input('uid', sql.VarChar(50), user.user_id)
                .input('n',   sql.Int,         newFailed)
                .query(query);

            await writeLoginAttempt({ ip, username, result: 'WRONG_PASSWORD' });
            await writeAccessLog({
                userId: user.user_id, fileId: null,
                action: 'LOGIN_FAIL', ip,
                note: `Sai mật khẩu lần ${newFailed}/${LOCKOUT_MAX_ATTEMPTS}${isAdminAccount ? ' (Admin — không khóa tự động)' : ''}`
            });

            if (willLock) {
                console.warn(`[LOCKOUT] User ${user.user_id} bị khóa sau ${newFailed} lần sai`);
                return res.status(403).json({
                    error: `Tài khoản đã bị khóa do đăng nhập sai ${LOCKOUT_MAX_ATTEMPTS} lần. Vui lòng liên hệ quản trị viên để mở khóa.`
                });
            }

            // Admin: báo sai mật khẩu đơn giản, không hiện "còn X lần"
            if (isAdminAccount) {
                return res.status(401).json({ error: 'Mật khẩu không đúng.' });
            }

            const remaining = LOCKOUT_MAX_ATTEMPTS - newFailed;
            return res.status(401).json({
                error: `Mật khẩu không đúng. Bạn còn ${remaining} lần thử.`
            });
        }

        // ── Bước 7b: ĐÚNG mật khẩu ──
        await pool.request()
            .input('uid', sql.VarChar(50), user.user_id)
            .query(`UPDATE [USER]
                    SET failed_attempts = 0,
                        locked_at = NULL,
                        last_failed_at = NULL,
                        status = 'active'
                    WHERE user_id = @uid`);

        await writeLoginAttempt({ ip, username, result: 'SUCCESS' });
        await writeAccessLog({
            userId: user.user_id, fileId: null,
            action: 'LOGIN', ip,
            note: `${user.full_name} (mức ${user.clearance_level_id})`
        });

        delete user.password_hash;
        delete user.pin_hash;
        delete user.failed_attempts;
        delete user.locked_at;
        delete user.last_failed_at;

        // ── Lấy roles + role_names ──
        const rolesResult = await pool.request()
            .input('uid', sql.VarChar(50), user.user_id)
            .query(`
                SELECT r.role_id, r.name AS role_name
                FROM USER_ROLE ur
                JOIN [ROLE] r ON r.role_id = ur.role_id
                WHERE ur.user_id = @uid
            `);
        user.roles = rolesResult.recordset.map(x => x.role_id);
        user.role_names = rolesResult.recordset.map(x => x.role_name);

        res.json({ success: true, user });

    } catch (err) {
        console.error('[POST /api/auth/login]', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/me', async (req, res) => {
    try {
        const userId = req.user?.user_id;
        if (!userId || userId === 'GUEST') {
            return res.status(401).json({ error: 'Chưa xác thực thông tin user (thiếu header X-User-Id)' });
        }

        const pool = await getPool();
        const r = await pool.request()
            .input('u', sql.VarChar(50), userId)
            .query(`
                SELECT u.user_id, u.username, u.full_name, u.[rank] AS rank_name, u.[position],
                       u.unit_id, un.name AS unit_name, u.status,
                       u.clearance_level_id, sl.name AS clearance_name, sl.code AS clearance_code
                FROM [USER] u
                LEFT JOIN UNIT un           ON un.unit_id  = u.unit_id
                LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = u.clearance_level_id
                WHERE u.user_id = @u
            `);
        if (r.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy user' });
        }

        const user = r.recordset[0];

        // Bổ sung roles & role_names theo schema UserFull của Swagger
        const rolesRes = await pool.request()
            .input('u', sql.VarChar(50), user.user_id)
            .query(`
                SELECT r.role_id, r.name
                FROM USER_ROLE ur
                JOIN [ROLE] r ON r.role_id = ur.role_id
                WHERE ur.user_id = @u
            `);
        user.roles = rolesRes.recordset.map(x => x.role_id);
        user.role_names = rolesRes.recordset.map(x => x.name);

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 1. HEALTH
// ============================================================
app.get('/api/health', async (req, res) => {
    try {
        const pool = await getPool();
        const r = await pool.request().query(
            `SELECT DB_NAME() AS db, SUSER_SNAME() AS login_name, GETDATE() AS now`
        );
        res.json({ ok: true, ...r.recordset[0] });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ============================================================
// 1.1 HTTP STATUS TEST & SIMULATION
// ============================================================
app.get('/api/test-http-error/:code', (req, res) => {
    const code = parseInt(req.params.code, 10) || 500;
    const msg = req.query.msg || `Mô phỏng phản hồi mã lỗi HTTP ${code} từ máy chủ Backend QK7 DataHub`;
    return res.status(code).json({
        ok: false,
        code,
        error: msg,
        timestamp: new Date().toISOString()
    });
});


// ============================================================
// 2. DANH MỤC
// ============================================================
app.get('/api/meta', async (req, res) => {
    try {
        const pool = await getPool();
        const [types, units, levels, ranks, positions] = await Promise.all([
            pool.request().query(`SELECT type_id, name, description FROM DOCUMENT_TYPE ORDER BY name`),
            pool.request().query(`
                SELECT u.unit_id, u.name, u.parent_id, p.name AS parent_name
                FROM UNIT u
                LEFT JOIN UNIT p ON p.unit_id = u.parent_id
                ORDER BY u.name
            `),
            pool.request().query(`SELECT level_id, code, name FROM SECURITY_LEVEL ORDER BY level_id`),
            pool.request().query(`
                SELECT rank_id, name, sort_order
                FROM MILITARY_RANK
                WHERE active = 1
                ORDER BY sort_order, name
            `),
            pool.request().query(`
                SELECT position_id, name, sort_order
                FROM MILITARY_POSITION
                WHERE active = 1
                ORDER BY sort_order, name
            `)
        ]);
        res.json({
            types:     types.recordset,
            units:     units.recordset,
            levels:    levels.recordset,
            ranks:     ranks.recordset,
            positions: positions.recordset
        });
    } catch (e) {
        console.error('[GET /api/meta]', e);
        res.status(500).json({ error: e.message });
    }
});


// ============================================================
// 3. ĐỌC — TÌM KIẾM TÀI LIỆU
// ============================================================
app.get('/api/documents', async (req, res) => {
    try {
        const pool = await getPool();
        const r = pool.request();

        let query = `
            SELECT d.file_id, d.document_code, d.title,
                   d.doc_type_id, dt.name AS doc_type_name,
                   d.doc_type_id AS type_id, dt.name AS type_name,
                   d.issued_date, d.issued_date AS issue_date,
                   d.issuing_unit_id, u.name AS unit_name,
                   d.issuing_unit_id AS unit_id,
                   d.signer, d.file_size, d.file_size AS file_size_bytes,
                   d.summary,
                   d.security_level_id, sl.name AS security_name,
                   sl.name AS security_level_name,
                   d.created_at, d.updated_at
            FROM DOCUMENT d
            LEFT JOIN DOCUMENT_TYPE dt ON dt.type_id  = d.doc_type_id
            LEFT JOIN UNIT u          ON u.unit_id   = d.issuing_unit_id
            JOIN SECURITY_LEVEL sl    ON sl.level_id = d.security_level_id
            WHERE d.security_level_id <= @clearance
        `;
        r.input('clearance', sql.Int, req.user.clearance_level_id);

        if (req.query.q) {
            query += ` AND (d.document_code LIKE '%' + @q + '%' OR d.title LIKE N'%' + @q + N'%' OR d.summary LIKE N'%' + @q + N'%')`;
            r.input('q', sql.NVarChar(500), req.query.q);
        } else {
            if (req.query.code) {
                query += ` AND d.document_code LIKE '%' + @code + '%'`;
                r.input('code', sql.NVarChar(100), req.query.code);
            }
            if (req.query.title) {
                query += ` AND d.title LIKE N'%' + @title + N'%'`;
                r.input('title', sql.NVarChar(500), req.query.title);
            }
        }
        const typeParam = req.query.type || req.query.doc_type_id;
        if (typeParam) {
            query += ` AND d.doc_type_id = @type`;
            r.input('type', sql.VarChar(20), typeParam);
        }
        const unitParam = req.query.unit || req.query.issuing_unit_id;
        if (unitParam) {
            query += ` AND d.issuing_unit_id = @unit`;
            r.input('unit', sql.VarChar(50), unitParam);
        }
        if (req.query.from) {
            const fromDate = new Date(req.query.from);
            if (!isNaN(fromDate.getTime())) {
                query += ` AND d.issued_date >= @from`;
                r.input('from', sql.Date, fromDate);
            }
        }
        if (req.query.to) {
            const toDate = new Date(req.query.to);
            if (!isNaN(toDate.getTime())) {
                query += ` AND d.issued_date <= @to`;
                r.input('to', sql.Date, toDate);
            }
        }
        const lvParam = req.query.lv || req.query.security_level_id;
        if (lvParam) {
            const maxAllowed = Math.min(parseInt(lvParam, 10), req.user.clearance_level_id);
            query += ` AND d.security_level_id <= @lv`;
            r.input('lv', sql.Int, maxAllowed);
        }

        query += ` ORDER BY d.issued_date DESC, d.document_code`;

        const result = await r.query(query);
        res.json({ total: result.recordset.length, items: result.recordset });
    } catch (err) {
        console.error('[GET /api/documents]', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 3b. ĐỌC CHI TIẾT 1 TÀI LIỆU
// ============================================================
app.get('/api/documents/:fileId', async (req, res) => {
    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('file_id', sql.VarChar(50), req.params.fileId)
            .query(`
                SELECT d.*,
                       d.doc_type_id AS type_id,
                       dt.name AS doc_type_name,
                       dt.name AS type_name,
                       u.name AS unit_name,
                       d.issuing_unit_id AS unit_id,
                       d.issued_date AS issue_date,
                       d.file_size AS file_size_bytes,
                       sl.name AS security_name,
                       sl.name AS security_level_name
                FROM DOCUMENT d
                LEFT JOIN DOCUMENT_TYPE dt ON dt.type_id  = d.doc_type_id
                LEFT JOIN UNIT u          ON u.unit_id   = d.issuing_unit_id
                JOIN SECURITY_LEVEL sl    ON sl.level_id = d.security_level_id
                WHERE d.file_id = @file_id
            `);
        if (r.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
        }
        res.json(r.recordset[0]);
    } catch (err) {
        console.error('[GET /api/documents/:id]', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 4. TẠO — UPLOAD PDF MỚI
// ============================================================
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Thiếu file PDF' });
        }

        const docTypeId = req.body.doc_type_id || req.body.type_id || null;
        const issuingUnitId = req.body.issuing_unit_id || req.body.unit_id || null;
        const issuedDate = req.body.issued_date || req.body.issue_date || null;
        const securityLevelId = req.body.security_level_id || req.body.level_id;
        const documentCode = req.body.document_code || req.body.code || null;
        const title = req.body.title;
        const signer = req.body.signer || null;
        const summary = req.body.summary || null;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Thiếu trích yếu' });
        }
        if (!securityLevelId) {
            return res.status(400).json({ error: 'Thiếu mức bảo mật' });
        }

        const fileId = 'DOC-' + Date.now() + '-' +
                       Math.random().toString(36).slice(2, 6).toUpperCase();

        const sha256 = crypto.createHash('sha256')
            .update(req.file.buffer).digest('hex');

        const { yyyy, mm, yyyymmdd, typeSafe, codeSafe } =
            buildStoredPath({ docTypeId, documentCode, fallbackId: fileId });

        const sha8 = sha256.slice(0, 8);
        const fileName = `${yyyymmdd}_${typeSafe}_${codeSafe}_${sha8}.pdf`;
        const relPath = `uploads/${yyyy}/${mm}/${fileName}`;
        const absPath = path.join(ROOT_DIR, relPath);

        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, req.file.buffer);

        const pool = await getPool();
        await pool.request()
            .input('file_id',           sql.VarChar(50),       fileId)
            .input('document_code',     sql.NVarChar(100),     documentCode)
            .input('title',             sql.NVarChar(500),     title.trim())
            .input('doc_type_id',       sql.VarChar(20),       docTypeId)
            .input('issued_date',       sql.Date,              issuedDate)
            .input('issuing_unit_id',   sql.VarChar(50),       issuingUnitId)
            .input('signer',            sql.NVarChar(100),     signer)
            .input('summary',           sql.NVarChar(sql.MAX), summary)
            .input('security_level_id', sql.Int,               parseInt(securityLevelId, 10))
            .input('original_name',     sql.NVarChar(255),     req.file.originalname)
            .input('stored_path',       sql.NVarChar(500),     relPath)
            .input('mime_type',         sql.VarChar(100),      req.file.mimetype)
            .input('file_size',         sql.BigInt,            req.file.size)
            .input('sha256',            sql.Char(64),          sha256)
            .input('uploaded_by',       sql.VarChar(50),       req.user.user_id)
            .query(`
                INSERT INTO DOCUMENT
                  (file_id, document_code, title, doc_type_id, issued_date,
                   issuing_unit_id, signer, summary, security_level_id,
                   original_name, stored_path, mime_type, file_size, sha256, uploaded_by)
                VALUES
                  (@file_id, @document_code, @title, @doc_type_id, @issued_date,
                   @issuing_unit_id, @signer, @summary, @security_level_id,
                   @original_name, @stored_path, @mime_type, @file_size, @sha256, @uploaded_by)
            `);

        await writeAccessLog({
            userId: req.user.user_id,
            fileId,
            action: 'UPLOAD',
            ip: req.ip || '',
            note: `Upload: ${req.file.originalname}`
        });

        res.json({
            success: true,
            file_id: fileId,
            stored_path: relPath,
            sha256
        });

    } catch (err) {
        console.error('[POST /api/documents/upload]', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 5. CẬP NHẬT — SỬA METADATA (và tùy chọn thay file)
// ============================================================
app.put('/api/documents/:fileId',
    upload.single('file'),
    async (req, res) => {
    const fileId = req.params.fileId;
    try {
        const pool = await getPool();

        const exist = await pool.request()
            .input('file_id', sql.VarChar(50), fileId)
            .query(`SELECT stored_path, original_name, sha256
                    FROM DOCUMENT WHERE file_id = @file_id`);

        if (exist.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
        }

        const oldDoc = exist.recordset[0];

        const docTypeId = req.body.doc_type_id || req.body.type_id || null;
        const issuingUnitId = req.body.issuing_unit_id || req.body.unit_id || null;
        const issuedDate = req.body.issued_date || req.body.issue_date || null;
        const securityLevelId = req.body.security_level_id || req.body.level_id;
        const documentCode = req.body.document_code || req.body.code || null;
        const title = req.body.title;
        const signer = req.body.signer || null;
        const summary = req.body.summary || null;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Thiếu trích yếu' });
        }
        if (!securityLevelId) {
            return res.status(400).json({ error: 'Thiếu mức bảo mật' });
        }

        let storedPath   = oldDoc.stored_path;
        let originalName = oldDoc.original_name;
        let mimeType     = 'application/pdf';
        let fileSize     = null;
        let sha256       = oldDoc.sha256;
        let replacedFile = false;

        if (req.file) {
            const { yyyy, mm, yyyymmdd, typeSafe, codeSafe } =
                buildStoredPath({ docTypeId, documentCode, fallbackId: fileId });

            sha256 = crypto.createHash('sha256')
                .update(req.file.buffer).digest('hex');
            const sha8 = sha256.slice(0, 8);
            const fileName = `${yyyymmdd}_${typeSafe}_${codeSafe}_${sha8}.pdf`;
            const relPath  = `uploads/${yyyy}/${mm}/${fileName}`;
            const absPath  = path.join(ROOT_DIR, relPath);

            fs.mkdirSync(path.dirname(absPath), { recursive: true });
            fs.writeFileSync(absPath, req.file.buffer);

            // Xóa file cũ nếu khác file mới
            const oldAbs = path.join(ROOT_DIR, oldDoc.stored_path);
            if (oldAbs !== absPath && fs.existsSync(oldAbs) &&
                oldAbs.startsWith(PDF_ROOT)) {
                try { fs.unlinkSync(oldAbs); } catch (e) {
                    console.error('[update] Xóa file cũ lỗi:', e.message);
                }
            }

            storedPath   = relPath;
            originalName = req.file.originalname;
            mimeType     = req.file.mimetype;
            fileSize     = req.file.size;
            replacedFile = true;
        }

        const reqUpdate = pool.request()
            .input('file_id',           sql.VarChar(50),       fileId)
            .input('document_code',     sql.NVarChar(100),     documentCode)
            .input('title',             sql.NVarChar(500),     title.trim())
            .input('doc_type_id',       sql.VarChar(20),       docTypeId)
            .input('issued_date',       sql.Date,              issuedDate)
            .input('issuing_unit_id',   sql.VarChar(50),       issuingUnitId)
            .input('signer',            sql.NVarChar(100),     signer)
            .input('summary',           sql.NVarChar(sql.MAX), summary)
            .input('security_level_id', sql.Int,               parseInt(securityLevelId, 10))
            .input('stored_path',       sql.NVarChar(500),     storedPath)
            .input('original_name',     sql.NVarChar(255),     originalName)
            .input('mime_type',         sql.VarChar(100),      mimeType);

        let updateQuery = `
            UPDATE DOCUMENT SET
              document_code     = @document_code,
              title             = @title,
              doc_type_id       = @doc_type_id,
              issued_date       = @issued_date,
              issuing_unit_id   = @issuing_unit_id,
              signer            = @signer,
              summary           = @summary,
              security_level_id = @security_level_id,
              stored_path       = @stored_path,
              original_name     = @original_name,
              mime_type         = @mime_type,
              updated_at        = GETDATE()
        `;

        if (replacedFile) {
            updateQuery += `, file_size = @file_size, sha256 = @sha256`;
            reqUpdate.input('file_size', sql.BigInt,  fileSize);
            reqUpdate.input('sha256',    sql.Char(64), sha256);
        }

        updateQuery += ` WHERE file_id = @file_id`;

        await reqUpdate.query(updateQuery);

        await writeAccessLog({
            userId: req.user.user_id,
            fileId,
            action: 'UPDATE',
            ip: req.ip || '',
            note: replacedFile
                ? `Sửa metadata + thay file: ${originalName}`
                : `Sửa metadata: ${title.trim()}`
        });

        res.json({
            success: true,
            file_id: fileId,
            replaced_file: replacedFile,
            stored_path: storedPath
        });

    } catch (err) {
        console.error('[PUT /api/documents/:id]', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 6. XÓA — XÓA TÀI LIỆU (file + record)
// ============================================================
app.delete('/api/documents/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    try {
        const pool = await getPool();

        const result = await pool.request()
            .input('file_id', sql.VarChar(50), fileId)
            .query(`SELECT stored_path, original_name
                    FROM DOCUMENT WHERE file_id = @file_id`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
        }

        const doc = result.recordset[0];
        const filePath = path.join(ROOT_DIR, doc.stored_path);

        // Xóa file trên ổ đĩa
        if (fs.existsSync(filePath) && filePath.startsWith(PDF_ROOT)) {
            try { fs.unlinkSync(filePath); } catch (e) {
                console.error('[delete file]', e.message);
            }
        }

        // Xóa log trước (do FK), rồi xóa document
        await pool.request()
            .input('file_id', sql.VarChar(50), fileId)
            .query(`DELETE FROM ACCESS_LOG WHERE file_id = @file_id`);

        await pool.request()
            .input('file_id', sql.VarChar(50), fileId)
            .query(`DELETE FROM DOCUMENT WHERE file_id = @file_id`);

        await writeAccessLog({
            userId: req.user.user_id,
            fileId: null,
            action: 'DELETE',
            ip: req.ip || '',
            note: `Xóa tài liệu ${fileId} (${doc.original_name})`
        });

        res.json({ success: true, file_id: fileId });

    } catch (err) {
        console.error('[DELETE /api/documents/:id]', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 7. XEM / TẢI PDF
// ============================================================
app.get('/api/files/:fileId/view', async (req, res) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const fileId = req.params.fileId;
    const isDownload = req.query.download === '1';

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('file_id', sql.VarChar(50), fileId)
            .query(`
                SELECT stored_path, original_name, mime_type, security_level_id
                FROM DOCUMENT WHERE file_id = @file_id
            `);

        if (result.recordset.length === 0) {
            await writeAccessLog({
                userId: req.user.user_id, fileId,
                action: 'DENIED', ip, note: 'Khong tim thay tai lieu'
            });
            return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
        }

        const doc = result.recordset[0];

        // Quyền xem và tải tệp được kiểm soát theo Cấp độ bảo mật (Clearance Level vs doc.security_level_id)
        if (doc.security_level_id > req.user.clearance_level_id) {
            await writeAccessLog({
                userId: req.user.user_id, fileId,
                action: 'DENIED', ip,
                note: `Can muc ${doc.security_level_id}${isDownload ? ' de tai ve' : ' de xem'}, user co muc ${req.user.clearance_level_id}`
            });
            return res.status(403).json({ error: `Cấp độ bảo mật của bạn không đủ để ${isDownload ? 'tải về' : 'xem'} tài liệu này` });
        }

        // Quy định bảo mật: Từ cấp 3 trở đi (gồm Cấp 3, Cấp 4, Cấp 5) chỉ duy nhất cho phép xem, KHÔNG được tải về.
        // Chỉ cấp 1 và cấp 2 được phép tải về máy.
        if (isDownload && doc.security_level_id >= 3) {
            await writeAccessLog({
                userId: req.user.user_id, fileId,
                action: 'DENIED', ip,
                note: `Tu choi tai ve: Tai lieu Cap ${doc.security_level_id} chi duy nhat cho phep xem truc tiep`
            });
            return res.status(403).json({
                error: 'Tài liệu từ Cấp 3 trở lên chỉ duy nhất cho phép xem trực tiếp trên hệ thống, không được phép tải về máy.'
            });
        }

        const filePath = path.join(ROOT_DIR, doc.stored_path);

        if (!filePath.startsWith(PDF_ROOT)) {
            return res.status(400).json({ error: 'Đường dẫn không hợp lệ' });
        }

        if (!fs.existsSync(filePath)) {
            await writeAccessLog({
                userId: req.user.user_id, fileId,
                action: 'ERROR', ip, note: 'File khong ton tai tren o dia'
            });
            return res.status(404).json({ error: 'File không tồn tại: ' + doc.stored_path });
        }

        await writeAccessLog({
            userId: req.user.user_id, fileId,
            action: isDownload ? 'DOWNLOAD' : 'VIEW',
            ip
        });

        res.setHeader('Content-Type', doc.mime_type || 'application/pdf');
        res.setHeader('Content-Disposition',
            `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.original_name)}"`);
        fs.createReadStream(filePath).pipe(res);

    } catch (err) {
        console.error('[GET /api/files/:id/view]', err);
        try {
            await writeAccessLog({
                userId: req.user.user_id, fileId,
                action: 'ERROR', ip, note: err.message
            });
        } catch (_) {}
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 8. NHẬT KÝ
// ============================================================
app.get('/api/access-logs', async (req, res) => {
    try {
        const pool = await getPool();
        const r = pool.request();

        let query = `
            SELECT TOP 200
                l.log_id, l.user_id, u.full_name,
                l.file_id, d.title AS doc_title,
                l.[action], l.[timestamp], l.ip, l.note
            FROM ACCESS_LOG l
            LEFT JOIN [USER] u    ON u.user_id = l.user_id
            LEFT JOIN DOCUMENT d  ON d.file_id = l.file_id
            WHERE 1 = 1
        `;

        if (req.query.user) {
            query += ` AND l.user_id = @user`;
            r.input('user', sql.VarChar(50), req.query.user);
        }
        if (req.query.action) {
            query += ` AND l.[action] = @action`;
            r.input('action', sql.VarChar(50), req.query.action);
        }
        query += ` ORDER BY l.[timestamp] DESC`;

        const result = await r.query(query);
        res.json({ total: result.recordset.length, items: result.recordset });
    } catch (err) {
        console.error('[GET /api/access-logs]', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Error handler cho multer ───
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File vượt quá 50MB' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        console.error('[Global error]', err);
        return res.status(500).json({ error: err.message });
    }
    next();
});

// ─── Admin CRUD routes ───
require('./src/admin-routes')(app, { sql, getPool, writeAccessLog })
// ─── Lấy IP client (xử lý qua proxy/nginx) ───
function getClientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
    return (req.ip || req.connection?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

// ─── Kiểm tra IP có bị block ───
async function checkIpBlocked(ip) {
    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('ip', sql.VarChar(50), ip)
            .query(`SELECT ip, blocked_until, reason
                    FROM IP_BLOCKLIST
                    WHERE ip = @ip AND blocked_until > GETDATE()`);
        if (r.recordset.length > 0) {
            return { blocked: true, ...r.recordset[0] };
        }
        // Cleanup record hết hạn
        await pool.request()
            .input('ip', sql.VarChar(50), ip)
            .query(`DELETE FROM IP_BLOCKLIST WHERE ip = @ip AND blocked_until <= GETDATE()`);
        return { blocked: false };
    } catch (err) {
        console.error('[checkIpBlocked]', err.message);
        return { blocked: false };
    }
}

// ─── Ghi log login attempt ───
async function writeLoginAttempt({ ip, username, result }) {
    try {
        const pool = await getPool();
        await pool.request()
            .input('ip',       sql.VarChar(50),  ip)
            .input('username', sql.NVarChar(50), username || null)
            .input('result',   sql.VarChar(30),  result)
            .query(`INSERT INTO LOGIN_ATTEMPT (ip, username, result)
                    VALUES (@ip, @username, @result)`);
    } catch (err) {
        console.error('[writeLoginAttempt]', err.message);
    }
}

// ─── Đếm USERNAME_NOT_FOUND từ IP → block nếu vượt ngưỡng ───
async function checkAndBlockIp(ip) {
    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('ip', sql.VarChar(50), ip)
            .input('window', sql.Int, IPBLOCK_WINDOW_MINUTES)
            .query(`SELECT COUNT(*) AS n FROM LOGIN_ATTEMPT
                    WHERE ip = @ip
                      AND result = 'USERNAME_NOT_FOUND'
                      AND attempted_at >= DATEADD(MINUTE, -@window, GETDATE())`);

        const count = r.recordset[0].n;
        if (count >= IPBLOCK_MAX_ATTEMPTS) {
            const until = new Date(Date.now() + IPBLOCK_DURATION_MINUTES * 60000);
            await pool.request()
                .input('ip',     sql.VarChar(50),   ip)
                .input('until',  sql.DateTime,      until)
                .input('reason', sql.NVarChar(200), `Dò username ${count} lần trong ${IPBLOCK_WINDOW_MINUTES} phút`)
                .query(`MERGE IP_BLOCKLIST AS target
                        USING (SELECT @ip AS ip) AS src
                        ON target.ip = src.ip
                        WHEN MATCHED THEN
                            UPDATE SET blocked_until = @until, reason = @reason, blocked_at = GETDATE()
                        WHEN NOT MATCHED THEN
                            INSERT (ip, blocked_until, reason) VALUES (@ip, @until, @reason);`);
            console.warn(`[IPBLOCK] Đã chặn IP ${ip} trong ${IPBLOCK_DURATION_MINUTES} phút (${count} lần dò username)`);
            return true;
        }
        return false;
    } catch (err) {
        console.error('[checkAndBlockIp]', err.message);
        return false;
    }
}
;

// ─── SPA Fallback: mọi request GET/HEAD điều hướng giao diện trả về index.html ───
app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/api-docs')) {
        return next();
    }
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Không tìm thấy public/index.html. Vui lòng chạy npm run frontend:build.');
    }
});

// ─── KHỞI ĐỘNG ───
async function start() {
    if (!fs.existsSync(PDF_ROOT)) {
        fs.mkdirSync(PDF_ROOT, { recursive: true });
        console.log(`[FS] Da tao thu muc: ${PDF_ROOT}`);
    }

    const ok = await testConnection();
    if (!ok) {
        console.error('Khong the ket noi database. Kiem tra .env va SQL Server.');
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log('');
        console.log(`  QK7 Paperless Gateway`);
        console.log(`  Web:      http://localhost:${PORT}`);
        console.log(`  Swagger:  http://localhost:${PORT}/api-docs`);
        console.log(`  PDF root: ${PDF_ROOT}`);
        console.log('');
    });




// Thử nghiệm - Test PDF parsing
// ============================================================
// 9. PARSE PDF (trích xuất metadata & text)
// ============================================================
const { parseDocumentPdf } = require('./pdf-parser');

app.post('/api/documents/parse', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Thiếu file PDF' });
        }

        const result = await parseDocumentPdf(req.file.buffer);

        res.json({
            ...result,
            original_name: req.file.originalname,
            file_size: req.file.size,
            sha256: crypto.createHash('sha256').update(req.file.buffer).digest('hex'),
        });
    } catch (err) {
        console.error('[POST /api/documents/parse]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});







}

start();

process.on('SIGINT',  async () => { await closePool(); process.exit(0); });
process.on('SIGTERM', async () => { await closePool(); process.exit(0); });