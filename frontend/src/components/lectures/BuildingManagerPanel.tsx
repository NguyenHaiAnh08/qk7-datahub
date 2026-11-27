import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Landmark,
  Building2,
  Pencil,
  Plus,
  Trash2,
  Check,
  RotateCw,
  Search,
  X,
  LayoutGrid,
  List,
  Info,
  ShieldCheck,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Tooltip } from 'antd';
import { lectureService } from '../../services/lectureService';
import { SegmentedTabs } from '../common/SegmentedTabs';
import { ClassroomBuilding } from '../../types/lecture';
import { toast } from '../common/Toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { TacticalEmptyState } from '../common/TacticalEmptyState';
import { PaginationBar } from '../common/PaginationBar';
import { usePageTransition } from '../common/PageTransitionStage';

interface Props {
  /** Có quyền thêm/sửa/xóa khu (CLASSROOM_MANAGE). Không có thì chỉ xem. */
  canManage?: boolean;
  /** Gọi sau khi thêm/sửa/xóa khu để trang cha tải lại danh sách khu và phòng học */
  onChanged?: () => void;
}

interface FormState {
  building_code: string;
  building_name: string;
  display_order: string;
  active: boolean;
}

const EMPTY_FORM: FormState = { building_code: '', building_name: '', display_order: '', active: true };

// ── Modal Thêm / Chỉnh Sửa Khu Giảng Đường Chuẩn Quân Đội ──
interface BuildingModalProps {
  open: boolean;
  editingBuilding: ClassroomBuilding | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: FormState) => Promise<void>;
  items: ClassroomBuilding[];
}

