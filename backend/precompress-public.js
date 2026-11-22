// backend/precompress-public.js
// Nén sẵn (gzip mức 9) các file tĩnh dạng text trong backend/public thành <file>.gz.
// Server (server.js) sẽ phát file .gz trực tiếp khi trình duyệt hỗ trợ → không tốn CPU nén ở mỗi request.
//
// Chạy sau mỗi lần build frontend:   node precompress-public.js
// (deploy/dong-goi.bat đã tự chạy bước này). File .gz cũ hơn file gốc bị server bỏ qua, nên quên chạy lại
// chỉ làm mất lợi ích tốc độ chứ không phát ra nội dung cũ.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PUBLIC = path.join(__dirname, 'public');
const EXT = /\.(js|mjs|css|html|svg|json|map|txt|xml)$/i;
const MIN_BYTES = 1024;

let files = 0, before = 0, after = 0;
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) { walk(abs); continue; }
    if (!EXT.test(name) || name.endsWith('.gz') || st.size < MIN_BYTES) continue;
    const gz = zlib.gzipSync(fs.readFileSync(abs), { level: 9 });
    if (gz.length >= st.size) continue; // không có lợi thì thôi
    fs.writeFileSync(abs + '.gz', gz);
    files++; before += st.size; after += gz.length;
  }
})(PUBLIC);

console.log(`[precompress] ${files} file: ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`);
