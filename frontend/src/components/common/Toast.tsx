// Lucian UX/UI Prompt #070 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#070
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import './Toast.css';

export type ToastType =
  | 'success'
  | 'warning'
  | 'error'
  | 'danger'
  | 'securityAlert'
  | 'info'
  | 'loading';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number; // ms, default 4500 (Infinity for loading)
  timestamp?: number;
  badge?: string;
  action?: ToastAction;
}

export interface ToastOptions {
  id?: string;
  title?: string;
  duration?: number;
  badge?: string;
  action?: ToastAction;
}

const DEFAULT_DURATION_MS = 4500;
const MAX_VISIBLE_TOASTS = 5;

const genToastId = () =>
  'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

// =========================================================================
// Global Event Bus & Helper Function
// Cho phép gọi toast từ bất kỳ service, hook hay event listener nào (HttpErrorListener, v.v.)
// =========================================================================
export const showAnimatedToast = (
  message: string,
  type: ToastType = 'success',
  options?: ToastOptions
): string => {
  const id = options?.id || genToastId();
  if (typeof window !== 'undefined') {
    const duration =
      type === 'loading'
        ? options?.duration ?? Infinity
        : options?.duration ?? DEFAULT_DURATION_MS;
    window.dispatchEvent(
      new CustomEvent('qk7:animated-toast', {
        detail: {
          id,
          message,
          type,
          title: options?.title,
          duration,
          badge: options?.badge,
          action: options?.action,
          timestamp: Date.now(),
        } as ToastItem,
      })
    );
  }
  return id;
};

export const updateAnimatedToast = (
  id: string,
  patch: Partial<Omit<ToastItem, 'id'>>
) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('qk7:animated-toast-update', {
        detail: { id, patch },
      })
    );
  }
};

export const dismissAnimatedToast = (id: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('qk7:animated-toast-dismiss', {
        detail: { id },
      })
    );
  }
};

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    showAnimatedToast(message, 'success', options),
  warning: (message: string, options?: ToastOptions) =>
    showAnimatedToast(message, 'warning', options),
  error: (message: string, options?: ToastOptions) =>
    showAnimatedToast(message, 'error', options),
  danger: (message: string, options?: ToastOptions) =>
    showAnimatedToast(message, 'danger', options),
  securityAlert: (message: string, options?: ToastOptions) =>
    showAnimatedToast(message, 'securityAlert', {
      ...options,
      title: options?.title || 'Cảnh báo an ninh quân sự',
      badge: options?.badge || 'SOC-ALERT',
      duration: options?.duration ?? DEFAULT_DURATION_MS,
    }),
  info: (message: string, options?: ToastOptions) =>
    showAnimatedToast(message, 'info', options),
  loading: (message: string, options?: ToastOptions) =>
    showAnimatedToast(message, 'loading', {
      ...options,
      title: options?.title || 'Đang xử lý…',
      duration: options?.duration ?? Infinity,
    }),
  update: updateAnimatedToast,
  dismiss: dismissAnimatedToast,
};

// =========================================================================
// Toast Context & Custom Hook
// =========================================================================
interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, options?: ToastOptions) => string;
  updateToast: (id: string, patch: Partial<Omit<ToastItem, 'id'>>) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toasts: [] as ToastItem[],
      addToast: (msg: string, type: ToastType = 'success', opts?: ToastOptions) =>
        showAnimatedToast(msg, type, opts),
      updateToast: updateAnimatedToast,
      removeToast: dismissAnimatedToast,
      clearAll: () => {},
      toast,
    };
  }
  return { ...ctx, toast };
};

export const useAnimatedToast = useToast;

