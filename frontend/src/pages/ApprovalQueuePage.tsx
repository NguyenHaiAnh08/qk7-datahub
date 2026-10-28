import React, { useEffect, useState } from 'react';
import { ShieldCheck, Clock, X, Check, Eye, Lock, Loader2 } from 'lucide-react';
import { approvalService, ApprovalRequest } from '../services/approvalService';
import { http } from '../services/http';
import { toast } from '../components/common/Toast';
import { useApprovalContext } from '../contexts/ApprovalContext';
import { useAuth } from '../hooks/useAuth';

// Helper: Dịch API thành câu tiếng Việt
const formatRequestAction = (method: string, path: string): string => {
  const m = method.toUpperCase();
  const cleanPath = path.split('?')[0];

  const userMatch = cleanPath.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch) {
    const id = userMatch[1];
    if (m === 'DELETE') return `Xóa tài khoản quân nhân (${id})`;
    if (m === 'PUT') return `Cập nhật hồ sơ quân nhân (${id})`;
  }

  const credMatch = cleanPath.match(/^\/api\/admin\/users\/([^/]+)\/credentials$/);
  if (credMatch && m === 'PUT') return `Đổi mật khẩu quân nhân (${credMatch[1]})`;

  const userRoleMatch = cleanPath.match(/^\/api\/admin\/users\/([^/]+)\/roles$/);
  if (userRoleMatch && m === 'POST') return `Gán vai trò cho quân nhân (${userRoleMatch[1]})`;

  const userRoleDetailMatch = cleanPath.match(/^\/api\/admin\/users\/([^/]+)\/roles\/([^/]+)$/);
  if (userRoleDetailMatch && m === 'DELETE') return `Gỡ vai trò ${userRoleDetailMatch[2]} của quân nhân (${userRoleDetailMatch[1]})`;

  const userPermMatch = cleanPath.match(/^\/api\/admin\/users\/([^/]+)\/permissions$/);
  if (userPermMatch && m === 'POST') return `Cấp quyền trực tiếp cho quân nhân (${userPermMatch[1]})`;

  const userPermDetailMatch = cleanPath.match(/^\/api\/admin\/users\/([^/]+)\/permissions\/([^/]+)$/);
  if (userPermDetailMatch && m === 'DELETE') return `Thu hồi quyền ${userPermDetailMatch[2]} của quân nhân (${userPermDetailMatch[1]})`;

  const roleMatch = cleanPath.match(/^\/api\/admin\/roles\/([^/]+)$/);
  if (roleMatch && m === 'DELETE') return `Xóa vai trò (${roleMatch[1]})`;

  const unitMatch = cleanPath.match(/^\/api\/admin\/units\/([^/]+)$/);
  if (unitMatch && m === 'DELETE') return `Xóa đơn vị (${unitMatch[1]})`;

  const docPurgeMatch = cleanPath.match(/^\/api\/documents\/([^/]+)\/purge$/);
  if (docPurgeMatch && m === 'DELETE') return `Xóa vĩnh viễn văn bản (${docPurgeMatch[1]})`;

  const docMatch = cleanPath.match(/^\/api\/documents\/([^/]+)$/);
  if (docMatch && m === 'DELETE') return `Xóa tạm văn bản (${docMatch[1]})`;

  const sessionUserMatch = cleanPath.match(/^\/api\/admin\/sessions\/user\/([^/]+)$/);
  if (sessionUserMatch && m === 'DELETE') return `Hủy toàn bộ phiên của quân nhân (${sessionUserMatch[1]})`;

  const sessionMatch = cleanPath.match(/^\/api\/admin\/sessions\/([^/]+)$/);
  if (sessionMatch && m === 'DELETE') return `Hủy phiên đăng nhập (${sessionMatch[1]})`;

  return `${m} ${cleanPath}`;
};

// Helper: Dịch Mã Quyền
const PERMISSION_NAMES: Record<string, string> = {
  USER_DELETE: 'Xóa tài khoản',
  USER_ROLE_ASSIGN: 'Gán vai trò',
  USER_PERMISSION_ASSIGN: 'Cấp quyền',
  USER_CREDENTIALS: 'Đổi mật khẩu',
  ROLE_DELETE: 'Xóa vai trò',
  UNIT_DELETE: 'Xóa đơn vị',
  DOC_PURGE: 'Xóa vĩnh viễn',
  DOC_DELETE: 'Xóa tạm',
  SESSION_KILL: 'Hủy phiên',
};

const formatPermissionName = (code: string): string => {
  const viName = PERMISSION_NAMES[code];
  return viName ? `${code} (${viName})` : code;
};

