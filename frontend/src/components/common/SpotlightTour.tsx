/* <!-- Lucian UX/UI Prompt #197 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#197 --> */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Compass, ChevronRight, ChevronLeft, X, Sparkles, CheckCircle2, Shield } from 'lucide-react';

export interface SpotlightTourStep {
  target: string;
  title: string;
  description: string;
  badge?: string;
  placement?: 'bottom' | 'top' | 'auto';
}

export interface SpotlightTourProps {
  isOpen: boolean;
  onClose: () => void;
  steps?: SpotlightTourStep[];
  storageKey?: string;
}

export const DEFAULT_GUEST_STEPS: SpotlightTourStep[] = [
  {
    target: '#tour-nav-portal',
    title: 'Không gian Dữ liệu số',
    badge: 'Bước 01 / 06 · Điều hướng chính',
    description: 'Khu vực chuyển đổi và tra cứu kho tài nguyên dữ liệu số công khai của Trường Quân sự Quân khu 7 dành cho khách và cán bộ.',
    placement: 'bottom',
  },
  {
    target: '#tour-security-banner',
    title: 'Phạm vi tra cứu tài liệu quân sự',
    badge: 'Bước 02 / 06 · Cấp độ an ninh',
    description: 'Hiển thị cấp độ an ninh hiện tại (Mức 1 - Công khai). Cán bộ có tài khoản có thể bấm "Đăng nhập nâng cấp quyền" để xác thực bảo mật và tra cứu tài liệu nghiệp vụ.',
    placement: 'bottom',
  },
  {
    target: '#tour-filter-bar',
    title: 'Thanh tìm kiếm & Bộ lọc tác chiến',
    badge: 'Bước 03 / 06 · Tra cứu dữ liệu',
    description: 'Hỗ trợ tra cứu tức thời theo số hiệu văn bản, trích yếu nội dung, thể loại văn bản và đơn vị ban hành (TQS, Quân khu 7, Bộ Tổng Tham mưu, Tổng cục Chính trị...).',
    placement: 'bottom',
  },
  {
    target: '#tour-date-range',
    title: 'Bộ lọc khoảng ngày ban hành',
    badge: 'Bước 04 / 06 · Mốc thời gian',
    description: 'Chọn khoảng ngày (Từ ngày - Đến ngày) với lịch tương tác trượt mượt mà, giúp tra cứu chính xác tài liệu quân sự theo từng giai đoạn huấn luyện và công tác.',
    placement: 'bottom',
  },
  {
    target: '#tour-document-card, [data-tour="document-card"], .document-card, tr[data-row-key]:first-child, tbody tr:first-child',
    title: 'Thẻ văn bản quân sự mẫu',
    badge: 'Bước 05 / 06 · Hồ sơ số',
    description: 'Hiển thị thông tin tóm tắt số hiệu, trích yếu, đơn vị ban hành và cấp độ mật. Bạn có thể bấm "Xem văn bản PDF" để đọc trực tiếp hoặc "Tải về" theo đúng phân quyền được cấp.',
    placement: 'top',
  },
  {
    target: '#tour-header-controls, #tour-header-controls-ipad',
    title: 'Cụm công cụ hệ thống',
    badge: 'Bước 06 / 06 · Tiện ích chỉ huy',
    description: 'Kiểm tra trạng thái kết nối mạng LAN nội bộ, chuyển đổi tỉ lệ hiển thị (PC / iPad), bật tắt giao diện Sáng/Tối và quản lý menu phiên tài khoản Khách.',
    placement: 'bottom',
  },
];

