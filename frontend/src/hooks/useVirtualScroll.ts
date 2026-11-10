import { useState, useEffect, useRef, useMemo, UIEvent } from 'react';

export interface UseVirtualScrollOptions {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
}

/**
 * Hook ảo hóa danh sách / bảng dài (Virtual Scrolling).
 * Đảm bảo chỉ các hàng nằm trong khung nhìn (viewport) của trình duyệt được render ra DOM,
 * giúp loại bỏ giật lag (frame drop) và giảm tối đa gánh nặng bộ nhớ RAM/DOM.
 */
export function useVirtualScroll({
  itemCount,
  itemHeight,
  overscan = 4,
}: UseVirtualScrollOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (el.clientHeight > 0) {
      setContainerHeight(el.clientHeight);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setContainerHeight(entry.contentRect.height);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const { startIndex, endIndex, topSpacer, bottomSpacer } = useMemo(() => {
    if (itemCount === 0) {
      return { startIndex: 0, endIndex: 0, topSpacer: 0, bottomSpacer: 0 };
    }

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2;
    const end = Math.min(itemCount, start + visibleCount);

    const top = start * itemHeight;
    const bottom = Math.max(0, (itemCount - end) * itemHeight);

    return {
      startIndex: start,
      endIndex: end,
      topSpacer: top,
      bottomSpacer: bottom,
    };
  }, [scrollTop, containerHeight, itemCount, itemHeight, overscan]);

  return {
    containerRef,
    onScroll,
    startIndex,
    endIndex,
    topSpacer,
    bottomSpacer,
  };
}

export default useVirtualScroll;

