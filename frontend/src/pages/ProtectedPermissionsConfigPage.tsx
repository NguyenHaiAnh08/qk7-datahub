// frontend/src/pages/ProtectedPermissionsConfigPage.tsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Loader2,
  RotateCw,
  Search,
  X,
  Layers,
  ShieldAlert,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  FileText,
  Users,
  KeyRound,
  Shield,
  Sparkles,
  Fingerprint,
  Activity,
  BookOpen,
  Laptop,
  Settings,
  MonitorPlay,
  Library,
  Gauge,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { approvalService } from '../services/approvalService';
import { permissionService } from '../services/permissionService';
import { toast } from '../components/common/Toast';
import { orderPermissionGroups } from '../constants/permissionGroups';

// ─── ĐẶC TẢ PHÂN KHU TÁC CHIẾN (GROUP METADATA) ─────────────────────────
const GROUP_META: Record<string, { label: string; icon: any; badgeColor: string; desc: string }> = {
  DOCUMENT: {
    label: 'Phân Hệ Quản Trị Văn Bản Số',
    icon: FileText,
    badgeColor: 'emerald',
    desc: 'Kiểm soát quyền tải PDF, đăng tải, chỉnh sửa, xóa và hủy vĩnh viễn tài liệu',
  },
  DOC: {
    label: 'Phân Hệ Quản Trị Văn Bản Số',
    icon: FileText,
    badgeColor: 'emerald',
    desc: 'Kiểm soát quyền tải PDF, đăng tải, chỉnh sửa, xóa và hủy vĩnh viễn tài liệu',
  },
  LECTURE: {
    label: 'Phân Hệ Bài Giảng Số',
    icon: MonitorPlay,
    badgeColor: 'cyan',
    desc: 'Kiểm soát quyền soạn, duyệt, xóa bài giảng và tổ chức ca giảng dạy',
  },
  LIBRARY: {
    label: 'Phân Hệ Thư Viện Số',
    icon: Library,
    badgeColor: 'teal',
    desc: 'Kiểm soát quyền đăng tải, chỉnh sửa, xóa, khôi phục tài liệu và danh mục thể loại thư viện',
  },
  COMMAND: {
    label: 'Phân Hệ Chỉ Huy & Giám Sát',
    icon: Gauge,
    badgeColor: 'emerald',
    desc: 'Kiểm soát quyền xem bảng tổng quan giám sát toàn hệ thống',
  },
  USER: {
    label: 'Phân Hệ Quân Nhân & Người Dùng',
    icon: Users,
    badgeColor: 'sky',
    desc: 'Kiểm soát quyền tạo tài khoản, chỉnh sửa hồ sơ quân nhân, phân đơn vị tác chiến',
  },
  USR: {
    label: 'Phân Hệ Quân Nhân & Người Dùng',
    icon: Users,
    badgeColor: 'sky',
    desc: 'Kiểm soát quyền tạo tài khoản, chỉnh sửa hồ sơ quân nhân, phân đơn vị tác chiến',
  },
  ROLE: {
    label: 'Phân Hệ Quản Trị Vai Trò & Đặc Quyền',
    icon: ShieldAlert,
    badgeColor: 'purple',
    desc: 'Kiểm soát quyền tạo vai trò, gán đặc quyền và phân cấp quyền tác chiến',
  },
  ROL: {
    label: 'Phân Hệ Quản Trị Vai Trò & Đặc Quyền',
    icon: ShieldAlert,
    badgeColor: 'purple',
    desc: 'Kiểm soát quyền tạo vai trò, gán đặc quyền và phân cấp quyền tác chiến',
  },
  PERMISSION: {
    label: 'Phân Hệ Quản Trị Quyền Hạn',
    icon: Shield,
    badgeColor: 'indigo',
    desc: 'Kiểm soát quyền hạn cốt lõi và các nhóm đặc quyền hệ thống',
  },
  PRM: {
    label: 'Phân Hệ Quản Trị Quyền Hạn',
    icon: Shield,
    badgeColor: 'indigo',
    desc: 'Kiểm soát quyền hạn cốt lõi và các nhóm đặc quyền hệ thống',
  },
  AI: {
    label: 'Phân Hệ Trợ Lý AI & RAG Quân Sự',
    icon: Sparkles,
    badgeColor: 'teal',
    desc: 'Kiểm soát quyền hỏi đáp trợ lý ảo, nạp tri thức vector và sinh giáo trình số',
  },
  FINGERPRINT: {
    label: 'Phân Hệ Sinh Trắc Học & Vân Tay 2FA',
    icon: Fingerprint,
    badgeColor: 'amber',
    desc: 'Kiểm soát đăng ký mẫu vân tay, xác thực bảo mật và cấp mã PIN khẩn cấp',
  },
  FP: {
    label: 'Phân Hệ Sinh Trắc Học & Vân Tay 2FA',
    icon: Fingerprint,
    badgeColor: 'amber',
    desc: 'Kiểm soát đăng ký mẫu vân tay, xác thực bảo mật và cấp mã PIN khẩn cấp',
  },
  AUDIT: {
    label: 'Phân Hệ Nhật Ký An Ninh & Kiểm Toán SOC',
    icon: Activity,
    badgeColor: 'blue',
    desc: 'Kiểm soát quyền xem nhật ký an ninh, điều tra truy vết và xuất báo cáo kiểm toán',
  },
  AUD: {
    label: 'Phân Hệ Nhật Ký An Ninh & Kiểm Toán SOC',
    icon: Activity,
    badgeColor: 'blue',
    desc: 'Kiểm soát quyền xem nhật ký an ninh, điều tra truy vết và xuất báo cáo kiểm toán',
  },
  CATALOG: {
    label: 'Phân Hệ Danh Mục Huấn Luyện & Bài Giảng',
    icon: BookOpen,
    badgeColor: 'cyan',
    desc: 'Kiểm soát danh mục môn học, lớp học viên, giảng đường và học liệu chuyên ngành',
  },
  CAT: {
    label: 'Phân Hệ Danh Mục Huấn Luyện & Bài Giảng',
    icon: BookOpen,
    badgeColor: 'cyan',
    desc: 'Kiểm soát danh mục môn học, lớp học viên, giảng đường và học liệu chuyên ngành',
  },
  SESSION: {
    label: 'Phân Hệ Quản Lý Phiên & Thiết Bị',
    icon: Laptop,
    badgeColor: 'rose',
    desc: 'Kiểm soát quyền thu hồi phiên trực tuyến, ngắt kết nối máy trạm từ xa',
  },
  SESS: {
    label: 'Phân Hệ Quản Lý Phiên & Thiết Bị',
    icon: Laptop,
    badgeColor: 'rose',
    desc: 'Kiểm soát quyền thu hồi phiên trực tuyến, ngắt kết nối máy trạm từ xa',
  },
  SYSTEM: {
    label: 'Phân Hệ Cấu Hình Tham Số Hệ Thống',
    icon: Settings,
    badgeColor: 'slate',
    desc: 'Kiểm soát tham số lõi, bảo trì hệ thống và kết nối mạng nội bộ',
  },
  SYS: {
    label: 'Phân Hệ Cấu Hình Tham Số Hệ Thống',
    icon: Settings,
    badgeColor: 'slate',
    desc: 'Kiểm soát tham số lõi, bảo trì hệ thống và kết nối mạng nội bộ',
  },
};

