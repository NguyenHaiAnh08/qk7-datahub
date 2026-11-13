// backend/src/scorm-manifest.js
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');

/**
 * Giải nén file .zip và trả về launch file.
 * @param {string} zipPath    đường dẫn file .zip
 * @param {string} targetDir  thư mục đích (sẽ được tạo nếu chưa có)
 * @returns {Promise<{ launchFile: string, scormVersion: string }>}
 */
async function extractAndParse(zipPath, targetDir) {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Không tìm thấy file: ${zipPath}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetDir, /* overwrite */ true);

  const manifestPath = path.join(targetDir, 'imsmanifest.xml');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Gói SCORM không có imsmanifest.xml');
  }

  const xml = fs.readFileSync(manifestPath, 'utf8');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml);

  const resources = doc?.manifest?.resources?.resource;
  if (!resources) throw new Error('Manifest không có thẻ <resource>');

  // Có thể là object hoặc array tùy cách parser đọc
  const list = Array.isArray(resources) ? resources : [resources];
  const first = list.find((r) => r['@_href']);
  if (!first) throw new Error('Manifest không có resource có href');

  const launchFile = first['@_href']; // ví dụ: "index.html"
  const scormVersion = doc?.manifest?.metadata?.schemaversion || '1.2';

  return { launchFile, scormVersion };
}

module.exports = { extractAndParse };