// =========================================================================
// Smart Semantic Line-Wrapping Formatter for Vietnamese Notifications
// Giữ nguyên cụm từ ghép, quân hàm, họ tên, tên hệ thống và cấp độ mật
// bằng Non-Breaking Space (\u00A0) để xuống dòng thông minh, không bị mất nghĩa
// hoặc rơi từ đơn lẻ (orphan word) ở cuối dòng.
// =========================================================================
const SMART_VIETNAMESE_PHRASE_PATTERNS: RegExp[] = [
  /(?<![\p{L}\p{N}])(vào|tại|trên|khỏi|tới|đến)[ ]+(Hệ[ ]+Thống[ ]+Quản[ ]+Lý[ ]+Đào[ ]+Tạo|Trung[ ]+Tâm[ ]+Dữ[ ]+Liệu[ ]+Số|Trường[ ]+Quân[ ]+Sự[ ]+Quân[ ]+Khu[ ]+7|Tổ[ ]+Quản[ ]+Trị[ ]+Hệ[ ]+Thống(?:[ ]+QK7)?)(?![\p{L}\p{N}])/giu,
  /(?<![\p{L}\p{N}])(Hệ[ ]+Thống[ ]+Quản[ ]+Lý[ ]+Đào[ ]+Tạo|Trung[ ]+Tâm[ ]+Dữ[ ]+Liệu[ ]+Số|Trường[ ]+Quân[ ]+Sự[ ]+Quân[ ]+Khu[ ]+7|Quân[ ]+Khu[ ]+7|Thư[ ]+viện[ ]+số(?:[ ]+QK7)?|Khoa[ ]+Binh[ ]+Chủng|Phòng[ ]+Tham[ ]+mưu|Phòng[ ]+Đào[ ]+tạo|Trợ[ ]+lý[ ]+AI|SQL[ ]+Server|Port[ ]+\d+)(?![\p{L}\p{N}])/giu,
  /(?<![\p{L}\p{N}])(Cấp[ ]+[1-5]|Công[ ]+khai|Nội[ ]+bộ|Tối[ ]+Mật|Tuyệt[ ]+Mật|Toàn[ ]+quyền(?:[ ]+Admin)?|vân[ ]+tay[ ]+2FA|sinh[ ]+trắc[ ]+học|bảo[ ]+vệ[ ]+2[ ]+tầng)(?![\p{L}\p{N}])/giu,
  /(?<![\p{L}\p{N}])(đồng[ ]+chí|Đại[ ]+tướng|Thượng[ ]+tướng|Trung[ ]+tướng|Thiếu[ ]+tướng|Đại[ ]+tá|Thượng[ ]+tá|Trung[ ]+tá|Thiếu[ ]+tá|Đại[ ]+úy|Thượng[ ]+úy|Trung[ ]+úy|Thiếu[ ]+úy|Thượng[ ]+sĩ|Trung[ ]+sĩ|Hạ[ ]+sĩ|Binh[ ]+nhất|Binh[ ]+nhì|Quản[ ]+trị[ ]+viên|Cán[ ]+bộ[ ]+Văn[ ]+thư|Nhân[ ]+viên[ ]+IT|Trưởng[ ]+khoa|Phó[ ]+khoa|Trưởng[ ]+phòng|Phó[ ]+phòng|Giáo[ ]+viên|Giảng[ ]+viên|Học[ ]+viên|Chỉ[ ]+huy|Cơ[ ]+yếu|Trợ[ ]+lý|Văn[ ]+thư)(?![\p{L}\p{N}])/giu,
  /(?<![\p{L}\p{N}])(\p{Lu}\p{Ll}+(?:[ ]+\p{Lu}\p{Ll}+){1,3})(?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}])(Chào[ ]+mừng|Xin[ ]+chào|Đã[ ]+chọn|tài[ ]+khoản|mật[ ]+khẩu|đăng[ ]+nhập|đăng[ ]+xuất|thành[ ]+công|thất[ ]+bại|xác[ ]+thực|vân[ ]+tay|quản[ ]+trị|hệ[ ]+thống|phân[ ]+hệ|đào[ ]+tạo|dữ[ ]+liệu|văn[ ]+bản|tài[ ]+liệu|bài[ ]+giảng|môn[ ]+học|lớp[ ]+học|giảng[ ]+đường|phê[ ]+duyệt|từ[ ]+chối|khôi[ ]+phục|thùng[ ]+rác|vĩnh[ ]+viễn|máy[ ]+chủ|kết[ ]+nối|truy[ ]+cập|trực[ ]+tiếp|tuyệt[ ]+đối|quy[ ]+định|tác[ ]+chiến|kiểm[ ]+tra|thông[ ]+tin|người[ ]+dùng|quân[ ]+nhân|làm[ ]+việc|hết[ ]+hạn|mở[ ]+khóa|kích[ ]+hoạt|bảo[ ]+vệ|hàng[ ]+loạt|nhật[ ]+ký|an[ ]+ninh|báo[ ]+cáo|tải[ ]+xuống|hoàn[ ]+tất|yêu[ ]+cầu|hiệu[ ]+lực|chuyển[ ]+hướng|chế[ ]+độ|bảo[ ]+mật|cấp[ ]+độ|quyền[ ]+hạn|thao[ ]+tác|hiện[ ]+tại|trở[ ]+lên|duy[ ]+nhất|cho[ ]+phép)(?![\p{L}\p{N}])/giu,
];

