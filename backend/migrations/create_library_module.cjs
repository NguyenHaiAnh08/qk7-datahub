// backend/migrations/create_library_module.cjs
// ═══════════════════════════════════════════════════════════════════════
// PHÂN HỆ THƯ VIỆN SỐ — bảng + danh mục + quyền
//
// Tài liệu thư viện dùng chung bảng DOCUMENT (file_id bắt đầu bằng 'LIB-') để dùng lại
// độ mật, vân tay, mã PIN, trình xem PDF, nhật ký, đề xuất chỉnh sửa và thùng rác.
// Thư viện mở cho mọi người: tài liệu luôn Cấp 1 – Công khai.
// Thông tin riêng của thư viện nằm ở 4 bảng mới (KHÔNG sửa bảng cũ):
//   LIBRARY_CATEGORY  — danh mục thể loại thư viện
//   LIBRARY_ITEM      — thể loại, nhà xuất bản, năm xuất bản của từng tài liệu
//   LIBRARY_PROPOSAL  — các trường trên trong một đề xuất đang chờ duyệt
//   LIBRARY_READING   — tiến độ đọc của từng người (trang đang đọc, trang xa nhất, đã xong)
//
// Quyền mặc định theo Phụ lục 02 (mục D). Ô "○" của thao tác xóa/khôi phục/xóa vĩnh viễn
// KHÔNG cấp sẵn: Quản trị viên tự cấp cho Văn thư khi cần.
//
// Chạy:  node backend/migrations/create_library_module.cjs
// IDEMPOTENT: chạy nhiều lần an toàn; quyền chỉ gán cho vai trò ở lần TẠO quyền đầu tiên
// (không ghi đè việc Quản trị viên đã gỡ quyền). Sau khi chạy: KHỞI ĐỘNG LẠI backend.
// ═══════════════════════════════════════════════════════════════════════
const path = require('path');
require('dotenv').config({
  path: [path.join(__dirname, '..', '..', '.env'), path.join(__dirname, '..', '.env')],
});
const { getPool, closePool, sql } = require('../src/db');

const TABLES = [
  ['LIBRARY_CATEGORY', `
    CREATE TABLE LIBRARY_CATEGORY (
      category_id VARCHAR(30)   NOT NULL CONSTRAINT PK_LIBRARY_CATEGORY PRIMARY KEY,
      name        NVARCHAR(150) NOT NULL CONSTRAINT UQ_LIBRARY_CATEGORY_NAME UNIQUE,
      description NVARCHAR(500) NULL,
      sort_order  INT           NOT NULL CONSTRAINT DF_LIBCAT_SORT DEFAULT 100,
      active      BIT           NOT NULL CONSTRAINT DF_LIBCAT_ACTIVE DEFAULT 1,
      created_at  DATETIME      NOT NULL CONSTRAINT DF_LIBCAT_CREATED DEFAULT GETDATE()
    )`],
  ['LIBRARY_ITEM', `
    CREATE TABLE LIBRARY_ITEM (
      file_id      VARCHAR(50)   NOT NULL CONSTRAINT PK_LIBRARY_ITEM PRIMARY KEY
                   CONSTRAINT FK_LIBITEM_DOC REFERENCES DOCUMENT(file_id) ON DELETE CASCADE,
      category_id  VARCHAR(30)   NOT NULL CONSTRAINT FK_LIBITEM_CAT REFERENCES LIBRARY_CATEGORY(category_id),
      publisher    NVARCHAR(200) NULL,
      publish_year INT           NULL CONSTRAINT CK_LIBITEM_YEAR CHECK (publish_year BETWEEN 1900 AND 2100)
    );
    CREATE INDEX IX_LIBRARY_ITEM_CATEGORY ON LIBRARY_ITEM(category_id)`],
  ['LIBRARY_PROPOSAL', `
    CREATE TABLE LIBRARY_PROPOSAL (
      proposal_id  VARCHAR(50)   NOT NULL CONSTRAINT PK_LIBRARY_PROPOSAL PRIMARY KEY
                   CONSTRAINT FK_LIBPROP_PROP REFERENCES DOCUMENT_REVISION_PROPOSAL(proposal_id) ON DELETE CASCADE,
      category_id  VARCHAR(30)   NOT NULL CONSTRAINT FK_LIBPROP_CAT REFERENCES LIBRARY_CATEGORY(category_id),
      publisher    NVARCHAR(200) NULL,
      publish_year INT           NULL
    )`],
  ['LIBRARY_READING', `
    CREATE TABLE LIBRARY_READING (
      user_id       VARCHAR(50) NOT NULL CONSTRAINT FK_LIBREAD_USER REFERENCES [USER](user_id) ON DELETE CASCADE,
      file_id       VARCHAR(50) NOT NULL CONSTRAINT FK_LIBREAD_DOC REFERENCES DOCUMENT(file_id) ON DELETE CASCADE,
      last_page     INT         NOT NULL,
      max_page      INT         NOT NULL,
      total_pages   INT         NOT NULL,
      completed     BIT         NOT NULL CONSTRAINT DF_LIBREAD_DONE DEFAULT 0,
      first_read_at DATETIME    NOT NULL CONSTRAINT DF_LIBREAD_FIRST DEFAULT GETDATE(),
      last_read_at  DATETIME    NOT NULL CONSTRAINT DF_LIBREAD_LAST DEFAULT GETDATE(),
      CONSTRAINT PK_LIBRARY_READING PRIMARY KEY (user_id, file_id),
      CONSTRAINT CK_LIBREAD_PAGE CHECK (total_pages >= 1 AND last_page BETWEEN 1 AND total_pages
                                        AND max_page BETWEEN last_page AND total_pages)
    );
    CREATE INDEX IX_LIBRARY_READING_RECENT ON LIBRARY_READING(user_id, last_read_at DESC)`],
];

