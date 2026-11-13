// SỬA TOÀN BỘ NỘI DUNG FILE THÀNH:

const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { getModuleUploadPath, MODULES, sanitizeFolderName } = require('./storage-helper');

function extractZipSafely(zip, targetDir, maxTotalBytes = 300 * 1024 * 1024) {
    // ... (Giữ nguyên toàn bộ logic cũ của extractZipSafely)
    const entries = zip.getEntries();
    const resolvedTarget = path.resolve(targetDir);
    let totalUncompressedSize = 0;

    for (const entry of entries) {
        const entryName = entry.entryName;
        const destPath = path.resolve(resolvedTarget, entryName);
        if (!destPath.startsWith(resolvedTarget + path.sep) && destPath !== resolvedTarget) {
            throw new Error(`Phát hiện đường dẫn Zip Slip bất hợp pháp: "${entryName}"`);
        }
        totalUncompressedSize += entry.header.size;
        if (totalUncompressedSize > maxTotalBytes) {
            throw new Error(`Gói vượt quá giới hạn giải nén tối đa cho phép (${Math.round(maxTotalBytes / (1024 * 1024))}MB)`);
        }
        const ext = path.extname(entryName).toLowerCase();
        if (['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.py', '.php', '.jar', '.com'].includes(ext)) {
            throw new Error(`Gói chứa định dạng file thực thi bị cấm: ${ext}`);
        }
    }
    zip.extractAllTo(resolvedTarget, true);
}

async function extractAndParse({ lectureId, pendingPath, title, createdAt }) {
    const projectRoot = path.resolve(__dirname, '..'); 
    const zipAbsPath = path.resolve(projectRoot, pendingPath);
    
    // ✅ TẠO THƯ MỤC: bai-giang-so/YYYY/MM/Ten_Bai_Giang_MaLecture
    const folderName = `${sanitizeFolderName(title || 'Bai_Giang')}_${lectureId}`;
    const date = createdAt ? new Date(createdAt) : new Date();
    const { absPath: targetDir, relPath: baseRelPath } = getModuleUploadPath(MODULES.LECTURES, date, folderName);

    if (!fs.existsSync(zipAbsPath)) {
        throw new Error(`Không tìm thấy file ZIP tại đường dẫn: ${zipAbsPath}`);
    }

    fs.mkdirSync(targetDir, { recursive: true });
    const zip = new AdmZip(zipAbsPath);
    extractZipSafely(zip, targetDir);

    let launchFile = 'index.html';
    let scormVersion = '1.2';
    let contentType = 'HTML5';

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
            const foundEntry = commonEntries.find(f => rootFiles.includes(f));
            if (foundEntry) {
                launchFile = foundEntry;
            } else {
                const anyHtml = rootFiles.find(f => f.toLowerCase().endsWith('.html'));
                if (anyHtml) {
                    launchFile = anyHtml;
                } else {
                    throw new Error('Không tìm thấy file khởi chạy (.html) hoặc imsmanifest.xml trong gói học liệu.');
                }
            }
        }
    }

    // Trả về đường dẫn tương đối cho DB: uploads/bai-giang-so/YYYY/MM/Ten_Bai_Giang_MaLecture/index.html
    const relativeEntryPoint = `${baseRelPath}/${launchFile}`.replace(/\\/g, '/');
    
    try {
        fs.unlinkSync(zipAbsPath); // Xóa file ZIP tạm
    } catch (err) {
        console.warn('Không thể xóa file ZIP tạm:', err.message);
    }

    return {
        entry_point: relativeEntryPoint,
        content_type: contentType,
        launchFile: launchFile,
        scormVersion: scormVersion
    };
}

module.exports = {
    extractAndParse
};