export const ApprovalQueuePage: React.FC = () => {
  const { user } = useAuth();
  // 🔥 Lấy hàm refresh từ Context để cập nhật Badge trên Header/Sidebar lập tức
  const { refresh: refreshApprovalCount } = useApprovalContext();

  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await approvalService.listPending();
      setItems(r.items || []);
    } catch (err: any) {
      toast.error('Lỗi tải danh sách: ' + err.message);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    load(); 
  }, []);

  const handleApprove = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      // 1. Admin duyệt
      await approvalService.approve(selected.request_id);

      // 2. Thực thi thao tác gốc bằng token admin + header override
      try {
        await http(selected.http_path, {
          method: selected.http_method,
          headers: {
            'Content-Type': 'application/json',
            'X-Approval-Override': selected.request_id,
          },
          body: selected.http_body || undefined,
        });
        await approvalService.markExecuted(selected.request_id);
        toast.success(`Đã duyệt & thực thi thành công ${selected.request_id}`, {
          title: 'PHÊ DUYỆT HOÀN TẤT', badge: 'APPROVED'
        });
      } catch (execErr: any) {
        toast.error(`Đã duyệt nhưng thực thi thất bại: ${execErr.message}`);
      }
      
      setSelected(null);
      await load(); // Load lại danh sách hàng đợi hiện tại
      
      // 🔥 Cập nhật lại Badge đỏ trên Header lập tức
      await refreshApprovalCount(); 
      
    } catch (err: any) {
      toast.error('Lỗi duyệt: ' + err.message);
    } finally { 
      setProcessing(false); 
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectNote.trim()) {
      toast.warning('Vui lòng nhập lý do từ chối');
      return;
    }
    setProcessing(true);
    try {
      await approvalService.reject(selected.request_id, rejectNote);
      toast.info(`Đã từ chối yêu cầu ${selected.request_id}`, {
        title: 'ĐÃ TỪ CHỐI', badge: 'REJECTED'
      });
      
      setSelected(null);
      setRejectNote('');
      await load();
      
      // 🔥 Cập nhật lại Badge đỏ trên Header lập tức
      await refreshApprovalCount(); 
      
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally { 
      setProcessing(false); 
    }
  };

  // Kiểm tra xem có phải Admin đang tự duyệt yêu cầu của chính mình không
  const isSelfRequest = selected?.requester_id === user?.user_id;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-500" />
          Hàng Đợi Phê Duyệt
          <span className="text-xs px-2 py-1 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-mono font-bold">
            {items.length} chờ
          </span>
        </h2>
        <button onClick={load} disabled={loading} className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Làm mới
        </button>
      </div>

      {/* Danh sách */}
      {items.length === 0 && !loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800">
          <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <p className="text-sm text-slate-500 font-medium">Không có yêu cầu nào đang chờ duyệt</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((req) => (
            <div key={req.request_id} className="bg-white dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold">
                      {req.request_id}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(req.created_at).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    {req.requester_name || req.requester_id} yêu cầu:
                    <span className="text-emerald-700 dark:text-emerald-400 ml-1">
                      {formatRequestAction(req.http_method, req.http_path)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Quyền bị khóa:{' '}
                    <strong className="font-mono">{formatPermissionName(req.required_permission)}</strong>
                  </div>
                </div>
                <button
                  onClick={() => { setSelected(req); setRejectNote(''); }}
                  className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> Xem & Duyệt
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal chi tiết */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => !processing && setSelected(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm">Chi tiết yêu cầu {selected.request_id}</h3>
              <button onClick={() => setSelected(null)} disabled={processing} className="cursor-pointer disabled:opacity-50"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-4 space-y-3 text-xs">
              {isSelfRequest && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  Cảnh báo: Đây là yêu cầu do chính bạn tạo ra. Bạn không thể tự phê duyệt.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Người yêu cầu</label>
                  <div className="font-semibold">{selected.requester_name} ({selected.requester_id})</div>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Quyền bị khóa</label>
                  <div className="font-mono font-semibold text-amber-600">{formatPermissionName(selected.required_permission)}</div>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Hành động</label>
                  <div className="font-semibold text-emerald-600">{formatRequestAction(selected.http_method, selected.http_path)}</div>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Đường dẫn API</label>
                  <div className="font-mono text-[11px] break-all">{selected.http_method} {selected.http_path}</div>
                </div>
              </div>

              {/* Hiển thị lý do nếu có (request_reason) */}
              {(selected as any).request_reason && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                  <label className="block text-amber-700 dark:text-amber-400 mb-1 font-bold">Lý do từ người yêu cầu:</label>
                  <div className="text-slate-700 dark:text-slate-300 italic">"{(selected as any).request_reason}"</div>
                </div>
              )}

              {selected.http_body && (
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Nội dung gửi kèm (Payload)</label>
                  <pre className="bg-slate-100 dark:bg-slate-950 p-2 rounded text-[11px] overflow-auto max-h-40">
                    {(() => { try { return JSON.stringify(JSON.parse(selected.http_body!), null, 2); } catch { return selected.http_body; } })()}
                  </pre>
                </div>
              )}
              
              <div>
                <label className="block text-slate-500 mb-1 font-semibold text-rose-500">Lý do từ chối (Bắt buộc nếu Từ chối)</label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Nhập lý do từ chối để người yêu cầu biết..."
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-rose-500"
                  rows={2}
                  disabled={processing}
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button onClick={handleReject} disabled={processing || isSelfRequest || !rejectNote.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Từ chối
              </button>
              <button onClick={handleApprove} disabled={processing || isSelfRequest}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Duyệt & Thực thi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalQueuePage;