// backend/src/bcrypt-lib.js
// Ưu tiên `bcrypt` (native, chạy trong luồng nền của libuv → không chặn luồng chính khi nhiều người đăng nhập cùng lúc).
// Nếu máy chủ không nạp được bản native (thiếu build/khác hệ điều hành) thì lùi về `bcryptjs` (thuần JS, chậm hơn
// và chiếm luồng chính). Hai thư viện cùng định dạng hash ($2a$/$2b$) nên mật khẩu cũ vẫn kiểm tra được.
let lib;
try {
  lib = require('bcrypt');
} catch (e) {
  console.warn('[bcrypt] Không nạp được bản native, dùng bcryptjs (chậm hơn khi nhiều người đăng nhập):', e.message);
  lib = require('bcryptjs');
}
module.exports = lib;
