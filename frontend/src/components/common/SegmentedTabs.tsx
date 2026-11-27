/* Lucian UX/UI Prompt #416 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#416 */
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import './SegmentedTabs.css';

export type SegmentedTabTone =
  | 'neutral'
  | 'emerald'
  | 'emerald-text'
  | 'amber'
  | 'danger'
  | 'slate'
  | 'navy';

export interface SegmentedTabItem<T extends string = string> {
  value: T;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  /** Hiển thị dạng "(11)" liền sau nhãn */
  count?: number;
  /** Hiển thị dạng pill badge nhỏ phía sau nhãn */
  badge?: number | string;
  /** Tông màu của viên thuốc trượt khi tab này đang được chọn */
  activeTone?: SegmentedTabTone;
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedTabsProps<T extends string> {
  items: ReadonlyArray<SegmentedTabItem<NoInfer<T>>>;
  value: T;
  onChange: (value: NoInfer<T>) => void;
  ariaLabel?: string;
  size?: 'xs' | 'sm' | 'md';
  /** Dùng nền card trắng/tối (#fff / #111827) cho thanh tab độc lập như TrashPage */
  surface?: 'muted' | 'card';
  /** Tự giãn đầy chiều ngang container (dùng cho mobile switcher) */
  fullWidth?: boolean;
  /** Nút chỉ có biểu tượng (chuyển Lưới / Bảng) */
  iconOnly?: boolean;
  className?: string;
  /** Tuỳ chọn: ID prefix để đồng bộ aria-controls với panel bên dưới */
  idPrefix?: string;
}

/**
 * SegmentedTabs (Lucian UX/UI Prompt #416 — Jelly-stretching Sliding Pill Tabs)
 * - Viên thuốc nền trượt giãn đàn hồi bất đối xứng (mép dẫn .38s, mép đuôi .62s theo cubic-bezier(.3,1.25,.45,1))
 * - Hỗ trợ đầy đủ bàn phím: ArrowLeft, ArrowRight, Home, End + roving tabIndex
 * - Chống ngắt animation giữa chừng khi parent re-render hoặc ResizeObserver bắn sự kiện thừa
 * - Tôn trọng tuyệt đối prefers-reduced-motion và cặp theme Light/Dark của QK7 DataHub
 */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel = 'Chuyển chế độ hiển thị',
  size = 'sm',
  surface = 'muted',
  fullWidth = false,
  iconOnly = false,
  className = '',
  idPrefix,
}: SegmentedTabsProps<T>) {
  const autoId = useId();
  const uid = idPrefix || `u416-${autoId.replace(/:/g, '')}`;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const prevIndexRef = useRef<number>(-1);
  const activeIndexRef = useRef<number>(0);
  const initializedRef = useRef<boolean>(false);
  const lastCoordsRef = useRef<{ l: number; r: number }>({ l: -1, r: -1 });
  const animatingUntilRef = useRef<number>(0);

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value)
  );
  activeIndexRef.current = activeIndex;

  const activeItem = items[activeIndex];
  const activeTone: SegmentedTabTone = activeItem?.activeTone || 'neutral';

  const measureCoords = useCallback((idx: number) => {
    const track = trackRef.current;
    const btn = tabRefs.current[idx];
    if (!track || !btn) return null;

    const trackWidth = track.clientWidth;
    if (trackWidth <= 0) return null;

    const left = btn.offsetLeft;
    const right = Math.max(0, trackWidth - left - btn.offsetWidth);
    return { l: left, r: right };
  }, []);

  const applyThumbCoords = useCallback(
    (idx: number, dir: number, mode: 'animate' | 'snap' | 'retarget') => {
      const thumb = thumbRef.current;
      const coords = measureCoords(idx);
      if (!thumb || !coords) return;

      const prev = lastCoordsRef.current;
      const unchanged =
        Math.abs(coords.l - prev.l) < 0.5 && Math.abs(coords.r - prev.r) < 0.5;

      // Không động vào DOM nếu vị trí không đổi (tránh cắt ngang transition đang chạy)
      if (unchanged && mode !== 'animate') return;

      if (mode === 'snap') {
        thumb.style.transition = 'none';
        thumb.style.setProperty('--l', `${coords.l}px`);
        thumb.style.setProperty('--r', `${coords.r}px`);
        void thumb.offsetWidth;
        thumb.style.transition = '';
      } else if (mode === 'animate') {
        // Exact Lucian #416 asymmetric jelly-stretch durations
        thumb.style.setProperty('--tl', dir > 0 ? '.62s' : '.38s');
        thumb.style.setProperty('--tr', dir > 0 ? '.38s' : '.62s');
        thumb.style.setProperty('--l', `${coords.l}px`);
        thumb.style.setProperty('--r', `${coords.r}px`);
        animatingUntilRef.current = performance.now() + 680;
      } else {
        // retarget đang trượt mượt: cập nhật tọa độ đích mà KHÔNG tắt transition
        thumb.style.setProperty('--l', `${coords.l}px`);
        thumb.style.setProperty('--r', `${coords.r}px`);
      }

      lastCoordsRef.current = coords;
    },
    [measureCoords]
  );

  // Chạy trượt mượt khi đổi activeIndex; bỏ qua nếu parent chỉ re-render lại mà tọa độ không đổi
  useLayoutEffect(() => {
    const prevIdx = prevIndexRef.current;
    const isInitial = !initializedRef.current || prevIdx === -1;

    if (isInitial) {
      applyThumbCoords(activeIndex, 1, 'snap');
      prevIndexRef.current = activeIndex;
      initializedRef.current = true;
      return;
    }

    if (prevIdx !== activeIndex) {
      const dir = activeIndex > prevIdx ? 1 : -1;
      applyThumbCoords(activeIndex, dir, 'animate');
      prevIndexRef.current = activeIndex;
      return;
    }

    // Cùng activeIndex (vd: số đếm trong label thay đổi): chỉ cập nhật nếu độ rộng thực sự đổi
    const isAnimating = performance.now() < animatingUntilRef.current;
    applyThumbCoords(activeIndex, 1, isAnimating ? 'retarget' : 'snap');
  }, [activeIndex, items, applyThumbCoords]);

  // Chỉ khởi tạo ResizeObserver 1 lần duy nhất (KHÔNG phụ thuộc activeIndex để tránh ngắt transition)
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const syncAfterResize = () => {
      const isAnimating = performance.now() < animatingUntilRef.current;
      applyThumbCoords(activeIndexRef.current, 1, isAnimating ? 'retarget' : 'snap');
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncAfterResize);
      ro.observe(track);
    }

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(syncAfterResize).catch(() => {});
    }

    return () => {
      ro?.disconnect();
    };
  }, [applyThumbCoords]);

  const selectByIndex = (nextIdx: number, focusTab: boolean) => {
    const target = items[nextIdx];
    if (!target || target.disabled) return;
    if (target.value !== value) {
      // Kích hoạt trượt viên thuốc ngay lập tức trước khi parent lọc dữ liệu nặng
      const dir = nextIdx > activeIndex ? 1 : -1;
      applyThumbCoords(nextIdx, dir, 'animate');
      prevIndexRef.current = nextIdx;
      onChange(target.value);
    }
    if (focusTab) {
      tabRefs.current[nextIdx]?.focus({ preventScroll: true });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const n = items.length;
    if (n <= 1) return;

    let step: number | null = null;
    if (e.key === 'ArrowRight') step = 1;
    else if (e.key === 'ArrowLeft') step = -1;
    else if (e.key === 'Home') {
      e.preventDefault();
      const first = items.findIndex((i) => !i.disabled);
      if (first !== -1) selectByIndex(first, true);
      return;
    } else if (e.key === 'End') {
      e.preventDefault();
      for (let k = n - 1; k >= 0; k--) {
        if (!items[k].disabled) {
          selectByIndex(k, true);
          break;
        }
      }
      return;
    }

    if (step === null) return;
    e.preventDefault();

    for (let offset = 1; offset <= n; offset++) {
      const candidate = (activeIndex + step * offset + n) % n;
      if (!items[candidate]?.disabled) {
        selectByIndex(candidate, true);
        break;
      }
    }
  };

  const rootClasses = [
    'u416',
    size === 'md' ? 'u416-md' : size === 'xs' ? 'u416-xs' : 'u416-sm',
    surface === 'card' ? 'u416-surface' : '',
    fullWidth ? 'u416-full' : '',
    iconOnly ? 'u416-icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClasses}>
      <div
        ref={trackRef}
        className="u416-tl"
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
      >
        <span
          ref={thumbRef}
          className="u416-th"
          data-tone={activeTone === 'emerald-text' ? 'neutral' : activeTone}
          aria-hidden="true"
        />

        {items.map((item, idx) => {
          const isSelected = idx === activeIndex;
          const itemTone = item.activeTone || 'neutral';
          return (
            <button
              key={String(item.value)}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`${uid}-t${idx}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-label={item.ariaLabel}
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              title={item.title}
              data-tone={itemTone}
              className="u416-tab"
              onClick={() => selectByIndex(idx, false)}
            >
              {item.icon}
              {item.label !== undefined && <span>{item.label}</span>}
              {typeof item.count === 'number' && (
                <span className="u416-badge">({item.count})</span>
              )}
              {item.badge !== undefined && (
                <span className="u416-pill-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Directional glide wrapper (Lucian #416 panel motion) cho nội dung panel trượt theo hướng chuyển tab
 */
export interface SegmentedGlidePanelProps {
  activeKey: string;
  order: ReadonlyArray<string>;
  children: React.ReactNode;
  className?: string;
}

export const SegmentedGlidePanel: React.FC<SegmentedGlidePanelProps> = ({
  activeKey,
  order,
  children,
  className = '',
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const prevIdxRef = useRef<number>(order.indexOf(activeKey));

  useLayoutEffect(() => {
    const el = panelRef.current;
    const nextIdx = order.indexOf(activeKey);
    const prevIdx = prevIdxRef.current;
    prevIdxRef.current = nextIdx;

    if (!el || prevIdx === -1 || nextIdx === -1 || prevIdx === nextIdx) return;

    const dir = nextIdx > prevIdx ? 1 : -1;
    el.classList.remove('is-on');
    el.style.transition = 'none';
    el.style.setProperty('--d', String(dir));
    void el.offsetWidth;
    el.style.transition = '';
    el.classList.add('is-on');
  }, [activeKey, order]);

  return (
    <div className={`u416 u416-full u416-pv ${className}`}>
      <div ref={panelRef} className="u416-pn is-on" role="tabpanel" tabIndex={0}>
        {children}
      </div>
    </div>
  );
};

export default SegmentedTabs;
