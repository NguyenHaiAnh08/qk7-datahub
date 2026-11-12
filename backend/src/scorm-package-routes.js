// backend/src/scorm-package-routes.js
// Upload ZIP SCORM → extract → serve static files → cho iframe load
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const AdmZip = require('adm-zip'); // npm i adm-zip
const { sql, getPool } = require('./db');

module.exports = function createScormPackageRoutes({ requireAuth, requirePermission, writeAccessLog, getClientIp }) {
  const router = express.Router();
  const getIp = (req) => (typeof getClientIp === 'function' ? getClientIp(req) : (req.ip || '127.0.0.1'));
  const logAudit = (req, action, note, fileId = null) =>
    (typeof writeAccessLog === 'function'
      ? writeAccessLog({ userId: req.user?.user_id || 'GUEST', fileId, action, ip: getIp(req), note: String(note || '').slice(0, 500) }).catch(() => {})
      : Promise.resolve());

  const SCORM_ROOT = path.join(__dirname, '..', 'uploads', 'scorm');
  if (!fs.existsSync(SCORM_ROOT)) fs.mkdirSync(SCORM_ROOT, { recursive: true });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    fileFilter: (req, file, cb) => {
      if (!file.originalname.toLowerCase().endsWith('.zip')) {
        return cb(new Error('Chỉ chấp nhận tệp .zip (gói SCORM)'));
      }
      cb(null, true);
    },
  });

  // ─── MIME map cho static files ───
  const MIME = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml':  'application/xml; charset=utf-8',
    '.png':  'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif':  'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.mp3':  'audio/mpeg', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
    '.pdf':  'application/pdf', '.swf': 'application/x-shockwave-flash',
  };

  // ─── POST /:lectureId/scorm/upload ───
  // Upload gói ZIP SCORM, extract, tự tìm imsmanifest.xml → xác định entry point
  router.post('/:lectureId/scorm/upload', requireAuth, requirePermission('LECTURE_CREATE'), upload.single('file'), async (req, res) => {
    const lectureId = req.params.lectureId;
    try {
      if (!req.file) return res.status(400).json({ error: 'Thiếu tệp .zip' });

      const pool = await getPool();
      const isAdmin = (req.user.roles || []).includes('ROL-01');
      const lr = await pool.request()
        .input('lid', sql.VarChar(50), lectureId)
        .query(`SELECT author_id, faculty_unit_id FROM DIGITAL_LECTURE WHERE lecture_id = @lid`);
      if (lr.recordset.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      if (!isAdmin && lr.recordset[0].author_id !== req.user.user_id) {
        return res.status(403).json({ error: 'Chỉ tác giả mới có thể upload gói SCORM' });
      }

      // Dọn thư mục cũ nếu có
      const targetDir = path.join(SCORM_ROOT, lectureId);
      if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
      fs.mkdirSync(targetDir, { recursive: true });

      // Extract ZIP
      const zip = new AdmZip(req.file.buffer);
      zip.extractAllTo(targetDir, true);

      // Tìm imsmanifest.xml ở root hoặc 1 cấp con
      let manifestPath = path.join(targetDir, 'imsmanifest.xml');
      let baseDir = targetDir;
      if (!fs.existsSync(manifestPath)) {
        const subs = fs.readdirSync(targetDir, { withFileTypes: true }).filter((d) => d.isDirectory());
        for (const s of subs) {
          const p = path.join(targetDir, s.name, 'imsmanifest.xml');
          if (fs.existsSync(p)) { manifestPath = p; baseDir = path.join(targetDir, s.name); break; }
        }
      }
      if (!fs.existsSync(manifestPath)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        return res.status(400).json({ error: 'Gói SCORM không hợp lệ: thiếu imsmanifest.xml' });
      }

      // Parse entry point từ imsmanifest
      const xml = fs.readFileSync(manifestPath, 'utf8');
      const match = xml.match(/<resource[^>]+href=["']([^"']+)["']/i);
      const entryPoint = match ? match[1] : 'index.html';

      // Đường dẫn tương đối tính từ backend/ (để so sánh stored_path bảo mật)
      const relBase = path.relative(path.join(__dirname, '..'), baseDir).replace(/\\/g, '/');
      const scormPath = `${relBase}/${entryPoint}`.replace(/\/+/g, '/');

      await pool.request()
        .input('lid', sql.VarChar(50), lectureId)
        .input('path', sql.NVarChar(500), scormPath)
        .query(`UPDATE DIGITAL_LECTURE SET scorm_entry_point=@path, content_type='SCORM',
                scorm_package_path=@path, updated_at=GETDATE()
                WHERE lecture_id=@lid`);

      await logAudit(req, 'SCORM_UPLOAD', `Upload gói SCORM cho ${lectureId} (entry: ${entryPoint})`, lectureId);
      res.json({
        success: true,
        scorm_entry_point: scormPath,
        extracted_to: relBase,
        entry_point: entryPoint,
      });
    } catch (e) {
      console.error('[SCORM upload]', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ─── GET /:lectureId/scorm/*path ───
  // Serve static SCORM files (HTML, JS, XML, media...) cho iframe
  router.get('/:lectureId/scorm/*', requireAuth, requirePermission('LECTURE_VIEW'), async (req, res) => {
    const lectureId = req.params.lectureId;
    try {
      const pool = await getPool();
      const lr = await pool.request()
        .input('lid', sql.VarChar(50), lectureId)
        .query(`SELECT security_level_id, content_type, scorm_entry_point FROM DIGITAL_LECTURE WHERE lecture_id=@lid`);
      if (lr.recordset.length === 0) return res.status(404).send('Not found');

      const lec = lr.recordset[0];
      if (lec.security_level_id > (req.user.clearance_level_id || 1)) {
        return res.status(403).send('Không đủ cấp bảo mật');
      }
      if (lec.content_type !== 'SCORM') {
        return res.status(400).send('Bài giảng không phải SCORM');
      }

      // Lấy path sau scorm/ — hỗ trợ req.params[0] (Express 5)
      const subPath = (req.params[0] || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!subPath || subPath.includes('..')) return res.status(400).send('Đường dẫn không hợp lệ');

      // Tìm baseDir SCORM của lecture
      const baseDir = path.join(SCORM_ROOT, lectureId);
      if (!fs.existsSync(baseDir)) return res.status(404).send('Gói SCORM chưa được upload');

      // Nếu có 1 cấp subfolder chứa manifest → dùng subfolder đó làm gốc
      let rootDir = baseDir;
      if (!fs.existsSync(path.join(baseDir, 'imsmanifest.xml'))) {
        const subs = fs.readdirSync(baseDir, { withFileTypes: true }).filter((d) => d.isDirectory());
        for (const s of subs) {
          if (fs.existsSync(path.join(baseDir, s.name, 'imsmanifest.xml'))) {
            rootDir = path.join(baseDir, s.name); break;
          }
        }
      }

      const safeRoot = path.resolve(rootDir);
      const target = path.resolve(rootDir, subPath);
      if (!target.startsWith(safeRoot + path.sep) && target !== safeRoot) {
        return res.status(403).send('Path traversal bị chặn');
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        return res.status(404).send('Không tìm thấy tệp trong gói SCORM');
      }

      const ext = path.extname(target).toLowerCase();
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, max-age=300');
      // Cho phép iframe cùng origin load
      res.setHeader('X-Content-Type-Options', 'nosniff');
      fs.createReadStream(target).pipe(res);
    } catch (e) {
      console.error('[SCORM serve]', e);
      res.status(500).send(e.message);
    }
  });

  return router;
};