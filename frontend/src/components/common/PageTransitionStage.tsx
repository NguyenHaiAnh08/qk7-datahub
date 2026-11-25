// Lucian UX/UI Prompt #043 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#043
import React, { useLayoutEffect, useRef } from 'react';
import './PageTransitionStage.css';

export interface UsePageTransitionOptions {
  /** Số cột trên lưới để tính độ trễ đuổi nhau theo chiều ngang (mặc định 3 cho lưới card, 1 cho bảng) */
  cols?: number;
  /** 'grid' cho lưới thẻ (dịch chuyển ±26px + scale .92), 'row' cho hàng bảng (dịch chuyển ±18px) */
  mode?: 'grid' | 'row';
  /** Selector tùy chọn cho phần tử con (ví dụ '.ant-table-tbody > tr.ant-table-row') */
  itemSelector?: string;
}

const activeAnimations = new WeakMap<Element, Animation>();

/**
 * Hook tạo hiệu ứng chuyển trang đuổi nhau theo hướng di chuyển (Lucian #043).
 * Gắn trực tiếp ref vào <tbody> hoặc lưới <div> để không làm thay đổi cấu trúc DOM/bảng.
 */
export function usePageTransition<T extends HTMLElement = HTMLDivElement>(
  page: number,
  options?: UsePageTransitionOptions
) {
  const ref = useRef<T | null>(null);
  const prevPageRef = useRef<number>(page);
  const cols = options?.cols ?? 1;
  const mode = options?.mode ?? (cols > 1 ? 'grid' : 'row');
  const itemSelector = options?.itemSelector;

  useLayoutEffect(() => {
    const prevPage = prevPageRef.current;
    if (prevPage === page) return;

    const dir = page > prevPage ? 1 : -1;
    prevPageRef.current = page;

    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const container = ref.current;
    if (!container) return;

    const nodes: Element[] = itemSelector
      ? Array.from(container.querySelectorAll(itemSelector))
      : Array.from(container.children);

    if (nodes.length === 0) return;

    // Bỏ qua nếu chỉ có 1 hàng thông báo rỗng / đang tải (colSpan)
    if (
      nodes.length === 1 &&
      nodes[0].tagName === 'TR' &&
      nodes[0].querySelector('td[colspan]')
    ) {
      return;
    }

    const capped = nodes.slice(0, 30);

    capped.forEach((node, k) => {
      if (typeof (node as HTMLElement).animate !== 'function') return;

      const prevAnim = activeAnimations.get(node);
      if (prevAnim) {
        prevAnim.cancel();
      }

      const delay =
        mode === 'grid' && cols > 1
          ? (dir > 0 ? k % cols : cols - 1 - (k % cols)) * 40 +
            Math.min(Math.floor(k / cols), 4) * 30
          : Math.min(k, 10) * 28;

      const keyframes: Keyframe[] =
        mode === 'grid'
          ? [
              { opacity: 0, transform: `translateX(${dir * 26}px) scale(.92)` },
              { opacity: 1, transform: 'none' },
            ]
          : [
              { opacity: 0, transform: `translateX(${dir * 18}px)` },
              { opacity: 1, transform: 'none' },
            ];

      const anim = (node as HTMLElement).animate(keyframes, {
        duration: mode === 'grid' ? 480 : 420,
        delay,
        easing: 'cubic-bezier(.34, 1.4, .64, 1)',
        fill: 'backwards',
      });

      activeAnimations.set(node, anim);
    });
  }, [page, cols, mode, itemSelector]);

  return ref;
}

export interface PageTransitionStageProps {
  page: number;
  cols?: number;
  mode?: 'grid' | 'row';
  className?: string;
  children: React.ReactNode;
}

export const PageTransitionStage: React.FC<PageTransitionStageProps> = ({
  page,
  cols = 3,
  mode = 'grid',
  className = '',
  children,
}) => {
  const ref = usePageTransition<HTMLDivElement>(page, { cols, mode });
  return (
    <div ref={ref} className={`u043 ${className}`}>
      {children}
    </div>
  );
};

export default PageTransitionStage;
