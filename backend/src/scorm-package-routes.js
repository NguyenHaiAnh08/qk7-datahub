// backend/src/scorm-package-routes.js
// Upload ZIP SCORM/HTML5 / PDF → lưu pending/storage → phục vụ trình chiếu & quản lý bài giảng
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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

  const uploadPdf = multer({
    storage: diskStorage,
    limits: { fileSize: 150 * 1024 * 1024 }, // 150MB cho tệp PDF giáo án
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.pdf' && file.mimetype !== 'application/pdf') {
        return cb(new Error('Chỉ chấp nhận tệp tài liệu .pdf'));
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
        SELECT title, created_at, security_level_id, content_type, scorm_entry_point, pending_scorm_path, status
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

    let entryPoint = lec.scorm_entry_point;

    // 🌟 Tự động nhận diện & tối ưu hóa gói ActivePresenter: ưu tiên demo.html làm bài giảng chính
    const { getModuleUploadPath, MODULES, sanitizeFolderName } = require('./storage-helper');
    const folderName = `${sanitizeFolderName(lec.title || 'Bai_Giang')}_${lectureId}`;
    const date = lec.created_at ? new Date(lec.created_at) : new Date();
    const { absPath: lectureDir, relPath: baseRelPath } = getModuleUploadPath(MODULES.LECTURES, date, folderName);
    if (fs.existsSync(lectureDir)) {
      const rootFiles = fs.readdirSync(lectureDir);
      const isActivePresenter = rootFiles.includes('demo.html') && (rootFiles.includes('rlprez.js') || rootFiles.includes('player'));
      if (isActivePresenter && (!entryPoint || entryPoint.endsWith('index.html'))) {
        entryPoint = `${baseRelPath}/demo.html`;
        await pool.request()
          .input('lid', sql.VarChar(50), lectureId)
          .input('ep', sql.NVarChar(500), entryPoint)
          .query(`UPDATE DIGITAL_LECTURE SET scorm_entry_point = @ep, pending_scorm_path = NULL WHERE lecture_id = @lid`);
        console.log(`[activepresenter] Tự động nâng cấp scorm_entry_point cho ${lectureId} → demo.html`);
      }
    }

    // 🌟 SELF-HEALING: Tự động phục hồi entry point nếu bài giảng đã được giải nén hoặc còn file pending
    if (!entryPoint) {
      if (fs.existsSync(lectureDir)) {
        const rootFiles = fs.readdirSync(lectureDir);
        const commonEntries = ['demo.html', 'story.html', 'index.html', 'launch.html', 'story_html5.html'];
        const found = commonEntries.find(f => rootFiles.includes(f)) || rootFiles.find(f => f.toLowerCase().endsWith('.html'));
        if (found) {
          entryPoint = `${baseRelPath}/${found}`;
          await pool.request()
            .input('lid', sql.VarChar(50), lectureId)
            .input('ep', sql.NVarChar(500), entryPoint)
            .query(`UPDATE DIGITAL_LECTURE SET scorm_entry_point = @ep, pending_scorm_path = NULL WHERE lecture_id = @lid`);
          console.log(`[self-healing] Tự động khắc phục scorm_entry_point cho ${lectureId} → ${entryPoint}`);
        }
      } else if (lec.pending_scorm_path) {
        try {
          const { extractAndParse } = require('./lecture-package-helper');
          const out = await extractAndParse({ 
            lectureId, 
            pendingPath: lec.pending_scorm_path,
            title: lec.title,
            createdAt: lec.created_at
          });
          entryPoint = out.entry_point;
          await pool.request()
            .input('lid', sql.VarChar(50), lectureId)
            .input('ep', sql.NVarChar(500), entryPoint)
            .input('ct', sql.VarChar(20), out.content_type)
            .query(`UPDATE DIGITAL_LECTURE SET scorm_entry_point = @ep, content_type = @ct, pending_scorm_path = NULL WHERE lecture_id = @lid`);
          console.log(`[self-healing] Tự động giải nén và cập nhật scorm_entry_point cho ${lectureId} → ${entryPoint}`);
        } catch (ex) {
          console.error(`[self-healing] Lỗi giải nén:`, ex);
        }
      }
    }

    if (!entryPoint) {
      res.status(404).send('Bài giảng chưa có gói học liệu'); return null;
    }

    const entryAbs = path.isAbsolute(entryPoint)
      ? entryPoint
      : path.resolve(__dirname, '..', entryPoint);

    if (!fs.existsSync(entryAbs) || !fs.statSync(entryAbs).isFile()) {
      res.status(404).send('Tệp không tồn tại: ' + path.basename(entryAbs)); return null;
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
            r.setHeader('X-Frame-Options', 'SAMEORIGIN');
            r.setHeader('Content-Security-Policy', [
              "default-src 'self' blob: data:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:",
              "style-src 'self' 'unsafe-inline' blob: data:",
              "img-src 'self' blob: data:",
              "media-src 'self' blob: data:",
              "font-src 'self' blob: data:",
              "connect-src 'self' blob: data: ws: wss:",
              "frame-ancestors 'self'",
              "object-src 'none'",
              "base-uri 'self'"
            ].join('; '));

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

        // Cho phép chọn file cụ thể qua query param ?file= (vd: demo.html, tutorial.html)
        let launchFilePath = pkg.entryAbs;
        if (req.query.file) {
          const reqFile = String(req.query.file).replace(/\\/g, '/').replace(/^\/+/, '');
          if (!reqFile.includes('..') && /\.(html|htm)$/i.test(reqFile)) {
            const customPath = path.resolve(pkg.packageRoot, reqFile);
            if (customPath.startsWith(pkg.packageRoot + path.sep) && fs.existsSync(customPath)) {
              launchFilePath = customPath;
            }
          }
        }

        const launchPath = req.originalUrl.split('?')[0];
        const baseHref = launchPath.replace(/\/launch\/?$/, '/assets/');

        let html = fs.readFileSync(launchFilePath, 'utf8');
        if (!/<base\b/i.test(html)) {
          if (/<head(\s[^>]*)?>/i.test(html)) {
            html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    <base href="${baseHref}" />`);
          } else if (/<html(\s[^>]*)?>/i.test(html)) {
            html = html.replace(/<html(\s[^>]*)?>/i, (m) => `${m}\n  <head><base href="${baseHref}" /></head>`);
          } else {
            html = `<base href="${baseHref}" />\n` + html;
          }
        }

        // Tối ưu chuyển trang trong iframe cho ActivePresenter menu launcher:
        // chuyển window.openPrez sang window.location.href để không mở tab popup riêng
        if (html.includes('openPrez')) {
          const overrideScript = `
    <script>
      (function() {
        window.openPrez = function(url) {
          if (!url) return false;
          window.location.href = url;
          return false;
        };
      })();
    </script>
`;
          if (html.includes('</body>')) {
            html = html.replace('</body>', `${overrideScript}</body>`);
          } else {
            html = html + overrideScript;
          }
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Content-Security-Policy', [
          "default-src 'self' blob: data:",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:",
          "style-src 'self' 'unsafe-inline' blob: data:",
          "img-src 'self' blob: data:",
          "media-src 'self' blob: data:",
          "font-src 'self' blob: data:",
          "connect-src 'self' blob: data: ws: wss:",
          "frame-ancestors 'self'",
          "object-src 'none'",
          "base-uri 'self'"
        ].join('; '));

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

        const pendingDir = path.join(__dirname, '..', 'uploads', 'bai-giang-so', 'pending', folder);
        fs.mkdirSync(pendingDir, { recursive: true });
        const pendingAbs = path.join(pendingDir, `${lectureId}.zip`);

        // ✅ Chuyển file từ thư mục temp sang thư mục pending
        try {
          moveFileSafe(req.file.path, pendingAbs);
        } catch (moveErr) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: 'Lỗi di chuyển tệp tin: ' + moveErr.message });
        }

        const relPending = `uploads/bai-giang-so/pending/${folder}/${lectureId}.zip`;
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
  // Handler upload tệp giáo án PDF cho bài giảng số hóa
  // Lưu vào uploads/YYYY/MM/, tạo bản ghi DOCUMENT và gắn document_id vào DIGITAL_LECTURE
  // ────────────────────────────────────────────────────────────────────
  async function handlePdfUpload(req, res) {
    const lectureId = req.params.lectureId;
    try {
      if (!req.file) return res.status(400).json({ error: 'Thiếu tệp .pdf' });

      const pool = await getPool();
      const lr = await pool.request()
        .input('lid', sql.VarChar(50), lectureId)
        .query(`SELECT lecture_id, title, security_level_id, faculty_unit_id, author_id, status FROM DIGITAL_LECTURE WHERE lecture_id=@lid`);

      if (lr.recordset.length === 0) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      }

      const lec = lr.recordset[0];
      const isAdmin = (req.user.roles || []).includes('ROL-01');
      if (!isAdmin && lec.author_id !== req.user.user_id) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Chỉ tác giả mới được tải lên tệp giáo án' });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const fileSize = fs.statSync(req.file.path).size;

      const now = new Date();
      const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const fileId = `DOC-LEC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      
      const { getModuleUploadPath, MODULES, sanitizeFolderName } = require('./storage-helper');
      const folderName = `${sanitizeFolderName(lec.title || 'Bai_Giang')}_${lectureId}`;
      const { absPath: baseAbsPath, relPath: baseRelPath } = getModuleUploadPath(MODULES.LECTURES, now, folderName);
      
      const fileName = `${yyyymmdd}_LECTURE_${lectureId}_${sha256.slice(0, 8)}.pdf`;
      const relPath = `${baseRelPath}/${fileName}`;
      const absPath = path.join(baseAbsPath, fileName);

      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      moveFileSafe(req.file.path, absPath);

      // 1. Thêm vào bảng DOCUMENT để có thể xem và trình chiếu qua stream /api/files/:fileId/view
      await pool.request()
        .input('fid', sql.VarChar(100), fileId)
        .input('code', sql.NVarChar(100), `BG-${lectureId}`)
        .input('title', sql.NVarChar(500), lec.title)
        .input('unit_id', sql.VarChar(50), lec.faculty_unit_id || null)
        .input('sec_id', sql.Int, lec.security_level_id || 2)
        .input('orig_name', sql.NVarChar(500), req.file.originalname)
        .input('stored_path', sql.NVarChar(500), relPath)
        .input('file_size', sql.BigInt, fileSize)
        .input('sha256', sql.Char(64), sha256)
        .input('uploaded_by', sql.VarChar(50), req.user.user_id)
        .input('summary', sql.NVarChar(sql.MAX), `Tài liệu bài giảng điện tử: ${lec.title}`)
        .query(`
          INSERT INTO DOCUMENT (
            file_id, document_code, title, doc_type_id, issued_date, issuing_unit_id,
            signer, summary, security_level_id, original_name, stored_path, mime_type,
            file_size, sha256, uploaded_by
          ) VALUES (
            @fid, @code, @title, NULL, GETDATE(), @unit_id,
            NULL, @summary, @sec_id, @orig_name, @stored_path, 'application/pdf',
            @file_size, @sha256, @uploaded_by
          )
        `);

      // 2. Cập nhật document_id vào DIGITAL_LECTURE
      await pool.request()
        .input('lid', sql.VarChar(50), lectureId)
        .input('doc_id', sql.VarChar(50), fileId)
        .query(`
          UPDATE DIGITAL_LECTURE
          SET document_id = @doc_id, content_type = 'PDF', updated_at = GETDATE()
          WHERE lecture_id = @lid
        `);

      res.json({
        success: true,
        file_id: fileId,
        stored_path: relPath,
        message: 'Đã lưu tệp giáo án PDF và gắn vào bài giảng thành công'
      });
    } catch (e) {
      console.error('[PDF upload]', e);
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: e.message });
    }
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

  router.post('/:lectureId/pdf/upload',
    requireAuth, requirePermission('LECTURE_CREATE'),
    uploadPdf.single('file'), handlePdfUpload);

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

  // Lấy danh sách các chế độ trình chiếu khả dụng trong gói học liệu (Demo, Tutorial, Practice, Test...)
  router.get('/:lectureId/modes', requireAuth, requirePermission('LECTURE_VIEW'), async (req, res) => {
    const lectureId = req.params.lectureId;
    try {
      const pkg = await loadLecturePackage(lectureId, req, res, {
        requirePublished: true,
        contentTypes: ['SCORM', 'HTML5'],
      });
      if (!pkg) return;

      const modes = [];
      if (fs.existsSync(pkg.packageRoot)) {
        const rootFiles = fs.readdirSync(pkg.packageRoot);
        if (rootFiles.includes('demo.html')) {
          modes.push({ id: 'demo', title: 'Minh họa (Demo)', file: 'demo.html' });
        }
        if (rootFiles.includes('tutorial.html')) {
          modes.push({ id: 'tutorial', title: 'Hướng dẫn', file: 'tutorial.html' });
        }
        if (rootFiles.includes('practice.html')) {
          modes.push({ id: 'practice', title: 'Luyện tập', file: 'practice.html' });
        }
        if (rootFiles.includes('test.html')) {
          modes.push({ id: 'test', title: 'Kiểm tra', file: 'test.html' });
        }
        if (rootFiles.includes('index.html') && modes.length > 0) {
          modes.push({ id: 'index', title: 'Menu tổng hợp', file: 'index.html' });
        }
      }

      res.json({
        lecture_id: lectureId,
        content_type: pkg.lecture.content_type,
        current_entry: path.basename(pkg.entryAbs),
        modes
      });
    } catch (e) {
      console.error('[lecture modes]', e);
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};