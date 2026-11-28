// backend/src/document-lifecycle.js
// ═══════════════════════════════════════════════════════════════════════
// Quy tắc vòng đời của một dòng DOCUMENT — dùng chung cho Văn bản số và Thư viện số.
//
// "Chờ duyệt" và "đã xóa" cùng đặt deleted_at; chỉ phân biệt bằng deleted_reason:
//   deleted_at NULL                        → đang lưu hành
//   deleted_reason = PENDING_APPROVAL      → chờ duyệt (KHÔNG thuộc thùng rác)
//   deleted_reason = REJECTED_BY_COMMANDER → bị từ chối duyệt (nằm ở thùng rác)
//   còn lại                                → đã xóa (nằm ở thùng rác)
//
// Hệ quả: chờ duyệt chỉ rời trạng thái bằng Phê duyệt / Từ chối; đã xóa chỉ sống lại bằng Khôi phục.
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const PENDING = 'PENDING_APPROVAL';
const REJECTED = 'REJECTED_BY_COMMANDER';
const CLOSED_BY_DELETE_NOTE = 'Tự động đóng: tài liệu đã bị xóa trước khi đề xuất được duyệt';

/** Điều kiện SQL "thuộc thùng rác" cho bảng DOCUMENT có bí danh cho trước */
const trashCondition = (alias) => `${alias}.deleted_at IS NOT NULL AND ISNULL(${alias}.deleted_reason, '') <> '${PENDING}'`;

const isPending = (doc) => Boolean(doc?.deleted_at) && doc.deleted_reason === PENDING;
/** Đã xóa hoặc bị từ chối: không được sửa, không được phê duyệt đề xuất */
const isDeleted = (doc) => Boolean(doc?.deleted_at) && doc.deleted_reason !== PENDING;

/** Bản bị từ chối duyệt chỉ Chỉ huy / Quản trị viên được đưa trở lại (khôi phục = cho lưu hành) */
const mayRestoreRejected = (userId, roles) =>
  userId === 'USR-001' || (roles || []).some((r) => r === 'ROL-01' || r === 'ROL-02');

/**
 * Xóa mềm và đóng luôn các đề xuất đang chờ, trong một giao dịch.
 * Đề xuất chuyển sang REJECTED (kèm lý do) để người gửi thấy ở "Yêu cầu của tôi".
 * Trả về { deleted: 0|1, closed: số đề xuất đã đóng }.
 */
async function softDeleteDocument({ pool, sql, fileId, userId, reason }) {
  // Lý do do người dùng gõ không được trùng mã trạng thái của hệ thống
  const cleanReason = reason && ![PENDING, REJECTED].includes(reason.toUpperCase()) ? reason : null;
  const r = await pool.request()
    .input('fid', sql.VarChar(50), fileId)
    .input('uid', sql.VarChar(50), userId)
    .input('reason', sql.NVarChar(500), cleanReason)
    .input('note', sql.NVarChar(500), CLOSED_BY_DELETE_NOTE)
    .query(`
      SET XACT_ABORT ON;
      DECLARE @deleted INT = 0, @closed INT = 0;
      BEGIN TRANSACTION;
        UPDATE DOCUMENT SET deleted_at = GETDATE(), deleted_by = @uid, deleted_reason = @reason, updated_at = GETDATE()
        WHERE file_id = @fid AND deleted_at IS NULL;
        SET @deleted = @@ROWCOUNT;
        IF @deleted > 0
        BEGIN
          UPDATE DOCUMENT_REVISION_PROPOSAL
          SET status = 'REJECTED', reviewed_by = @uid, reviewed_at = GETDATE(), review_note = @note, updated_at = GETDATE()
          WHERE file_id = @fid AND status IN ('PENDING', 'PENDING_OWNER');
          SET @closed = @@ROWCOUNT;
        END
      COMMIT TRANSACTION;
      SELECT @deleted AS deleted, @closed AS closed;`);
  return r.recordset[0];
}

module.exports = {
  PENDING, REJECTED, trashCondition, isPending, isDeleted, mayRestoreRejected, softDeleteDocument,
};
