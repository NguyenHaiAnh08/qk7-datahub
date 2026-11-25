#!/usr/bin/env node
// Thêm trình phát / khuôn trang của một gói ActivePresenter SẠCH vào danh sách tin cậy.
//   node scripts/trust-ap-package.js <goi.zip> [goi2.zip ...]        → chỉ xem sẽ thêm gì
//   node scripts/trust-ap-package.js --yes <goi.zip> [goi2.zip ...]  → ghi vào danh sách
// CHỈ chạy với gói do chính người tin cậy xuất trực tiếp từ ActivePresenter:
// mọi tệp trình phát trong gói đó sẽ được hệ thống coi là an toàn.
const fs = require('fs');
const path = require('path');
const AdmZip = require('../backend/node_modules/adm-zip');
const v = require('../backend/src/lecture-package-validator');

const args = process.argv.slice(2);
const write = args.includes('--yes');
const zips = args.filter((a) => a !== '--yes');
if (!zips.length) {
  console.log('Cách dùng: node scripts/trust-ap-package.js [--yes] <goi.zip> [goi2.zip ...]');
  process.exit(1);
}

const trusted = fs.existsSync(v.TRUSTED_FILE) ? v.loadTrusted() : { player: {}, schemas: {}, pages: [] };
const added = [];
const remember = (map, key, hash, label) => {
  map[key] = map[key] || [];
  if (!map[key].includes(hash)) { map[key].push(hash); added.push(`${label}: ${key}  ${hash.slice(0, 12)}`); }
};

let failed = false;
for (const file of zips) {
  const zip = new AdmZip(path.resolve(file));
  const files = zip.getEntries().filter((e) => !e.isDirectory);
  const data = files.find((e) => /(^|\/)rlprez\.js$/.test(e.entryName));
  if (!data) { console.error(`${file}: không phải gói ActivePresenter`); failed = true; continue; }
  const prefix = data.entryName.slice(0, -'rlprez.js'.length);

  for (const e of files) {
    const name = e.entryName;
    const rel = name.startsWith(prefix) ? name.slice(prefix.length) : null;
    if (rel && rel.startsWith('player/')) {
      remember(trusted.player, rel, v.sha256(e.getData()), 'trình phát');
    } else if (/^[^/]+\.(xsd|dtd)$/i.test(name)) {
      remember(trusted.schemas, name, v.sha256(e.getData()), 'lược đồ');
    } else if (rel && v.PAGE_NAMES.includes(rel)) {
      const hash = v.pageHash(e.getData().toString('utf8'));
      if (!trusted.pages.includes(hash)) { trusted.pages.push(hash); added.push(`khuôn trang: ${name}  ${hash.slice(0, 12)}`); }
    }
  }

  // Phần còn lại (dữ liệu bài, phương tiện, manifest) vẫn phải đạt kiểm tra
  const check = v.validatePackage(zip, trusted);
  if (!check.ok) {
    failed = true;
    console.error(`${file}: KHÔNG đạt, không thể tin cậy:`);
    for (const i of check.issues) console.error(`  - ${i.file}: ${i.reason}`);
  } else {
    console.log(`${file}: đạt (${check.format})`);
  }
}

console.log(`\n${added.length} mục mới:`);
for (const a of added) console.log('  + ' + a);

if (failed) { console.error('\nCó gói không đạt — không ghi gì.'); process.exit(1); }
if (!added.length) process.exit(0);
if (!write) { console.log('\nChưa ghi. Kiểm tra danh sách trên rồi chạy lại với --yes.'); process.exit(0); }
fs.writeFileSync(v.TRUSTED_FILE, JSON.stringify(trusted, null, 2) + '\n');
console.log(`\nĐã ghi ${v.TRUSTED_FILE}`);
