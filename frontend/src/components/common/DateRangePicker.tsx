/* <!-- Lucian UX/UI Prompt #030 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#030 --> */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  RotateCcw,
  Clock,
  ArrowRight,
} from 'lucide-react';

export interface DateRangePickerProps {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  onChange: (startDate: string, endDate: string) => void;
  onClear?: () => void;
  placeholder?: string;
  compact?: boolean;
  className?: string;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function parseISODate(iso?: string | null): Date | null {
  if (!iso) return null;
  const parts = iso.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const date = new Date(y, m, d);
  return isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(iso?: string | null): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getDaysBetween(startISO: string, endISO: string): number {
  const d1 = parseISODate(startISO);
  const d2 = parseISODate(endISO);
  if (!d1 || !d2) return 0;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate = '',
  endDate = '',
  onChange,
  onClear,
  placeholder = 'Chọn khoảng ngày (Từ - Đến)',
  compact = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trạng thái tạm thời trong Popover trước khi bấm "Áp dụng"
  const [tempStart, setTempStart] = useState<string>(startDate);
  const [tempEnd, setTempEnd] = useState<string>(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Tháng đang hiển thị trên view
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = parseISODate(startDate) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [slideActive, setSlideActive] = useState(false);

  // Đồng bộ props vào temp states khi mở popover
  useEffect(() => {
    if (isOpen) {
      setTempStart(startDate);
      setTempEnd(endDate);
      setHoverDate(null);
      const d = parseISODate(startDate) || new Date();
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [isOpen, startDate, endDate]);

  // Đóng popover khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Điều hướng chuyển tháng có hiệu ứng trượt 0.45s cubic-bezier(.2, .8, .2, 1)
  const changeMonth = useCallback((delta: number) => {
    setSlideDirection(delta > 0 ? 'left' : 'right');
    setSlideActive(false);

    setTimeout(() => {
      setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
      setSlideActive(true);
      setTimeout(() => {
        setSlideDirection(null);
        setSlideActive(false);
      }, 450);
    }, 20);
  }, []);

  // Xử lý chọn ngày
  const handleDateClick = (clickedISO: string) => {
    // Nếu chưa có ngày bắt đầu, hoặc đã chọn xong cả 2 ngày: bắt đầu đợt chọn mới
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(clickedISO);
      setTempEnd('');
      setHoverDate(null);
      return;
    }

    // Nếu đã có ngày bắt đầu và chưa có ngày kết thúc:
    if (tempStart && !tempEnd) {
      if (clickedISO < tempStart) {
        // Nếu click ngày trước ngày bắt đầu: đặt lại ngày bắt đầu mới
        setTempStart(clickedISO);
        setTempEnd('');
      } else {
        // Đặt ngày kết thúc
        setTempEnd(clickedISO);
        setHoverDate(null);
      }
    }
  };

  // Áp dụng khoảng thời gian đã chọn
  const handleApply = () => {
    if (tempStart && !tempEnd) {
      // Nếu chỉ chọn 1 ngày, coi như khoảng ngày đó đến ngày đó
      onChange(tempStart, tempStart);
    } else {
      onChange(tempStart, tempEnd);
    }
    setIsOpen(false);
  };

  // Đặt lại / Xóa bộ lọc ngày
  const handleReset = () => {
    setTempStart('');
    setTempEnd('');
    setHoverDate(null);
    if (onClear) {
      onClear();
    } else {
      onChange('', '');
    }
    setIsOpen(false);
  };

  // Phím tắt nhanh (Tactical Quick Presets)
  const applyPreset = (daysBack: number | 'today' | 'thisMonth') => {
    const today = new Date();
    const todayISO = toISODate(today);

    if (daysBack === 'today') {
      setTempStart(todayISO);
      setTempEnd(todayISO);
    } else if (daysBack === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setTempStart(toISODate(firstDay));
      setTempEnd(todayISO);
    } else if (typeof daysBack === 'number') {
      const past = new Date();
      past.setDate(today.getDate() - (daysBack - 1));
      setTempStart(toISODate(past));
      setTempEnd(todayISO);
    }
  };

  // Lưới 42 ngày (6 tuần x 7 ngày) của viewMonth
  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Xác định thứ của ngày 1 (0: CN, 1: T2, ..., 6: T7 -> chuyển sang Monday-first: 0: T2, ..., 6: CN)
    let firstDayIndex = firstDayOfMonth.getDay() - 1;
    if (firstDayIndex === -1) firstDayIndex = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const cells: Array<{
      date: Date;
      iso: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayISO = toISODate(new Date());

    // Các ngày thuộc tháng trước
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const iso = toISODate(d);
      cells.push({
        date: d,
        iso,
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: iso === todayISO,
      });
    }

    // Các ngày thuộc tháng hiện tại
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const iso = toISODate(d);
      cells.push({
        date: d,
        iso,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: iso === todayISO,
      });
    }

    // Các ngày thuộc tháng sau để đủ 42 ô (6 hàng) hoặc 35 ô
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const iso = toISODate(d);
      cells.push({
        date: d,
        iso,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: iso === todayISO,
      });
    }

    return cells;
  }, [viewMonth]);

