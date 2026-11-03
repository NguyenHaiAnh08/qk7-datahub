import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, Clock, X, Check, Eye, Lock, Loader2, FileText, 
  KeyRound, Copy, CheckCircle2, AlertTriangle 
} from 'lucide-react';
import { approvalService, ApprovalRequest } from '../services/approvalService';
import { http } from '../services/http';
import { toast } from '../components/common/Toast';
import { useApprovalContext } from '../contexts/ApprovalContext';
import { useAuth } from '../hooks/useAuth';

// Helper: Dịch API thành câu tiếng Việt
const formatRequestAction = (method: string, path: string): string => {
  const m = method.toUpperCase();
  const cleanPath = path.split('?')[0];

  // ✅ Nhận diện yêu cầu cấp PIN
  if (cleanPath.includes('/pin') || cleanPath.includes('generate-pin')) {
    return `Yêu cầu cấp mã PIN bảo mật`;
  }

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

  const docEditMatch = cleanPath.match(/^\/api\/documents\/([^/]+)$/);
  if (docEditMatch && m === 'PUT') return `Đề xuất chỉnh sửa & chuẩn hóa văn bản (${docEditMatch[1]})`;
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
  DOC_EDIT: 'Sửa văn bản',
  USER_DELETE: 'Xóa tài khoản',
  USER_ROLE_ASSIGN: 'Gán vai trò',
  USER_PERMISSION_ASSIGN: 'Cấp quyền',
  USER_CREDENTIALS: 'Đổi mật khẩu',
  ROLE_DELETE: 'Xóa vai trò',
  UNIT_DELETE: 'Xóa đơn vị',
  DOC_PURGE: 'Xóa vĩnh viễn',
  DOC_DELETE: 'Xóa tạm',
  SESSION_KILL: 'Hủy phiên',
  PIN_GENERATE: 'Cấp mã PIN',
};

const formatPermissionName = (code: string): string => {
  const viName = PERMISSION_NAMES[code];
  return viName ? `${code} (${viName})` : code;
};

