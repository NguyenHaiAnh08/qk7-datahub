const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sql = require('mssql');

const dbConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || 'QK7_ThuVienSo',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function main() {
  const uploadsDir = path.resolve(__dirname, '..', 'uploads');
  const old2026Dir = path.join(uploadsDir, '2026');
  const vanBanSoDir = path.join(uploadsDir, 'van-ban-so');
  const target2026Dir = path.join(vanBanSoDir, '2026');
  const thuVienSoDir = path.join(uploadsDir, 'thu-vien-so');

  console.log('=== BƯỚC 1: TỔ CHỨC THƯ MỤC TRÊN ĐĨA ===');

  // 1. Tạo thư mục thu-vien-so nếu chưa có
  if (!fs.existsSync(thuVienSoDir)) {
    fs.mkdirSync(thuVienSoDir, { recursive: true });
    console.log('[OK] Đã tạo thư mục:', thuVienSoDir);
  } else {
    console.log('[INFO] Thư mục thu-vien-so đã tồn tại:', thuVienSoDir);
  }

  // 2. Tạo thư mục van-ban-so nếu chưa có
  if (!fs.existsSync(vanBanSoDir)) {
    fs.mkdirSync(vanBanSoDir, { recursive: true });
    console.log('[OK] Đã tạo thư mục van-ban-so:', vanBanSoDir);
  }

  // 3. Di chuyển 2026 sang van-ban-so/2026
  if (fs.existsSync(old2026Dir)) {
    if (!fs.existsSync(target2026Dir)) {
      // Đổi tên trực tiếp
      fs.renameSync(old2026Dir, target2026Dir);
      console.log(`[OK] Đã chuyển đổi: ${old2026Dir} -> ${target2026Dir}`);
    } else {
      // Nếu target2026Dir đã có một phần, copy từng thư mục con (10, 11) vào
      const months = fs.readdirSync(old2026Dir);
      for (const m of months) {
        const srcM = path.join(old2026Dir, m);
        const dstM = path.join(target2026Dir, m);
        if (!fs.existsSync(dstM)) {
          fs.renameSync(srcM, dstM);
          console.log(`[OK] Đã chuyển thư mục tháng: ${srcM} -> ${dstM}`);
        } else {
          const files = fs.readdirSync(srcM);
          for (const f of files) {
            const srcF = path.join(srcM, f);
            const dstF = path.join(dstM, f);
            if (!fs.existsSync(dstF)) {
              fs.renameSync(srcF, dstF);
              console.log(`[OK] Đã chuyển file: ${f}`);
            }
          }
          try { fs.rmdirSync(srcM); } catch (_) {}
        }
      }
      try { fs.rmdirSync(old2026Dir); } catch (_) {}
      console.log(`[OK] Hoàn tất di chuyển nội dung từ 2026 sang ${target2026Dir}`);
    }
  } else {
    console.log('[INFO] Thư mục uploads/2026 đã được chuyển trước đó hoặc không tồn tại.');
  }

  // Đảm bảo uploads/van-ban-so/2026/10 và 11 tồn tại
  console.log('Cấu trúc uploads/van-ban-so hiện tại:');
  function printTree(dir, indent = '  ') {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const isDir = fs.lstatSync(full).isDirectory();
      console.log(`${indent}${isDir ? '📁' : '📄'} ${item}`);
      if (isDir) printTree(full, indent + '  ');
    }
  }
  printTree(vanBanSoDir);

  console.log('\n=== BƯỚC 2: CẬP NHẬT ĐƯỜNG DẪN TRONG CSDL (SQL SERVER) ===');
  const pool = await sql.connect(dbConfig);

  // 1. DOCUMENT
  const docUpdate = await pool.request().query(`
    UPDATE DOCUMENT
    SET stored_path = REPLACE(stored_path, 'uploads/2026/', 'uploads/van-ban-so/2026/')
    WHERE stored_path LIKE 'uploads/2026/%';
  `);
  console.log(`[DOCUMENT] Đã cập nhật ${docUpdate.rowsAffected[0]} bản ghi.`);

  // 2. DOCUMENT_REVISION_PROPOSAL
  const propUpdate = await pool.request().query(`
    UPDATE DOCUMENT_REVISION_PROPOSAL
    SET new_stored_path = REPLACE(new_stored_path, 'uploads/2026/', 'uploads/van-ban-so/2026/')
    WHERE new_stored_path LIKE 'uploads/2026/%';
  `);
  console.log(`[DOCUMENT_REVISION_PROPOSAL] Đã cập nhật ${propUpdate.rowsAffected[0]} bản ghi.`);

  // 3. DIGITAL_LECTURE
  const lecUpdate = await pool.request().query(`
    UPDATE DIGITAL_LECTURE
    SET pdf_path = REPLACE(pdf_path, 'uploads/2026/', 'uploads/van-ban-so/2026/')
    WHERE pdf_path LIKE 'uploads/2026/%';
  `);
  console.log(`[DIGITAL_LECTURE] Đã cập nhật ${lecUpdate.rowsAffected[0]} bản ghi.`);

  console.log('\n=== BƯỚC 3: KIỂM TRA ĐỐI SOÁT TOÀN DIỆN TỪNG TÀI LIỆU ===');
  const allDocs = await pool.request().query(`
    SELECT file_id, document_code, stored_path, sha256
    FROM DOCUMENT
  `);

  let successCount = 0;
  let failCount = 0;
  const backendDir = path.resolve(__dirname, '..');

  for (const doc of allDocs.recordset) {
    const fullPath = path.join(backendDir, doc.stored_path);
    const exists = fs.existsSync(fullPath);
    if (exists) {
      successCount++;
    } else {
      failCount++;
      console.error(`[CẢNH BÁO FILE THIẾU] ${doc.file_id} (${doc.document_code}): ${doc.stored_path} -> Không tìm thấy tại ${fullPath}`);
    }
  }

  console.log(`\nKết quả kiểm tra đối soát file:`);
  console.log(`- Tổng số tài liệu: ${allDocs.recordset.length}`);
  console.log(`- Tệp tồn tại hợp lệ: ${successCount} / ${allDocs.recordset.length}`);
  console.log(`- Tệp thiếu: ${failCount}`);

  // Kiểm tra DIGITAL_LECTURE
  const lecDocs = await pool.request().query(`
    SELECT lecture_id, title, pdf_path
    FROM DIGITAL_LECTURE
    WHERE pdf_path IS NOT NULL
  `);
  for (const l of lecDocs.recordset) {
    const fullPath = path.join(backendDir, l.pdf_path);
    const exists = fs.existsSync(fullPath);
    console.log(`[LECTURE FILE] ${l.lecture_id} (${l.title}): ${l.pdf_path} => ${exists ? '✅ TỒN TẠI' : '❌ THIẾU'}`);
  }

  await pool.close();
  console.log('\n=== HOÀN TẤT MIGRATION THÀNH CÔNG ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Lỗi migration:', err);
  process.exit(1);
});
