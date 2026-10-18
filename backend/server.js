// ═══════════════════════════════════════════════════════════════
// server.js — QK7 Paperless Gateway (v2.0 — JWT + Fingerprint)
// Nguồn dữ liệu: SQL Server (metadata) + ổ đĩa server (file PDF)
// Bảo mật:
//   - JWT (Bearer token) thay X-User-Id/X-Clearance
//   - Cấp 4-5 (Tối mật/Tuyệt mật) yêu cầu vân tay ZK9500
//   - ALLOW_LEGACY_AUTH=true cho giai đoạn chuyển tiếp
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { sql, getPool, closePool, testConnection } = require('./src/db');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 8000;

const ROOT_DIR = __dirname;
const PDF_ROOT = path.join(ROOT_DIR, 'uploads');
const publicDir = path.join(ROOT_DIR, 'public');

// ─── JWT config ───
const JWT_SECRET = process.env.JWT_SECRET || 'QK7-DEV-SECRET-CHANGE-IN-PROD-' + crypto.randomBytes(16).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const FINGERPRINT_TOKEN_EXPIRES_IN = '5m';

// ─── Fingerprint config ───
const FINGERPRINT_BRIDGE_URL = process.env.FINGERPRINT_BRIDGE_URL || 'http://localhost:9000';
const FP_ENC_KEY = process.env.FP_ENC_KEY
    ? crypto.scryptSync(process.env.FP_ENC_KEY, 'qk7-fp-salt', 32)
    : null;

// ─── Legacy auth fallback (dùng trong giai đoạn chuyển đổi) ───
const ALLOW_LEGACY_AUTH = (process.env.ALLOW_LEGACY_AUTH || 'true').toLowerCase() === 'true';

// ─── Login Check config ───
const LOCKOUT_MAX_ATTEMPTS = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '6', 10);
const LOCKOUT_WINDOW_MINUTES = parseInt(process.env.LOCKOUT_WINDOW_MINUTES || '15', 10);
const IPBLOCK_MAX_ATTEMPTS = parseInt(process.env.IPBLOCK_MAX_ATTEMPTS || '6', 10);
const IPBLOCK_WINDOW_MINUTES = parseInt(process.env.IPBLOCK_WINDOW_MINUTES || '15', 10);
const IPBLOCK_DURATION_MINUTES = parseInt(process.env.IPBLOCK_DURATION_MINUTES || '30', 10);

// ─── Startup warnings ───
if (!process.env.JWT_SECRET) {
    console.warn('');
    console.warn('  ╔════════════════════════════════════════════════════════════╗');
    console.warn('  ║  ⚠️  SECURITY WARNING                                      ║');
    console.warn('  ║  JWT_SECRET chưa set trong .env — đang dùng default random ║');
    console.warn('  ║  → Token sẽ mất hiệu lực khi restart backend!              ║');
    console.warn('  ║  → BẮT BUỘC set JWT_SECRET trong .env trước production    ║');
    console.warn('  ╚════════════════════════════════════════════════════════════╝');
    console.warn('');
}
if (ALLOW_LEGACY_AUTH) {
    console.warn('[SECURITY] ⚠️  ALLOW_LEGACY_AUTH=true — vẫn cho phép X-User-Id/X-Clearance (KHÔNG an toàn).');
    console.warn('[SECURITY]    Tắt sau khi Frontend đã chuyển sang JWT (ALLOW_LEGACY_AUTH=false).');
}
if (!FP_ENC_KEY) {
    console.warn('[SECURITY] ⚠️  FP_ENC_KEY chưa set — template vân tay lưu plaintext. Set trong .env để mã hóa.');
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.disable('x-powered-by');

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
            deepLinking: true
        }
    }));
    app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
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

// ─── Multer ───
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Chỉ chấp nhận file PDF'));
    }
});

