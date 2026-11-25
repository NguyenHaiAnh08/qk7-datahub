// Lucian UX/UI Prompt #444 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#444
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LectureStatus } from '../../types/lecture';
import './ApprovalStepper.css';

export interface ApprovalStepperProps {
  status: LectureStatus;
  /** Chế độ thu gọn cho thẻ bài giảng (LectureCard); false cho modal chi tiết */
  compact?: boolean;
  /** Hiển thị thanh tiêu đề phía trên ("Tiến trình duyệt 2 tầng: Hoàn tất xuất bản") */
  showHeader?: boolean;
  headerLabel?: string;
  steps?: string[];
  ariaLabel?: string;
  className?: string;
}

const DEFAULT_STEPS = ['Soạn thảo', 'Khoa duyệt', 'BGH duyệt', 'Xuất bản'];

const STEP_TOOLTIPS = [
  'Bước 1: Giảng viên soạn thảo bài giảng',
  'Bước 2: Chỉ huy Khoa/Bộ môn thẩm định và duyệt',
  'Bước 3: Phòng Đào tạo & Ban Giám hiệu phê duyệt',
  'Bước 4: Xuất bản sẵn sàng giảng dạy',
];

function resolveProgress(status: LectureStatus): {
  cur: number;
  errIndex: number | null;
  statusText: string;
  isErr: boolean;
} {
  switch (status) {
    case 'DRAFT':
      return { cur: 0, errIndex: null, statusText: 'Bước 1/4', isErr: false };
    case 'PENDING_FACULTY':
      return { cur: 1, errIndex: null, statusText: 'Bước 2/4', isErr: false };
    case 'PENDING_TRAINING':
      return { cur: 2, errIndex: null, statusText: 'Bước 3/4', isErr: false };
    case 'PUBLISHED':
      return { cur: 4, errIndex: null, statusText: 'Hoàn tất xuất bản', isErr: false };
    case 'REJECTED':
      return { cur: 1, errIndex: 1, statusText: 'Cần hiệu chỉnh', isErr: true };
    case 'DELETED':
      return { cur: 0, errIndex: 0, statusText: 'Đã xóa (Thùng rác)', isErr: true };
    case 'ARCHIVED':
    default:
      return { cur: 4, errIndex: null, statusText: 'Đã lưu trữ', isErr: false };
  }
}

export const ApprovalStepper: React.FC<ApprovalStepperProps> = ({
  status,
  compact = false,
  showHeader = true,
  headerLabel = 'Tiến trình duyệt 2 tầng:',
  steps = DEFAULT_STEPS,
  ariaLabel = 'Tiến trình duyệt bài giảng 2 tầng',
  className = '',
}) => {
  const { cur, errIndex, statusText, isErr } = useMemo(
    () => resolveProgress(status),
    [status]
  );

  // Giữ chỉ số trước đó để tính độ trễ đuổi nhau chuẩn #444 (step = 0.26s) khi trạng thái bài giảng thay đổi
  const prevCurRef = useRef<number>(cur);
  const [fromCur, setFromCur] = useState<number>(cur);
  const [focusedIdx, setFocusedIdx] = useState<number>(() =>
    Math.min(Math.max(0, cur), steps.length - 1)
  );
  const [liveMessage, setLiveMessage] = useState<string>('');
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (prevCurRef.current !== cur) {
      setFromCur(prevCurRef.current);
      prevCurRef.current = cur;
      const clamped = Math.min(Math.max(0, cur), steps.length - 1);
      setFocusedIdx(clamped);
      setLiveMessage(`${steps[clamped]} — ${statusText}`);
    }
  }, [cur, steps, statusText]);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stepDelay = reducedMotion ? 0 : 0.26;
  const totalSteps = steps.length;

  const describeStep = (k: number) => {
    const isStepErr = errIndex === k;
    const done = !isStepErr && k < cur;
    const isCur = !isStepErr && k === cur;
    const stateLabel = isStepErr
      ? 'cần hiệu chỉnh'
      : done
      ? 'đã hoàn tất'
      : isCur
      ? 'đang thực hiện'
      : 'chưa đến';
    return `Bước ${k + 1}: ${steps[k]}, ${stateLabel}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLOListElement>) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const nextIdx = Math.max(0, Math.min(totalSteps - 1, focusedIdx + d));
    setFocusedIdx(nextIdx);
    setLiveMessage(describeStep(nextIdx));
    dotRefs.current[nextIdx]?.focus({ preventScroll: true });
  };

  return (
    <div className={`u444${compact ? ' is-compact' : ''} ${className}`}>
      {showHeader && (
        <div className="u444-head">
          <span className="u444-title">{headerLabel}</span>
          <span className={`u444-status${isErr ? ' is-err' : ''}`}>
            {statusText}
          </span>
        </div>
      )}

      <ol
        className="u444-st"
        aria-label={ariaLabel}
        style={{ '--n': totalSteps } as React.CSSProperties}
        onKeyDown={handleKeyDown}
      >
        {/* Các đoạn nối giữa từng bước — tự động căng đều theo tỉ lệ % (tương thích mọi kích thước thẻ & modal) */}
        {steps.slice(1).map((_, k) => {
          const on = k < cur;
          const lineErr = isErr && errIndex !== null && k === errIndex - 1;
          const delaySec =
            on && k >= fromCur
              ? (k - fromCur) * stepDelay
              : !on && k < fromCur
              ? (fromCur - 1 - k) * stepDelay * 0.6
              : 0;

          return (
            <li
              key={`ln-${k}`}
              className={`u444-ln${on ? ' is-on' : ''}${lineErr ? ' is-err' : ''}`}
              aria-hidden="true"
              style={
                {
                  '--i': k,
                  '--d': `${delaySec.toFixed(2)}s`,
                } as React.CSSProperties
              }
            >
              <i />
            </li>
          );
        })}

        {/* Các nút bước tròn (Checkmark bật nảy khi xong, vòng thở mềm cho bước hiện tại) */}
        {steps.map((label, k) => {
          const isStepErr = errIndex === k;
          const done = !isStepErr && k < cur;
          const isCur = !isStepErr && k === cur;
          const delaySec =
            done && k >= fromCur ? (k - fromCur) * stepDelay + stepDelay : 0;

          const itemCls = [
            'u444-s',
            done ? 'is-done' : '',
            isCur ? 'is-cur' : '',
            isStepErr ? 'is-err' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <li
              key={label}
              className={itemCls}
              aria-current={isCur || isStepErr ? 'step' : undefined}
              style={{ '--d': `${delaySec.toFixed(2)}s` } as React.CSSProperties}
            >
              <button
                ref={(el) => {
                  dotRefs.current[k] = el;
                }}
                type="button"
                className="u444-dot"
                tabIndex={focusedIdx === k ? 0 : -1}
                aria-label={describeStep(k)}
                title={STEP_TOOLTIPS[k] || label}
                style={{ '--d': `${delaySec.toFixed(2)}s` } as React.CSSProperties}
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusedIdx(k);
                  setLiveMessage(describeStep(k));
                }}
              >
                <b>{k + 1}</b>
                <svg className="u444-chk" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5.5 12.5 4 4 9-9.5" />
                </svg>
                {isStepErr && (
                  <svg className="u444-err-ic" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7l10 10M17 7L7 17" />
                  </svg>
                )}
              </button>
              <span aria-hidden="true">{label}</span>
            </li>
          );
        })}
      </ol>

      <p className="u444-live" role="status" aria-live="polite">
        {liveMessage}
      </p>
    </div>
  );
};

export default ApprovalStepper;
