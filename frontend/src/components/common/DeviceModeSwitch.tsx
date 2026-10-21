import React from 'react';
import { Popover } from 'antd';
import { Monitor, Tablet, RefreshCw, Cpu } from 'lucide-react';
import { useDeviceMode } from '../../contexts/DeviceModeContext';
import { useTheme } from '../../hooks/useTheme';

export interface DeviceModeSwitchProps {
  compact?: boolean;
  className?: string;
}

export const DeviceModeSwitch: React.FC<DeviceModeSwitchProps> = ({
  compact = false,
  className = '',
}) => {
  const {
    deviceMode,
    orientation,
    aspectRatio,
    browserName,
    isAutoDetected,
    screenWidth,
    screenHeight,
    setManualDeviceMode,
    resetToAutoDetect,
  } = useDeviceMode();

  const { isDark } = useTheme();

  const isPC = deviceMode === 'pc';
  const isIPad = deviceMode === 'ipad';

  // Popover nội dung chi tiết thông số nhận diện chuẩn nét, thích ứng mượt mà cả Light Mode & Dark Mode
  const popoverContent = (
    <div className={`w-[290px] text-xs space-y-2 select-none ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
      <div
        className={`flex items-center justify-between border-b pb-1.5 font-bold ${
          isDark ? 'border-slate-700/80 text-white' : 'border-purple-100 text-slate-900'
        }`}
      >
        <span className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
          <Cpu className={`w-3.5 h-3.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          Nhận diện Thiết bị & Tỉ lệ
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap ${
            isAutoDetected
              ? isDark
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-300'
              : isDark
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-amber-50 text-amber-700 border border-amber-300'
          }`}
        >
          {isAutoDetected ? 'Auto (Tự động)' : 'Thủ công (Gạt tay)'}
        </span>
      </div>

      <div className={`text-xs space-y-1.5 pt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        <div className="flex items-center justify-between gap-3 whitespace-nowrap text-xs">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Chế độ đang chạy:</span>
          <strong className={`font-semibold ${isDark ? 'text-white' : 'text-purple-800'}`}>
            {isPC ? '💻 Máy tính (16:9)' : '📱 iPad Air M4 (4:3 / 10:7)'}
          </strong>
        </div>
        <div className="flex items-center justify-between gap-3 whitespace-nowrap text-xs">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Trình duyệt:</span>
          <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>{browserName}</span>
        </div>
        <div className="flex items-center justify-between gap-3 whitespace-nowrap text-xs">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Kích thước thực:</span>
          <span className={`font-mono font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {screenWidth} × {screenHeight} ({orientation === 'landscape' ? 'Ngang' : 'Dọc'})
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 whitespace-nowrap text-xs">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Tỉ lệ W/H:</span>
          <span className={`font-mono font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{aspectRatio}</span>
        </div>
      </div>

      {!isAutoDetected && (
        <div className={`pt-2 border-t mt-1 ${isDark ? 'border-slate-700/80' : 'border-purple-100'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetToAutoDetect();
            }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-200" />
            <span>Bật lại Tự động nhận diện</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      placement="bottom"
      trigger={['hover', 'click']}
      arrow={{ pointAtCenter: true }}
      overlayStyle={{ width: 'auto', maxWidth: 'none' }}
      overlayInnerStyle={{
        padding: '12px 14px',
        borderRadius: '16px',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        border: isDark ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(147, 51, 234, 0.25)',
        boxShadow: isDark
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
          : '0 20px 25px -5px rgba(114, 46, 209, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        width: '320px',
        maxWidth: '340px',
      }}
    >
      <div
        className={`inline-flex items-center p-0.5 sm:p-1 rounded-xl transition-all select-none ${
          isDark
            ? 'bg-slate-900 border border-slate-800 shadow-xs'
            : 'bg-purple-50/70 border border-purple-200/80 shadow-xs'
        } ${className}`}
      >
        {/* Nút 1: Máy tính */}
        <button
          type="button"
          onClick={() => setManualDeviceMode('pc')}
          className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
            isPC
              ? isDark
                ? 'bg-[#722ED1] text-white shadow-xs border border-purple-400/30'
                : 'bg-purple-600 text-white shadow-xs border border-purple-600'
              : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-purple-700/70 hover:text-purple-900 hover:bg-purple-100/60'
          }`}
          aria-label="Chế độ Máy tính"
        >
          <Monitor className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${isPC ? 'scale-110' : ''}`} />
          {!compact && <span>Máy tính</span>}
        </button>

        {/* Nút 2: iPad Air */}
        <button
          type="button"
          onClick={() => setManualDeviceMode('ipad')}
          className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
            isIPad
              ? isDark
                ? 'bg-[#722ED1] text-white shadow-xs border border-purple-400/30'
                : 'bg-purple-600 text-white shadow-xs border border-purple-600'
              : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-purple-700/70 hover:text-purple-900 hover:bg-purple-100/60'
          }`}
          aria-label="Chế độ iPad Air M4"
        >
          <Tablet className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${isIPad ? 'scale-110' : ''}`} />
          {!compact && <span>iPad Air</span>}
        </button>

        {/* Huy hiệu trạng thái Auto / Tay */}
        <div
          className={`ml-1 pl-1 border-l flex items-center ${
            isDark ? 'border-slate-800' : 'border-purple-200/80'
          }`}
        >
          {isAutoDetected ? (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                isDark
                  ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
                  : 'text-emerald-700 bg-white border border-emerald-300 shadow-2xs'
              }`}
              title="Đang tự động nhận diện theo tỉ lệ khung hình & User-Agent"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Auto</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={resetToAutoDetect}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer active:scale-95 ${
                isDark
                  ? 'text-amber-300 bg-amber-950/40 border border-amber-500/30 hover:bg-amber-900/50'
                  : 'text-amber-700 bg-white border border-amber-300 hover:bg-amber-50 shadow-2xs'
              }`}
              title="Đang gạt tay thủ công. Bấm để trở về chế độ Tự động"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Tay</span>
            </button>
          )}
        </div>
      </div>
    </Popover>
  );
};

export default DeviceModeSwitch;