// ─── ĐÁNH GIÁ MỨC ĐỘ RỦI RO TÁC CHIẾN (RISK SEVERITY CLASSIFIER) ────────
const getRiskSeverity = (code: string) => {
  const c = code.toUpperCase();
  if (
    c.includes('PURGE') ||
    c.includes('DELETE') ||
    c.includes('DESTROY') ||
    c.includes('DROP') ||
    c.includes('HARD')
  ) {
    return {
      level: 'CRITICAL',
      label: 'Rủi ro cao (Nguy hiểm)',
      color: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30',
      dot: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]',
    };
  }
  if (
    c.includes('EDIT') ||
    c.includes('UPDATE') ||
    c.includes('RESTORE') ||
    c.includes('CREATE') ||
    c.includes('UPLOAD') ||
    c.includes('ASSIGN') ||
    c.includes('SYNC')
  ) {
    return {
      level: 'HIGH',
      label: 'Ghi / Sửa đổi',
      color: 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30',
      dot: 'bg-amber-500',
    };
  }
  return {
    level: 'STANDARD',
    label: 'Đọc / Truy vấn',
    color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    dot: 'bg-emerald-500',
  };
};

export const ProtectedPermissionsConfigPage: React.FC = () => {
  const [perms, setPerms] = useState<any[]>([]);
  const [protectedIds, setProtectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState<string | null>(null);

  // Bộ lọc tìm kiếm & trạng thái
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  // Trạng thái đóng/mở từng phân khu container (mặc định mở tất cả)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (grp: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [grp]: !prev[grp] }));
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [p, prot] = await Promise.all([
        permissionService.getPermissions(),
        approvalService.listProtected(),
      ]);
      setPerms(p.items || []);
      setProtectedIds(new Set((prot.items || []).map((x) => x.permission_id)));
    } catch (err: any) {
      toast.error('Lỗi tải dữ liệu: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Chuyển đổi trạng thái từng quyền (Optimistic UI không trôi thanh cuộn)
  const toggle = async (permId: string) => {
    if (togglingId || batchLoading) return;
    const isProtected = protectedIds.has(permId);
    setTogglingId(permId);

    // Optimistic UI update tức thời
    setProtectedIds((prev) => {
      const next = new Set(prev);
      if (isProtected) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });

    try {
      if (isProtected) {
        await approvalService.unprotect(permId);
        toast.info(`Đã mở khóa hành động (${permId})`);
      } else {
        await approvalService.protect(permId);
        toast.success(`Đã kích hoạt bảo vệ 2 tầng (${permId})`);
      }
      await load(true);
    } catch (err: any) {
      // Rollback nếu thất bại
      setProtectedIds((prev) => {
        const next = new Set(prev);
        if (isProtected) {
          next.add(permId);
        } else {
          next.delete(permId);
        }
        return next;
      });
      toast.error('Lỗi cập nhật: ' + err.message);
    } finally {
      setTogglingId(null);
    }
  };

  // Thao tác hàng loạt theo phân khu (Khóa tất cả / Mở tất cả)
  const handleBatchToggleGroup = async (groupList: any[], shouldProtect: boolean, groupKey: string) => {
    if (batchLoading || togglingId) return;
    const targets = groupList.filter((p) => protectedIds.has(p.permission_id) !== shouldProtect);
    if (targets.length === 0) {
      toast.info(shouldProtect ? 'Toàn bộ quyền trong phân khu này đã được khóa' : 'Toàn bộ quyền trong phân khu này đã mở khóa');
      return;
    }

    setBatchLoading(groupKey);

    // Optimistic update
    setProtectedIds((prev) => {
      const next = new Set(prev);
      targets.forEach((p) => {
        if (shouldProtect) next.add(p.permission_id);
        else next.delete(p.permission_id);
      });
      return next;
    });

    try {
      for (const p of targets) {
        if (shouldProtect) await approvalService.protect(p.permission_id);
        else await approvalService.unprotect(p.permission_id);
      }
      toast.success(
        shouldProtect
          ? `Đã khóa bảo vệ ${targets.length} quyền của ${GROUP_META[groupKey]?.label || groupKey}`
          : `Đã mở khóa ${targets.length} quyền của ${GROUP_META[groupKey]?.label || groupKey}`
      );
      await load(true);
    } catch (err: any) {
      toast.error('Lỗi thao tác hàng loạt: ' + err.message);
      await load(true);
    } finally {
      setBatchLoading(null);
    }
  };

  // Gom nhóm danh mục quyền
  const rawGrouped = useMemo(() => {
    return perms.reduce((acc, p) => {
      const grp = (p.group_code || 'SYSTEM').toUpperCase();
      (acc[grp] ||= []).push(p);
      return acc;
    }, {} as Record<string, any[]>);
  }, [perms]);

  // ── Thao tác cuộn & chuyển phân hệ siêu mượt mà không khựng ──
  const pillsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const groupKeys = useMemo(() => orderPermissionGroups(Object.keys(rawGrouped)), [rawGrouped]);
  const allNavOptions = useMemo(() => ['all', ...groupKeys], [groupKeys]);

  const checkScrollability = useCallback(() => {
    const el = pillsContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  }, []);

  useEffect(() => {
    checkScrollability();
    const el = pillsContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);
    return () => {
      el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [checkScrollability, rawGrouped]);

  const scrollPills = (direction: 'left' | 'right') => {
    if (!pillsContainerRef.current) return;
    const distance = 260;
    pillsContainerRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  const selectGroupAndScroll = (grpKey: string) => {
    setSelectedGroup(grpKey);
    setTimeout(() => {
      const btn = pillsContainerRef.current?.querySelector(`[data-group-key="${grpKey}"]`);
      btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 20);
  };

  const handleNextGroup = () => {
    const currentIndex = allNavOptions.indexOf(selectedGroup);
    const nextIndex = (currentIndex + 1) % allNavOptions.length;
    selectGroupAndScroll(allNavOptions[nextIndex]);
  };

  const handlePrevGroup = () => {
    const currentIndex = allNavOptions.indexOf(selectedGroup);
    const prevIndex = (currentIndex - 1 + allNavOptions.length) % allNavOptions.length;
    selectGroupAndScroll(allNavOptions[prevIndex]);
  };

  const nextGroupLabel = useMemo(() => {
    const currentIndex = allNavOptions.indexOf(selectedGroup);
    const nextKey = allNavOptions[(currentIndex + 1) % allNavOptions.length];
    if (nextKey === 'all') return 'Tất cả phân hệ';
    const meta = GROUP_META[nextKey];
    return meta?.label ? meta.label.replace('Phân Hệ ', '') : nextKey;
  }, [allNavOptions, selectedGroup]);

  // Bộ lọc dữ liệu theo từ khóa, trạng thái và phân hệ
  const filteredGrouped = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result: Record<string, any[]> = {};

    (Object.entries(rawGrouped) as [string, any[]][]).forEach(([groupCode, list]) => {
      // 1. Lọc theo phân hệ được chọn
      if (selectedGroup !== 'all' && groupCode !== selectedGroup) return;

      // 2. Lọc các phần tử bên trong
      const filteredList = list.filter((p) => {
        const isLocked = protectedIds.has(p.permission_id);

        // Lọc theo trạng thái
        if (statusFilter === 'locked' && !isLocked) return false;
        if (statusFilter === 'unlocked' && isLocked) return false;

        // Lọc theo từ khóa tìm kiếm
        if (!q) return true;
        const matchCode = String(p.code || p.permission_id).toLowerCase().includes(q);
        const matchDesc = String(p.description || '').toLowerCase().includes(q);
        const matchGroup = String(groupCode).toLowerCase().includes(q);
        return matchCode || matchDesc || matchGroup;
      });

      if (filteredList.length > 0) {
        result[groupCode] = filteredList;
      }
    });

    return result;
  }, [rawGrouped, searchQuery, statusFilter, selectedGroup, protectedIds]);

  // Thống kê nhanh toàn cục
  const stats = useMemo(() => {
    const total = perms.length;
    const lockedCount = protectedIds.size;
    const unlockedCount = Math.max(0, total - lockedCount);
    const posturePercent = total > 0 ? Math.round((lockedCount / total) * 100) : 0;
    return { total, lockedCount, unlockedCount, posturePercent };
  }, [perms, protectedIds]);

  return (
    <div className="space-y-4">
      {/* ── 1. EXECUTIVE SECURITY HEADER (THÍCH ỨNG LIGHT & DARK MODE) ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/70 border border-emerald-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
        {/* Họa tiết an ninh chìm phía sau */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_70%)] pointer-events-none" />
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-5 dark:opacity-10 pointer-events-none">
          <Shield className="w-48 h-48 text-emerald-600 dark:text-emerald-400" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300/80 dark:border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  Cấu Hình Khóa Bảo Vệ 2 Tầng
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                  2-Tier Gatekeeper
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Khi kích hoạt khóa: Mọi quân nhân hoặc cán bộ không có đặc quyền Admin tối cao khi thực thi hành động này sẽ <strong className="text-slate-800 dark:text-white">bắt buộc phải qua bước tạo yêu cầu phê duyệt</strong> gửi đến Chỉ huy hoặc Quản trị viên, chống vượt quyền và triệt tiêu rủi ro thao tác sai sót.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer active:scale-95 shadow-xs"
              title="Làm mới trạng thái bảo vệ"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`} />
              <span>Đồng bộ</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. QUICK STATS HUD (CHỈ SỐ AN NINH TÁC CHIẾN) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Thẻ 1: Tổng số quyền hạn */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
              Tổng số quyền hạn
            </span>
            <span className="text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {stats.total}
            </span>
            <span className="text-[10.5px] text-slate-500 block mt-0.5">Tác vụ trong hệ thống</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Thẻ 2: Đang khóa bảo vệ */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider block">
              Đang khóa bảo vệ
            </span>
            <span className="text-lg font-bold text-rose-700 dark:text-rose-300 font-mono tabular-nums">
              {stats.lockedCount}
            </span>
            <span className="text-[10.5px] text-rose-600/80 dark:text-rose-400/80 block mt-0.5">Yêu cầu duyệt 2 tầng</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/15 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        {/* Thẻ 3: Mở thực thi tự do */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider block">
              Mở thực thi tự do
            </span>
            <span className="text-lg font-bold text-amber-700 dark:text-amber-300 font-mono tabular-nums">
              {stats.unlockedCount}
            </span>
            <span className="text-[10.5px] text-amber-600/80 dark:text-amber-400/80 block mt-0.5">Không cần phê duyệt</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Unlock className="w-5 h-5" />
          </div>
        </div>

        {/* Thẻ 4: Cấp độ phòng thủ */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider block">
              Mức độ phòng thủ
            </span>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
              {stats.posturePercent}%
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.posturePercent}%` }}
            />
          </div>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 block line-clamp-1">
            {stats.posturePercent >= 80 ? 'An toàn tối đa (Chống vượt quyền)' : 'Cần rà soát các quyền ghi/xóa'}
          </span>
        </div>
      </div>

      {/* ── 3. TACTICAL TOOLBAR (TÌM KIẾM & BỘ LỌC ĐA NĂNG) ── */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã quyền (vd: DOC_PURGE, AI_QUERY), tên tác vụ..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lọc theo trạng thái */}
          <SegmentedTabs
            ariaLabel="Lọc theo trạng thái khóa bảo vệ"
            value={statusFilter}
            onChange={setStatusFilter}
            className="shrink-0 self-start sm:self-auto"
            items={[
              { value: 'all', label: 'Tất cả', count: stats.total, activeTone: 'neutral' },
              {
                value: 'locked',
                label: 'Đang khóa',
                count: stats.lockedCount,
                icon: <Lock className="w-3 h-3" />,
                activeTone: 'danger',
              },
              {
                value: 'unlocked',
                label: 'Chưa khóa',
                count: stats.unlockedCount,
                icon: <Unlock className="w-3 h-3" />,
                activeTone: 'amber',
              },
            ]}
          />
        </div>

        {/* Lọc theo Phân hệ Pills với nút điều hướng siêu mượt */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[10.5px] uppercase font-bold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1.5 select-none pl-0.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Phân hệ:</span>
            </span>

            {/* Nút Cuộn Trái (Smooth Scroll Left) */}
            <button
              type="button"
              onClick={() => scrollPills('left')}
              disabled={!canScrollLeft}
              className={`p-1.5 rounded-xl border transition-all duration-200 shrink-0 flex items-center justify-center cursor-pointer ${
                canScrollLeft
                  ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 shadow-2xs active:scale-95'
                  : 'opacity-20 cursor-not-allowed border-transparent text-slate-400'
              }`}
              title="Cuộn danh sách phân hệ sang trái"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Vùng thanh cuộn chứa các Phân hệ Pills */}
            <div
              ref={pillsContainerRef}
              className="flex items-center gap-1.5 overflow-x-auto py-1 scroll-smooth no-scrollbar flex-1"
            >
              <button
                type="button"
                data-group-key="all"
                onClick={() => selectGroupAndScroll('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all duration-200 cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                  selectedGroup === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs border border-emerald-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <span>Tất cả phân hệ</span>
              </button>

              {groupKeys.map((grpKey) => {
                const meta = GROUP_META[grpKey];
                const count = rawGrouped[grpKey]?.length || 0;
                const isSelected = selectedGroup === grpKey;
                return (
                  <button
                    key={grpKey}
                    type="button"
                    data-group-key={grpKey}
                    onClick={() => selectGroupAndScroll(grpKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs border border-emerald-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60'
                    }`}
                  >
                    <span>{meta?.label ? meta.label.replace('Phân Hệ ', '') : grpKey}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Nút Cuộn Phải (Smooth Scroll Right) */}
            <button
              type="button"
              onClick={() => scrollPills('right')}
              disabled={!canScrollRight}
              className={`p-1.5 rounded-xl border transition-all duration-200 shrink-0 flex items-center justify-center cursor-pointer ${
                canScrollRight
                  ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 shadow-2xs active:scale-95'
                  : 'opacity-20 cursor-not-allowed border-transparent text-slate-400'
              }`}
              title="Cuộn danh sách phân hệ sang phải"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Nút hành động trực tiếp: Chuyển sang phân hệ tiếp theo */}
            <button
              type="button"
              onClick={handleNextGroup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 border border-emerald-300 dark:border-emerald-700/70 transition-all duration-200 cursor-pointer active:scale-95 shrink-0 shadow-2xs group"
              title={`Chuyển sang: ${nextGroupLabel}`}
            >
              <span>Phân hệ tiếp theo</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. DANH SÁCH PHÂN KHU TÁC CHIẾN (CONTAINER MODULES) ── */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span>Đang đồng bộ ma trận cấu hình khóa bảo vệ...</span>
        </div>
      ) : Object.keys(filteredGrouped).length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Không tìm thấy quyền hạn phù hợp</h4>
            <p className="text-xs text-slate-500 mt-0.5">Thử đổi từ khóa hoặc điều chỉnh bộ lọc trạng thái</p>
          </div>
          {(searchQuery || statusFilter !== 'all' || selectedGroup !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setSelectedGroup('all');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {orderPermissionGroups(Object.keys(filteredGrouped)).map((groupCode) => {
            const list: any[] = filteredGrouped[groupCode];
            const meta = GROUP_META[groupCode] || {
              label: `Phân Hệ ${groupCode}`,
              icon: Shield,
              badgeColor: 'slate',
              desc: 'Các tác vụ và quyền hạn phân quyền theo chuẩn quân sự',
            };
            const GroupIcon = meta.icon;
            const isCollapsed = Boolean(collapsedGroups[groupCode]);

            // Thống kê riêng cho phân khu
            const groupLockedCount = list.filter((p) => protectedIds.has(p.permission_id)).length;
            const groupTotal = list.length;
            const isAllLocked = groupLockedCount === groupTotal;
            const isBatchBusy = batchLoading === groupCode;

            return (
              <div
                key={groupCode}
                className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs transition"
              >
                {/* ── Header Phân Khu ── */}
                <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                      <GroupIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {meta.label}
                        </h3>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-bold">
                          {groupCode}
                        </span>
                        <span
                          className={`text-[10.5px] px-2 py-0.5 rounded-full font-bold font-mono border ${
                            isAllLocked
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
                              : groupLockedCount > 0
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                          }`}
                        >
                          {groupLockedCount}/{groupTotal} đã khóa
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {meta.desc}
                      </p>
                    </div>
                  </div>

                  {/* Cụm nút tác chiến phân khu */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      disabled={isBatchBusy || togglingId !== null}
                      onClick={() => handleBatchToggleGroup(list, !isAllLocked, groupCode)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-60 ${
                        isAllLocked
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100'
                      }`}
                      title={isAllLocked ? 'Mở khóa toàn bộ phân khu này' : 'Khóa toàn bộ phân khu này'}
                    >
                      {isBatchBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isAllLocked ? (
                        <Unlock className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>{isAllLocked ? 'Mở khóa tất cả' : 'Khóa toàn bộ'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(groupCode)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title={isCollapsed ? 'Mở rộng phân khu' : 'Thu gọn phân khu'}
                    >
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* ── Danh sách quyền bên trong phân khu ── */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden"
                    >
                      {list.map((p) => {
                        const isProtected = protectedIds.has(p.permission_id);
                        const isBusy = togglingId === p.permission_id;
                        const risk = getRiskSeverity(p.code || p.permission_id);

                        return (
                          <div
                            key={p.permission_id}
                            className={`p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                              isProtected
                                ? 'bg-rose-50/20 dark:bg-rose-950/5 hover:bg-rose-50/40 dark:hover:bg-rose-950/10'
                                : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                            }`}
                          >
                            {/* Cột trái: Thông tin mã quyền, tên & rủi ro */}
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                                  {p.code || p.permission_id}
                                </span>

                                {/* Badge rủi ro */}
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${risk.color}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
                                  <span>{risk.label}</span>
                                </span>

                                {/* Badge trạng thái bảo vệ */}
                                {isProtected ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold">
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>YÊU CẦU PHÊ DUYỆT</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-semibold">
                                    <Unlock className="w-2.5 h-2.5" />
                                    <span>THỰC THI TRỰC TIẾP</span>
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                {p.description || 'Chưa có mô tả tác vụ'}
                              </p>

                              {/* Chú giải hệ thống */}
                              <div className="text-[10.5px] text-slate-400 flex items-center gap-2">
                                <span>Mã ID: <strong className="font-mono">{p.permission_id}</strong></span>
                                {p.subgroup_label && <span>• Phân loại: {p.subgroup_label}</span>}
                              </div>
                            </div>

                            {/* Cột phải: Tactical Cyber Toggle Switch */}
                            <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                              <div className="text-right hidden md:block">
                                <span className={`text-[11px] font-bold block ${isProtected ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                                  {isProtected ? 'Đang Khóa Bảo Vệ' : 'Chưa Khóa (Tự Do)'}
                                </span>
                                <span className="text-[9.5px] text-slate-400 block">
                                  {isProtected ? 'Chờ Admin duyệt' : 'Không cần kiểm duyệt'}
                                </span>
                              </div>

                              {/* Nút Toggle dạng Switch Tactical Switch */}
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => toggle(p.permission_id)}
                                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-60 shadow-xs active:scale-95 ${
                                  isProtected
                                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                                    : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
                                }`}
                                role="switch"
                                aria-checked={isProtected}
                                title={isProtected ? 'Bấm để tắt khóa bảo vệ' : 'Bấm để bật khóa bảo vệ 2 tầng'}
                              >
                                <span className="sr-only">Chuyển đổi khóa bảo vệ</span>
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-flex h-6 w-6 shrink-0 transform items-center justify-center rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    isProtected ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                >
                                  {isBusy ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                                  ) : isProtected ? (
                                    <Lock className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                                  ) : (
                                    <Unlock className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProtectedPermissionsConfigPage;
