/* Lucian UX/UI Prompt #098 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#098 */

import React, { useState, useEffect, useMemo, useRef } from 'react';

export interface RollingNumberProps {
  value: string | number;
  className?: string;
  rowHeight?: string;
  refreshKey?: number | string;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * RollingNumber (Lucian UX/UI #098 - Odometer Rolling Digits)
 * Features:
 * - Independent rolling digits column (.u098-col) with physics spring curve
 * - Staggered entrance delay: calc(var(--i) * 45ms)
 * - Smart diff rolling: non-digit characters stay static (.u098-sym)
 * - Flexible height via CSS var(--row-h)
 * - Force fresh re-roll when refreshKey changes
 */
export const RollingNumber: React.FC<RollingNumberProps> = ({
  value,
  className = '',
  rowHeight = '1.15em',
  refreshKey,
}) => {
  const [animated, setAnimated] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const isFirstMount = useRef(true);

  const strValue = String(value ?? '');

  // Calculate items and digit indices
  const items = useMemo(() => {
    let digitCounter = 0;
    return strValue.split('').map((char, index) => {
      const isDigit = /\d/.test(char);
      const digitIndex = isDigit ? digitCounter++ : -1;
      return {
        char,
        isDigit,
        targetDigit: isDigit ? Number(char) : 0,
        digitIndex,
        key: `${index}-${char}`,
      };
    });
  }, [strValue]);

  // Handle refresh and initial rolling trigger
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      // Initial mount animation: start at 0 and roll up
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          setAnimated(true);
        });
        return () => cancelAnimationFrame(raf2);
      });
      return () => cancelAnimationFrame(raf1);
    }

    // Refresh trigger
    setIsResetting(true);
    setAnimated(false);

    const raf1 = requestAnimationFrame(() => {
      setIsResetting(false);
      const raf2 = requestAnimationFrame(() => {
        setAnimated(true);
      });
      return () => cancelAnimationFrame(raf2);
    });

    return () => cancelAnimationFrame(raf1);
  }, [refreshKey]);

  return (
    <span
      className={`u098-num ${className}`}
      style={{ '--row-h': rowHeight } as React.CSSProperties}
      data-value={strValue}
    >
      {items.map((item) => {
        if (!item.isDigit) {
          return (
            <span
              key={item.key}
              className="u098-sym"
              style={{ height: rowHeight }}
            >
              {item.char}
            </span>
          );
        }

        const digitValue = animated ? item.targetDigit : 0;

        return (
          <span
            key={item.key}
            className="u098-col"
            style={{
              '--d': digitValue,
              '--i': item.digitIndex,
              '--row-h': rowHeight,
              transition: isResetting
                ? 'none'
                : 'transform 0.9s cubic-bezier(0.3, 1.25, 0.5, 1)',
              transitionDelay: isResetting
                ? '0ms'
                : `calc(${item.digitIndex} * 45ms)`,
            } as React.CSSProperties}
          >
            {DIGITS.map((d) => (
              <span key={d} style={{ height: rowHeight }}>
                {d}
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
};
