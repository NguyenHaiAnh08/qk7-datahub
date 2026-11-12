// backend/src/lecture-package-helper.js
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

async function extractAndParse({ lectureId, pendingPath }) {
    const projectRoot = path.resolve(__dirname, '..'); 
    const zipAbsPath = path.resolve(projectRoot, pendingPath);
    const targetDir = path.resolve(projectRoot, 'uploads', 'lectures', lectureId);

    if (!fs.existsSync(zipAbsPath)) {
        throw new Error(`Không tìm thấy file ZIP tại đường dẫn: ${zipAbsPath}`);
    }

    // 1. Giải nén file ZIP
    fs.mkdirSync(targetDir, { recursive: true });
    const zip = new AdmZip(zipAbsPath);
    zip.extractAllTo(targetDir, true);

    // 2. Tự động nhận diện Entry Point
    let launchFile = 'index.html';
    let scormVersion = '1.2';
    let contentType = 'HTML5';

    const manifestPath = path.join(targetDir, 'imsmanifest.xml');
    
    if (fs.existsSync(manifestPath)) {
        // === XỬ LÝ GÓI SCORM (Có imsmanifest.xml) ===
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
        // === XỬ LÝ GÓI HTML5 (Không có imsmanifest.xml) ===
        // Tìm các file khởi chạy phổ biến ở thư mục gốc
        const commonEntries = ['index.html', 'story.html', 'launch.html', 'story_html5.html'];
        const rootFiles = fs.readdirSync(targetDir);
        
        const foundEntry = commonEntries.find(f => rootFiles.includes(f));
        
        if (foundEntry) {
            launchFile = foundEntry;
        } else {
            // Nếu không thấy các file trên, quét tìm bất kỳ file .html nào ở thư mục gốc
            const anyHtml = rootFiles.find(f => f.toLowerCase().endsWith('.html'));
            if (anyHtml) {
                launchFile = anyHtml;
            } else {
                throw new Error('Không tìm thấy file index.html hoặc imsmanifest.xml trong gói học liệu.');
            }
        }
    }

    // 3. Cập nhật lại entry_point thành đường dẫn tương đối để lưu vào Database
    const relativeEntryPoint = path.relative(projectRoot, path.join(targetDir, launchFile)).replace(/\\/g, '/');
    
    // 4. Xóa file ZIP tạm sau khi giải nén thành công
    try {
        fs.unlinkSync(zipAbsPath);
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