export const SpotlightTour: React.FC<SpotlightTourProps> = ({
  isOpen,
  onClose,
  steps = DEFAULT_GUEST_STEPS,
  storageKey = 'qk7_guest_tour_seen',
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const tipRef = useRef<HTMLDivElement>(null);

  // Update target rect with scroll into view
  const updateTargetPosition = useCallback(() => {
    if (!isOpen || steps.length === 0) return;
    const stepData = steps[currentStep];
    if (!stepData) return;

    const el = document.querySelector(stepData.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
    setViewportSize({ w: window.innerWidth, h: window.innerHeight });
  }, [isOpen, steps, currentStep]);

  // When step changes, smooth scroll target into view
  useEffect(() => {
    if (!isOpen) return;

    const stepData = steps[currentStep];
    if (stepData) {
      const el = document.querySelector(stepData.target);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }

    // Delay slightly to let scroll settle then calculate rect
    const timer = setTimeout(() => {
      updateTargetPosition();
    }, 120);

    const raf = requestAnimationFrame(updateTargetPosition);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [isOpen, currentStep, steps, updateTargetPosition]);

  // Global listeners for resize, scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updateTargetPosition();
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize);
    };
  }, [isOpen, updateTargetPosition]);

  // Keyboard navigation: Esc to close, ArrowLeft / ArrowRight to navigate
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleFinish();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentStep, steps.length]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // ignore
    }
    onClose();
  };

  if (!isOpen || steps.length === 0) return null;

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  // SVG Cut-Out Path
  const pad = 8;
  const outer = `M 0 0 H ${viewportSize.w} V ${viewportSize.h} H 0 Z`;
  let cutOutPath = outer;

  let ringStyle: React.CSSProperties = { display: 'none' };

  if (targetRect && targetRect.width > 0 && targetRect.height > 0) {
    const x = Math.max(2, Math.round(targetRect.left - pad));
    const y = Math.max(2, Math.round(targetRect.top - pad));
    const w = Math.min(viewportSize.w - x - 2, Math.round(targetRect.width + pad * 2));
    const h = Math.min(viewportSize.h - y - 2, Math.round(targetRect.height + pad * 2));
    const r = Math.min(14, Math.floor(w / 2), Math.floor(h / 2));

    const inner = `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 -${r} ${r} h -${w - 2 * r} a ${r} ${r} 0 0 1 -${r} -${r} v -${h - 2 * r} a ${r} ${r} 0 0 1 ${r} -${r} Z`;
    cutOutPath = `${outer} ${inner}`;

    ringStyle = {
      display: 'block',
      top: `${y}px`,
      left: `${x}px`,
      width: `${w}px`,
      height: `${h}px`,
    };
  }

  // Calculate Tooltip Coordinates
  const tooltipWidth = Math.min(430, viewportSize.w - 32);
  const estimatedH = 260;
  const tipPad = 14;

  let tipTop = Math.round((viewportSize.h - estimatedH) / 2);
  let tipLeft = Math.round((viewportSize.w - tooltipWidth) / 2);
  let arrowPlacement: 'top' | 'bottom' = 'top';
  let arrowLeft = tooltipWidth / 2;

  if (targetRect && targetRect.width > 0) {
    const targetCX = targetRect.left + targetRect.width / 2;
    const idealLeft = targetCX - tooltipWidth / 2;
    tipLeft = Math.max(16, Math.min(viewportSize.w - tooltipWidth - 16, idealLeft));
    arrowLeft = Math.max(24, Math.min(tooltipWidth - 24, targetCX - tipLeft));

    if (step.placement === 'top') {
      if (targetRect.top - estimatedH - tipPad > 12) {
        tipTop = targetRect.top - estimatedH - tipPad;
        arrowPlacement = 'bottom';
      } else {
        tipTop = targetRect.bottom + tipPad;
        arrowPlacement = 'top';
      }
    } else {
      // placement === 'bottom' or auto
      if (targetRect.bottom + estimatedH + tipPad < viewportSize.h - 12) {
        tipTop = targetRect.bottom + tipPad;
        arrowPlacement = 'top';
      } else if (targetRect.top - estimatedH - tipPad > 12) {
        tipTop = targetRect.top - estimatedH - tipPad;
        arrowPlacement = 'bottom';
      } else {
        tipTop = Math.max(16, Math.round((viewportSize.h - estimatedH) / 2));
      }
    }
  }

  return (
    <div className="u197-overlay fixed inset-0 z-[9990] overflow-hidden select-none" role="dialog" aria-modal="true">
      {/* SVG Dark Backdrop with Spotlight Hole */}
      <svg
        className="u197-svg absolute inset-0 w-full h-full pointer-events-auto"
        onClick={handleNext}
      >
        <path
          fillRule="evenodd"
          d={cutOutPath}
          fill="rgba(15, 23, 42, 0.76)"
          className="transition-all duration-300 ease-out"
        />
      </svg>

      {/* Target Pulsing Highlight Ring */}
      <div className="u197-ring" style={ringStyle} />

      {/* Explanation Bubble (Tooltip) */}
      <div
        ref={tipRef}
        className="u197-tip bg-white/95 dark:bg-[#0f172a]/95 text-slate-900 dark:text-slate-100 border border-amber-500/30 dark:border-amber-400/30 shadow-2xl backdrop-blur-xl"
        style={{
          top: `${tipTop}px`,
          left: `${tipLeft}px`,
          width: `${tooltipWidth}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dynamic Arrow */}
        {targetRect && (
          <div
            className={`u197-arrow ${
              arrowPlacement === 'top' ? 'u197-arrow-top' : 'u197-arrow-bottom'
            } bg-white/95 dark:bg-[#0f172a]/95 border-amber-500/30 dark:border-amber-400/30`}
            style={{ left: `${arrowLeft}px` }}
          />
        )}

        {/* Header: Tactical Badge & Step Counter & Exit */}
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-amber-500/10 dark:bg-amber-400/15 text-amber-700 dark:text-amber-400 border border-amber-500/25">
              <Compass className="w-4 h-4" />
            </span>
            <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              {step.badge || `BƯỚC ${currentStep + 1} / ${steps.length}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
              Esc
            </span>
            <button
              type="button"
              onClick={handleFinish}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              title="Đóng hướng dẫn (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content: Title & Description */}
        <div className="space-y-1.5 mb-5">
          <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span>{step.title}</span>
          </h4>
          <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {step.description}
          </p>
        </div>

        {/* Footer: Progress Dots & Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.08]">
          {/* Step Dots */}
          <div className="flex items-center space-x-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStep(idx)}
                aria-label={`Chuyển đến bước ${idx + 1}`}
                className={`u197-dot cursor-pointer ${
                  idx === currentStep
                    ? 'is-active'
                    : idx < currentStep
                    ? 'bg-amber-600/50 dark:bg-amber-400/40'
                    : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                }`}
              />
            ))}
          </div>

          {/* Action Button Group */}
          <div className="flex items-center space-x-2">
            {!isLast && (
              <button
                type="button"
                onClick={handleFinish}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
              >
                Bỏ qua
              </button>
            )}

            {!isFirst && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trước</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer select-none ${
                isLast
                  ? 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-500 text-white shadow-emerald-950/20 border border-emerald-400/30'
                  : 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white shadow-amber-950/20 border border-amber-300/40'
              }`}
            >
              <span>{isLast ? 'Hoàn thành' : 'Tiếp tục'}</span>
              {isLast ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
