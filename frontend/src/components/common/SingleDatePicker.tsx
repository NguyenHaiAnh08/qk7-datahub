/* <!-- QK7 DataHub · Single Date Picker with iOS-style Dual Wheel Month/Year Selector -->
 * Harmonized with DateRangePicker (#030) & DESIGN.md Military Triad Color System:
 * - Light Primary: #166534 | Dark Primary: #10b981
 * - Today Accent: Amber #d97706 / #fbbf24
 * - Vietnamese Labels & Numeric Dates: Be Vietnam Pro (tabular-nums lining-nums)
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  RotateCcw,
} from 'lucide-react';

export interface SingleDatePickerProps {
  value?: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_FULL_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const WHEEL_ITEM_HEIGHT = 40;
const WHEEL_VISIBLE_ROWS = 5;
const WHEEL_SPACER = WHEEL_ITEM_HEIGHT * Math.floor(WHEEL_VISIBLE_ROWS / 2); // 80px

function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function parseISODate(iso?: string | null): Date | null {
  if (!iso) return null;
  const clean = iso.split('T')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const date = new Date(y, m, d);
  return isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(iso?: string | null): string {
  if (!iso) return '';
  const clean = iso.split('T')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatFullDateVi(iso?: string | null): string {
  const d = parseISODate(iso);
  if (!d) return 'Chưa chọn ngày';
  return `${WEEKDAY_FULL_VI[d.getDay()]}, ${formatDisplayDate(iso)}`;
}

// =========================================================================
// iOS-Style Scroll Wheel Column (Cuộn bánh xe chọn Tháng / Năm chuẩn iPhone)
// =========================================================================
interface WheelColumnProps<T extends number> {
  items: T[];
  value: T;
  onChange: (val: T) => void;
  renderLabel: (val: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  ariaLabel: string;
}

function WheelColumn<T extends number>({
  items,
  value,
  onChange,
  renderLabel,
  align = 'center',
  ariaLabel,
}: WheelColumnProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammaticRef = useRef(false);
  const activeIdx = Math.max(0, items.indexOf(value));
  const [visualFloatIdx, setVisualFloatIdx] = useState<number>(activeIdx);

  // Định vị ban đầu tức thì tới giá trị hiện tại khi mở chế độ Wheel
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const targetTop = activeIdx * WHEEL_ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - targetTop) > 1) {
      isProgrammaticRef.current = true;
      el.scrollTop = targetTop;
      setVisualFloatIdx(activeIdx);
      requestAnimationFrame(() => {
        isProgrammaticRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đồng bộ nếu value đổi từ bên ngoài (vd bấm Hôm nay)
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const targetTop = activeIdx * WHEEL_ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - targetTop) > WHEEL_ITEM_HEIGHT * 0.45) {
      isProgrammaticRef.current = true;
      el.scrollTo({ top: targetTop, behavior: 'smooth' });
      setVisualFloatIdx(activeIdx);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticRef.current = false;
      }, 260);
    }
  }, [activeIdx]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const floatIdx = el.scrollTop / WHEEL_ITEM_HEIGHT;
    setVisualFloatIdx(floatIdx);

    if (isProgrammaticRef.current) return;

    const nearest = Math.min(items.length - 1, Math.max(0, Math.round(floatIdx)));
    if (items[nearest] !== value) {
      onChange(items[nearest]);
    }

    // Tự căn khít nhẹ sau khi dừng cuộn
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      if (!listRef.current) return;
      const snappedIdx = Math.min(
        items.length - 1,
        Math.max(0, Math.round(listRef.current.scrollTop / WHEEL_ITEM_HEIGHT))
      );
      const exactTop = snappedIdx * WHEEL_ITEM_HEIGHT;
      if (Math.abs(listRef.current.scrollTop - exactTop) > 1) {
        listRef.current.scrollTo({ top: exactTop, behavior: 'smooth' });
      }
      if (items[snappedIdx] !== value) {
        onChange(items[snappedIdx]);
      }
    }, 110);
  };

  const handleItemClick = (idx: number) => {
    const el = listRef.current;
    onChange(items[idx]);
    setVisualFloatIdx(idx);
    if (el) {
      isProgrammaticRef.current = true;
      el.scrollTo({ top: idx * WHEEL_ITEM_HEIGHT, behavior: 'smooth' });
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticRef.current = false;
      }, 260);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeIdx > 0) handleItemClick(activeIdx - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeIdx < items.length - 1) handleItemClick(activeIdx + 1);
    }
  };

  const alignClass =
    align === 'right' ? 'justify-end pr-4' : align === 'left' ? 'justify-start pl-4' : 'justify-center';

  return (
    <div
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-label={ariaLabel}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      className="relative flex-1 h-[200px] overflow-y-auto no-scrollbar focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/40 rounded-lg"
      style={{
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        perspective: '520px',
      }}
    >
      {/* Top spacer để phần tử đầu tiên nằm chính giữa vòng chọn */}
      <div style={{ height: WHEEL_SPACER }} aria-hidden="true" />

      {items.map((item, idx) => {
        const dist = idx - visualFloatIdx;
        const absDist = Math.abs(dist);
        const isCenter = absDist < 0.45;
        const opacity = absDist > 2.6 ? 0.1 : Math.max(0.14, 1 - absDist * 0.32);
        const scale = Math.max(0.82, 1 - absDist * 0.065);
        const rotateX = Math.max(-42, Math.min(42, dist * -18));

        return (
          <button
            key={item}
            type="button"
            role="option"
            aria-selected={item === value}
            onClick={() => handleItemClick(idx)}
            className={`w-full flex items-center ${alignClass} cursor-pointer select-none transition-colors duration-100 ${
              isCenter
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-white'
            }`}
            style={{
              height: WHEEL_ITEM_HEIGHT,
              scrollSnapAlign: 'center',
              opacity,
              transform: `scale(${scale}) rotateX(${rotateX}deg)`,
              transformOrigin: 'center center',
            }}
          >
            {renderLabel(item)}
          </button>
        );
      })}

      {/* Bottom spacer để phần tử cuối cùng nằm chính giữa vòng chọn */}
      <div style={{ height: WHEEL_SPACER }} aria-hidden="true" />
    </div>
  );
}