  // Tính toán vùng chọn trực quan (Range Band)
  const effectiveEnd = tempEnd || (tempStart && hoverDate && hoverDate >= tempStart ? hoverDate : null);
  const selectedDaysCount = tempStart && tempEnd ? getDaysBetween(tempStart, tempEnd) : 0;

  // Tiêu đề nút Trigger
  const triggerLabel = useMemo(() => {
    if (startDate && endDate) {
      if (startDate === endDate) return formatDisplayDate(startDate);
      const count = getDaysBetween(startDate, endDate);
      return `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)} (${count} ngày)`;
    }
    if (startDate) return `Từ: ${formatDisplayDate(startDate)}`;
    if (endDate) return `Đến: ${formatDisplayDate(endDate)}`;
    return placeholder;
  }, [startDate, endDate, placeholder]);

  const hasSelection = Boolean(startDate || endDate);

  return (
    <div ref={containerRef} className={`u030-wrap relative inline-block text-xs ${className}`}>
      {/* Nút Trigger trong thanh lọc */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`u030-trigger group px-2.5 py-1.5 rounded-lg border flex items-center gap-2 transition-all cursor-pointer select-none text-xs ${
            hasSelection
              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500/50 text-emerald-900 dark:text-emerald-200 font-medium shadow-xs'
              : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
          }`}
          title="Chọn khoảng thời gian lọc dữ liệu"
        >
          <CalendarIcon
            className={`w-3.5 h-3.5 transition-colors ${
              hasSelection
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
            }`}
          />
          <span className="font-mono tabular-nums truncate max-w-[240px] sm:max-w-none">
            {triggerLabel}
          </span>
          {hasSelection && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="p-0.5 rounded-md hover:bg-emerald-200/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 transition"
              title="Xóa bộ lọc ngày"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </button>
      </div>

      {/* Popover Bảng Lịch Chọn Khoảng Ngày (#030) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Lịch chọn khoảng thời gian"
          className="u030-popover absolute left-0 sm:left-auto top-full mt-2 z-50 w-[310px] sm:w-[340px] p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-slate-100 select-none animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header Pills: Từ ngày → Đến ngày (.u030-pills) */}
          <div className="u030-pills grid grid-cols-2 gap-2 mb-3">
            {/* Pill Từ ngày */}
            <div
              className={`p-2 rounded-xl border transition-all ${
                tempStart && !tempEnd
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
              }`}
            >
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Từ ngày
              </div>
              <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                {tempStart ? formatDisplayDate(tempStart) : 'Chưa chọn'}
              </div>
            </div>

            {/* Pill Đến ngày */}
            <div
              className={`p-2 rounded-xl border transition-all ${
                tempStart && !tempEnd
                  ? 'border-amber-500/60 bg-amber-50/30 dark:bg-amber-950/20 animate-pulse'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
              }`}
            >
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Đến ngày</span>
                {tempStart && !tempEnd && (
                  <span className="text-[9px] text-amber-600 dark:text-amber-400 font-normal">
                    Chọn ngày kết thúc
                  </span>
                )}
              </div>
              <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                {tempEnd ? formatDisplayDate(tempEnd) : 'Chưa chọn'}
              </div>
            </div>
          </div>

          {/* Quick Preset Chips */}
          <div className="flex flex-wrap gap-1.5 mb-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => applyPreset('today')}
              className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => applyPreset(7)}
              className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => applyPreset(30)}
              className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
            >
              30 ngày qua
            </button>
            <button
              type="button"
              onClick={() => applyPreset('thisMonth')}
              className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
            >
              Tháng này
            </button>
          </div>

