import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ROUTE_PATHS } from '../routes/routePaths';
import {
  MonitorPlay, Plus, Search, RefreshCw, RotateCw, LayoutGrid, List,
  BookOpen, Radio, Clock, CheckCircle2, FileText, X,
  Shield, AlertTriangle, Layers, HelpCircle, Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Header } from '../components/common/Header';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../components/common/Toast';
import { lectureService } from '../services/lectureService';
import { LectureCard } from '../components/lectures/LectureCard';
import { CreateLectureModal } from '../components/lectures/CreateLectureModal';
import { StartSessionModal } from '../components/lectures/StartSessionModal';
import { TeachingHistoryPanel } from '../components/lectures/TeachingHistoryPanel';
import { LectureDetailModal } from '../components/lectures/LectureDetailModal';
import { LectureViewerModal } from '../components/lectures/LectureViewerModal';
import { LiveSessionRoom } from '../components/lectures/LiveSessionRoom';
import { RejectReasonModal } from '../components/lectures/RejectReasonModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { TacticalEmptyState } from '../components/common/TacticalEmptyState';
import { RollingNumber } from '../components/common/RollingNumber';
import { PaginationBar } from '../components/common/PaginationBar';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { usePageTransition } from '../components/common/PageTransitionStage';
import { FingerprintScanModal } from '../components/users/FingerprintScanModal';
import { Lecture, LectureStatus, Subject, TeachingSchedule, reviewStageOf } from '../types/lecture';

/**
 * Trang Bài giảng số được chia như Văn bản số:
 *  - list    : Danh sách bài giảng đã xuất bản — chỉ tra cứu, xem chi tiết, mở ca dạy
 *  - compose : Soạn & duyệt bài giảng — soạn mới, chỉnh sửa, gửi duyệt, phê duyệt, thùng rác
 *  - history : Lịch sử giảng dạy
 */
export type LecturesPageMode = 'list' | 'compose' | 'history';

const PAGE_META: Record<LecturesPageMode, { title: string; subtitle: string; badge: string }> = {
  list: {
    title: 'Danh Sách Bài Giảng',
    subtitle: 'Tra cứu bài giảng đã xuất bản và mở ca giảng dạy — Trường Quân Sự Quân Khu 7',
    badge: 'Sẵn sàng giảng dạy',
  },
  compose: {
    title: 'Soạn Và Duyệt Bài Giảng',
    subtitle: 'Soạn bài giảng mới, gửi duyệt và phê duyệt 2 tầng — Trường Quân Sự Quân Khu 7',
    badge: 'Xưởng bài giảng',
  },
  history: {
    title: 'Lịch Sử Giảng Dạy',
    subtitle: 'Các ca giảng đã thực hiện, thời lượng và sĩ số — Trường Quân Sự Quân Khu 7',
    badge: 'Nhật ký ca dạy',
  },
};

// ── Cụm KPI Telemetry Cards chuẩn Quân Đội (Đồng bộ hiệu ứng Rolling cơ học Tổng Quan) ──
const TacticalKpiCard: React.FC<{
  label: string;
  sublabel: string;
  value: number;
  icon: any;
  tone: 'emerald' | 'amber' | 'blue' | 'slate';
  delay?: number;
  refreshKey?: number | string;
}> = ({ label, sublabel, value, icon: Icon, tone, delay = 0, refreshKey }) => {
  const toneCfg = {
    emerald: {
      border: 'border-l-emerald-600 dark:border-l-emerald-500',
      bgIcon: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
      text: 'text-slate-900 dark:text-white',
    },
    amber: {
      border: 'border-l-amber-500',
      bgIcon: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
      text: 'text-slate-900 dark:text-white',
    },
    blue: {
      border: 'border-l-blue-500',
      bgIcon: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
      text: 'text-slate-900 dark:text-white',
    },
    slate: {
      border: 'border-l-slate-400 dark:border-l-slate-500',
      bgIcon: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
      text: 'text-slate-900 dark:text-white',
    },
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26, delay }}
      className={`group relative bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-4 ${toneCfg.border} transition-colors duration-150 hover:border-slate-300 dark:hover:border-white/20 min-w-0 flex flex-col justify-between shadow-2xs hover:shadow-xs`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
          {label}
        </span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${toneCfg.bgIcon} group-hover:scale-105 transition-transform`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between mt-2.5">
        <div className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight ${toneCfg.text}`}>
          <RollingNumber value={value} refreshKey={refreshKey} />
        </div>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
          {sublabel}
        </span>
      </div>
    </motion.div>
  );
};

