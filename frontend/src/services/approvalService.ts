import { http } from './http';

export interface ApprovalRequest {
  request_id: string;
  requester_id: string;
  requester_name?: string;
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
  executed_at?: string;
  created_at: string;
}

export const approvalService = {
  listPending: () => http<{ total: number; items: ApprovalRequest[] }>(
    `/api/admin/approval-requests?status=PENDING`
  ),
  listMine: (status: 'PENDING_REJECTED' | 'PENDING' | 'REJECTED' | 'ALL' = 'PENDING_REJECTED') =>
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