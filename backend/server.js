// server.js — QK7 Paperless Gateway (v3.0 — JWT + Fingerprint WS)
// Nguồn: SQL Server (metadata) + ổ đĩa server (PDF) + WebSocket (Agent ZK9500)

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { sql, getPool, closePool, testConnection } = require('./src/db');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const {
  setupFingerprintWS, requestScan, requestEnroll,
  isAgentOnline, listAgents,
} = require('./src/fingerprint-ws');

const app = express();
const PORT = process.env.PORT || 8000;
const ROOT_DIR = __dirname;
const PDF_ROOT = path.join(ROOT_DIR, 'uploads');
const publicDir = path.join(ROOT_DIR, 'public');

const JWT_SECRET = process.env.JWT_SECRET || 'QK7-DEV-SECRET-CHANGE-IN-PROD-' + crypto.randomBytes(16).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const FINGERPRINT_TOKEN_EXPIRES_IN = '5m';
const ALLOW_LEGACY_AUTH = (process.env.ALLOW_LEGACY_AUTH || 'true').toLowerCase() === 'true';
const BRIDGE_TOKEN = process.env.FINGERPRINT_BRIDGE_TOKEN || '';

const FP_ENC_KEY = process.env.FP_ENC_KEY
  ? crypto.scryptSync(process.env.FP_ENC_KEY, 'qk7-fp-salt', 32)
  : null;

const LOCKOUT_MAX_ATTEMPTS = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '6', 10);
const LOCKOUT_WINDOW_MINUTES = parseInt(process.env.LOCKOUT_WINDOW_MINUTES || '15', 10);
const IPBLOCK_MAX_ATTEMPTS = parseInt(process.env.IPBLOCK_MAX_ATTEMPTS || '6', 10);
const IPBLOCK_WINDOW_MINUTES = parseInt(process.env.IPBLOCK_WINDOW_MINUTES || '15', 10);
const IPBLOCK_DURATION_MINUTES = parseInt(process.env.IPBLOCK_DURATION_MINUTES || '30', 10);

if (!process.env.JWT_SECRET) {
  console.warn('[SECURITY] ⚠️  JWT_SECRET chưa set — dùng default random.');
}
if (ALLOW_LEGACY_AUTH) {
  console.warn('[SECURITY] ⚠️  ALLOW_LEGACY_AUTH=true');
}
if (!BRIDGE_TOKEN || BRIDGE_TOKEN.length < 16) {
  console.warn('[SECURITY] ⚠️  FINGERPRINT_BRIDGE_TOKEN thiếu hoặc <16 ký tự');
}
if (!FP_ENC_KEY) {
  console.warn('[SECURITY] ⚠️  FP_ENC_KEY chưa set — template vân tay lưu plaintext.');
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.disable('x-powered-by');

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

const ENABLE_SWAGGER = (process.env.ENABLE_SWAGGER || 'true').toLowerCase() === 'true';
if (ENABLE_SWAGGER) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: `.swagger-ui .topbar { display: none }`,
    customSiteTitle: 'QK7 DataHub API',
    swaggerOptions: { persistAuthorization: true, filter: true, tryItOutEnabled: true },
  }));
  app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
  console.log('[SWAGGER] Enabled at /api-docs');
}

app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('Không tìm thấy public/index.html');
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Chỉ chấp nhận file PDF'));
  },
});

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.removeHeader('ETag');

  const isPublic =
    req.path === '/auth/login' ||
    req.path === '/health' ||
    req.path === '/meta' ||
    req.path.startsWith('/test-http-error');
  if (isPublic) return next();

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
        error: 'Token không hợp lệ hoặc hết hạn',
        code: 'TOKEN_INVALID',
      });
    }
  }

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

  req.user = {
    user_id: 'GUEST',
    clearance_level_id: 1,
    roles: [],
    is_authenticated: false,
  };
  next();
});

