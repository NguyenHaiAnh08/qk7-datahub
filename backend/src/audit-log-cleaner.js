// ============================================================
// audit-log-cleaner.js — Quản lý Lưu trữ & Xoay vòng Nhật ký Kiểm toán
// Cơ chế: Tự động lưu trữ log tháng trước vào ACCESS_LOG_ARCHIVE
// và làm sạch bảng ACCESS_LOG để đầu mỗi tháng bắt đầu từ số 0.
// ============================================================
const { sql } = require('./db');

/**
 * Đảm bảo bảng lưu trữ ACCESS_LOG_ARCHIVE tồn tại trong CSDL.
 */
async function ensureArchiveTable(pool) {
  const query = `
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ACCESS_LOG_ARCHIVE')
    BEGIN
      CREATE TABLE ACCESS_LOG_ARCHIVE (
        log_id VARCHAR(50) NOT NULL PRIMARY KEY,
        user_id VARCHAR(50) NULL,
        file_id VARCHAR(50) NULL,
        [action] VARCHAR(50) NOT NULL,
        [timestamp] DATETIME NOT NULL,
        ip VARCHAR(50) NULL,
        note NVARCHAR(255) NULL,
        archived_at DATETIME NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_ACCESS_LOG_ARCHIVE_timestamp ON ACCESS_LOG_ARCHIVE([timestamp] DESC);
      CREATE INDEX IX_ACCESS_LOG_ARCHIVE_user_id ON ACCESS_LOG_ARCHIVE(user_id);
    END
  `;
  await pool.request().query(query);
}

/**
 * Kiểm tra và chuyển toàn bộ nhật ký của các tháng trước sang ACCESS_LOG_ARCHIVE,
 * làm sạch ACCESS_LOG để chu kỳ tháng mới bắt đầu từ con số 0.
 *
 * @param {Function} getPool
 * @param {Function} [writeAccessLog]
 * @returns {Promise<{ archivedCount: number, cutoffDate: Date }>}
 */
async function archiveMonthlyLogs(getPool, writeAccessLog) {
  const pool = await getPool();
  await ensureArchiveTable(pool);

  // Điểm cắt: Ngày 01 của tháng hiện tại lúc 00:00:00
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const cutoffDate = new Date(currentYear, now.getMonth(), 1, 0, 0, 0, 0);

  // 1. Kiểm tra số lượng bản ghi cũ hơn đầu tháng hiện tại
  const countReq = pool.request()
    .input('year', sql.Int, currentYear)
    .input('month', sql.Int, currentMonth);

  const countRes = await countReq.query(`
    SELECT COUNT(*) AS cnt
    FROM ACCESS_LOG
    WHERE [timestamp] < DATEFROMPARTS(@year, @month, 1)
  `);

  const cnt = countRes.recordset[0]?.cnt || 0;
  if (cnt === 0) {
    return { archivedCount: 0, cutoffDate };
  }

  // 2. Thực hiện Transaction di chuyển bản ghi và dọn dẹp
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const tReq = new sql.Request(transaction)
      .input('year', sql.Int, currentYear)
      .input('month', sql.Int, currentMonth);

    // Chuyển sang bảng lưu trữ ACCESS_LOG_ARCHIVE (tránh trùng khóa log_id)
    await tReq.query(`
      INSERT INTO ACCESS_LOG_ARCHIVE (log_id, user_id, file_id, [action], [timestamp], ip, note, archived_at)
      SELECT l.log_id, l.user_id, l.file_id, l.[action], l.[timestamp], l.ip, l.note, GETDATE()
      FROM ACCESS_LOG l
      WHERE l.[timestamp] < DATEFROMPARTS(@year, @month, 1)
        AND NOT EXISTS (SELECT 1 FROM ACCESS_LOG_ARCHIVE a WHERE a.log_id = l.log_id)
    `);

    // Xóa khỏi bảng ACCESS_LOG
    await tReq.query(`
      DELETE FROM ACCESS_LOG
      WHERE [timestamp] < DATEFROMPARTS(@year, @month, 1)
    `);

    await transaction.commit();

    console.log(`[MonthlyArchive] Đã lưu trữ ${cnt} sự kiện an ninh tháng cũ vào ACCESS_LOG_ARCHIVE.`);

    // Ghi vết hành động hệ thống
    if (writeAccessLog) {
      writeAccessLog({
        userId: null,
        fileId: null,
        action: 'SYSTEM_ARCHIVE_LOGS',
        ip: '127.0.0.1',
        note: `Đã tự động lưu trữ ${cnt} sự kiện an ninh tháng trước vào ACCESS_LOG_ARCHIVE & làm sạch bảng chính cho chu kỳ đầu tháng ${currentMonth}/${currentYear}.`,
      }).catch(() => {});
    }

    return { archivedCount: cnt, cutoffDate };
  } catch (err) {
    await transaction.rollback();
    console.error('[MonthlyArchive] Lỗi khi lưu trữ log:', err.message);
    throw err;
  }
}

/**
 * Lấy số liệu thống kê chu kỳ log hiện tại và kho lưu trữ.
 */
async function getArchiveStats(getPool) {
  const pool = await getPool();
  await ensureArchiveTable(pool);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const r = await pool.request()
    .input('year', sql.Int, currentYear)
    .input('month', sql.Int, currentMonth)
    .query(`
      SELECT
        (SELECT COUNT(*) FROM ACCESS_LOG WHERE [timestamp] >= DATEFROMPARTS(@year, @month, 1)) AS active_month_count,
        (SELECT COUNT(*) FROM ACCESS_LOG) AS total_active_table_count,
        (SELECT COUNT(*) FROM ACCESS_LOG_ARCHIVE) AS archive_count,
        (SELECT MAX(archived_at) FROM ACCESS_LOG_ARCHIVE) AS last_archived_at
    `);

  const row = r.recordset[0] || {};
  return {
    current_month: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
    active_month_count: row.active_month_count || 0,
    total_active_table_count: row.total_active_table_count || 0,
    archive_count: row.archive_count || 0,
    last_archived_at: row.last_archived_at || null,
  };
}

/**
 * Khởi động scheduler kiểm tra và lưu trữ log định kỳ.
 * Chạy ngay khi khởi động gateway và lặp lại định kỳ mỗi 30 phút.
 */
function startMonthlyArchiveScheduler(getPool, writeAccessLog) {
  // 1. Chạy ngay khi server khởi động
  archiveMonthlyLogs(getPool, writeAccessLog).catch((err) => {
    console.error('[startMonthlyArchiveScheduler] Lỗi khởi tạo ban đầu:', err.message);
  });

  // 2. Chạy lặp lại mỗi 30 phút để bắt sự kiện chuyển giao sang ngày 01 đầu tháng mới
  const INTERVAL_MS = 30 * 60 * 1000;
  const timer = setInterval(() => {
    archiveMonthlyLogs(getPool, writeAccessLog).catch((err) => {
      console.error('[startMonthlyArchiveScheduler] Lỗi chu kỳ định kỳ:', err.message);
    });
  }, INTERVAL_MS);

  if (timer.unref) timer.unref();

  return timer;
}

module.exports = {
  ensureArchiveTable,
  archiveMonthlyLogs,
  getArchiveStats,
  startMonthlyArchiveScheduler,
};
