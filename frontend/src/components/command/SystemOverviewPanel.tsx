import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RotateCw, FileText, ClipboardCheck, Clock, ShieldAlert, Building2, Layers,
  GraduationCap, AlertTriangle, ChevronRight, ChevronDown, Lock, Gauge,
} from 'lucide-react';
import { StatCard } from '../dashboard/StatCard';
import { DistributionChart } from '../dashboard/DistributionChart';
import { commandService, CommandOverview } from '../../services/commandService';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { useAuth } from '../../hooks/useAuth';

const REFRESH_MS = 60_000;
const COLLAPSE_KEY = 'qk7_overview_collapsed';

const LECTURE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PENDING_FACULTY: 'Chờ khoa duyệt',
  PENDING_TRAINING: 'Chờ phòng đào tạo duyệt',
  PUBLISHED: 'Đã phát hành',
  REJECTED: 'Bị từ chối',
  ARCHIVED: 'Đã lưu trữ',
};
const LECTURE_STATUS_ORDER = ['PUBLISHED', 'PENDING_TRAINING', 'PENDING_FACULTY', 'DRAFT', 'REJECTED', 'ARCHIVED'];

const formatMinutes = (m: number): string => {
  const v = Math.max(0, Math.round(m || 0));
  const h = Math.floor(v / 60);
  const r = v % 60;
  if (h === 0) return `${r} phút`;
  return r === 0 ? `${h} giờ` : `${h} giờ ${r} phút`;
};

const readCollapsed = (): boolean => {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
};

