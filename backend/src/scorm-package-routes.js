// backend/src/scorm-package-routes.js
// Upload ZIP SCORM/HTML5 / PDF → lưu pending/storage → phục vụ trình chiếu & quản lý bài giảng
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { sql, getPool } = require('./db');

module.exports = function createScormPackageRoutes({ requireAuth, requirePermission, writeAccessLog, getClientIp }) {
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

        // Nếu tệp tĩnh là HTML (ví dụ demo.html khi iframe tự chuyển), inject <base> để không lạc đường dẫn
        if (/\.(html|htm)$/i.test(subPath)) {
          const targetHtmlPath = path.resolve(pkg.packageRoot, subPath);
          if (targetHtmlPath.startsWith(pkg.packageRoot + path.sep) && fs.existsSync(targetHtmlPath)) {
            let htmlContent = fs.readFileSync(targetHtmlPath, 'utf8');
            const baseHref = `/api/lectures/${lectureId}/${contentTypes[0].toLowerCase()}/assets/`;
            if (!/<base\b/i.test(htmlContent)) {
              if (/<head(\s[^>]*)?>/i.test(htmlContent)) {
                htmlContent = htmlContent.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    <base href="${baseHref}" />`);
              } else if (/<html(\s[^>]*)?>/i.test(htmlContent)) {
                htmlContent = htmlContent.replace(/<html(\s[^>]*)?>/i, (m) => `${m}\n  <head><base href="${baseHref}" /></head>`);
              } else {
                htmlContent = `<base href="${baseHref}" />\n` + htmlContent;
              }
            }
            if (htmlContent.includes('openPrez')) {
              const overrideScript = `
    <script>
      (function() {
        window.openPrez = function(url) {
          if (!url) return false;
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'AP_CHANGE_MODE', file: url }, '*');
              return false;
            }
          } catch (_) {}
          window.location.href = url;
          return false;
        };
      })();
    </script>
`;
              if (htmlContent.includes('</body>')) {
                htmlContent = htmlContent.replace('</body>', `${overrideScript}</body>`);
              } else {
                htmlContent = htmlContent + overrideScript;
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
            return res.send(htmlContent);
          }
        }

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
        // Gửi tin nhắn qua postMessage tới cửa sổ cha (LiveSessionRoom) để chuyển đổi chế độ chuẩn
        if (html.includes('openPrez')) {
          const overrideScript = `
    <script>
      (function() {
        window.openPrez = function(url) {
          if (!url) return false;
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'AP_CHANGE_MODE', file: url }, '*');
              return false;
            }
          } catch (_) {}
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
  // Tệp giáo án PDF của bài giảng số — TÁCH BIỆT HOÀN TOÀN với bảng DOCUMENT (Dữ liệu số).
  // Thông tin tệp nằm ngay trong DIGITAL_LECTURE: pdf_path / pdf_name / pdf_size / pdf_sha256.
  // Xem tệp qua GET /api/lectures/:lectureId/pdf (kiểm tra quyền theo chính bài giảng).
  // ────────────────────────────────────────────────────────────────────
  const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');

  // Chỉ cho phép thao tác trên tệp nằm trong thư mục uploads (chống path traversal)
  const resolveUploadPath = (relPath) => {
    if (!relPath) return null;
    const abs = path.resolve(__dirname, '..', relPath);
    return abs.startsWith(UPLOADS_ROOT + path.sep) ? abs : null;
  };

  const removeUploadFile = (relPath) => {
    try {
      const abs = resolveUploadPath(relPath);
      if (abs && fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch (e) {
      console.warn('[PDF] Không xóa được tệp cũ:', relPath, e.message);
    }
  };

  const isPdfFile = (absPath) => {
    let fd;
    try {
      fd = fs.openSync(absPath, 'r');
      const buf = Buffer.alloc(5);
      fs.readSync(fd, buf, 0, 5, 0);
      return buf.toString('latin1') === '%PDF-';
    } catch {
      return false;
    } finally {
      if (fd !== undefined) try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  };

  async function handlePdfUpload(req, res) {
    const lectureId = req.params.lectureId;
    const dropTemp = () => { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); };
    let movedAbs = null;
    try {
      if (!req.file) return res.status(400).json({ error: 'Thiếu tệp .pdf' });

      const pool = await getPool();
      const lr = await pool.request()
        .input('lid', sql.VarChar(50), lectureId)
        .query(`SELECT lecture_id, title, author_id, status, pdf_path FROM DIGITAL_LECTURE WHERE lecture_id=@lid`);

      if (lr.recordset.length === 0) {
        dropTemp();
        return res.status(404).json({ error: 'Không tìm thấy bài giảng' });
      }

      const lec = lr.recordset[0];
      const isAdmin = (req.user.roles || []).includes('ROL-01');
      if (!isAdmin && lec.author_id !== req.user.user_id) {
        dropTemp();
        return res.status(403).json({ error: 'Chỉ tác giả mới được tải lên tệp giáo án' });
      }
      // Chỉ được thay tệp khi bài giảng còn là bản nháp / bị từ chối — nếu không, tác giả
      // có thể đổi nội dung bài đã duyệt/đã xuất bản mà không qua quy trình duyệt 2 tầng.
      if (!['DRAFT', 'REJECTED'].includes(lec.status)) {
        dropTemp();
        return res.status(409).json({
          error: 'Chỉ được thay tệp giáo án khi bài giảng ở trạng thái Bản nháp hoặc Bị từ chối',
          code: 'LECTURE_NOT_EDITABLE',
          status: lec.status,
        });
      }
      if (!isPdfFile(req.file.path)) {
        dropTemp();
        return res.status(400).json({ error: 'Tệp tải lên không phải PDF hợp lệ' });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const fileSize = fs.statSync(req.file.path).size;

      const now = new Date();
      const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

      const { getModuleUploadPath, MODULES, sanitizeFolderName } = require('./storage-helper');
      const folderName = `${sanitizeFolderName(lec.title || 'Bai_Giang')}_${lectureId}`;
      const { absPath: baseAbsPath, relPath: baseRelPath } = getModuleUploadPath(MODULES.LECTURES, now, folderName);

      const fileName = `${yyyymmdd}_LECTURE_${lectureId}_${sha256.slice(0, 8)}.pdf`;
      const relPath = `${baseRelPath}/${fileName}`;
      const absPath = path.join(baseAbsPath, fileName);

      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      moveFileSafe(req.file.path, absPath);
      movedAbs = absPath;

      await pool.request()
        .input('lid', sql.VarChar(50), lectureId)
        .input('p', sql.NVarChar(500), relPath)
        .input('n', sql.NVarChar(255), String(req.file.originalname || fileName).slice(0, 255))
        .input('s', sql.BigInt, fileSize)
        .input('h', sql.Char(64), sha256)
        .query(`
          UPDATE DIGITAL_LECTURE
          SET pdf_path = @p, pdf_name = @n, pdf_size = @s, pdf_sha256 = @h,
              content_type = 'PDF', document_id = NULL, updated_at = GETDATE()
          WHERE lecture_id = @lid
        `);
      movedAbs = null; // đã ghi DB thành công → không cần hoàn tác

      // Thay tệp: xóa tệp cũ (nếu khác đường dẫn mới)
      if (lec.pdf_path && lec.pdf_path !== relPath) removeUploadFile(lec.pdf_path);

      res.json({
        success: true,
        has_pdf: true,
        pdf_name: req.file.originalname,
        pdf_size: fileSize,
        message: 'Đã lưu tệp giáo án PDF cho bài giảng'
      });
    } catch (e) {
      console.error('[PDF upload]', e);
      dropTemp();
      if (movedAbs && fs.existsSync(movedAbs)) { try { fs.unlinkSync(movedAbs); } catch { /* ignore */ } }
      res.status(500).json({ error: e.message });
    }
  }

  // GET /api/lectures/:lectureId/pdf — phát tệp PDF giáo án (inline, không cho tải về)
  async function servePdf(req, res) {
    const lectureId = req.params.lectureId;
    try {
      const pool = await getPool();
      const lr = await pool.request()
        .input('lid', sql.VarChar(50), lectureId)
        .query(`SELECT lecture_id, status, security_level_id, author_id, pdf_path, pdf_name
                FROM DIGITAL_LECTURE WHERE lecture_id = @lid`);
      const lec = lr.recordset[0];
      if (!lec || !lec.pdf_path) return res.status(404).json({ error: 'Bài giảng chưa có tệp PDF' });

      const roles = req.user.roles || [];
      const isAdmin = roles.includes('ROL-01');
      const isAuthor = lec.author_id === req.user.user_id;
      const isReviewer = (req.user.permissions || []).includes('LECTURE_APPROVE');

      if (lec.status === 'DELETED' && !isAdmin) {
        return res.status(404).json({ error: 'Bài giảng không tồn tại' });
      }
      if (lec.status !== 'PUBLISHED' && !isAdmin && !isAuthor && !isReviewer) {
        return res.status(404).json({ error: 'Bài giảng chưa được xuất bản' });
      }
      if (lec.security_level_id > (req.user.clearance_level_id || 1)) {
        return res.status(403).json({ error: 'Không đủ cấp bảo mật' });
      }

      // Cấp 3+: cần token vân tay đúng bài giảng, HOẶC đang là người giảng của một ca ONGOING
      // (mở ca đã bắt buộc token vân tay khớp lecture_id — xem POST /api/lectures/schedules).
      if (lec.security_level_id >= 3) {
        let ok = false;
        const fpToken = req.headers['x-fingerprint-token'] || req.query.fp;
        if (fpToken) {
          try {
            const decoded = require('jsonwebtoken').verify(String(fpToken), process.env.JWT_SECRET);
            ok = decoded.purpose === 'file_access'
              && decoded.file_id === lectureId
              && decoded.user_id === req.user.user_id
              && (lec.security_level_id < 4 || !!decoded.pin_verified);
          } catch { ok = false; }
        }
        if (!ok) {
          const ongoing = await pool.request()
            .input('lid', sql.VarChar(50), lectureId)
            .input('uid', sql.VarChar(50), req.user.user_id)
            .query(`SELECT TOP 1 1 AS x FROM TEACHING_SCHEDULE
                    WHERE lecture_id = @lid AND presenter_id = @uid AND status = 'ONGOING'`);
          ok = ongoing.recordset.length > 0;
        }
        if (!ok) {
          return res.status(403).json({
            error: 'Bài giảng Cấp 3+ yêu cầu xác thực vân tay hoặc đang trong ca giảng của bạn',
            require_fingerprint: true,
          });
        }
      }

      const abs = resolveUploadPath(lec.pdf_path);
      if (!abs || !abs.toLowerCase().endsWith('.pdf') || !fs.existsSync(abs)) {
        return res.status(404).json({ error: 'Tệp PDF không còn trên hệ thống lưu trữ' });
      }
      if (fs.lstatSync(abs).isSymbolicLink()) {
        return res.status(403).json({ error: 'Không thể truy cập tệp' });
      }

      if (typeof writeAccessLog === 'function') {
        writeAccessLog({
          userId: req.user.user_id,
          fileId: null, // ACCESS_LOG.file_id có FK sang DOCUMENT → không dùng cho bài giảng
          action: 'LECTURE_PDF_VIEW',
          ip: typeof getClientIp === 'function' ? getClientIp(req) : req.ip,
          note: `Xem PDF bài giảng ${lectureId}`,
        }).catch(() => {});
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(lec.pdf_name || 'giao-an.pdf')}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      fs.createReadStream(abs).pipe(res);
    } catch (e) {
      console.error('[PDF serve]', e);
      if (!res.headersSent) res.status(500).json({ error: e.message });
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

  // Xem PDF giáo án (tách biệt khỏi /api/files của Dữ liệu số)
  router.get('/:lectureId/pdf',
    requireAuth, requirePermission('LECTURE_VIEW'), servePdf);

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
        // Thứ tự chuẩn: Menu tổng hợp (Home) -> Minh họa -> Hướng dẫn -> Luyện tập -> Kiểm tra
        if (rootFiles.includes('index.html')) {
          modes.push({ id: 'index', title: 'Menu tổng hợp', file: 'index.html' });
        }
        if (rootFiles.includes('demo.html')) {
          modes.push({ id: 'demo', title: 'Minh họa', file: 'demo.html' });
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