export const ApprovalQueuePage: React.FC = () => {
  const { user } = useAuth();
  const { refresh: refreshApprovalCount } = useApprovalContext();

  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [processing, setProcessing] = useState(false);

  // ✅ State mới: Lưu kết quả PIN trả về để hiển thị cho Admin
  const [generatedPinResult, setGeneratedPinResult] = useState<{ pin: string; userId: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
      // 1. Admin duyệt yêu cầu
      await approvalService.approve(selected.request_id);

      // 2. Kiểm tra xem đây có phải yêu cầu cấp PIN không
      const isPinRequest = selected.http_path.includes('/pin') || selected.required_permission === 'PIN_GENERATE';

      if (isPinRequest) {
        // Gọi API để tạo PIN và lấy kết quả trả về
        const res: any = await http(selected.http_path, {
          method: selected.http_method,
          headers: {
            'Content-Type': 'application/json',
            'X-Approval-Override': selected.request_id,
          },
          body: selected.http_body || undefined,
        });
        
        await approvalService.markExecuted(selected.request_id);
        
        // Nếu Backend trả về mã PIN trong response (ví dụ: res.pin hoặc res.data.pin)
        const newPin = res.pin || res.data?.pin;
        if (newPin) {
          setSelected(null); // Đóng modal duyệt
          setGeneratedPinResult({ pin: newPin, userId: selected.requester_id }); // Mở modal hiển thị PIN
        } else {
          toast.success('Đã cấp PIN thành công (Không nhận được mã PIN từ máy chủ)');
          setSelected(null);
        }
      } else if (selected.request_id.startsWith('PROP-')) {
        // Đề xuất sửa văn bản
        toast.success(`Đã phê duyệt và áp dụng thành công đề xuất chuẩn hóa văn bản ${selected.request_id}!`, {
          title: 'PHÊ DUYỆT THÀNH CÔNG', badge: 'APPROVED'
        });
        setSelected(null);
      } else {
        // Các loại yêu cầu khác
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
      }
      
      await load();
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
      await refreshApprovalCount(); 
      
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally { 
      setProcessing(false); 
    }
  };

  const handleCopyPin = () => {
    if (!generatedPinResult) return;
    navigator.clipboard.writeText(generatedPinResult.pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdminRole = (user?.roles || []).includes('ROL-01') || user?.user_id === 'USR-001';
  const isCommanderRole = (user?.roles || []).includes('ROL-02');
  const canSelfApprove = isAdminRole || isCommanderRole;

  const isSelfRequest = selected?.requester_id === user?.user_id;
  // Chỉ chặn nếu là nhân viên thường tự duyệt phiếu của mình
  const blockSelfApprove = isSelfRequest && !canSelfApprove;

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
          {items.map((req) => {
  const isPin = req.http_path.includes('/pin/generate') || req.required_permission === 'PERM-USR-08';
  // Kiểm tra xem có phải Quên PIN không (dựa vào chữ "Quên" trong target_summary)
  const isForgotPin = isPin && (req.target_summary?.includes('Quên') || req.target_summary?.includes('cấp lại'));

  return (
    <div key={req.request_id} className="bg-white dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition">
      <div className="flex items-start justify-between gap-3">
        
            {/* BADGE PHÂN BIỆT */}
            {isPin ? (
              isForgotPin ? (
                <span className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold border border-rose-500/30 animate-pulse">
                  <KeyRound className="w-3 h-3" /> QUÊN MÃ PIN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30">
                  <KeyRound className="w-3 h-3" /> CẤP MÃ PIN LẦN ĐẦU
                </span>
              )
            ) : req.request_id.startsWith('PROP-') ? (
              <span className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30">
                <FileText className="w-3 h-3" /> ĐỀ XUẤT SỬA VĂN BẢN
              </span>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-bold">
                  {req.request_id}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(req.created_at).toLocaleString('vi-VN')}
                </span>
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                {req.requester_name || req.requester_id} yêu cầu:
                <span className={`ml-1 ${isPin ? (isForgotPin ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400') : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {/* Hiển thị đúng nội dung Backend trả về */}
                  {req.target_summary || formatRequestAction(req.http_method, req.http_path)}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Quyền bị khóa:{' '}
                <strong className="font-mono">{formatPermissionName(req.required_permission)}</strong>
              </div>
            </div>
            
            <button
              onClick={() => { setSelected(req); setRejectNote(''); }}
              className={`shrink-0 px-3 py-1.5 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer ${
                isPin ? (isForgotPin ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-600 hover:bg-amber-500') : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Xem & Duyệt
            </button>
          </div>
        </div>
      );
    })}
        </div>
      )}

      {/* Modal chi tiết duyệt */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => !processing && setSelected(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm">Chi tiết yêu cầu {selected.request_id}</h3>
              <button onClick={() => setSelected(null)} disabled={processing} className="cursor-pointer disabled:opacity-50"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-4 space-y-3 text-xs">
              {blockSelfApprove && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  Cảnh báo: Đây là yêu cầu do chính bạn tạo ra. Bạn không thể tự phê duyệt.
                </div>
              )}

              {/* Xử lý hiển thị chi tiết cho yêu cầu cấp PIN */}
              {(selected.http_path.includes('/pin') || selected.required_permission === 'PIN_GENERATE') ? (
                <div className="space-y-4 text-center py-6 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center">
                    <KeyRound className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">Yêu cầu cấp mã PIN</h4>
                    <p className="text-slate-500 mt-1 text-sm">
                      Quân nhân <strong className="text-slate-800 dark:text-slate-200">{selected.requester_name} ({selected.requester_id})</strong> đang yêu cầu cấp mã PIN để truy cập tài liệu Cấp 4-5.
                    </p>
                  </div>
                  
                  {selected.request_reason && (
                     <div className="mx-6 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-left">
                       <span className="font-bold text-slate-500 block mb-1">Lý do / Ghi chú:</span>
                       <span className="italic">"{selected.request_reason}"</span>
                     </div>
                  )}
                </div>
              ) : selected.request_id.startsWith('PROP-') && selected.proposal_data ? (
                /* Render thông thường cho Đề xuất văn bản (PROP-) */
                <div className="space-y-3.5">
                  {/* ... (Giữ nguyên phần render Đề xuất văn bản) ... */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 text-[11px] block">Người đề xuất:</span>
                      <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                        {selected.requester_name} ({selected.requester_id})
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Thời gian gửi: {new Date(selected.created_at).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Render thông thường cho các loại khác */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1 font-semibold">Người yêu cầu</label>
                      <div className="font-semibold">{selected.requester_name} ({selected.requester_id})</div>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 font-semibold">Hành động</label>
                      <div className="font-semibold text-emerald-600">{formatRequestAction(selected.http_method, selected.http_path)}</div>
                    </div>
                  </div>
                  {selected.request_reason && (
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                      <label className="block text-amber-700 dark:text-amber-400 mb-1 font-bold">Lý do từ người yêu cầu:</label>
                      <div className="text-slate-700 dark:text-slate-300 italic">"{selected.request_reason}"</div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-500 mb-1 font-semibold text-rose-500">Lý do từ chối (Bắt buộc nếu Từ chối)</label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Nhập lý do từ chối..."
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-rose-500"
                  rows={2}
                  disabled={processing}
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button onClick={handleReject} disabled={processing || blockSelfApprove || !rejectNote.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Từ chối
              </button>
              <button onClick={handleApprove} disabled={processing || blockSelfApprove}
                className={`px-4 py-2 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  selected.http_path.includes('/pin') ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}>
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} 
                {selected.http_path.includes('/pin') ? 'Duyệt & Tạo PIN' : 'Duyệt & Thực thi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal Hiển thị mã PIN sau khi Admin Duyệt thành công */}
      {generatedPinResult && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-emerald-500/30 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Cấp Mã PIN Thành Công!
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Quân nhân: <strong className="text-slate-800 dark:text-slate-200">{generatedPinResult.userId}</strong>
            </p>

            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 mb-4">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-2 uppercase tracking-widest">
                Mã PIN mới
              </div>
              <div className="text-4xl font-mono font-bold tracking-[0.3em] text-emerald-900 dark:text-white">
                {generatedPinResult.pin}
              </div>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-left p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 mb-6">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Vui lòng <strong>Copy</strong> mã PIN này và gửi cho quân nhân. Mã PIN chỉ hiển thị 1 lần duy nhất.</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyPin}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Đã Copy' : 'Copy PIN'}
              </button>
              <button
                onClick={() => setGeneratedPinResult(null)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-md"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalQueuePage;