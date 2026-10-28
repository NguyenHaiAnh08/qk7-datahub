// ============================================================
// server.js — QK7 DataHub Gateway v4.1
// Permission-Based RBAC + Session Management + Soft Delete
// ============================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const multer = require('multer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { parseDocumentPdf } = require('./pdf-parser');
const { sql, getPool, closePool, testConnection } = require('./src/db');
require('dotenv').config({
  path: [path.join(__dirname, '..', '..', '.env'), path.join(__dirname, '..', '.env'), path.join(__dirname, '.env')],
});

const {
  setupFingerprintWS, requestScan, requestEnroll,
  getEnrollProgress, isAgentOnline, listAgents,
} = require('./src/fingerprint-ws');

const {
  getUserUnitScope, getSubtreeUnits, getRootUnitId,
  resolveUserUnitId, resolveUserRoles,
} = require('./src/unit-scope');

const {
  startMonthlyArchiveScheduler,
  archiveMonthlyLogs,
  getArchiveStats,
} = require('./src/audit-log-cleaner');

const app = express();
app.set('trust proxy', 'loopback');

const PORT = process.env.PORT || 8000;
const ROOT_DIR = __dirname;
const PDF_ROOT = path.join(ROOT_DIR, 'uploads');
const publicDir = path.join(ROOT_DIR, 'public');

const JWT_SECRET = process.env.JWT_SECRET || 'QK7-DEV-SECRET-CHANGE-IN-PROD-' + crypto.randomBytes(16).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const FINGERPRINT_TOKEN_EXPIRES_IN = '5m';
const BRIDGE_TOKEN = process.env.FINGERPRINT_BRIDGE_TOKEN || '';

const FP_ENC_KEY = process.env.FP_ENC_KEY
  ? crypto.scryptSync(process.env.FP_ENC_KEY, 'qk7-fp-salt', 32)
  : null;

const USE_HTTPS = (process.env.USE_HTTPS || 'false').toLowerCase() === 'true';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH
  ? path.resolve(__dirname, process.env.SSL_KEY_PATH)
  : path.join(__dirname, 'certs', 'private-key.pem');
const SSL_CERT_PATH = process.env.SSL_CERT_PATH
  ? path.resolve(__dirname, process.env.SSL_CERT_PATH)
  : path.join(__dirname, 'certs', 'cert.pem');

const LOCKOUT_MAX_ATTEMPTS = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '6', 10);
const LOCKOUT_WINDOW_MINUTES = parseInt(process.env.LOCKOUT_WINDOW_MINUTES || '15', 10);
const IPBLOCK_MAX_ATTEMPTS = parseInt(process.env.IPBLOCK_MAX_ATTEMPTS || '6', 10);
const IPBLOCK_WRONG_PASSWORD_MAX_ATTEMPTS = parseInt(process.env.IPBLOCK_WRONG_PASSWORD_MAX_ATTEMPTS || '15', 10);
const IPBLOCK_WINDOW_MINUTES = parseInt(process.env.IPBLOCK_WINDOW_MINUTES || '15', 10);
const IPBLOCK_DURATION_MINUTES = parseInt(process.env.IPBLOCK_DURATION_MINUTES || '30', 10);

if (!process.env.JWT_SECRET) console.warn('[SECURITY] ⚠️  JWT_SECRET chưa set');
if (!BRIDGE_TOKEN || BRIDGE_TOKEN.length < 16) console.warn('[SECURITY] ⚠️  BRIDGE_TOKEN thiếu');
if (!FP_ENC_KEY) console.warn('[SECURITY] ⚠️  FP_ENC_KEY chưa set');

// ═══════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.disable('x-powered-by');

app.use((req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return origJson(data);
  };
  const origSend = res.send.bind(res);
  res.send = (data) => {
    if (typeof data === 'string' && !res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    return origSend(data);
  };
  next();
});

// ═══════════════════════════════════════════════════════════════
// RATE LIMITERS
// ═══════════════════════════════════════════════════════════════
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  skip: (req) => req.path === '/auth/login',
  message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', code: 'RATE_LIMITED' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Quá nhiều lần đăng nhập thất bại.', code: 'LOGIN_RATE_LIMITED' },
});

const fingerprintLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Thao tác cảm biến vân tay quá dồn dập. Vui lòng thử lại sau giây lát.', code: 'FP_RATE_LIMITED' },
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/fingerprint/scan', fingerprintLimiter);
app.use('/api/fingerprint/enroll', fingerprintLimiter);

// ═══════════════════════════════════════════════════════════════
// STATIC & SWAGGER
// ═══════════════════════════════════════════════════════════════
app.use(express.static(publicDir));

const ENABLE_SWAGGER = (process.env.ENABLE_SWAGGER || 'true').toLowerCase() === 'true';
if (ENABLE_SWAGGER) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'QK7 DataHub API',
    swaggerOptions: { persistAuthorization: true, filter: true, tryItOutEnabled: true },
  }));
  app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
  console.log('[SWAGGER] Enabled at /api-docs');
}

app.get('/', (req, res) => {
  const p = path.join(publicDir, 'index.html');
  if (fs.existsSync(p)) res.sendFile(p);
  else res.status(404).send('Không tìm thấy public/index.html');
});

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Chỉ chấp nhận file PDF'));
  },
});

