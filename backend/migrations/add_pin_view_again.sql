-- Xem lại mã PIN bằng vân tay: thêm bản mã hóa của PIN vào bảng USER.
-- Chạy được nhiều lần. Chạy xong không cần khởi động lại backend (đợi khoảng 30 giây).
USE QK7_ThuVienSo;
GO
IF COL_LENGTH('dbo.[USER]', 'pin_enc') IS NULL
    ALTER TABLE dbo.[USER] ADD pin_enc VARCHAR(255) NULL;
GO
-- Kiểm tra: phải ra 1
SELECT COUNT(*) AS so_cot_moi FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.[USER]') AND name = 'pin_enc';
GO
