import { http } from './http';

export interface ApprovalRequest {
  request_id: string;
  requester_id: string;
  requester_name?: string;
  requester_rank?: string;
  required_permission: string;
  http_method: string;
  http_path: string;
  http_body: string | null;
  target_summary: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTING' | 'EXECUTED' | 'FAILED';
  reviewed_by?: string;
  reviewer_name?: string;
  reviewed_at?: string;
  review_note?: string;
  /** Người được cấp quyền duyệt (không phải Chỉ huy/Admin) đã THẨM ĐỊNH — vẫn chờ Chỉ huy cấp trên xác nhận */
  validated_by?: string;
  validated_by_name?: string;
  validated_at?: string;
  validate_decision?: 'APPROVE' | 'REJECT';
  validate_note?: string;
  executed_at?: string;
  created_at: string;
  request_reason?: string;
  document_code?: string;
  doc_title?: string;
  proposal_data?: any;
  /** WAITING_OWNER: đề xuất sửa văn bản đang chờ người đăng xem (có thể rút lại) */
  stage?: 'WAITING_OWNER';
}

/** Đề xuất sửa văn bản của đơn vị khác đang chờ NGƯỜI ĐĂNG xem trước */
export interface OwnerReviewProposal {
  proposal_id: string;
  file_id: string;
  requester_id: string;
  requester_name?: string;
  requester_rank?: string;
  requester_position?: string;
  requester_unit_name?: string;
  note?: string;
  created_at: string;
  auto_forward_at?: string;
  new_original_name?: string | null;
  document_code?: string; current_document_code?: string;
  title?: string; current_title?: string;
  signer?: string; current_signer?: string;
  summary?: string; current_summary?: string;
  issued_date?: string; current_issued_date?: string;
  security_level_id?: number; current_security_level_id?: number;
  doc_type_id?: string; current_doc_type_id?: string;
  issuing_unit_id?: string; current_issuing_unit_id?: string;
}

export const approvalService = {
  awaitingOwner: () => http<{ total: number; items: OwnerReviewProposal[]; enabled: boolean }>(
    '/api/documents/proposals/awaiting-owner'
  ),
  ownerForward: (id: string, note?: string) => http(`/api/documents/proposals/${encodeURIComponent(id)}/owner-forward`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: note || '' }),
  }),
  withdrawProposal: (id: string) => http(`/api/documents/proposals/${encodeURIComponent(id)}/withdraw`, { method: 'POST' }),
  ownerReject: (id: string, reason: string) => http(`/api/documents/proposals/${encodeURIComponent(id)}/owner-reject`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  }),
  listPending: () => http<{ total: number; items: ApprovalRequest[] }>(
    `/api/admin/approval-requests?status=PENDING`
  ),
  listMine: (status: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PENDING_REJECTED' = 'ALL') =>
   http<{ total: number; items: ApprovalRequest[] }>(
     `/api/my-approval-requests?status=${status}`
   ),
  get: (id: string) => http<ApprovalRequest>(`/api/admin/approval-requests/${id}`),
  approve: (id: string, note?: string) => http(`/api/admin/approval-requests/${id}/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_note: note || '' }),
  }),
  reject: (id: string, note: string) => http(`/api/admin/approval-requests/${id}/reject`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_note: note }),
  }),
  markExecuted: (id: string) => http(`/api/admin/approval-requests/${id}/mark-executed`, { method: 'POST' }),
  listProtected: () => http<{ items: { permission_id: string; note?: string }[] }>('/api/admin/protected-permissions'),
  protect: (permId: string, note?: string) => http(`/api/admin/protected-permissions/${encodeURIComponent(permId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  }),
  unprotect: (permId: string) => http(`/api/admin/protected-permissions/${encodeURIComponent(permId)}`, { method: 'DELETE' }),
};
