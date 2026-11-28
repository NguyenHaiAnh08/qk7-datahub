/* ═══════════════════════════════════════════════════════════════════
   PHÂN HỆ THƯ VIỆN SỐ — bảng + thể loại + quyền
   Bản chạy tay (SSMS) của backend/migrations/create_library_module.cjs
   • Chỉ THÊM, không sửa bảng cũ.
   • Chạy nhiều lần được. Có lỗi thì hoàn tác toàn bộ.
   • Chạy xong: khởi động lại backend và đăng nhập lại.
   ═══════════════════════════════════════════════════════════════════ */
USE QK7_ThuVienSo;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

/* ── 1. Bảng ───────────────────────────────────────────────────── */
IF OBJECT_ID('LIBRARY_CATEGORY') IS NULL
    CREATE TABLE LIBRARY_CATEGORY (
        category_id VARCHAR(30)   NOT NULL CONSTRAINT PK_LIBRARY_CATEGORY PRIMARY KEY,
        name        NVARCHAR(150) NOT NULL CONSTRAINT UQ_LIBRARY_CATEGORY_NAME UNIQUE,
        description NVARCHAR(500) NULL,
        sort_order  INT           NOT NULL CONSTRAINT DF_LIBCAT_SORT DEFAULT 100,
        active      BIT           NOT NULL CONSTRAINT DF_LIBCAT_ACTIVE DEFAULT 1,
        created_at  DATETIME      NOT NULL CONSTRAINT DF_LIBCAT_CREATED DEFAULT GETDATE()
    );

IF OBJECT_ID('LIBRARY_ITEM') IS NULL
BEGIN
    CREATE TABLE LIBRARY_ITEM (
        file_id      VARCHAR(50)   NOT NULL CONSTRAINT PK_LIBRARY_ITEM PRIMARY KEY
                     CONSTRAINT FK_LIBITEM_DOC REFERENCES DOCUMENT(file_id) ON DELETE CASCADE,
        category_id  VARCHAR(30)   NOT NULL CONSTRAINT FK_LIBITEM_CAT REFERENCES LIBRARY_CATEGORY(category_id),
        publisher    NVARCHAR(200) NULL,
        publish_year INT           NULL CONSTRAINT CK_LIBITEM_YEAR CHECK (publish_year BETWEEN 1900 AND 2100)
    );
    CREATE INDEX IX_LIBRARY_ITEM_CATEGORY ON LIBRARY_ITEM(category_id);
END;

IF OBJECT_ID('LIBRARY_PROPOSAL') IS NULL
    CREATE TABLE LIBRARY_PROPOSAL (
        proposal_id  VARCHAR(50)   NOT NULL CONSTRAINT PK_LIBRARY_PROPOSAL PRIMARY KEY
                     CONSTRAINT FK_LIBPROP_PROP REFERENCES DOCUMENT_REVISION_PROPOSAL(proposal_id) ON DELETE CASCADE,
        category_id  VARCHAR(30)   NOT NULL CONSTRAINT FK_LIBPROP_CAT REFERENCES LIBRARY_CATEGORY(category_id),
        publisher    NVARCHAR(200) NULL,
        publish_year INT           NULL
    );

IF OBJECT_ID('LIBRARY_READING') IS NULL
BEGIN
    CREATE TABLE LIBRARY_READING (
        user_id       VARCHAR(50) NOT NULL CONSTRAINT FK_LIBREAD_USER REFERENCES [USER](user_id) ON DELETE CASCADE,
        file_id       VARCHAR(50) NOT NULL CONSTRAINT FK_LIBREAD_DOC REFERENCES DOCUMENT(file_id) ON DELETE CASCADE,
        last_page     INT         NOT NULL,   -- trang đang đọc
        max_page      INT         NOT NULL,   -- trang xa nhất đã tới
        total_pages   INT         NOT NULL,
        completed     BIT         NOT NULL CONSTRAINT DF_LIBREAD_DONE DEFAULT 0,
        first_read_at DATETIME    NOT NULL CONSTRAINT DF_LIBREAD_FIRST DEFAULT GETDATE(),
        last_read_at  DATETIME    NOT NULL CONSTRAINT DF_LIBREAD_LAST DEFAULT GETDATE(),
        CONSTRAINT PK_LIBRARY_READING PRIMARY KEY (user_id, file_id),
        CONSTRAINT CK_LIBREAD_PAGE CHECK (total_pages >= 1 AND last_page BETWEEN 1 AND total_pages
                                          AND max_page BETWEEN last_page AND total_pages)
    );
    CREATE INDEX IX_LIBRARY_READING_RECENT ON LIBRARY_READING(user_id, last_read_at DESC);
