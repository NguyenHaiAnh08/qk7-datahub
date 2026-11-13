// backend/src/storage-helper.js
const path = require('path');
const fs = require('fs');

const MODULES = {
  DOCUMENTS: 'du-lieu-so',
  LECTURES: 'bai-giang-so',
  MATERIALS: 'hoc-lieu-so',
  LIBRARY: 'thu-vien-so',
};

/**
 * Chuyển đổi tiêu đề tiếng Việt thành tên thư mục an toàn (bỏ dấu, thay khoảng trắng bằng _)
 */
function sanitizeFolderName(name) {
  if (!name) return 'khong-ten';
  let str = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  str = str.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  str = str.replace(/[^a-zA-Z0-9\-_]/g, '_');
  str = str.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!str) str = 'khong-ten';
  return str.substring(0, 80); // Cắt ngắn tránh lỗi Windows MAX_PATH
}

/**
 * Trả về đường dẫn tuyệt đối, đường dẫn tương đối và đảm bảo thư mục tồn tại.
 * @param {string} moduleName - du-lieu-so, bai-giang-so, v.v.
 * @param {Date} date - Ngày tạo file (lấy năm tháng)
 * @param {string} subFolder - Tên thư mục con (VD: Tiêu đề bài giảng)
 */
function getModuleUploadPath(moduleName, date = new Date(), subFolder = null) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  
  const rootUploadsDir = path.join(__dirname, '..', 'uploads');
  const parts = [rootUploadsDir, moduleName, yyyy, mm];
  if (subFolder) {
    parts.push(subFolder);
  }
  
  const absPath = path.join(...parts);
  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, { recursive: true });
  }
  
  // Đường dẫn tương đối (dùng dấu / cho CSDL)
  const relPath = path.relative(path.join(__dirname, '..'), absPath).replace(/\\/g, '/');
  return { absPath, relPath, yyyy, mm };
}

module.exports = {
  MODULES,
  sanitizeFolderName,
  getModuleUploadPath,
};