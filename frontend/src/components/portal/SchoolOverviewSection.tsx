import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  Building2,
  ShieldCheck,
  Activity,
  BarChart3,
  PieChart,
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock,
  KeyRound,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { DocumentItem, MetaData, Unit, User } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatFileSize';
import { RollingNumber } from '../common/RollingNumber';

export interface SchoolOverviewSectionProps {
  documents: DocumentItem[];
  meta: MetaData;
  tqsDepartments: Unit[];
  mainUnits: Unit[];
  selectedUnit: string;
  selectedDepartment: string;
  selectedType: string;
  selectedLevel: number | '';
  onSelectDepartment: (unitId: string, isDeptOfTqs: boolean) => void;
  onSelectType: (typeId: string) => void;
  onSelectLevel: (levelId: number | '') => void;
  onResetFilters: () => void;
  userClearanceLevel?: number;
  user?: User | null;
}

export const SchoolOverviewSection: React.FC<SchoolOverviewSectionProps> = ({
  documents,
  meta,
  tqsDepartments,
  mainUnits,
  selectedUnit,
  selectedDepartment,
  selectedType,
  selectedLevel,
  onSelectDepartment,
  onSelectType,
  onSelectLevel,
  onResetFilters,
  userClearanceLevel = 5,
  user = null,
}) => {
  // Tab góc nhìn cho Bảng Phải: 'type' (Theo Thể Loại) hoặc 'level' (Theo Cấp Độ Mật)
  const [rightPanelTab, setRightPanelTab] = useState<'type' | 'level'>('type');

  const totalCount = documents.length;

  // 1. Thẻ 1: Tổng dung lượng kho & số văn bản mới trong 30 ngày qua
  const totalBytes = useMemo(() => {
    return documents.reduce(
      (sum, d) => sum + (Number(d.file_size_bytes ?? d.file_size) || 0),
      0
    );
  }, [documents]);

  const new30DaysDocs = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return documents.filter((d) => {
      const dateVal = d.issued_date || d.issue_date || d.created_at;
      if (!dateVal) return false;
      const dt = new Date(dateVal);
      return !isNaN(dt.getTime()) && dt >= thirtyDaysAgo;
    });
  }, [documents]);

  // 2. Thống kê tiến độ các phòng ban trực thuộc Trường Quân sự Quân khu 7
  const schoolUnitsList = useMemo(() => {
    // Chỉ lấy duy nhất các phòng ban con của Trường Quân sự Quân khu 7 (loại bỏ hoàn toàn cơ quan bên ngoài/cấp trên)
    return tqsDepartments.map((d) => ({
      unit_id: d.unit_id,
      name: d.unit_id === 'U-BGH' ? 'Ban Giám hiệu' : d.name,
      isDeptOfTqs: true,
    }));
  }, [tqsDepartments]);

  const unitStats = useMemo(() => {
    // Tổng số văn bản thuộc phạm vi Trường Quân sự Quân khu 7 (bao gồm văn bản cấp trường TQS và các phòng ban con)
    const tqsDocs = documents.filter((d) => {
      const uId = d.issuing_unit_id;
      return (
        uId === 'TQS' ||
        uId === 'U-TQS' ||
        tqsDepartments.some((dept) => dept.unit_id === uId) ||
        (d.unit_name &&
          (d.unit_name.toLowerCase().includes('ban giám hiệu') ||
            d.unit_name.toLowerCase().includes('trường quân sự')))
      );
    });
    const totalSchoolDocs = tqsDocs.length > 0 ? tqsDocs.length : 1;

    return schoolUnitsList
      .map((unit) => {
        const subUnitIds = meta.units.filter((u) => u.parent_id === unit.unit_id).map((u) => u.unit_id);

        const unitDocs = documents.filter((d) => {
          if (unit.unit_id === 'U-BGH') {
            // Ban Giám hiệu phụ trách các văn bản do Nhà trường / Ban Giám hiệu ký (TQS, U-TQS, U-BGH)
            return (
              d.issuing_unit_id === 'U-BGH' ||
              d.issuing_unit_id === 'TQS' ||
              d.issuing_unit_id === 'U-TQS' ||
              (d.unit_name &&
                (d.unit_name.toLowerCase().includes('ban giám hiệu') ||
                  d.unit_name.toLowerCase().includes('trường quân sự')))
            );
          }
          if (d.issuing_unit_id === unit.unit_id) return true;
          if (d.unit_name && d.unit_name.toLowerCase() === unit.name.toLowerCase()) return true;
          // Bao gồm cả tài liệu của các đơn vị con trực thuộc (ví dụ Bếp cơ quan con của Phòng Hậu cần - Kỹ thuật)
          if (subUnitIds.includes(d.issuing_unit_id)) return true;
          return false;
        });

        const count = unitDocs.length;
        const secretCount = unitDocs.filter(
          (d) => (d.security_level_id || 1) >= 3
        ).length;
        const normalCount = count - secretCount;
        const pctOfTotal = (count / totalSchoolDocs) * 100;

        // SLA Traffic-Light status:
        // count >= 3: Đạt chuẩn / Đúng tiến độ (Green)
        // 1 <= count <= 2: Cần bổ sung (Yellow)
        // count === 0: Chậm tiến độ (Red)
        let slaStatus: 'success' | 'warning' | 'danger';
        let slaLabel: string;
        if (count >= 3) {
          slaStatus = 'success';
          slaLabel = 'Đúng tiến độ';
        } else if (count >= 1) {
          slaStatus = 'warning';
          slaLabel = 'Cần bổ sung';
        } else {
          slaStatus = 'danger';
          slaLabel = 'Chậm tiến độ • Chưa nộp';
        }

        return {
          ...unit,
          count,
          normalCount,
          secretCount,
          pctOfTotal,
          slaStatus,
          slaLabel,
        };
      })
      .sort((a, b) => {
        // Đơn vị nhiều tài liệu lên trước, các đơn vị 0 tài liệu xếp sau
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, 'vi');
      });
  }, [schoolUnitsList, documents, tqsDepartments]);

  const totalUnitsCount = unitStats.length;
  const unitsWithDocsCount = unitStats.filter((u) => u.count > 0).length;
  const zeroDocUnitsCount = unitStats.filter((u) => u.count === 0).length;
  const unitProgressPct =
    totalUnitsCount > 0 ? Math.round((unitsWithDocsCount / totalUnitsCount) * 100) : 100;
  const leadingUnit = unitStats[0]?.count > 0 ? unitStats[0] : null;

  // 3. Thẻ 3: Cơ cấu bảo mật toàn trường
  const publicInternalCount = useMemo(
    () => documents.filter((d) => (d.security_level_id || 1) <= 2).length,
    [documents]
  );
  const secretCount = useMemo(
    () => documents.filter((d) => (d.security_level_id || 1) === 3).length,
    [documents]
  );
  const topSecretCount = useMemo(
    () => documents.filter((d) => (d.security_level_id || 1) >= 4).length,
    [documents]
  );
  const secretPlusCount = secretCount + topSecretCount;

  // 3. Thẻ 3: Quyền Khai Thác Của Bạn (Clearance Access KPI toàn trường)
  const accessibleDocsCount = useMemo(
    () =>
      documents.filter((d) => (d.security_level_id || 1) <= userClearanceLevel).length,
    [documents, userClearanceLevel]
  );
  const accessiblePct =
    totalCount > 0 ? Math.round((accessibleDocsCount / totalCount) * 100) : 100;

  const clearanceName = useMemo(() => {
    switch (userClearanceLevel) {
      case 5:
        return 'Tuyệt mật (Cấp 5)';
      case 4:
        return 'Tối mật (Cấp 4)';
      case 3:
        return 'Mật (Cấp 3)';
      case 2:
        return 'Nội bộ (Cấp 2)';
      default:
        return 'Công khai (Cấp 1)';
    }
  }, [userClearanceLevel]);

  const publicPct = totalCount > 0 ? (publicInternalCount / totalCount) * 100 : 0;
  const secretPct = totalCount > 0 ? (secretCount / totalCount) * 100 : 0;
  const topSecretPct = totalCount > 0 ? (topSecretCount / totalCount) * 100 : 0;

  // 4. Thẻ 4: Tình trạng chuẩn hóa phân bổ
  const standardizedCount = useMemo(
    () =>
      documents.filter(
        (d) =>
          Boolean(d.issuing_unit_id) &&
          Boolean(d.doc_type_id || d.type_id || d.doc_type_name)
      ).length,
    [documents]
  );
  const standardizedPct =
    totalCount > 0 ? Math.round((standardizedCount / totalCount) * 100) : 100;

  const latestDateStr = useMemo(() => {
    const sorted = [...documents]
      .filter((d) => d.issued_date || d.issue_date || d.created_at)
      .sort(
        (a, b) =>
          new Date(b.issued_date || b.issue_date || b.created_at || 0).getTime() -
          new Date(a.issued_date || a.issue_date || a.created_at || 0).getTime()
      );
    return sorted[0]
      ? formatDate(sorted[0].issued_date || sorted[0].issue_date || sorted[0].created_at)
      : 'Chưa có văn bản';
  }, [documents]);

  // Dữ liệu cho Bảng Phải: Thể loại văn bản
  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((d) => {
      const typeId = d.doc_type_id || d.type_id || '';
      const typeName = d.doc_type_name || d.type_name || 'Văn bản khác';
      const key = typeId || typeName;
      counts[key] = (counts[key] || 0) + 1;
    });

    // Merge với meta.types để hiển thị đầy đủ
    const list = meta.types.map((t) => ({
      id: t.type_id,
      label: t.name,
      count: counts[t.type_id] || counts[t.name] || 0,
      pct: totalCount > 0 ? ((counts[t.type_id] || counts[t.name] || 0) / totalCount) * 100 : 0,
    }));

    return list.sort((a, b) => b.count - a.count);
  }, [documents, meta.types, totalCount]);

  // Dữ liệu cho Bảng Phải: Cấp độ bảo mật
  const securityLevelDistribution = useMemo(() => {
    const levelConfigs = [
      { id: 1, label: 'Cấp 1 - Công khai', color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/30' },
      { id: 2, label: 'Cấp 2 - Nội bộ', color: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-500/30' },
      { id: 3, label: 'Cấp 3 - Mật', color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/30' },
      { id: 4, label: 'Cấp 4 - Tối mật', color: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-500/30' },
      { id: 5, label: 'Cấp 5 - Tuyệt mật', color: 'bg-red-600', text: 'text-red-700 dark:text-red-400', border: 'border-red-600/30' },
    ];

    return levelConfigs.map((cfg) => {
      const count = documents.filter((d) => (d.security_level_id || 1) === cfg.id).length;
      const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
      return {
        ...cfg,
        count,
        pct,
      };
    });
  }, [documents, totalCount]);

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* PHẦN 1: 4 THẺ KPI VĨ MÔ TOÀN TRƯỜNG (4 MACRO KPI CARDS)       */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* THẺ 1: TỔNG VĂN BẢN TOÀN TRƯỜNG */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0 }}
          onClick={onResetFilters}
          className="group relative bg-white dark:bg-[#111827] p-4 sm:p-4.5 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-4 border-l-emerald-600 dark:border-l-emerald-500 hover:border-slate-300 dark:hover:border-white/20 transition-all cursor-pointer flex flex-col justify-between shadow-xs"
          title="Nhấn để đặt lại bộ lọc và hiển thị tất cả văn bản toàn trường"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                Tổng văn bản toàn trường
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FolderKanban className="w-4 h-4 shrink-0" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <h3 className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight leading-none">
                <RollingNumber value={totalCount} />
              </h3>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                tài liệu
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] leading-tight truncate font-medium flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">
              {formatFileSize(totalBytes)} • {new30DaysDocs.length > 0 ? `+${new30DaysDocs.length} Văn bản mới (30 ngày)` : 'Kho số sẵn sàng'}
            </span>
          </p>
        </motion.div>

        {/* THẺ 2: TIẾN ĐỘ SỐ HÓA PHÒNG BAN */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.04 }}
          className={`group relative bg-white dark:bg-[#111827] p-4 sm:p-4.5 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-4 transition-all flex flex-col justify-between shadow-xs ${
            zeroDocUnitsCount > 0
              ? 'border-l-rose-500 dark:border-l-rose-500'
              : 'border-l-amber-500 dark:border-l-amber-500'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                Tiến độ các phòng ban
              </span>
              <div
                className={`p-1.5 rounded-lg ${
                  zeroDocUnitsCount > 0
                    ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
              <h3 className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight leading-none">
                <RollingNumber value={unitsWithDocsCount} />
                <span className="text-base text-slate-400 dark:text-slate-500 font-normal">/{totalUnitsCount}</span>
              </h3>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                đơn vị
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  unitProgressPct === 100
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                }`}
              >
                {unitProgressPct}%
              </span>
            </div>
          </div>
          <p className="text-xs mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] leading-tight truncate font-semibold flex items-center gap-1.5">
            {zeroDocUnitsCount > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 truncate">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                <span>{zeroDocUnitsCount} đơn vị chậm tiến độ (chưa có dữ liệu)</span>
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>100% đơn vị đã tham gia số hóa</span>
              </span>
            )}
          </p>
        </motion.div>

        {/* THẺ 3: QUYỀN KHAI THÁC CỦA ĐỒNG CHÍ (Personalized Clearance Access KPI) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.08 }}
          onClick={() => {
            if (selectedLevel === userClearanceLevel) {
              onSelectLevel('');
            } else {
              onSelectLevel(userClearanceLevel);
            }
          }}
          className={`group relative bg-white dark:bg-[#111827] p-4 sm:p-4.5 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-4 border-l-blue-500 dark:border-l-blue-400 hover:border-slate-300 dark:hover:border-white/20 transition-all cursor-pointer flex flex-col justify-between shadow-xs ${
            selectedLevel === userClearanceLevel
              ? 'ring-1 ring-blue-500/50 bg-blue-500/[0.03] dark:bg-blue-500/[0.05]'
              : ''
          }`}
          title="Nhấn để lọc văn bản trong thẩm quyền khai thác của đồng chí"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                Quyền khai thác của bạn
              </span>
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <KeyRound className="w-4 h-4 shrink-0" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <h3 className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 tracking-tight leading-none">
                <RollingNumber value={accessibleDocsCount} />
                <span className="text-slate-400 text-lg font-normal">/{totalCount}</span>
              </h3>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                khả dụng
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded border border-blue-500/30 font-mono">
                {accessiblePct}%
              </span>
            </div>
          </div>
          {/* Progress bar mức độ tiếp cận */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] space-y-1.5">
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${accessiblePct}%` }}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">
              Cấp độ: <strong className="text-blue-600 dark:text-blue-400">{clearanceName}</strong>
              {secretPlusCount > 0 && (
                <span> • {secretPlusCount} hồ sơ cần 2FA vân tay</span>
              )}
            </p>
          </div>
        </motion.div>

        {/* THẺ 4: CHUẨN HÓA & CẬP NHẬT HỆ THỐNG */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.12 }}
          className="group relative bg-white dark:bg-[#111827] p-4 sm:p-4.5 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-4 border-l-cyan-500 dark:border-l-cyan-400 hover:border-slate-300 dark:hover:border-white/20 transition-all flex flex-col justify-between shadow-xs"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                Tình trạng chuẩn hóa phân bổ
              </span>
              <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Activity className="w-4 h-4 shrink-0" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <h3 className="text-2xl font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400 tracking-tight leading-none">
                <RollingNumber value={standardizedPct} />%
              </h3>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Chuẩn hóa
              </span>
            </div>
          </div>
          {/* Progress bar chuẩn hóa */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] space-y-1.5">
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${standardizedPct}%` }}
                className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full transition-all duration-300"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">
              Cập nhật cuối:{' '}
              <strong className="text-slate-700 dark:text-slate-300 font-mono">
                {latestDateStr}
              </strong>
            </p>
          </div>
        </motion.div>
      </div>

      {/* ============================================================ */}
      {/* PHẦN 2: 2 BẢNG PHÂN TÍCH CHUYÊN SÂU CHO CẤP TRÊN (COMMAND MATRIX) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* BẢNG TRÁI (7 CỘT): TIẾN ĐỘ SỐ HÓA & PHÂN BỔ THEO ĐƠN VỊ */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/[0.08] space-y-3.5 shadow-xs">
          {/* Header Bảng Trái: Thiết kế 2 tầng chuẩn Command Center chống ngắt dòng */}
          <div className="pb-3 border-b border-slate-100 dark:border-white/[0.06] space-y-2.5">
            {/* Hàng 1: Tiêu đề và Subtitle độc lập toàn dải */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Building2 className="w-4 h-4 shrink-0" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-snug whitespace-nowrap">
                    Tiến Độ Số Hóa & Phân Bổ Theo Đơn Vị
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                    Phòng ban trực thuộc Trường Quân sự Quân khu 7
                  </p>
                </div>
              </div>

              {/* Badge tổng số phòng ban */}
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 shrink-0">
                {unitStats.length} phòng ban
              </span>
            </div>

            {/* Hàng 2: Dải chỉ tiêu tiến độ SLA chuyên biệt, rõ ràng */}
            <div className="flex items-center justify-between gap-2 text-[10.5px] font-medium text-slate-500 dark:text-slate-400 flex-wrap bg-slate-50/80 dark:bg-white/[0.02] px-3 py-1.5 rounded-lg border border-slate-100 dark:border-white/[0.04]">
              <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider shrink-0">
                Chỉ tiêu tiến độ:
              </span>
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-xs shadow-emerald-500/40" />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Tối đa 3 Văn bản</span>
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-xs shadow-amber-400/40" />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Cần bổ sung (1-2 Văn bản)</span>
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shadow-xs shadow-rose-500/40" />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Chậm tiến độ (0 Văn bản)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Danh sách các Đơn vị (Có hỗ trợ Click-to-Filter) */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {unitStats.map((unit) => {
              const isSelected =
                (unit.isDeptOfTqs && selectedDepartment === unit.unit_id) ||
                (!unit.isDeptOfTqs && selectedUnit === unit.unit_id && !selectedDepartment);

              // Tính độ rộng thanh bar tương quan (tối thiểu 4% nếu có tài liệu)
              const maxUnitDocs = Math.max(...unitStats.map((u) => u.count), 1);
              const barWidth = unit.count > 0 ? Math.max(6, (unit.count / maxUnitDocs) * 100) : 0;

              return (
                <div
                  key={unit.unit_id}
                  onClick={() => onSelectDepartment(unit.unit_id, unit.isDeptOfTqs)}
                  className={`group p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'border-emerald-500/80 bg-emerald-50/80 dark:bg-emerald-950/30 ring-2 ring-emerald-600/40 shadow-xs'
                      : unit.count === 0
                      ? 'border-rose-200/70 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 hover:border-rose-300 dark:hover:border-rose-800'
                      : 'border-slate-200/80 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100/70 dark:hover:bg-white/[0.05] hover:border-slate-300'
                  }`}
                  title="Nhấn để lọc tài liệu của đơn vị này (nhấn lại để bỏ lọc)"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    {/* Tên đơn vị & Badge SLA */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`text-xs font-bold truncate ${
                          isSelected
                            ? 'text-emerald-900 dark:text-emerald-200'
                            : unit.count === 0
                            ? 'text-rose-800 dark:text-rose-300'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {unit.name}
                      </span>

                      {/* Badge trạng thái SLA */}
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                          unit.slaStatus === 'success'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : unit.slaStatus === 'warning'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {unit.slaLabel}
                      </span>
                    </div>

                    {/* Số lượng văn bản & tỷ lệ */}
                    <div className="flex items-center gap-1.5 shrink-0 text-right">
                      <span
                        className={`text-xs font-mono font-bold tabular-nums ${
                          unit.count === 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {unit.count} Văn bản
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        ({Math.round(unit.pctOfTotal)}%)
                      </span>
                      {isSelected && (
                        <span className="text-[9px] font-bold uppercase px-1 py-0.2 bg-emerald-600 text-white rounded shrink-0">
                          Đang xem
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Thanh Progress Đa Tầng (Normal vs Secret+) */}
                  <div className="w-full h-1.5 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    {unit.count === 0 ? (
                      <div className="w-full h-full bg-rose-200 dark:bg-rose-950/60" />
                    ) : (
                      <>
                        {unit.normalCount > 0 && (
                          <div
                            style={{ width: `${(unit.normalCount / maxUnitDocs) * 100}%` }}
                            className={`h-full transition-all duration-300 ${
                              unit.slaStatus === 'success'
                                ? 'bg-emerald-500'
                                : 'bg-amber-400'
                            }`}
                            title={`Tài liệu phổ thông: ${unit.normalCount}`}
                          />
                        )}
                        {unit.secretCount > 0 && (
                          <div
                            style={{ width: `${(unit.secretCount / maxUnitDocs) * 100}%` }}
                            className="h-full bg-blue-500 transition-all duration-300"
                            title={`Tài liệu Mật+: ${unit.secretCount}`}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
            <span className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Gợi ý: Nhấn vào dòng đơn vị bất kỳ để lọc nhanh danh sách văn bản bên dưới.</span>
            </span>
            {(selectedDepartment || selectedUnit) && (
              <button
                type="button"
                onClick={onResetFilters}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Xóa lọc đơn vị
              </button>
            )}
          </p>
        </div>

        {/* BẢNG PHẢI (5 CỘT): CƠ CẤU THỂ LOẠI & MỨC BẢO MẬT TOÀN TRƯỜNG */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/[0.08] space-y-3.5 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header Bảng Phải kèm Mini Segmented Tabs */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  Cơ Cấu Văn Bản
                </h3>
              </div>

              {/* Mini Segmented Switcher */}
              <div className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRightPanelTab('type')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    rightPanelTab === 'type'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Thể loại
                </button>
                <button
                  type="button"
                  onClick={() => setRightPanelTab('level')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    rightPanelTab === 'level'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Độ mật
                </button>
              </div>
            </div>

            {/* Nội dung Tab 1: Phân bố theo Thể loại */}
            {rightPanelTab === 'type' && (
              <div className="space-y-2.5 pt-2 max-h-[340px] overflow-y-auto pr-1">
                {typeDistribution.map((item) => {
                  const isSelected = selectedType === item.id;
                  const maxTypeCount = Math.max(...typeDistribution.map((t) => t.count), 1);
                  const barWidth = item.count > 0 ? Math.max(6, (item.count / maxTypeCount) * 100) : 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectType(item.id)}
                      className={`p-2 rounded-lg border transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50'
                          : 'border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                      }`}
                      title={`Nhấn để lọc thể loại: ${item.label}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span
                          className={`truncate font-medium ${
                            isSelected
                              ? 'text-emerald-900 dark:text-emerald-300 font-bold'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.label}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.count}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({Math.round(item.pct)}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        {item.count > 0 && (
                          <div
                            style={{ width: `${barWidth}%` }}
                            className="bg-gradient-to-r from-emerald-600 to-teal-500 h-full transition-all duration-300"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Nội dung Tab 2: Phân bố theo Mức độ bảo mật */}
            {rightPanelTab === 'level' && (
              <div className="space-y-2.5 pt-2 max-h-[340px] overflow-y-auto pr-1">
                {securityLevelDistribution.map((item) => {
                  const isSelected = selectedLevel === item.id;
                  const maxLevelCount = Math.max(...securityLevelDistribution.map((l) => l.count), 1);
                  const barWidth = item.count > 0 ? Math.max(6, (item.count / maxLevelCount) * 100) : 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectLevel(item.id)}
                      className={`p-2 rounded-lg border transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50'
                          : 'border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                      }`}
                      title={`Nhấn để lọc văn bản ${item.label}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span className={`truncate font-semibold ${item.text}`}>
                          {item.label}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.count} Văn bản
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({Math.round(item.pct)}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        {item.count > 0 && (
                          <div
                            style={{ width: `${barWidth}%` }}
                            className={`${item.color} h-full transition-all duration-300`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {rightPanelTab === 'type' ? 'Đang xem theo Thể loại' : 'Đang xem theo Mức độ mật'}
            </span>
            {(selectedType || selectedLevel !== '') && (
              <button
                type="button"
                onClick={() => {
                  onSelectType('');
                  onSelectLevel('');
                }}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Xóa lọc cơ cấu
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