function requireAuth(req, res, next) {
  if (!req.user || !req.user.is_authenticated) {
    return res.status(401).json({ error: 'Cần đăng nhập để thực hiện thao tác này' });
  }
  next();
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.ip || req.connection?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

async function writeAccessLog({ userId, fileId, action, ip, note = null }) {
  try {
    const pool = await getPool();
    const logId = 'LOG-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const validUserId = (userId && userId !== 'GUEST' && userId !== 'UNKNOWN') ? userId : null;
    await pool.request()
      .input('log_id',  sql.VarChar(50),   logId)
      .input('user_id', sql.VarChar(50),   validUserId)
      .input('file_id', sql.VarChar(50),   fileId || null)
      .input('action',  sql.VarChar(50),   action)
      .input('ip',      sql.VarChar(50),   ip || '')
      .input('note',    sql.NVarChar(255), note ? String(note).slice(0, 255) : null)
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

function encryptTemplate(buffer) {
  if (!FP_ENC_KEY) return buffer.toString('base64');  // fallback: base64
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', FP_ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:' + Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptTemplate(encoded) {
  // Trả Buffer (binary), không trả string
  if (!encoded) return null;
  if (!FP_ENC_KEY || !encoded.startsWith('enc:')) {
    // Legacy plaintext base64
    return Buffer.from(encoded, 'base64');
  }
  try {
    const buf = Buffer.from(encoded.slice(4), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', FP_ENC_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  } catch (err) {
    console.error('[decryptTemplate] Lỗi giải mã:', err.message);
    return null;
  }
}

async function checkIpBlocked(ip) {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('ip', sql.VarChar(50), ip)
      .query(`SELECT ip, blocked_until, reason FROM IP_BLOCKLIST
              WHERE ip = @ip AND blocked_until > GETDATE()`);
    if (r.recordset.length > 0) return { blocked: true, ...r.recordset[0] };
    await pool.request()
      .input('ip', sql.VarChar(50), ip)
      .query(`DELETE FROM IP_BLOCKLIST WHERE ip = @ip AND blocked_until <= GETDATE()`);
    return { blocked: false };
  } catch (err) {
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
              WHERE ip = @ip AND result = 'USERNAME_NOT_FOUND'
                AND attempted_at >= DATEADD(MINUTE, -@window, GETDATE())`);
    const count = r.recordset[0].n;
    if (count >= IPBLOCK_MAX_ATTEMPTS) {
      const until = new Date(Date.now() + IPBLOCK_DURATION_MINUTES * 60000);
      await pool.request()
        .input('ip',     sql.VarChar(50),   ip)
        .input('until',  sql.DateTime,      until)
        .input('reason', sql.NVarChar(200), `Dò username ${count} lần`)
        .query(`MERGE IP_BLOCKLIST AS target
                USING (SELECT @ip AS ip) AS src ON target.ip = src.ip
                WHEN MATCHED THEN UPDATE SET blocked_until = @until, reason = @reason, blocked_at = GETDATE()
                WHEN NOT MATCHED THEN INSERT (ip, blocked_until, reason) VALUES (@ip, @until, @reason);`);
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

app.post('/api/auth/login', async (req, res) => {
  const ip = getClientIp(req);
  try {
    const { user_id, password } = req.body;
    if (!user_id || !password) {
      return res.status(400).json({ error: 'Thiếu user_id hoặc password' });
    }
    const username = user_id.trim().toLowerCase();

    const ipCheck = await checkIpBlocked(ip);
    if (ipCheck.blocked) {
      const minsLeft = Math.max(1, Math.ceil((new Date(ipCheck.blocked_until) - Date.now()) / 60000));
      return res.status(429).json({ error: `IP bị chặn tạm thời. Thử lại sau ${minsLeft} phút.` });
    }

    const pool = await getPool();
    const r = await pool.request()
      .input('u', sql.VarChar(50), username)
      .query(`
        SELECT u.user_id, u.username, u.full_name, u.[rank] AS rank_name,
               u.[position], u.unit_id, u.status,
               u.password_hash, u.pin_hash, u.clearance_level_id,
               u.failed_attempts, u.locked_at, u.last_failed_at,
               un.name AS unit_name,
               sl.name AS clearance_name, sl.code AS clearance_code,
               CASE WHEN EXISTS (
                 SELECT 1 FROM USER_FINGERPRINT uf
                 WHERE uf.user_id = u.user_id AND uf.active = 1
               ) THEN 1 ELSE 0 END AS has_fingerprint
        FROM [USER] u
        LEFT JOIN UNIT un ON un.unit_id = u.unit_id
        LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = u.clearance_level_id
        WHERE LOWER(u.username) = @u OR LOWER(u.user_id) = @u
      `);

    if (r.recordset.length === 0) {
      await writeLoginAttempt({ ip, username, result: 'USERNAME_NOT_FOUND' });
      await checkAndBlockIp(ip);
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    const user = r.recordset[0];

    if (user.status !== 'active') {
      await writeLoginAttempt({ ip, username, result: 'LOCKED' });
      return res.status(403).json({
        error: user.status === 'locked' ? 'Tài khoản đã bị khóa.' : 'Tài khoản đã bị vô hiệu hóa.',
      });
    }

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

    const pwdHash = user.password_hash || user.pin_hash;
    if (!pwdHash) {
      await writeLoginAttempt({ ip, username, result: 'WRONG_PASSWORD' });
      return res.status(403).json({ error: 'Tài khoản chưa được cấp mật khẩu' });
    }

    const ok = await bcrypt.compare(password, pwdHash);
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

      if (willLock) {
        return res.status(403).json({ error: `Tài khoản đã bị khóa do sai ${LOCKOUT_MAX_ATTEMPTS} lần.` });
      }
      return res.status(401).json({ error: 'Mật khẩu không đúng.' });
    }

    await pool.request()
      .input('uid', sql.VarChar(50), user.user_id)
      .query(`UPDATE [USER] SET failed_attempts = 0, locked_at = NULL,
                               last_failed_at = NULL, status = 'active' WHERE user_id = @uid`);

    await writeLoginAttempt({ ip, username, result: 'SUCCESS' });
    await writeAccessLog({
      userId: user.user_id, fileId: null, action: 'LOGIN', ip,
      note: `${user.full_name} (mức ${user.clearance_level_id})`,
    });

    delete user.password_hash;
    delete user.pin_hash;
    delete user.failed_attempts;
    delete user.locked_at;
    delete user.last_failed_at;

    const rolesRes = await pool.request()
      .input('uid', sql.VarChar(50), user.user_id)
      .query(`SELECT r.role_id, r.name FROM USER_ROLE ur
              JOIN [ROLE] r ON r.role_id = ur.role_id WHERE ur.user_id = @uid`);
    user.roles = rolesRes.recordset.map((x) => x.role_id);
    user.role_names = rolesRes.recordset.map((x) => x.name);
    user.has_fingerprint = user.has_fingerprint === 1;

    const token = jwt.sign(
      {
        user_id: user.user_id,
        clearance_level_id: user.clearance_level_id,
        roles: user.roles,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ success: true, token, expires_in: JWT_EXPIRES_IN, user });
  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.user?.user_id || req.user.user_id === 'GUEST') {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }
    const pool = await getPool();
    const r = await pool.request()
      .input('u', sql.VarChar(50), req.user.user_id)
      .query(`
        SELECT u.user_id, u.username, u.full_name, u.[rank] AS rank_name, u.[position],
               u.unit_id, un.name AS unit_name, u.status,
               u.clearance_level_id, sl.name AS clearance_name, sl.code AS clearance_code,
               CASE WHEN EXISTS (
                 SELECT 1 FROM USER_FINGERPRINT uf
                 WHERE uf.user_id = u.user_id AND uf.active = 1
               ) THEN 1 ELSE 0 END AS has_fingerprint
        FROM [USER] u
        LEFT JOIN UNIT un ON un.unit_id = u.unit_id
        LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = u.clearance_level_id
        WHERE u.user_id = @u
      `);
    if (r.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });

    const user = r.recordset[0];
    const rolesRes = await pool.request()
      .input('u', sql.VarChar(50), user.user_id)
      .query(`SELECT r.role_id, r.name FROM USER_ROLE ur
              JOIN [ROLE] r ON r.role_id = ur.role_id WHERE ur.user_id = @u`);
    user.roles = rolesRes.recordset.map((x) => x.role_id);
    user.role_names = rolesRes.recordset.map((x) => x.name);
    user.has_fingerprint = user.has_fingerprint === 1;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/fingerprint/verify', requireAuth, async (req, res) => {
  try {
    const { file_id } = req.body;
    const deviceId = req.headers['x-device-fp'];
    if (!file_id) return res.status(400).json({ error: 'Thiếu file_id' });
    if (!deviceId) {
      return res.status(400).json({
        error: 'Chưa kết nối máy quét vân tay trên máy này. Vui lòng bật Fingerprint Agent.',
        agent_offline: true,
      });
    }

    const pool = await getPool();

    const docRes = await pool.request()
      .input('file_id', sql.VarChar(50), file_id)
      .query(`SELECT security_level_id FROM DOCUMENT WHERE file_id = @file_id`);
    if (docRes.recordset.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    }
    const doc = docRes.recordset[0];
    if (doc.security_level_id < 3) { // Không cần vân tay cho tài liệu mức < 3
      return res.json({ success: true, required: false, fingerprint_token: null });
    }

    const fpRes = await pool.request()
      .input('uid', sql.VarChar(50), req.user.user_id)
      .query(`SELECT template_enc FROM USER_FINGERPRINT WHERE user_id = @uid AND active = 1`);
    if (fpRes.recordset.length === 0) {
      return res.status(403).json({
        error: 'Bạn chưa đăng ký vân tay. Vui lòng liên hệ quản trị viên.',
        needs_enroll: true,
      });
    }

    const templateBuffer = decryptTemplate(fpRes.recordset[0].template_enc);
    if (!templateBuffer || templateBuffer.length < 100) {
      return res.status(500).json({
        error: 'Template vân tay lưu trong DB bị hỏng. Vui lòng enroll lại.'
      });
    }
    const templateB64 = templateBuffer.toString('base64');

    if (!isAgentOnline(deviceId)) {
      return res.status(503).json({
        error: 'Máy quét vân tay chưa sẵn sàng. Kiểm tra Fingerprint Agent.',
        agent_offline: true,
      });
    }

    let scanResult;
    try {
      scanResult = await requestScan(deviceId, { template_b64: templateB64, file_id });
    } catch (err) {
      if (err.message === 'AGENT_OFFLINE' || err.message === 'AGENT_DISCONNECTED') {
        return res.status(503).json({ error: 'Máy quét vừa mất kết nối.', agent_offline: true });
      }
      if (err.message === 'SCAN_TIMEOUT') {
        await writeAccessLog({
          userId: req.user.user_id, fileId: file_id,
          action: 'FINGERPRINT_FAIL', ip: getClientIp(req),
          note: 'Timeout chờ quét vân tay',
        });
        return res.status(408).json({ error: 'Hết thời gian chờ quét vân tay.' });
      }
      throw err;
    }

    if (!scanResult.match) {
      const note = scanResult.error ? `Lỗi: ${scanResult.error}` : `Không khớp (score=${scanResult.score})`;
      await writeAccessLog({
        userId: req.user.user_id, fileId: file_id,
        action: 'FINGERPRINT_FAIL', ip: getClientIp(req), note,
      });
      return res.status(403).json({
        error: scanResult.error === 'TIMEOUT'
          ? 'Hết thời gian chờ quét vân tay.'
          : `Vân tay không khớp (score=${scanResult.score}). Vui lòng thử lại.`,
        score: scanResult.score,
      });
    }

    const fpToken = jwt.sign(
      { user_id: req.user.user_id, file_id, purpose: 'file_access' },
      JWT_SECRET,
      { expiresIn: FINGERPRINT_TOKEN_EXPIRES_IN }
    );

    await writeAccessLog({
      userId: req.user.user_id, fileId: file_id,
      action: 'FINGERPRINT_OK', ip: getClientIp(req),
      note: `Xác thực OK (score=${scanResult.score}, device=${deviceId})`,
    });

    res.json({
      success: true, required: true,
      fingerprint_token: fpToken, expires_in: FINGERPRINT_TOKEN_EXPIRES_IN,
      score: scanResult.score,
    });
  } catch (err) {
    console.error('[fingerprint/verify]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/fingerprint/enroll/:userId', requireAuth, async (req, res) => {
  try {
    if ((req.user.clearance_level_id || 0) < 4) {
      return res.status(403).json({ error: 'Cần quyền quản trị (mức 4+)' });
    }
    const targetUserId = req.params.userId;
    const deviceId = req.headers['x-device-fp'];
    if (!deviceId) {
      return res.status(400).json({
        error: 'Chưa kết nối máy quét. Bật Fingerprint Agent trước khi enroll.',
        agent_offline: true,
      });
    }
    if (!isAgentOnline(deviceId)) {
      return res.status(503).json({ error: 'Agent chưa online.', agent_offline: true });
    }

    const pool = await getPool();
    const uRes = await pool.request()
      .input('uid', sql.VarChar(50), targetUserId)
      .query(`SELECT user_id, full_name FROM [USER] WHERE user_id = @uid`);
    if (uRes.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });

    let enrollResult;
    try {
      enrollResult = await requestEnroll(deviceId, { user_id: targetUserId, timeout_seconds: 60 });
    } catch (err) {
      if (err.message === 'AGENT_OFFLINE' || err.message === 'AGENT_DISCONNECTED') {
        return res.status(503).json({ error: 'Agent mất kết nối.', agent_offline: true });
      }
      if (err.message === 'ENROLL_TIMEOUT') {
        return res.status(408).json({ error: 'Hết thời gian chờ quét 3 lần (60s).' });
      }
      throw err;
    }

    if (!enrollResult.success || !enrollResult.template_b64) {
      return res.status(400).json({ error: enrollResult.error || 'Enroll thất bại' });
    }

    const templateBuffer = Buffer.from(enrollResult.template_b64, 'base64');
    const encrypted = encryptTemplate(templateBuffer);

    await pool.request()
      .input('uid', sql.VarChar(50), targetUserId)
      .input('tpl', sql.NVarChar(sql.MAX), encrypted)
      .query(`
        MERGE USER_FINGERPRINT AS t
        USING (SELECT @uid AS user_id) AS s ON t.user_id = s.user_id
        WHEN MATCHED THEN
          UPDATE SET template_enc = @tpl, active = 1, enrolled_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, template_enc, active) VALUES (@uid, @tpl, 1);
      `);

    await writeAccessLog({
      userId: req.user.user_id, fileId: null,
      action: 'FINGERPRINT_ENROLL', ip: getClientIp(req),
      note: `Enroll vân tay cho ${targetUserId} qua ${deviceId}`,
    });

    res.json({ success: true, user_id: targetUserId });
  } catch (err) {
    console.error('[admin/fingerprint/enroll]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/fingerprint/agents', requireAuth, (req, res) => {
  if ((req.user.clearance_level_id || 0) < 4) {
    return res.status(403).json({ error: 'Cần quyền quản trị (mức 4+)' });
  }
  res.json({ items: listAgents() });
});

app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`SELECT DB_NAME() AS db, GETDATE() AS now`);
    res.json({ ok: true, ...r.recordset[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/test-http-error/:code', (req, res) => {
  const code = parseInt(req.params.code, 10) || 500;
  const msg = req.query.msg || `Mô phỏng lỗi HTTP ${code}`;
  return res.status(code).json({ ok: false, code, error: msg, timestamp: new Date().toISOString() });
});

app.get('/api/meta', async (req, res) => {
  try {
    const pool = await getPool();
    const [types, units, levels, ranks, positions] = await Promise.all([
      pool.request().query(`SELECT type_id, name, description FROM DOCUMENT_TYPE ORDER BY name`),
      pool.request().query(`SELECT u.unit_id, u.name, u.parent_id, p.name AS parent_name
                            FROM UNIT u LEFT JOIN UNIT p ON p.unit_id = u.parent_id ORDER BY u.name`),
      pool.request().query(`SELECT level_id, code, name FROM SECURITY_LEVEL ORDER BY level_id`),
      pool.request().query(`SELECT rank_id, name, sort_order FROM MILITARY_RANK WHERE active = 1 ORDER BY sort_order, name`),
      pool.request().query(`SELECT position_id, name, sort_order FROM MILITARY_POSITION WHERE active = 1 ORDER BY sort_order, name`),
    ]);
    res.json({
      types: types.recordset, units: units.recordset, levels: levels.recordset,
      ranks: ranks.recordset, positions: positions.recordset,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/documents', async (req, res) => {
  try {
    const pool = await getPool();
    const r = pool.request();
    let query = `
      SELECT d.file_id, d.document_code, d.title,
             d.doc_type_id, dt.name AS doc_type_name,
             d.issued_date, d.issuing_unit_id, u.name AS unit_name,
             d.signer, d.file_size, d.summary,
             d.security_level_id, sl.name AS security_name,
             d.created_at, d.updated_at
      FROM DOCUMENT d
      LEFT JOIN DOCUMENT_TYPE dt ON dt.type_id = d.doc_type_id
      LEFT JOIN UNIT u ON u.unit_id = d.issuing_unit_id
      JOIN SECURITY_LEVEL sl ON sl.level_id = d.security_level_id
      WHERE d.security_level_id <= @clearance
    `;
    r.input('clearance', sql.Int, req.user.clearance_level_id);
    if (req.query.code) { query += ` AND d.document_code LIKE '%' + @code + '%'`; r.input('code', sql.NVarChar(100), req.query.code); }
    if (req.query.title) { query += ` AND d.title LIKE N'%' + @title + N'%'`; r.input('title', sql.NVarChar(500), req.query.title); }
    if (req.query.type) { query += ` AND d.doc_type_id = @type`; r.input('type', sql.VarChar(20), req.query.type); }
    if (req.query.unit) { query += ` AND d.issuing_unit_id = @unit`; r.input('unit', sql.VarChar(50), req.query.unit); }
    if (req.query.from) { query += ` AND d.issued_date >= @from`; r.input('from', sql.Date, req.query.from); }
    if (req.query.to) { query += ` AND d.issued_date <= @to`; r.input('to', sql.Date, req.query.to); }
    if (req.query.lv) {
      const maxAllowed = Math.min(parseInt(req.query.lv, 10), req.user.clearance_level_id);
      query += ` AND d.security_level_id <= @lv`;
      r.input('lv', sql.Int, maxAllowed);
    }
    query += ` ORDER BY d.issued_date DESC, d.document_code`;
    const result = await r.query(query);
    res.json({ total: result.recordset.length, items: result.recordset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:fileId', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('file_id', sql.VarChar(50), req.params.fileId)
      .query(`
        SELECT d.*, dt.name AS doc_type_name, u.name AS unit_name, sl.name AS security_name
        FROM DOCUMENT d
        LEFT JOIN DOCUMENT_TYPE dt ON dt.type_id = d.doc_type_id
        LEFT JOIN UNIT u ON u.unit_id = d.issuing_unit_id
        JOIN SECURITY_LEVEL sl ON sl.level_id = d.security_level_id
        WHERE d.file_id = @file_id
      `);
    if (r.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    res.json(r.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu file PDF' });
    const {
      document_code, title, doc_type_id, issued_date,
      issuing_unit_id, signer, summary, security_level_id,
    } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Thiếu trích yếu' });
    if (!security_level_id) return res.status(400).json({ error: 'Thiếu mức bảo mật' });

    const fileId = 'DOC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const { yyyy, mm, yyyymmdd, typeSafe, codeSafe } = buildStoredPath({
      docTypeId: doc_type_id, documentCode: document_code, fallbackId: fileId,
    });
    const sha8 = sha256.slice(0, 8);
    const fileName = `${yyyymmdd}_${typeSafe}_${codeSafe}_${sha8}.pdf`;
    const relPath = `uploads/${yyyy}/${mm}/${fileName}`;
    const absPath = path.join(ROOT_DIR, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, req.file.buffer);

    const pool = await getPool();
    await pool.request()
      .input('file_id', sql.VarChar(50), fileId)
      .input('document_code', sql.NVarChar(100), document_code || null)
      .input('title', sql.NVarChar(500), title.trim())
      .input('doc_type_id', sql.VarChar(20), doc_type_id || null)
      .input('issued_date', sql.Date, issued_date || null)
      .input('issuing_unit_id', sql.VarChar(50), issuing_unit_id || null)
      .input('signer', sql.NVarChar(100), signer || null)
      .input('summary', sql.NVarChar(sql.MAX), summary || null)
      .input('security_level_id', sql.Int, parseInt(security_level_id, 10))
      .input('original_name', sql.NVarChar(255), req.file.originalname)
      .input('stored_path', sql.NVarChar(500), relPath)
      .input('mime_type', sql.VarChar(100), req.file.mimetype)
      .input('file_size', sql.BigInt, req.file.size)
      .input('sha256', sql.Char(64), sha256)
      .input('uploaded_by', sql.VarChar(50), req.user.user_id)
      .query(`INSERT INTO DOCUMENT
        (file_id, document_code, title, doc_type_id, issued_date, issuing_unit_id, signer, summary,
         security_level_id, original_name, stored_path, mime_type, file_size, sha256, uploaded_by)
        VALUES (@file_id, @document_code, @title, @doc_type_id, @issued_date, @issuing_unit_id,
                @signer, @summary, @security_level_id, @original_name, @stored_path, @mime_type,
                @file_size, @sha256, @uploaded_by)`);

    await writeAccessLog({
      userId: req.user.user_id, fileId, action: 'UPLOAD',
      ip: getClientIp(req), note: `Upload: ${req.file.originalname}`,
    });
    res.json({ success: true, file_id: fileId, stored_path: relPath, sha256 });
  } catch (err) {
    console.error('[POST /api/documents/upload]', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/documents/:fileId', requireAuth, upload.single('file'), async (req, res) => {
  const fileId = req.params.fileId;
  try {
    const pool = await getPool();
    const exist = await pool.request()
      .input('file_id', sql.VarChar(50), fileId)
      .query(`SELECT stored_path, original_name, sha256 FROM DOCUMENT WHERE file_id = @file_id`);
    if (exist.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    const oldDoc = exist.recordset[0];

    const {
      document_code, title, doc_type_id, issued_date,
      issuing_unit_id, signer, summary, security_level_id,
    } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Thiếu trích yếu' });
    if (!security_level_id) return res.status(400).json({ error: 'Thiếu mức bảo mật' });

    let storedPath = oldDoc.stored_path;
    let originalName = oldDoc.original_name;
    let mimeType = 'application/pdf';
    let fileSize = null;
    let sha256 = oldDoc.sha256;
    let replacedFile = false;

    if (req.file) {
      const { yyyy, mm, yyyymmdd, typeSafe, codeSafe } = buildStoredPath({
        docTypeId: doc_type_id, documentCode: document_code, fallbackId: fileId,
      });
      sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const sha8 = sha256.slice(0, 8);
      const fileName = `${yyyymmdd}_${typeSafe}_${codeSafe}_${sha8}.pdf`;
      const relPath = `uploads/${yyyy}/${mm}/${fileName}`;
      const absPath = path.join(ROOT_DIR, relPath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, req.file.buffer);

      const oldAbs = path.join(ROOT_DIR, oldDoc.stored_path);
      if (oldAbs !== absPath && fs.existsSync(oldAbs) && oldAbs.startsWith(PDF_ROOT)) {
        try { fs.unlinkSync(oldAbs); } catch (e) {}
      }
      storedPath = relPath;
      originalName = req.file.originalname;
      mimeType = req.file.mimetype;
      fileSize = req.file.size;
      replacedFile = true;
    }

    const reqUpdate = pool.request()
      .input('file_id', sql.VarChar(50), fileId)
      .input('document_code', sql.NVarChar(100), document_code || null)
      .input('title', sql.NVarChar(500), title.trim())
      .input('doc_type_id', sql.VarChar(20), doc_type_id || null)
      .input('issued_date', sql.Date, issued_date || null)
      .input('issuing_unit_id', sql.VarChar(50), issuing_unit_id || null)
      .input('signer', sql.NVarChar(100), signer || null)
      .input('summary', sql.NVarChar(sql.MAX), summary || null)
      .input('security_level_id', sql.Int, parseInt(security_level_id, 10))
      .input('stored_path', sql.NVarChar(500), storedPath)
      .input('original_name', sql.NVarChar(255), originalName)
      .input('mime_type', sql.VarChar(100), mimeType);

    let updateQuery = `
      UPDATE DOCUMENT SET
        document_code = @document_code, title = @title, doc_type_id = @doc_type_id,
        issued_date = @issued_date, issuing_unit_id = @issuing_unit_id,
        signer = @signer, summary = @summary, security_level_id = @security_level_id,
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
      ip: getClientIp(req),
      note: replacedFile ? `Sửa metadata + thay file: ${originalName}` : `Sửa metadata: ${title.trim()}`,
    });
    res.json({ success: true, file_id: fileId, replaced_file: replacedFile, stored_path: storedPath });
  } catch (err) {
    console.error('[PUT /api/documents/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:fileId', requireAuth, async (req, res) => {
  const fileId = req.params.fileId;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('file_id', sql.VarChar(50), fileId)
      .query(`SELECT stored_path, original_name FROM DOCUMENT WHERE file_id = @file_id`);
    if (result.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    const doc = result.recordset[0];
    const filePath = path.join(ROOT_DIR, doc.stored_path);
    if (fs.existsSync(filePath) && filePath.startsWith(PDF_ROOT)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
    await pool.request().input('file_id', sql.VarChar(50), fileId)
      .query(`DELETE FROM ACCESS_LOG WHERE file_id = @file_id`);
    await pool.request().input('file_id', sql.VarChar(50), fileId)
      .query(`DELETE FROM DOCUMENT WHERE file_id = @file_id`);
    await writeAccessLog({
      userId: req.user.user_id, fileId: null, action: 'DELETE',
      ip: getClientIp(req), note: `Xóa tài liệu ${fileId} (${doc.original_name})`,
    });
    res.json({ success: true, file_id: fileId });
  } catch (err) {
    console.error('[DELETE /api/documents/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files/:fileId/view', async (req, res) => {
  const ip = getClientIp(req);
  const fileId = req.params.fileId;
  const isDownload = req.query.download === '1';
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('file_id', sql.VarChar(50), fileId)
      .query(`SELECT stored_path, original_name, mime_type, security_level_id
              FROM DOCUMENT WHERE file_id = @file_id`);
    if (result.recordset.length === 0) {
      await writeAccessLog({ userId: req.user.user_id, fileId, action: 'DENIED', ip, note: 'Không tìm thấy' });
      return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    }
    const doc = result.recordset[0];

    if (doc.security_level_id > req.user.clearance_level_id) {
      await writeAccessLog({ userId: req.user.user_id, fileId, action: 'DENIED', ip, note: 'Không đủ cấp' });
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }

    if (doc.security_level_id >= 3) {
      if (!req.user.is_authenticated) {
        return res.status(401).json({ error: 'Tài liệu này yêu cầu đăng nhập', require_fingerprint: true });
      }
      const fpToken = req.headers['x-fingerprint-token'];
      if (!fpToken) {
        return res.status(403).json({
          error: 'Tài liệu Tối mật/Tuyệt mật yêu cầu xác thực vân tay',
          require_fingerprint: true,
        });
      }
      try {
        const decoded = jwt.verify(fpToken, JWT_SECRET);
        if (decoded.purpose !== 'file_access') throw new Error('Sai purpose');
        if (decoded.file_id !== fileId) throw new Error('Token không khớp file');
        if (decoded.user_id !== req.user.user_id) throw new Error('Token không khớp user');
      } catch (err) {
        return res.status(403).json({
          error: 'Phiên xác thực vân tay đã hết hạn. Vui lòng quét lại.',
          require_fingerprint: true,
        });
      }
    }

    if (isDownload && doc.security_level_id >= 3) {
      await writeAccessLog({ userId: req.user.user_id, fileId, action: 'DENIED', ip, note: 'Cấp 3+ không được tải' });
      return res.status(403).json({ error: 'Tài liệu Cấp 3+ chỉ xem trực tiếp, không tải về.' });
    }

    const filePath = path.join(ROOT_DIR, doc.stored_path);
    if (!filePath.startsWith(PDF_ROOT)) return res.status(400).json({ error: 'Đường dẫn không hợp lệ' });
    if (!fs.existsSync(filePath)) {
      await writeAccessLog({ userId: req.user.user_id, fileId, action: 'ERROR', ip, note: 'File không tồn tại' });
      return res.status(404).json({ error: 'File không tồn tại' });
    }

    await writeAccessLog({
      userId: req.user.user_id, fileId,
      action: isDownload ? 'DOWNLOAD' : 'VIEW', ip,
    });

    res.setHeader('Content-Type', doc.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.original_name)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('[GET /api/files/:id/view]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/access-logs', requireAuth, async (req, res) => {
  try {
    if (req.user.clearance_level_id < 4) {
      return res.status(403).json({ error: 'Cần quyền quản trị (mức 4+)' });
    }
    const pool = await getPool();
    const r = pool.request();
    let query = `
      SELECT TOP 200 l.log_id, l.user_id, u.full_name,
             l.file_id, d.title AS doc_title,
             l.[action], l.[timestamp], l.ip, l.note
      FROM ACCESS_LOG l
      LEFT JOIN [USER] u ON u.user_id = l.user_id
      LEFT JOIN DOCUMENT d ON d.file_id = l.file_id
      WHERE 1 = 1
    `;
    if (req.query.user) { query += ` AND l.user_id = @user`; r.input('user', sql.VarChar(50), req.query.user); }
    if (req.query.action) { query += ` AND l.[action] = @action`; r.input('action', sql.VarChar(50), req.query.action); }
    query += ` ORDER BY l.[timestamp] DESC`;
    const result = await r.query(query);
    res.json({ total: result.recordset.length, items: result.recordset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File vượt quá 50MB' });
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    console.error('[Global error]', err);
    return res.status(500).json({ error: err.message });
  }
  next();
});

require('./src/admin-routes')(app, { sql, getPool, writeAccessLog });

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/api-docs')) {
    return next();
  }
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('Không tìm thấy public/index.html. Chạy npm run frontend:build.');
});

async function start() {
  if (!fs.existsSync(PDF_ROOT)) {
    fs.mkdirSync(PDF_ROOT, { recursive: true });
  }
  const ok = await testConnection();
  if (!ok) {
    console.error('Không thể kết nối database. Kiểm tra .env và SQL Server.');
    process.exit(1);
  }

  const server = http.createServer(app);
  setupFingerprintWS(server, { BRIDGE_TOKEN });

  server.listen(PORT, () => {
    console.log('');
    console.log('  ╔════════════════════════════════════════════════════╗');
    console.log('  ║  QK7 Paperless Gateway (v3.0)                      ║');
    console.log('  ╠════════════════════════════════════════════════════╣');
    console.log(`  ║  Web:       http://localhost:${PORT}                    ║`);
    console.log(`  ║  WebSocket: ws://localhost:${PORT}/ws/fingerprint      ║`);
    console.log(`  ║  Swagger:   http://localhost:${PORT}/api-docs          ║`);
    console.log('  ╠════════════════════════════════════════════════════╣');
    console.log(`  ║  JWT:       ${process.env.JWT_SECRET ? 'SET ✅' : 'DEFAULT ⚠️'}                              ║`);
    console.log(`  ║  Legacy:    ${ALLOW_LEGACY_AUTH ? 'ON ⚠️ ' : 'OFF ✅'}                               ║`);
    console.log(`  ║  Bridge:    ${BRIDGE_TOKEN && BRIDGE_TOKEN.length >= 16 ? 'SET ✅' : 'MISSING ⚠️'}                              ║`);
    console.log(`  ║  FP_KEY:    ${FP_ENC_KEY ? 'SET ✅' : 'PLAINTEXT ⚠️'}                              ║`);
    console.log('  ╚════════════════════════════════════════════════════╝');
  });
}

start();

process.on('SIGINT', async () => { await closePool(); process.exit(0); });
process.on('SIGTERM', async () => { await closePool(); process.exit(0); });