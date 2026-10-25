/* <!-- Lucian UX/UI Prompt #025 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#025 --> */
import React, { useRef, useState, useEffect } from 'react';

export interface NotchedInputProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (val: string) => void;
  icon: React.ReactNode;
  rightElement?: React.ReactNode;
  errorMessage?: string;
  shakeKey?: number;
  isValid?: boolean;
  compact?: boolean;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
}

export const NotchedInput: React.FC<NotchedInputProps> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  icon,
  rightElement,
  errorMessage,
  shakeKey = 0,
  isValid = false,
  compact = false,
  autoComplete,
  required = false,
  autoFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const labelRef = useRef<HTMLLabelElement>(null);
  const [gapWidth, setGapWidth] = useState(0);

  const isUp = isFocused || Boolean(value && value.length > 0);
  const isBad = Boolean(errorMessage);
  const isOk = !isBad && isValid;
  const isShaking = shakeKey > 0;

  // Tính toán tự động độ rộng khe hở --gap theo độ dài thực tế của nhãn Label (scale .8 + 8px thở)
  useEffect(() => {
    if (labelRef.current) {
      const w = labelRef.current.offsetWidth;
      setGapWidth(isUp ? Math.round(w * 0.8 + 8) : 0);
    }
  }, [isUp, label]);

  return (
    <div
      className={`u025-f ${compact ? 'u025-compact' : ''} ${isUp ? 'is-up' : ''} ${
        isFocused ? 'is-focus' : ''
      } ${isBad ? 'is-bad' : ''} ${isOk ? 'is-ok' : ''} ${isShaking ? 'is-shake' : ''}`}
    >
      <div key={shakeKey} className="u025-box">
        {/* Icon đầu dòng (User / Lock) */}
        <div className="u025-icon-left">{icon}</div>

        {/* Ô Input chính */}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          aria-invalid={isBad}
          aria-describedby={isBad ? `${id}-help` : undefined}
          style={{ paddingRight: rightElement ? '72px' : '44px' }}
          className="u025-in"
        />

        {/* Viền 3 phần tự động tách khe hở (Notch Line) */}
        <span
          className="u025-line"
          aria-hidden="true"
          style={{ '--gap': `${gapWidth}px` } as React.CSSProperties}
        >
          <i className="l" />
          <i className="g" />
          <i className="r" />
        </span>

        {/* Floating Label bay vào khe hở khi focus hoặc có dữ liệu */}
        <label ref={labelRef} htmlFor={id} className="u025-lab">
          {label}
        </label>

        {/* Phần tử nút bên phải (nút ẩn/hiện mật khẩu) nằm BÊN TRÁI dấu tích xanh */}
        {rightElement && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-10 flex items-center transition-all duration-200 ease-out"
            style={{ right: isOk ? '42px' : '14px' }}
          >
            {rightElement}
          </div>
        )}

        {/* Dấu tích xanh khi hợp lệ (.u025-ok) nằm BÊN PHẢI (ngoài cùng) */}
        <span
          className="u025-ok"
          aria-hidden="true"
          style={{ right: '14px' }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 8.5l3 3 6-6" />
          </svg>
        </span>
      </div>

      {/* Dòng thông báo lỗi trượt mượt (grid-template-rows: 0fr -> 1fr) */}
      <div id={`${id}-help`} className="u025-help" role="alert" aria-live="polite">
        <span>{errorMessage || ''}</span>
      </div>
    </div>
  );
};