export const LecturesPage: React.FC<{ mode?: LecturesPageMode }> = ({ mode = 'list' }) => {
  const { user, hasPermission, isAdmin } = useAuth();

  // Đường dẫn cũ /lectures?tab=history → chuyển sang trang Lịch sử giảng dạy riêng
  const [searchParams] = useSearchParams();
  const [kpiRefreshKey, setKpiRefreshKey] = useState(0);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LectureStatus | ''>('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [startSessionLecture, setStartSessionLecture] = useState<Lecture | null>(null);
  const [viewingLecture, setViewingLecture] = useState<Lecture | null>(null);
  const [readingLecture, setReadingLecture] = useState<Lecture | null>(null);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);

  // Trạng thái chờ quét vân tay (và PIN nếu Cấp 4-5) để mở ca dạy hoặc đọc bài giảng Cấp 3+
  const [verifySessionLecture, setVerifySessionLecture] = useState<Lecture | null>(null);
  const [verifyReadLecture, setVerifyReadLecture] = useState<Lecture | null>(null);

  const handleRequestReadLecture = (lec: Lecture) => {
    if (lec.security_level_id >= 3) {
      setVerifyReadLecture(lec);
    } else {
      setReadingLecture(lec);
    }
  };

  // Modal từ chối & Hộp thoại xác nhận
  const [rejectingLecture, setRejectingLecture] = useState<Lecture | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmText: string;
    isDestructive: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    open: false,
    title: '',
    description: '',
    confirmText: 'Xác nhận',
    isDestructive: false,
    onConfirm: () => {},
  });

  // State cho ca giảng dạy đang diễn ra
  const [activeSession, setActiveSession] = useState<TeachingSchedule | null>(null);
  const [currentLecture, setCurrentLecture] = useState<Lecture | null>(null);

  // ── Role-based access ──
  const canMonitor = useMemo(() => {
    if (!user) return false;
    if (isAdmin) return true;
    const roles = user.roles || [];
    const pos = (user.position || '').toLowerCase();
    if (roles.includes('ROL-02')) return true;
    return pos.includes('trưởng bộ môn') || pos.includes('trưởng khoa') || pos.includes('trưởng phòng');
  }, [user, isAdmin]);

  const canCreate        = hasPermission('LECTURE_CREATE');
  // Quyền duyệt do BẢNG QUYỀN quyết định (mặc định Admin/Chỉ huy có). Admin/Chỉ huy duyệt chính thức;
  // người khác được cấp quyền chỉ THẨM ĐỊNH, phải có Chỉ huy cấp trên xác nhận mới chính thức.
  const canApprove       = hasPermission('LECTURE_APPROVE');
  const isFinalApprover  = isAdmin || (user?.roles || []).includes('ROL-02');
  const canStartSchedule = hasPermission('SCHEDULE_START');

  const canArchive = useMemo(() => {
    if (isAdmin) return true;
    const roles = user?.roles || [];
    return roles.includes('ROL-01') || roles.includes('ROL-02');
  }, [user, isAdmin]);

  const canForceEnd = useMemo(() => {
    if (isAdmin) return true;
    const roles = user?.roles || [];
    return roles.includes('ROL-01');
  }, [user, isAdmin]);

  // ── Load subjects ──
  useEffect(() => {
    lectureService.getSubjects()
      .then((res: any) => {
        const subjectList: Subject[] = Array.isArray(res) ? res : (res?.items || []);
        setSubjects(subjectList);
      })
      .catch((err: any) => {
        console.error('[subjects]', err);
        toast.error('Không thể tải danh mục môn học');
        setSubjects([]);
      });
  }, []);

  // ── Load lectures (Tải toàn bộ kho dữ liệu để hỗ trợ lọc tức thì 0ms, chống giật màn hình) ──
  const [allLectures, setAllLectures] = useState<Lecture[]>([]);

  const loadLectures = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Bài đã xóa mềm nằm ở Thùng rác trang Quản trị (chỉ Admin) → backend không trả về ở đây
      // Trang Soạn & duyệt: chỉ bài của khoa/phòng mình (khoa nào khoa đấy lo).
      // Trang Danh sách: toàn bộ bài đã xuất bản của mọi khoa, bài khoa mình xếp lên đầu (do máy chủ sắp xếp).
      const normalRes = await lectureService.list(mode === 'compose' ? { scope: 'compose' } : {});
      setAllLectures(normalRes.items || []);
    } catch (err: any) {
      toast.error('Không thể tải danh sách bài giảng: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    loadLectures();
  }, [loadLectures]);

  // 🆕 TỰ ĐỘNG PHỤC HỒI CA DẠY KHI F5 (Được cô lập hoàn toàn theo user_id, ngăn chặn tuyệt đối lỗi chiếm quyền phiên giữa các tài khoản)
  useEffect(() => {
    // Luôn dọn dẹp key cũ không có namespace để tránh rò rỉ ca dạy giữa các người dùng
    try { localStorage.removeItem('qk7_active_session'); } catch {}

    if (!user?.user_id) return;
    const userSessionKey = `qk7_active_session_${user.user_id}`;
    const savedSessionStr = localStorage.getItem(userSessionKey);
    if (!savedSessionStr) return;

    let cancelled = false;

    (async () => {
      try {
        const saved = JSON.parse(savedSessionStr);
        if (!saved?.schedule_id || !saved?.lecture_id) {
          localStorage.removeItem(userSessionKey);
          return;
        }

        // Gọi API lấy đúng ca dạy của mình — không cần quyền Live Monitor
        let ongoingSession: TeachingSchedule | null = null;
        try {
          const raw: any = await lectureService.getScheduleById(saved.schedule_id);
          // Runtime guard — chỉ chấp nhận nếu có schedule_id
          if (raw && raw.schedule_id) {
            ongoingSession = raw as TeachingSchedule;
          }
        } catch {
          ongoingSession = null;
        }
        if (cancelled) return;

        // 🛡️ CHỐT CHẶN BẢO MẬT: Chỉ phục hồi nếu ca vẫn đang ONGOING VÀ presenter_id khớp tuyệt đối với user đang đăng nhập
        if (
          ongoingSession &&
          ongoingSession.status === 'ONGOING' &&
          ongoingSession.presenter_id === user.user_id
        ) {
          const lec = await lectureService.getById(saved.lecture_id);
          if (cancelled) return;

          if (lec) {
            setActiveSession(ongoingSession);
            setCurrentLecture(lec);
            toast.info(`Đã khôi phục ca giảng dạy "${lec.title}" đang diễn ra.`);
          }
        } else {
          // Ca đã kết thúc hoặc không phải do user này mở → xóa cờ lưu trữ an toàn
          localStorage.removeItem(userSessionKey);
          if (ongoingSession && ongoingSession.presenter_id === user.user_id) {
            toast.info('Ca giảng dạy trước đó đã kết thúc.');
          }
        }
      } catch {
        // Dữ liệu hỏng hoặc API lỗi → dọn dẹp để không kẹt ở lần F5 sau
        try { localStorage.removeItem(userSessionKey); } catch { /* noop */ }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.user_id]);

  // ── Stats luôn được tính từ toàn bộ kho dữ liệu bài giảng của người dùng ──
  const stats = useMemo(() => {
    // Không còn Lưu trữ / Thùng rác ở trang này
    const active = allLectures.filter(l => l.status !== 'DELETED' && l.status !== 'ARCHIVED');
    return {
      total:           active.length,
      published:       active.filter(l => l.status === 'PUBLISHED').length,
      // Bản cập nhật của bài đã xuất bản cũng tính vào hàng chờ duyệt / cần hiệu chỉnh
      pending:         active.filter(l => ['PENDING_FACULTY', 'PENDING_TRAINING'].includes(reviewStageOf(l))).length,
      draft:           active.filter(l => ['DRAFT', 'REJECTED'].includes(reviewStageOf(l))).length,
      pendingFaculty:  active.filter(l => reviewStageOf(l) === 'PENDING_FACULTY').length,
      pendingTraining: active.filter(l => reviewStageOf(l) === 'PENDING_TRAINING').length,
      rejected:        active.filter(l => reviewStageOf(l) === 'REJECTED').length,
      draftOnly:       active.filter(l => l.status === 'DRAFT').length,
    };
  }, [allLectures]);

  // ── Lọc tức thì trên Client (Zero-Latency / Smooth Transition, triệt tiêu giật màn hình) ──
  const filteredLectures = useMemo(() => {
    // Trang Danh sách chỉ hiện bài đã xuất bản; bản nháp/chờ duyệt/thùng rác nằm ở trang Soạn & duyệt
    const base = mode === 'list'
      ? allLectures.filter(l => l.status === 'PUBLISHED')
      : allLectures.filter(l => l.status !== 'DELETED' && l.status !== 'ARCHIVED');
    // Trang Soạn: xếp theo thứ tự Chờ Khoa duyệt → Chờ BGH duyệt → Cần hiệu chỉnh → Bản nháp → Đã xuất bản (mới nhất trước trong từng nhóm)
    const rank: Record<string, number> = { PENDING_FACULTY: 0, PENDING_TRAINING: 1, REJECTED: 2, DRAFT: 3, PUBLISHED: 4 };
    const ordered = mode === 'compose'
      ? [...base].sort((a, b) => (rank[reviewStageOf(a)] ?? 9) - (rank[reviewStageOf(b)] ?? 9)
          || String(b.created_at || '').localeCompare(String(a.created_at || '')))
      : base;
    return ordered.filter(lec => {
      // 1. Lọc theo trạng thái từ chip Lọc nhanh
      if (statusFilter && lec.status !== statusFilter
        && !(mode === 'compose' && reviewStageOf(lec) === statusFilter)) return false;
      // 2. Lọc theo môn học
      if (subjectFilter && lec.subject_id !== subjectFilter) return false;
      // 3. Lọc theo từ khóa tìm kiếm
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (lec.title || '').toLowerCase().includes(q);
        const matchCode = (lec.lecture_code || '').toLowerCase().includes(q);
        const matchSubject = (lec.subject_name || '').toLowerCase().includes(q);
        const matchAuthor = (lec.author_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchSubject && !matchAuthor) return false;
      }
      return true;
    });
  }, [allLectures, statusFilter, subjectFilter, searchQuery, mode]);

  // Tự động chuyển về trang 1 khi thay đổi điều kiện lọc hoặc chế độ xem
  useEffect(() => {
    setPage(1);
  }, [mode, statusFilter, subjectFilter, searchQuery]);

  // ── Pagination ──
  const totalPages    = Math.max(1, Math.ceil(filteredLectures.length / PAGE_SIZE));
  const currentPage   = Math.min(page, totalPages);
  const lecturesListRef = usePageTransition<HTMLDivElement>(currentPage, {
    cols: viewMode === 'grid' ? 3 : 1,
    mode: viewMode === 'grid' ? 'grid' : 'row',
  });
  const pagedLectures = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLectures.slice(start, start + PAGE_SIZE);
  }, [filteredLectures, currentPage]);

  // ── Actions ──
  const handleSubmit = async (lec: Lecture) => {
    try {
      await lectureService.submit(lec.lecture_id);
      toast.success(`Đã gửi duyệt "${lec.title}"`);
      loadLectures();
    } catch (err: any) {
      toast.error(err?.message || 'Gửi duyệt thất bại');
    }
  };

  const handleApprove = async (lec: Lecture) => {
    try {
      const res = await lectureService.approve(lec.lecture_id);
      if (res.validated) {
        toast.info(res.message || 'Đã thẩm định — chờ Chỉ huy cấp trên xác nhận');
        loadLectures();
        return;
      }
      const done = res.new_status === 'PUBLISHED' ? 'hoàn tất xuất bản' : 'phê duyệt cấp Khoa';
      toast.success(`Đã ${done} ${res.is_update ? 'bản mới của ' : ''}bài giảng "${lec.title}"`);
      loadLectures();
    } catch (err: any) {
      toast.error(err?.message || 'Phê duyệt thất bại');
    }
  };

  const handleRejectClick = (lec: Lecture) => {
    setRejectingLecture(lec);
  };

  const handleConfirmReject = async (reason: string) => {
    if (!rejectingLecture) return;
    try {
      const rj = await lectureService.reject(rejectingLecture.lecture_id, reason);
      toast.info(rj?.validated
        ? (rj.message || 'Đã ghi nhận đề nghị từ chối — chờ Chỉ huy cấp trên xác nhận')
        : `Đã gửi yêu cầu chỉnh sửa bài giảng "${rejectingLecture.title}"`);
      loadLectures();
    } catch (err: any) {
      toast.error(err?.message || 'Từ chối thất bại');
    } finally {
      setRejectingLecture(null);
    }
  };


    // ✅ 1. HÀM XÓA MỀM (Chuyển vào thùng rác)
  const handleSoftDelete = (lec: Lecture) => {
    setConfirmModal({
      open: true,
      title: 'Chuyển Vào Thùng Rác',
      description: `Đồng chí có chắc chắn muốn chuyển bài giảng "${lec.title}" (${lec.lecture_code}) vào thùng rác? Bài sẽ được chuyển sang Thùng rác của Quản trị viên (chỉ Quản trị viên mới khôi phục hoặc xóa vĩnh viễn).`,
      confirmText: 'Chuyển vào thùng rác',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await lectureService.delete(lec.lecture_id);
          toast.info(`Đã chuyển "${lec.title}" vào thùng rác`);
          loadLectures();
        } catch (err: any) {
          toast.error(err?.message || 'Xóa mềm thất bại');
        } finally {
          setConfirmModal(prev => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleEditClick = (lec: Lecture) => {
    setEditingLecture(lec);
    setCreateModalOpen(true);
  };

  // ── Ca giảng dạy ──
  const handleStartSessionSuccess = (session: TeachingSchedule, lecture: Lecture) => {
    setStartSessionLecture(null);
    setCreateModalOpen(false);
    setViewingLecture(null);
    setEditingLecture(null);
    setActiveSession(session);
    setCurrentLecture(lecture);

    // 🆕 Lưu cờ để phục hồi khi F5 — cô lập theo user_id để không xung đột phiên
    const currentUid = user?.user_id || session.presenter_id;
    if (currentUid) {
      try {
        localStorage.setItem(`qk7_active_session_${currentUid}`, JSON.stringify({
          schedule_id: session.schedule_id,
          lecture_id: lecture.lecture_id,
          presenter_id: currentUid,
          started_at: new Date().toISOString(),
        }));
        localStorage.removeItem('qk7_active_session');
      } catch { /* localStorage có thể bị chặn — bỏ qua */ }
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      await lectureService.endSchedule(activeSession.schedule_id);
      toast.success('Đã kết thúc ca giảng dạy thành công!');

      // 🆕 Xóa cờ lưu trữ khi kết thúc hợp lệ theo user_id
      const currentUid = user?.user_id || activeSession.presenter_id;
      if (currentUid) {
        try { localStorage.removeItem(`qk7_active_session_${currentUid}`); } catch {}
      }
      try { localStorage.removeItem('qk7_active_session'); } catch { /* noop */ }

      setActiveSession(null);
      setCurrentLecture(null);
      loadLectures();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi kết thúc ca giảng dạy');
    }
  };

  const meta = PAGE_META[mode];
  const HeroIcon = mode === 'history' ? Clock : mode === 'compose' ? FileText : BookOpen;
  const isGuest = !user || user.user_id === 'GUEST';

  if (isGuest && mode === 'history') {
    return <Navigate to={ROUTE_PATHS.LECTURES} replace />;
  }

  if (!isGuest && mode === 'list' && searchParams.get('tab') === 'history') {
    return <Navigate to={ROUTE_PATHS.LECTURES_HISTORY} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">

      {/* Màn hình trình chiếu phòng học: đè lên toàn bộ khi có ca dạy đang diễn ra */}
      {activeSession && currentLecture && (
        <LiveSessionRoom
          open={!!activeSession}
          session={activeSession}
          lecture={currentLecture}
          onEnd={handleEndSession}
        />
      )}

      {/* Wrapper chính */}
      <div className={activeSession ? 'hidden' : 'contents'}>
        <Header activeNav="lectures" title="Trường Quân Sự Quân Khu 7" subtitle="Trung tâm dữ liệu số" />

        <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-6 xl:p-8 w-full max-w-[1440px] mx-auto space-y-6">

          {/* Hero Header trang nghiêm chuẩn Quân đội */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#111827] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#166534]/15 border border-[#166534]/30 dark:bg-emerald-500/15 dark:border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
                <HeroIcon className="w-6 h-6 text-[#166534] dark:text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {meta.title}
                  </h1>
                  <span className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                    {meta.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {meta.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={async () => {
                  setKpiRefreshKey(prev => prev + 1);
                  await loadLectures();
                  toast.success('Đã làm mới dữ liệu bài giảng số!');
                }}
                disabled={loading}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                title="Làm mới dữ liệu bài giảng"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>

              {mode === 'compose' && canCreate && (
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#166534] via-[#15803d] to-[#16a34a] hover:from-[#15803d] hover:to-[#22c55e] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-950/20 border border-emerald-400/40 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Soạn bài giảng mới</span>
                </button>
              )}
            </div>
          </div>

          {/* Thông báo chế độ Đại biểu tham quan */}
          {(user?.user_id === 'GUEST' || !user || !user.user_id) && (
            <div className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-300">
              <div className="flex items-center gap-2.5 min-w-0">
                <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-medium">
                  <strong>Chế độ Đại biểu tham quan:</strong> Đồng chí đang xem các bài giảng điện tử đã xuất bản ở cấp độ <strong>Công khai (Cấp 1)</strong> của Trường Quân sự Quân khu 7.
                </span>
              </div>
              <span className="hidden sm:inline-block font-mono text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-md font-bold uppercase shrink-0">
                Chỉ đọc
              </span>
            </div>
          )}

          {/* Cụm KPI Telemetry Cards tích hợp RollingNumber cuộn số cơ học như Tổng Quan */}
          {mode === 'compose' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <TacticalKpiCard
              label="Tổng số bài giảng"
              sublabel="Toàn bộ phân hệ"
              value={stats.total}
              icon={BookOpen}
              tone="blue"
              delay={0}
              refreshKey={kpiRefreshKey}
            />
            <TacticalKpiCard
              label="Sẵn sàng giảng dạy"
              sublabel="Đã xuất bản (Published)"
              value={stats.published}
              icon={CheckCircle2}
              tone="emerald"
              delay={0.05}
              refreshKey={kpiRefreshKey}
            />
            <TacticalKpiCard
              label="Đang chờ duyệt 2 tầng"
              sublabel="Cấp Khoa & BGH"
              value={stats.pending}
              icon={Clock}
              tone="amber"
              delay={0.1}
              refreshKey={kpiRefreshKey}
            />
            <TacticalKpiCard
              label="Bản nháp / Cần sửa"
              sublabel="Cần hoàn thiện"
              value={stats.draft}
              icon={FileText}
              tone="slate"
              delay={0.15}
              refreshKey={kpiRefreshKey}
            />
          </div>

          )}

          {/* ── TAB 1: DANH SÁCH BÀI GIẢNG ── */}
          {mode !== 'history' && (
            <div className="space-y-4">
              {/* Thanh công cụ tìm kiếm và bộ lọc */}
              <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shadow-xs">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tiêu đề hoặc mã bài giảng (VD: BG-01, QS-102)..."
                    className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {mode === 'compose' && (
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as LectureStatus | '')}
                    className="px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="PENDING_FACULTY">Chờ Khoa duyệt (Tầng 1)</option>
                    <option value="PENDING_TRAINING">Chờ BGH duyệt (Tầng 2)</option>
                    <option value="REJECTED">Cần hiệu chỉnh</option>
                    <option value="DRAFT">Bản nháp</option>
                    <option value="PUBLISHED">Đã xuất bản (Sẵn sàng dạy)</option>
                  </select>
                  )}

                  <select
                    value={subjectFilter}
                    onChange={e => setSubjectFilter(e.target.value)}
                    className="px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer max-w-[220px] truncate focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">Tất cả môn học</option>
                    {subjects.map(s => (
                      <option key={s.subject_id} value={s.subject_id}>{s.name}</option>
                    ))}
                  </select>

                  {/* Nút chuyển chế độ Lưới / Bảng */}
                  <SegmentedTabs
                    ariaLabel="Chế độ hiển thị bài giảng"
                    size="xs"
                    iconOnly
                    value={viewMode}
                    onChange={setViewMode}
                    className="self-start sm:self-auto"
                    items={[
                      {
                        value: 'grid',
                        icon: <LayoutGrid className="w-4 h-4" />,
                        title: 'Hiển thị dạng lưới tác chiến',
                        ariaLabel: 'Hiển thị dạng lưới tác chiến',
                        activeTone: 'emerald',
                      },
                      {
                        value: 'table',
                        icon: <List className="w-4 h-4" />,
                        title: 'Hiển thị dạng bảng danh mục',
                        ariaLabel: 'Hiển thị dạng bảng danh mục',
                        activeTone: 'emerald',
                      },
                    ]}
                  />
                </div>
              </div>

              {mode === 'compose' && (<>
              {/* Quick Filter Chips: Lọc nhanh 1 chạm theo trạng thái */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-1 shrink-0">
                  Lọc nhanh:
                </span>
                {[
                  { key: '', label: 'Tất cả', count: stats.total },
                  { key: 'PENDING_FACULTY', label: 'Chờ Khoa duyệt', count: stats.pendingFaculty },
                  { key: 'PENDING_TRAINING', label: 'Chờ BGH duyệt', count: stats.pendingTraining },
                  { key: 'REJECTED', label: 'Cần hiệu chỉnh', count: stats.rejected },
                  { key: 'DRAFT', label: 'Bản nháp', count: stats.draftOnly },
                  { key: 'PUBLISHED', label: 'Đã xuất bản', count: stats.published },
                ].map(chip => {
                  const active = statusFilter === chip.key;
                  return (
                    <button
                      key={chip.key || 'ALL'}
                      type="button"
                      onClick={() => setStatusFilter(chip.key as any)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
                        active
                          ? 'bg-[#166534] text-white border-[#166534] shadow-2xs font-semibold'
                          : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <span>{chip.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {chip.count}
                      </span>
                    </button>
                  );
                })}
              </div>
              </>)}

              {/* Danh sách bài giảng */}
              {loading && allLectures.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  <RefreshCw className="w-8 h-8 text-[#166534] dark:text-emerald-400 animate-spin" />
                  <p className="text-xs font-semibold text-slate-500">Đang đồng bộ danh mục bài giảng số...</p>
                </div>
              ) : filteredLectures.length === 0 ? (
                <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  <TacticalEmptyState
                    title="Chưa tìm thấy bài giảng nào phù hợp"
                    description={
                      searchQuery || statusFilter || subjectFilter
                        ? 'Không có bài giảng nào khớp với các tiêu chí tìm kiếm hoặc bộ lọc hiện tại. Đồng chí vui lòng đặt lại bộ lọc.'
                        : mode === 'list'
                        ? 'Hiện chưa có bài giảng nào được xuất bản trong phạm vi của đồng chí. Bài giảng mới soạn nằm ở mục "Soạn và duyệt bài giảng".'
                        : canCreate
                        ? 'Kho bài giảng số của Nhà trường đang sẵn sàng. Đồng chí hãy bắt đầu khởi tạo bài giảng đầu tiên bằng nút "Soạn bài giảng mới".'
                        : 'Hiện chưa có bài giảng nào được phân công hoặc xuất bản trong phân hệ.'
                    }
                    searchQuery={searchQuery}
                    onClearFilters={
                      searchQuery || statusFilter || subjectFilter
                        ? () => { setSearchQuery(''); setStatusFilter(''); setSubjectFilter(''); }
                        : undefined
                    }
                    onRefresh={() => loadLectures(false)}
                  />
                </div>
              ) : (
                <div
                  ref={lecturesListRef}
                  className={viewMode === 'grid'
                    ? 'u043 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'u043 space-y-2.5'}
                >
                  {pagedLectures.map(lec => (
                    <LectureCard
                      key={lec.lecture_id}
                      lecture={lec}
                      mode={mode === 'compose' ? 'compose' : 'list'}
                      viewMode={viewMode}
                      currentUserId={user?.user_id}
                      isAdmin={isAdmin}
                      canApprove={canApprove}
                      isFinalApprover={isFinalApprover}
                      canArchive={canArchive}
                      canDelete={hasPermission('LECTURE_DELETE')}
                      canStartSchedule={canStartSchedule}
                      canEdit={canCreate}
                      onSubmit={() => handleSubmit(lec)}
                      onApprove={() => handleApprove(lec)}
                      onReject={() => handleRejectClick(lec)}
                      onSoftDelete={() => handleSoftDelete(lec)}
                      onEdit={() => handleEditClick(lec)}
                      onView={() => setViewingLecture(lec)}
                      onRead={() => handleRequestReadLecture(lec)}
                      onStartSession={() => {
                        // KIỂM TRA CẤP ĐỘ BẢO MẬT
                        if (lec.security_level_id >= 3) {
                          // Nếu Cấp 3+ -> Bắt buộc quét vân tay trước
                          setVerifySessionLecture(lec);
                        } else {
                          // Nếu Cấp 1, 2 -> Mở ca dạy bình thường
                          setStartSessionLecture(lec);
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Phân trang tinh gọn chuẩn tối đa 30 bài giảng / trang */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 bg-white dark:bg-[#111827] p-3.5 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  <div>
                    Đang hiển thị bài <strong className="text-slate-800 dark:text-slate-200 font-bold">{(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredLectures.length)}</strong> / {filteredLectures.length}
                    {' '}— Tổng số <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{filteredLectures.length}</strong> bài giảng (Trang {currentPage}/{totalPages})
                  </div>
                  <PaginationBar
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => setPage(p)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: LỊCH SỬ GIẢNG DẠY ── */}
          {mode === 'history' && <TeachingHistoryPanel />}
        </main>
      </div>

      {/* ── MODALS HỆ THỐNG ── */}
      <CreateLectureModal
        open={createModalOpen}
        onClose={() => { setCreateModalOpen(false); setEditingLecture(null); }}
        onCreated={() => { setCreateModalOpen(false); setEditingLecture(null); loadLectures(); }}
        subjects={subjects}
        editLecture={editingLecture}
      />

      <StartSessionModal
        open={!!startSessionLecture}
        lecture={startSessionLecture}
        onClose={() => setStartSessionLecture(null)}
        onStarted={handleStartSessionSuccess}
      />

      {/* Modal Xác Thực Vân Tay Cho Bài Giảng Cấp 3+ */}
      {verifySessionLecture && (
        <FingerprintScanModal
          open={!!verifySessionLecture}
          fileId={verifySessionLecture.lecture_id}
          onSuccess={(token) => {
            // Lưu token để truyền lên Backend khi mở ca dạy (nếu cần)
            if (token) {
              sessionStorage.setItem(
                `qk7_fp_lecture_${verifySessionLecture.lecture_id}`,
                token
              );
            }
            // Chuyển sang Modal mở ca dạy
            setStartSessionLecture(verifySessionLecture);
            setVerifySessionLecture(null);
            toast.success(
              'Xác thực vân tay thành công! Vui lòng điền thông tin để mở ca dạy.'
            );
          }}
          onCancel={() => setVerifySessionLecture(null)}
        />
      )}

      {/* Modal Xác Thực Vân Tay (+ PIN nếu Cấp 4-5) Cho Đọc Bài Giảng Cấp 3+ */}
      {verifyReadLecture && (
        <FingerprintScanModal
          open={!!verifyReadLecture}
          fileId={verifyReadLecture.lecture_id}
          onSuccess={(token) => {
            if (token) {
              sessionStorage.setItem(
                `qk7_fp_lecture_${verifyReadLecture.lecture_id}`,
                token
              );
            }
            const target = verifyReadLecture;
            setVerifyReadLecture(null);
            setReadingLecture(target);
            toast.success('Xác thực sinh trắc học thành công! Đang mở bài giảng...');
          }}
          onCancel={() => setVerifyReadLecture(null)}
        />
      )}

      <LectureDetailModal
        open={!!viewingLecture}
        lecture={viewingLecture}
        onClose={() => setViewingLecture(null)}
        onOpenReader={() => {
          if (viewingLecture) {
            const target = viewingLecture;
            setViewingLecture(null);
            handleRequestReadLecture(target);
          }
        }}
      />

      {/* Modal Đọc / Xem Bài Giảng Số Trực Tuyến */}
      <LectureViewerModal
        open={!!readingLecture}
        lecture={readingLecture}
        onClose={() => setReadingLecture(null)}
      />

      {/* Modal từ chối phê duyệt (thay thế window.prompt) */}
      <RejectReasonModal
        open={!!rejectingLecture}
        lecture={rejectingLecture}
        onConfirm={handleConfirmReject}
        onClose={() => setRejectingLecture(null)}
      />

      {/* ConfirmDialog thay thế window.confirm */}
      <ConfirmDialog
        open={confirmModal.open}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
};

export default LecturesPage;
