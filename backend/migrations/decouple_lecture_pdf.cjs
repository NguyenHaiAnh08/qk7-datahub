// Tách tệp PDF bài giảng khỏi bảng DOCUMENT (Dữ liệu số).
//
//   node migrations/decouple_lecture_pdf.cjs            → chạy thật
//   node migrations/decouple_lecture_pdf.cjs --dry-run  → chỉ báo cáo, hoàn tác toàn bộ
//
// Việc làm (trong 1 transaction, chạy lại nhiều lần vẫn an toàn):
//   1. Thêm cột DIGITAL_LECTURE.pdf_path / pdf_name / pdf_size / pdf_sha256.
//   2. Với bài giảng đang trỏ tới DOCUMENT 'DOC-LEC-%': chép đường dẫn tệp sang cột mới.
//   3. Đặt document_id = NULL cho các bài giảng đó.
//   4. XÓA các dòng DOCUMENT 'DOC-LEC-%' (chỉ xóa bản ghi DB — KHÔNG xóa tệp trên đĩa,
//      vì bài giảng vẫn dùng đúng tệp đó). Đề xuất chỉnh sửa / phiên bản gắn với các dòng này
//      bị xóa theo (FK ON DELETE CASCADE); ACCESS_LOG.file_id được đặt NULL.
const { getPool, sql } = require('../src/db');

const DRY = process.argv.includes('--dry-run');

async function migrate() {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  const q = (text) => new sql.Request(tx).query(text);

  try {
    await q(`
      IF COL_LENGTH('DIGITAL_LECTURE', 'pdf_path') IS NULL
        ALTER TABLE DIGITAL_LECTURE ADD pdf_path NVARCHAR(500) NULL;
      IF COL_LENGTH('DIGITAL_LECTURE', 'pdf_name') IS NULL
        ALTER TABLE DIGITAL_LECTURE ADD pdf_name NVARCHAR(255) NULL;
      IF COL_LENGTH('DIGITAL_LECTURE', 'pdf_size') IS NULL
        ALTER TABLE DIGITAL_LECTURE ADD pdf_size BIGINT NULL;
      IF COL_LENGTH('DIGITAL_LECTURE', 'pdf_sha256') IS NULL
        ALTER TABLE DIGITAL_LECTURE ADD pdf_sha256 CHAR(64) NULL;
    `);
    console.log('[1] Đã đảm bảo 4 cột pdf_* trên DIGITAL_LECTURE');

    // Lưu ý: cột vừa ADD trong cùng batch chưa dùng được trong câu lệnh kế tiếp của CÙNG batch,
    // nhưng ở đây mỗi q() là một batch riêng nên an toàn.
    const copied = await q(`
      UPDATE dl
      SET dl.pdf_path = d.stored_path,
          dl.pdf_name = LEFT(d.original_name, 255),
          dl.pdf_size = d.file_size,
          dl.pdf_sha256 = d.sha256
      FROM DIGITAL_LECTURE dl
      JOIN DOCUMENT d ON d.file_id = dl.document_id
      WHERE dl.document_id LIKE 'DOC-LEC-%' AND dl.pdf_path IS NULL
    `);
    console.log(`[2] Đã chép thông tin tệp cho ${copied.rowsAffected[0]} bài giảng`);

    const cleared = await q(`
      UPDATE DIGITAL_LECTURE SET document_id = NULL
      WHERE document_id LIKE 'DOC-LEC-%'
        AND pdf_path IS NOT NULL
    `);
    console.log(`[3] Đã gỡ liên kết document_id của ${cleared.rowsAffected[0]} bài giảng`);

    // Bài giảng còn trỏ DOC-LEC nhưng DOCUMENT không còn → chỉ xóa liên kết treo
    const dangling = await q(`
      UPDATE DIGITAL_LECTURE SET document_id = NULL WHERE document_id LIKE 'DOC-LEC-%'
    `);
    if (dangling.rowsAffected[0] > 0) {
      console.warn(`    ⚠ ${dangling.rowsAffected[0]} bài giảng trỏ DOC-LEC nhưng không chép được tệp (DOCUMENT đã mất) — cần upload lại PDF`);
    }

    const removed = await q(`DELETE FROM DOCUMENT WHERE file_id LIKE 'DOC-LEC-%'`);
    console.log(`[4] Đã xóa ${removed.rowsAffected[0]} dòng DOCUMENT 'DOC-LEC-%' khỏi Dữ liệu số`);

    const stat = await q(`
      SELECT COUNT(*) AS lectures, SUM(CASE WHEN pdf_path IS NOT NULL THEN 1 ELSE 0 END) AS with_pdf
      FROM DIGITAL_LECTURE WHERE content_type = 'PDF'
    `);
    console.log(`    Bài giảng PDF: ${stat.recordset[0].lectures}, đã có tệp: ${stat.recordset[0].with_pdf}`);

    if (DRY) {
      await tx.rollback();
      console.log('--dry-run: đã HOÀN TÁC, không có gì thay đổi.');
    } else {
      await tx.commit();
      console.log('Migration hoàn tất.');
    }
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration thất bại:', err);
    process.exit(1);
  });