END;

/* Số trang và ảnh bìa */
IF COL_LENGTH('LIBRARY_ITEM', 'page_count') IS NULL     ALTER TABLE LIBRARY_ITEM ADD page_count INT NULL;
IF COL_LENGTH('LIBRARY_ITEM', 'cover_path') IS NULL     ALTER TABLE LIBRARY_ITEM ADD cover_path NVARCHAR(500) NULL;
IF COL_LENGTH('LIBRARY_ITEM', 'cover_custom') IS NULL   ALTER TABLE LIBRARY_ITEM ADD cover_custom BIT NOT NULL CONSTRAINT DF_LIBITEM_CUSTOM DEFAULT 0;
IF COL_LENGTH('LIBRARY_PROPOSAL', 'page_count') IS NULL   ALTER TABLE LIBRARY_PROPOSAL ADD page_count INT NULL;
IF COL_LENGTH('LIBRARY_PROPOSAL', 'cover_path') IS NULL   ALTER TABLE LIBRARY_PROPOSAL ADD cover_path NVARCHAR(500) NULL;
IF COL_LENGTH('LIBRARY_PROPOSAL', 'cover_custom') IS NULL ALTER TABLE LIBRARY_PROPOSAL ADD cover_custom BIT NULL;

/* ── 2. Thể loại mẫu (chỉ nạp khi bảng còn trống) ──────────────── */
IF NOT EXISTS (SELECT 1 FROM LIBRARY_CATEGORY)
    INSERT INTO LIBRARY_CATEGORY (category_id, name, description, sort_order) VALUES
    ('CAT-GIAO-TRINH', N'Giáo trình quân sự',  N'Giáo trình, bài giảng in dùng trong Nhà trường',   10),
    ('CAT-SACH',       N'Sách chuyên khảo',    N'Sách chuyên khảo, sách tham khảo chuyên ngành',    20),
    ('CAT-LICH-SU',    N'Lịch sử, truyền thống', N'Tài liệu lịch sử, truyền thống đơn vị và Quân khu 7', 30),
    ('CAT-TAP-CHI',    N'Tạp chí',             N'Tạp chí, bản tin, ấn phẩm định kỳ',                40),
    ('CAT-NCKH',       N'Nghiên cứu khoa học', N'Đề tài, công trình nghiên cứu khoa học',           50),
    ('CAT-SANG-KIEN',  N'Sáng kiến cải tiến',  N'Sáng kiến, cải tiến kỹ thuật',                     60),
    ('CAT-KHAC',       N'Tài liệu khác',       N'Tài liệu chưa thuộc nhóm nào ở trên',             900);

