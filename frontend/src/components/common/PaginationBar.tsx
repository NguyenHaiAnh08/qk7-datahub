// Lucian UX/UI Prompt #449 + #043 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#449
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './PaginationBar.css';

export interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
  className?: string;
}

type SlotValue = number | '';

interface SlotAnimState {
  value: SlotValue;
  outgoing: SlotValue | null;
  animKey: number;
  isBack: boolean;
}

function buildWindow(cur: number, total: number): SlotValue[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (cur <= 4) return [1, 2, 3, 4, 5, '', total];
  if (cur >= total - 3) return [1, '', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '', cur - 1, cur, cur + 1, '', total];
}

function findActiveScrollContainer(el: HTMLElement | null): HTMLElement | Window {
  if (typeof window === 'undefined' || !el) return window;
  let parent = el.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      parent.scrollHeight > parent.clientHeight + 1
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  ariaLabel = 'Điều hướng phân trang',
  className = '',
}) => {
  const safeTotal = Math.max(1, Math.floor(totalPages || 1));
  const safeCurrent = Math.min(Math.max(1, Math.floor(currentPage || 1)), safeTotal);

  const windowValues = useMemo(() => buildWindow(safeCurrent, safeTotal), [safeCurrent, safeTotal]);

  const [slotStates, setSlotStates] = useState<SlotAnimState[]>(() =>
    windowValues.map((v) => ({ value: v, outgoing: null, animKey: 0, isBack: false }))
  );
  const [liveMessage, setLiveMessage] = useState<string>('');
  const [isNarrowMobile, setIsNarrowMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 380 : false
  );

  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<{ top: number; expiresAt: number } | null>(null);
  const anchorCleanupRef = useRef<(() => void) | null>(null);
  const prevPageRef = useRef<number>(safeCurrent);
  const prevTotalRef = useRef<number>(safeTotal);
  const prevActiveIdxRef = useRef<number>(Math.max(0, windowValues.indexOf(safeCurrent)));
  const slotsContainerRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Giữ thanh phân trang neo đúng vị trí con trỏ khi chuyển giữa trang ngắn (trang cuối) và trang đầy
  const clearScrollAnchor = useCallback(() => {
    scrollAnchorRef.current = null;
    if (anchorCleanupRef.current) {
      anchorCleanupRef.current();
      anchorCleanupRef.current = null;
    }
  }, []);

  const restoreScrollAnchor = useCallback(() => {
    const anchor = scrollAnchorRef.current;
    const el = rootRef.current;
    if (!anchor || !el || typeof window === 'undefined') return;
    if (Date.now() > anchor.expiresAt) {
      clearScrollAnchor();
      return;
    }

    const currentTop = el.getBoundingClientRect().top;
    const deltaY = currentTop - anchor.top;
    if (Math.abs(deltaY) < 2) return;

    const scrollParent = findActiveScrollContainer(el);
    if (scrollParent === window) {
      const nextY = Math.max(0, window.scrollY + deltaY);
      window.scrollTo({ top: nextY, left: window.scrollX, behavior: 'instant' as ScrollBehavior });
    } else {
      const container = scrollParent as HTMLElement;
      container.scrollTop = Math.max(0, container.scrollTop + deltaY);
    }
  }, [clearScrollAnchor]);

  const activeIndex = Math.max(0, windowValues.indexOf(safeCurrent));
  const needsWideSlot = safeTotal >= 100 && !isNarrowMobile;
  const slotWidthPx = isNarrowMobile ? 28 : needsWideSlot ? 38 : 32;
  const fallbackLeft = activeIndex * (slotWidthPx + 2);
  const fallbackRight = Math.max(0, windowValues.length - 1 - activeIndex) * (slotWidthPx + 2);

  // Đặt tọa độ --l / --r chuẩn #043 (đo DOM thực tế để khít 100% ở mọi mức zoom)
  const placeIndicator = useCallback(
    (idx: number, dir: -1 | 0 | 1) => {
      const container = slotsContainerRef.current;
      const pill = pillRef.current;
      if (!container || !pill) return;

      container.classList.toggle('go-r', dir > 0);
      container.classList.toggle('go-l', dir < 0);

      const btn = btnRefs.current[idx];
      if (btn && container.clientWidth > 0) {
        const l = btn.offsetLeft;
        const r = Math.max(0, container.clientWidth - btn.offsetLeft - btn.offsetWidth);
        pill.style.setProperty('--l', `${l}px`);
        pill.style.setProperty('--r', `${r}px`);
      } else {
        const l = idx * (slotWidthPx + 2);
        const r = Math.max(0, windowValues.length - 1 - idx) * (slotWidthPx + 2);
        pill.style.setProperty('--l', `${l}px`);
        pill.style.setProperty('--r', `${r}px`);
      }
    },
    [slotWidthPx, windowValues.length]
  );

  // Theo dõi màn hình di động siêu hẹp để khớp tọa độ pill với CSS --slot-w
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 380px)');
    const onChange = (e: MediaQueryListEvent) => setIsNarrowMobile(e.matches);
    setIsNarrowMobile(mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  // ResizeObserver chuẩn #043: căn lại pill tức thì khi đổi kích thước không bị kéo giãn thừa
  useEffect(() => {
    const container = slotsContainerRef.current;
    const pill = pillRef.current;
    if (!container || !pill || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => {
      const hadR = container.classList.contains('go-r');
      const hadL = container.classList.contains('go-l');
      container.classList.remove('go-r', 'go-l');
      placeIndicator(prevActiveIdxRef.current, 0);
      void pill.offsetWidth;
      if (hadR) container.classList.add('go-r');
      if (hadL) container.classList.add('go-l');
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [placeIndicator]);

  // Dọn dẹp toàn bộ timeout & scroll anchor khi unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((t) => clearTimeout(t));
      timersRef.current = {};
      clearScrollAnchor();
    };
  }, [clearScrollAnchor]);

  // Đồng bộ neo cuộn ngay trước khi trình duyệt paint khung hình trang mới (chống nhảy lên đầu danh sách)
  useLayoutEffect(() => {
    if (!scrollAnchorRef.current) return;
    restoreScrollAnchor();
    const rafId = window.requestAnimationFrame(() => {
      restoreScrollAnchor();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [safeCurrent, safeTotal, restoreScrollAnchor]);

  // Đồng bộ chuyển động cuộn chữ số (#449) + kéo giãn viên thuốc mép trước (#043)
  useLayoutEffect(() => {
    const prevPage = prevPageRef.current;
    const prevTotal = prevTotalRef.current;
    const prevIdx = prevActiveIdxRef.current;
    const nextWindow = buildWindow(safeCurrent, safeTotal);
    const nextIdx = Math.max(0, nextWindow.indexOf(safeCurrent));

    const totalChanged = prevTotal !== safeTotal;
    const pageChanged = prevPage !== safeCurrent;
    const isBack = safeCurrent < prevPage;

    prevPageRef.current = safeCurrent;
    prevTotalRef.current = safeTotal;
    prevActiveIdxRef.current = nextIdx;

    if (totalChanged) {
      Object.values(timersRef.current).forEach((t) => clearTimeout(t));
      timersRef.current = {};
      setSlotStates(
        nextWindow.map((v) => ({ value: v, outgoing: null, animKey: 0, isBack: false }))
      );
      placeIndicator(nextIdx, 0);
      return;
    }

    if (!pageChanged) {
      // Lần mount đầu tiên hoặc đổi kích thước slot: định vị không giật
      placeIndicator(nextIdx, 0);
      return;
    }

    const dir: -1 | 1 = safeCurrent > prevPage ? 1 : -1;
    const pill = pillRef.current;

    if (nextIdx !== prevIdx) {
      // Nhảy giữa các ô khác nhau: kích hoạt kéo giãn mép trước #043 (go-r / go-l)
      if (pill) pill.classList.remove('is-sq');
      placeIndicator(nextIdx, dir);
    } else {
      // Cửa sổ trượt tại chỗ (ô giữa cuộn số): giữ hiệu ứng nảy đàn hồi gọn gàng
      placeIndicator(nextIdx, 0);
      if (pill) {
        pill.classList.remove('is-sq');
        void pill.offsetWidth;
        pill.classList.add('is-sq');
      }
    }

    setLiveMessage(`Trang ${safeCurrent} / ${safeTotal}`);

    setSlotStates((prev) =>
      nextWindow.map((nextVal, idx) => {
        const oldSlot = prev[idx];
        if (!oldSlot || String(oldSlot.value) === String(nextVal)) {
          return oldSlot || { value: nextVal, outgoing: null, animKey: 0, isBack: false };
        }
        if (timersRef.current[idx]) {
          clearTimeout(timersRef.current[idx]);
        }
        const nextAnimKey = oldSlot.animKey + 1;
        timersRef.current[idx] = setTimeout(() => {
          setSlotStates((curr) =>
            curr.map((s, j) => (j === idx && s.animKey === nextAnimKey ? { ...s, outgoing: null } : s))
          );
          delete timersRef.current[idx];
        }, 320);

        return {
          value: nextVal,
          outgoing: oldSlot.value,
          animKey: nextAnimKey,
          isBack,
        };
      })
    );
  }, [safeCurrent, safeTotal, placeIndicator]);

  const go = (target: number) => {
    const clamped = Math.max(1, Math.min(safeTotal, target));
    if (clamped === safeCurrent) return;

    // Neo tọa độ Y của thanh phân trang trên màn hình trước khi đổi trang
    // (đặc biệt khi từ trang cuối ít dòng quay về trang trước nhiều dòng, tránh bị nhảy lên gần đầu danh sách)
    const el = rootRef.current;
    if (el && typeof window !== 'undefined') {
      clearScrollAnchor();
      scrollAnchorRef.current = {
        top: el.getBoundingClientRect().top,
        expiresAt: Date.now() + 650,
      };

      const onUserScroll = () => clearScrollAnchor();
      window.addEventListener('wheel', onUserScroll, { passive: true, once: true });
      window.addEventListener('touchmove', onUserScroll, { passive: true, once: true });

      let ro: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        const observed =
          el.parentElement?.parentElement || el.parentElement || document.body;
        ro = new ResizeObserver(() => {
          restoreScrollAnchor();
        });
        ro.observe(observed);
      }

      const timeoutId = setTimeout(() => {
        clearScrollAnchor();
      }, 650);

      anchorCleanupRef.current = () => {
        clearTimeout(timeoutId);
        window.removeEventListener('wheel', onUserScroll);
        window.removeEventListener('touchmove', onUserScroll);
        if (ro) ro.disconnect();
      };
    }

    onPageChange(clamped);
  };

  if (safeTotal <= 1) return null;

  return (
    <div
      ref={rootRef}
      className={`u449 ${className}`}
      style={
        needsWideSlot
          ? ({ '--slot-w': `${slotWidthPx}px` } as React.CSSProperties)
          : undefined
      }
    >
      <nav
        className="u449-nav"
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            go(safeCurrent - 1);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            go(safeCurrent + 1);
          }
        }}
      >
        <button
          type="button"
          className="u449-ar u449-pv"
          aria-label="Trang trước"
          title="Trang trước"
          disabled={safeCurrent <= 1}
          onClick={() => go(safeCurrent - 1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
        </button>

        <div
          ref={slotsContainerRef}
          className="u449-sl"
          style={{ '--slots': windowValues.length } as React.CSSProperties}
        >
          <span
            ref={pillRef}
            className="u449-pill"
            aria-hidden="true"
            style={
              {
                '--l': `${fallbackLeft}px`,
                '--r': `${fallbackRight}px`,
              } as React.CSSProperties
            }
          />

          {windowValues.map((val, idx) => {
            const slot = slotStates[idx] || { value: val, outgoing: null, animKey: 0, isBack: false };
            const isDots = val === '';
            const isCurrent = val === safeCurrent;
            const currentTxt = isDots ? '…' : String(val);
            const outgoingTxt = slot.outgoing === '' ? '…' : slot.outgoing !== null ? String(slot.outgoing) : null;

            return (
              <button
                key={idx}
                ref={(el) => {
                  btnRefs.current[idx] = el;
                }}
                type="button"
                className={`u449-n${isDots ? ' is-dots' : ''}${slot.isBack ? ' is-back' : ''}`}
                aria-hidden={isDots ? 'true' : undefined}
                tabIndex={isDots ? -1 : 0}
                aria-label={isDots ? undefined : `Trang ${val}`}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => {
                  if (!isDots && typeof val === 'number') go(val);
                }}
              >
                {outgoingTxt !== null && (
                  <span key={`out-${slot.animKey}`} className="is-out" aria-hidden="true">
                    {outgoingTxt}
                  </span>
                )}
                <span
                  key={`in-${slot.animKey}`}
                  className={slot.animKey > 0 ? 'is-in' : undefined}
                >
                  {currentTxt}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="u449-ar u449-nx"
          aria-label="Trang sau"
          title="Trang sau"
          disabled={safeCurrent >= safeTotal}
          onClick={() => go(safeCurrent + 1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </button>
      </nav>
      <p className="u449-live" role="status" aria-live="polite">
        {liveMessage}
      </p>
    </div>
  );
};

export default PaginationBar;