const BuildingFormModal: React.FC<BuildingModalProps> = ({
  open,
  editingBuilding,
  saving,
  onClose,
  onSave,
  items,
}) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (editingBuilding) {
      setForm({
        building_code: editingBuilding.building_code,
        building_name: editingBuilding.building_name,
        display_order: String(editingBuilding.display_order),
        active: editingBuilding.active,
      });
    } else {
      const nextOrder = items.length ? Math.max(...items.map((i) => i.display_order || 0)) + 10 : 10;
      setForm({ ...EMPTY_FORM, display_order: String(nextOrder) });
    }
  }, [editingBuilding, items, open]);

  if (typeof document === 'undefined' || !open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.building_code.trim()) {
      toast.error('Vui lòng nhập mã khu giảng đường');
      return;
    }
    if (!form.building_name.trim()) {
      toast.error('Vui lòng nhập tên khu giảng đường');
      return;
    }
    onSave(form);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/25 dark:bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={() => !saving && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal - Nền trắng tuyệt đối ở Light Mode */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {editingBuilding ? `Cập Nhật Khu Giảng Đường: ${editingBuilding.building_code}` : 'Thêm Khu Giảng Đường Mới'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {editingBuilding ? 'Chỉnh sửa thông tin và thứ tự hiển thị của khu' : 'Tạo mới khu để gắn kết các phòng học trên sơ đồ giám sát'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form - Nền trắng tuyệt đối ở Light Mode */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs bg-white dark:bg-[#111827]">
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Mã Khu Giảng Đường <span className="text-rose-500">*</span></span>
              <span className="text-[11px] font-normal text-slate-500">Mã định danh duy nhất (VD: H1, H2, HT, PM)</span>
            </label>
            <input
              type="text"
              required
              disabled={!!editingBuilding || saving}
              maxLength={20}
              placeholder="VD: H1, H2, HT, PM..."
              value={form.building_code}
              onChange={(e) => setForm({ ...form, building_code: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 font-mono font-black text-sm text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 dark:text-slate-200">
              Tên Khu Giảng Đường <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={saving}
              maxLength={100}
              placeholder="VD: Khu Giảng đường A, Khu Hội trường Quân sự..."
              value={form.building_name}
              onChange={(e) => setForm({ ...form, building_name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 dark:text-slate-200">
                Thứ Tự Hiển Thị
              </label>
              <input
                type="number"
                disabled={saving}
                placeholder="VD: 10, 20, 30..."
                value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 font-mono font-bold text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition disabled:opacity-60"
              />
              <span className="text-[10px] text-slate-500 block">Số nhỏ hiển thị trước trên sơ đồ</span>
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Trạng Thái Hoạt Động
              </label>
              <label className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition select-none">
                <input
                  type="checkbox"
                  disabled={saving}
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                  {form.active ? 'Đang sử dụng (Hiển thị)' : 'Tạm dừng (Ẩn sơ đồ)'}
                </span>
              </label>
            </div>
          </div>

          {/* Footer buttons (layout ở dưới thêm mới) - Nền trắng tuyệt đối khi ở light mode */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111827]">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-green-600 hover:from-emerald-600 hover:to-green-500 text-white font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-950/20 border border-emerald-400/30 transition active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{editingBuilding ? 'Lưu thay đổi' : 'Thêm khu mới'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export const BuildingManagerPanel: React.FC<Props> = ({ canManage = true, onChanged }) => {
  const [items, setItems] = useState<ClassroomBuilding[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<ClassroomBuilding | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<ClassroomBuilding | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lectureService.adminListBuildings();
      setItems(res.items || []);
      setLoadError(null);
      setRefreshKey((prev) => prev + 1);
    } catch (e: any) {
      setLoadError(e?.message || 'Không tải được danh sách khu giảng đường');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Telemetry KPIs
  const kpis = useMemo(() => {
    const total = items.length;
    const activeCount = items.filter((b) => b.active).length;
    const inactiveCount = total - activeCount;
    const totalRooms = items.reduce((sum, b) => sum + (b.room_count || 0), 0);
    return { total, activeCount, inactiveCount, totalRooms };
  }, [items]);

  // Lọc dữ liệu tức thì không giật lag
  const filteredItems = useMemo(() => {
    return items.filter((b) => {
      // 1. Lọc theo trạng thái
      if (statusFilter === 'active' && !b.active) return false;
      if (statusFilter === 'inactive' && b.active) return false;

      // 2. Tìm kiếm theo mã khu hoặc tên khu
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = (b.building_code || '').toLowerCase().includes(q);
        const matchName = (b.building_name || '').toLowerCase().includes(q);
        if (!matchCode && !matchName) return false;
      }

      return true;
    });
  }, [items, statusFilter, searchQuery]);

  // ── Phân trang: tối đa 30 khu giảng đường / trang, khu thứ 31 sang trang 2 ──
  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const gridRef = usePageTransition<HTMLDivElement>(currentPage, { cols: 4, mode: 'grid' });
  const tbodyRef = usePageTransition<HTMLTableSectionElement>(currentPage, { mode: 'row' });
  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  const handleOpenCreate = () => {
    setEditingBuilding(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (b: ClassroomBuilding) => {
    setEditingBuilding(b);
    setModalOpen(true);
  };

  const handleSave = async (form: FormState) => {
    setSaving(true);
    try {
      const order = form.display_order.trim() === '' ? 0 : Number(form.display_order);
      if (editingBuilding) {
        await lectureService.adminUpdateBuilding(editingBuilding.building_code, {
          building_name: form.building_name.trim(),
          display_order: order,
          active: form.active,
        });
        toast.success(`Đã cập nhật khu "${form.building_name}" thành công!`);
      } else {
        await lectureService.adminCreateBuilding({
          building_code: form.building_code.trim(),
          building_name: form.building_name.trim(),
          display_order: order,
        });
        toast.success(`Đã thêm mới khu "${form.building_name}" thành công!`);
      }
      setModalOpen(false);
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi lưu khu giảng đường');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (b: ClassroomBuilding) => {
    if (b.room_count > 0) {
      toast.error(
        `Khu "${b.building_name}" hiện đang quản lý ${b.room_count} phòng học. Đồng chí phải chuyển các phòng sang khu khác trước khi xóa khu!`,
        { title: 'KHÔNG THỂ XÓA KHU' }
      );
      return;
    }
    setDeleteTarget(b);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await lectureService.adminDeleteBuilding(deleteTarget.building_code);
      toast.success(`Đã xóa vĩnh viễn khu "${deleteTarget.building_name}"!`);
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xóa khu giảng đường');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── 1. KHỐI LƯU Ý AN TOÀN QUÂN SỰ (ĐƯỢC ĐƯA LÊN TRÊN BỘ LỌC FILTER) ── */}
      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300/80 dark:border-amber-700/50 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <Info className="w-4 h-4 stroke-[2.2]" />
        </div>
        <div className="space-y-1">
          <div className="font-extrabold text-xs uppercase tracking-wide">
            Quy tắc an toàn dữ liệu cơ sở vật chất đào tạo
          </div>
          <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
            Khu giảng đường đang chứa phòng học sẽ <strong>không được phép xóa</strong> nhằm đảm bảo toàn vẹn dữ liệu lịch sử giảng dạy và nhật ký quân sự. Để xóa một khu, đồng chí vui lòng chuyển toàn bộ phòng học sang khu khác (tại mục "Quản lý Giảng đường") hoặc tạm tắt trạng thái hoạt động để ẩn khu khỏi Sơ đồ giám sát.
          </p>
        </div>
      </div>

      {/* ── 2. THANH CÔNG CỤ ĐIỀU KHIỂN & BỘ LỌC ── */}
      <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
          {/* Ô Tìm Kiếm */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm theo mã khu, tên khu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Chips Lọc Trạng Thái */}
          <SegmentedTabs
            ariaLabel="Lọc theo trạng thái khu giảng đường"
            value={statusFilter}
            onChange={setStatusFilter}
            className="shrink-0"
            items={[
              { value: 'all', label: 'Tất cả', count: kpis.total, activeTone: 'neutral' },
              { value: 'active', label: 'Đang dùng', count: kpis.activeCount, activeTone: 'emerald' },
              { value: 'inactive', label: 'Đã tắt', count: kpis.inactiveCount, activeTone: 'amber' },
            ]}
          />
        </div>

        {/* Nút View Mode, Làm mới, Thêm khu */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {/* View mode toggle */}
          <SegmentedTabs
            ariaLabel="Chế độ hiển thị khu giảng đường"
            size="xs"
            iconOnly
            value={viewMode}
            onChange={setViewMode}
            items={[
              {
                value: 'table',
                icon: <List className="w-4 h-4" />,
                title: 'Dạng bảng chi tiết',
                ariaLabel: 'Hiển thị dạng bảng chi tiết',
                activeTone: 'emerald-text',
              },
              {
                value: 'grid',
                icon: <LayoutGrid className="w-4 h-4" />,
                title: 'Dạng thẻ khu trực quan',
                ariaLabel: 'Hiển thị dạng thẻ khu trực quan',
                activeTone: 'emerald-text',
              },
            ]}
          />

          <button
            type="button"
            onClick={load}
            disabled={loading}
            title="Làm mới dữ liệu"
            className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canManage && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-gradient-to-r from-emerald-700 via-emerald-600 to-green-600 hover:from-emerald-600 hover:to-green-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/20 border border-emerald-400/30 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Thêm khu mới</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 3. LỖI KẾT NỐI (NẾU CÓ) ── */}
      {loadError && (
        <div role="alert" className="rounded-2xl border-2 border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 p-4 text-xs font-bold flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* ── 4. NỘI DUNG HIỂN THỊ (TABLE HOẶC GRID) ── */}
      {loading && items.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <RotateCw className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Đang tải danh mục khu giảng đường...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <TacticalEmptyState
            title="Chưa tìm thấy khu giảng đường nào"
            description={
              searchQuery
                ? `Không có khu giảng đường nào khớp với từ khóa "${searchQuery}". Đồng chí vui lòng thử từ khóa khác.`
                : 'Hiện chưa có khu giảng đường nào trong danh mục. Bấm "Thêm khu mới" để khởi tạo khu đầu tiên.'
            }
            searchQuery={searchQuery}
            onClearFilters={searchQuery ? () => setSearchQuery('') : undefined}
            onRefresh={load}
          />
        </div>
      ) : viewMode === 'grid' ? (
        /* ── DẠNG THẺ KHU (GRID CARDS) — HIỆN ĐẠI, TRỰC QUAN ── */
        <div ref={gridRef} className="u043 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pagedItems.map((b) => (
            <div
              key={b.building_code}
              className={`rounded-2xl border-2 p-5 flex flex-col justify-between transition-all duration-200 bg-white dark:bg-[#111827] shadow-xs hover:shadow-md ${
                b.active
                  ? 'border-slate-300 dark:border-slate-700/80 hover:border-emerald-500/60'
                  : 'border-slate-200 dark:border-slate-800/80 opacity-75 bg-slate-50/50 dark:bg-slate-900/30'
              }`}
            >
              <div>
                {/* Header Card: Mã khu & Badge Trạng thái */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
                  <span className="font-mono font-black text-sm px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white border border-slate-300 dark:border-slate-700 shadow-2xs">
                    {b.building_code}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1.5 shadow-2xs ${
                      b.active
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-400 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-600'
                        : 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}
                  >
                    {b.active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />}
                    <span>{b.active ? 'Đang dùng' : 'Đã tắt'}</span>
                  </span>
                </div>

                {/* Tên khu to đậm */}
                <div className="mt-3.5">
                  <h4 className="font-black text-base text-slate-950 dark:text-white leading-snug line-clamp-1" title={b.building_name}>
                    {b.building_name}
                  </h4>
                </div>

                {/* Chi tiết: Số phòng & Thứ tự */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Số phòng</span>
                      <strong className="font-mono font-black text-slate-900 dark:text-white text-xs">
                        {b.room_count} phòng
                      </strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Thứ tự</span>
                      <strong className="font-mono font-black text-slate-900 dark:text-white text-xs">
                        #{b.display_order}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {canManage && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(b)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                    <span>Sửa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClick(b)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                      b.room_count > 0
                        ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60'
                        : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/50'
                    }`}
                    title={b.room_count > 0 ? 'Khu còn phòng học, không thể xóa' : 'Xóa khu này'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* ── DẠNG BẢNG (TABLE VIEW) — SẮC NÉT, ĐỘ TƯƠNG PHẢN CAO ── */
        <div className="rounded-2xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 text-xs font-extrabold uppercase tracking-wider border-b-2 border-slate-300 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4 w-24">MÃ KHU</th>
                  <th className="py-3 px-4">TÊN KHU GIẢNG ĐƯỜNG</th>
                  <th className="py-3 px-4 text-center w-36">SỐ PHÒNG HỌC</th>
                  <th className="py-3 px-4 text-center w-28">THỨ TỰ</th>
                  <th className="py-3 px-4 w-36">TRẠNG THÁI</th>
                  {canManage && <th className="py-3 px-4 text-right w-36">THAO TÁC</th>}
                </tr>
              </thead>
              <tbody ref={tbodyRef} className="divide-y divide-slate-200 dark:divide-white/[0.08] font-medium">
                {pagedItems.map((b) => (
                  <tr
                    key={b.building_code}
                    className={`transition-colors ${
                      b.active
                        ? 'hover:bg-slate-50/90 dark:hover:bg-slate-800/50'
                        : 'opacity-70 bg-slate-50/40 dark:bg-slate-900/30 hover:bg-slate-100/60'
                    }`}
                  >
                    {/* Mã khu */}
                    <td className="py-3.5 px-4 font-mono font-black text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white border border-slate-300 dark:border-slate-700 shadow-2xs">
                        {b.building_code}
                      </span>
                    </td>

                    {/* Tên khu */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-sm text-slate-950 dark:text-white">
                        {b.building_name}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Khu hiển thị trên Sơ đồ Radar
                      </div>
                    </td>

                    {/* Số phòng */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 inline-flex items-center gap-1 shadow-2xs">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{b.room_count} phòng</span>
                      </span>
                    </td>

                    {/* Thứ tự */}
                    <td className="py-3.5 px-4 text-center font-mono font-black text-slate-700 dark:text-slate-300">
                      #{b.display_order}
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-black border inline-flex items-center gap-1.5 shadow-2xs ${
                          b.active
                            ? 'bg-emerald-100 text-emerald-950 border-emerald-400 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-600'
                            : 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        {b.active && <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />}
                        <span>{b.active ? 'Đang dùng' : 'Đã tắt'}</span>
                      </span>
                    </td>

                    {/* Thao tác */}
                    {canManage && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Tooltip title="Hiệu chỉnh thông tin khu">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(b)}
                              className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition active:scale-95 cursor-pointer shadow-2xs"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>

                          <Tooltip title={b.room_count > 0 ? 'Khu còn phòng học, không thể xóa' : 'Xóa khu giảng đường'}>
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(b)}
                              className={`p-1.5 rounded-lg border transition active:scale-95 cursor-pointer shadow-2xs ${
                                b.room_count > 0
                                  ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60'
                                  : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/50'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── THANH PHÂN TRANG: Tối đa 30 khu giảng đường / trang, khu thứ 31 sang trang 2 ── */}
      {filteredItems.length > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-[#111827] px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <div>
            Đang hiển thị khu{' '}
            <strong className="text-slate-900 dark:text-white font-bold font-mono">
              {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredItems.length)}
            </strong>{' '}
            / <span className="font-mono">{filteredItems.length}</span> — Tổng số{' '}
            <strong className="text-emerald-700 dark:text-emerald-400 font-bold font-mono">
              {filteredItems.length}
            </strong>{' '}
            khu giảng đường (Trang <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{currentPage}/{totalPages}</span>)
          </div>

          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

      {/* ── MODALS ── */}
      <BuildingFormModal
        open={modalOpen}
        editingBuilding={editingBuilding}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        items={items}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="XÁC NHẬN XÓA KHU GIẢNG ĐƯỜNG"
        message={`Đồng chí có chắc chắn muốn xóa vĩnh viễn khu "${deleteTarget?.building_name}" (Mã: ${deleteTarget?.building_code}) khỏi cơ sở dữ liệu? Thao tác này không thể hoàn tác!`}
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default BuildingManagerPanel;
