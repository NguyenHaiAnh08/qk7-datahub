import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, Radio } from 'lucide-react';
import { toast } from '../components/common/Toast';

interface NetworkStatusContextType {
  isOnline: boolean;
  isReconnecting: boolean;
  lastCheckedAt: Date | null;
  checkConnection: () => Promise<boolean>;
}

const NetworkStatusContext = createContext<NetworkStatusContextType>({
  isOnline: true,
  isReconnecting: false,
  lastCheckedAt: null,
  checkConnection: async () => true,
});

export const useNetworkStatus = () => useContext(NetworkStatusContext);

export const NetworkStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine ?? true);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const pingServer = useCallback(async (): Promise<boolean> => {
    // Nếu trình duyệt báo offline hoàn toàn
    if (!navigator.onLine) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Thử ping endpoint /api/health của Express 5 Gateway
      const res = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsReconnecting(true);
    const ok = await pingServer();
    setLastCheckedAt(new Date());

    setIsOnline((prev) => {
      if (!prev && ok) {
        toast.success('Đã khôi phục kết nối đến máy chủ cổng dữ liệu LAN (Port 8000).', {
          title: 'KẾT NỐI TRỰC TUYẾN',
          badge: 'LAN-ONLINE',
        });
      }
      return ok;
    });

    setIsReconnecting(false);
    return ok;
  }, [pingServer]);

  // Lắng nghe sự kiện Online / Offline của trình duyệt
  useEffect(() => {
    const handleBrowserOnline = () => {
      checkConnection();
    };

    const handleBrowserOffline = () => {
      setIsOnline(false);
      toast.error('Mất tín hiệu kết nối mạng nội bộ. Đang tự động quét và kết nối lại...', {
        title: 'MẤT KẾT NỐI MÁY CHỦ',
        badge: 'LAN-OFFLINE',
      });
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    // Kiểm tra định kỳ mỗi 15 giây khi online, hoặc mỗi 5 giây khi offline
    const intervalTime = isOnline ? 15000 : 5000;
    const interval = setInterval(() => {
      checkConnection();
    }, intervalTime);

    return () => {
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      clearInterval(interval);
    };
  }, [isOnline, checkConnection]);

  return (
    <NetworkStatusContext.Provider
      value={{
        isOnline,
        isReconnecting,
        lastCheckedAt,
        checkConnection,
      }}
    >
      {children}

      {/* Lớp Phủ Tinh Tế & Hoạt Ảnh Sóng Radar Khi Mất Kết Nối Mạng */}
      {!isOnline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md p-6 sm:p-7 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-rose-500/50 shadow-2xl text-center space-y-5 select-none">
            {/* Vòng Tròn Radar Quét Mạng Tác Chiến */}
            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              {/* Vòng tròn đồng tâm */}
              <div className="absolute inset-0 rounded-full border border-rose-500/20 radar-pulse-ring" />
              <div className="absolute inset-3 rounded-full border border-rose-500/30" />
              <div className="absolute inset-7 rounded-full border border-rose-500/40" />
              <div className="absolute inset-11 rounded-full border border-rose-500/50" />

              {/* Trục chữ thập */}
              <div className="absolute inset-x-0 top-1/2 h-px bg-rose-500/30 -translate-y-1/2" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-rose-500/30 -translate-x-1/2" />

              {/* Cánh quạt radar quét xoay tròn 360 độ */}
              <div
                className="absolute inset-0 rounded-full radar-sweep-line overflow-hidden pointer-events-none"
                style={{
                  background:
                    'conic-gradient(from 0deg at 50% 50%, rgba(244, 63, 94, 0.4) 0deg, rgba(244, 63, 94, 0) 60deg, transparent 360deg)',
                }}
              />

              {/* Biểu tượng tâm radar */}
              <div className="relative z-10 w-10 h-10 rounded-full bg-rose-950 border border-rose-500 flex items-center justify-center text-rose-400 shadow-md shadow-rose-950/60">
                <WifiOff className="w-5 h-5 animate-pulse" />
              </div>
            </div>

            {/* Thông điệp cảnh báo */}
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 font-mono text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                <span>MẤT KẾT NỐI MÁY CHỦ LAN (PORT 8000)</span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Hệ Thống Đang Cố Gắng Kết Nối Lại...
              </h3>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                Không thể nhận phản hồi từ Express Gateway. Vui lòng kiểm tra cáp mạng nội bộ LAN hoặc dịch vụ backend trên máy chủ.
              </p>
            </div>

            {/* Nút hành động thử kết nối ngay */}
            <div className="pt-2 flex items-center justify-center gap-2.5">
              <button
                type="button"
                disabled={isReconnecting}
                onClick={() => checkConnection()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-700 via-rose-800 to-rose-900 hover:from-rose-800 hover:to-rose-950 text-white font-semibold text-xs border border-rose-600/40 shadow-md shadow-rose-950/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
                <span>{isReconnecting ? 'Đang dò sóng...' : 'Thử kết nối ngay'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Tải lại trang
              </button>
            </div>

            <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
              Auto-reconnecting every 5s • Radar scan active
            </div>
          </div>
        </div>
      )}
    </NetworkStatusContext.Provider>
  );
};
