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
 * Chuyển đổi tiêu đề tiếng Việt thành tên thư mục an toàn (bỏ dấu, thay khoảng trắng).
 * Ví dụ: "Bài 1 - Chiến thuật" -> "Bai_1_Chien_thuat"
 */
function sanitizeFolderName(name) {
  if (!name) return 'khong-ten';
  // 1. Chuẩn hóa NFD và loại bỏ dấu
  let str = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // 2. Xử lý chữ đ/Đ
  str = str.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  // 3. Chỉ giữ lại chữ, số, gạch ngang, gạch dưới
  str = str.replace(/[^a-zA-Z0-9\-_]/g, '_');
  // 4. Gộp các dấu gạch dưới liên tiếp và cắt khoảng trắng thừa 2 đầu
  str = str.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  
  if (!str) str = 'khong-ten';
  return str.substring(0, 100); // Giới hạn độ dài tối đa 100 ký tự
}

/**
 * Trả về đường dẫn tuyệt đối, đường dẫn tương đối (lưu DB) và đảm bảo thư mục tồn tại.
 * Cấu trúc: uploads/<module>/<yyyy>/<mm>/<subFolder>
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