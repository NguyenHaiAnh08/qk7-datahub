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

  if (lowerUA.includes('coccoc') || lowerUA.includes('coc_coc')) {
    return 'Cốc Cốc';
  }
  if (lowerUA.includes('gsa/')) {
    return 'Google App';
  }
  if (lowerUA.includes('crios')) {
    return 'Google Chrome';
  }
  if (lowerUA.includes('edgios') || lowerUA.includes('edg/')) {
    return 'Microsoft Edge';
  }
  if (lowerUA.includes('fxios') || lowerUA.includes('firefox')) {
    return 'Firefox';
  }
  if (lowerUA.includes('chrome') && !lowerUA.includes('chromium')) {
    return 'Google Chrome';
  }
  if (lowerUA.includes('safari') && !lowerUA.includes('chrome') && !lowerUA.includes('crios')) {
    return 'Safari';
  }

  return 'Trình duyệt Web';
};

/**
 * Thuật toán Tự động Nhận diện Thiết Bị & Tỉ Lệ Khung Hình Thông Minh
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

  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isTouch = maxTouchPoints >= 2 || 'ontouchstart' in window;

  const isIPadUA = /iPad/i.test(ua);
  const isMacintoshTouch = /Macintosh/i.test(ua) && maxTouchPoints >= 2;
  const isIOSBrowser = /CriOS|GSA|CocCoc/i.test(ua) && isTouch;

  const maxDim = Math.max(w, h);
  const minDim = Math.min(w, h);

  const isTabletDimensions = maxDim <= 1366 && minDim >= 700;
  const isTabletAspectRatio = orientation === 'portrait' || aspectRatio <= 1.58;

  let isDetectedAsIPad = false;

  if (maxTouchPoints === 0 && w > 1024) {
    isDetectedAsIPad = false;
  } else if ((isIPadUA || isMacintoshTouch || isIOSBrowser) && (isTabletDimensions || isTabletAspectRatio)) {
    isDetectedAsIPad = true;
  } else if (isTouch && w <= 1366 && isTabletAspectRatio) {
    isDetectedAsIPad = true;
  } else if (w <= 1024 && isTabletAspectRatio) {
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

/**
 * Đọc setting từ localStorage.
 * Migrate 1 lần: nếu localStorage trống nhưng sessionStorage cũ có giá trị thì copy sang.
 */
const readSavedMode = (): DeviceMode | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pc' || saved === 'ipad') {
      return saved as DeviceMode;
    }
    // Migrate từ sessionStorage (version cũ)
    const legacy = sessionStorage.getItem(STORAGE_KEY);
    if (legacy === 'pc' || legacy === 'ipad') {
      localStorage.setItem(STORAGE_KEY, legacy);
      sessionStorage.removeItem(STORAGE_KEY);
      return legacy as DeviceMode;
    }
  } catch {
    // storage unavailable
  }
  return null;
};

const DeviceModeContext = createContext<DeviceModeContextType | null>(null);

export const DeviceModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Đọc cài đặt thủ công từ localStorage nếu có (kèm migrate từ sessionStorage)
  const [manualMode, setManualMode] = useState<DeviceMode | null>(() => readSavedMode());

  const [autoInfo, setAutoInfo] = useState(() => detectSmartDeviceAndRatio());

  // Lắng nghe resize và orientationchange để cập nhật liên tục
  useEffect(() => {
    const handleUpdate = () => {
      setAutoInfo(detectSmartDeviceAndRatio());
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('orientationchange', handleUpdate, { passive: true });

    handleUpdate();

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
    };
  }, []);

  // Đồng bộ khi tab khác thay đổi setting (storage event chỉ bắn giữa các tab)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === 'pc' || e.newValue === 'ipad') {
        setManualMode(e.newValue as DeviceMode);
      } else if (e.newValue === null) {
        setManualMode(null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isAutoDetected = manualMode === null;
  const effectiveDeviceMode: DeviceMode = manualMode || autoInfo.deviceMode;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('data-device-mode', effectiveDeviceMode);
      root.setAttribute('data-orientation', autoInfo.orientation);
    }
  }, [effectiveDeviceMode, autoInfo.orientation]);

  const setManualDeviceMode = useCallback((mode: DeviceMode) => {
    setManualMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }, []);

  const resetToAutoDetect = useCallback(() => {
    setManualMode(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setAutoInfo(detectSmartDeviceAndRatio());
  }, []);

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