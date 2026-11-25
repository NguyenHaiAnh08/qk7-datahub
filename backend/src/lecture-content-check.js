// backend/src/lecture-content-check.js
// Kiểm tra bài giảng đã có học liệu ĐẦY ĐỦ VÀ ĐÚNG trước khi gửi duyệt, để người đăng thay tệp ngay.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { checkPackageFile } = require('./lecture-package-worker');
const { formatIssues } = require('./lecture-package-validator');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const UPLOADS_ROOT = path.join(PROJECT_ROOT, 'uploads');
const HINT = 'Hãy vào Chỉnh sửa, chọn tệp khác rồi gửi lại.';

const resolveUpload = (relPath) => {
  if (!relPath) return null;
  const abs = path.resolve(PROJECT_ROOT, String(relPath));
  return abs.startsWith(UPLOADS_ROOT + path.sep) && fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null;
};

const hashFile = (abs) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  fs.createReadStream(abs).on('error', reject).on('data', (d) => hash.update(d)).on('end', () => resolve(hash.digest('hex')));
});

const fail = (code, error) => ({ ok: false, code, error: `${error} ${HINT}` });

/**
 * @param {{content_type:string, pdf_path?:string, pdf_sha256?:string, pending_scorm_path?:string, scorm_entry_point?:string}} lecture
 * @returns {Promise<{ok:true}|{ok:false, code:string, error:string}>}
 */
async function checkLectureContent(lecture) {
  if (lecture.content_type === 'PDF') {
    if (!lecture.pdf_path) return fail('NO_PACKAGE', 'Bài giảng chưa có tệp PDF.');
    const abs = resolveUpload(lecture.pdf_path);
    if (!abs) return fail('NO_PACKAGE', 'Tệp PDF của bài giảng không còn trên máy chủ.');
    const head = Buffer.alloc(5);
    const fd = fs.openSync(abs, 'r');
    try { fs.readSync(fd, head, 0, 5, 0); } finally { fs.closeSync(fd); }
    if (head.toString('latin1') !== '%PDF-') return fail('PDF_INVALID', 'Tệp giáo án không phải PDF hợp lệ.');
    const saved = String(lecture.pdf_sha256 || '').trim().toLowerCase();
    if (saved && saved !== await hashFile(abs)) {
      return fail('PDF_CHANGED', 'Tệp PDF trên máy chủ đã khác với tệp lúc tải lên.');
    }
    return { ok: true };
  }

  if (lecture.pending_scorm_path) {
    const abs = resolveUpload(lecture.pending_scorm_path);
    if (!abs) return fail('NO_PACKAGE', 'Gói bài giảng đã tải lên không còn trên máy chủ.');
    const check = await checkPackageFile(abs);
    if (!check.ok) return fail('PACKAGE_REJECTED', `${formatIssues(check.issues)}.`);
    return { ok: true };
  }
  if (lecture.scorm_entry_point) {
    return resolveUpload(lecture.scorm_entry_point)
      ? { ok: true }
      : fail('NO_PACKAGE', 'Tệp của gói bài giảng không còn trên máy chủ.');
  }
  return fail('NO_PACKAGE', 'Bài giảng chưa có gói học liệu.');
}

module.exports = { checkLectureContent };
