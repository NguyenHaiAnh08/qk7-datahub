import React, { useMemo, useState } from 'react';
import { Activity, BookOpenCheck, Building2, FolderKanban, PieChart } from 'lucide-react';
import { RollingNumber } from '../common/RollingNumber';
import { SegmentedTabs } from '../common/SegmentedTabs';
import { formatDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatFileSize';
import { getMilitaryUnitSortWeight, getSchoolDepartmentsTree } from '../../utils/unitTree';
import type { Unit } from '../../types';
import type { LibraryStats } from '../../types/library';

// Cùng cách gộp mã đơn vị cấp Trường / Ban Giám hiệu như backend/src/library-routes.js
const SCHOOL_BOARD_UNITS = ['BGH-TQSQK', 'U-BGH', 'TQS', 'TQS-QK7', 'U-TQS'];

export interface LibraryOverviewProps {
  stats: LibraryStats | null;
  units: Unit[];
  isGuest: boolean;
  selectedUnit?: string;
  selectedCategory?: string;
  selectedYear?: number;
  onSelectUnit: (unitId?: string) => void;
  onSelectCategory: (categoryId?: string) => void;
  onSelectYear: (year?: number) => void;
  onReset: () => void;
  onOpenHistory: () => void;
}

const card = 'text-left bg-white dark:bg-[#111827] p-4 rounded-xl border-y border-r border-slate-200 dark:border-white/[0.08] border-l-4 flex flex-col justify-between transition-colors';
const clickable = 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600';
const panel = 'bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/[0.08] space-y-3';
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const Card: React.FC<{
  tone: string; label: string; icon: React.ReactNode; onClick?: () => void; hint?: string; footer: React.ReactNode; children: React.ReactNode;
}> = ({ tone, label, icon, onClick, hint, footer, children }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} title={hint} className={`${card} ${tone} ${onClick ? clickable : ''}`}>
      <span className="flex items-center justify-between gap-2 w-full">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{label}</span>
        {icon}
      </span>
      <span className="flex items-baseline gap-2 mt-1.5 text-2xl font-bold tabular-nums leading-none text-slate-900 dark:text-white">{children}</span>
      <span className="block w-full mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.06] text-xs text-slate-500 dark:text-slate-400">{footer}</span>
    </Tag>
  );
};

const Row: React.FC<{ label: string; count: number; max: number; total: number; selected: boolean; onClick: () => void; note?: string }> = (
  { label, count, max, total, selected, onClick, note },
) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`w-full text-left p-2.5 rounded-lg border transition-colors ${clickable} ${
      selected ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-100 dark:border-white/[0.06]'
    }`}
  >
    <span className="flex items-center justify-between gap-2 text-xs mb-1.5">
      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
        {label}
        {note && <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">{note}</span>}
      </span>
      <span className="tabular-nums shrink-0 text-slate-900 dark:text-white font-bold">
        {count} <span className="font-medium text-slate-400">({percent(count, total)}%)</span>
      </span>
    </span>
    <span className="block w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      {count > 0 && <span className="block h-full bg-emerald-600 dark:bg-emerald-500" style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />}
    </span>
  </button>
);

