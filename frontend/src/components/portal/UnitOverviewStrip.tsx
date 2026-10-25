import React from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Shield,
  KeyRound,
  HardDrive,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { DocumentItem } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatFileSize';
import { RollingNumber } from '../common/RollingNumber';

export interface UnitOverviewStripProps {
  documents: DocumentItem[];
  allUnitDocuments: DocumentItem[];
  userClearanceLevel: number;
  userLevelName: string;
  userName?: string;
  selectedLevel: number | '';
  onSelectLevel: (level: number | '') => void;
  onResetFilters: () => void;
  onCardClickToast?: (msg: string) => void;
  refreshKey?: number | string;
}

export const UnitOverviewStrip: React.FC<UnitOverviewStripProps> = ({
  documents,
  allUnitDocuments,
  userClearanceLevel,
  userLevelName,
  userName,
  selectedLevel,
  onSelectLevel,
  onResetFilters,
  onCardClickToast,
  refreshKey,
}) => {
  // Ưu tiên mảng toàn bộ văn bản của đơn vị để thống kê không bị méo mó khi đang lọc
  const targetDocs = allUnitDocuments.length > 0 ? allUnitDocuments : documents;
  const totalCount = targetDocs.length;

  // 1. Thẻ 1: Tính số văn bản ban hành trong tháng hiện tại hoặc thể loại chiếm đa số
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const thisMonthDocs = targetDocs.filter((d) => {
    const dateVal = d.issued_date || d.issue_date || d.created_at;
    if (!dateVal) return false;
    const dt = new Date(dateVal);
    return (
      !isNaN(dt.getTime()) &&
      dt.getMonth() === currentMonth &&
      dt.getFullYear() === currentYear
    );
  });

  const typeCounts: Record<string, number> = {};
  targetDocs.forEach((d) => {
    const tName = d.doc_type_name || d.type_name || 'Văn bản';
    typeCounts[tName] = (typeCounts[tName] || 0) + 1;
  });
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const dominantTypes = sortedTypes
    .slice(0, 2)
    .map(([name]) => name)
    .join(', ');

  const card1Subtext =
    thisMonthDocs.length > 0
      ? `Ban hành tháng ${currentMonth + 1}: +${thisMonthDocs.length} văn bản`
      : dominantTypes
      ? `Chủ yếu: ${dominantTypes}`
      : 'Đã sẵn sàng khai thác';

  // 2. Thẻ 2: Phân bố cấp độ bảo mật (Cấp 1-2: Công khai/Nội bộ, Cấp 3: Mật, Cấp 4-5: Tối mật/Tuyệt mật)
  const publicInternalCount = targetDocs.filter(
    (d) => (d.security_level_id || 1) <= 2
  ).length;
  const secretCount = targetDocs.filter(
    (d) => (d.security_level_id || 1) === 3
  ).length;
  const topSecretCount = targetDocs.filter(
    (d) => (d.security_level_id || 1) >= 4
  ).length;
  const secretPlusCount = secretCount + topSecretCount;

  const publicPct = totalCount > 0 ? (publicInternalCount / totalCount) * 100 : 0;
  const secretPct = totalCount > 0 ? (secretCount / totalCount) * 100 : 0;
  const topSecretPct =
    totalCount > 0 ? (topSecretCount / totalCount) * 100 : 0;

  const isSecretFilterActive = selectedLevel === 3 || Number(selectedLevel) >= 3;

  // 3. Thẻ 3: Thẩm quyền truy cập cá nhân hóa theo User
  const accessibleDocs = targetDocs.filter(
    (d) => (d.security_level_id || 1) <= userClearanceLevel
  );
  const accessiblePct =
    totalCount > 0 ? Math.round((accessibleDocs.length / totalCount) * 100) : 100;

  // 4. Thẻ 4: Tổng dung lượng kho & Ngày ban hành mới nhất
  const totalBytes = targetDocs.reduce(
    (sum, d) => sum + (Number(d.file_size_bytes ?? d.file_size) || 0),
    0
  );

  const sortedByDate = [...targetDocs]
    .filter((d) => d.issued_date || d.issue_date || d.created_at)
    .sort((a, b) => {
      const da = new Date(
        a.issued_date || a.issue_date || a.created_at || 0
      ).getTime();
      const db = new Date(
        b.issued_date || b.issue_date || b.created_at || 0
      ).getTime();
      return db - da;
    });

  const latestDateStr = sortedByDate[0]
    ? formatDate(
        sortedByDate[0].issued_date ||
          sortedByDate[0].issue_date ||
          sortedByDate[0].created_at
      )
    : 'Chưa có văn bản';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* THẺ 1: VĂN BẢN ĐƠN VỊ */}
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0 }}
        onClick={onResetFilters}
        className="group relative bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-2 border-l-emerald-600 dark:border-l-emerald-500 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-150 cursor-pointer flex flex-col justify-between"
        title="Nhấn để đặt lại bộ lọc và hiển thị tất cả văn bản đơn vị"
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              Văn bản đơn vị
            </span>
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h3 className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight leading-none">
              <RollingNumber value={totalCount} refreshKey={refreshKey} />
            </h3>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              tài liệu
            </span>
          </div>
        </div>
        <p
          className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] leading-tight truncate font-medium flex items-center gap-1.5"
          title={card1Subtext}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate">{card1Subtext}</span>
        </p>
      </motion.div>

      {/* THẺ 2: CƠ CẤU BẢO MẬT (HỒ SƠ MẬT & TỐI MẬT) */}
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.04 }}
        onClick={() => {
          if (isSecretFilterActive) {
            onSelectLevel('');
          } else {
            onSelectLevel(3);
          }
        }}
        className={`group relative bg-white dark:bg-[#111827] p-4 rounded-xl border border-l-2 border-l-amber-500 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-150 cursor-pointer flex flex-col justify-between ${
          isSecretFilterActive
            ? 'ring-1 ring-amber-500/50 border-amber-500/80 bg-amber-500/[0.03] dark:bg-amber-500/[0.05]'
            : 'border-slate-200 dark:border-white/[0.08]'
        }`}
        title="Nhấn để kích hoạt/hủy bộ lọc văn bản Mật (Cấp 3+)"
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              Hồ sơ mật & tối mật
            </span>
            <Shield className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h3 className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 tracking-tight leading-none">
              <RollingNumber value={secretPlusCount} refreshKey={refreshKey} />
            </h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              văn bản
            </span>
            {isSecretFilterActive && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded border border-amber-500/30">
                Đang lọc
              </span>
            )}
          </div>
        </div>

        {/* Mini progress bar 3 phân khúc */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] space-y-1.5">
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            {publicPct > 0 && (
              <div
                style={{ width: `${publicPct}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`Công khai / Nội bộ: ${publicInternalCount} (${Math.round(publicPct)}%)`}
              />
            )}
            {secretPct > 0 && (
              <div
                style={{ width: `${secretPct}%` }}
                className="bg-amber-400 h-full transition-all duration-300"
                title={`Mật: ${secretCount} (${Math.round(secretPct)}%)`}
              />
            )}
            {topSecretPct > 0 && (
              <div
                style={{ width: `${topSecretPct}%` }}
                className="bg-rose-500 h-full transition-all duration-300"
                title={`Tối mật / Tuyệt mật: ${topSecretCount} (${Math.round(topSecretPct)}%)`}
              />
            )}
            {totalCount === 0 && (
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-full" />
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
            Công khai/Nội bộ: <span className="font-semibold text-slate-700 dark:text-slate-300"><RollingNumber value={publicInternalCount} refreshKey={refreshKey} rowHeight="1.2em" /></span> • Mật+: <span className="font-semibold text-amber-600 dark:text-amber-400"><RollingNumber value={secretPlusCount} refreshKey={refreshKey} rowHeight="1.2em" /></span>
          </p>
        </div>
      </motion.div>

      {/* THẺ 3: THẨM QUYỀN TRUY CẬP (CÁ NHÂN HÓA THEO USER) */}
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.08 }}
        onClick={() => {
          if (onCardClickToast) {
            onCardClickToast(
              `Đồng chí có thẩm quyền tiếp cận ${accessibleDocs.length}/${totalCount} văn bản (tối đa cấp ${userClearanceLevel} - ${userLevelName}).`
            );
          }
        }}
        className="group relative bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-2 border-l-sky-500 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-150 cursor-pointer flex flex-col justify-between"
        title="Thẩm quyền truy cập được cấp cho tài khoản hiện tại"
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              Quyền khai thác của bạn
            </span>
            <KeyRound className="w-4 h-4 text-sky-500 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h3 className="text-2xl font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400 tracking-tight leading-none">
              <RollingNumber value={`${accessibleDocs.length} / ${totalCount}`} refreshKey={refreshKey} />
            </h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              khả dụng
            </span>
            <span className="ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-mono tabular-nums">
              <RollingNumber value={`${accessiblePct}%`} refreshKey={refreshKey} rowHeight="1.2em" />
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] leading-tight truncate font-medium flex items-center gap-1.5">
          <span className="text-slate-400 dark:text-slate-500">Cấp độ:</span>
          <span className="font-bold text-sky-600 dark:text-sky-400">
            {userLevelName}
          </span>
          {userName && (
            <span className="text-slate-400 dark:text-slate-500 truncate">
              ({userName})
            </span>
          )}
        </p>
      </motion.div>

      {/* THẺ 4: DUNG LƯỢNG & CẬP NHẬT */}
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.12 }}
        onClick={() => {
          if (onCardClickToast) {
            onCardClickToast(
              `Kho dữ liệu lưu trữ ${formatFileSize(totalBytes)} với văn bản mới nhất ban hành ngày ${latestDateStr}.`
            );
          }
        }}
        className="group relative bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-2 border-l-amber-600 dark:border-l-amber-500 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-150 cursor-pointer flex flex-col justify-between"
        title="Tổng dung lượng lưu trữ tệp PDF và ngày phát hành mới nhất"
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              Dung lượng kho đơn vị
            </span>
            <HardDrive className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h3 className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 tracking-tight leading-none">
              <RollingNumber value={formatFileSize(totalBytes)} refreshKey={refreshKey} />
            </h3>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] leading-tight truncate font-medium flex items-center gap-1.5">
          <span className="text-slate-400 dark:text-slate-500">Mới nhất:</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono tabular-nums">
            {latestDateStr}
          </span>
        </p>
      </motion.div>
    </div>
  );
};
