// backend/src/migrate-radar.js
const { getPool, sql } = require('./db');

async function migrateRadar() {
  const pool = await getPool();
  console.log('[Radar Migration] Kết nối CSDL SQL Server thành công...');

  // 1. Bổ sung các cột vào bảng CLASSROOM
  const cols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='CLASSROOM'");
  const colNames = cols.recordset.map(c => c.COLUMN_NAME);

  if (!colNames.includes('building_code')) {
    await pool.request().query("ALTER TABLE CLASSROOM ADD building_code VARCHAR(20) NOT NULL DEFAULT 'H1'");
    console.log('+ Đã thêm cột building_code');
  }
  if (!colNames.includes('floor_number')) {
    await pool.request().query("ALTER TABLE CLASSROOM ADD floor_number INT NOT NULL DEFAULT 1");
    console.log('+ Đã thêm cột floor_number');
  }
  if (!colNames.includes('grid_col')) {
    await pool.request().query("ALTER TABLE CLASSROOM ADD grid_col INT NOT NULL DEFAULT 1");
    console.log('+ Đã thêm cột grid_col');
  }
  if (!colNames.includes('grid_row')) {
    await pool.request().query("ALTER TABLE CLASSROOM ADD grid_row INT NOT NULL DEFAULT 1");
    console.log('+ Đã thêm cột grid_row');
  }
  if (!colNames.includes('is_maintenance')) {
    await pool.request().query("ALTER TABLE CLASSROOM ADD is_maintenance BIT NOT NULL DEFAULT 0");
    console.log('+ Đã thêm cột is_maintenance');
  }
  if (!colNames.includes('maintenance_reason')) {
    await pool.request().query("ALTER TABLE CLASSROOM ADD maintenance_reason NVARCHAR(255) NULL");
    console.log('+ Đã thêm cột maintenance_reason');
  }
  if (!colNames.includes('display_order')) {
    await pool.request().query("ALTER TABLE CLASSROOM ADD display_order INT NOT NULL DEFAULT 0");
    console.log('+ Đã thêm cột display_order');
  }

  // 2. Danh sách phòng học thực tế Trường Quân sự Quân khu 7
  const classrooms = [
    // Khu nhà H1 - Tầng 1
    { room_id: 'H1-101', room_name: 'Phòng học H1-101', building_name: 'Khu nhà H1', building_code: 'H1', floor_number: 1, room_type: 'LECTURE_HALL', capacity: 60, grid_col: 1, grid_row: 1, display_order: 1 },
    { room_id: 'H1-102', room_name: 'Phòng học H1-102', building_name: 'Khu nhà H1', building_code: 'H1', floor_number: 1, room_type: 'LECTURE_HALL', capacity: 60, grid_col: 2, grid_row: 1, display_order: 2 },
    { room_id: 'H1-103', room_name: 'Phòng học H1-103', building_name: 'Khu nhà H1', building_code: 'H1', floor_number: 1, room_type: 'LECTURE_HALL', capacity: 60, grid_col: 1, grid_row: 2, display_order: 3 },
    { room_id: 'H1-104', room_name: 'Phòng học H1-104', building_name: 'Khu nhà H1', building_code: 'H1', floor_number: 1, room_type: 'LECTURE_HALL', capacity: 60, grid_col: 2, grid_row: 2, display_order: 4, is_maintenance: 1, maintenance_reason: 'Bảo trì hệ thống máy chiếu và âm thanh' },

    // Khu nhà H1 - Tầng 2
    { room_id: 'H1-201', room_name: 'Phòng học H1-201', building_name: 'Khu nhà H1', building_code: 'H1', floor_number: 2, room_type: 'LECTURE_HALL', capacity: 60, grid_col: 1, grid_row: 1, display_order: 5 },
    { room_id: 'H1-202', room_name: 'Phòng học H1-202', building_name: 'Khu nhà H1', building_code: 'H1', floor_number: 2, room_type: 'LECTURE_HALL', capacity: 60, grid_col: 2, grid_row: 1, display_order: 6 },
    { room_id: 'H1-203', room_name: 'Phòng học H1-203', building_name: 'Khu nhà H1', building_code: 'H1', floor_number: 2, room_type: 'LECTURE_HALL', capacity: 60, grid_col: 1, grid_row: 2, display_order: 7 },
    { room_id: 'H1-204', room_name: 'Phòng học H1-204', building_name: 'Khu nhà H1', building_code: 'H1', floor_number: 2, room_type: 'LECTURE_HALL', capacity: 60, grid_col: 2, grid_row: 2, display_order: 8 },

    // Khu nhà H2 - Tầng 1
    { room_id: 'H2-101', room_name: 'Phòng học H2-101', building_name: 'Khu nhà H2', building_code: 'H2', floor_number: 1, room_type: 'LECTURE_HALL', capacity: 50, grid_col: 1, grid_row: 1, display_order: 9 },
    { room_id: 'H2-102', room_name: 'Phòng học H2-102', building_name: 'Khu nhà H2', building_code: 'H2', floor_number: 1, room_type: 'LECTURE_HALL', capacity: 50, grid_col: 2, grid_row: 1, display_order: 10 },
    { room_id: 'H2-103', room_name: 'Phòng học H2-103', building_name: 'Khu nhà H2', building_code: 'H2', floor_number: 1, room_type: 'LECTURE_HALL', capacity: 50, grid_col: 3, grid_row: 1, display_order: 11 },

    // Khu nhà H2 - Tầng 2
    { room_id: 'H2-201', room_name: 'Phòng học H2-201', building_name: 'Khu nhà H2', building_code: 'H2', floor_number: 2, room_type: 'LECTURE_HALL', capacity: 50, grid_col: 1, grid_row: 1, display_order: 12 },
    { room_id: 'H2-202', room_name: 'Phòng học H2-202', building_name: 'Khu nhà H2', building_code: 'H2', floor_number: 2, room_type: 'LECTURE_HALL', capacity: 50, grid_col: 2, grid_row: 1, display_order: 13 },
    { room_id: 'H2-203', room_name: 'Phòng học H2-203', building_name: 'Khu nhà H2', building_code: 'H2', floor_number: 2, room_type: 'LECTURE_HALL', capacity: 50, grid_col: 3, grid_row: 1, display_order: 14 },

    // Khu Hội trường
    { room_id: 'HT-A', room_name: 'Hội trường A', building_name: 'Khu Hội trường', building_code: 'HT', floor_number: 1, room_type: 'LECTURE_HALL', capacity: 250, grid_col: 1, grid_row: 1, display_order: 15 },
    { room_id: 'HT-B', room_name: 'Hội trường B', building_name: 'Khu Hội trường', building_code: 'HT', floor_number: 1, room_type: 'LECTURE_HALL', capacity: 150, grid_col: 2, grid_row: 1, display_order: 16 },

    // Khu Phòng máy & Công nghệ
    { room_id: 'PM-01', room_name: 'Phòng máy 01', building_name: 'Khu Công nghệ', building_code: 'PM', floor_number: 1, room_type: 'COMPUTER_LAB', capacity: 45, grid_col: 1, grid_row: 1, display_order: 17 },
    { room_id: 'PM-02', room_name: 'Phòng máy 02', building_name: 'Khu Công nghệ', building_code: 'PM', floor_number: 1, room_type: 'COMPUTER_LAB', capacity: 45, grid_col: 2, grid_row: 1, display_order: 18 }
  ];

  for (const c of classrooms) {
    const check = await pool.request()
      .input('rid', sql.VarChar(50), c.room_id)
      .query('SELECT room_id FROM CLASSROOM WHERE room_id = @rid');

    if (check.recordset.length === 0) {
      await pool.request()
        .input('rid', sql.VarChar(50), c.room_id)
        .input('rname', sql.NVarChar(100), c.room_name)
        .input('bname', sql.NVarChar(100), c.building_name)
        .input('bcode', sql.VarChar(20), c.building_code)
        .input('floor', sql.Int, c.floor_number)
        .input('rtype', sql.VarChar(30), c.room_type)
        .input('cap', sql.Int, c.capacity)
        .input('act', sql.Bit, 1)
        .input('maint', sql.Bit, c.is_maintenance ? 1 : 0)
        .input('mreason', sql.NVarChar(255), c.maintenance_reason || null)
        .input('gcol', sql.Int, c.grid_col)
        .input('grow', sql.Int, c.grid_row)
        .input('dord', sql.Int, c.display_order)
        .query(`INSERT INTO CLASSROOM (room_id, room_name, building_name, building_code, floor_number, room_type, capacity, active, is_maintenance, maintenance_reason, grid_col, grid_row, display_order)
                VALUES (@rid, @rname, @bname, @bcode, @floor, @rtype, @cap, @act, @maint, @mreason, @gcol, @grow, @dord)`);
      console.log('+ Đã thêm phòng:', c.room_id);
    } else {
      await pool.request()
        .input('rid', sql.VarChar(50), c.room_id)
        .input('bcode', sql.VarChar(20), c.building_code)
        .input('floor', sql.Int, c.floor_number)
        .input('maint', sql.Bit, c.is_maintenance ? 1 : 0)
        .input('mreason', sql.NVarChar(255), c.maintenance_reason || null)
        .input('gcol', sql.Int, c.grid_col)
        .input('grow', sql.Int, c.grid_row)
        .input('dord', sql.Int, c.display_order)
        .query(`UPDATE CLASSROOM SET building_code=@bcode, floor_number=@floor, is_maintenance=@maint, maintenance_reason=@mreason, grid_col=@gcol, grid_row=@grow, display_order=@dord WHERE room_id=@rid`);
      console.log('~ Đã cập nhật phòng:', c.room_id);
    }
  }

  // 3. Khớp nối tự động giữa TEACHING_SCHEDULE và CLASSROOM
  await pool.request().query("UPDATE TEACHING_SCHEDULE SET room_id = 'HT-A' WHERE (room_id IS NULL OR room_id = '') AND venue_name LIKE '%Hội trường A%'");
  await pool.request().query("UPDATE s SET s.room_id = c.room_id FROM TEACHING_SCHEDULE s JOIN CLASSROOM c ON c.room_name = s.venue_name WHERE s.room_id IS NULL OR s.room_id = ''");

  // Đảm bảo bài giảng đang diễn ra (nếu có ca ONGOING) gắn vào phòng mẫu H1-102 nếu đang rỗng
  await pool.request().query("UPDATE TEACHING_SCHEDULE SET room_id = 'H1-102' WHERE status = 'ONGOING' AND (room_id IS NULL OR room_id = '')");

  const total = await pool.request().query('SELECT COUNT(*) AS total FROM CLASSROOM');
  console.log(`[Radar Migration] Hoàn tất thành công! Tổng số phòng học trong CSDL: ${total.recordset[0].total}`);
}

if (require.main === module) {
  migrateRadar()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Radar Migration Error]', err);
      process.exit(1);
    });
}

module.exports = { migrateRadar };