// Cột thêm sau: số trang và ảnh bìa
const COLUMNS = [
  ['LIBRARY_ITEM', 'page_count', 'INT NULL'],
  ['LIBRARY_ITEM', 'cover_path', 'NVARCHAR(500) NULL'],
  ['LIBRARY_ITEM', 'cover_custom', 'BIT NOT NULL CONSTRAINT DF_LIBITEM_CUSTOM DEFAULT 0'],
  ['LIBRARY_PROPOSAL', 'page_count', 'INT NULL'],
  ['LIBRARY_PROPOSAL', 'cover_path', 'NVARCHAR(500) NULL'],
  ['LIBRARY_PROPOSAL', 'cover_custom', 'BIT NULL'],
];

const CATEGORIES = [
  ['CAT-GIAO-TRINH', 'Giáo trình quân sự', 'Giáo trình, bài giảng in dùng trong Nhà trường', 10],
  ['CAT-SACH', 'Sách chuyên khảo', 'Sách chuyên khảo, sách tham khảo chuyên ngành', 20],
  ['CAT-LICH-SU', 'Lịch sử, truyền thống', 'Tài liệu lịch sử, truyền thống đơn vị và Quân khu 7', 30],
  ['CAT-TAP-CHI', 'Tạp chí', 'Tạp chí, bản tin, ấn phẩm định kỳ', 40],
  ['CAT-NCKH', 'Nghiên cứu khoa học', 'Đề tài, công trình nghiên cứu khoa học', 50],
  ['CAT-SANG-KIEN', 'Sáng kiến cải tiến', 'Sáng kiến, cải tiến kỹ thuật', 60],
  ['CAT-KHAC', 'Tài liệu khác', 'Tài liệu chưa thuộc nhóm nào ở trên', 900],
];

const SUB = {
  view:   { key: 'library-view',   label: 'Tra cứu thư viện', order: 10, tone: 'read' },
  edit:   { key: 'library-edit',   label: 'Đăng tải & chỉnh sửa', order: 20, tone: 'write' },
  trash:  { key: 'library-trash',  label: 'Thùng rác thư viện', order: 30, tone: 'danger' },
  manage: { key: 'library-manage', label: 'Danh mục thư viện', order: 40, tone: 'write' },
};

const ALL_STAFF = ['ROL-02', 'ROL-03', 'ROL-04', 'ROL-05', 'ROL-06', 'ROL-07'];
// [mã quyền, mô tả, nhóm con, vai trò mặc định] — Admin (ROL-01) bỏ qua kiểm tra quyền, vẫn gán để hiển thị
const PERMISSIONS = [
  ['LIB_VIEW',            '(Không dùng) Thư viện mở cho mọi người: xem',  'view',   ALL_STAFF],
  ['LIB_DOWNLOAD',        '(Không dùng) Thư viện mở cho mọi người: tải',  'view',   ALL_STAFF],
  ['LIB_PARSE',           'AI điền sẵn thông tin khi số hóa thư viện',    'edit',   ['ROL-02', 'ROL-04']],
  ['LIB_UPLOAD',          'Đăng tải tài liệu thư viện',                   'edit',   ['ROL-02', 'ROL-04']],
  ['LIB_EDIT',            'Gửi đề xuất / chỉnh sửa tài liệu thư viện',    'edit',   ['ROL-02', 'ROL-03', 'ROL-04']],
  ['LIB_DELETE',          'Xóa tài liệu thư viện vào thùng rác',          'trash',  []],
  ['LIB_TRASH_VIEW',      'Xem thùng rác thư viện',                       'trash',  []],
  ['LIB_RESTORE',         'Khôi phục tài liệu thư viện',                  'trash',  []],
  ['LIB_PURGE',           'Xóa vĩnh viễn, dọn thùng rác thư viện',        'trash',  []],
  ['LIB_CATEGORY_MANAGE', 'Thêm, sửa, xóa danh mục thể loại thư viện',    'manage', []],
];