// ═══════════════════════════════════════════════════════════════
// HELPER — Mã hóa / giải mã template vân tay
// ═══════════════════════════════════════════════════════════════
function encryptTemplate(plain) {
    if (!FP_ENC_KEY) return plain;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', FP_ENC_KEY, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return 'enc:' + Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptTemplate(encoded) {
    if (!FP_ENC_KEY || !encoded || !encoded.startsWith('enc:')) return encoded;
    try {
        const buf = Buffer.from(encoded.slice(4), 'base64');
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const enc = buf.subarray(28);
        const decipher = crypto.createDecipheriv('aes-256-gcm', FP_ENC_KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch (err) {
        console.error('[decryptTemplate] Lỗi giải mã:', err.message);
        return encoded;
    }
}

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE — Xác thực JWT (fallback legacy nếu bật)
// ═══════════════════════════════════════════════════════════════
app.use('/api', (req, res, next) => {
    // Chống cache API
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.removeHeader('ETag');
    res.removeHeader('Last-Modified');

    // ── Public endpoints (không cần auth) ──
    const isPublic =
        req.path === '/auth/login' ||
        req.path === '/health' ||
        req.path === '/meta' ||
        req.path.startsWith('/test-http-error');
    if (isPublic) return next();

    // ── Thử JWT trước ──
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
            req.user = {
                user_id: decoded.user_id,
                clearance_level_id: decoded.clearance_level_id,
                roles: decoded.roles || [],
                is_authenticated: true,
            };
            return next();
        } catch (err) {
            return res.status(401).json({
                error: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
                code: 'TOKEN_INVALID',
            });
        }
    }

    // ── Legacy fallback (CHỈ khi ALLOW_LEGACY_AUTH=true) ──
    if (ALLOW_LEGACY_AUTH && req.headers['x-user-id']) {
        const uid = String(req.headers['x-user-id']).trim();
        req.user = {
            user_id: uid,
            clearance_level_id: parseInt(req.headers['x-clearance'] || req.query.clr || '1', 10),
            roles: [],
            is_authenticated: uid !== 'GUEST',
        };
        return next();
    }

    // ── GUEST (chưa đăng nhập) ──
    req.user = {
        user_id: 'GUEST',
        clearance_level_id: 1,
        roles: [],
        is_authenticated: false,
    };
    next();
});

// ─── Helper: yêu cầu đăng nhập cho write endpoints ───
function requireAuth(req, res, next) {
    if (!req.user || !req.user.is_authenticated) {
        return res.status(401).json({ error: 'Cần đăng nhập để thực hiện thao tác này' });
    }
    next();
}

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
            .query(`INSERT INTO ACCESS_LOG (log_id, user_id, file_id, [action], ip, note)
                    VALUES (@log_id, @user_id, @file_id, @action, @ip, @note)`);
    } catch (err) {
        console.error('[writeAccessLog]', err.message);
    }
}

function buildStoredPath({ docTypeId, documentCode, fallbackId }) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyymmdd = `${yyyy}${mm}${String(now.getDate()).padStart(2, '0')}`;
    const typeSafe = String(docTypeId || 'XX').replace(/[^A-Za-z0-9]/g, '');
    const codeSafe = String(documentCode || fallbackId).replace(/[\/\\\s]/g, '-').replace(/[^A-Za-z0-9\-]/g, '');
    return { yyyy, mm, yyyymmdd, typeSafe, codeSafe };
}