          {/* Thanh Tháng & Nút Điều Hướng (.u030-m) */}
          <div className="u030-m flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-mono">
              Tháng {viewMonth.getMonth() + 1}, {viewMonth.getFullYear()}
            </span>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Tiêu Đề Thứ Trong Tuần */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-semibold text-slate-400">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Lưới Ngày Tháng Có Hiệu Ứng Trượt Mượt (.u030-view, .u030-grid) */}
          <div className="overflow-hidden">
            <div
              className={`u030-view grid grid-cols-7 gap-y-1 ${
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
                const isStart = cell.iso === tempStart;
                const isEnd = cell.iso === effectiveEnd;
                const isSingle = isStart && isEnd;
                const inRange =
                  tempStart &&
                  effectiveEnd &&
                  cell.iso > tempStart &&
                  cell.iso < effectiveEnd;
                const isHoverRange =
                  tempStart &&
                  !tempEnd &&
                  hoverDate &&
                  hoverDate > tempStart &&
                  cell.iso > tempStart &&
                  cell.iso <= hoverDate;

                return (
                  <div
                    key={cell.iso}
                    onPointerEnter={() => {
                      if (tempStart && !tempEnd) {
                        setHoverDate(cell.iso);
                      }
                    }}
                    className={`relative p-0.5 flex items-center justify-center ${
                      inRange || isHoverRange ? 'bg-emerald-500/10 dark:bg-emerald-500/15' : ''
                    } ${
                      isStart && effectiveEnd && !isSingle
                        ? 'rounded-l-full bg-gradient-to-r from-transparent to-emerald-500/10 dark:to-emerald-500/15'
                        : ''
                    } ${
                      isEnd && tempStart && !isSingle
                        ? 'rounded-r-full bg-gradient-to-l from-transparent to-emerald-500/10 dark:to-emerald-500/15'
                        : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleDateClick(cell.iso)}
                      className={`u030-cell w-8 h-8 rounded-full text-xs font-mono font-medium flex items-center justify-center transition-all cursor-pointer ${
                        !cell.isCurrentMonth
                          ? 'opacity-30 text-slate-400'
                          : 'text-slate-700 dark:text-slate-200'
                      } ${
                        isStart || isEnd
                          ? isSingle
                            ? 'is-start is-end is-single'
                            : isStart
                            ? 'is-start'
                            : 'is-end'
                          : inRange
                          ? 'in-range'
                          : isHoverRange
                          ? 'is-hover-range'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      } ${
                        cell.isToday && !isStart && !isEnd
                          ? 'border border-amber-500/60 font-bold text-amber-700 dark:text-amber-400'
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

          {/* Footer Bar: Tóm tắt số ngày & Nút hành động */}
          <div className="u030-foot mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {tempStart && tempEnd ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  {selectedDaysCount} ngày được chọn
                </span>
              ) : tempStart ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Chọn tiếp ngày kết thúc
                </span>
              ) : (
                <span>Chưa chọn khoảng ngày</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-[11px] transition"
              >
                Đặt lại
              </button>

              <button
                type="button"
                onClick={handleApply}
                disabled={!tempStart}
                className="px-3 py-1.5 rounded-lg bg-[#166534] hover:bg-[#15803d] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Áp dụng</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
