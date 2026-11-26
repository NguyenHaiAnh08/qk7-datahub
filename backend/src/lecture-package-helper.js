// backend/src/lecture-package-helper.js
// Giải nén gói bài giảng vào thư mục phiên bản mới, và dọn tệp của bản cũ sau khi bản mới được ghi nhận.

const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { getModuleUploadPath, MODULES, sanitizeFolderName } = require('./storage-helper');
const { validatePackage, writePackage, formatIssues } = require('./lecture-package-validator');
const perfTrace = require('./perf-trace');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const UPLOADS_ROOT = path.join(PROJECT_ROOT, 'uploads');
// Mỗi lần giải nén dùng một thư mục con riêng: tệp bản cũ không lẫn vào bản mới
const VERSION_PREFIX = 'goi-';

/**
 * Giải nén KHÔNG đụng tới bản đang dùng và KHÔNG xóa ZIP chờ duyệt.
 * Người gọi ghi CSDL xong thì gọi finishReplacement(); ghi lỗi thì gọi removePackage(entry mới).
 */
async function extractAndParse({ lectureId, pendingPath, title, createdAt }) {
    const zipAbsPath = path.resolve(PROJECT_ROOT, pendingPath);
    if (!fs.existsSync(zipAbsPath)) {
        throw new Error(`Không tìm thấy file ZIP tại đường dẫn: ${zipAbsPath}`);
    }

    // Kiểm tra lại ngay trước khi giải nén (gói chờ duyệt có thể đã bị thay trên đĩa).
    // Kiểm tra và ghi cùng một dữ liệu trong bộ nhớ; không đạt thì không ghi tệp nào.
    const check = perfTrace.step('Kiểm tra gói bài giảng trước khi giải nén',
        () => validatePackage(new AdmZip(zipAbsPath)), (r) => ({ 'Số tệp trong gói': r.files.length, 'Đạt': r.ok ? 'Có' : 'Không' }));
    if (!check.ok) throw new Error(formatIssues(check.issues));

    // ✅ THƯ MỤC: bai-giang-so/YYYY/MM/Ten_Bai_Giang_MaLecture/goi-<phiên bản>
    const folderName = `${sanitizeFolderName(title || 'Bai_Giang')}_${lectureId}`;
    const date = createdAt ? new Date(createdAt) : new Date();
    const lectureDir = getModuleUploadPath(MODULES.LECTURES, date, folderName);
    const versionName = `${VERSION_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const targetDir = path.join(lectureDir.absPath, versionName);

    let launchFile = 'index.html';
    let scormVersion = '1.2';
    let contentType = 'HTML5';

    try {
        fs.mkdirSync(targetDir, { recursive: true });
        perfTrace.step('Giải nén gói bài giảng', () => writePackage(check.files, targetDir),
            () => ({ 'Số tệp ghi ra': check.files.length }));

        const manifestPath = path.join(targetDir, 'imsmanifest.xml');

        if (fs.existsSync(manifestPath)) {
            const { XMLParser } = require('fast-xml-parser');
            const xml = fs.readFileSync(manifestPath, 'utf8');
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
            const doc = parser.parse(xml);
            const resources = doc?.manifest?.resources?.resource;
            const list = Array.isArray(resources) ? resources : [resources];
            const first = list.find((r) => r && r['@_href']);
            if (first) {
                launchFile = first['@_href'];
                scormVersion = doc?.manifest?.metadata?.schemaversion || '1.2';
                contentType = 'SCORM';
            }
        } else {
            const rootFiles = fs.readdirSync(targetDir);
            if (rootFiles.includes('demo.html') && (rootFiles.includes('rlprez.js') || rootFiles.includes('player'))) {
                launchFile = 'demo.html';
            } else {
                const commonEntries = ['story.html', 'index.html', 'launch.html', 'story_html5.html', 'demo.html'];
                const foundEntry = commonEntries.find(f => rootFiles.includes(f))
                    || rootFiles.find(f => f.toLowerCase().endsWith('.html'));
                if (!foundEntry) {
                    throw new Error('Không tìm thấy file khởi chạy (.html) hoặc imsmanifest.xml trong gói học liệu.');
                }
                launchFile = foundEntry;
            }
        }

        // href trong imsmanifest.xml do người tạo gói viết → không tin: cấm tuyệt đối/".." để không thoát khỏi thư mục bài giảng
        if (typeof launchFile !== 'string' || /^([a-zA-Z]:|[\\/])/.test(launchFile) ||
            launchFile.split(/[\\/]/).includes('..')) {
            throw new Error('Gói học liệu không hợp lệ: đường dẫn khởi chạy trong imsmanifest.xml trỏ ra ngoài gói.');
        }
    } catch (err) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        throw err;
    }

    // Đường dẫn tương đối cho DB: uploads/bai-giang-so/YYYY/MM/Ten_Bai_Giang_MaLecture/goi-xxx/index.html
    const relativeEntryPoint = `${lectureDir.relPath}/${versionName}/${launchFile}`.replace(/\\/g, '/');

    return {
        entry_point: relativeEntryPoint,
        content_type: contentType,
        launchFile: launchFile,
        scormVersion: scormVersion
    };
}

/** Xóa một tệp trong thư mục uploads (đường dẫn tương đối lưu trong CSDL). Lỗi chỉ ghi log. */
function removeUploadFile(relPath) {
    if (!relPath) return;
    try {
        const abs = path.resolve(PROJECT_ROOT, relPath);
        if (abs.startsWith(UPLOADS_ROOT + path.sep) && fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch (err) {
        console.warn('[lecture package] Không xóa được tệp:', relPath, err.message);
    }
}

/**
 * Xóa các tệp của gói chứa entryPoint. Chỉ xóa trong thư mục mang đúng mã bài giảng; giữ lại tệp PDF giáo án.
 *  - Gói theo phiên bản (…/goi-xxx/…): xóa đúng thư mục phiên bản đó.
 *  - Gói kiểu cũ (giải nén thẳng vào thư mục bài): xóa mọi thứ trừ PDF và các thư mục phiên bản.
 */
function removePackage(entryPoint, lectureId) {
    if (!entryPoint || !lectureId) return;
    const parts = String(entryPoint).replace(/\\/g, '/').split('/');
    // uploads / bai-giang-so / YYYY / MM / <thư mục bài> / …
    if (parts.length < 6 || parts[0] !== 'uploads' || parts[1] !== MODULES.LECTURES ||
        parts.some((p) => p === '' || p === '.' || p === '..') || !parts[4].endsWith(`_${lectureId}`)) return;
    const lectureDir = path.join(PROJECT_ROOT, ...parts.slice(0, 5));
    try {
        if (!fs.existsSync(lectureDir)) return;
        if (parts.length > 6 && parts[5].startsWith(VERSION_PREFIX)) {
            fs.rmSync(path.join(lectureDir, parts[5]), { recursive: true, force: true });
            return;
        }
        for (const item of fs.readdirSync(lectureDir, { withFileTypes: true })) {
            if (item.isDirectory() && item.name.startsWith(VERSION_PREFIX)) continue;
            if (item.isFile() && /\.pdf$/i.test(item.name)) continue;
            fs.rmSync(path.join(lectureDir, item.name), { recursive: true, force: true });
        }
    } catch (err) {
        console.warn('[lecture package] Không dọn được gói cũ:', entryPoint, err.message);
    }
}

/** Gọi SAU KHI CSDL đã trỏ sang bản mới: xóa ZIP chờ duyệt và tệp của bản cũ */
function finishReplacement({ lectureId, pendingPath, oldEntryPoint }) {
    removeUploadFile(pendingPath);
    removePackage(oldEntryPoint, lectureId);
}

module.exports = {
    extractAndParse,
    finishReplacement,
    removePackage,
    removeUploadFile,
};
