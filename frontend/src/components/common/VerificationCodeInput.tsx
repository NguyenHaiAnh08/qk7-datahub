// Lucian UX/UI Prompt #406 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#406
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import './VerificationCodeInput.css';

export type VerificationCodeStatus = 'idle' | 'busy' | 'error' | 'success';

export interface VerificationCodeInputHandle {
  focusFirst: () => void;
  blurAll: () => void;
  clear: () => void;
}

export interface VerificationCodeInputProps {
  /** Giá trị 6 chữ số hiện tại */
  value: string;
  /** Trạng thái tương tác của 6 ô: idle | busy (sóng đang xác thực) | error (rung lắc & đỏ) | success (gộp 6 ô thành dấu tích) */
  status?: VerificationCodeStatus;
  /** Tăng mỗi khi cần kích hoạt lại hiệu ứng rung báo lỗi */
  errorTrigger?: number;
  /** Thông báo màn hình đọc cho trình đọc màn hình */
  statusMessage?: string;
  /** Gọi mỗi khi người dùng thay đổi chữ số */
  onChange: (nextValue: string) => void;
  /** Gọi tự động ngay khi nhập hoặc dán đủ 6 chữ số */
  onComplete?: (code: string) => void;
  /** Khóa thao tác ngoài luồng */
  disabled?: boolean;
  /** Tự động focus ô đầu tiên khi mount */
  autoFocus?: boolean;
  /** Nhãn vùng nhập liệu (ARIA) */
  ariaLabel?: string;
  /** Bảo vệ chống browser password manager cache PIN bí mật */
  disablePasswordAutofill?: boolean;
  className?: string;
}

const CODE_LEN = 6;

function stringToSlots(val: string): string[] {
  const digits = String(val || '').replace(/\D/g, '').slice(0, CODE_LEN);
  return Array.from({ length: CODE_LEN }, (_, idx) => digits[idx] || '');
}

export const VerificationCodeInput = React.forwardRef<
  VerificationCodeInputHandle,
  VerificationCodeInputProps
>(
  (
    {
      value,
      status = 'idle',
      errorTrigger = 0,
      statusMessage = '',
      onChange,
      onComplete,
      disabled = false,
      autoFocus = false,
      ariaLabel = 'Mã xác minh 6 chữ số',
      disablePasswordAutofill = false,
      className = '',
    },
    ref
  ) => {
    const [slots, setSlots] = useState<string[]>(() => stringToSlots(value));
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    const [popKeys, setPopKeys] = useState<number[]>([0, 0, 0, 0, 0, 0]);
    const rowRef = useRef<HTMLDivElement | null>(null);
    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
    const lastEmittedRef = useRef<string>(value);

    const isBusy = status === 'busy';
    const isErr = status === 'error';
    const isMerge = status === 'success';
    const isLocked = disabled || isBusy || isMerge;

    const focusSlot = (idx: number) => {
      setActiveIndex(idx);
      if (idx >= 0 && inputRefs.current[idx]) {
        inputRefs.current[idx]?.focus({ preventScroll: true });
      }
    };

    const updateSlots = (nextSlots: string[], popIndices: number[] = []) => {
      setSlots(nextSlots);
      if (popIndices.length > 0) {
        setPopKeys((prev) => {
          const copy = [...prev];
          popIndices.forEach((i) => {
            if (nextSlots[i]) copy[i] = (copy[i] || 0) + 1;
          });
          return copy;
        });
      }
      const joined = nextSlots.join('');
      lastEmittedRef.current = joined;
      onChange(joined);
    };

    useImperativeHandle(ref, () => ({
      focusFirst: () => focusSlot(0),
      blurAll: () => {
        setActiveIndex(-1);
        inputRefs.current.forEach((el) => el?.blur());
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      },
      clear: () => {
        const empty = Array(CODE_LEN).fill('');
        setSlots(empty);
        lastEmittedRef.current = '';
        onChange('');
      },
    }));

    // Đồng bộ khi prop value bị reset hoặc cập nhật từ bên ngoài
    useEffect(() => {
      if (value !== lastEmittedRef.current) {
        const synced = stringToSlots(value);
        setSlots(synced);
        lastEmittedRef.current = value;
      }
    }, [value]);

    // Tự động focus ô 1 khi được yêu cầu
    useEffect(() => {
      if (autoFocus && !isLocked) {
        const t = setTimeout(() => focusSlot(0), 180);
        return () => clearTimeout(t);
      }
    }, [autoFocus]);

    // Kích hoạt lại hoạt ảnh rung ngang (u406-shake) mỗi khi errorTrigger tăng
    useEffect(() => {
      if (errorTrigger <= 0) return;
      const row = rowRef.current;
      if (!row) return;
      row.classList.remove('is-shake');
      void row.offsetWidth;
      row.classList.add('is-shake');
    }, [errorTrigger]);

    // Tự động bỏ highlight ô khi chuyển sang trạng thái bận hoặc đã gộp dấu tích
    useEffect(() => {
      if (isBusy || isMerge) {
        setActiveIndex(-1);
        inputRefs.current.forEach((el) => el?.blur());
      }
    }, [isBusy, isMerge]);

    const fillFrom = (startIdx: number, rawText: string) => {
      if (isLocked) return;
      const ds = String(rawText).replace(/\D/g, '').split('');
      if (!ds.length) return;
      const start = ds.length >= CODE_LEN ? 0 : startIdx;
      const next = [...slots];
      const changed: number[] = [];
      ds.forEach((ch, offset) => {
        if (start + offset < CODE_LEN) {
          next[start + offset] = ch;
          changed.push(start + offset);
        }
      });
      updateSlots(next, changed);

      const firstEmpty = next.indexOf('');
      if (firstEmpty < 0) {
        setActiveIndex(-1);
        inputRefs.current[CODE_LEN - 1]?.blur();
        onComplete?.(next.join(''));
      } else {
        const nextIdx = Math.max(firstEmpty, Math.min(CODE_LEN - 1, start + ds.length));
        focusSlot(nextIdx);
      }
    };

    const handleInput = (idx: number, rawVal: string) => {
      if (isLocked) return;
      const cleaned = rawVal.replace(/\D/g, '');
      const old = slots[idx];
      if (!cleaned) {
        const next = [...slots];
        next[idx] = '';
        updateSlots(next);
        return;
      }
      let add = cleaned;
      if (old && cleaned.length > 1) {
        add =
          cleaned.indexOf(old) === 0
            ? cleaned.slice(old.length)
            : cleaned.slice(0, cleaned.length - old.length) || cleaned;
      }
      fillFrom(idx, add);
    };

    const handlePaste = (idx: number, e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData?.getData('text');
      if (!text) return;
      e.preventDefault();
      if (!isLocked) {
        fillFrom(idx, text);
      }
    };

    const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isLocked) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        const next = [...slots];
        if (next[idx]) {
          next[idx] = '';
          updateSlots(next);
          focusSlot(idx);
        } else if (idx > 0) {
          next[idx - 1] = '';
          updateSlots(next);
          focusSlot(idx - 1);
        }
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        focusSlot(idx - 1);
      } else if (e.key === 'ArrowRight' && idx < CODE_LEN - 1) {
        e.preventDefault();
        focusSlot(idx + 1);
      }
    };

    const rowClasses = [
      'u406-row',
      isErr ? 'is-err' : '',
      isBusy ? 'is-busy' : '',
      isMerge ? 'is-merge' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={`u406 ${className}`}>
        <div className="u406-wrap">
          <div ref={rowRef} className={rowClasses} role="group" aria-label={ariaLabel}>
            {slots.map((digit, k) => {
              const isCur = activeIndex === k && !isLocked;
              const isFill = Boolean(digit);
              return (
                <div
                  key={k}
                  className={`u406-b${isFill ? ' is-fill' : ''}${isCur ? ' is-cur' : ''}`}
                  style={
                    {
                      '--i': k,
                      '--mx': `${(2.5 - k) * 50}px`,
                      '--d': Math.abs(2.5 - k) * 2,
                    } as React.CSSProperties
                  }
                >
                  <input
                    ref={(el) => {
                      inputRefs.current[k] = el;
                    }}
                    type="text"
                    className="u406-in font-mono"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={
                      disablePasswordAutofill
                        ? 'new-password'
                        : k === 0
                        ? 'one-time-code'
                        : 'off'
                    }
                    name={`verification-digit-${k}`}
                    value={digit}
                    disabled={isLocked}
                    aria-label={`Chữ số ${k + 1}`}
                    onFocus={() => {
                      if (!isLocked) setActiveIndex(k);
                    }}
                    onBlur={() => {
                      setActiveIndex((curr) => (curr === k ? -1 : curr));
                    }}
                    onPointerDown={() => {
                      if (!isLocked) setActiveIndex(k);
                    }}
                    onChange={(e) => handleInput(k, e.target.value)}
                    onPaste={(e) => handlePaste(k, e)}
                    onKeyDown={(e) => handleKeyDown(k, e)}
                  />
                  <span
                    key={`g-${k}-${popKeys[k]}`}
                    className={`u406-g font-mono${digit && popKeys[k] > 0 ? ' is-pop' : ''}`}
                    aria-hidden="true"
                  >
                    {digit}
                  </span>
                </div>
              );
            })}
          </div>
          <svg className="u406-ck" viewBox="0 0 60 60" aria-hidden="true">
            <circle cx="30" cy="30" r="30" />
            <path d="M18 30.5l8 8L42.5 22" />
          </svg>
        </div>
        <p className="u406-live" role="status" aria-live="polite">
          {statusMessage ||
            (isMerge
              ? 'Đã xác minh mã thành công'
              : isErr
              ? 'Mã xác minh không chính xác'
              : '')}
        </p>
      </div>
    );
  }
);

VerificationCodeInput.displayName = 'VerificationCodeInput';

export default VerificationCodeInput;