export const formatSmartToastMessage = (rawMessage: string): string => {
  if (!rawMessage) return '';
  let formatted = rawMessage.trim();

  for (const pattern of SMART_VIETNAMESE_PHRASE_PATTERNS) {
    formatted = formatted.replace(pattern, (match) => match.replace(/ +/g, '\u00A0'));
  }

  formatted = formatted.replace(/(\S+)[ ]+(\S+[.!?…]*)$/u, (full, secondLast, last) => {
    if (secondLast.length + last.length <= 16) {
      return `${secondLast}\u00A0${last}`;
    }
    return full;
  });

  return formatted;
};

// =========================================================================
// Internal Runtime State for Lucian #070 Stacking Physics
// =========================================================================
interface InternalToast extends ToastItem {
  entering: boolean;
  leaving: boolean;
  leaveDir: 0 | 1 | -1;
}

const getToastVisuals = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        colorVar: 'var(--ux-mint)',
        defaultTitle: 'Thao tác thành công',
        role: 'status' as const,
        icon: (
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 9.4l3.2 3.2L14 5.6" />
          </svg>
        ),
      };
    case 'warning':
      return {
        colorVar: 'var(--ux-warn)',
        defaultTitle: 'Lưu ý kiểm duyệt',
        role: 'status' as const,
        icon: (
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M9 5.5v4.5M9 13h.01" />
          </svg>
        ),
      };
    case 'securityAlert':
    case 'error':
    case 'danger':
      return {
        colorVar: 'var(--ux-danger)',
        defaultTitle:
          type === 'securityAlert' ? 'Cảnh báo an ninh' : 'Lỗi xử lý hệ thống',
        role: 'alert' as const,
        icon: (
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M9 5v5M9 13h.01" />
          </svg>
        ),
      };
    case 'loading':
      return {
        colorVar: 'var(--ux-warn)',
        defaultTitle: 'Đang xử lý…',
        role: 'status' as const,
        icon: <i aria-hidden="true" />,
      };
    case 'info':
    default:
      return {
        colorVar: 'var(--ux-accent-2)',
        defaultTitle: 'Thông tin hệ thống',
        role: 'status' as const,
        icon: (
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3.5 4.5h11v7h-6l-3 2.5v-2.5h-2z" />
          </svg>
        ),
      };
  }
};

// =========================================================================
// Stacking Toast Renderer (Lucian #070 exact physics)
// =========================================================================
interface ToastStackViewportProps {
  items: InternalToast[];
  onDismiss: (id: string, dir?: 1 | -1) => void;
  liveAnnouncement: string;
}

