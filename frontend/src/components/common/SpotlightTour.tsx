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
    target: '#tour-nav-brand, #tour-nav-brand-pc, a[href="/"]',
    title: 'Trung tâm Dữ liệu số Trường Quân sự Quân khu 7',
    badge: 'Bước 01 / 13 · Giới thiệu Hệ thống',
    description: 'Chào mừng đồng chí đại biểu và cán bộ đến với nền tảng quản trị, lưu trữ và khai thác dữ liệu số chuẩn Quân sự. Hệ thống tích hợp toàn diện Kho văn bản số, Bài giảng số điện tử, Trợ lý AI RAG và xác thực sinh trắc học vân tay 2FA.',
    placement: 'bottom',
  },
  {
    target: '#tour-nav-portal',
    title: 'Phân hệ Văn bản số',
    badge: 'Bước 02 / 13 · Không gian Văn bản số',
    description: 'Khu vực quản lý và tra cứu toàn bộ văn kiện, chỉ thị, nghị quyết, thông tư, kế hoạch huấn luyện và quy phạm quân sự của Nhà trường và Quân khu 7. Dành riêng cho cán bộ tra cứu nhanh chóng, chính xác theo đúng thẩm quyền bảo mật.',
    placement: 'bottom',
  },
  {
    target: '#tour-nav-lectures',
    title: 'Phân hệ Bài giảng số & Giáo trình điện tử',
    badge: 'Bước 03 / 13 · Phân hệ Bài giảng số',
    description: 'Nền tảng đào tạo trực tuyến hiện đại: tích hợp kho bài giảng điện tử chuẩn SCORM tương tác, bài giảng PDF/Video và mô phỏng lớp học thông minh. Đại biểu được quyền xem toàn bộ bài giảng đã xuất bản ở cấp độ Công khai.',
    placement: 'bottom',
  },
  {
    target: '#tour-security-banner',
    title: 'Phạm vi an ninh & 5 Cấp độ mật quân sự',
    badge: 'Bước 04 / 13 · Cấp độ an ninh',
    description: 'Hệ thống phân cấp nghiêm ngặt: Cấp 1 Công khai, Cấp 2 Nội bộ, Cấp 3 Mật, Cấp 4 Tối Mật, Cấp 5 Tuyệt Mật. Phiên Đại biểu được cấp quyền khai thác Cấp 1 (Công khai). Mọi tài liệu từ Cấp 3 trở lên bắt buộc phải xác thực vân tay 2FA qua thiết bị ZKTeco.',
    placement: 'bottom',
  },
  {
    target: '#tour-kpi-cards',
    title: 'Bảng chỉ huy Telemetry toàn trường',
    badge: 'Bước 05 / 13 · Chỉ số Telemetry',
    description: '4 thẻ giám sát số hóa thời gian thực: Tổng số văn bản toàn trường, Tiến độ số hóa của 18 cơ quan/phòng ban/tiểu đoàn/khoa giáo viên trực thuộc, Tỷ lệ tài liệu khả dụng theo quyền và Tình trạng chuẩn hóa phân bổ tài liệu.',
    placement: 'bottom',
  },
  {
    target: '#tour-department-radar',
    title: 'Tiến độ số hóa & Phân bổ theo Đơn vị',
    badge: 'Bước 06 / 13 · Radar đơn vị',
    description: 'Radar theo dõi trực quan khối lượng số hóa của từng đơn vị cha: Phòng Chính trị, Ban Giám hiệu, Phòng Tham mưu - Hành chính, Phòng Đào tạo, các Tiểu đoàn, Khoa giáo viên... Nhấn vào bất kỳ đơn vị nào để lọc nhanh tài liệu của đơn vị đó.',
    placement: 'top',
  },
  {
    target: '#tour-document-breakdown',
    title: 'Cơ cấu văn bản theo Thể loại & Độ mật',
    badge: 'Bước 07 / 13 · Thống kê phân loại',
    description: 'Phân loại trực quan tài liệu theo các thể loại hành chính quân sự (Báo cáo, Biên bản, Chỉ thị, Công văn, Kế hoạch, Quyết định...) và tỷ trọng phân bổ theo từng cấp độ mật quân sự giúp chỉ huy nắm bắt tổng thể kho tài nguyên số.',
    placement: 'top',
  },
  {
    target: '#tour-filter-bar',
    title: 'Thanh tìm kiếm & Bộ lọc dữ liệu đa chiều',
    badge: 'Bước 08 / 13 · Tra cứu tác chiến',
    description: 'Tìm kiếm tức thì 0ms theo Số hiệu văn bản, Trích yếu nội dung, Người ký hoặc Đơn vị ban hành. Hỗ trợ lọc kết hợp linh hoạt theo Thể loại văn bản và Cơ quan ban hành (TQS, Quân khu 7, Bộ Quốc phòng...).',
    placement: 'bottom',
  },
  {
    target: '#tour-date-range',
    title: 'Bộ lọc khoảng ngày ban hành',
    badge: 'Bước 09 / 13 · Mốc thời gian',
    description: 'Chọn khoảng ngày ban hành (Từ ngày - Đến ngày) với giao diện lịch tương tác tiện lợi, giúp khoanh vùng chính xác tài liệu quân sự theo từng giai đoạn huấn luyện, diễn tập hoặc niên độ công tác.',
    placement: 'bottom',
  },
  {
    target: '#tour-document-list, #tour-document-card, [data-tour="document-card"], .document-card, tr[data-row-key]:first-child, tbody tr:first-child',
    title: 'Danh sách văn bản quân sự & Trình đọc PDF an toàn',
    badge: 'Bước 10 / 13 · Hồ sơ số & PDF',
    description: 'Mỗi văn bản hiển thị đầy đủ Số hiệu, Trích yếu, Đơn vị, Ngày ban hành và Huy hiệu độ mật. Bạn có thể bấm "Xem chi tiết" để mở trình đọc PDF trực tuyến có chèn dấu Watermark an ninh chống sao chép và tải file theo đúng quyền.',
    placement: 'top',
  },
  {
    target: '#tour-device-switch, #tour-header-controls-ipad',
    title: 'Chuyển đổi giao diện Dual-Platform (PC & iPad M4)',
    badge: 'Bước 11 / 13 · Chế độ thiết bị',
    description: 'Tùy biến hiển thị tối ưu cho 2 nền tảng: Chế độ Desktop PC (chuột/bàn phím, độ trễ 0ms) và Chế độ iPad Touch UI (nút bấm to, thao tác cảm ứng vuốt chạm thuận tiện cho sĩ quan chỉ huy khi đi cơ động hoặc kiểm tra giảng đường).',
    placement: 'bottom',
  },
  {
    target: '#tour-header-controls',
    title: 'Trợ lý AI RAG & Công cụ chỉ huy',
    badge: 'Bước 12 / 13 · Tiện ích chỉ huy',
    description: 'Trợ lý AI tích hợp sẵn hỗ trợ hỏi đáp, tra cứu văn kiện và tự động trích dẫn số trang chính xác. Cùng nút bật/tắt Giao diện Sáng (chống chói ban ngày) và Giao diện Tối (bảo vệ mắt trong ca trực đêm), cùng giám sát mạng LAN nội bộ.',
    placement: 'bottom',
  },
  {
    target: '#tour-upgrade-btn',
    title: 'Đăng nhập nâng cấp quyền cán bộ sĩ quan',
    badge: 'Bước 13 / 13 · Nâng cấp quyền hạn',
    description: 'Khi cán bộ, giảng viên của Trường hoặc các đơn vị cần thực hiện nhiệm vụ nghiệp vụ (soạn thảo bài giảng, đăng tải văn bản, duyệt văn bản, mở ca giảng dạy), bấm nút này để đăng nhập tài khoản chính thức và xác thực vân tay 2FA.',
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

  // Scroll smoothly to target element both horizontally and vertically with sticky header clearance
  const scrollTargetIntoView = useCallback((el: Element, placement?: string) => {
    // 1. Kéo mượt thanh cuộn ngang của các thẻ cha (ví dụ thanh MainNavBar hoặc bảng rộng)
    let parent = el.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const style = window.getComputedStyle(parent);
      const ox = style.overflowX;
      if ((ox === 'auto' || ox === 'scroll') && parent.scrollWidth > parent.clientWidth) {
        const pRect = parent.getBoundingClientRect();
        const cRect = el.getBoundingClientRect();
        const offsetLeft = cRect.left - pRect.left + parent.scrollLeft;
        const targetScrollLeft = offsetLeft - (parent.clientWidth - cRect.width) / 2;
        parent.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' });
      }
      parent = parent.parentElement;
    }

    // 2. Tự động kéo cuộn trang dọc và ngang
    const isHeaderOrNav = !!el.closest('header, nav');
    if (isHeaderOrNav) {
      // Nút thuộc Header hoặc Navbar -> đưa trang về đỉnh (top = 0)
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const headerHeight = 115; // Chiều cao Header (64px) + MainNavBar (44px) + đệm an toàn
      const rect = el.getBoundingClientRect();
      const docTop = window.scrollY + rect.top;
      const docLeft = window.scrollX + rect.left;
      const visibleH = window.innerHeight - headerHeight;

      let targetY: number;
      if (placement === 'bottom') {
        // Đặt phần tử ở khoảng 1/3 phía trên vùng nhìn thấy để chừa không gian rộng rãi cho thẻ hướng dẫn bên dưới
        targetY = Math.max(0, docTop - headerHeight - 40);
      } else if (placement === 'top') {
        // Đặt phần tử ở khoảng dưới để thẻ hướng dẫn nổi phía trên
        targetY = Math.max(0, docTop - headerHeight - (visibleH - rect.height) + 50);
      } else {
        // Căn giữa vào khoảng giữa màn hình
        targetY = Math.max(0, docTop - headerHeight - (visibleH - rect.height) / 2);
      }

      const targetX = Math.max(0, docLeft - (window.innerWidth - rect.width) / 2);
      window.scrollTo({ top: targetY, left: targetX, behavior: 'smooth' });
    }
  }, []);

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

  // When step changes, smooth scroll target into view with continuous animation tracking
  useEffect(() => {
    if (!isOpen) return;

    const stepData = steps[currentStep];
    if (stepData) {
      const el = document.querySelector(stepData.target);
      if (el) {
        scrollTargetIntoView(el, stepData.placement);
      }
    }

    // Theo dõi liên tục từng frame trong 850ms của animation cuộn trang
    const animStart = performance.now();
    let rafId: number;
    const stepTrack = () => {
      updateTargetPosition();
      if (performance.now() - animStart < 850) {
        rafId = requestAnimationFrame(stepTrack);
      }
    };
    rafId = requestAnimationFrame(stepTrack);

    const t1 = setTimeout(updateTargetPosition, 100);
    const t2 = setTimeout(updateTargetPosition, 350);
    const t3 = setTimeout(updateTargetPosition, 850);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isOpen, currentStep, steps, updateTargetPosition, scrollTargetIntoView]);

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

    const spaceAbove = targetRect.top - 115; // Khoảng trống phía trên tính từ chân Sticky Header
    const spaceBelow = viewportSize.h - targetRect.bottom; // Khoảng trống phía dưới tính tới đáy màn hình

    if (step.placement === 'top') {
      if (spaceAbove > estimatedH + tipPad) {
        tipTop = targetRect.top - estimatedH - tipPad;
        arrowPlacement = 'bottom';
      } else {
        tipTop = targetRect.bottom + tipPad;
        arrowPlacement = 'top';
      }
    } else {
      // placement === 'bottom' hoặc auto
      if (spaceBelow > estimatedH + tipPad) {
        tipTop = targetRect.bottom + tipPad;
        arrowPlacement = 'top';
      } else if (spaceAbove > estimatedH + tipPad) {
        tipTop = targetRect.top - estimatedH - tipPad;
        arrowPlacement = 'bottom';
      } else {
        tipTop = targetRect.bottom + tipPad;
        arrowPlacement = 'top';
      }
    }

    // Luôn khóa thẻ hướng dẫn hiển thị trọn vẹn, không lọt vào thanh header và không tràn đáy
    tipTop = Math.max(115, Math.min(viewportSize.h - estimatedH - 16, tipTop));
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
