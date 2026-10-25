import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Compass, CornerDownLeft, ArrowLeft, Lock } from 'lucide-react';
import { ROUTE_PATHS } from '../../routes/routePaths';

export const InteractiveCompass404: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const cardRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);

  const initialPath = location.pathname !== '/' && location.pathname !== '/404'
    ? location.pathname
    : '/404-not-found';

  const [compassAngle, setCompassAngle] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Theo dõi vị trí con trỏ chuột trên thẻ để xoay kim la bàn và nghiêng 2 con số 4
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const compassEl = compassRef.current;
      const cardEl = cardRef.current;
      if (!compassEl || !cardEl) return;

      const compassRect = compassEl.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();

      const compassCenterX = compassRect.left + compassRect.width / 2;
      const compassCenterY = compassRect.top + compassRect.height / 2;

      const deltaX = e.clientX - compassCenterX;
      const deltaY = e.clientY - compassCenterY;

      // Tính góc xoay kim la bàn theo radian -> độ (cộng 90 độ vì kim chỉ hướng Bắc mặc định ở đỉnh)
      const rad = Math.atan2(deltaY, deltaX);
      const deg = (rad * 180) / Math.PI + 90;
      setCompassAngle(deg);

      // Tính độ nghiêng thẻ 3D nhẹ nhàng
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;
      const tiltX = Math.max(-1, Math.min(1, (e.clientX - cardCenterX) / (cardRect.width / 2)));
      const tiltY = Math.max(-1, Math.min(1, (e.clientY - cardCenterY) / (cardRect.height / 2)));
      setTilt({ x: tiltX, y: tiltY });
    },
    []
  );

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setCompassAngle(0);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="u089-wrap w-full max-w-2xl mx-auto select-none"
    >
      <div
        className="u089-card rounded-2xl p-6 sm:p-10 border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 shadow-2xl backdrop-blur-md transition-all duration-300"
        style={
          {
            '--tilt-x': tilt.x,
            '--tilt-y': tilt.y,
          } as React.CSSProperties
        }
      >
        {/* Thanh URL Giả Lập Trình Duyệt Quân Sự */}
        <div className="u089-url-bar mb-8 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-800 mx-1 shrink-0" />

          <div className="flex items-center gap-1.5 flex-1 min-w-0 font-mono text-[11px] sm:text-xs">
            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-slate-400 dark:text-slate-500 truncate shrink-0">
              https://qk7-datahub.mod.mil.vn
            </span>
            <span className="font-semibold truncate u089-wavy text-rose-600 dark:text-rose-400">
              {initialPath}
            </span>
            <span className="inline-block w-1.5 h-3.5 bg-slate-400 dark:bg-slate-500 animate-pulse shrink-0" />
          </div>

          <div className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            ERR_NOT_FOUND
          </div>
        </div>

        {/* Khung Hiển Thị Số Lỗi 404 & La Bàn Laze (#089) */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 my-4 sm:my-6">
          {/* Chữ số 4 trái */}
          <span className="u089-num text-6xl sm:text-8xl tabular-nums text-slate-800 dark:text-slate-100">
            4
          </span>

          {/* Số 0 La Bàn Laze Vector */}
          <div
            ref={compassRef}
            className="u089-cp w-24 h-24 sm:w-32 sm:h-32 rounded-full relative flex items-center justify-center"
          >
            {/* Vành ngoài la bàn */}
            <div className="absolute inset-0 rounded-full border border-slate-300/80 dark:border-slate-700/80 bg-slate-100/50 dark:bg-slate-950/60 shadow-inner" />

            {/* Các vạch chia độ la bàn */}
            <div className="absolute inset-2 rounded-full border border-dashed border-slate-400/50 dark:border-slate-600/50 opacity-60" />

            {/* 4 Điểm phương hướng N - E - S - W */}
            <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-rose-600 dark:text-rose-400 z-10">
              N
            </span>
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-slate-400 z-10">
              E
            </span>
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-slate-400 z-10">
              S
            </span>
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-slate-400 z-10">
              W
            </span>

            {/* Kim La Bàn Laze Xoay Theo Chuột */}
            <div
              className="u089-needle absolute w-full h-full flex items-center justify-center pointer-events-none transition-transform duration-75 ease-out"
              style={{ transform: `rotate(${compassAngle}deg)` }}
            >
              <svg
                viewBox="0 0 100 100"
                className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)]"
              >
                {/* Nửa kim Đỏ hướng Bắc */}
                <polygon
                  points="50,12 55,50 45,50"
                  fill="#ef4444"
                  className="transition-colors duration-200"
                />
                {/* Nửa kim Bạc hướng Nam */}
                <polygon
                  points="50,88 55,50 45,50"
                  fill="#94a3b8"
                  className="transition-colors duration-200"
                />
                {/* Trục tâm kim la bàn */}
                <circle cx="50" cy="50" r="4.5" fill="#1e293b" />
                <circle cx="50" cy="50" r="2" fill="#fbbf24" />
              </svg>
            </div>
          </div>

          {/* Chữ số 4 phải */}
          <span className="u089-num text-6xl sm:text-8xl tabular-nums text-slate-800 dark:text-slate-100">
            4
          </span>
        </div>

        {/* Tiêu đề & Thông điệp trạng thái */}
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-2">
            <Compass className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
            <span>Tọa Độ Dữ Liệu Không Tồn Tại (404 Not Found)</span>
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Đường dẫn quân sự không trùng khớp với bất kỳ tọa độ văn bản nào trong hệ thống. Rê chuột để xoay kim định vị la bàn hoặc quay về Cổng Dữ Liệu Số để tiếp tục làm việc.
          </p>
        </div>

        {/* Nút Điều Hướng Hành Động */}
        <div className="pt-5 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTE_PATHS.PORTAL)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white font-semibold text-xs border border-amber-500/25 shadow-md shadow-emerald-950/20 flex items-center gap-2 transition cursor-pointer"
          >
            <CornerDownLeft className="w-4 h-4" />
            <span>Quay Về Trung Tâm Cổng Dữ Liệu</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700/60 flex items-center gap-2 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay Lại Trang Trước</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InteractiveCompass404;
