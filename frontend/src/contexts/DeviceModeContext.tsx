import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type DeviceMode = 'pc' | 'ipad';
export type ScreenOrientation = 'landscape' | 'portrait';

export interface DeviceInfo {
  deviceMode: DeviceMode;
  orientation: ScreenOrientation;
  aspectRatio: number;
  browserName: string;
  isAutoDetected: boolean;
  screenWidth: number;
  screenHeight: number;
  isTouch: boolean;
}

export interface DeviceModeContextType extends DeviceInfo {
  setManualDeviceMode: (mode: DeviceMode) => void;
  resetToAutoDetect: () => void;
  toggleDeviceMode: () => void;
}

const STORAGE_KEY = 'qk7_manual_device_mode';

/**
 * Nhận diện chính xác tên trình duyệt web trên iPadOS và Desktop
 */
export const detectBrowserName = (ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string => {
  const lowerUA = ua.toLowerCase();

  // Kiểm tra Cốc Cốc trước (vì UA chứa cả Chrome/Safari)
  if (lowerUA.includes('coccoc') || lowerUA.includes('coc_coc')) {
    return 'Cốc Cốc';
  }
  // Google Search App trên iOS
  if (lowerUA.includes('gsa/')) {
    return 'Google App';
  }
  // Chrome trên iOS (CriOS) hoặc Chrome trên Desktop
  if (lowerUA.includes('crios')) {
    return 'Google Chrome';
  }
  // Edge trên iOS (EdgiOS) hoặc Edge Desktop (edg/)
  if (lowerUA.includes('edgios') || lowerUA.includes('edg/')) {
    return 'Microsoft Edge';
  }
  // Firefox trên iOS (FxiOS) hoặc Desktop
  if (lowerUA.includes('fxios') || lowerUA.includes('firefox')) {
    return 'Firefox';
  }
  // Chrome thông thường
  if (lowerUA.includes('chrome') && !lowerUA.includes('chromium')) {
    return 'Google Chrome';
  }
  // Safari (sau khi đã loại trừ Chrome/CriOS/CocCoc)
  if (lowerUA.includes('safari') && !lowerUA.includes('chrome') && !lowerUA.includes('crios')) {
    return 'Safari';
  }

  return 'Trình duyệt Web';
};

/**
 * Thuật toán Tự động Nhận diện Thiết Bị & Tỉ Lệ Khung Hình Thông Minh
 * Đặc trị iPad Air M4 (11-inch 820x1180, 13-inch 1024x1366) trên Safari, Chrome, Google App, Cốc Cốc
 */
export const detectSmartDeviceAndRatio = (): {
  deviceMode: DeviceMode;
  orientation: ScreenOrientation;
  aspectRatio: number;
  browserName: string;
  screenWidth: number;
  screenHeight: number;
  isTouch: boolean;
} => {
  if (typeof window === 'undefined') {
    return {
      deviceMode: 'pc',
      orientation: 'landscape',
      aspectRatio: 1.78,
      browserName: 'Desktop',
      screenWidth: 1920,
      screenHeight: 1080,
      isTouch: false,
    };
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspectRatio = Number((w / h).toFixed(2));
  const orientation: ScreenOrientation = w >= h ? 'landscape' : 'portrait';
  const ua = navigator.userAgent;
  const browserName = detectBrowserName(ua);

  // Nhận diện cảm ứng đa điểm (Touch points)
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isTouch = maxTouchPoints >= 2 || 'ontouchstart' in window;

  // Kiểm tra chuỗi User-Agent đặc trưng cho Apple / iPadOS
  const isIPadUA = /iPad/i.test(ua);
  // iPadOS 13+ mặc định gửi UA là "Macintosh; Intel Mac OS X..." nhưng có maxTouchPoints >= 2
  const isMacintoshTouch = /Macintosh/i.test(ua) && maxTouchPoints >= 2;
  const isIOSBrowser = /CriOS|GSA|CocCoc/i.test(ua) && isTouch;

  // Kích thước chuẩn của iPad Air M4 và các dòng iPad phổ biến:
  // - iPad Air 11-inch: 820 x 1180
  // - iPad Air 13-inch: 1024 x 1366
  // - iPad Pro 11-inch: 834 x 1194
  // - iPad Pro 12.9/13-inch: 1024 x 1366
  // - iPad 10.2 / 10.9-inch: 810x1080 / 820x1180
  const maxDim = Math.max(w, h);
  const minDim = Math.min(w, h);

  // iPad Air M4 có kích thước dài tối đa <= 1366px, cạnh ngắn <= 1024px
  const isTabletDimensions = maxDim <= 1366 && minDim >= 700;

  // Tỉ lệ màn hình iPad đặc trưng:
  // - 4:3 (1.33) hoặc 10:7 (~1.43) hoặc ~1.44 (1180/820)
  // Khi xoay ngang có thanh tab/địa chỉ trình duyệt thì tỉ lệ <= 1.56.
  // Màn hình PC widescreen thường là 16:9 (1.78), 16:10 (1.60), hoặc siêu rộng 21:9 (2.33).
  const isTabletAspectRatio = orientation === 'portrait' || aspectRatio <= 1.58;

  let isDetectedAsIPad = false;

  // Trường hợp PC / Laptop thông thường không có cảm ứng đa điểm và màn hình lớn: ưu tiên PC
  if (maxTouchPoints === 0 && w > 1024) {
    isDetectedAsIPad = false;
  }
  // Trường hợp 1: Chắc chắn là iPad qua User Agent hoặc Mac Touch + kích cỡ Tablet / tỉ lệ iPad
  else if ((isIPadUA || isMacintoshTouch || isIOSBrowser) && (isTabletDimensions || isTabletAspectRatio)) {
    isDetectedAsIPad = true;
  }
  // Trường hợp 2: Thiết bị cảm ứng có kích thước nằm trong dải iPad Air M4 (<= 1366px) và tỉ lệ <= 1.58
  else if (isTouch && w <= 1366 && isTabletAspectRatio) {
    isDetectedAsIPad = true;
  }
  // Trường hợp 3: Trình duyệt mở dạng cửa sổ nhỏ hoặc DevTools giả lập iPad Air
  else if (w <= 1024 && isTabletAspectRatio) {
    isDetectedAsIPad = true;
  }

  return {
    deviceMode: isDetectedAsIPad ? 'ipad' : 'pc',
    orientation,
    aspectRatio,
    browserName,
    screenWidth: w,
    screenHeight: h,
    isTouch,
  };
};

const DeviceModeContext = createContext<DeviceModeContextType | null>(null);

export const DeviceModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Đọc cài đặt thủ công từ sessionStorage nếu có
  const [manualMode, setManualMode] = useState<DeviceMode | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved === 'pc' || saved === 'ipad') {
        return saved as DeviceMode;
      }
    } catch {
      // sessionStorage unavailable
    }
    return null;
  });

  // Trạng thái nhận diện tự động thời gian thực
  const [autoInfo, setAutoInfo] = useState(() => detectSmartDeviceAndRatio());

  // Lắng nghe resize và orientationchange để cập nhật liên tục
  useEffect(() => {
    const handleUpdate = () => {
      setAutoInfo(detectSmartDeviceAndRatio());
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('orientationchange', handleUpdate, { passive: true });

    // Initial check
    handleUpdate();

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
    };
  }, []);

  // Xác định chế độ thiết bị cuối cùng (Ưu tiên manual nếu người dùng gạt tay)
  const isAutoDetected = manualMode === null;
  const effectiveDeviceMode: DeviceMode = manualMode || autoInfo.deviceMode;

  // Đồng bộ thuộc tính HTML `data-device-mode` và `data-orientation` lên <html>
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('data-device-mode', effectiveDeviceMode);
      root.setAttribute('data-orientation', autoInfo.orientation);
    }
  }, [effectiveDeviceMode, autoInfo.orientation]);

  // Hành động gạt tay
  const setManualDeviceMode = useCallback((mode: DeviceMode) => {
    setManualMode(mode);
    try {
      sessionStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }, []);

  // Đặt lại về tự động
  const resetToAutoDetect = useCallback(() => {
    setManualMode(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    setAutoInfo(detectSmartDeviceAndRatio());
  }, []);

  // Toggle nhanh
  const toggleDeviceMode = useCallback(() => {
    const nextMode: DeviceMode = effectiveDeviceMode === 'pc' ? 'ipad' : 'pc';
    setManualDeviceMode(nextMode);
  }, [effectiveDeviceMode, setManualDeviceMode]);

  const value: DeviceModeContextType = {
    deviceMode: effectiveDeviceMode,
    orientation: autoInfo.orientation,
    aspectRatio: autoInfo.aspectRatio,
    browserName: autoInfo.browserName,
    isAutoDetected,
    screenWidth: autoInfo.screenWidth,
    screenHeight: autoInfo.screenHeight,
    isTouch: autoInfo.isTouch,
    setManualDeviceMode,
    resetToAutoDetect,
    toggleDeviceMode,
  };

  return <DeviceModeContext.Provider value={value}>{children}</DeviceModeContext.Provider>;
};

export const useDeviceMode = (): DeviceModeContextType => {
  const context = useContext(DeviceModeContext);
  if (!context) {
    throw new Error('useDeviceMode phải được sử dụng bên trong DeviceModeProvider');
  }
  return context;
};

export default DeviceModeContext;