// ═══════════════════════════════════════════════════════════════
// 0. AUTH — ĐĂNG NHẬP
// ═══════════════════════════════════════════════════════════════
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

        // ── Bước 2: Query user (kèm has_fingerprint) ──
        const r = await pool.request()
            .input('u', sql.VarChar(50), username)
            .query(`
                SELECT u.user_id, u.username, u.full_name, u.[rank] AS rank_name,
                       u.[position], u.unit_id, u.status,
                       u.password_hash, u.pin_hash,
                       u.clearance_level_id,
                       u.failed_attempts, u.locked_at, u.last_failed_at,
                       un.name AS unit_name,
                       sl.name AS clearance_name, sl.code AS clearance_code,
                       CASE WHEN EXISTS (
                           SELECT 1 FROM USER_FINGERPRINT uf
                           WHERE uf.user_id = u.user_id AND uf.active = 1
                       ) THEN 1 ELSE 0 END AS has_fingerprint
                FROM [USER] u
                LEFT JOIN UNIT un           ON un.unit_id  = u.unit_id
                LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = u.clearance_level_id
                WHERE LOWER(u.username) = @u OR LOWER(u.user_id) = @u
            `);

        // ── Bước 3: Username không tồn tại ──
        if (r.recordset.length === 0) {
            await writeLoginAttempt({ ip, username, result: 'USERNAME_NOT_FOUND' });
            await checkAndBlockIp(ip);
            await writeAccessLog({
                userId: 'UNKNOWN', fileId: null, action: 'LOGIN_FAIL', ip,
                note: `Username không tồn tại: ${username}`
            });
            return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
        }

        const user = r.recordset[0];

        // ── Bước 4: Check status ──
        if (user.status !== 'active') {
            await writeLoginAttempt({ ip, username, result: 'LOCKED' });
            await writeAccessLog({
                userId: user.user_id, fileId: null, action: 'LOGIN_FAIL', ip,
                note: `Tài khoản bị khóa (status = ${user.status})`
            });
            return res.status(403).json({
                error: user.status === 'locked'
                    ? 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên để mở khóa.'
                    : 'Tài khoản đã bị vô hiệu hóa.'
            });
        }

        // ── Bước 5: Sliding window ──
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

        // ── Bước 6: bcrypt compare ──
        const pwdHash = user.password_hash || user.pin_hash;
        if (!pwdHash) {
            await writeLoginAttempt({ ip, username, result: 'WRONG_PASSWORD' });
            return res.status(403).json({ error: 'Tài khoản chưa được cấp mật khẩu' });
        }

        const ok = await bcrypt.compare(password, pwdHash);

        // ── Bước 7a: SAI mật khẩu ──
        if (!ok) {
            const adminCheck = await pool.request()
                .input('uid', sql.VarChar(50), user.user_id)
                .query(`SELECT COUNT(*) AS n FROM USER_ROLE WHERE user_id = @uid AND role_id = 'ROL-01'`);
            const isAdminAccount = adminCheck.recordset[0].n > 0;

            const newFailed = currentFailed + 1;
            const willLock = !isAdminAccount && newFailed >= LOCKOUT_MAX_ATTEMPTS;

            const query = willLock
                ? `UPDATE [USER] SET failed_attempts = @n, last_failed_at = GETDATE(),
                                    locked_at = GETDATE(), status = 'locked' WHERE user_id = @uid`
                : `UPDATE [USER] SET failed_attempts = @n, last_failed_at = GETDATE() WHERE user_id = @uid`;

            await pool.request()
                .input('uid', sql.VarChar(50), user.user_id)
                .input('n', sql.Int, newFailed)
                .query(query);

            await writeLoginAttempt({ ip, username, result: 'WRONG_PASSWORD' });
            await writeAccessLog({
                userId: user.user_id, fileId: null, action: 'LOGIN_FAIL', ip,
                note: `Sai mật khẩu lần ${newFailed}/${LOCKOUT_MAX_ATTEMPTS}${isAdminAccount ? ' (Admin — không khóa)' : ''}`
            });

            if (willLock) {
                console.warn(`[LOCKOUT] User ${user.user_id} bị khóa sau ${newFailed} lần sai`);
                return res.status(403).json({
                    error: `Tài khoản đã bị khóa do đăng nhập sai ${LOCKOUT_MAX_ATTEMPTS} lần. Vui lòng liên hệ quản trị viên để mở khóa.`
                });
            }
            if (isAdminAccount) {
                return res.status(401).json({ error: 'Mật khẩu không đúng.' });
            }
            return res.status(401).json({
                error: `Mật khẩu không đúng. Bạn còn ${LOCKOUT_MAX_ATTEMPTS - newFailed} lần thử.`
            });
        }

        // ── Bước 7b: ĐÚNG mật khẩu ──
        await pool.request()
            .input('uid', sql.VarChar(50), user.user_id)
            .query(`UPDATE [USER] SET failed_attempts = 0, locked_at = NULL,
                                     last_failed_at = NULL, status = 'active' WHERE user_id = @uid`);

        await writeLoginAttempt({ ip, username, result: 'SUCCESS' });
        await writeAccessLog({
            userId: user.user_id, fileId: null, action: 'LOGIN', ip,
            note: `${user.full_name} (mức ${user.clearance_level_id})`
        });

        delete user.password_hash;
        delete user.pin_hash;
        delete user.failed_attempts;
        delete user.locked_at;
        delete user.last_failed_at;

        // ── Lấy roles ──
        const rolesResult = await pool.request()
            .input('uid', sql.VarChar(50), user.user_id)
            .query(`
                SELECT r.role_id, r.name AS role_name
                FROM USER_ROLE ur JOIN [ROLE] r ON r.role_id = ur.role_id
                WHERE ur.user_id = @uid
            `);
        user.roles = rolesResult.recordset.map(x => x.role_id);
        user.role_names = rolesResult.recordset.map(x => x.role_name);
        user.has_fingerprint = user.has_fingerprint === 1;

        // ── Cấp JWT ──
        const token = jwt.sign(
            {
                user_id: user.user_id,
                clearance_level_id: user.clearance_level_id,
                roles: user.roles,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            token,
            expires_in: JWT_EXPIRES_IN,
            user,
        });

    } catch (err) {
        console.error('[POST /api/auth/login]', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/me', async (req, res) => {
    try {
        const userId = req.user?.user_id;
        if (!userId || userId === 'GUEST') {
            return res.status(401).json({ error: 'Chưa đăng nhập' });
        }

        const pool = await getPool();
        const r = await pool.request()
            .input('u', sql.VarChar(50), userId)
            .query(`
                SELECT u.user_id, u.username, u.full_name, u.[rank] AS rank_name, u.[position],
                       u.unit_id, un.name AS unit_name, u.status,
                       u.clearance_level_id, sl.name AS clearance_name, sl.code AS clearance_code,
                       CASE WHEN EXISTS (
                           SELECT 1 FROM USER_FINGERPRINT uf
                           WHERE uf.user_id = u.user_id AND uf.active = 1
                       ) THEN 1 ELSE 0 END AS has_fingerprint
                FROM [USER] u
                LEFT JOIN UNIT un           ON un.unit_id  = u.unit_id
                LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = u.clearance_level_id
                WHERE u.user_id = @u
            `);

        if (r.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy user' });
        }

        const user = r.recordset[0];
        const rolesRes = await pool.request()
            .input('u', sql.VarChar(50), user.user_id)
            .query(`
                SELECT r.role_id, r.name FROM USER_ROLE ur
                JOIN [ROLE] r ON r.role_id = ur.role_id WHERE ur.user_id = @u
            `);
        user.roles = rolesRes.recordset.map(x => x.role_id);
        user.role_names = rolesRes.recordset.map(x => x.name);
        user.has_fingerprint = user.has_fingerprint === 1;

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 0b. FINGERPRINT — Đăng ký + Xác thực vân tay
// ═══════════════════════════════════════════════════════════════

// POST /api/auth/fingerprint/enroll — User đăng ký vân tay của mình
app.post('/api/auth/fingerprint/enroll', requireAuth, async (req, res) => {
    try {
        const { template } = req.body;
        if (!template || typeof template !== 'string' || template.length < 10) {
            return res.status(400).json({ error: 'Template vân tay không hợp lệ' });
        }

        const targetUserId = req.user.user_id;
        const encrypted = encryptTemplate(template);

        const pool = await getPool();
        await pool.request()
            .input('uid', sql.VarChar(50), targetUserId)
            .input('tpl', sql.NVarChar(sql.MAX), encrypted)
            .query(`
                MERGE USER_FINGERPRINT AS target
                USING (SELECT @uid AS user_id) AS src ON target.user_id = src.user_id
                WHEN MATCHED THEN
                    UPDATE SET template_enc = @tpl, active = 1, enrolled_at = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (user_id, template_enc) VALUES (@uid, @tpl);
            `);

        await writeAccessLog({
            userId: targetUserId, fileId: null,
            action: 'FINGERPRINT_ENROLL', ip: getClientIp(req),
            note: 'Đăng ký / cập nhật vân tay'
        });

        res.json({ success: true, message: 'Đăng ký vân tay thành công' });
    } catch (err) {
        console.error('[POST /api/auth/fingerprint/enroll]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/fingerprint/verify — Xác thực vân tay → cấp Access Token cho 1 file
app.post('/api/auth/fingerprint/verify', requireAuth, async (req, res) => {
    try {
        const { file_id, template } = req.body;
        if (!file_id || !template) {
            return res.status(400).json({ error: 'Thiếu file_id hoặc template' });
        }

        const pool = await getPool();

        // 1. Kiểm tra file có yêu cầu vân tay không
        const docRes = await pool.request()
            .input('file_id', sql.VarChar(50), file_id)
            .query(`SELECT security_level_id FROM DOCUMENT WHERE file_id = @file_id`);

        if (docRes.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
        }
        const doc = docRes.recordset[0];

        // Cấp 1-3: không cần vân tay
        if (doc.security_level_id < 4) {
            return res.json({ success: true, required: false, fingerprint_token: null });
        }

        // 2. Lấy template đã đăng ký
        const fpRes = await pool.request()
            .input('uid', sql.VarChar(50), req.user.user_id)
            .query(`SELECT template_enc FROM USER_FINGERPRINT WHERE user_id = @uid AND active = 1`);

        if (fpRes.recordset.length === 0) {
            return res.status(403).json({
                error: 'Bạn chưa đăng ký vân tay. Vui lòng đăng ký trước khi xem tài liệu Tối mật/Tuyệt mật.',
                needs_enroll: true
            });
        }

        // 3. Gọi Bridge để so khớp
        const storedTemplate = decryptTemplate(fpRes.recordset[0].template_enc);
        let match = false;
        try {
            const bridgeRes = await fetch(`${FINGERPRINT_BRIDGE_URL}/compare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template1: storedTemplate, template2: template }),
            });
            if (!bridgeRes.ok) {
                throw new Error(`Bridge HTTP ${bridgeRes.status}`);
            }
            const bridgeData = await bridgeRes.json();
            match = bridgeData.match === true;
        } catch (err) {
            console.error('[fingerprint-verify] Bridge error:', err.message);
            return res.status(503).json({
                error: 'Không kết nối được máy quét vân tay. Vui lòng kiểm tra thiết bị ZK9500 và Bridge (localhost:9000).',
                bridge_error: err.message
            });
        }

        if (!match) {
            await writeAccessLog({
                userId: req.user.user_id, fileId: file_id,
                action: 'FINGERPRINT_FAIL', ip: getClientIp(req),
                note: 'Vân tay không khớp'
            });
            return res.status(403).json({ error: 'Vân tay không khớp. Vui lòng thử lại.' });
        }

        // 4. Cấp token tạm (5 phút, gắn với file + user)
        const fpToken = jwt.sign(
            {
                user_id: req.user.user_id,
                file_id: file_id,
                purpose: 'file_access',
            },
            JWT_SECRET,
            { expiresIn: FINGERPRINT_TOKEN_EXPIRES_IN }
        );

        await writeAccessLog({
            userId: req.user.user_id, fileId: file_id,
            action: 'FINGERPRINT_OK', ip: getClientIp(req),
            note: `Xác thực vân tay OK → cấp token xem tài liệu cấp ${doc.security_level_id}`
        });

        res.json({
            success: true,
            required: true,
            fingerprint_token: fpToken,
            expires_in: FINGERPRINT_TOKEN_EXPIRES_IN,
        });
    } catch (err) {
        console.error('[POST /api/auth/fingerprint/verify]', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 1. HEALTH
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// 1.1 HTTP ERROR TEST
// ═══════════════════════════════════════════════════════════════
app.get('/api/test-http-error/:code', (req, res) => {
    const code = parseInt(req.params.code, 10) || 500;
    const msg = req.query.msg || `Mô phỏng phản hồi mã lỗi HTTP ${code} từ máy chủ Backend QK7 DataHub`;
    return res.status(code).json({
        ok: false, code, error: msg, timestamp: new Date().toISOString()
    });
});

// ═══════════════════════════════════════════════════════════════
// 2. DANH MỤC
// ═══════════════════════════════════════════════════════════════
app.get('/api/meta', async (req, res) => {
    try {
        const pool = await getPool();
        const [types, units, levels, ranks, positions] = await Promise.all([
            pool.request().query(`SELECT type_id, name, description FROM DOCUMENT_TYPE ORDER BY name`),
            pool.request().query(`
                SELECT u.unit_id, u.name, u.parent_id, p.name AS parent_name
                FROM UNIT u LEFT JOIN UNIT p ON p.unit_id = u.parent_id ORDER BY u.name
            `),
            pool.request().query(`SELECT level_id, code, name FROM SECURITY_LEVEL ORDER BY level_id`),
            pool.request().query(`SELECT rank_id, name, sort_order FROM MILITARY_RANK WHERE active = 1 ORDER BY sort_order, name`),
            pool.request().query(`SELECT position_id, name, sort_order FROM MILITARY_POSITION WHERE active = 1 ORDER BY sort_order, name`)
        ]);
        res.json({
            types: types.recordset,
            units: units.recordset,
            levels: levels.recordset,
            ranks: ranks.recordset,
            positions: positions.recordset
        });
    } catch (e) {
        console.error('[GET /api/meta]', e);
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 3. TÌM KIẾM TÀI LIỆU (GUEST OK — giới hạn bởi clearance)
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// 3b. CHI TIẾT 1 TÀI LIỆU
// ═══════════════════════════════════════════════════════════════
app.get('/api/documents/:fileId', async (req, res) => {
    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('file_id', sql.VarChar(50), req.params.fileId)
            .query(`
                SELECT d.*,
                       d.doc_type_id AS type_id, dt.name AS doc_type_name,
                       dt.name AS type_name, u.name AS unit_name,
                       d.issuing_unit_id AS unit_id, d.issued_date AS issue_date,
                       d.file_size AS file_size_bytes,
                       sl.name AS security_name, sl.name AS security_level_name
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

// ═══════════════════════════════════════════════════════════════
// 4. UPLOAD (yêu cầu đăng nhập)
// ═══════════════════════════════════════════════════════════════
app.post('/api/documents/upload', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Thiếu file PDF' });

        const docTypeId = req.body.doc_type_id || req.body.type_id || null;
        const issuingUnitId = req.body.issuing_unit_id || req.body.unit_id || null;
        const issuedDate = req.body.issued_date || req.body.issue_date || null;
        const securityLevelId = req.body.security_level_id || req.body.level_id;
        const documentCode = req.body.document_code || req.body.code || null;
        const title = req.body.title;
        const signer = req.body.signer || null;
        const summary = req.body.summary || null;

        if (!title || !title.trim()) return res.status(400).json({ error: 'Thiếu trích yếu' });
        if (!securityLevelId) return res.status(400).json({ error: 'Thiếu mức bảo mật' });

        const fileId = 'DOC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
        const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
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

        // Bất đồng bộ báo cho AI_BOXCHAT lập chỉ mục số trang
        fetch('http://127.0.0.1:8001/ai/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_id: fileId,
                document_code: documentCode || fileId,
                title: title.trim(),
                stored_path: relPath,
                security_level_id: parseInt(securityLevelId, 10)
            })
        }).catch(() => {
            // Không làm gián đoạn phản hồi nếu AI service đang offline
        });

        res.json({
            success: true,
            file_id: fileId,
            stored_path: relPath,
            sha256
            userId: req.user.user_id, fileId, action: 'UPLOAD',
            ip: req.ip || '', note: `Upload: ${req.file.originalname}`
        });

        res.json({ success: true, file_id: fileId, stored_path: relPath, sha256 });
    } catch (err) {
        console.error('[POST /api/documents/upload]', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 5. CẬP NHẬT (yêu cầu đăng nhập)
// ═══════════════════════════════════════════════════════════════
app.put('/api/documents/:fileId', requireAuth, upload.single('file'), async (req, res) => {
    const fileId = req.params.fileId;
    try {
        const pool = await getPool();
        const exist = await pool.request()
            .input('file_id', sql.VarChar(50), fileId)
            .query(`SELECT stored_path, original_name, sha256 FROM DOCUMENT WHERE file_id = @file_id`);

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

        if (!title || !title.trim()) return res.status(400).json({ error: 'Thiếu trích yếu' });
        if (!securityLevelId) return res.status(400).json({ error: 'Thiếu mức bảo mật' });

        let storedPath = oldDoc.stored_path;
        let originalName = oldDoc.original_name;
        let mimeType = 'application/pdf';
        let fileSize = null;
        let sha256 = oldDoc.sha256;
        let replacedFile = false;

        if (req.file) {
            const { yyyy, mm, yyyymmdd, typeSafe, codeSafe } =
                buildStoredPath({ docTypeId, documentCode, fallbackId: fileId });

            sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
            const sha8 = sha256.slice(0, 8);
            const fileName = `${yyyymmdd}_${typeSafe}_${codeSafe}_${sha8}.pdf`;
            const relPath = `uploads/${yyyy}/${mm}/${fileName}`;
            const absPath = path.join(ROOT_DIR, relPath);

            fs.mkdirSync(path.dirname(absPath), { recursive: true });
            fs.writeFileSync(absPath, req.file.buffer);

            const oldAbs = path.join(ROOT_DIR, oldDoc.stored_path);
            if (oldAbs !== absPath && fs.existsSync(oldAbs) && oldAbs.startsWith(PDF_ROOT)) {
                try { fs.unlinkSync(oldAbs); } catch (e) {
                    console.error('[update] Xóa file cũ lỗi:', e.message);
                }
            }

            storedPath = relPath;
            originalName = req.file.originalname;
            mimeType = req.file.mimetype;
            fileSize = req.file.size;
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
              document_code = @document_code, title = @title, doc_type_id = @doc_type_id,
              issued_date = @issued_date, issuing_unit_id = @issuing_unit_id,
              signer = @signer, summary = @summary,
              security_level_id = @security_level_id,
              stored_path = @stored_path, original_name = @original_name,
              mime_type = @mime_type, updated_at = GETDATE()
        `;

        if (replacedFile) {
            updateQuery += `, file_size = @file_size, sha256 = @sha256`;
            reqUpdate.input('file_size', sql.BigInt, fileSize);
            reqUpdate.input('sha256', sql.Char(64), sha256);
        }
        updateQuery += ` WHERE file_id = @file_id`;

        await reqUpdate.query(updateQuery);

        await writeAccessLog({
            userId: req.user.user_id, fileId, action: 'UPDATE',
            ip: req.ip || '',
            note: replacedFile ? `Sửa metadata + thay file: ${originalName}` : `Sửa metadata: ${title.trim()}`
        });

        res.json({ success: true, file_id: fileId, replaced_file: replacedFile, stored_path: storedPath });
    } catch (err) {
        console.error('[PUT /api/documents/:id]', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 6. XÓA (yêu cầu đăng nhập)
// ═══════════════════════════════════════════════════════════════
app.delete('/api/documents/:fileId', requireAuth, async (req, res) => {
    const fileId = req.params.fileId;
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('file_id', sql.VarChar(50), fileId)
            .query(`SELECT stored_path, original_name FROM DOCUMENT WHERE file_id = @file_id`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
        }

        const doc = result.recordset[0];
        const filePath = path.join(ROOT_DIR, doc.stored_path);

        if (fs.existsSync(filePath) && filePath.startsWith(PDF_ROOT)) {
            try { fs.unlinkSync(filePath); } catch (e) {
                console.error('[delete file]', e.message);
            }
        }

        await pool.request()
            .input('file_id', sql.VarChar(50), fileId)
            .query(`DELETE FROM ACCESS_LOG WHERE file_id = @file_id`);
        await pool.request()
            .input('file_id', sql.VarChar(50), fileId)
            .query(`DELETE FROM DOCUMENT WHERE file_id = @file_id`);

        await writeAccessLog({
            userId: req.user.user_id, fileId: null, action: 'DELETE',
            ip: req.ip || '', note: `Xóa tài liệu ${fileId} (${doc.original_name})`
        });

        res.json({ success: true, file_id: fileId });
    } catch (err) {
        console.error('[DELETE /api/documents/:id]', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 7. XEM / TẢI PDF — Cấp 4-5 yêu cầu fingerprint token
// ═══════════════════════════════════════════════════════════════
app.get('/api/files/:fileId/view', async (req, res) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const fileId = req.params.fileId;
    const isDownload = req.query.download === '1';

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('file_id', sql.VarChar(50), fileId)
            .query(`SELECT stored_path, original_name, mime_type, security_level_id
                    FROM DOCUMENT WHERE file_id = @file_id`);

        if (result.recordset.length === 0) {
            await writeAccessLog({
                userId: req.user.user_id, fileId,
                action: 'DENIED', ip, note: 'Không tìm thấy tài liệu'
            });
            return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
        }

        const doc = result.recordset[0];

        // Kiểm tra clearance
        if (doc.security_level_id > req.user.clearance_level_id) {
            await writeAccessLog({
                userId: req.user.user_id, fileId, action: 'DENIED', ip,
                note: `Cần mức ${doc.security_level_id} để xem, user có mức ${req.user.clearance_level_id}`
            });
            return res.status(403).json({
                error: `Cấp độ bảo mật của bạn không đủ để ${isDownload ? 'tải về' : 'xem'} tài liệu này`
            });
        }

        // ═══ Cấp 4-5: yêu cầu fingerprint token ═══
        if (doc.security_level_id >= 4) {
            if (!req.user.is_authenticated) {
                return res.status(401).json({
                    error: 'Tài liệu Tối mật/Tuyệt mật yêu cầu đăng nhập',
                    require_fingerprint: true
                });
            }

            const fpToken = req.headers['x-fingerprint-token'];
            if (!fpToken) {
                await writeAccessLog({
                    userId: req.user.user_id, fileId, action: 'DENIED', ip,
                    note: `Thiếu fingerprint token cho tài liệu cấp ${doc.security_level_id}`
                });
                return res.status(403).json({
                    error: 'Tài liệu Tối mật/Tuyệt mật yêu cầu xác thực vân tay',
                    require_fingerprint: true
                });
            }

            try {
                const decoded = jwt.verify(fpToken, JWT_SECRET);
                if (decoded.purpose !== 'file_access') throw new Error('Sai purpose');
                if (decoded.file_id !== fileId) throw new Error('Token không khớp file');
                if (decoded.user_id !== req.user.user_id) throw new Error('Token không khớp user');
            } catch (err) {
                await writeAccessLog({
                    userId: req.user.user_id, fileId, action: 'DENIED', ip,
                    note: `Fingerprint token không hợp lệ: ${err.message}`
                });
                return res.status(403).json({
                    error: 'Phiên xác thực vân tay đã hết hạn. Vui lòng quét lại.',
                    require_fingerprint: true
                });
            }
        }

        // Cấp 3+: không cho tải về
        if (isDownload && doc.security_level_id >= 3) {
            await writeAccessLog({
                userId: req.user.user_id, fileId, action: 'DENIED', ip,
                note: `Từ chối tải về: Tài liệu Cấp ${doc.security_level_id} chỉ cho phép xem`
            });
            return res.status(403).json({
                error: 'Tài liệu từ Cấp 3 trở lên chỉ duy nhất cho phép xem trực tiếp, không được phép tải về máy.'
            });
        }

        const filePath = path.join(ROOT_DIR, doc.stored_path);
        if (!filePath.startsWith(PDF_ROOT)) {
            return res.status(400).json({ error: 'Đường dẫn không hợp lệ' });
        }
        if (!fs.existsSync(filePath)) {
            await writeAccessLog({
                userId: req.user.user_id, fileId, action: 'ERROR', ip,
                note: 'File không tồn tại trên ổ đĩa'
            });
            return res.status(404).json({ error: 'File không tồn tại: ' + doc.stored_path });
        }

        await writeAccessLog({
            userId: req.user.user_id, fileId,
            action: isDownload ? 'DOWNLOAD' : 'VIEW', ip
        });

        res.setHeader('Content-Type', doc.mime_type || 'application/pdf');
        res.setHeader('Content-Disposition',
            `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.original_name)}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        console.error('[GET /api/files/:id/view]', err);
        try {
            await writeAccessLog({
                userId: req.user.user_id, fileId, action: 'ERROR', ip, note: err.message
            });
        } catch (_) {}
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// 8. NHẬT KÝ (admin — clearance >= 4)
// ═══════════════════════════════════════════════════════════════
app.get('/api/access-logs', requireAuth, async (req, res) => {
    try {
        if (req.user.clearance_level_id < 4) {
            return res.status(403).json({ error: 'Cần quyền quản trị (mức 4+)' });
        }

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

// ─── Multer error handler ───
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

// ─── AI Assistant routes ───
app.use('/api/ai', require('./src/ai-routes'));

// ─── Admin CRUD routes ───
require('./src/admin-routes')(app, { sql, getPool, writeAccessLog });
// ─── Lấy IP client (xử lý qua proxy/nginx) ───

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (giữ nguyên vị trí — function declarations hoisted)
// ═══════════════════════════════════════════════════════════════
function getClientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
    return (req.ip || req.connection?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

async function checkIpBlocked(ip) {
    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('ip', sql.VarChar(50), ip)
            .query(`SELECT ip, blocked_until, reason FROM IP_BLOCKLIST
                    WHERE ip = @ip AND blocked_until > GETDATE()`);
        if (r.recordset.length > 0) {
            return { blocked: true, ...r.recordset[0] };
        }
        await pool.request()
            .input('ip', sql.VarChar(50), ip)
            .query(`DELETE FROM IP_BLOCKLIST WHERE ip = @ip AND blocked_until <= GETDATE()`);
        return { blocked: false };
    } catch (err) {
        console.error('[checkIpBlocked]', err.message);
        return { blocked: false };
    }
}

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
                        USING (SELECT @ip AS ip) AS src ON target.ip = src.ip
                        WHEN MATCHED THEN UPDATE SET blocked_until = @until, reason = @reason, blocked_at = GETDATE()
                        WHEN NOT MATCHED THEN INSERT (ip, blocked_until, reason) VALUES (@ip, @until, @reason);`);
            console.warn(`[IPBLOCK] Đã chặn IP ${ip} trong ${IPBLOCK_DURATION_MINUTES} phút (${count} lần dò username)`);
            return true;
        }
        return false;
    } catch (err) {
        console.error('[checkAndBlockIp]', err.message);
        return false;
    }
}

// ─── SPA Fallback ───
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

// ═══════════════════════════════════════════════════════════════
// 9. PARSE PDF (yêu cầu đăng nhập — tránh lạm dụng OCR)
// ═══════════════════════════════════════════════════════════════
const { parseDocumentPdf } = require('./pdf-parser');

app.post('/api/documents/parse', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Thiếu file PDF' });
        }

        const result = await parseDocumentPdf(req.file.buffer, { sql, getPool });

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

// ═══════════════════════════════════════════════════════════════
// KHỞI ĐỘNG
// ═══════════════════════════════════════════════════════════════
async function start() {
    if (!fs.existsSync(PDF_ROOT)) {
        fs.mkdirSync(PDF_ROOT, { recursive: true });
        console.log(`[FS] Đã tạo thư mục: ${PDF_ROOT}`);
    }

    const ok = await testConnection();
    if (!ok) {
        console.error('Không thể kết nối database. Kiểm tra .env và SQL Server.');
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log('');
        console.log('  ╔════════════════════════════════════════════════════╗');
        console.log('  ║  QK7 Paperless Gateway                             ║');
        console.log('  ╠════════════════════════════════════════════════════╣');
        console.log(`  ║  Web:      http://localhost:${PORT}                    ║`);
        console.log(`  ║  Swagger:  http://localhost:${PORT}/api-docs           ║`);
        console.log(`  ║  PDF root: ${PDF_ROOT.substring(0, 30)}...             ║`);
        console.log('  ╠════════════════════════════════════════════════════╣');
        console.log('  ║  BẢO MẬT:                                          ║');
        console.log(`  ║  • JWT:    ${process.env.JWT_SECRET ? 'ĐÃ SET ✅' : 'MẶC ĐỊNH ⚠️ '}                              ║`);
        console.log(`  ║  • Legacy: ${ALLOW_LEGACY_AUTH ? 'BẬT ⚠️  (không an toàn)' : 'TẮT ✅'}                ║`);
        console.log(`  ║  • Finger: ${FP_ENC_KEY ? 'ĐÃ MÃ HÓA ✅' : 'PLAINTEXT ⚠️ '}                          ║`);
        console.log('  ╚════════════════════════════════════════════════════╝');
        console.log('');
    });
}

start();

process.on('SIGINT', async () => { await closePool(); process.exit(0); });
process.on('SIGTERM', async () => { await closePool(); process.exit(0); });