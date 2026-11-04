import React from 'react';
import { Search, RotateCw, Eraser, Calendar } from 'lucide-react';
import { DocumentType, Unit, SecurityLevel } from '../../types';
import { getMainIssuingUnits, getSchoolDepartmentsTree } from '../../utils/unitTree';
import { DateRangePicker } from '../common/DateRangePicker';

export interface DocumentFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  selectedUnit: string;
  onUnitChange: (value: string) => void;
  selectedDepartment?: string;
  onDepartmentChange?: (value: string) => void;
  selectedLevel: number;
  onLevelChange: (value: number) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  types: DocumentType[];
  units: Unit[];
  levels: SecurityLevel[];
  onReset: () => void;
  onRefresh: () => void;
}

export const DocumentFilters: React.FC<DocumentFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedUnit,
  onUnitChange,
  selectedDepartment = '',
  onDepartmentChange,
  selectedLevel,
  onLevelChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  types,
  units,
  levels,
  onReset,
  onRefresh,
}) => {
  // 1. Danh sách cơ quan ban hành chính (TQS, QK7, BTTM, TCCT, BQP, CP, SD5...) - gọn gàng như cũ
  const mainUnits = React.useMemo(() => {
    return getMainIssuingUnits(units);
  }, [units]);

  // 2. Danh mục các phòng ban / đơn vị con cháu của Trường Quân sự
  const schoolDepartments = React.useMemo(() => {
    return getSchoolDepartmentsTree(units);
  }, [units]);

  // 3. Kiểm tra xem người dùng có chọn Trường Quân sự Quân khu 7 hay không
  const isSchoolSelected = React.useMemo(() => {
    if (!selectedUnit) return false;
    const u = units.find((x) => x.unit_id === selectedUnit);
    return (
      selectedUnit === 'TQS' ||
      selectedUnit === 'U-TQS' ||
      Boolean(u?.name && (u.name.toLowerCase().includes('trường quân sự') || u.name.toLowerCase().includes('tqs')))
    );
  }, [selectedUnit, units]);

  return (
    <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5 shadow-sm transition-colors duration-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            id="doc-desk-search-input"
            name="doc_desk_search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo số hiệu, trích yếu..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 transition"
          />
        </div>

        {/* Document Type Dropdown */}
        <div>
          <select
            id="doc-desk-type-select"
            name="doc_desk_type"
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 transition"
          >
            <option value="">Tất cả loại văn bản</option>
            {types.map((t) => (
              <option key={t.type_id} value={t.type_id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Unit Dropdown (Cơ quan ban hành chính - gọn gàng như cũ) */}
        <div>
          <select
            id="doc-desk-unit-select"
            name="doc_desk_unit"
            value={selectedUnit}
            onChange={(e) => {
              onUnitChange(e.target.value);
              onDepartmentChange?.('');
            }}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 transition cursor-pointer [&>option]:bg-white [&>option]:text-slate-800 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
          >
            <option value="">Tất cả đơn vị ban hành</option>
            {mainUnits.map((u) => (
              <option key={u.unit_id} value={u.unit_id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Security Level Dropdown */}
        <div>
          <select
            id="doc-desk-level-select"
            name="doc_desk_level"
            value={selectedLevel}
            onChange={(e) => onLevelChange(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 transition"
          >
            <option value={0}>Mức bảo mật</option>
            {levels.map((l) => (
              <option key={l.level_id} value={l.level_id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date Filters, School Department Filter & Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-center pt-2.5 border-t border-slate-200 dark:border-slate-800/80">
        {/* Cột 1 & 2: Khung chọn khoảng ngày */}
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2.5 text-xs">
          <DateRangePicker
            startDate={dateFrom}
            endDate={dateTo}
            onChange={(start, end) => {
              onDateFromChange(start);
              onDateToChange(end);
            }}
            onClear={() => {
              onDateFromChange('');
              onDateToChange('');
            }}
          />
        </div>

        {/* Cột 3: Ô chọn filter các con của Trường Quân sự (nằm ngay dưới ô "Đơn vị ban hành") */}
        <div>
          {isSchoolSelected ? (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <select
                id="doc-desk-department-select"
                name="doc_desk_department"
                value={selectedDepartment}
                onChange={(e) => onDepartmentChange?.(e.target.value)}
                className="w-full px-3 py-2 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-400 dark:border-emerald-600 rounded-xl text-xs font-semibold text-emerald-950 dark:text-emerald-200 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition shadow-xs cursor-pointer [&>option]:bg-white [&>option]:text-slate-800 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
                title="Lọc theo các phòng ban / đơn vị trực thuộc Trường Quân sự Quân khu 7"
              >
                <option value="">Tất cả phòng ban trực thuộc</option>
                {schoolDepartments.map((d) => (
                  <option key={d.unit_id} value={d.unit_id}>
                    {d.displayName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="hidden xl:block" />
          )}
        </div>

        {/* Cột 4: Nút Xóa bộ lọc & Làm mới */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Xóa bộ lọc</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>
    </div>
  );
};
