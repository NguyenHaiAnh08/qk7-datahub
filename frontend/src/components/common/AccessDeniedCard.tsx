/* <!-- Tactical Command Access Denied & Clearance Enforcement --> */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Send, Home, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from './Toast';
import { useAuth } from '../../hooks/useAuth';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { getDestinationByRole } from '../../contexts/AuthContext';

export interface AccessDeniedCardProps {
  requiredClearanceName?: string;
  requiredClearanceLevel?: number;
  documentTitle?: string;
  documentCode?: string;
  documentNumber?: string;
  onClose?: () => void;
  compact?: boolean;
}

export const AccessDeniedCard: React.FC<AccessDeniedCardProps> = ({
  requiredClearanceName = 'Tối Mật',
  requiredClearanceLevel = 4,
  documentTitle,
  documentCode,
  documentNumber,
  onClose,
  compact = false,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const docRef = documentCode || documentNumber;

  const userClearanceLevel = user?.clearance_level_id || 1;
  const userClearanceName = user?.clearance_name || `Cấp ${userClearanceLevel}`;

  const handleRequestClearance = () => {
    if (requested || loading) return;
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setRequested(true);
      toast.success(
        `Đã chuyển phiếu yêu cầu tiếp cận tài liệu tới Tổ Quản Trị Hệ Thống QK7. Mã hồ sơ kiểm soát: #REQ-${Date.now().toString().slice(-6)}.`,
        {
          title: 'ĐÃ TIẾP NHẬN YÊU CẦU CẤP QUYỀN',
          badge: 'SOC-AUDIT',
          duration: 5000,
        }
      );
    }, 450);
  };

  return (
    <div className={`w-full ${compact ? 'max-w-md' : 'max-w-xl'} mx-auto select-none`}>
      <div className="rounded-2xl border border-rose-500/40 dark:border-rose-500/30 bg-white/95 dark:bg-slate-900/90 shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300">
        {/* Thanh Cảnh Báo An Ninh Tối Cao */}
        <div className="bg-rose-500/10 dark:bg-rose-950/40 border-b border-rose-500/20 px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-mono font-bold text-rose-700 dark:text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            <span>MÃ HIỆU BẢO MẬT: 403 FORBIDDEN</span>
          </div>
          <span className="font-mono text-[10px] text-rose-600 dark:text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded">
            CẤP QUÂN LỆNH
          </span>
        </div>

        {/* Nội Dung Chi Tiết */}
        <div className="p-6 sm:p-8 text-center space-y-5">
          {/* Biểu tượng Khiên ngắt quãng Đỏ Quân Kỳ */}
          <div className="relative inline-flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-rose-500/10 dark:bg-rose-950/50 border-2 border-rose-500/40 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-lg shadow-rose-950/20">
              <ShieldAlert className="w-10 h-10 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-900 border-2 border-white dark:border-slate-800 flex items-center justify-center text-amber-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Tiêu đề & Thông điệp chuẩn quân lệnh */}
          <div className="space-y-2">
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Khu Vực Hạn Chế Tiếp Cận
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed max-w-md mx-auto">
              Tài liệu thuộc phân loại{' '}
              <span className="text-rose-600 dark:text-rose-400 font-bold uppercase underline">
                {requiredClearanceName}
              </span>
              . Cấp bậc bảo mật hiện tại của đồng chí không đủ thẩm quyền khai thác.
            </p>
          </div>

          {/* Bảng Đối Chiếu Thẩm Quyền Quân Nhân */}
          <div className="grid grid-cols-2 gap-3 text-left p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs font-mono">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block font-sans font-semibold">
                Cấp bậc hiện tại
              </span>
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="tabular-nums">{userClearanceName}</span>
              </div>
            </div>

            <div className="space-y-1 border-l border-slate-200 dark:border-slate-800 pl-3">
              <span className="text-[10px] text-slate-500 uppercase block font-sans font-semibold">
                Thẩm quyền yêu cầu
              </span>
              <div className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span className="tabular-nums">
                  Cấp {requiredClearanceLevel} ({requiredClearanceName})
                </span>
              </div>
            </div>
          </div>

          {documentTitle && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800 truncate">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Văn bản: </span>
              {documentNumber ? `[${documentNumber}] ` : ''}
              {documentTitle}
            </div>
          )}

          {/* Cụm Nút Hành Động */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              disabled={requested || loading}
              onClick={handleRequestClearance}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm ${
                requested
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-700 hover:bg-rose-800 text-white border border-rose-800/60 shadow-rose-950/20'
              }`}
            >
              {requested ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Đã Gửi Yêu Cầu Cấp Quyền</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Yêu Cầu Cấp Quyền Bổ Sung</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                else navigate(getDestinationByRole(user));
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Về Khu Vực Làm Việc</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedCard;