const ToastStackViewport: React.FC<ToastStackViewportProps> = ({
  items,
  onDismiss,
  liveAnnouncement,
}) => {
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const elMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const timingMapRef = useRef<Map<string, { left: number; duration: number }>>(new Map());
  const openRef = useRef<boolean>(false);
  const itemsRef = useRef<InternalToast[]>(items);
  itemsRef.current = items;

  const dragRef = useRef<{
    id: string;
    sx: number;
    dx: number;
    down: boolean;
  } | null>(null);

  // Sync timing metadata whenever items list or duration changes
  useEffect(() => {
    const activeIds = new Set<string>();
    items.forEach((item) => {
      activeIds.add(item.id);
      const existing = timingMapRef.current.get(item.id);
      const targetDur =
        item.type === 'loading'
          ? item.duration ?? Infinity
          : item.duration ?? DEFAULT_DURATION_MS;
      if (!existing) {
        timingMapRef.current.set(item.id, { left: targetDur, duration: targetDur });
      } else if (existing.duration !== targetDur) {
        // Khi loading chuyển sang success/error: nạp lại bộ đếm thời gian mới
        existing.duration = targetDur;
        existing.left = targetDur;
        const el = elMapRef.current.get(item.id);
        if (el) el.style.setProperty('--left', '1');
      }
    });
    for (const key of Array.from(timingMapRef.current.keys())) {
      if (!activeIds.has(key)) {
        timingMapRef.current.delete(key);
      }
    }
  }, [items]);

  // Exact Lucian #070 stacking / fan-out layout calculation
  const applyLayout = useCallback(() => {
    const zone = zoneRef.current;
    const activeList = itemsRef.current.filter((t) => !t.leaving);
    const isOpen = openRef.current;
    let acc = 0;

    activeList.forEach((t, i) => {
      const el = elMapRef.current.get(t.id);
      if (!el) return;

      const isTucked = !isOpen && i > 0;
      el.classList.toggle('back', isTucked);
      if (isOpen) {
        el.style.setProperty('--y', `${-acc}px`);
        el.style.setProperty('--s', '1');
        el.style.setProperty('--o', '1');
        acc += el.offsetHeight + 8;
      } else {
        el.style.setProperty('--y', `${-(i * 14)}px`);
        el.style.setProperty('--s', (1 - i * 0.06).toFixed(2));
        el.style.setProperty('--o', i > 2 ? '0' : '1');
      }
      el.style.zIndex = String(50 - i);
      (el as HTMLElement & { inert: boolean }).inert = isTucked;
    });

    // Giữ chiều cao vùng bắt hover vừa khít cụm toast (không che vùng trống của trang)
    if (zone) {
      if (activeList.length === 0) {
        zone.style.height = '0px';
      } else if (isOpen) {
        zone.style.height = `${Math.max(acc, 68)}px`;
      } else {
        const frontEl = elMapRef.current.get(activeList[0].id);
        const frontH = frontEl ? frontEl.offsetHeight : 72;
        const visibleBack = Math.min(2, activeList.length - 1);
        zone.style.height = `${frontH + visibleBack * 14}px`;
      }
    }
  }, []);

  // Re-layout whenever items array mutates
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      applyLayout();
    });
    return () => cancelAnimationFrame(raf);
  }, [items, applyLayout]);

  // Exact #070 rAF countdown loop (chỉ đếm lùi thẻ trên cùng khi không mở quạt)
  useEffect(() => {
    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;

      if (!openRef.current) {
        const activeList = itemsRef.current.filter((t) => !t.leaving);
        if (activeList.length > 0) {
          const front = activeList[0];
          const timing = timingMapRef.current.get(front.id);
          if (timing && timing.left !== Infinity && timing.duration !== Infinity) {
            timing.left -= dt;
            const ratio = Math.max(0, timing.left / timing.duration);
            const el = elMapRef.current.get(front.id);
            if (el) {
              el.style.setProperty('--left', ratio.toFixed(3));
            }
            if (timing.left <= 0) {
              timing.left = Infinity;
              onDismiss(front.id);
            }
          }
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onDismiss]);

  const setOpen = useCallback(
    (v: boolean) => {
      if (openRef.current === v) return;
      openRef.current = v;
      applyLayout();
    },
    [applyLayout]
  );

  // Khi còn 0 hoặc 1 toast thì tự thu gọn trạng thái mở
  useEffect(() => {
    const activeCount = items.filter((t) => !t.leaving).length;
    if (activeCount === 0 && openRef.current) {
      openRef.current = false;
    }
  }, [items]);

  const handlePointerDown = (item: InternalToast, e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (item.leaving) return;
    const el = elMapRef.current.get(item.id);
    if (!el) return;
    dragRef.current = { id: item.id, sx: e.clientX, dx: 0, down: true };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture unavailable
    }
    el.classList.add('drag');
  };

  const handlePointerMove = (item: InternalToast, e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || !d.down || d.id !== item.id) return;
    const el = elMapRef.current.get(item.id);
    if (!el) return;
    d.dx = e.clientX - d.sx;
    el.style.setProperty('--dx', `${d.dx}px`);
    el.style.setProperty('--o', String(Math.max(0.2, 1 - Math.abs(d.dx) / 260)));
  };

  const finishSwipe = (item: InternalToast) => {
    const d = dragRef.current;
    if (!d || !d.down || d.id !== item.id) return;
    d.down = false;
    dragRef.current = null;
    const el = elMapRef.current.get(item.id);
    if (!el) return;
    el.classList.remove('drag');
    if (Math.abs(d.dx) > 90) {
      onDismiss(item.id, d.dx > 0 ? 1 : -1);
    } else {
      el.style.setProperty('--dx', '0px');
      applyLayout();
    }
  };

  const activeCount = items.filter((t) => !t.leaving).length;

  return (
    <div className="u070">
      <div
        ref={zoneRef}
        className={`u070-zone${activeCount > 0 ? ' has-items' : ''}`}
        role="region"
        aria-label="Thông báo hệ thống"
        tabIndex={-1}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse' && activeCount > 0) setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (
            e.pointerType === 'mouse' &&
            zoneRef.current &&
            !zoneRef.current.contains(document.activeElement)
          ) {
            setOpen(false);
          }
        }}
        onFocus={() => {
          if (activeCount > 0) setOpen(true);
        }}
        onBlur={(e) => {
          if (zoneRef.current && !zoneRef.current.contains(e.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
        onClick={(e) => {
          if (
            !(e.target as HTMLElement).closest('button') &&
            itemsRef.current.filter((t) => !t.leaving).length > 1
          ) {
            setOpen(!openRef.current);
          }
        }}
      >
        <div className="u070-live" aria-live="polite">
          {liveAnnouncement}
        </div>

        {items.map((item) => {
          const vis = getToastVisuals(item.type);
          const timeFormatted = item.timestamp
            ? new Date(item.timestamp).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            : undefined;
          const cls = [
            'u070-t',
            item.entering ? 'enter' : '',
            item.leaving ? 'leave' : '',
            item.leaving && item.leaveDir !== 0 ? 'side' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={item.id}
              ref={(node) => {
                if (node) elMapRef.current.set(item.id, node);
                else elMapRef.current.delete(item.id);
              }}
              className={cls}
              role={vis.role}
              style={
                {
                  '--c': vis.colorVar,
                  ...(item.leaveDir !== 0 ? { '--dir': item.leaveDir } : {}),
                } as React.CSSProperties
              }
              onPointerDown={(e) => handlePointerDown(item, e)}
              onPointerMove={(e) => handlePointerMove(item, e)}
              onPointerUp={() => finishSwipe(item)}
              onPointerCancel={() => finishSwipe(item)}
            >
              <span className="u070-ic" aria-hidden="true">
                {vis.icon}
              </span>

              <span className="u070-tx">
                <span className="u070-head">
                  <b>{item.title || vis.defaultTitle}</b>
                  {item.badge && <span className="u070-badge">{item.badge}</span>}
                  {timeFormatted && <span className="u070-time">{timeFormatted}</span>}
                </span>
                <small>{formatSmartToastMessage(item.message)}</small>
              </span>

              {item.action && (
                <button
                  type="button"
                  className="u070-act"
                  onClick={() => {
                    item.action?.onClick();
                    onDismiss(item.id);
                  }}
                >
                  {item.action.label}
                </button>
              )}

              <button
                type="button"
                className="u070-x"
                aria-label="Đóng thông báo"
                onClick={() => onDismiss(item.id)}
              >
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
                </svg>
              </button>

              <span className="u070-bar" aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =========================================================================
// Toast Provider: Quản lý danh sách Stacking Toasts toàn hệ thống (Lucian #070)
// =========================================================================
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<InternalToast[]>([]);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const leaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = leaveTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const dismissWithAnim = useCallback((id: string, dir?: 1 | -1) => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setItems((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target || target.leaving) return prev;
      if (reducedMotion) {
        return prev.filter((t) => t.id !== id);
      }
      return prev.map((t) =>
        t.id === id ? { ...t, leaving: true, leaveDir: dir ?? 0 } : t
      );
    });

    if (!reducedMotion) {
      if (leaveTimersRef.current.has(id)) {
        clearTimeout(leaveTimersRef.current.get(id)!);
      }
      const timer = setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
        leaveTimersRef.current.delete(id);
      }, 450);
      leaveTimersRef.current.set(id, timer);
    }
  }, []);

  const removeToast = useCallback(
    (id: string) => {
      dismissWithAnim(id);
    },
    [dismissWithAnim]
  );

  const clearAll = useCallback(() => {
    leaveTimersRef.current.forEach((t) => clearTimeout(t));
    leaveTimersRef.current.clear();
    setItems([]);
  }, []);

  const pushInternal = useCallback((item: ToastItem) => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const entry: InternalToast = {
      ...item,
      entering: !reducedMotion,
      leaving: false,
      leaveDir: 0,
    };

    setLiveAnnouncement(item.title || item.message);

    setItems((prev) => {
      const active = prev.filter((t) => !t.leaving);
      const leaving = prev.filter((t) => t.leaving);
      // Mới nhất luôn ở vị trí 0 (trồi lên phía trước); cũ hơn xếp gọn ra sau
      const nextActive = [entry, ...active].slice(0, MAX_VISIBLE_TOASTS);
      return [...nextActive, ...leaving];
    });

    if (!reducedMotion) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setItems((prev) =>
            prev.map((t) => (t.id === entry.id ? { ...t, entering: false } : t))
          );
        });
      });
    }
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'success', options?: ToastOptions) => {
      const id = options?.id || genToastId();
      const duration =
        type === 'loading'
          ? options?.duration ?? Infinity
          : options?.duration ?? DEFAULT_DURATION_MS;
      pushInternal({
        id,
        message,
        type,
        title: options?.title,
        duration,
        badge: options?.badge,
        action: options?.action,
        timestamp: Date.now(),
      });
      return id;
    },
    [pushInternal]
  );

  const updateToast = useCallback(
    (id: string, patch: Partial<Omit<ToastItem, 'id'>>) => {
      setItems((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const nextType = patch.type ?? t.type;
          const nextDuration =
            patch.duration !== undefined
              ? patch.duration
              : nextType === 'loading'
              ? Infinity
              : DEFAULT_DURATION_MS;
          return {
            ...t,
            ...patch,
            type: nextType,
            duration: nextDuration,
          };
        })
      );
      if (patch.title || patch.message) {
        setLiveAnnouncement(patch.title || patch.message || '');
      }
    },
    []
  );

  // Lắng nghe sự kiện toàn cục qk7:animated-toast (+ update / dismiss)
  useEffect(() => {
    const handleAdd = (event: Event) => {
      const detail = (event as CustomEvent<ToastItem>).detail;
      if (!detail) return;
      pushInternal({
        id: detail.id || genToastId(),
        message: detail.message,
        type: detail.type || 'success',
        title: detail.title,
        duration:
          detail.type === 'loading'
            ? detail.duration ?? Infinity
            : detail.duration ?? DEFAULT_DURATION_MS,
        badge: detail.badge,
        action: detail.action,
        timestamp: detail.timestamp || Date.now(),
      });
    };

    const handleUpdate = (event: Event) => {
      const detail = (
        event as CustomEvent<{ id: string; patch: Partial<Omit<ToastItem, 'id'>> }>
      ).detail;
      if (!detail?.id) return;
      updateToast(detail.id, detail.patch);
    };

    const handleDismiss = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      if (!detail?.id) return;
      dismissWithAnim(detail.id);
    };

    window.addEventListener('qk7:animated-toast', handleAdd);
    window.addEventListener('qk7:animated-toast-update', handleUpdate);
    window.addEventListener('qk7:animated-toast-dismiss', handleDismiss);
    return () => {
      window.removeEventListener('qk7:animated-toast', handleAdd);
      window.removeEventListener('qk7:animated-toast-update', handleUpdate);
      window.removeEventListener('qk7:animated-toast-dismiss', handleDismiss);
    };
  }, [pushInternal, updateToast, dismissWithAnim]);

  const exposedToasts: ToastItem[] = items
    .filter((t) => !t.leaving)
    .map(({ entering: _e, leaving: _l, leaveDir: _d, ...rest }) => rest);

  return (
    <ToastContext.Provider
      value={{
        toasts: exposedToasts,
        addToast,
        updateToast,
        removeToast,
        clearAll,
      }}
    >
      {children}
      <ToastStackViewport
        items={items}
        onDismiss={dismissWithAnim}
        liveAnnouncement={liveAnnouncement}
      />
    </ToastContext.Provider>
  );
};

