// backend/src/scorm-package-routes.js
// Upload ZIP SCORM/HTML5 → lưu pending → (bước approve) extract → serve static → iframe load
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { sql, getPool } = require('./db');

module.exports = function createScormPackageRoutes({ requireAuth, requirePermission }) {
  const router = express.Router();

  const SCORM_ROOT = path.join(__dirname, '..', 'uploads', 'scorm');
  if (!fs.existsSync(SCORM_ROOT)) fs.mkdirSync(SCORM_ROOT, { recursive: true });

  // ✅ 1. TẠO THƯ MỤC TẠM ĐỂ HỨNG FILE TẢI LÊN
  const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // ✅ 2. DÙNG DISK STORAGE (Ghi thẳng xuống ổ cứng, không tốn RAM)
  const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempDir),
    filename: (req, file, cb) => {
      // Làm sạch tên file để tránh lỗi path traversal
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      cb(null, `${Date.now()}-${safeName}`);
    }
  });

  const upload = multer({
    storage: diskStorage,
    limits: { fileSize: 300 * 1024 * 1024 }, // Nâng lên 300MB
    fileFilter: (req, file, cb) => {
      if (!file.originalname.toLowerCase().endsWith('.zip')) {
        return cb(new Error('Chỉ chấp nhận tệp .zip (gói SCORM/HTML5)'));
      }
      cb(null, true);
    },
  });

  // ✅ 3. Hàm di chuyển file an toàn trên Windows (tránh lỗi EXDEV)
  const moveFileSafe = (src, dest) => {
    try {
      fs.renameSync(src, dest);
    } catch (err) {
      if (err.code === 'EXDEV') {
        fs.copyFileSync(src, dest);
        fs.unlinkSync(src);
      } else throw err;
    }
  };

  // ─── MIME map (Cập nhật thêm định dạng của ActivePresenter) ───
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
    '.wasm': 'application/wasm',
    '.m4v':  'video/mp4',
    '.m4a':  'audio/mp4',
    '.vtt':  'text/vtt'
  };

  // ────────────────────────────────────────────────────────────────────
  // Helper dùng chung: resolve lecture + entry + packageRoot
  // ────────────────────────────────────────────────────────────────────
  async function loadLecturePackage(lectureId, req, res, {
    requirePublished = true,
    contentTypes = ['SCORM', 'HTML5'],
  } = {}) {
    const pool = await getPool();
    const lr = await pool.request()
      .input('lid', sql.VarChar(50), lectureId)
      .query(`
        SELECT security_level_id, content_type, scorm_entry_point, status
        FROM DIGITAL_LECTURE WHERE lecture_id = @lid
      `);
    if (lr.recordset.length === 0) { res.status(404).send('Not found'); return null; }

    const lec = lr.recordset[0];
    if (lec.security_level_id > (req.user.clearance_level_id || 1)) {
      res.status(403).send('Không đủ cấp bảo mật'); return null;
    }
    if (!contentTypes.includes(lec.content_type)) {
      res.status(400).send(`Bài giảng không phải ${contentTypes.join('/')}`); return null;
    }
    if (requirePublished && lec.status !== 'PUBLISHED') {
      res.status(404).send('Bài giảng chưa được xuất bản'); return null;
    }
    if (!lec.scorm_entry_point) {
      res.status(404).send('Bài giảng chưa có gói học liệu'); return null;
    }

    const entryAbs = path.isAbsolute(lec.scorm_entry_point)
      ? lec.scorm_entry_point
      : path.resolve(__dirname, '..', lec.scorm_entry_point);

    if (!fs.existsSync(entryAbs) || !fs.statSync(entryAbs).isFile()) {
      res.status(404).send('Tệp không tồn tại'); return null;
    }

    return {
      lecture: lec,
      entryAbs,
      packageRoot: path.dirname(entryAbs),
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Factory: handler serve asset tĩnh cho 1 loại content
  // ────────────────────────────────────────────────────────────────────
  function createAssetHandler(contentTypes) {
    return async function serveAsset(req, res, next) {
      const lectureId = req.params.lectureId;
      try {
        // ✅ FIX EXPRESS 5: req.params.path là Array (do khai báo *path)
        const rawPath = req.params.path || req.params[0] || '';
        const pathString = Array.isArray(rawPath) ? rawPath.join('/') : rawPath;
        const subPath = pathString.replace(/\\/g, '/').replace(/^\/+/, '');

        if (!subPath || subPath.includes('..')) {
          return res.status(400).send('Đường dẫn không hợp lệ');
        }

        const pkg = await loadLecturePackage(lectureId, req, res, {
          requirePublished: true,
          contentTypes,
        });
        if (!pkg) return;

        // Rewrite req.url để express.static tìm trong packageRoot của lecture hiện tại
        const originalUrl = req.url;
        req.url = '/' + subPath;

        express.static(pkg.packageRoot, {
          fallthrough: false,
          setHeaders: (r, filePath) => {
            r.setHeader('X-Content-Type-Options', 'nosniff');
            r.setHeader('Cache-Control', 'private, max-age=300');
            r.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

            const ext = path.extname(filePath).toLowerCase();
            if (MIME[ext]) {
              r.setHeader('Content-Type', MIME[ext]);
            }
          },
        })(req, res, (err) => {
          req.url = originalUrl;
          if (err) {
            if (err.status === 404 || err.code === 'ENOENT') {
              return res.status(404).send('Không tìm thấy tệp trong gói');
            }
            return res.status(500).send(err.message || 'Lỗi serve tệp');
          }
          next();
        });
      } catch (e) {
        console.error('[serve asset]', e);
        if (!res.headersSent) res.status(500).send(e.message);
      }
    };
  }

  const serveScormAsset = createAssetHandler(['SCORM']);
  const serveHtml5Asset = createAssetHandler(['HTML5']);

  // ────────────────────────────────────────────────────────────────────
  // Factory: handler launch (trả HTML entry point, inject <base>)
  // ────────────────────────────────────────────────────────────────────
  function createLaunchHandler(contentTypes) {
    return async function launch(req, res) {
      const lectureId = req.params.lectureId;
      try {
        const pkg = await loadLecturePackage(lectureId, req, res, {
          requirePublished: true,
          contentTypes,
        });
        if (!pkg) return;

        const launchPath = req.originalUrl.split('?')[0];
        const baseHref = launchPath.replace(/\/launch\/?$/, '/assets/');

        let html = fs.readFileSync(pkg.entryAbs, 'utf8');
        if (!/<base\b/i.test(html)) {
          if (/<head(\s[^>]*)?>/i.test(html)) {
            html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    <base href="${baseHref}" />`);
          } else if (/<html(\s[^>]*)?>/i.test(html)) {
            html = html.replace(/<html(\s[^>]*)?>/i, (m) => `${m}\n  <head><base href="${baseHref}" /></head>`);
          } else {
            html = `<base href="${baseHref}" />\n` + html;
          }
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(html);
      } catch (e) {
        console.error('[launch]', e);
        res.status(500).send(e.message);
      }
    };
  }

  const launchScorm = createLaunchHandler(['SCORM']);
  const launchHtml5 = createLaunchHandler(['HTML5']);

  // ────────────────────────────────────────────────────────────────────
  // Factory: handler upload .zip vào pending (chưa extract)
  // Đã tối ưu: Nhận file từ ổ đĩa thay vì RAM
  // ────────────────────────────────────────────────────────────────────
  function createUploadHandler(contentType, folder) {
    return async function handleUpload(req, res) {
      const lectureId = req.params.lectureId;
      try {
        if (!req.file) return res.status(400).json({ error: 'Thiếu tệp .zip' });

        const pool = await getPool();
        const lr = await pool.request()
          .input('lid', sql.VarChar(50), lectureId)
          .query(`SELECT author_id, status FROM DIGITAL_LECTURE WHERE lecture_id=@lid`);
        
        if (lr.recordset.length === 0) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
        }

        const lec = lr.recordset[0];
        const isAdmin = (req.user.roles || []).includes('ROL-01');
        if (!isAdmin && lec.author_id !== req.user.user_id) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(403).json({ error: 'Chỉ tác giả mới được upload' });
        }

        const pendingDir = path.join(__dirname, '..', 'uploads', 'pending', folder);
        fs.mkdirSync(pendingDir, { recursive: true });
        const pendingAbs = path.join(pendingDir, `${lectureId}.zip`);

        // ✅ Chuyển file từ thư mục temp sang thư mục pending
        try {
          moveFileSafe(req.file.path, pendingAbs);
        } catch (moveErr) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: 'Lỗi di chuyển tệp tin: ' + moveErr.message });
        }

        const relPending = `uploads/pending/${folder}/${lectureId}.zip`;
        await pool.request()
          .input('lid', sql.VarChar(50), lectureId)
          .input('pp',  sql.NVarChar(500), relPending)
          .input('ct',  sql.VarChar(20),   contentType)
          .query(`UPDATE DIGITAL_LECTURE
                  SET pending_scorm_path=@pp, content_type=@ct,
                      status='PENDING_FACULTY', reject_reason=NULL, updated_at=GETDATE()
                  WHERE lecture_id=@lid`);

        res.json({ success: true, status: 'PENDING_FACULTY', pending_scorm_path: relPending });
      } catch (e) {
        console.error(`[${contentType} upload]`, e);
        // Dọn dẹp file rác nếu có lỗi xảy ra
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message });
      }
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // ROUTES
  // ────────────────────────────────────────────────────────────────────

  // Upload
  router.post('/:lectureId/scorm/upload',
    requireAuth, requirePermission('LECTURE_CREATE'),
    upload.single('file'), createUploadHandler('SCORM', 'scorm'));

  router.post('/:lectureId/html5/upload',
    requireAuth, requirePermission('LECTURE_CREATE'),
    upload.single('file'), createUploadHandler('HTML5', 'html5'));

  // Launch
  router.get('/:lectureId/scorm/launch',
    requireAuth, requirePermission('LECTURE_VIEW'), launchScorm);

  router.get('/:lectureId/html5/launch',
    requireAuth, requirePermission('LECTURE_VIEW'), launchHtml5);

  // ✅ FIX EXPRESS 5: Thêm tên cho wildcard (*path)
  // Assets (đăng ký TRƯỚC catch-all)
  router.get('/:lectureId/scorm/assets/*path',
    requireAuth, requirePermission('LECTURE_VIEW'), serveScormAsset);

  router.get('/:lectureId/html5/assets/*path',
    requireAuth, requirePermission('LECTURE_VIEW'), serveHtml5Asset);

  // Legacy catch-all (client cũ / HTML có ../ path)
  router.get('/:lectureId/scorm/*path',
    requireAuth, requirePermission('LECTURE_VIEW'), serveScormAsset);

  router.get('/:lectureId/html5/*path',
    requireAuth, requirePermission('LECTURE_VIEW'), serveHtml5Asset);

  return router;
};