// =========================================================================
// Main SingleDatePicker Component
// =========================================================================
export const SingleDatePicker: React.FC<SingleDatePickerProps> = ({
  value = '',
  onChange,
  placeholder = 'Chọn ngày ban hành',
  minYear = 1950,
  maxYear = 2050,
  disabled = false,
  className = '',
  id,
  ariaLabel = 'Chọn ngày ban hành',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'calendar' | 'wheel'>('calendar');
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' }>({
    top: 0,
    left: 0,
    placement: 'bottom',
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Ngày đang chọn tạm thời trong popover trước khi bấm "Áp dụng"
  const [tempDate, setTempDate] = useState<string>(value);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = parseISODate(value) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [slideActive, setSlideActive] = useState(false);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = minYear; y <= maxYear; y++) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  // Đồng bộ giá trị khi mở popover (không ghi đè viewMonth khi đang tương tác bên trong)
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const cleanVal = value ? value.split('T')[0] : '';
      setTempDate(cleanVal);
      setPickerMode('calendar');
      const d = parseISODate(cleanVal) || new Date();
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, value]);

  // Tính tọa độ Portal thông minh (tự động lật lên trên nếu sát đáy màn hình)
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;
    const rect = trigger.getBoundingClientRect();
    const popWidth = Math.min(336, window.innerWidth - 24);
    const estHeight = 398;
    const margin = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placement: 'top' | 'bottom' =
      spaceBelow >= estHeight + margin || spaceBelow >= spaceAbove ? 'bottom' : 'top';

    let top =
      placement === 'bottom'
        ? rect.bottom + margin
        : Math.max(12, rect.top - estHeight - margin);

    if (placement === 'bottom' && top + estHeight > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - estHeight - 12);
    }

    let left = rect.left;
    if (left + popWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popWidth - 12);
    }
    if (left < 12) left = 12;

    setPopoverCoords({ top, left, placement });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleReposition = () => updatePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, updatePosition]);

  // Đóng popover khi click ngoài hoặc bấm Escape (capture phase để không đóng luôn Modal cha)
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (pickerMode === 'wheel') {
          setPickerMode('calendar');
        } else {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, pickerMode]);

  // Điều hướng trượt tháng mượt mà chuẩn #030
  const changeMonth = useCallback((delta: number) => {
    setSlideDirection(delta > 0 ? 'left' : 'right');
    setSlideActive(false);

    setTimeout(() => {
      setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
      setSlideActive(true);
      setTimeout(() => {
        setSlideDirection(null);
        setSlideActive(false);
      }, 420);
    }, 20);
  }, []);

  // Thay đổi tháng / năm từ iPhone Wheel Picker
  const handleWheelMonthChange = useCallback((newMonthOneBased: number) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), newMonthOneBased - 1, 1));
  }, []);

  const handleWheelYearChange = useCallback((newYear: number) => {
    setViewMonth((prev) => new Date(newYear, prev.getMonth(), 1));
  }, []);

  // Chọn duy nhất 1 ngày
  const handleDayClick = (iso: string) => {
    setTempDate(iso);
    const clicked = parseISODate(iso);
    if (
      clicked &&
      (clicked.getFullYear() !== viewMonth.getFullYear() ||
        clicked.getMonth() !== viewMonth.getMonth())
    ) {
      setViewMonth(new Date(clicked.getFullYear(), clicked.getMonth(), 1));
    }
  };

  // Double-click để chọn & áp dụng ngay
  const handleDayDoubleClick = (iso: string) => {
    setTempDate(iso);
    onChange(iso);
    setIsOpen(false);
  };

  // Chọn nhanh "Hôm nay"
  const handleSelectToday = () => {
    const today = new Date();
    const todayISO = toISODate(today);
    setTempDate(todayISO);
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setPickerMode('calendar');
  };

  // Đặt lại ngày đang chọn bên trong popover (GIỮ MỞ khung lịch để người dùng chọn ngày khác)
  const handleResetDraft = () => {
    setTempDate('');
    if (value) {
      onChange('');
    }
  };

  // Xóa nhanh từ nút X trên ô input
  const handleQuickClear = () => {
    setTempDate('');
    onChange('');
    setIsOpen(false);
  };

  // Áp dụng ngày đã chọn
  const handleApply = () => {
    if (pickerMode === 'wheel') {
      // Đang ở chế độ xoay bánh xe Tháng/Năm -> quay về lưới ngày của Tháng/Năm đó để chọn ngày
      setPickerMode('calendar');
      return;
    }
    if (tempDate) {
      onChange(tempDate);
    }
    setIsOpen(false);
  };

  // Lưới 42 ô lịch (T2 → CN)
  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let firstDayIndex = firstDayOfMonth.getDay() - 1;
    if (firstDayIndex === -1) firstDayIndex = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const todayISO = toISODate(new Date());

    const cells: Array<{
      iso: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const iso = toISODate(d);
      cells.push({ iso, dayNumber: prevMonthLastDay - i, isCurrentMonth: false, isToday: iso === todayISO });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const iso = toISODate(d);
      cells.push({ iso, dayNumber: i, isCurrentMonth: true, isToday: iso === todayISO });
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const iso = toISODate(d);
      cells.push({ iso, dayNumber: i, isCurrentMonth: false, isToday: iso === todayISO });
    }
    return cells;
  }, [viewMonth]);

  const hasValue = Boolean(value && value.trim());
  const displayValue = hasValue ? formatDisplayDate(value) : '';
  const currentViewMonthNum = viewMonth.getMonth() + 1;
  const currentViewYearNum = viewMonth.getFullYear();

  const popoverNode =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              top: popoverCoords.top,
              left: popoverCoords.left,
              width: 'min(336px, calc(100vw - 24px))',
              zIndex: 120,
            }}
            className="p-4 rounded-2xl bg-white/98 dark:bg-slate-900/98 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-slate-100 select-none animate-in fade-in zoom-in-95 duration-150"
          >
            {/* ── 1. HEADER SUMMARY CARD (CHỌN DUY NHẤT 1 NGÀY + HÔM NAY) ── */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 mb-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-sans">
                  Ngày ban hành
                </div>
                <div
                  className={`text-xs mt-0.5 truncate ${
                    tempDate
                      ? 'font-sans font-bold text-slate-900 dark:text-white'
                      : 'font-sans font-medium text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {tempDate ? (
                    <span>
                      {WEEKDAY_FULL_VI[parseISODate(tempDate)?.getDay() ?? 0]},{' '}
                      <span className="font-mono tabular-nums text-[#166534] dark:text-emerald-400">
                        {formatDisplayDate(tempDate)}
                      </span>
                    </span>
                  ) : (
                    'Chưa chọn ngày'
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSelectToday}
                className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold font-sans bg-emerald-50 hover:bg-emerald-100 text-[#166534] border border-emerald-200/80 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500/30 transition cursor-pointer active:scale-95"
              >
                Hôm nay
              </button>
            </div>

            {/* ── 2. iPHONE-STYLE HEADER BAR: "Tháng 11 năm 2026 ›" + "< >" ── */}
            <div className="flex items-center justify-between mb-2.5 px-0.5">
              <button
                type="button"
                onClick={() => setPickerMode((m) => (m === 'calendar' ? 'wheel' : 'calendar'))}
                aria-expanded={pickerMode === 'wheel'}
                className={`group inline-flex items-center gap-1 px-2 py-1 -ml-1 rounded-lg font-sans font-bold text-[13.5px] transition-colors cursor-pointer ${
                  pickerMode === 'wheel'
                    ? 'text-[#166534] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15'
                    : 'text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={
                  pickerMode === 'wheel'
                    ? 'Quay lại bảng chọn ngày'
                    : 'Bấm để chọn nhanh tháng và năm'
                }
              >
                <span>
                  Tháng <span className="tabular-nums">{currentViewMonthNum}</span> năm{' '}
                  <span className="tabular-nums">{currentViewYearNum}</span>
                </span>
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-200 ${
                    pickerMode === 'wheel'
                      ? 'rotate-90 text-[#166534] dark:text-emerald-400'
                      : 'text-[#166534] dark:text-emerald-400 group-hover:translate-x-0.5'
                  }`}
                />
              </button>

              {/* Mũi tên chuyển tháng trước/sau (ẩn mềm khi đang xoay Wheel Tháng/Năm giống iOS) */}
              <div
                className={`flex items-center gap-0.5 transition-opacity duration-150 ${
                  pickerMode === 'wheel' ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#166534] dark:text-emerald-400 transition cursor-pointer active:scale-95"
                  title="Tháng trước"
                  aria-label="Tháng trước"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.4]" />
                </button>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[#166534] dark:text-emerald-400 transition cursor-pointer active:scale-95"
                  title="Tháng sau"
                  aria-label="Tháng sau"
                >
                  <ChevronRight className="w-4 h-4 stroke-[2.4]" />
                </button>
              </div>
            </div>

            {/* ── 3. BODY: iOS DUAL SCROLL-WHEEL (THÁNG & NĂM) HOẶC LỊCH NGÀY ── */}
            {pickerMode === 'wheel' ? (
              <div className="relative h-[228px] flex flex-col justify-center animate-in fade-in duration-150">
                <div className="relative flex items-center h-[200px] overflow-hidden rounded-xl">
                  {/* Thanh nổi trung tâm giống iOS UIDatePicker */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1 right-1 top-1/2 -translate-y-1/2 h-[40px] rounded-xl bg-emerald-600/10 dark:bg-emerald-400/15 border border-emerald-600/20 dark:border-emerald-400/25 z-0"
                  />

                  {/* Lớp phủ mờ dần trên & dưới tạo độ cong 3D hình trụ giống iPhone */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white via-white/75 to-transparent dark:from-slate-900 dark:via-slate-900/75 dark:to-transparent z-10"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/75 to-transparent dark:from-slate-900 dark:via-slate-900/75 dark:to-transparent z-10"
                  />

                  {/* Bánh xe Tháng (1..12) */}
                  <WheelColumn
                    items={MONTHS}
                    value={currentViewMonthNum}
                    onChange={handleWheelMonthChange}
                    align="right"
                    ariaLabel="Chọn tháng"
                    renderLabel={(m) => (
                      <span className="font-sans text-[15px] tracking-tight">
                        Tháng <span className="tabular-nums">{m}</span>
                      </span>
                    )}
                  />

                  {/* Bánh xe Năm (1950..2050) */}
                  <WheelColumn
                    items={years}
                    value={Math.min(maxYear, Math.max(minYear, currentViewYearNum))}
                    onChange={handleWheelYearChange}
                    align="left"
                    ariaLabel="Chọn năm"
                    renderLabel={(y) => (
                      <span className="font-mono tabular-nums text-[15px] tracking-wide">
                        {y}
                      </span>
                    )}
                  />
                </div>
                <p className="text-center text-[10.5px] font-sans text-slate-400 dark:text-slate-500 mt-1.5">
                  Cuộn hoặc bấm chọn tháng và năm, sau đó quay lại chọn ngày
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-150">
                {/* Thứ trong tuần */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-semibold font-sans text-slate-400">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="py-1">
                      {w}
                    </div>
                  ))}
                </div>

                {/* Lưới 42 ngày */}
                <div className="overflow-hidden">
                  <div
                    className={`grid grid-cols-7 gap-y-1 ${
                      slideDirection === 'left'
                        ? slideActive
                          ? 'u030-slide-left-active'
                          : 'u030-slide-left-enter'
                        : slideDirection === 'right'
                        ? slideActive
                          ? 'u030-slide-right-active'
                          : 'u030-slide-right-enter'
                        : ''
                    }`}
                  >
                    {calendarCells.map((cell) => {
                      const isSelected = cell.iso === tempDate;
                      return (
                        <div key={cell.iso} className="relative p-0.5 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleDayClick(cell.iso)}
                            onDoubleClick={() => handleDayDoubleClick(cell.iso)}
                            aria-pressed={isSelected}
                            className={`u030-cell w-8 h-8 rounded-full text-xs font-mono tabular-nums font-medium flex items-center justify-center transition-all cursor-pointer ${
                              !cell.isCurrentMonth
                                ? 'opacity-30 text-slate-400'
                                : 'text-slate-700 dark:text-slate-200'
                            } ${
                              isSelected
                                ? 'is-start is-end is-single'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                            } ${
                              cell.isToday && !isSelected
                                ? 'border border-amber-500/70 font-bold text-amber-700 dark:text-amber-400'
                                : ''
                            }`}
                          >
                            {cell.dayNumber}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── 4. FOOTER BAR: TÓM TẮT + ĐẶT LẠI (KHÔNG ĐÓNG) + ÁP DỤNG ── */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
              <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400 truncate">
                {pickerMode === 'wheel' ? (
                  <span className="text-[#166534] dark:text-emerald-400 font-semibold">
                    Tháng {currentViewMonthNum}/{currentViewYearNum}
                  </span>
                ) : tempDate ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    Đã chọn <span className="font-mono tabular-nums">{formatDisplayDate(tempDate)}</span>
                  </span>
                ) : (
                  <span>Chưa chọn ngày</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {pickerMode === 'calendar' && (
                  <button
                    type="button"
                    onClick={handleResetDraft}
                    disabled={!tempDate && !hasValue}
                    className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-sans font-medium text-[11px] transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Xóa ngày đang chọn để chọn ngày khác"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Đặt lại</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={pickerMode === 'calendar' && !tempDate}
                  className="px-3 py-1.5 rounded-lg bg-[#166534] hover:bg-[#14532d] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-sans font-semibold text-[11px] shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{pickerMode === 'wheel' ? 'Chọn ngày' : 'Áp dụng'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative w-full ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`group w-full min-h-[36px] px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none ${
          isOpen
            ? 'bg-white dark:bg-slate-950 border-[#166534] dark:border-emerald-500 ring-2 ring-[#166534]/15 dark:ring-emerald-500/20'
            : hasValue
            ? 'bg-slate-50/70 dark:bg-slate-950 border-slate-300 dark:border-slate-700 hover:border-emerald-600/60 dark:hover:border-emerald-500/60'
            : 'bg-slate-50/70 dark:bg-slate-950 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        }`}
        title={hasValue ? formatFullDateVi(value) : placeholder}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon
            className={`w-3.5 h-3.5 shrink-0 transition-colors ${
              isOpen || hasValue
                ? 'text-[#166534] dark:text-emerald-400'
                : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
            }`}
          />
          {hasValue ? (
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 truncate">
              {displayValue}
            </span>
          ) : (
            <span className="font-sans font-normal text-slate-400 dark:text-slate-500 truncate">
              {placeholder}
            </span>
          )}
        </div>

        {hasValue && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              handleQuickClear();
            }}
            className="p-0.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition shrink-0"
            title="Xóa ngày ban hành"
            aria-label="Xóa ngày ban hành"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {popoverNode}
    </div>
  );
};

export default SingleDatePicker;