// =========================================================================
// Backwards-compatible Standalone Toast Component
// Hỗ trợ nguyên vẹn cú pháp cũ <Toast toast={toast} onClose={...} />
// =========================================================================
export interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface LegacyToastProps {
  toast: ToastState;
  onClose: () => void;
}

export const Toast: React.FC<LegacyToastProps> = ({ toast: state, onClose }) => {
  const [internal, setInternal] = useState<InternalToast[]>([]);

  useEffect(() => {
    if (!state.show) {
      setInternal([]);
      return;
    }
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const item: InternalToast = {
      id: 'legacy-single-toast',
      message: state.message,
      type: state.type,
      duration: DEFAULT_DURATION_MS,
      timestamp: Date.now(),
      entering: !reducedMotion,
      leaving: false,
      leaveDir: 0,
    };
    setInternal([item]);

    if (!reducedMotion) {
      const r1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setInternal((prev) => prev.map((t) => ({ ...t, entering: false })));
        });
      });
      return () => cancelAnimationFrame(r1);
    }
  }, [state.show, state.message, state.type]);

  const handleDismiss = useCallback(
    (_id: string, dir?: 1 | -1) => {
      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) {
        setInternal([]);
        onClose();
        return;
      }
      setInternal((prev) =>
        prev.map((t) => ({ ...t, leaving: true, leaveDir: dir ?? 0 }))
      );
      setTimeout(() => {
        setInternal([]);
        onClose();
      }, 450);
    },
    [onClose]
  );

  if (internal.length === 0) return null;

  return (
    <ToastStackViewport
      items={internal}
      onDismiss={handleDismiss}
      liveAnnouncement={state.message}
    />
  );
};

export default Toast;