function safePathJoin(baseDir, userPath) {
  if (!baseDir || !userPath) return null;
  const realBase = path.resolve(baseDir);
  const resolved = path.resolve(realBase, userPath);
  const rel = path.relative(realBase, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return resolved;
}

function validateStoredPath(storedPath) {
  if (!storedPath || typeof storedPath !== 'string') return false;
  if (storedPath.includes('\x00')) return false;
  const norm = storedPath.replace(/\\/g, '/');
  if (!norm.startsWith('uploads/')) return false;
  if (norm.includes('../') || norm.includes('/..')) return false;
  if (/^[A-Za-z]:/.test(norm) || norm.startsWith('/')) return false;
  if (!/^[A-Za-z0-9_\-./]+$/.test(norm)) return false;
  return true;
}

function findPdfBySha8(rootDir, sha8, maxDepth = 5) {
  if (!sha8 || !/^[a-f0-9]{8}$/i.test(sha8)) return null;
  const sha8Lower = sha8.toLowerCase();
  const visited = new Set();
  function walk(dir, depth) {
    if (depth > maxDepth) return null;
    if (!fs.existsSync(dir)) return null;
    if (visited.has(dir)) return null;
    visited.add(dir);
    let items;
    try { items = fs.readdirSync(dir); } catch { return null; }
    for (const item of items) {
      if (item.includes('..') || item.includes('\x00')) continue;
      const full = path.join(dir, item);
      let lstat;
      try { lstat = fs.lstatSync(full); } catch { continue; }
      if (lstat.isSymbolicLink()) continue;
      if (lstat.isDirectory()) {
        const res = walk(full, depth + 1);
        if (res) return res;
      } else if (item.toLowerCase().includes(sha8Lower) && item.toLowerCase().endsWith('.pdf')) {
        return full;
      }
    }
    return null;
  }
  return walk(rootDir, 0);
}

function getClientIpInfo(req) {
  const raw = {
    socket: req.socket?.remoteAddress || null,
    reqIp: req.ip || null,
    xForwardedFor: req.headers['x-forwarded-for'] || null,
    xRealIp: req.headers['x-real-ip'] || null,
    xClientIp: req.headers['x-client-ip'] || null,
    cfConnectingIp: req.headers['cf-connecting-ip'] || null,
  };
  let candidate = '';
  if (raw.xForwardedFor) {
    const parts = String(raw.xForwardedFor).split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) candidate = parts[0];
  }
  if (!candidate && raw.xRealIp) candidate = String(raw.xRealIp).trim();
  if (!candidate && raw.xClientIp) candidate = String(raw.xClientIp).trim();
  if (!candidate && raw.cfConnectingIp) candidate = String(raw.cfConnectingIp).trim();
  if (!candidate) candidate = raw.reqIp || raw.socket || '';

  let ip = String(candidate).trim();
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.split(':')[0];
  if (/^\[.+\]:\d+$/.test(ip)) ip = ip.replace(/^\[(.+)\]:\d+$/, '$1');
  if (ip.toLowerCase().startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  ip = ip.toLowerCase();

  let ipType = 'unknown';
  if (ip === '127.0.0.1' || ip === 'localhost') ipType = 'localhost';
  else if (/^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) ipType = 'lan';
  else if (ip) ipType = 'wan';

  return { normalized: ip || 'unknown', ipType, raw };
}

function getClientIp(req) {
  return getClientIpInfo(req).normalized;
}

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════
async function writeAccessLog({ userId, fileId, action, ip, note = null }) {
  try {
    const pool = await getPool();
    const logId = 'LOG-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const validUserId = (userId && userId !== 'GUEST' && userId !== 'UNKNOWN') ? userId : null;
    await pool.request()
      .input('log_id', sql.VarChar(50), logId)
      .input('user_id', sql.VarChar(50), validUserId)
      .input('file_id', sql.VarChar(50), fileId || null)
      .input('action', sql.VarChar(50), action)
      .input('ip', sql.VarChar(50), ip || '')
      .input('note', sql.NVarChar(255), note ? String(note).slice(0, 255) : null)
      .query(`INSERT INTO ACCESS_LOG (log_id, user_id, file_id, [action], ip, note)
              VALUES (@log_id, @user_id, @file_id, @action, @ip, @note)`);
  } catch (err) {
    console.error('[writeAccessLog]', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// DEPENDENCY INJECTION — Permissions / Sessions / Config
// ═══════════════════════════════════════════════════════════════
// ✅ FIX 2 (phần 1/2): MỘT instance permissions duy nhất
//    → cache đồng bộ giữa requirePermission middleware và invalidateCache
//    → loại bỏ dead-code `perms` không dùng, tránh bug chờ phát sinh
const createPermissionsModule = require('./src/permissions');
const perms = createPermissionsModule({
  sql, getPool, writeAccessLog, getClientIp,
});
const {
  getUserPermissions,
  invalidateCache,
  requirePermission,
  requireAnyPermission,
} = perms;

const SESSION_IDLE_TIMEOUT_MINUTES = parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES || '30', 10);

const createSessionModule = require('./src/sessions');
const createConfigModule = require('./src/system-config');

const {
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  killSessionById,
  listActiveSessions,
  revokeIdleSessions,
  invalidateTokenCache,
} = createSessionModule({ sql, getPool, writeAccessLog, getClientIp });

const config = createConfigModule({ sql, getPool });

// Tự động revoke session không hoạt động > SESSION_IDLE_TIMEOUT_MINUTES
setInterval(async () => {
  try {
    await revokeIdleSessions(SESSION_IDLE_TIMEOUT_MINUTES, 'IDLE_TIMEOUT');
  } catch (err) {
    console.error('[Idle cleanup]', err.message);
  }
}, 60 * 1000);

console.log(`[Session] ⏰ Idle timeout: ${SESSION_IDLE_TIMEOUT_MINUTES} phút (tự động logout)`);

// ═══════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE — JWT + Session validation
// ═══════════════════════════════════════════════════════════════
app.use('/api', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.removeHeader('ETag');

  const isPublic =
    req.path === '/auth/login' ||
    req.path === '/health' ||
    req.path === '/meta' ||
    req.path.startsWith('/test-http-error');
  if (isPublic) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = {
      user_id: 'GUEST', clearance_level_id: 1, roles: [], permissions: [],
      is_authenticated: false,
    };
    return next();
  }

  const rawToken = authHeader.slice(7);
  try {
    const decoded = jwt.verify(rawToken, JWT_SECRET);

    const sess = await validateSession({ token: rawToken, ip: getClientIp(req) });
    if (!sess.valid) {
      const revokedReasons = ['ADMIN_KILL', 'ACCOUNT_LOCKED', 'PASSWORD_CHANGED'];
      return res.status(401).json({
        error: revokedReasons.includes(sess.reason)
          ? 'Phiên làm việc đã bị hủy bởi quản trị viên'
          : 'Phiên làm việc không hợp lệ hoặc đã hết hạn',
        code: 'SESSION_INVALID',
        reason: sess.reason,
      });
    }

    const permsList = await getUserPermissions(decoded.user_id);

    req.user = {
      user_id: decoded.user_id,
      clearance_level_id: decoded.clearance_level_id,
      roles: decoded.roles || [],
      permissions: permsList,
      is_authenticated: true,
      raw_token: rawToken,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc hết hạn', code: 'TOKEN_INVALID' });
  }
});

function requireAuth(req, res, next) {
  if (!req.user || !req.user.is_authenticated) {
    return res.status(401).json({ error: 'Cần đăng nhập để thực hiện thao tác này' });
  }
  next();
}

// ═══════════════════════════════════════════════════════════════
// FINGERPRINT ENCRYPTION
// ═══════════════════════════════════════════════════════════════
function encryptTemplate(buffer) {
  if (!FP_ENC_KEY) return buffer.toString('base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', FP_ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:' + Buffer.concat([iv, tag, enc]).toString('base64');
}
function decryptTemplate(encoded) {
  if (!encoded) return null;
  if (!FP_ENC_KEY || !encoded.startsWith('enc:')) return Buffer.from(encoded, 'base64');
  try {
    const buf = Buffer.from(encoded.slice(4), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const d = crypto.createDecipheriv('aes-256-gcm', FP_ENC_KEY, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]);
  } catch (err) {
    console.error('[decryptTemplate]', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// LOGIN ATTEMPT & IP BLOCK
// ═══════════════════════════════════════════════════════════════
async function checkIpBlocked(ip) {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('ip', sql.VarChar(50), ip)
      .query(`SELECT ip, blocked_until, reason FROM IP_BLOCKLIST WHERE ip = @ip AND blocked_until > GETDATE()`);
    if (r.recordset.length > 0) return { blocked: true, ...r.recordset[0] };
    await pool.request().input('ip', sql.VarChar(50), ip)
      .query(`DELETE FROM IP_BLOCKLIST WHERE ip = @ip AND blocked_until <= GETDATE()`);
    return { blocked: false };
  } catch { return { blocked: false }; }
}

async function writeLoginAttempt({ ip, username, result }) {
  try {
    const pool = await getPool();
    await pool.request()
      .input('ip', sql.VarChar(50), ip)
      .input('username', sql.NVarChar(50), username || null)
      .input('result', sql.VarChar(30), result)
      .query(`INSERT INTO LOGIN_ATTEMPT (ip, username, result) VALUES (@ip, @username, @result)`);
  } catch (err) { console.error('[writeLoginAttempt]', err.message); }
}

async function checkAndBlockIp(ip, reason = 'username_not_found') {
  try {
    const pool = await getPool();
    let count, maxAttempts, blockReason;
    if (reason === 'wrong_password') {
      const r = await pool.request()
        .input('ip', sql.VarChar(50), ip)
        .input('window', sql.Int, IPBLOCK_WINDOW_MINUTES)
        .query(`SELECT COUNT(*) AS n FROM LOGIN_ATTEMPT WHERE ip = @ip AND result = 'WRONG_PASSWORD' AND attempted_at >= DATEADD(MINUTE, -@window, GETDATE())`);
      count = r.recordset[0].n;
      maxAttempts = IPBLOCK_WRONG_PASSWORD_MAX_ATTEMPTS;
      blockReason = `Sai mật khẩu ${count} lần`;
    } else {
      const r = await pool.request()
        .input('ip', sql.VarChar(50), ip)
        .input('window', sql.Int, IPBLOCK_WINDOW_MINUTES)
        .query(`SELECT COUNT(*) AS n FROM LOGIN_ATTEMPT WHERE ip = @ip AND result = 'USERNAME_NOT_FOUND' AND attempted_at >= DATEADD(MINUTE, -@window, GETDATE())`);
      count = r.recordset[0].n;
      maxAttempts = IPBLOCK_MAX_ATTEMPTS;
      blockReason = `Dò username ${count} lần`;
    }

    if (count >= maxAttempts) {
      const until = new Date(Date.now() + IPBLOCK_DURATION_MINUTES * 60000);
      await pool.request()
        .input('ip', sql.VarChar(50), ip)
        .input('until', sql.DateTime, until)
        .input('reason', sql.NVarChar(200), blockReason.slice(0, 200))
        .query(`MERGE IP_BLOCKLIST AS t USING (SELECT @ip AS ip) AS s ON t.ip = s.ip
                WHEN MATCHED THEN UPDATE SET blocked_until = @until, reason = @reason, blocked_at = GETDATE()
                WHEN NOT MATCHED THEN INSERT (ip, blocked_until, reason) VALUES (@ip, @until, @reason);`);
      console.warn(`[SECURITY] 🚨 BLOCK IP ${ip} — ${blockReason}`);
      await writeAccessLog({ userId: null, fileId: null, action: 'IP_BLOCKED', ip, note: blockReason });
      return true;
    }
    return false;
  } catch (err) { console.error('[checkAndBlockIp]', err.message); return false; }
}

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const ipInfo = getClientIpInfo(req);
  const ip = ipInfo.normalized;
  try {
    const { user_id, password } = req.body;
    if (!user_id || !password) return res.status(400).json({ error: 'Thiếu user_id hoặc password' });
    const username = user_id.trim().toLowerCase();

    const ipCheck = await checkIpBlocked(ip);
    if (ipCheck.blocked) {
      const mins = Math.max(1, Math.ceil((new Date(ipCheck.blocked_until) - Date.now()) / 60000));
      return res.status(429).json({ error: `IP bị chặn tạm thời. Thử lại sau ${mins} phút.`, reason: ipCheck.reason, mins_left: mins });
    }

    const pool = await getPool();
    const r = await pool.request()
      .input('u', sql.VarChar(50), username)
      .query(`
        SELECT u.user_id, u.username, u.full_name, u.[rank] AS rank_name,
               u.[position], u.unit_id, u.status, u.password_hash, u.pin_hash,
               u.clearance_level_id, u.failed_attempts, u.locked_at, u.last_failed_at,
               un.name AS unit_name, sl.name AS clearance_name, sl.code AS clearance_code,
               CASE WHEN EXISTS (SELECT 1 FROM USER_FINGERPRINT uf WHERE uf.user_id = u.user_id AND uf.active = 1)
                    THEN 1 ELSE 0 END AS has_fingerprint
        FROM [USER] u
        LEFT JOIN UNIT un ON un.unit_id = u.unit_id
        LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = u.clearance_level_id
        WHERE LOWER(u.username) = @u OR LOWER(u.user_id) = @u
      `);

    if (r.recordset.length === 0) {
      await writeLoginAttempt({ ip, username, result: 'USERNAME_NOT_FOUND' });
      await checkAndBlockIp(ip, 'username_not_found');
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    const user = r.recordset[0];
    if (user.status !== 'active') {
      await writeLoginAttempt({ ip, username, result: 'LOCKED' });
      await writeAccessLog({
        userId: user.user_id, fileId: null, action: 'LOGIN_BLOCKED', ip,
        note: user.status === 'locked' ? 'Tài khoản đang bị khóa' : 'Tài khoản bị vô hiệu hóa',
      });
      return res.status(403).json({ error: user.status === 'locked' ? 'Tài khoản đã bị khóa.' : 'Tài khoản đã bị vô hiệu hóa.' });
    }

    let currentFailed = user.failed_attempts || 0;
    if (user.last_failed_at && currentFailed > 0) {
      const mins = (Date.now() - new Date(user.last_failed_at).getTime()) / 60000;
      if (mins > LOCKOUT_WINDOW_MINUTES) {
        await pool.request().input('uid', sql.VarChar(50), user.user_id)
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
      const isAdmin = adminCheck.recordset[0].n > 0;
      const newFailed = currentFailed + 1;
      const willLock = !isAdmin && newFailed >= LOCKOUT_MAX_ATTEMPTS;

      await pool.request()
        .input('uid', sql.VarChar(50), user.user_id)
        .input('n', sql.Int, newFailed)
        .query(willLock
          ? `UPDATE [USER] SET failed_attempts = @n, last_failed_at = GETDATE(), locked_at = GETDATE(), status = 'locked' WHERE user_id = @uid`
          : `UPDATE [USER] SET failed_attempts = @n, last_failed_at = GETDATE() WHERE user_id = @uid`);

      await writeLoginAttempt({ ip, username, result: 'WRONG_PASSWORD' });
      await writeAccessLog({
        userId: user.user_id, fileId: null, action: 'LOGIN_FAIL', ip,
        note: `Sai mật khẩu lần ${newFailed}/${LOCKOUT_MAX_ATTEMPTS}${willLock ? ' — TÀI KHOẢN BỊ KHÓA' : ''}`,
      });
      await checkAndBlockIp(ip, 'wrong_password');

      if (willLock) await revokeAllUserSessions(user.user_id, null, 'ACCOUNT_LOCKED');

      if (willLock) return res.status(403).json({ error: `Tài khoản đã bị khóa do sai ${LOCKOUT_MAX_ATTEMPTS} lần.` });
      return res.status(401).json({ error: 'Mật khẩu không đúng.' });
    }

    await pool.request()
      .input('uid', sql.VarChar(50), user.user_id)
      .query(`UPDATE [USER] SET failed_attempts = 0, locked_at = NULL, last_failed_at = NULL, status = 'active' WHERE user_id = @uid`);

    await writeLoginAttempt({ ip, username, result: 'SUCCESS' });

    delete user.password_hash;
    delete user.pin_hash;
    delete user.failed_attempts;
    delete user.locked_at;
    delete user.last_failed_at;

    const rolesRes = await pool.request()
      .input('uid', sql.VarChar(50), user.user_id)
      .query(`SELECT r.role_id, r.name FROM USER_ROLE ur JOIN [ROLE] r ON r.role_id = ur.role_id
              WHERE ur.user_id = @uid AND (ur.expires_at IS NULL OR ur.expires_at > GETDATE())`);
    user.roles = rolesRes.recordset.map((x) => x.role_id);
    user.role_names = rolesRes.recordset.map((x) => x.name);
    user.has_fingerprint = user.has_fingerprint === 1;

    const token = jwt.sign(
      { user_id: user.user_id, clearance_level_id: user.clearance_level_id, roles: user.roles },
      JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }
    );

    const match = JWT_EXPIRES_IN.match(/^(\d+)\s*([smhd])$/i);
    let ttlMs = 8 * 60 * 60 * 1000;
    if (match) {
      const n = parseInt(match[1], 10);
      const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2].toLowerCase()] || 3600000;
      ttlMs = n * mult;
    }
    try {
      await createSession({
        userId: user.user_id,
        clearanceLevelId: user.clearance_level_id,
        token,
        ip,
        userAgent: req.headers['user-agent'],
        expiresInMs: ttlMs,
      });
    } catch (err) {
      console.error('[login] createSession:', err.message);
      return res.status(500).json({ error: 'Không thể tạo phiên đăng nhập' });
    }

    await writeAccessLog({
      userId: user.user_id, fileId: null, action: 'LOGIN', ip,
      note: `${user.full_name} (mức ${user.clearance_level_id})`,
    });

    const permissions = await getUserPermissions(user.user_id);

    res.json({
      success: true, token, expires_in: JWT_EXPIRES_IN,
      user: { ...user, permissions },
    });
  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    await revokeSession({
      token: req.user.raw_token,
      revokedBy: req.user.user_id,
      reason: 'LOGOUT',
    });
    await writeAccessLog({
      userId: req.user.user_id, fileId: null, action: 'LOGOUT',
      ip: getClientIp(req), note: 'Đăng xuất chủ động',
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('u', sql.VarChar(50), req.user.user_id)
      .query(`
        SELECT u.user_id, u.username, u.full_name, u.[rank] AS rank_name, u.[position],
               u.unit_id, un.name AS unit_name, u.status, u.clearance_level_id,
               sl.name AS clearance_name, sl.code AS clearance_code,
               CASE WHEN EXISTS (SELECT 1 FROM USER_FINGERPRINT uf WHERE uf.user_id = u.user_id AND uf.active = 1)
                    THEN 1 ELSE 0 END AS has_fingerprint
        FROM [USER] u
        LEFT JOIN UNIT un ON un.unit_id = u.unit_id
        LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = u.clearance_level_id
        WHERE u.user_id = @u
      `);
    if (r.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });
    const user = r.recordset[0];

    const rolesRes = await pool.request()
      .input('u', sql.VarChar(50), user.user_id)
      .query(`SELECT r.role_id, r.name FROM USER_ROLE ur JOIN [ROLE] r ON r.role_id = ur.role_id
              WHERE ur.user_id = @u AND (ur.expires_at IS NULL OR ur.expires_at > GETDATE())`);
    user.roles = rolesRes.recordset.map((x) => x.role_id);
    user.role_names = rolesRes.recordset.map((x) => x.name);
    user.has_fingerprint = user.has_fingerprint === 1;

    user.permissions = await getUserPermissions(user.user_id);

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// FINGERPRINT VERIFY
// ═══════════════════════════════════════════════════════════════
app.post('/api/auth/fingerprint/verify', requireAuth, requirePermission('FP_VERIFY'), async (req, res) => {
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
      .query(`SELECT security_level_id, deleted_at FROM DOCUMENT WHERE file_id = @file_id`);
    if (docRes.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    const doc = docRes.recordset[0];

    const isAdminUser = (req.user.roles || []).includes('ROL-01');
    if (doc.deleted_at && !isAdminUser) {
      return res.status(404).json({ error: 'Tài liệu không tồn tại hoặc đã bị xóa' });
    }

    if (doc.security_level_id < 3) {
      return res.json({ success: true, required: false, fingerprint_token: null });
    }

    const fpRes = await pool.request()
      .input('uid', sql.VarChar(50), req.user.user_id)
      .query(`SELECT template_enc FROM USER_FINGERPRINT WHERE user_id = @uid AND active = 1`);
    if (fpRes.recordset.length === 0) {
      return res.status(403).json({ error: 'Bạn chưa đăng ký vân tay. Vui lòng liên hệ quản trị viên.', needs_enroll: true });
    }

    const templateBuffer = decryptTemplate(fpRes.recordset[0].template_enc);
    if (!templateBuffer || templateBuffer.length < 100) {
      return res.status(500).json({ error: 'Template vân tay bị hỏng. Vui lòng enroll lại.' });
    }
    const templateB64 = templateBuffer.toString('base64');

    if (!isAgentOnline(deviceId)) {
      return res.status(503).json({ error: 'Máy quét vân tay chưa sẵn sàng.', agent_offline: true });
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
          userId: req.user.user_id, fileId: file_id, action: 'FINGERPRINT_FAIL',
          ip: getClientIp(req), note: 'Timeout chờ quét',
        });
        return res.status(408).json({ error: 'Hết thời gian chờ quét vân tay.' });
      }
      throw err;
    }

    if (!scanResult.match) {
      if (scanResult.error === 'CANCELLED') {
        return res.status(409).json({ error: 'Yêu cầu đã bị hủy bởi thao tác mới.', cancelled: true });
      }
      const note = scanResult.error ? `Lỗi: ${scanResult.error}` : `Không khớp (score=${scanResult.score})`;
      await writeAccessLog({
        userId: req.user.user_id, fileId: file_id, action: 'FINGERPRINT_FAIL',
        ip: getClientIp(req), note,
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
      JWT_SECRET, { expiresIn: FINGERPRINT_TOKEN_EXPIRES_IN }
    );

    await writeAccessLog({
      userId: req.user.user_id, fileId: file_id, action: 'FINGERPRINT_OK',
      ip: getClientIp(req), note: `OK (score=${scanResult.score}, device=${deviceId})`,
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

// ═══════════════════════════════════════════════════════════════
// FINGERPRINT AGENTS — PUBLIC endpoint (fix iPad cấp 3)
// ═══════════════════════════════════════════════════════════════
app.get('/api/fingerprint/agents-online', requireAuth, (req, res) => {
  const agents = listAgents();
  res.json({ items: agents.map((a) => ({ device_id: a.device_id })) });
});

// ═══════════════════════════════════════════════════════════════
// FINGERPRINT ADMIN
// ═══════════════════════════════════════════════════════════════
app.post('/api/admin/fingerprint/enroll/:userId', requireAuth, requirePermission('FP_ENROLL'), async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const deviceId = req.headers['x-device-fp'];
    if (!deviceId) return res.status(400).json({ error: 'Chưa kết nối máy quét.', agent_offline: true });
    if (!isAgentOnline(deviceId)) return res.status(503).json({ error: 'Agent chưa online.', agent_offline: true });

    const pool = await getPool();
    const uRes = await pool.request()
      .input('uid', sql.VarChar(50), targetUserId)
      .query(`SELECT user_id, full_name FROM [USER] WHERE user_id = @uid`);
    if (uRes.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });

    let enrollResult;
    try {
      enrollResult = await requestEnroll(deviceId, { user_id: targetUserId, timeout_seconds: 60 });
    } catch (err) {
      if (err.message === 'AGENT_OFFLINE' || err.message === 'AGENT_DISCONNECTED')
        return res.status(503).json({ error: 'Agent mất kết nối.', agent_offline: true });
      if (err.message === 'ENROLL_TIMEOUT')
        return res.status(408).json({ error: 'Hết thời gian chờ quét 3 lần (60s).' });
      throw err;
    }

    if (!enrollResult.success || !enrollResult.template_b64) {
      if (enrollResult.error === 'CANCELLED') return res.status(409).json({ error: 'Yêu cầu bị hủy.', cancelled: true });
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
        WHEN MATCHED THEN UPDATE SET template_enc = @tpl, active = 1, enrolled_at = GETDATE()
        WHEN NOT MATCHED THEN INSERT (user_id, template_enc, active) VALUES (@uid, @tpl, 1);
      `);

    await writeAccessLog({
      userId: req.user.user_id, fileId: null, action: 'FINGERPRINT_ENROLL',
      ip: getClientIp(req), note: `Enroll vân tay cho ${targetUserId} qua ${deviceId}`,
    });

    res.json({ success: true, user_id: targetUserId });
  } catch (err) {
    console.error('[admin/fingerprint/enroll]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/fingerprint/enroll-status', requireAuth, requirePermission('FP_ENROLL'), (req, res) => {
  const deviceId = req.query.deviceId || req.headers['x-device-fp'];
  res.json(getEnrollProgress(deviceId));
});

app.get('/api/admin/fingerprint/agents', requireAuth, requirePermission('FP_AGENTS_VIEW'), (req, res) => {
  res.json({ items: listAgents() });
});

app.get('/api/admin/fingerprint/status/:userId', requireAuth, requirePermission('FP_ENROLL'), async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('uid', sql.VarChar(50), req.params.userId)
      .query(`SELECT user_id, active, enrolled_at FROM USER_FINGERPRINT WHERE user_id = @uid AND active = 1`);
    const hasFp = r.recordset.length > 0;
    res.json({
      user_id: req.params.userId,
      has_fingerprint: hasFp,
      enrolled_at: hasFp ? r.recordset[0].enrolled_at : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SYSTEM ROUTES
// ═══════════════════════════════════════════════════════════════
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
      pool.request().query(`SELECT u.unit_id, u.name, u.parent_id, p.name AS parent_name FROM UNIT u LEFT JOIN UNIT p ON p.unit_id = u.parent_id ORDER BY u.name`),
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

// ═══════════════════════════════════════════════════════════════
// DOCUMENT ROUTES
// ═══════════════════════════════════════════════════════════════
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
        AND d.deleted_at IS NULL
    `;
    r.input('clearance', sql.Int, req.user.clearance_level_id);
    if (req.query.q) {
      query += ` AND (d.document_code LIKE '%' + @q + '%' OR d.title LIKE N'%' + @q + N'%' OR d.summary LIKE N'%' + @q + N'%')`;
      r.input('q', sql.NVarChar(500), req.query.q);
    }
    if (req.query.code) { query += ` AND d.document_code LIKE '%' + @code + '%'`; r.input('code', sql.NVarChar(100), req.query.code); }
    if (req.query.title) { query += ` AND d.title LIKE N'%' + @title + N'%'`; r.input('title', sql.NVarChar(500), req.query.title); }
    if (req.query.type) { query += ` AND d.doc_type_id = @type`; r.input('type', sql.VarChar(20), req.query.type); }
    if (req.query.unit) {
      if (req.query.include_children === 'true' || req.query.include_children === '1') {
        const subtree = await getSubtreeUnits(req.query.unit);
        if (subtree.length > 0) {
          const params = subtree.map((_, i) => `@u_${i}`);
          query += ` AND d.issuing_unit_id IN (${params.join(', ')})`;
          subtree.forEach((uId, i) => r.input(`u_${i}`, sql.VarChar(50), uId));
        } else {
          query += ` AND d.issuing_unit_id = @unit`;
          r.input('unit', sql.VarChar(50), req.query.unit);
        }
      } else {
        query += ` AND d.issuing_unit_id = @unit`;
        r.input('unit', sql.VarChar(50), req.query.unit);
      }
    }
    if (req.query.from) { query += ` AND d.issued_date >= @from`; r.input('from', sql.Date, req.query.from); }
    if (req.query.to) { query += ` AND d.issued_date <= @to`; r.input('to', sql.Date, req.query.to); }
    if (req.query.lv) {
      const requestedLv = parseInt(req.query.lv, 10);
      if (requestedLv <= req.user.clearance_level_id) {
        query += ` AND d.security_level_id = @lv`;
        r.input('lv', sql.Int, requestedLv);
      } else {
        query += ` AND 1 = 0`;
      }
    }
    query += ` ORDER BY d.issued_date DESC, d.document_code`;
    const result = await r.query(query);
    res.json({ total: result.recordset.length, items: result.recordset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/my-unit', requireAuth, requirePermission('DOC_VIEW'), async (req, res) => {
  try {
    const scope = await getUserUnitScope(req.user);
    const pool = await getPool();
    let targetUnitId = null, canSelectUnit = false;

    if (scope.restricted) {
      targetUnitId = scope.root_unit;
    } else if (scope.no_unit) {
      return res.status(403).json({ error: 'Tài khoản chưa được gán đơn vị.', no_unit: true });
    } else {
      canSelectUnit = true;
      targetUnitId = (req.query.unit_id || '').trim() || (await resolveUserUnitId(req.user)) || (await getRootUnitId());
    }
    if (!targetUnitId) return res.status(400).json({ error: 'Không xác định được đơn vị.' });

    const subtreeUnitIds = await getSubtreeUnits(targetUnitId);
    if (subtreeUnitIds.length === 0) return res.status(404).json({ error: `Đơn vị ${targetUnitId} không tồn tại.`, not_found: true });

    const r = pool.request();
    const unitParams = subtreeUnitIds.map((_, i) => `@u${i}`).join(',');
    subtreeUnitIds.forEach((u, i) => r.input(`u${i}`, sql.VarChar(50), u));

    let query = `
      SELECT d.file_id, d.document_code, d.title, d.doc_type_id, dt.name AS doc_type_name,
             d.issued_date, d.issuing_unit_id, u.name AS unit_name, d.signer, d.file_size, d.summary,
             d.security_level_id, sl.name AS security_name, d.created_at, d.updated_at
      FROM DOCUMENT d
      LEFT JOIN DOCUMENT_TYPE dt ON dt.type_id = d.doc_type_id
      LEFT JOIN UNIT u ON u.unit_id = d.issuing_unit_id
      JOIN SECURITY_LEVEL sl ON sl.level_id = d.security_level_id
      WHERE d.security_level_id <= @clearance
        AND d.issuing_unit_id IN (${unitParams})
        AND d.deleted_at IS NULL
    `;
    r.input('clearance', sql.Int, req.user.clearance_level_id);
    if (req.query.q) {
      query += ` AND (d.document_code LIKE '%' + @q + '%' OR d.title LIKE N'%' + @q + N'%' OR d.summary LIKE N'%' + @q + N'%')`;
      r.input('q', sql.NVarChar(500), req.query.q);
    }
    if (req.query.type) { query += ` AND d.doc_type_id = @type`; r.input('type', sql.VarChar(20), req.query.type); }
    if (req.query.from) { query += ` AND d.issued_date >= @from`; r.input('from', sql.Date, req.query.from); }
    if (req.query.to) { query += ` AND d.issued_date <= @to`; r.input('to', sql.Date, req.query.to); }
    if (req.query.lv) {
      const requestedLv = parseInt(req.query.lv, 10);
      if (requestedLv <= req.user.clearance_level_id) {
        query += ` AND d.security_level_id = @lv`;
        r.input('lv', sql.Int, requestedLv);
      } else {
        query += ` AND 1 = 0`;
      }
    }
    query += ` ORDER BY d.issued_date DESC, d.document_code`;
    const result = await r.query(query);

    const unitRes = await pool.request()
      .input('uid', sql.VarChar(50), targetUnitId)
      .query(`SELECT unit_id, name, parent_id FROM UNIT WHERE unit_id = @uid`);

    res.json({
      total: result.recordset.length,
      items: result.recordset,
      unit: unitRes.recordset[0] || { unit_id: targetUnitId, name: targetUnitId },
      subtree_unit_ids: subtreeUnitIds,
      can_select_unit: canSelectUnit,
      selected_unit_id: targetUnitId,
    });
  } catch (err) {
    console.error('[GET /api/documents/my-unit]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/trash', requireAuth, requirePermission('DOC_TRASH_VIEW'), async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('clearance', sql.Int, req.user.clearance_level_id)
      .query(`
        SELECT d.file_id, d.document_code, d.title, d.security_level_id, sl.name AS security_name,
               d.original_name, d.file_size, d.deleted_at, d.deleted_reason,
               u.full_name AS deleted_by_name, d.issuing_unit_id, un.name AS unit_name
        FROM DOCUMENT d
        LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = d.security_level_id
        LEFT JOIN [USER] u ON u.user_id = d.deleted_by
        LEFT JOIN UNIT un ON un.unit_id = d.issuing_unit_id
        WHERE d.deleted_at IS NOT NULL AND d.security_level_id <= @clearance
        ORDER BY d.deleted_at DESC
      `);
    res.json({ total: r.recordset.length, items: r.recordset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:fileId', requireAuth, requirePermission('DOC_VIEW'), async (req, res) => {
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

    const doc = r.recordset[0];
    if (doc.deleted_at) {
      const canViewTrash = (req.user.permissions || []).includes('DOC_TRASH_VIEW')
                          || (req.user.roles || []).includes('ROL-01');
      if (!canViewTrash) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    }

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DOCUMENT PARSE / UPLOAD / UPDATE / DELETE / RESTORE / PURGE
// ═══════════════════════════════════════════════════════════════
app.post('/api/documents/parse', requireAuth, requirePermission('DOC_PARSE'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Thiếu file PDF' });
    const result = await parseDocumentPdf(req.file.buffer, { sql, getPool });
    const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const documentCode = (req.body.document_code || result?.parsed?.document_code || '').trim() || null;

    let shaMatches = [], codeMatches = [];
    try {
      const pool = await getPool();
      const shaCheck = await pool.request()
        .input('sha', sql.Char(64), sha256)
        .query(`
          SELECT d.file_id, d.document_code, d.title, d.security_level_id, sl.name AS security_name,
                 d.created_at, d.sha256, d.uploaded_by, u.full_name AS uploaded_by_name
          FROM DOCUMENT d
          LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = d.security_level_id
          LEFT JOIN [USER] u ON u.user_id = d.uploaded_by
          WHERE d.sha256 = @sha AND d.deleted_at IS NULL
        `);
      shaMatches = shaCheck.recordset || [];
      if (documentCode) {
        const codeCheck = await pool.request()
          .input('code', sql.NVarChar(100), documentCode)
          .query(`
            SELECT d.file_id, d.document_code, d.title, d.security_level_id, sl.name AS security_name,
                   d.created_at, d.sha256
            FROM DOCUMENT d
            LEFT JOIN SECURITY_LEVEL sl ON sl.level_id = d.security_level_id
            WHERE d.document_code = @code AND d.deleted_at IS NULL
            ORDER BY d.created_at DESC
          `);
        codeMatches = codeCheck.recordset || [];
      }
    } catch (e) { console.warn('[parse] dup check:', e.message); }

    const shaDuplicate = shaMatches.length > 0;
    const codeDuplicate = codeMatches.length > 0;

    res.json({
      ...result,
      original_name: req.file.originalname,
      file_size: req.file.size,
      sha256,
      duplicate_check: {
        sha256,
        is_duplicate: shaDuplicate || codeDuplicate,
        sha_duplicate: shaDuplicate,
        code_duplicate: codeDuplicate,
        matches: { by_sha256: shaMatches, by_code: codeMatches },
      },
    });
  } catch (err) {
    console.error('[POST /api/documents/parse]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function buildStoredPath({ docTypeId, documentCode, fallbackId }) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyymmdd = `${yyyy}${mm}${String(now.getDate()).padStart(2, '0')}`;
  const typeSafe = String(docTypeId || 'XX').replace(/[^A-Za-z0-9]/g, '');
  const codeSafe = String(documentCode || fallbackId).replace(/[\/\\\s]/g, '-').replace(/[^A-Za-z0-9\-]/g, '');
  return { yyyy, mm, yyyymmdd, typeSafe, codeSafe };
}

app.post('/api/documents/upload', requireAuth, requirePermission('DOC_UPLOAD'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu file PDF' });

    const {
      document_code, title, doc_type_id, issued_date, issuing_unit_id,
      signer, summary, security_level_id,
    } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Thiếu trích yếu' });
    if (!security_level_id) return res.status(400).json({ error: 'Thiếu mức bảo mật' });

    const fileId = 'DOC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    const forceUpload = req.body.force_upload === '1' || req.body.force_upload === 'true';
    if (!forceUpload) {
      const pool = await getPool();
      const dup = await pool.request()
        .input('sha', sql.Char(64), sha256)
        .query(`SELECT file_id, document_code, title, security_level_id, created_at FROM DOCUMENT WHERE sha256 = @sha AND deleted_at IS NULL`);
      if (dup.recordset.length > 0) {
        const ex = dup.recordset[0];
        await writeAccessLog({ userId: req.user.user_id, fileId: ex.file_id, action: 'UPLOAD_DUPLICATE', ip: getClientIp(req), note: `Trùng SHA256 với ${ex.file_id}` });
        return res.status(409).json({ error: 'File đã tồn tại trong hệ thống', is_duplicate: true, match_type: 'sha256', existing: ex });
      }
    }

    const { yyyy, mm, yyyymmdd, typeSafe, codeSafe } = buildStoredPath({
      docTypeId: doc_type_id, documentCode: document_code, fallbackId: fileId,
    });
    const sha8 = sha256.slice(0, 8);
    const fileName = `${yyyymmdd}_${typeSafe}_${codeSafe}_${sha8}.pdf`;
    const relPath = `uploads/${yyyy}/${mm}/${fileName}`;
    if (!validateStoredPath(relPath)) return res.status(400).json({ error: 'Đường dẫn không hợp lệ' });
    const absPath = safePathJoin(ROOT_DIR, relPath);
    if (!absPath) return res.status(400).json({ error: 'Đường dẫn không hợp lệ' });

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
      .query(`
        INSERT INTO DOCUMENT (file_id, document_code, title, doc_type_id, issued_date, issuing_unit_id, signer, summary,
          security_level_id, original_name, stored_path, mime_type, file_size, sha256, uploaded_by)
        VALUES (@file_id, @document_code, @title, @doc_type_id, @issued_date, @issuing_unit_id,
          @signer, @summary, @security_level_id, @original_name, @stored_path, @mime_type,
          @file_size, @sha256, @uploaded_by)
      `);

    await writeAccessLog({
      userId: req.user.user_id, fileId, action: 'UPLOAD',
      ip: getClientIp(req), note: `Upload: ${req.file.originalname}`,
    });
    res.json({ success: true, file_id: fileId, stored_path: relPath, sha256 });
  } catch (err) {
    console.error('[POST upload]', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/documents/:fileId', requireAuth, requirePermission('DOC_EDIT'), upload.single('file'), async (req, res) => {
  const fileId = req.params.fileId;
  try {
    const pool = await getPool();
    const exist = await pool.request()
      .input('fid', sql.VarChar(50), fileId)
      .query(`SELECT stored_path, original_name, sha256 FROM DOCUMENT WHERE file_id = @fid`);
    if (exist.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    const oldDoc = exist.recordset[0];

    const {
      document_code, title, doc_type_id, issued_date, issuing_unit_id,
      signer, summary, security_level_id,
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
      if (!validateStoredPath(relPath)) return res.status(400).json({ error: 'Đường dẫn không hợp lệ' });
      const absPath = safePathJoin(ROOT_DIR, relPath);
      if (!absPath) return res.status(400).json({ error: 'Đường dẫn không hợp lệ' });

      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, req.file.buffer);

      const oldAbs = safePathJoin(ROOT_DIR, oldDoc.stored_path);
      if (oldAbs && oldAbs !== absPath && fs.existsSync(oldAbs)) {
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
        stored_path = @stored_path, original_name = @original_name, mime_type = @mime_type,
        updated_at = GETDATE()
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
    console.error('[PUT documents]', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:fileId', requireAuth, requirePermission('DOC_DELETE'), async (req, res) => {
  const fileId = req.params.fileId;
  const reason = (req.body?.reason || req.query.reason || '').trim().slice(0, 500);
  try {
    const pool = await getPool();
    const check = await pool.request()
      .input('fid', sql.VarChar(50), fileId)
      .query(`SELECT deleted_at, title FROM DOCUMENT WHERE file_id = @fid`);
    if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    if (check.recordset[0].deleted_at) return res.status(400).json({ error: 'Tài liệu đã được xóa trước đó' });

    await pool.request()
      .input('fid', sql.VarChar(50), fileId)
      .input('uid', sql.VarChar(50), req.user.user_id)
      .input('reason', sql.NVarChar(500), reason || null)
      .query(`UPDATE DOCUMENT SET deleted_at = GETDATE(), deleted_by = @uid, deleted_reason = @reason, updated_at = GETDATE() WHERE file_id = @fid`);

    await writeAccessLog({
      userId: req.user.user_id, fileId, action: 'DELETE_SOFT',
      ip: getClientIp(req),
      note: `Xóa mềm: ${check.recordset[0].title}${reason ? ` — Lý do: ${reason}` : ''}`,
    });

    res.json({ success: true, file_id: fileId, soft_deleted: true });
  } catch (err) {
    console.error('[DELETE soft]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/:fileId/restore', requireAuth, requirePermission('DOC_RESTORE'), async (req, res) => {
  const fileId = req.params.fileId;
  try {
    const pool = await getPool();
    const check = await pool.request()
      .input('fid', sql.VarChar(50), fileId)
      .query(`SELECT deleted_at, title FROM DOCUMENT WHERE file_id = @fid`);
    if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    if (!check.recordset[0].deleted_at) return res.status(400).json({ error: 'Tài liệu không ở trong thùng rác' });

    await pool.request()
      .input('fid', sql.VarChar(50), fileId)
      .query(`UPDATE DOCUMENT SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL, updated_at = GETDATE() WHERE file_id = @fid`);

    await writeAccessLog({
      userId: req.user.user_id, fileId, action: 'DOC_RESTORE',
      ip: getClientIp(req), note: `Khôi phục: ${check.recordset[0].title}`,
    });

    res.json({ success: true, file_id: fileId, restored: true });
  } catch (err) {
    console.error('[POST restore]', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:fileId/purge', requireAuth, requirePermission('DOC_PURGE'), async (req, res) => {
  const fileId = req.params.fileId;
  const confirm = (req.body?.confirm || req.query.confirm || '').trim();
  if (confirm !== fileId) {
    return res.status(400).json({ error: 'Xác nhận không khớp. Gửi body { "confirm": "<fileId>" } để xác nhận.' });
  }

  try {
    const pool = await getPool();
    const check = await pool.request()
      .input('fid', sql.VarChar(50), fileId)
      .query(`SELECT stored_path, original_name, title, deleted_at FROM DOCUMENT WHERE file_id = @fid`);
    if (check.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    const doc = check.recordset[0];
    if (!doc.deleted_at) return res.status(400).json({ error: 'Tài liệu chưa xóa mềm. Xóa mềm trước khi purge.' });

    if (validateStoredPath(doc.stored_path)) {
      const abs = safePathJoin(ROOT_DIR, doc.stored_path);
      if (abs && fs.existsSync(abs)) {
        try { fs.unlinkSync(abs); } catch (e) { console.warn('[purge] unlink:', e.message); }
      }
    }

    await pool.request().input('fid', sql.VarChar(50), fileId).query(`DELETE FROM DOCUMENT WHERE file_id = @fid`);

    await writeAccessLog({
      userId: req.user.user_id, fileId: null, action: 'DOC_PURGE',
      ip: getClientIp(req), note: `XÓA VĨNH VIỄN: ${doc.title} (${doc.original_name})`,
    });

    res.json({ success: true, file_id: fileId, purged: true });
  } catch (err) {
    console.error('[DELETE purge]', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// FILE VIEW/DOWNLOAD
// ═══════════════════════════════════════════════════════════════
app.get('/api/files/:fileId/view', async (req, res) => {
  const ip = getClientIp(req);
  const fileId = req.params.fileId;
  const isDownload = req.query.download === '1';

  try {
    const pool = await getPool();
    let result = await pool.request()
      .input('file_id', sql.VarChar(100), fileId)
      .query(`SELECT stored_path, original_name, mime_type, security_level_id, sha256, deleted_at, file_id, document_code FROM DOCUMENT WHERE file_id = @file_id`);

    // Smart Document Resolver Fallback: Nếu không tìm thấy theo file_id
    if (result.recordset.length === 0) {
      // 1. Thử tìm theo document_code
      result = await pool.request()
        .input('file_id', sql.NVarChar(100), fileId)
        .query(`SELECT stored_path, original_name, mime_type, security_level_id, sha256, deleted_at, file_id, document_code FROM DOCUMENT WHERE document_code = @file_id`);
    }

    if (result.recordset.length === 0) {
      // 2. Thử tìm theo stored_path hoặc original_name chứa fileId
      result = await pool.request()
        .input('file_id_pattern', sql.NVarChar(200), `%${fileId}%`)
        .query(`SELECT stored_path, original_name, mime_type, security_level_id, sha256, deleted_at, file_id, document_code FROM DOCUMENT WHERE stored_path LIKE @file_id_pattern OR original_name LIKE @file_id_pattern`);
    }

    if (result.recordset.length === 0 && fileId.startsWith('PDF-')) {
      // 3. Fallback cho synthetic ID dạng PDF-xxx: Lọc ký tự và so khớp với stored_path/document_code
      const cleanStem = fileId.replace(/^PDF-/, '').replace(/[^a-zA-Z0-9]/g, '');
      if (cleanStem.length >= 6) {
        const allDocs = await pool.request().query(`
          SELECT stored_path, original_name, mime_type, security_level_id, sha256, deleted_at, file_id, document_code 
          FROM DOCUMENT WHERE deleted_at IS NULL
        `);
        const matched = allDocs.recordset.find((d) => {
          const p = (d.stored_path || '').replace(/[^a-zA-Z0-9]/g, '');
          const o = (d.original_name || '').replace(/[^a-zA-Z0-9]/g, '');
          const c = (d.document_code || '').replace(/[^a-zA-Z0-9]/g, '');
          return (p && (p.includes(cleanStem.slice(0, 16)) || cleanStem.includes(p.slice(-16)))) ||
                 (o && (o.includes(cleanStem.slice(0, 16)) || cleanStem.includes(o.slice(-16)))) ||
                 (c && cleanStem.includes(c));
        });
        if (matched) {
          result = { recordset: [matched] };
        }
      }
    }

    if (result.recordset.length === 0) {
      await writeAccessLog({ userId: req.user.user_id, fileId, action: 'DENIED', ip, note: 'Không tìm thấy' });
      return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    }
    const doc = result.recordset[0];
    const canonicalFileId = doc.file_id || fileId;

    if (doc.deleted_at) {
      const canViewTrash = (req.user.permissions || []).includes('DOC_TRASH_VIEW')
                          || (req.user.roles || []).includes('ROL-01');
      if (!canViewTrash) {
        await writeAccessLog({ userId: req.user.user_id, fileId: canonicalFileId, action: 'DENIED', ip, note: 'Tài liệu đã xóa' });
        return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
      }
    }

    if (doc.security_level_id > req.user.clearance_level_id) {
      await writeAccessLog({ userId: req.user.user_id, fileId: canonicalFileId, action: 'DENIED', ip, note: 'Không đủ cấp' });
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }

    if (doc.security_level_id >= 3) {
      const fpToken = req.headers['x-fingerprint-token'];
      if (!fpToken) {
        return res.status(403).json({
          error: 'Tài liệu Cấp 3+ yêu cầu xác thực vân tay',
          require_fingerprint: true,
        });
      }
      try {
        const decoded = jwt.verify(fpToken, JWT_SECRET);
        if (decoded.purpose !== 'file_access') throw new Error('Sai purpose');
        if (decoded.file_id !== fileId && decoded.file_id !== canonicalFileId) throw new Error('Token không khớp file');
        if (decoded.user_id !== req.user.user_id) throw new Error('Token không khớp user');
      } catch {
        return res.status(403).json({
          error: 'Phiên xác thực vân tay đã hết hạn. Vui lòng quét lại.',
          require_fingerprint: true,
        });
      }

      if (isDownload) {
        await writeAccessLog({ userId: req.user.user_id, fileId: canonicalFileId, action: 'DENIED', ip, note: 'Cấp 3+ không được tải' });
        return res.status(403).json({ error: 'Tài liệu Cấp 3+ chỉ xem trực tiếp, không tải về.' });
      }
    }

    if (!validateStoredPath(doc.stored_path)) {
      await writeAccessLog({ userId: req.user.user_id, fileId: canonicalFileId, action: 'DENIED', ip, note: 'Path không hợp lệ' });
      return res.status(400).json({ error: 'Đường dẫn tệp không hợp lệ' });
    }

    let filePath = safePathJoin(ROOT_DIR, doc.stored_path);
    if (!filePath || !fs.existsSync(filePath)) {
      const sha8 = doc.sha256 ? String(doc.sha256).trim().slice(0, 8) : null;
      const fb = findPdfBySha8(PDF_ROOT, sha8, 5);
      if (fb) {
        const rel = path.relative(ROOT_DIR, fb).replace(/\\/g, '/');
        if (validateStoredPath(rel)) filePath = fb;
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      await writeAccessLog({ userId: req.user.user_id, fileId: canonicalFileId, action: 'ERROR', ip, note: 'File không tồn tại' });
      return res.status(404).json({ error: 'File không tồn tại trên hệ thống lưu trữ' });
    }

    const lst = fs.lstatSync(filePath);
    if (lst.isSymbolicLink()) {
      await writeAccessLog({ userId: req.user.user_id, fileId: canonicalFileId, action: 'DENIED', ip, note: 'Symlink bị chặn' });
      return res.status(403).json({ error: 'Không thể truy cập tệp' });
    }
    if (!filePath.toLowerCase().endsWith('.pdf')) {
      await writeAccessLog({ userId: req.user.user_id, fileId: canonicalFileId, action: 'DENIED', ip, note: 'Extension không phải PDF' });
      return res.status(403).json({ error: 'Chỉ chấp nhận tệp PDF' });
    }

    await writeAccessLog({
      userId: req.user.user_id, fileId: canonicalFileId,
      action: isDownload ? 'DOWNLOAD' : 'VIEW', ip,
    });

    res.setHeader('Content-Type', doc.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.original_name)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('[GET file view]', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ACCESS LOGS — QUẢN TRỊ & KIỂM TOÁN AN NINH (KHÔNG GIỚI HẠN, LÀM SẠCH ĐẦU THÁNG)
// ═══════════════════════════════════════════════════════════════
app.get('/api/access-logs', requireAuth, requirePermission('AUDIT_VIEW'), async (req, res) => {
  try {
    const pool = await getPool();
    const r = pool.request();
    const scope = String(req.query.scope || 'active').toLowerCase();

    let query = '';
    if (scope === 'archive') {
      // Chỉ xem trong kho lưu trữ ACCESS_LOG_ARCHIVE
      query = `
        SELECT l.log_id, l.user_id, u.full_name, l.file_id, d.title AS doc_title,
               l.[action], l.[timestamp], l.ip, l.note, 1 AS is_archived
        FROM ACCESS_LOG_ARCHIVE l
        LEFT JOIN [USER] u ON u.user_id = l.user_id
        LEFT JOIN DOCUMENT d ON d.file_id = l.file_id
        WHERE 1 = 1
      `;
      if (req.query.user) { query += ` AND l.user_id = @user`; r.input('user', sql.VarChar(50), req.query.user); }
      if (req.query.action) { query += ` AND l.[action] = @action`; r.input('action', sql.VarChar(50), req.query.action); }
      query += ` ORDER BY l.[timestamp] DESC`;
    } else if (scope === 'all') {
      // Hợp nhất cả hai bảng
      query = `
        SELECT l.log_id, l.user_id, u.full_name, l.file_id, d.title AS doc_title,
               l.[action], l.[timestamp], l.ip, l.note, 0 AS is_archived
        FROM ACCESS_LOG l
        LEFT JOIN [USER] u ON u.user_id = l.user_id
        LEFT JOIN DOCUMENT d ON d.file_id = l.file_id
        WHERE 1 = 1
      `;
      if (req.query.user) { query += ` AND l.user_id = @user`; r.input('user', sql.VarChar(50), req.query.user); }
      if (req.query.action) { query += ` AND l.[action] = @action`; r.input('action', sql.VarChar(50), req.query.action); }

      query += `
        UNION ALL
        SELECT la.log_id, la.user_id, u2.full_name, la.file_id, d2.title AS doc_title,
               la.[action], la.[timestamp], la.ip, la.note, 1 AS is_archived
        FROM ACCESS_LOG_ARCHIVE la
        LEFT JOIN [USER] u2 ON u2.user_id = la.user_id
        LEFT JOIN DOCUMENT d2 ON d2.file_id = la.file_id
        WHERE 1 = 1
      `;
      if (req.query.user) { query += ` AND la.user_id = @user`; }
      if (req.query.action) { query += ` AND la.[action] = @action`; }
      query += ` ORDER BY [timestamp] DESC`;
    } else {
      // Mặc định 'active': Sự kiện tháng hiện tại từ ACCESS_LOG (không giới hạn TOP 200, bắt đầu từ 0 mỗi đầu tháng)
      query = `
        SELECT l.log_id, l.user_id, u.full_name, l.file_id, d.title AS doc_title,
               l.[action], l.[timestamp], l.ip, l.note, 0 AS is_archived
        FROM ACCESS_LOG l
        LEFT JOIN [USER] u ON u.user_id = l.user_id
        LEFT JOIN DOCUMENT d ON d.file_id = l.file_id
        WHERE l.[timestamp] >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
      `;
      if (req.query.user) { query += ` AND l.user_id = @user`; r.input('user', sql.VarChar(50), req.query.user); }
      if (req.query.action) { query += ` AND l.[action] = @action`; r.input('action', sql.VarChar(50), req.query.action); }
      query += ` ORDER BY l.[timestamp] DESC`;
    }

    const result = await r.query(query);
    const now = new Date();
    res.json({
      total: result.recordset.length,
      items: result.recordset,
      cycle: {
        scope,
        current_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        reset_policy: 'MONTHLY_FIRST_DAY_00_00',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/access-logs/stats', requireAuth, requirePermission('AUDIT_VIEW'), async (req, res) => {
  try {
    const stats = await getArchiveStats(getPool);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/access-logs/archive-run', requireAuth, requirePermission('AUDIT_VIEW'), async (req, res) => {
  try {
    const result = await archiveMonthlyLogs(getPool, writeAccessLog);
    res.json({
      message: `Đã hoàn tất lưu trữ chu kỳ: ${result.archivedCount} sự kiện cũ đã được chuyển sang ACCESS_LOG_ARCHIVE.`,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// MOUNT SUB-ROUTERS
// ═══════════════════════════════════════════════════════════════
require('./src/admin-routes')(app, {
  sql, getPool, writeAccessLog, getClientIp,
  requireAuth, requirePermission, requireAnyPermission,
  getUserPermissions: perms.getUserPermissions,
  invalidateCache: perms.invalidateCache,
  revokeAllUserSessions, killSessionById, listActiveSessions,
  sessionIdleTimeoutMinutes: SESSION_IDLE_TIMEOUT_MINUTES,
});

app.use('/api/ai', requireAuth, require('./src/ai-routes')({
  requirePermission,
  writeAccessLog,
  getClientIp,
  JWT_SECRET,
}));

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLER & SPA FALLBACK
// ═══════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File vượt quá 50MB', code: 'LIMIT_FILE_SIZE' });
    return res.status(400).json({ error: err.message, code: 'MULTER_ERROR' });
  }
  if (err) {
    console.error('[Global error]', err);
    const status = err.status || err.statusCode || 500;
    return res.status(status).json({
      error: err.message || 'Lỗi máy chủ nội bộ',
      code: err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
    });
  }
  next();
});

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/api-docs')) return next();
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('Không tìm thấy public/index.html');
});

// 404 Handler cho các API endpoint không tồn tại (trả về JSON thay vì HTML Express mặc định)
app.use('/api', (req, res) => {
  res.status(404).json({
    error: `API endpoint không tồn tại: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
  });
});

// ═══════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════
async function start() {
  if (!fs.existsSync(PDF_ROOT)) fs.mkdirSync(PDF_ROOT, { recursive: true });

  const ok = await testConnection();
  if (!ok) {
    console.error('Không thể kết nối database.');
    process.exit(1);
  }

  await config.loadAll();

  let server;
  if (USE_HTTPS) {
    if (!fs.existsSync(SSL_KEY_PATH) || !fs.existsSync(SSL_CERT_PATH)) {
      console.error('[HTTPS] ❌ Không tìm thấy file cert');
      process.exit(1);
    }
    server = https.createServer({
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH),
      minVersion: 'TLSv1.2',
      honorCipherOrder: true,
    }, app);
    console.log('[HTTPS] 🔒 Server HTTPS (TLS 1.2+)');
  } else {
    server = http.createServer(app);
    console.log('[HTTP] ⚠️  Server HTTP (không mã hóa)');
  }

  setupFingerprintWS(server, { BRIDGE_TOKEN });
  startMonthlyArchiveScheduler(getPool, writeAccessLog);

  const protocol = USE_HTTPS ? 'https' : 'http';
  const wsProtocol = USE_HTTPS ? 'wss' : 'ws';

  server.listen(PORT, () => {
    console.log('');
    console.log('  ╔════════════════════════════════════════════════════╗');
    console.log('  ║  QK7 Paperless Gateway v4.1 — RBAC + Session       ║');
    console.log('  ╠════════════════════════════════════════════════════╣');
    console.log(`  ║  Web:       ${protocol}://localhost:${PORT}                    ║`);
    console.log(`  ║  WebSocket: ${wsProtocol}://localhost:${PORT}/ws/fingerprint      ║`);
    console.log(`  ║  Swagger:   ${protocol}://localhost:${PORT}/api-docs          ║`);
    console.log(`  ║  HTTPS:     ${USE_HTTPS ? 'ENABLED ✅' : 'DISABLED ⚠️'}                              ║`);
    console.log('  ╚════════════════════════════════════════════════════╝');
  });
}

start();

process.on('SIGINT', async () => { await closePool(); process.exit(0); });
process.on('SIGTERM', async () => { await closePool(); process.exit(0); });