export const LibraryOverview: React.FC<LibraryOverviewProps> = ({
  stats, units, isGuest, selectedUnit, selectedCategory, selectedYear,
  onSelectUnit, onSelectCategory, onSelectYear, onReset, onOpenHistory,
}) => {
  const [tab, setTab] = useState<'category' | 'year'>('category');
  const total = stats?.total ?? 0;

  // Gộp số tài liệu của đơn vị con vào phòng, ban trực thuộc Trường
  const unitRows = useMemo(() => {
    const counts = new Map((stats?.by_unit || []).map((u) => [u.unit_id || '', u.count]));
    const children = new Map<string, string[]>();
    units.forEach((u) => {
      if (u.parent_id) children.set(u.parent_id, [...(children.get(u.parent_id) || []), u.unit_id]);
    });
    return getSchoolDepartmentsTree(units)
      .filter((d) => d.level === 0 || d.level === undefined)
      .map((d) => {
        const ids = new Set([d.unit_id]);
        const queue = [d.unit_id];
        while (queue.length) {
          (children.get(queue.shift()!) || []).forEach((id) => {
            if (!ids.has(id)) { ids.add(id); queue.push(id); }
          });
        }
        if (d.unit_id === 'U-BGH' || d.unit_id === 'BGH-TQSQK') SCHOOL_BOARD_UNITS.forEach((id) => ids.add(id));
        const count = [...ids].reduce((sum, id) => sum + (counts.get(id) || 0), 0);
        return { unit_id: d.unit_id, name: d.unit_id === 'U-BGH' ? 'Ban Giám hiệu' : d.name, count, raw: d };
      })
      .sort((a, b) => b.count - a.count
        || getMilitaryUnitSortWeight(a.raw) - getMilitaryUnitSortWeight(b.raw)
        || a.name.localeCompare(b.name, 'vi'));
  }, [stats, units]);

  const contributing = unitRows.filter((u) => u.count > 0).length;
  const outside = Math.max(0, total - unitRows.reduce((sum, u) => sum + u.count, 0));
  const maxUnit = Math.max(1, ...unitRows.map((u) => u.count));
  const categories = stats?.by_category || [];
  const years = (stats?.by_year || []).filter((y) => y.year !== null);
  const noYear = (stats?.by_year || []).find((y) => y.year === null)?.count || 0;
  const standardized = percent(stats?.standardized ?? 0, total);
  const mine = stats?.my_reading;
  const iconBox = 'p-1.5 rounded-lg shrink-0';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card
          tone="border-l-emerald-600"
          label="Tổng tài liệu thư viện"
          icon={<span className={`${iconBox} bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`}><FolderKanban className="w-4 h-4" /></span>}
          onClick={onReset}
          hint="Bỏ mọi bộ lọc và xem tất cả"
          footer={`${formatFileSize(stats?.total_bytes ?? 0)} • ${stats?.new_30_days ? `+${stats.new_30_days} tài liệu mới (30 ngày)` : 'Chưa có tài liệu mới trong 30 ngày'}`}
        >
          <RollingNumber value={total} /> <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">tài liệu</span>
        </Card>

        <Card
          tone="border-l-amber-500"
          label="Đơn vị đóng góp tài liệu"
          icon={<span className={`${iconBox} bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400`}><Building2 className="w-4 h-4" /></span>}
          footer={unitRows.length - contributing > 0 ? `${unitRows.length - contributing} đơn vị chưa có tài liệu` : 'Mọi đơn vị đều đã có tài liệu'}
        >
          <RollingNumber value={contributing} />
          <span className="text-base font-normal text-slate-400">/{unitRows.length}</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">đơn vị</span>
        </Card>

        <Card
          tone="border-l-sky-600"
          label={isGuest ? 'Quyền khai thác' : 'Việc đọc của bạn'}
          icon={<span className={`${iconBox} bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400`}><BookOpenCheck className="w-4 h-4" /></span>}
          onClick={isGuest ? undefined : onOpenHistory}
          hint={isGuest ? undefined : 'Mở trang Sách đã đọc'}
          footer={isGuest
            ? 'Đăng nhập để hệ thống nhớ trang bạn đang đọc'
            : mine ? `${mine.completed} tài liệu đã đọc xong • bấm để đọc tiếp` : 'Chưa bật lưu tiến độ đọc'}
        >
          {isGuest ? (
            <><RollingNumber value={total} /> <span className="text-xs font-medium text-sky-700 dark:text-sky-400">mở cho mọi người</span></>
          ) : (
            <><RollingNumber value={mine?.reading ?? 0} /> <span className="text-xs font-medium text-sky-700 dark:text-sky-400">đang đọc</span></>
          )}
        </Card>

        <Card
          tone="border-l-slate-500"
          label="Tình trạng biên mục"
          icon={<span className={`${iconBox} bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300`}><Activity className="w-4 h-4" /></span>}
          hint="Tài liệu đã ghi đủ tác giả, đơn vị quản lý và năm xuất bản"
          footer={`Cập nhật cuối: ${stats?.latest_at ? formatDate(stats.latest_at) : 'chưa có tài liệu'}`}
        >
          <RollingNumber value={standardized} />
          <span className="text-base">%</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">đủ thông tin</span>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className={`lg:col-span-7 ${panel}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-slate-100 dark:border-white/[0.06]">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              Phân bổ theo đơn vị
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{unitRows.length} đơn vị trực thuộc</span>
          </div>
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {unitRows.map((u) => (
              <Row
                key={u.unit_id}
                label={u.name}
                count={u.count}
                max={maxUnit}
                total={total}
                note={u.count === 0 ? 'Chưa có tài liệu' : undefined}
                selected={selectedUnit === u.unit_id}
                onClick={() => onSelectUnit(selectedUnit === u.unit_id ? undefined : u.unit_id)}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Bấm một đơn vị để lọc danh sách bên dưới.
            {outside > 0 && ` ${outside} tài liệu thuộc đơn vị khác hoặc chưa ghi đơn vị.`}
          </p>
        </section>

        <section className={`lg:col-span-5 ${panel}`}>
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              Cơ cấu thư viện
            </h2>
            <SegmentedTabs<'category' | 'year'>
              ariaLabel="Cách phân nhóm cơ cấu thư viện"
              size="xs"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'category', label: 'Thể loại', activeTone: 'emerald-text' },
                { value: 'year', label: 'Năm xuất bản', activeTone: 'emerald-text' },
              ]}
            />
          </div>
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {tab === 'category' && categories.map((c) => (
              <Row
                key={c.category_id}
                label={c.name}
                count={c.count}
                max={Math.max(1, ...categories.map((x) => x.count))}
                total={total}
                selected={selectedCategory === c.category_id}
                onClick={() => onSelectCategory(selectedCategory === c.category_id ? undefined : c.category_id)}
              />
            ))}
            {tab === 'year' && years.map((y) => (
              <Row
                key={y.year}
                label={`Năm ${y.year}`}
                count={y.count}
                max={Math.max(1, ...years.map((x) => x.count))}
                total={total}
                selected={selectedYear === y.year}
                onClick={() => onSelectYear(selectedYear === y.year ? undefined : (y.year as number))}
              />
            ))}
            {tab === 'year' && !years.length && <p className="text-sm text-slate-500 py-6 text-center">Chưa có tài liệu ghi năm xuất bản.</p>}
          </div>
          {tab === 'year' && noYear > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{noYear} tài liệu chưa ghi năm xuất bản.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default LibraryOverview;
