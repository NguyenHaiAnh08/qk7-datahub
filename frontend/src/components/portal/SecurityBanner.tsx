import React from 'react';
import { ShieldCheck, ShieldAlert, Lock, AlertTriangle } from 'lucide-react';
import { User } from '../../types';

export interface SecurityBannerProps {
  user: User | null;
  onOpenPolicy?: () => void;
}

export const SecurityBanner: React.FC<SecurityBannerProps> = ({ user, onOpenPolicy }) => {
  const level = user?.clearance_level_id || 1;
  const isGuest = !user || user.user_id === 'GUEST';

  const getLevelBadge = () => {
    switch (level) {
      case 5:
        return {
          title: 'TUYỆT MẬT (Cấp 5)',
          desc: 'Toàn quyền tra cứu và truy xuất tài liệu tối mật quân khu',
          badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        };
      case 4:
        return {
          title: 'TỐI MẬT (Cấp 4)',
          desc: 'Được phép tra cứu tài liệu đến cấp Tối mật',
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 3:
        return {
          title: 'MẬT (Cấp 3)',
          desc: 'Được phép tra cứu tài liệu nghiệp vụ đến cấp Mật',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 2:
        return {
          title: 'NỘI BỘ (Cấp 2)',
          desc: 'Tra cứu tài liệu lưu hành nội bộ quân khu',
          badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        };
      default:
        return {
          title: 'CÔNG KHAI (Cấp 1)',
          desc: 'Chỉ tra cứu văn bản và thông báo công khai',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        };
    }
  };

  const badgeInfo = getLevelBadge();

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center space-x-3.5">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          {level >= 3 ? <ShieldCheck className="w-6 h-6 text-emerald-400" /> : <Lock className="w-6 h-6 text-slate-400" />}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-white">
              Phạm Vi Tra Cứu Tài Liệu Quân Sự
            </h3>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${badgeInfo.badgeClass}`}>
              {badgeInfo.title}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {badgeInfo.desc} • Mọi thao tác tải về và sao chép đều được ghi nhật ký hệ thống.
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 self-end md:self-auto shrink-0">
        {isGuest ? (
          <a
            href="login.html"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <span>Đăng nhập nâng cấp quyền</span>
          </a>
        ) : (
          onOpenPolicy && (
            <button
              onClick={onOpenPolicy}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Quy chế bảo mật</span>
            </button>
          )
        )}
      </div>
    </div>
  );
};
