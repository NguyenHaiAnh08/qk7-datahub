export interface ApprovalResponse {
  code: 'APPROVAL_REQUIRED';
  request_id: string;
  message?: string;
  required_permission?: string;
}

export function isApprovalRequired(res: any): res is ApprovalResponse {
  return res?.code === 'APPROVAL_REQUIRED' && !!res?.request_id;
}