(async () => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  const q = () => new sql.Request(tx);
  try {
    for (const [name, ddl] of TABLES) {
      const ex = await q().input('n', sql.VarChar(100), name).query('SELECT OBJECT_ID(@n) AS id');
      if (ex.recordset[0].id) { console.log(`= Bảng ${name} đã có`); continue; }
      await q().batch(ddl);
      console.log(`+ Tạo bảng ${name}`);
    }

    for (const [table, column, type] of COLUMNS) {
      const ex = await q().input('t', sql.VarChar(100), table).input('c', sql.VarChar(100), column)
        .query('SELECT COL_LENGTH(@t, @c) AS n');
      if (ex.recordset[0].n !== null) { console.log(`= Cột ${table}.${column} đã có`); continue; }
      await q().batch(`ALTER TABLE ${table} ADD ${column} ${type}`);
      console.log(`+ Thêm cột ${table}.${column}`);
    }

    // Danh mục mẫu: chỉ nạp khi bảng còn trống (không dựng lại mục Quản trị viên đã xóa)
    const n = (await q().query('SELECT COUNT(*) AS n FROM LIBRARY_CATEGORY')).recordset[0].n;
    if (n === 0) {
      for (const [id, name, desc, sort] of CATEGORIES) {
        await q()
          .input('id', sql.VarChar(30), id).input('n', sql.NVarChar(150), name)
          .input('d', sql.NVarChar(500), desc).input('s', sql.Int, sort)
          .query(`INSERT INTO LIBRARY_CATEGORY (category_id, name, description, sort_order) VALUES (@id, @n, @d, @s)`);
      }
      console.log(`+ Nạp ${CATEGORIES.length} thể loại thư viện`);
    } else {
      console.log(`= Danh mục thư viện đã có ${n} thể loại`);
    }

    for (let i = 0; i < PERMISSIONS.length; i += 1) {
      const [code, desc, subKey, roles] = PERMISSIONS[i];
      const ex = await q().input('c', sql.VarChar(50), code)
        .query('SELECT permission_id FROM PERMISSION WHERE code = @c');
      if (ex.recordset.length) { console.log(`= Quyền ${code} đã có (giữ nguyên phân quyền hiện tại)`); continue; }
      const id = `PERM-LIB-${String(i + 1).padStart(2, '0')}`;
      const sub = SUB[subKey];
      await q()
        .input('id', sql.VarChar(50), id).input('c', sql.VarChar(50), code)
        .input('d', sql.NVarChar(400), desc).input('s', sql.Int, 600 + i * 10)
        .input('sk', sql.VarChar(30), sub.key).input('sl', sql.NVarChar(100), sub.label)
        .input('so', sql.Int, sub.order).input('st', sql.VarChar(20), sub.tone)
        .query(`INSERT INTO PERMISSION (permission_id, code, description, group_code, is_system, sort_order,
                  subgroup_key, subgroup_label, subgroup_order, subgroup_tone)
                VALUES (@id, @c, @d, 'LIBRARY', 1, @s, @sk, @sl, @so, @st)`);
      for (const role of ['ROL-01', ...roles]) {
        await q().input('r', sql.VarChar(50), role).input('p', sql.VarChar(50), id)
          .query(`IF EXISTS (SELECT 1 FROM [ROLE] WHERE role_id = @r)
                    AND NOT EXISTS (SELECT 1 FROM ROLE_PERMISSION WHERE role_id = @r AND permission_id = @p)
                  INSERT INTO ROLE_PERMISSION (role_id, permission_id) VALUES (@r, @p)`);
      }
      console.log(`+ Quyền ${code} → ${['ROL-01', ...roles].join(', ')}`);
    }

    // Thư viện mở cho mọi người: ghi rõ hai quyền xem/tải không còn tác dụng (hệ thống đã cài từ trước)
    for (const [code, desc] of PERMISSIONS.slice(0, 2)) {
      await q().input('c', sql.VarChar(50), code).input('d', sql.NVarChar(400), desc)
        .query('UPDATE PERMISSION SET description = @d WHERE code = @c AND ISNULL(description, N\'\') <> @d');
    }

    await tx.commit();
    console.log('XONG. Khởi động lại backend để nhận quyền mới.');
  } catch (e) {
    await tx.rollback();
    console.error('LỖI, đã hoàn tác toàn bộ:', e.message);
    process.exitCode = 1;
  }
  await closePool();
})();
