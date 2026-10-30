import React, { useEffect, useState } from 'react';
import { Header } from '../components/common/Header';
import { approvalService, ApprovalRequest } from '../services/approvalService';
import { toast } from '../components/common/Toast';
import {
  Clock, CheckCircle2, XCircle, FileText, ShieldAlert,
  RotateCw, RefreshCw, Trash2, KeyRound, Shield,
  AlertTriangle, Lock,                                    // ✅ Thêm Lock
} from 'lucide-react';

// ============================================================
// Helper: Dịch API thành câu tiếng Việt
// ============================================================
const formatRequestAction = (method: string, path: string): string => {
  const m = method.toUpperCase();
  const cleanPath = path.split('?')[0];

  const userMatch = cleanPath.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch) {
    const id = userMatch[1];
    if (m === 'DELETE') return `Xóa tài khoản quân nhân (${id})`;
    if (m === 'PUT')    return `Cập nhật hồ sơ quân nhân (${id})`;
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

// ============================================================
// Helper: Dịch Mã Quyền
// ============================================================
const PERMISSION_NAMES: Record<string, string> = {
  USER_DELETE:            'Xóa tài khoản',
  USER_ROLE_ASSIGN:       'Gán vai trò',
  USER_PERMISSION_ASSIGN: 'Cấp quyền',
  USER_CREDENTIALS:       'Đổi mật khẩu',
  ROLE_DELETE:            'Xóa vai trò',
  UNIT_DELETE:            'Xóa đơn vị',
  DOC_PURGE:              'Xóa vĩnh viễn',
  DOC_DELETE:             'Xóa tạm',
  SESSION_KILL:           'Hủy phiên',
};

const formatPermissionName = (code: string): string => {
  const viName = PERMISSION_NAMES[code];
  return viName ? `${code} (${viName})` : code;
};

// ============================================================
// Meta hiển thị theo loại hành động
// ============================================================
const ACTION_META: Record<string, { icon: any; label: string; tone: string }> = {
  delete_user:  { icon: Trash2,        label: 'XÓA QUÂN NHÂN',  tone: 'rose'  },
  delete_role:  { icon: Trash2,        label: 'XÓA VAI TRÒ',    tone: 'rose'  },
  delete_doc:   { icon: AlertTriangle, label: 'XÓA TÀI LIỆU',   tone: 'rose'  },
  purge_doc:    { icon: AlertTriangle, label: 'XÓA VĨNH VIỄN',  tone: 'rose'  },
  kill_session: { icon: ShieldAlert,   label: 'KILL SESSION',   tone: 'amber' },
  assign_role:  { icon: KeyRound,      label: 'GÁN VAI TRÒ',    tone: 'amber' },
};

function classify(method: string, path: string) {
  if (path.includes('/purge')) return ACTION_META.purge_doc;
  if (method === 'DELETE' && path.includes('/users/') && !path.includes('/permissions')) return ACTION_META.delete_user;
  if (method === 'DELETE' && path.includes('/roles/'))   return ACTION_META.delete_role;
  if (method === 'DELETE' && path.includes('/sessions')) return ACTION_META.kill_session;
  if (method === 'POST'   && path.includes('/roles'))    return ACTION_META.assign_role;
  if (method === 'DELETE' && path.includes('/documents/')) return ACTION_META.delete_doc;
  return { icon: Shield, label: `${method} ${path}`, tone: 'slate' };
}

const TONE_STYLES: Record<string, string> = {
  rose:  'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  slate: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
};

// ============================================================
// Component
// ============================================================
export const MyApprovalsPage: React.FC = () => {
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING_REJECTED' | 'ALL'>('PENDING_REJECTED');

  const load = async () => {
    setLoading(true);
    try {
      const res = await approvalService.listMine(filter);
      setItems(res.items || []);
    } catch (err: any) {
      toast.error('Lỗi tải yêu cầu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  // Auto-refresh mỗi 30s
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [filter]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header activeNav="admin" title="Trường Quân Sự Quân Khu 7" subtitle="Trung tâm dữ liệu số" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Yêu Cầu Chỉnh Sửa Của Tôi
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Các thao tác bạn đã gửi yêu cầu phê duyệt tới Quản trị viên tối cao
            </p>
          </div>
          <button
            onClick={load}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
          {[
            { k: 'PENDING_REJECTED', l: 'Đang chờ & Bị từ chối' },
            { k: 'ALL',              l: 'Tất cả (kể cả đã duyệt)' },
          ].map(({ k, l }) => (
            <button
              key={k}
              onClick={() => setFilter(k as any)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
                filter === k
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* List */}
        {loading && items.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800">
            <RefreshCw className="w-8 h-8 mx-auto text-slate-300 animate-spin mb-2" />
            <p className="text-sm text-slate-500">Đang tải yêu cầu...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
            <p className="text-sm text-slate-500">
              {filter === 'PENDING_REJECTED'
                ? 'Không có yêu cầu nào đang chờ hoặc bị từ chối'
                : 'Bạn chưa gửi yêu cầu nào'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((req) => {
              const meta = classify(req.http_method, req.http_path);
              const Icon = meta.icon;
              const isPending = req.status === 'PENDING';
              const isRejected = req.status === 'REJECTED';

              return (
                <div
                  key={req.request_id}
                  className={`bg-white dark:bg-slate-900/80 p-4 rounded-xl border transition ${
                    isPending
                      ? 'border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10'
                      : isRejected
                        ? 'border-rose-500/40 bg-rose-50/30 dark:bg-rose-950/10'
                        : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${TONE_STYLES[meta.tone]}`}>
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold">
                          {req.request_id}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          {new Date(req.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>

                      {/* ✅ Câu tiếng Việt thay vì raw METHOD + PATH */}
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

                    {/* Trạng thái */}
                    <div className="shrink-0">
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/40">
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          Chờ duyệt
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40">
                          <XCircle className="w-3.5 h-3.5" />
                          Đã bị từ chối
                        </span>
                      )}
                      {req.status === 'EXECUTED' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đã duyệt & thực thi
                        </span>
                      )}
                      {req.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/40">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đã duyệt
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lý do từ chối */}
                  {isRejected && req.review_note && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-rose-100/60 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/30 text-xs">
                      <span className="font-bold text-rose-700 dark:text-rose-400">Lý do từ chối: </span>
                      <span className="text-rose-800 dark:text-rose-300">{req.review_note}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyApprovalsPage;