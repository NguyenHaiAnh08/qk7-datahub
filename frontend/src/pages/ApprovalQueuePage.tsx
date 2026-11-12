import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Clock,
  X,
  Check,
  Eye,
  Lock,
  Loader2,
  FileText,
  KeyRound,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Building,
  User,
  Shield,
  MessageSquare,
  Sparkles,
  Send,
} from 'lucide-react';
import { approvalService, ApprovalRequest } from '../services/approvalService';
import { http } from '../services/http';
import { toast } from '../components/common/Toast';
import { useApprovalContext } from '../contexts/ApprovalContext';
import { useAuth } from '../hooks/useAuth';
import { ApprovalDiffModal, DiffProposalData, getInitials } from '../components/document-desk/ApprovalDiffModal';

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
  const [actionInputMode, setActionInputMode] = useState<'idle' | 'reject' | 'explain'>('idle');

  // Modal hiển thị PIN sau khi duyệt
  const [generatedPinResult, setGeneratedPinResult] = useState<{ pin: string; userId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await approvalService.listPending();
      setItems(r.items || []);
    } catch (err: any) {
      toast.error('Lỗi tải danh sách: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Xác định thẩm quyền người dùng
  const isAdminRole = (user?.roles || []).includes('ROL-01') || user?.user_id === 'USR-001';
  const isCommanderRole = (user?.roles || []).includes('ROL-02');
  const canSelfApprove = isAdminRole || isCommanderRole;

  // Danh sách các đề xuất văn bản (PROP-) đang chờ duyệt để phục vụ duyệt liên hoàn
  const pendingPropList: DiffProposalData[] = React.useMemo(() => {
    return items
      .filter((item) => item.request_id.startsWith('PROP-') && item.status === 'PENDING')
      .map((item) => {
        const base = item.proposal_data || {};
        return {
          proposal_id: item.request_id,
          file_id: base.file_id || item.http_path?.replace('/api/documents/', '') || '',
          document_code: base.document_code || item.document_code,
          title: base.title || item.doc_title || item.target_summary || '',
          doc_type_id: base.doc_type_id,
          issued_date: base.issued_date,
          issuing_unit_id: base.issuing_unit_id,
          issuing_unit_name: base.issuing_unit_name,
          signer: base.signer,
          summary: base.summary,
          security_level_id: base.security_level_id || 1,
          security_level_name: base.security_level_name,
          current_document_code: base.current_document_code,
          current_title: base.current_title || '',
          current_signer: base.current_signer,
          current_security_level_id: base.current_security_level_id || 1,
          current_security_name: base.current_security_name,
          current_unit_name: base.current_unit_name,
          current_issued_date: base.current_issued_date,
          document_issuing_unit_id: base.document_issuing_unit_id || (item as any).document_issuing_unit_id,
          new_stored_path: base.new_stored_path,
          new_original_name: base.new_original_name,
          new_file_size: base.new_file_size,
          note: base.note || (item as any).request_reason || item.target_summary,
          requester_id: base.requester_id || item.requester_id || '',
          requester_name: base.requester_name || item.requester_name || item.requester_id || 'Cán bộ đề xuất',
          requester_rank: base.requester_rank || (item as any).requester_rank || '',
          requester_position: base.requester_position || (item as any).requester_position || 'Cán bộ nghiệp vụ',
          requester_unit_id: base.requester_unit_id || (item as any).requester_unit_id || '',
          requester_unit_name: base.requester_unit_name || (item as any).requester_unit_name || '',
          created_at: base.created_at || item.created_at || new Date().toISOString(),
          is_new_upload: Boolean(
            base.is_new_upload ||
            base.deleted_reason === 'PENDING_APPROVAL' ||
            (item as any).request_type === 'UPLOAD_DOCUMENT' ||
            item.target_summary?.includes('Đăng tải')
          ),
        };
      });
  }, [items]);

  const currentPropIndex = React.useMemo(() => {
    if (!selected) return -1;
    return pendingPropList.findIndex((p) => p.proposal_id === selected.request_id);
  }, [pendingPropList, selected]);

  const handleNavigateProposal = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < pendingPropList.length) {
      const target = pendingPropList[newIndex];
      const matchItem = items.find((i) => i.request_id === target.proposal_id);
      if (matchItem) setSelected(matchItem);
    }
  };

  // Xử lý Phê duyệt Đề Xuất Văn Bản (PROP-) qua ApprovalDiffModal
  const handleApproveProposal = async (proposalId: string, note?: string) => {
    setProcessing(true);
    try {
      await approvalService.approve(
        proposalId,
        note || (isCommanderRole ? 'Chỉ huy cấp Phòng đã phê duyệt & chuẩn hóa' : 'Quản trị viên đã phê duyệt & áp dụng')
      );
      toast.success(`Đã phê duyệt và áp dụng thành công đề xuất chuẩn hóa văn bản ${proposalId}!`, {
        title: 'PHÊ DUYỆT THÀNH CÔNG',
        badge: 'APPROVED',
      });
      
      const currentIdx = pendingPropList.findIndex((p) => p.proposal_id === proposalId);
      const remaining = pendingPropList.filter((p) => p.proposal_id !== proposalId);

      await load(true);
      await refreshApprovalCount();

      if (remaining.length > 0) {
        const nextIdx = Math.min(currentIdx, remaining.length - 1);
        const nextTarget = remaining[nextIdx];
        const matchItem = items.find((i) => i.request_id === nextTarget.proposal_id);
        setSelected(matchItem || null);
      } else {
        setSelected(null);
      }
    } catch (err: any) {
      toast.error('Lỗi duyệt: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Xử lý Từ chối Đề Xuất Văn Bản (PROP-)
  const handleRejectProposal = async (proposalId: string, reason: string) => {
    setProcessing(true);
    try {
      await approvalService.reject(proposalId, reason);
      toast.info(`Đã từ chối đề xuất ${proposalId}`, {
        title: 'ĐÃ TỪ CHỐI',
        badge: 'REJECTED',
      });
      
      const currentIdx = pendingPropList.findIndex((p) => p.proposal_id === proposalId);
      const remaining = pendingPropList.filter((p) => p.proposal_id !== proposalId);

      await load(true);
      await refreshApprovalCount();

      if (remaining.length > 0) {
        const nextIdx = Math.min(currentIdx, remaining.length - 1);
        const nextTarget = remaining[nextIdx];
        const matchItem = items.find((i) => i.request_id === nextTarget.proposal_id);
        setSelected(matchItem || null);
      } else {
        setSelected(null);
      }
    } catch (err: any) {
      toast.error('Lỗi từ chối: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Xử lý Yêu cầu giải trình cho Đề Xuất Văn Bản (PROP-)
  const handleExplainProposal = async (proposalId: string, question: string) => {
    setProcessing(true);
    try {
      await approvalService.reject(proposalId, `[YÊU CẦU GIẢI TRÌNH] ${question}`);
      toast.warning(`Đã gửi yêu cầu giải trình tới cán bộ đề xuất ${proposalId}`, {
        title: 'ĐÃ YÊU CẦU GIẢI TRÌNH',
        badge: 'EXPLANATION_REQUIRED',
      });
      setSelected(null);
      await load(true);
      await refreshApprovalCount();
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Xử lý Phê duyệt cho Standard Requests (Cấp PIN, Quyền, Hệ thống)
  const handleApproveStandard = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      await approvalService.approve(selected.request_id);

      const isPinRequest = selected.http_path.includes('/pin') || selected.required_permission === 'PIN_GENERATE';

      if (isPinRequest) {
        const res: any = await http(selected.http_path, {
          method: selected.http_method,
          headers: {
            'Content-Type': 'application/json',
            'X-Approval-Override': selected.request_id,
          },
          body: selected.http_body || undefined,
        });

        await approvalService.markExecuted(selected.request_id);

        const newPin = res.pin || res.data?.pin;
        if (newPin) {
          setSelected(null);
          setGeneratedPinResult({ pin: newPin, userId: selected.requester_id });
        } else {
          toast.success('Đã cấp PIN thành công');
          setSelected(null);
        }
      } else {
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
            title: 'PHÊ DUYỆT HOÀN TẤT',
            badge: 'APPROVED',
          });
        } catch (execErr: any) {
          toast.error(`Đã duyệt nhưng thực thi thất bại: ${execErr.message}`);
        }
        setSelected(null);
      }

      await load(true);
      await refreshApprovalCount();
    } catch (err: any) {
      toast.error('Lỗi duyệt: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectStandard = async () => {
    if (!selected || !rejectNote.trim()) {
      toast.warning('Vui lòng nhập lý do từ chối');
      return;
    }
    setProcessing(true);
    try {
      await approvalService.reject(selected.request_id, rejectNote);
      toast.info(`Đã từ chối yêu cầu ${selected.request_id}`, {
        title: 'ĐÃ TỪ CHỐI',
        badge: 'REJECTED',
      });
      setSelected(null);
      setRejectNote('');
      setActionInputMode('idle');
      await load(true);
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

  const isSelfRequest = selected?.requester_id === user?.user_id;
  const blockSelfApprove = isSelfRequest && !canSelfApprove;

  // Lấy dữ liệu proposal để truyền vào modal diff nếu chọn PROP-
  const selectedProposalData: DiffProposalData | null = React.useMemo(() => {
    if (!selected || !selected.request_id.startsWith('PROP-')) return null;
    const base = selected.proposal_data || {};
    return {
      proposal_id: selected.request_id,
      file_id: base.file_id || selected.http_path?.replace('/api/documents/', '') || '',
      document_code: base.document_code || selected.document_code,
      title: base.title || selected.doc_title || selected.target_summary || '',
      doc_type_id: base.doc_type_id,
      issued_date: base.issued_date,
      issuing_unit_id: base.issuing_unit_id,
      issuing_unit_name: base.issuing_unit_name,
      signer: base.signer,
      summary: base.summary,
      security_level_id: base.security_level_id || 1,
      security_level_name: base.security_level_name,
      current_document_code: base.current_document_code,
      current_title: base.current_title || '',
      current_signer: base.current_signer,
      current_security_level_id: base.current_security_level_id || 1,
      current_security_name: base.current_security_name,
      current_unit_name: base.current_unit_name,
      current_issued_date: base.current_issued_date,
      document_issuing_unit_id: base.document_issuing_unit_id || (selected as any).document_issuing_unit_id,
      new_stored_path: base.new_stored_path,
      new_original_name: base.new_original_name,
      new_file_size: base.new_file_size,
      note: base.note || selected.request_reason,
      requester_id: base.requester_id || selected.requester_id || '',
      requester_name: base.requester_name || selected.requester_name || selected.requester_id || 'Cán bộ đề xuất',
      requester_rank: base.requester_rank || selected.requester_rank || '',
      requester_position: base.requester_position || (selected as any).requester_position || 'Cán bộ nghiệp vụ',
      requester_unit_id: base.requester_unit_id || (selected as any).requester_unit_id || '',
      requester_unit_name: base.requester_unit_name || (selected as any).requester_unit_name || '',
      created_at: base.created_at || selected.created_at || new Date().toISOString(),
    };
  }, [selected]);

  return (
    <div className="space-y-5 font-sans">
      {/* ========================================================= */}
      {/* HEADER: HÀNG CHỜ PHÊ DUYỆT 100% DIỆN TÍCH               */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span>Hàng Chờ Phê Duyệt</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-mono font-bold border border-rose-500/30">
              {items.length} chờ duyệt
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            <span>Trung tâm kiểm duyệt phân cấp dành cho Chỉ huy phòng ban và Quản trị viên</span>
            {isCommanderRole && (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                • Phạm vi: Đơn vị trực thuộc
              </span>
            )}
          </p>
        </div>

        <button
          onClick={() => load()}
          disabled={loading}
          className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* DANH SÁCH CÁC PHIẾU CHỜ DUYỆT (QUEUE ITEMS)             */}
      {/* ========================================================= */}
      {items.length === 0 && !loading ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Hàng chờ hiện đang trống
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Không có yêu cầu chỉnh sửa văn bản hoặc cấp quyền nào đang chờ phê duyệt. Toàn bộ hồ sơ đã được xử lý chuẩn hóa.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((req) => {
            const isPin = req.http_path.includes('/pin/generate') || req.required_permission === 'PERM-USR-08';
            const isForgotPin = isPin && (req.target_summary?.includes('Quên') || req.target_summary?.includes('cấp lại'));
            const isProposal = req.request_id.startsWith('PROP-');

            // Kiểm tra tài liệu nội bộ phòng
            const isInternalUnit = Boolean(
              user?.unit_id &&
                ((req as any).document_issuing_unit_id === user.unit_id ||
                  (req as any).requester_unit_id === user.unit_id ||
                  req.proposal_data?.issuing_unit_id === user.unit_id)
            );

            return (
              <div
                key={req.request_id}
                className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Khối Thông Tin Người Gửi & Hành Động */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Avatar Tròn Viết Tắt */}
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                      isPin
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                        : isProposal
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                    }`}
                  >
                    {getInitials(req.requester_name || req.requester_id)}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Header Thẻ: ID, Ngày, Tags */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {req.request_id}
                      </span>

                      {/* BADGE LOẠI YÊU CẦU */}
                      {isPin ? (
                        isForgotPin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold border border-rose-500/30 animate-pulse">
                            <KeyRound className="w-3 h-3" /> QUÊN MÃ PIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30">
                            <KeyRound className="w-3 h-3" /> CẤP MÃ PIN LẦN ĐẦU
                          </span>
                        )
                      ) : isProposal ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30">
                          <FileText className="w-3 h-3" /> ĐỀ XUẤT SỬA VĂN BẢN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-400 font-bold border border-blue-500/30">
                          <Shield className="w-3 h-3" /> QUẢN TRỊ HỆ THỐNG
                        </span>
                      )}

                      {/* TAG TÀI LIỆU NỘI BỘ PHÒNG */}
                      {isInternalUnit && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/30">
                          <Building className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          Tài liệu nội bộ phòng
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400 ml-auto sm:ml-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(req.created_at).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    {/* Tiêu đề & Thông tin Người Đề Xuất */}
                    <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {req.requester_name || req.requester_id}
                      </span>
                      {req.requester_rank && (
                        <span className="text-xs font-normal text-slate-500 ml-1">
                          ({req.requester_rank})
                        </span>
                      )}
                      {(req as any).requester_position && (
                        <span className="text-xs font-normal text-slate-500 ml-1">
                          • {(req as any).requester_position}
                        </span>
                      )}
                      {(req as any).requester_unit_name && (
                        <span className="text-xs font-normal text-slate-400 ml-1">
                          [{(req as any).requester_unit_name}]
                        </span>
                      )}
                      <span className="text-slate-500 mx-1.5 font-normal">yêu cầu:</span>
                      <span
                        className={`${
                          isPin
                            ? isForgotPin
                              ? 'text-rose-600 dark:text-rose-400 font-bold'
                              : 'text-amber-600 dark:text-amber-400 font-bold'
                            : 'text-emerald-700 dark:text-emerald-300 font-bold'
                        }`}
                      >
                        {req.target_summary || formatRequestAction(req.http_method, req.http_path)}
                      </span>
                    </div>

                    {/* Ghi chú lý do từ người yêu cầu */}
                    {req.request_reason && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic line-clamp-1 bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        "{req.request_reason}"
                      </p>
                    )}

                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Quyền bị khóa:</span>
                      <strong className="font-mono text-slate-600 dark:text-slate-300">
                        {formatPermissionName(req.required_permission)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Cụm Nút Chiến Thuật: Mở Đối Chiếu & Kiểm Duyệt */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => {
                      setSelected(req);
                      setRejectNote('');
                      setActionInputMode('idle');
                    }}
                    className={`px-4 py-2.5 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition shadow-md active:scale-95 ${
                      isPin
                        ? isForgotPin
                          ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/20'
                          : 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20'
                    }`}
                  >
                    {isProposal ? (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Đối Chiếu & Duyệt</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>Kiểm Duyệt Yêu Cầu</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: GITHUB-STYLE DIFF CHO ĐỀ XUẤT SỬA VĂN BẢN (PROP) */}
      {/* ========================================================= */}
      {selected && selected.request_id.startsWith('PROP-') && selectedProposalData && (
        <ApprovalDiffModal
          open={true}
          proposal={selectedProposalData}
          proposals={pendingPropList}
          currentIndex={currentPropIndex >= 0 ? currentPropIndex : 0}
          onNavigate={handleNavigateProposal}
          onClose={() => setSelected(null)}
          onApprove={handleApproveProposal}
          onReject={handleRejectProposal}
          isProcessing={processing}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 2: DUYỆT CÁC YÊU CẦU CẤP PIN HOẶC QUẢN TRỊ HỆ THỐNG */}
      {/* ========================================================= */}
      {selected && (!selected.request_id.startsWith('PROP-') || !selectedProposalData) && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !processing && setSelected(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto border border-slate-200 dark:border-slate-800 shadow-2xl font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Kiểm Duyệt Yêu Cầu {selected.request_id}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Phê duyệt tác vụ quản trị và bảo mật cấp phép phân cấp
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                disabled={processing}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {blockSelfApprove && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Cảnh báo: Đây là yêu cầu do chính bạn tạo ra. Bạn không thể tự phê duyệt.</span>
                </div>
              )}

              {/* YÊU CẦU CẤP MÃ PIN */}
              {selected.http_path.includes('/pin') || selected.required_permission === 'PIN_GENERATE' ? (
                <div className="space-y-4 text-center py-6 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center">
                    <KeyRound className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      Yêu Cầu Cấp Mã PIN Bảo Mật
                    </h4>
                    <p className="text-slate-500 mt-1 text-xs">
                      Quân nhân{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {selected.requester_name} ({selected.requester_id})
                      </strong>{' '}
                      đang yêu cầu cấp mã PIN xác thực để truy cập văn kiện mật.
                    </p>
                  </div>

                  {selected.request_reason && (
                    <div className="mx-6 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left">
                      <span className="font-bold text-slate-500 block mb-1">Lý do / Ghi chú:</span>
                      <span className="italic text-slate-700 dark:text-slate-300">
                        "{selected.request_reason}"
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* YÊU CẦU QUẢN TRỊ HỆ THỐNG KHÁC */
                <div className="space-y-3 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1 font-semibold">Người yêu cầu</label>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {selected.requester_name} ({selected.requester_id})
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 font-semibold">Hành động tác chiến</label>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatRequestAction(selected.http_method, selected.http_path)}
                      </div>
                    </div>
                  </div>
                  {selected.request_reason && (
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                      <label className="block text-amber-700 dark:text-amber-400 mb-1 font-bold">
                        Lý do từ người yêu cầu:
                      </label>
                      <div className="text-slate-700 dark:text-slate-300 italic">
                        "{selected.request_reason}"
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* KHUNG NHẬP LÝ DO TỪ CHỐI NẾU CẦN */}
              {actionInputMode === 'reject' && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-rose-800 dark:text-rose-300">
                    Lý do từ chối yêu cầu (Bắt buộc):
                  </label>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Nhập lý do chưa chấp thuận để thông báo cho quân nhân..."
                    className="w-full p-2 border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    rows={2}
                    disabled={processing}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActionInputMode('idle')}
                      className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleRejectStandard}
                      disabled={processing || !rejectNote.trim()}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs disabled:opacity-50"
                    >
                      Xác nhận từ chối
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* STICKY ACTION BAR PHÍA DƯỚI */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 bg-slate-50 dark:bg-slate-950/60">
              {actionInputMode === 'idle' && (
                <>
                  <button
                    onClick={() => setActionInputMode('reject')}
                    disabled={processing || blockSelfApprove}
                    className="px-4 py-2 border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> Từ chối
                  </button>

                  <button
                    onClick={handleApproveStandard}
                    disabled={processing || blockSelfApprove}
                    className={`px-5 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md ${
                      selected.http_path.includes('/pin')
                        ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20'
                    }`}
                  >
                    {processing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                    <span>{selected.http_path.includes('/pin') ? 'Duyệt & Cấp PIN' : 'Phê duyệt & Thực thi'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL HIỂN THỊ MÃ PIN SAU KHI DUYỆT THÀNH CÔNG           */}
      {/* ========================================================= */}
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
              <span>
                Vui lòng <strong>Copy</strong> mã PIN này và gửi cho quân nhân. Mã PIN chỉ hiển thị 1 lần duy nhất.
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyPin}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Đã Copy' : 'Copy PIN'}
              </button>
              <button
                onClick={() => setGeneratedPinResult(null)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer"
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
