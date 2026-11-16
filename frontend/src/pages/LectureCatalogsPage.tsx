// frontend/src/pages/LectureCatalogsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Minus,
  Pencil,
  Trash2,
  BookOpen,
  GraduationCap,
  Building2,
  RotateCw,
  Search,
  X,
  Check,
  Building,
  Users,
  Shield,
  Info,
  Hash,
  Tag,
  Monitor,
  Presentation,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TreeSelect } from 'antd';
import { Unit } from '../types/user';
import { unitService } from '../services/unitService';
import { buildUnitTree, filterSchoolUnits } from '../utils/unitTree';
import { lectureService } from '../services/lectureService';
import { toast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

type CatalogType = 'subjects' | 'classes' | 'classrooms';

interface Props {
  catalogType: CatalogType;
}

const META: Record<CatalogType, {
  title: string;
  subtitle: string;
  icon: any;
  pkField: string;
  nameField: string;
  codeField?: string;
  badgeColor: string;
  service: {
    list: () => Promise<any>;
    create: (d: any) => Promise<any>;
    update: (id: string, d: any) => Promise<any>;
    remove: (id: string) => Promise<any>;
  };
}> = {
  subjects: {
    title: 'Quản Lý Môn Học',
    subtitle: 'Danh mục môn học, học phần huấn luyện và giáo trình chuyên ngành',
    icon: BookOpen,
    pkField: 'subject_id',
    nameField: 'name',
    codeField: 'subject_code',
    badgeColor: 'sky',
    service: {
      list: lectureService.adminListSubjects.bind(lectureService),
      create: lectureService.adminCreateSubject.bind(lectureService),
      update: lectureService.adminUpdateSubject.bind(lectureService),
      remove: lectureService.adminDeleteSubject.bind(lectureService),
    },
  },
  classes: {
    title: 'Quản Lý Lớp Học',
    subtitle: 'Danh mục lớp học viên, đại đội, trung đội đào tạo và quân số cố định',
    icon: GraduationCap,
    pkField: 'class_id',
    nameField: 'class_name',
    badgeColor: 'emerald',
    service: {
      list: lectureService.adminListClasses.bind(lectureService),
      create: lectureService.adminCreateClass.bind(lectureService),
      update: lectureService.adminUpdateClass.bind(lectureService),
      remove: lectureService.adminDeleteClass.bind(lectureService),
    },
  },
  classrooms: {
    title: 'Quản Lý Giảng Đường',
    subtitle: 'Danh mục giảng đường, phòng máy, phòng hội thảo và sức chứa chỗ ngồi',
    icon: Building2,
    pkField: 'room_id',
    nameField: 'room_name',
    badgeColor: 'amber',
    service: {
      list: lectureService.adminListClassrooms.bind(lectureService),
      create: lectureService.adminCreateClassroom.bind(lectureService),
      update: lectureService.adminUpdateClassroom.bind(lectureService),
      remove: lectureService.adminDeleteClassroom.bind(lectureService),
    },
  },
};

const SECURITY_LEVEL_LABELS: Record<number, { label: string; badge: string }> = {
  1: { label: 'Cấp 1 - Công khai', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30' },
  2: { label: 'Cấp 2 - Nội bộ', badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30' },
  3: { label: 'Cấp 3 - Mật', badge: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30' },
  4: { label: 'Cấp 4 - Tối Mật', badge: 'bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30' },
  5: { label: 'Cấp 5 - Tuyệt Mật', badge: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30' },
};

const ROOM_TYPE_CONFIG: Record<string, { label: string; icon: any; badge: string }> = {
  LECTURE_HALL: { label: 'Giảng đường', icon: Presentation, badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30' },
  COMPUTER_LAB: { label: 'Phòng máy', icon: Monitor, badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30' },
  SEMINAR: { label: 'Hội thảo', icon: Users, badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30' },
};

export const LectureCatalogsPage: React.FC<Props> = ({ catalogType }) => {
  const cfg = META[catalogType];
  const Icon = cfg.icon;

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);

  // ── Cây đơn vị cho TreeSelect (Đơn vị phụ trách môn học & Đơn vị quản lý lớp học) ──
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);

  useEffect(() => {
    unitService
      .getUnits()
      .then((res: any) => setAvailableUnits(res.items || res || []))
      .catch((err) => console.error('Lỗi tải danh mục đơn vị:', err));
  }, []);

  const selectedUnitId = catalogType === 'subjects' ? form.faculty_unit_id : form.unit_id;
  const filteredUnits = useMemo(
    () => filterSchoolUnits(availableUnits, selectedUnitId),
    [availableUnits, selectedUnitId]
  );
  const unitTree = useMemo(() => buildUnitTree(filteredUnits), [filteredUnits]);

  // Thu gọn mặc định: Chỉ mở Level 0 (Quân khu) và Level 1 (Nhà trường)
  const defaultExpandedKeys = useMemo(() => {
    const keys: string[] = [];
    for (const root of unitTree) {
      if (root.children && root.children.length > 0) {
        keys.push(String(root.key));
        for (const child of root.children) {
          if (child.children && child.children.length > 0) {
            keys.push(String(child.key));
          }
        }
      }
    }
    if (selectedUnitId) {
      const findAncestors = (nodes: any[], targetId: string, currentPath: string[]): boolean => {
        for (const n of nodes) {
          if (String(n.key) === targetId || String(n.value) === targetId) {
            keys.push(...currentPath);
            return true;
          }
          if (n.children && n.children.length > 0) {
            if (findAncestors(n.children, targetId, [...currentPath, String(n.key)])) {
              return true;
            }
          }
        }
        return false;
      };
      findAncestors(unitTree, selectedUnitId, []);
    }
    return Array.from(new Set(keys));
  }, [unitTree, selectedUnitId]);

  const [treeExpandedKeys, setTreeExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (modalOpen && defaultExpandedKeys.length > 0) {
      setTreeExpandedKeys(defaultExpandedKeys);
    }
  }, [modalOpen, defaultExpandedKeys]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await cfg.service.list();
      setItems(res.items || []);
    } catch (e: any) {
      toast.error('Lỗi tải dữ liệu: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setRoomTypeFilter('all');
    load();
    /* eslint-disable-next-line */
  }, [catalogType]);

  // Bộ lọc dữ liệu tức thời
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Lọc theo trạng thái active
      if (statusFilter === 'active' && item.active === false) return false;
      if (statusFilter === 'inactive' && item.active !== false) return false;

      // 2. Lọc theo loại phòng (đối với giảng đường)
      if (catalogType === 'classrooms' && roomTypeFilter !== 'all') {
        if (item.room_type !== roomTypeFilter) return false;
      }

      // 3. Tìm kiếm theo từ khóa
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchPk = String(item[cfg.pkField] || '').toLowerCase().includes(q);
      const matchName = String(item[cfg.nameField] || '').toLowerCase().includes(q);
      const matchCode = cfg.codeField ? String(item[cfg.codeField] || '').toLowerCase().includes(q) : false;
      const matchBuilding = String(item.building_name || '').toLowerCase().includes(q);
      const matchUnit = String(item.unit_name || item.faculty_name || '').toLowerCase().includes(q);

      return matchPk || matchName || matchCode || matchBuilding || matchUnit;
    });
  }, [items, searchQuery, statusFilter, roomTypeFilter, cfg, catalogType]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      active: true,
      security_level_id: '',
      course_year: '',
      room_type: 'LECTURE_HALL',
      faculty_unit_id: '',
      unit_id: '',
    });
    setModalOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setForm({ ...row });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (catalogType === 'subjects' && !form.security_level_id) {
      toast.error('Vui lòng chọn cấp độ bảo mật cho môn học');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await cfg.service.update(editing[cfg.pkField], form);
        toast.success(`Đã cập nhật ${cfg.title.toLowerCase()}`);
      } else {
        await cfg.service.create(form);
        toast.success(`Đã thêm mới ${cfg.title.toLowerCase()}`);
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      toast.error('Lỗi lưu dữ liệu: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const res: any = await cfg.service.remove(deleteItem[cfg.pkField]);
      toast.success(res?.soft_deleted ? (res.note || 'Đã ẩn khỏi danh mục') : 'Đã xóa bản ghi');
      setDeleteItem(null);
      await load();
    } catch (e: any) {
      toast.error('Lỗi khi xóa: ' + e.message);
      setDeleteItem(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── 1. HEADER & ACTION CONTROLS ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 dark:from-emerald-500/30 dark:to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
            <Icon className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {cfg.title}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
              {cfg.subtitle}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
            title="Làm mới dữ liệu"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden xs:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs hover:shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm mới</span>
          </button>
        </div>
      </div>



      {/* ── 3. SEARCH & FILTER TOOLBAR ── */}
      <div className="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Tìm kiếm ${cfg.title.toLowerCase()} theo mã, tên, đơn vị...`}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {/* Bộ lọc trạng thái */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400'
              }`}
            >
              Đang dùng
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Đã ẩn
            </button>
          </div>

          {/* Bộ lọc loại phòng (nếu là giảng đường) */}
          {catalogType === 'classrooms' && (
            <select
              value={roomTypeFilter}
              onChange={(e) => setRoomTypeFilter(e.target.value)}
              className="py-1 px-2.5 text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 shrink-0 cursor-pointer"
            >
              <option value="all">Tất cả loại phòng</option>
              <option value="LECTURE_HALL">🏛️ Giảng đường</option>
              <option value="COMPUTER_LAB">💻 Phòng máy</option>
              <option value="SEMINAR">🎙️ Hội thảo</option>
            </select>
          )}
        </div>
      </div>

      {/* ── 4. TACTICAL DATA TABLE ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[720px]">
            <thead className="bg-slate-50/90 dark:bg-slate-800/60 text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 select-none">
              <tr>
                {catalogType === 'subjects' && (
                  <>
                    <th className="py-3 px-4 w-28">Mã môn</th>
                    <th className="py-3 px-4 w-28">Mã số</th>
                    <th className="py-3 px-4">Tên môn học</th>
                    <th className="py-3 px-4">Đơn vị</th>
                    <th className="py-3 px-4 w-36">Cấp bảo mật</th>
                    <th className="py-3 px-4 w-32">Trạng thái</th>
                  </>
                )}

                {catalogType === 'classes' && (
                  <>
                    <th className="py-3 px-4 w-28">Mã lớp</th>
                    <th className="py-3 px-4">Tên lớp học</th>
                    <th className="py-3 px-4">Đơn vị quản lý</th>
                    <th className="py-3 px-4 w-24">Khóa</th>
                    <th className="py-3 px-4 w-32">Sĩ số cố định</th>
                    <th className="py-3 px-4 w-32">Trạng thái</th>
                  </>
                )}

                {catalogType === 'classrooms' && (
                  <>
                    <th className="py-3 px-4 w-28">Mã phòng</th>
                    <th className="py-3 px-4">Tên giảng đường</th>
                    <th className="py-3 px-4 w-32">Tòa nhà</th>
                    <th className="py-3 px-4 w-36">Loại phòng</th>
                    <th className="py-3 px-4 w-32">Sức chứa</th>
                    <th className="py-3 px-4 w-32">Trạng thái</th>
                  </>
                )}

                <th className="py-3 px-4 text-right w-24">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCw className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-semibold">Đang nạp dữ liệu {cfg.title.toLowerCase()}...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có bản ghi nào'}
                      </span>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        {searchQuery
                          ? 'Vui lòng kiểm tra lại từ khóa hoặc xóa bộ lọc để xem toàn bộ danh mục.'
                          : 'Bấm nút "Thêm mới" ở góc trên bên phải để tạo bản ghi đầu tiên.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((row) => {
                  const pkVal = row[cfg.pkField];
                  const isActive = row.active !== false;

                  return (
                    <tr
                      key={pkVal}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Cột dữ liệu chuyên biệt theo từng catalog */}
                      {catalogType === 'subjects' && (
                        <>
                          <td className="py-3 px-4 font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 tabular-nums">
                              {row.subject_id}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {row.subject_code || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              <span>{row.name}</span>
                            </div>
                            {row.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                {row.description}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {row.faculty_name || row.faculty_unit_id || '—'}
                          </td>
                          <td className="py-3 px-4">
                            {(() => {
                              const secCfg = SECURITY_LEVEL_LABELS[row.security_level_id] || SECURITY_LEVEL_LABELS[2];
                              return (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${secCfg.badge}`}>
                                  <Shield className="w-3 h-3" />
                                  <span>{secCfg.label}</span>
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge active={isActive} />
                          </td>
                        </>
                      )}

                      {catalogType === 'classes' && (
                        <>
                          <td className="py-3 px-4 font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 tabular-nums">
                              {row.class_id}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{row.class_name}</span>
                            </div>
                            {row.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                {row.description}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {row.unit_name || row.unit_id || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                            {row.course_year || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {row.student_total != null ? (
                              <span className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                                <Users className="w-3 h-3 text-slate-400" />
                                <span>{row.student_total} học viên</span>
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge active={isActive} />
                          </td>
                        </>
                      )}

                      {catalogType === 'classrooms' && (
                        <>
                          <td className="py-3 px-4 font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 tabular-nums">
                              {row.room_id}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{row.room_name}</span>
                            </div>
                            {row.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                {row.description}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {row.building_name ? (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                                {row.building_name}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {(() => {
                              const rType = ROOM_TYPE_CONFIG[row.room_type] || ROOM_TYPE_CONFIG.LECTURE_HALL;
                              const RIcon = rType.icon;
                              return (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${rType.badge}`}>
                                  <RIcon className="w-3 h-3" />
                                  <span>{rType.label}</span>
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {row.capacity != null ? (
                              <span className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                                <Users className="w-3 h-3 text-slate-400" />
                                <span>{row.capacity} chỗ</span>
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge active={isActive} />
                          </td>
                        </>
                      )}

                      {/* Cột thao tác */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer active:scale-95 shadow-2xs"
                            title="Chỉnh sửa bản ghi"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteItem(row)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 transition cursor-pointer active:scale-95 shadow-2xs"
                            title="Xóa khỏi danh mục"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. COMPACT RESPONSIVE MODAL (THÊM MỚI / CHỈNH SỬA) ── */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {modalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {editing ? 'Chỉnh sửa' : 'Thêm mới'} — {cfg.title}
                    </h3>
                    <p className="text-[10.5px] text-slate-400">
                      Điền thông số chuẩn hóa và bấm "Lưu lại" để cập nhật hệ thống
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body Form: 2-Column Responsive Compact Grid */}
              <form onSubmit={handleSave}>
                <div className="p-4 sm:p-5 space-y-3.5">
                  {/* FORM MÔN HỌC */}
                  {catalogType === 'subjects' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormInput
                        label="Mã môn học"
                        required
                        disabled={!!editing}
                        value={form.subject_id || ''}
                        onChange={(val) => setForm({ ...form, subject_id: val })}
                        placeholder="VD: SUB-01"
                        icon={Hash}
                      />
                      <FormInput
                        label="Mã số học phần"
                        value={form.subject_code || ''}
                        onChange={(val) => setForm({ ...form, subject_code: val })}
                        placeholder="VD: CT-101"
                        icon={Tag}
                      />
                      <div className="sm:col-span-2">
                        <FormInput
                          label="Tên môn học"
                          required
                          value={form.name || ''}
                          onChange={(val) => setForm({ ...form, name: val })}
                          placeholder="VD: Chiến thuật Bộ binh"
                          icon={BookOpen}
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          <Building className="w-3 h-3 text-slate-400" />
                          <span>Đơn vị phụ trách</span>
                        </label>
                        <div className="unit-treeselect-wrapper" style={{ position: 'relative', width: '100%' }}>
                          <TreeSelect
                            value={form.faculty_unit_id || undefined}
                            onChange={(val) => setForm({ ...form, faculty_unit_id: val || '' })}
                            treeData={unitTree}
                            placeholder="Chọn đơn vị phụ trách"
                            allowClear={{
                              clearIcon: (
                                <span
                                  className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700/70 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
                                  title="Xóa lựa chọn đơn vị"
                                >
                                  <X className="w-2.5 h-2.5 stroke-[2]" />
                                </span>
                              ),
                            }}
                            treeExpandedKeys={treeExpandedKeys}
                            onTreeExpand={(keys) => setTreeExpandedKeys(keys as string[])}
                            onOpenChange={(visible) => {
                              if (visible && defaultExpandedKeys.length > 0) {
                                setTreeExpandedKeys(defaultExpandedKeys);
                              }
                            }}
                            treeLine={{ showLeafIcon: false }}
                            switcherIcon={(nodeProps: any) => {
                              if (nodeProps.isLeaf) return null;
                              const isExpanded = Boolean(nodeProps.expanded);
                              return (
                                <span
                                  className={`qk7-tree-switcher-btn ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                                  title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                                >
                                  {isExpanded ? (
                                    <Minus className="w-3 h-3 stroke-[2.5]" />
                                  ) : (
                                    <Plus className="w-3 h-3 stroke-[2.5]" />
                                  )}
                                </span>
                              );
                            }}
                            treeNodeLabelProp="name"
                            treeNodeFilterProp="name"
                            filterTreeNode={(input: string, node: any) =>
                              String(node.name || '').toLowerCase().includes(input.toLowerCase().trim())
                            }
                            getPopupContainer={(trigger) => (trigger.parentElement as HTMLElement) || window.document.body}
                            className="qk7-treeselect w-full"
                            classNames={{ popup: { root: 'qk7-unit-treeselect-popup' } }}
                            style={{ width: '100%', height: 38 }}
                            popupMatchSelectWidth={false}
                            styles={{
                              popup: {
                                root: {
                                  minWidth: 280,
                                  maxWidth: 'min(520px, 90vw)',
                                  maxHeight: 380,
                                  overflowX: 'hidden',
                                  overflowY: 'auto',
                                },
                              },
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          <Shield className="w-3 h-3 text-slate-400" />
                          <span>Cấp độ bảo mật</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={form.security_level_id || ''}
                          onChange={(e) => setForm({ ...form, security_level_id: e.target.value ? Number(e.target.value) : '' })}
                          required
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 cursor-pointer h-[38px]"
                        >
                          <option value="">Chọn độ bảo mật</option>
                          <option value={1}>Cấp 1 – Công khai</option>
                          <option value={2}>Cấp 2 – Nội bộ</option>
                          <option value={3}>Cấp 3 – Mật</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Ghi chú / Mô tả tóm tắt
                        </label>
                        <textarea
                          rows={2}
                          value={form.description || ''}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          placeholder="Nội dung tóm tắt môn học..."
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* FORM LỚP HỌC */}
                  {catalogType === 'classes' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormInput
                        label="Mã lớp học"
                        required
                        disabled={!!editing}
                        value={form.class_id || ''}
                        onChange={(val) => setForm({ ...form, class_id: val })}
                        placeholder="VD: CL-01"
                        icon={Hash}
                      />
                      <FormInput
                        label="Tên lớp học"
                        required
                        value={form.class_name || ''}
                        onChange={(val) => setForm({ ...form, class_name: val })}
                        placeholder="VD: Trung đội 10 - Đại đội 1"
                        icon={GraduationCap}
                      />
                      <div>
                        <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          <Building className="w-3 h-3 text-slate-400" />
                          <span>Đơn vị quản lý</span>
                        </label>
                        <div className="unit-treeselect-wrapper" style={{ position: 'relative', width: '100%' }}>
                          <TreeSelect
                            value={form.unit_id || undefined}
                            onChange={(val) => setForm({ ...form, unit_id: val || '' })}
                            treeData={unitTree}
                            placeholder="Chọn đơn vị quản lý"
                            allowClear={{
                              clearIcon: (
                                <span
                                  className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700/70 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
                                  title="Xóa lựa chọn đơn vị"
                                >
                                  <X className="w-2.5 h-2.5 stroke-[2]" />
                                </span>
                              ),
                            }}
                            treeExpandedKeys={treeExpandedKeys}
                            onTreeExpand={(keys) => setTreeExpandedKeys(keys as string[])}
                            onOpenChange={(visible) => {
                              if (visible && defaultExpandedKeys.length > 0) {
                                setTreeExpandedKeys(defaultExpandedKeys);
                              }
                            }}
                            treeLine={{ showLeafIcon: false }}
                            switcherIcon={(nodeProps: any) => {
                              if (nodeProps.isLeaf) return null;
                              const isExpanded = Boolean(nodeProps.expanded);
                              return (
                                <span
                                  className={`qk7-tree-switcher-btn ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                                  title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                                >
                                  {isExpanded ? (
                                    <Minus className="w-3 h-3 stroke-[2.5]" />
                                  ) : (
                                    <Plus className="w-3 h-3 stroke-[2.5]" />
                                  )}
                                </span>
                              );
                            }}
                            treeNodeLabelProp="name"
                            treeNodeFilterProp="name"
                            filterTreeNode={(input: string, node: any) =>
                              String(node.name || '').toLowerCase().includes(input.toLowerCase().trim())
                            }
                            getPopupContainer={(trigger) => (trigger.parentElement as HTMLElement) || window.document.body}
                            className="qk7-treeselect w-full"
                            classNames={{ popup: { root: 'qk7-unit-treeselect-popup' } }}
                            style={{ width: '100%', height: 38 }}
                            popupMatchSelectWidth={false}
                            styles={{
                              popup: {
                                root: {
                                  minWidth: 280,
                                  maxWidth: 'min(520px, 90vw)',
                                  maxHeight: 380,
                                  overflowX: 'hidden',
                                  overflowY: 'auto',
                                },
                              },
                            }}
                          />
                        </div>
                      </div>
                      <FormInput
                        label="Khóa đào tạo"
                        type="text"
                        value={form.course_year || ''}
                        onChange={(val) => setForm({ ...form, course_year: val })}
                        placeholder="Ví dụ 2026 hoặc K21"
                        icon={Calendar}
                      />
                      <div className="sm:col-span-2">
                        <FormInput
                          label="Sĩ số cố định (học viên)"
                          required
                          type="number"
                          min={0}
                          value={form.student_total ?? ''}
                          onChange={(val) => setForm({ ...form, student_total: val === '' ? null : Number(val) })}
                          placeholder="VD: 60"
                          icon={Users}
                          helper="Sĩ số này sẽ được tự động điền sẵn khi giảng viên mở ca giảng dạy"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Ghi chú / Mô tả lớp học
                        </label>
                        <textarea
                          rows={2}
                          value={form.description || ''}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          placeholder="Thông tin đại đội, ngành nghề..."
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* FORM GIẢNG ĐƯỜNG */}
                  {catalogType === 'classrooms' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormInput
                        label="Mã phòng / Giảng đường"
                        required
                        disabled={!!editing}
                        value={form.room_id || ''}
                        onChange={(val) => setForm({ ...form, room_id: val })}
                        placeholder="VD: GD-A1"
                        icon={Hash}
                      />
                      <FormInput
                        label="Tên giảng đường"
                        required
                        value={form.room_name || ''}
                        onChange={(val) => setForm({ ...form, room_name: val })}
                        placeholder="VD: Giảng đường A1"
                        icon={Building2}
                      />
                      <FormInput
                        label="Tòa nhà / Khu vực"
                        value={form.building_name || ''}
                        onChange={(val) => setForm({ ...form, building_name: val })}
                        placeholder="VD: Khu A"
                        icon={Building}
                      />
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Loại phòng
                        </label>
                        <select
                          value={form.room_type || 'LECTURE_HALL'}
                          onChange={(e) => setForm({ ...form, room_type: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                        >
                          <option value="LECTURE_HALL">🏛️ Giảng đường</option>
                          <option value="COMPUTER_LAB">💻 Phòng máy</option>
                          <option value="SEMINAR">🎙️ Phòng hội thảo</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <FormInput
                          label="Sức chứa (chỗ ngồi)"
                          type="number"
                          min={0}
                          value={form.capacity ?? ''}
                          onChange={(val) => setForm({ ...form, capacity: val === '' ? null : Number(val) })}
                          placeholder="VD: 120"
                          icon={Users}
                          helper="Sức chứa tối đa để cảnh báo khi sĩ số lớp vượt quá quy định"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Ghi chú / Trang thiết bị
                        </label>
                        <textarea
                          rows={2}
                          value={form.description || ''}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          placeholder="Trang bị máy chiếu, micro, bảng tương tác..."
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Trạng thái kích hoạt (Toggle switch) */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Kích hoạt sử dụng
                      </span>
                      <p className="text-[10.5px] text-slate-400">
                        Cho phép giảng viên lựa chọn trong danh sách khi mở ca giảng dạy
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.active !== false}
                        onChange={(e) => setForm({ ...form, active: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600" />
                    </label>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer active:scale-95"
                  >
                    Hủy bỏ
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 shadow-xs hover:shadow-emerald-500/20"
                  >
                    {submitting ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Lưu lại</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* ── 6. CONFIRM DELETE DIALOG ── */}
      <ConfirmDialog
        open={!!deleteItem}
        title={`Xóa ${cfg.title}`}
        message={`Xác nhận xóa "${deleteItem?.[cfg.nameField]}" (${deleteItem?.[cfg.pkField]}) khỏi danh mục?`}
        confirmText="Xác nhận xóa"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  );
};

// Sub-component: Form Input Field
interface FormInputProps {
  label: string;
  required?: boolean;
  disabled?: boolean;
  type?: string;
  min?: number;
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  icon?: any;
  helper?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  required,
  disabled,
  type = 'text',
  min,
  value,
  onChange,
  placeholder,
  icon: FieldIcon,
  helper,
}) => (
  <div>
    <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
      {FieldIcon && <FieldIcon className="w-3 h-3 text-slate-400" />}
      <span>{label}</span>
      {required && <span className="text-rose-500">*</span>}
    </label>
    <input
      type={type}
      min={min}
      required={required}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-800 transition"
    />
    {helper && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{helper}</p>}
  </div>
);

// Sub-component: Status Badge
const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] shrink-0 inline-block" />
        <span>Đang dùng</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 inline-block" />
      <span>Đã ẩn</span>
    </span>
  );
};

export default LectureCatalogsPage;