/* ── 3. Quyền ──────────────────────────────────────────────────── */
DECLARE @perm TABLE (
    permission_id VARCHAR(50), code VARCHAR(50), description NVARCHAR(400), sort_order INT,
    subgroup_key VARCHAR(30), subgroup_label NVARCHAR(100), subgroup_order INT, subgroup_tone VARCHAR(20),
    roles VARCHAR(200)   -- vai trò được cấp sẵn
);
INSERT INTO @perm VALUES
('PERM-LIB-01', 'LIB_VIEW',            N'(Không dùng) Thư viện mở cho mọi người: xem', 600, 'library-view',   N'Tra cứu thư viện',     10, 'read',   'ROL-01,ROL-02,ROL-03,ROL-04,ROL-05,ROL-06,ROL-07'),
('PERM-LIB-02', 'LIB_DOWNLOAD',        N'(Không dùng) Thư viện mở cho mọi người: tải', 610, 'library-view',   N'Tra cứu thư viện',     10, 'read',   'ROL-01,ROL-02,ROL-03,ROL-04,ROL-05,ROL-06,ROL-07'),
('PERM-LIB-03', 'LIB_PARSE',           N'AI điền sẵn thông tin khi số hóa thư viện',  620, 'library-edit',   N'Đăng tải & chỉnh sửa', 20, 'write',  'ROL-01,ROL-02,ROL-04'),
('PERM-LIB-04', 'LIB_UPLOAD',          N'Đăng tải tài liệu thư viện',                 630, 'library-edit',   N'Đăng tải & chỉnh sửa', 20, 'write',  'ROL-01,ROL-02,ROL-04'),
('PERM-LIB-05', 'LIB_EDIT',            N'Gửi đề xuất / chỉnh sửa tài liệu thư viện',  640, 'library-edit',   N'Đăng tải & chỉnh sửa', 20, 'write',  'ROL-01,ROL-02,ROL-03,ROL-04'),
('PERM-LIB-06', 'LIB_DELETE',          N'Xóa tài liệu thư viện vào thùng rác',        650, 'library-trash',  N'Thùng rác thư viện',   30, 'danger', 'ROL-01'),
('PERM-LIB-07', 'LIB_TRASH_VIEW',      N'Xem thùng rác thư viện',                     660, 'library-trash',  N'Thùng rác thư viện',   30, 'danger', 'ROL-01'),
('PERM-LIB-08', 'LIB_RESTORE',         N'Khôi phục tài liệu thư viện',                670, 'library-trash',  N'Thùng rác thư viện',   30, 'danger', 'ROL-01'),
('PERM-LIB-09', 'LIB_PURGE',           N'Xóa vĩnh viễn, dọn thùng rác thư viện',      680, 'library-trash',  N'Thùng rác thư viện',   30, 'danger', 'ROL-01'),
('PERM-LIB-10', 'LIB_CATEGORY_MANAGE', N'Thêm, sửa, xóa danh mục thể loại thư viện',  690, 'library-manage', N'Danh mục thư viện',    40, 'write',  'ROL-01');

-- Chỉ xử lý quyền CHƯA có: chạy lại không cấp lại quyền mà Quản trị viên đã gỡ
DELETE n FROM @perm n WHERE EXISTS (SELECT 1 FROM PERMISSION p WHERE p.code = n.code);

INSERT INTO PERMISSION (permission_id, code, description, group_code, is_system, sort_order,
                        subgroup_key, subgroup_label, subgroup_order, subgroup_tone)
SELECT permission_id, code, description, 'LIBRARY', 1, sort_order,
       subgroup_key, subgroup_label, subgroup_order, subgroup_tone
FROM @perm;

INSERT INTO ROLE_PERMISSION (role_id, permission_id)
SELECT r.role_id, n.permission_id
FROM @perm n
JOIN [ROLE] r ON CHARINDEX(',' + r.role_id + ',', ',' + n.roles + ',') > 0
WHERE NOT EXISTS (SELECT 1 FROM ROLE_PERMISSION x WHERE x.role_id = r.role_id AND x.permission_id = n.permission_id);

-- Thư viện mở cho mọi người: ghi rõ hai quyền xem/tải không còn tác dụng (hệ thống đã cài từ trước)
UPDATE PERMISSION SET description = N'(Không dùng) Thư viện mở cho mọi người: xem' WHERE code = 'LIB_VIEW';
UPDATE PERMISSION SET description = N'(Không dùng) Thư viện mở cho mọi người: tải' WHERE code = 'LIB_DOWNLOAD';

COMMIT TRANSACTION;

/* ── 4. Kiểm tra: mong đợi 4 | 7 | 10 | 29 (trên hệ thống đủ 7 vai trò) ── */
SELECT
    (SELECT COUNT(*) FROM sys.tables WHERE name IN ('LIBRARY_CATEGORY','LIBRARY_ITEM','LIBRARY_PROPOSAL','LIBRARY_READING')) AS so_bang,
    (SELECT COUNT(*) FROM LIBRARY_CATEGORY) AS so_the_loai,
    (SELECT COUNT(*) FROM PERMISSION WHERE code LIKE 'LIB[_]%') AS so_quyen,
    (SELECT COUNT(*) FROM ROLE_PERMISSION rp JOIN PERMISSION p ON p.permission_id = rp.permission_id
      WHERE p.code LIKE 'LIB[_]%') AS so_luot_gan_vai_tro;
GO
