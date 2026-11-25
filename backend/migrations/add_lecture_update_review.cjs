// backend/migrations/add_lecture_update_review.cjs
// ═══════════════════════════════════════════════════════════════════════
// Thay gói của bài giảng ĐÃ XUẤT BẢN mà không ẩn bản đang dùng
//
//   Bài giữ status = 'PUBLISHED' (học viên vẫn xem bản cũ). Bản mới nằm ở pending_scorm_path và được duyệt
//   2 tầng qua cột update_status (PENDING_FACULTY → PENDING_TRAINING → thay bản cũ, hoặc REJECTED).
//
// Migration: thêm update_status / update_reject_reason / update_by cho DIGITAL_LECTURE.
//
// Chạy:  node backend/migrations/add_lecture_update_review.cjs      (IDEMPOTENT)
// ═══════════════════════════════════════════════════════════════════════
const path = require('path');
require('dotenv').config({
  path: [path.join(__dirname, '..', '..', '.env'), path.join(__dirname, '..', '.env')],
});
const { getPool, closePool } = require('../src/db');

(async () => {
  const pool = await getPool();
  try {
    await pool.request().query(`
      IF COL_LENGTH('DIGITAL_LECTURE', 'update_status') IS NULL ALTER TABLE DIGITAL_LECTURE ADD update_status VARCHAR(30) NULL;
      IF COL_LENGTH('DIGITAL_LECTURE', 'update_reject_reason') IS NULL ALTER TABLE DIGITAL_LECTURE ADD update_reject_reason NVARCHAR(500) NULL;
      IF COL_LENGTH('DIGITAL_LECTURE', 'update_by') IS NULL ALTER TABLE DIGITAL_LECTURE ADD update_by VARCHAR(50) NULL;
    `);
    console.log('= DIGITAL_LECTURE: cột duyệt bản cập nhật sẵn sàng');
    console.log('Hoàn tất.');
  } catch (e) {
    console.error('LỖI:', e.message);
    process.exitCode = 1;
  }
  await closePool();
})();