const SectionTitle: React.FC<{
  icon: React.ReactNode; title: string; hint?: string; to?: string; toLabel?: string;
}> = ({ icon, title, hint, to, toLabel }) => (
  <div className="flex items-center justify-between gap-3 mb-3">
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-emerald-700 dark:text-emerald-400 shrink-0">{icon}</span>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{title}</h3>
      {hint && <span className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:inline">{hint}</span>}
    </div>
    {to && (
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline min-h-[44px] sm:min-h-0 shrink-0"
      >
        {toLabel || 'Xem chi tiết'} <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    )}
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode; danger?: boolean }> = ({ label, value, danger }) => (
  <li className="flex items-center justify-between py-2.5 text-sm">
    <span className="text-slate-700 dark:text-slate-300">{label}</span>
    <span className={`font-mono tabular-nums font-bold ${danger ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
      {value}
    </span>
  </li>
);

export interface SystemOverviewPanelProps {
  /** Đổi giá trị này để buộc tải lại (vd: nút Làm mới của trang chứa) */
  refreshSignal?: number;
}

/**
 * Tổng quan toàn hệ thống cho chỉ huy/quản lý (chỉ đọc).
 * Chỉ nên render khi người dùng có quyền COMMAND_VIEW; backend cũng kiểm tra lại.
 */
export const SystemOverviewPanel: React.FC<SystemOverviewPanelProps> = ({ refreshSignal = 0 }) => {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<CommandOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await commandService.getOverview();
      setData(res);
      setError(null);
      setTick((t) => t + 1);
    } catch (e: any) {
      setError(e?.message || 'Không tải được số liệu tổng quan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load, refreshSignal]);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* bỏ qua */ }
      return next;
    });
  };

  const levelItems = useMemo(
    () => (data?.by_level || []).map((l) => ({ id: l.level_id, label: l.name, count: l.n })), [data]);
  const unitItems = useMemo(
    () => (data?.by_unit || []).map((u) => ({ id: u.unit_id, label: u.name, count: u.n })), [data]);
  const typeItems = useMemo(
    () => (data?.by_type || []).map((t) => ({ id: t.type_id, label: t.name, count: t.n })), [data]);
  const lectureRows = useMemo(() => {
    const s = data?.lectures.by_status || {};
    const keys = [
      ...LECTURE_STATUS_ORDER.filter((k) => s[k] !== undefined),
      ...Object.keys(s).filter((k) => !LECTURE_STATUS_ORDER.includes(k)),
    ];
    return keys.map((k) => ({ key: k, label: LECTURE_STATUS_LABEL[k] || k, n: s[k] }));
  }, [data]);

  const pendingTotal = (data?.approvals.pending_requests || 0) + (data?.approvals.pending_proposals || 0);
  const published = data?.lectures.by_status?.PUBLISHED ?? 0;
  const t = data?.teaching;
  const sec = data?.security;
  const initialLoading = loading && !data;

  const scopeText = data?.scope.restricted
    ? `${user?.unit_name || data.scope.root_unit || 'Đơn vị của bạn'} và các đơn vị trực thuộc`
    : 'Toàn trường';

  return (
    <section
      aria-label="Tổng quan toàn hệ thống"
      className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-300/80 dark:border-white/[0.08] shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/10 border border-emerald-600/25 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
            <Gauge className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Tổng quan toàn hệ thống</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Phạm vi: {scopeText}
              {data && ` · Tài liệu đến cấp ${data.clearance}`}
              {data && ` · Cập nhật ${new Date(data.generated_at).toLocaleTimeString('vi-VN')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 min-h-[44px] sm:min-h-[36px] rounded-lg border border-slate-300 dark:border-white/15 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-60 transition-colors"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            className="inline-flex items-center gap-1.5 px-3 min-h-[44px] sm:min-h-[36px] rounded-lg border border-slate-300 dark:border-white/15 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            {collapsed ? 'Mở rộng' : 'Thu gọn'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 sm:px-5 pb-5 space-y-6">
          {error && (
            <div role="alert" className="rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 px-4 py-3 text-sm flex items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" onClick={load} className="font-semibold underline min-h-[44px] sm:min-h-0">Thử lại</button>
            </div>
          )}

          {data && data.degraded.length > 0 && (
            <div role="status" className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 px-4 py-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Một số khối số liệu chưa tải được ({data.degraded.join(', ')}). Các khối còn lại vẫn chính xác.</span>
            </div>
          )}

          {/* KPI chính */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Tài liệu số"
              value={data ? data.documents.total : '—'}
              icon={<FileText className="w-4 h-4" />}
              color="emerald"
              subtext={data ? `+${data.documents.new_7d} trong 7 ngày · +${data.documents.new_30d} trong 30 ngày` : undefined}
              loading={initialLoading}
              refreshKey={tick}
            />
            <StatCard
              label="Chờ phê duyệt"
              value={data ? pendingTotal : '—'}
              icon={<ClipboardCheck className="w-4 h-4" />}
              color="amber"
              subtext={data ? `${data.approvals.pending_proposals} đề xuất sửa · ${data.approvals.pending_requests} yêu cầu` : undefined}
              loading={initialLoading}
              refreshKey={tick}
            />
            <StatCard
              label="Bài giảng đã phát hành"
              value={data ? published : '—'}
              icon={<GraduationCap className="w-4 h-4" />}
              color="cyan"
              subtext={data ? `${lectureRows.reduce((a, r) => a + r.n, 0)} bài giảng trong phạm vi` : undefined}
              loading={initialLoading}
              refreshKey={tick}
            />
            <StatCard
              label="Giờ giảng hôm nay"
              value={t ? formatMinutes(t.minutes_today) : '—'}
              icon={<Clock className="w-4 h-4" />}
              color="emerald"
              subtext={t ? `${t.completed_today} ca hoàn thành · 30 ngày: ${formatMinutes(t.minutes_30d)}` : undefined}
              loading={initialLoading}
              refreshKey={tick}
            />
          </div>

          {/* Tài liệu */}
          <div>
            <SectionTitle
              icon={<FileText className="w-4 h-4" />}
              title="Hệ thống tài liệu"
              hint="Chỉ tính tài liệu trong cấp độ mật được phép xem"
              to={ROUTE_PATHS.MY_UNIT}
              toLabel="Mở tài liệu đơn vị"
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
              <DistributionChart title="Theo cấp độ mật" icon={<Lock className="w-4 h-4" />} items={levelItems} barColor="amber" refreshKey={tick} />
              <DistributionChart title="Theo đơn vị ban hành" icon={<Building2 className="w-4 h-4" />} items={unitItems} barColor="emerald" refreshKey={tick} />
              <DistributionChart title="Theo loại văn bản" icon={<Layers className="w-4 h-4" />} items={typeItems} barColor="blue" refreshKey={tick} />
            </div>
          </div>

          {/* Huấn luyện + An ninh */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] p-4">
              <SectionTitle
                icon={<GraduationCap className="w-4 h-4" />}
                title="Bài giảng số và ca dạy"
                to={hasPermission('LECTURE_VIEW') ? ROUTE_PATHS.LECTURES : undefined}
                toLabel="Mở bài giảng"
              />
              {lectureRows.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có bài giảng trong phạm vi này.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {lectureRows.map((r) => <Row key={r.key} label={r.label} value={r.n} />)}
                  <Row label="Ca đang diễn ra" value={t?.ongoing_now ?? 0} />
                  <Row label="Ca quá giờ (cần kiểm tra)" value={t?.hanging ?? 0} danger={(t?.hanging ?? 0) > 0} />
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] p-4">
              <SectionTitle
                icon={<ShieldAlert className="w-4 h-4" />}
                title="An ninh trong 24 giờ qua"
                hint="Chỉ số tổng hợp"
              />
              <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                <Row label="Đăng nhập thất bại" value={sec?.failed_logins_24h ?? 0} danger={(sec?.failed_logins_24h ?? 0) > 0} />
                <Row label="Cố chụp màn hình" value={sec?.screenshot_attempts_24h ?? 0} danger={(sec?.screenshot_attempts_24h ?? 0) > 0} />
                <Row label="Lượt xem tài liệu mật (từ cấp 3)" value={sec?.sensitive_views_24h ?? 0} />
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default SystemOverviewPanel;
