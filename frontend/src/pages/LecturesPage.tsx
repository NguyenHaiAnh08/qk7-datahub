import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { LiveMonitorPanel } from '../components/lectures/LiveMonitorPanel';
import { TeachingHistoryPanel } from '../components/lectures/TeachingHistoryPanel';
import { LectureDetailModal } from '../components/lectures/LectureDetailModal';
import { LiveSessionRoom } from '../components/lectures/LiveSessionRoom';
import { RejectReasonModal } from '../components/lectures/RejectReasonModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { TacticalEmptyState } from '../components/common/TacticalEmptyState';
import { RollingNumber } from '../components/common/RollingNumber';
import { FingerprintScanModal } from '../components/users/FingerprintScanModal';
import { Lecture, LectureStatus, Subject, TeachingSchedule } from '../types/lecture';

type TabKey = 'list' | 'live' | 'history';

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

export const LecturesPage: React.FC = () => {
  const { user, hasPermission, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [kpiRefreshKey, setKpiRefreshKey] = useState(0);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LectureStatus | ''>('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [startSessionLecture, setStartSessionLecture] = useState<Lecture | null>(null);
  const [viewingLecture, setViewingLecture] = useState<Lecture | null>(null);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);

  // Trạng thái chờ quét vân tay để mở ca dạy đối với bài giảng Cấp 3+
  const [verifySessionLecture, setVerifySessionLecture] = useState<Lecture | null>(null);

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
    if (roles.includes('ROL-02') || roles.includes('ROL-06')) return true;
    return pos.includes('trưởng bộ môn') || pos.includes('trưởng khoa') || pos.includes('trưởng phòng');
  }, [user, isAdmin]);

  const canCreate        = hasPermission('LECTURE_CREATE');
  const canApprove       = hasPermission('LECTURE_APPROVE');
  const canStartSchedule = hasPermission('SCHEDULE_START');

  const canArchive = useMemo(() => {
    if (isAdmin) return true;
    const roles = user?.roles || [];
    return roles.includes('ROL-01') || roles.includes('ROL-02') || roles.includes('ROL-06');
  }, [user, isAdmin]);

  const canForceEnd = useMemo(() => {
    if (isAdmin) return true;
    const roles = user?.roles || [];
    return roles.includes('ROL-01') || roles.includes('ROL-02') || roles.includes('ROL-06');
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
      // Backend ẩn DELETED mặc định → cần gọi thêm 1 lần với status=DELETED
      const [normalRes, deletedRes] = await Promise.all([
        lectureService.list(),
        lectureService.list({ status: 'DELETED' }),
      ]);
      setAllLectures([
        ...(normalRes.items  || []),
        ...(deletedRes.items || []),
      ]);
    } catch (err: any) {
      toast.error('Không thể tải danh sách bài giảng: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
    }
  }, []);

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
    const deleted = allLectures.filter(l => l.status === 'DELETED').length;
    const active  = allLectures.filter(l => l.status !== 'DELETED');
    return {
      total:           active.length,               // không tính bài trong thùng rác
      published:       active.filter(l => l.status === 'PUBLISHED').length,
      pending:         active.filter(l => l.status === 'PENDING_FACULTY' || l.status === 'PENDING_TRAINING').length,
      draft:           active.filter(l => l.status === 'DRAFT' || l.status === 'REJECTED').length,
      pendingFaculty:  active.filter(l => l.status === 'PENDING_FACULTY').length,
      pendingTraining: active.filter(l => l.status === 'PENDING_TRAINING').length,
      rejected:        active.filter(l => l.status === 'REJECTED').length,
      deleted,                                      // 🆕 đếm riêng cho chip "Thùng rác"
    };
  }, [allLectures]);

  // ── Lọc tức thì trên Client (Zero-Latency / Smooth Transition, triệt tiêu giật màn hình) ──
  const filteredLectures = useMemo(() => {
    return allLectures.filter(lec => {
      // 1. Lọc theo trạng thái từ chip Lọc nhanh
      if (statusFilter && lec.status !== statusFilter) return false;
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
  }, [allLectures, statusFilter, subjectFilter, searchQuery]);

  // Tự động chuyển về trang 1 khi thay đổi điều kiện lọc
  useEffect(() => {
    setPage(1);
  }, [statusFilter, subjectFilter, searchQuery]);

  // ── Pagination ──
  const totalPages    = Math.max(1, Math.ceil(filteredLectures.length / PAGE_SIZE));
  const currentPage   = Math.min(page, totalPages);
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
      toast.success(`Đã ${res.new_status === 'PUBLISHED' ? 'hoàn tất xuất bản' : 'phê duyệt cấp Khoa'} bài giảng "${lec.title}"`);
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
      await lectureService.reject(rejectingLecture.lecture_id, reason);
      toast.info(`Đã gửi yêu cầu chỉnh sửa bài giảng "${rejectingLecture.title}"`);
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
      description: `Đồng chí có chắc chắn muốn chuyển bài giảng "${lec.title}" (${lec.lecture_code}) vào thùng rác? Bạn có thể khôi phục lại sau này.`,
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

  // ✅ 2. HÀM XÓA VĨNH VIỄN (Xóa khỏi ổ cứng & CSDL)
  const handlePurge = (lec: Lecture) => {
    setConfirmModal({
      open: true,
      title: 'CẢNH BÁO: XÓA VĨNH VIỄN',
      description: `Hành động này sẽ XÓA VĨNH VIỄN bài giảng "${lec.title}", toàn bộ gói học liệu SCORM/HTML5 và câu hỏi Quiz khỏi ổ cứng máy chủ. Thao tác này KHÔNG THỂ HOÀN TÁC!`,
      confirmText: 'Xóa vĩnh viễn',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await lectureService.purge(lec.lecture_id);
          toast.success(`Đã xóa vĩnh viễn "${lec.title}" khỏi hệ thống`);
          loadLectures();
        } catch (err: any) {
          toast.error(err?.message || 'Lỗi khi xóa vĩnh viễn');
        } finally {
          setConfirmModal(prev => ({ ...prev, open: false }));
        }
      },
    });
  };
  

  const handleRestoreClick = (lec: Lecture) => {
    setConfirmModal({
      open: true,
      title: 'Khôi phục bài giảng',
      description: `Đồng chí có muốn khôi phục bài giảng "${lec.title}" về trạng thái Bản nháp để tiếp tục hiệu chỉnh và giảng dạy?`,
      confirmText: 'Khôi phục ngay',
      isDestructive: false,
      onConfirm: async () => {
        try {
          await lectureService.restore(lec.lecture_id);
          toast.success(`Đã khôi phục "${lec.title}" về Bản nháp`);
          loadLectures();
        } catch (err: any) {
          toast.error(err?.message || 'Khôi phục thất bại');
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

  const tabs: { key: TabKey; label: string; icon: any; visible: boolean; badge?: string }[] = [
    { key: 'list',    label: 'Danh sách bài giảng',  icon: BookOpen, visible: true },
    { key: 'live',    label: 'Giám sát giảng đường', icon: Radio,    visible: canMonitor, badge: 'Live Radar' },
    { key: 'history', label: 'Lịch sử giảng dạy',    icon: Clock,    visible: true },
  ];
  const visibleTabs = tabs.filter(t => t.visible);

  useEffect(() => {
    if (!visibleTabs.find(t => t.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key || 'list');
    }
  }, [visibleTabs, activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">

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
        <Header activeNav="lectures" title="Trường Quân Sự Quân Khu 7" subtitle="Hệ sinh thái số" />

        <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-6 xl:p-8 max-w-7xl w-full mx-auto space-y-6">

          {/* Hero Header trang nghiêm chuẩn Quân đội */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#111827] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#166534]/15 border border-[#166534]/30 dark:bg-emerald-500/15 dark:border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
                <MonitorPlay className="w-6 h-6 text-[#166534] dark:text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Phân Hệ Bài Giảng Số
                  </h1>
                  <span className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                    Học Viện Số
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Quản trị bài giảng điện tử, quy trình duyệt 2 tầng và radar giám sát giảng đường — Trường Quân Sự Quân Khu 7
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

              {canCreate && (
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

          {/* Cụm KPI Telemetry Cards tích hợp RollingNumber cuộn số cơ học như Tổng Quan */}
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

          {/* Thanh Tab Segmented Glider dạng Viên Thuốc */}
          <div className="bg-slate-200/80 dark:bg-slate-900/90 p-1 rounded-2xl border border-slate-300/80 dark:border-white/[0.08] inline-flex items-center gap-1 max-w-full overflow-x-auto shadow-2xs">
            {visibleTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setKpiRefreshKey(prev => prev + 1);
                  }}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap select-none relative ${
                    isActive
                      ? 'bg-white dark:bg-[#111827] text-[#166534] dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-white/[0.08]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#166534] dark:text-emerald-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── TAB 1: DANH SÁCH BÀI GIẢNG ── */}
          {activeTab === 'list' && (
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
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as LectureStatus | '')}
                    className="px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="DRAFT">Bản nháp</option>
                    <option value="PENDING_FACULTY">Chờ Khoa duyệt (Tầng 1)</option>
                    <option value="PENDING_TRAINING">Chờ BGH duyệt (Tầng 2)</option>
                    <option value="PUBLISHED">Đã xuất bản (Sẵn sàng dạy)</option>
                    <option value="REJECTED">Cần hiệu chỉnh</option>
                    <option value="ARCHIVED">Lưu trữ</option>
                    <option value="DELETED">🗑️ Thùng rác (Đã xóa)</option>
                  </select>

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
                  <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl self-start sm:self-auto shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      title="Hiển thị dạng lưới tác chiến"
                      className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-[#166534] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      title="Hiển thị dạng bảng danh mục"
                      className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-[#166534] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Filter Chips: Lọc nhanh 1 chạm theo trạng thái */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-1 shrink-0">
                  Lọc nhanh:
                </span>
                {[
                  { key: '', label: 'Tất cả', count: stats.total },
                  { key: 'PUBLISHED', label: 'Đã xuất bản', count: stats.published },
                  { key: 'PENDING_FACULTY', label: 'Chờ Khoa duyệt', count: stats.pendingFaculty },
                  { key: 'PENDING_TRAINING', label: 'Chờ BGH duyệt', count: stats.pendingTraining },
                  { key: 'DRAFT', label: 'Bản nháp', count: stats.draft },
                  { key: 'REJECTED', label: 'Cần sửa đổi', count: stats.rejected },
                  { key: 'DELETED', label: '🗑️ Thùng rác', count: stats.deleted },
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
                      statusFilter === 'DELETED'
                        ? 'Thùng rác đang trống. Các bài giảng đã xóa mềm sẽ xuất hiện ở đây và có thể khôi phục hoặc xóa vĩnh viễn.'
                        : searchQuery || statusFilter || subjectFilter
                        ? 'Không có bài giảng nào khớp với các tiêu chí tìm kiếm hoặc bộ lọc hiện tại. Đồng chí vui lòng đặt lại bộ lọc.'
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
                <div className={viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                  : 'space-y-2.5'}>
                  {pagedLectures.map(lec => (
                    <LectureCard
                      key={lec.lecture_id}
                      lecture={lec}
                      viewMode={viewMode}
                      currentUserId={user?.user_id}
                      isAdmin={isAdmin}
                      canApprove={canApprove}
                      canArchive={canArchive}
                      canStartSchedule={canStartSchedule}
                      canEdit={canCreate}
                      onSubmit={() => handleSubmit(lec)}
                      onApprove={() => handleApprove(lec)}
                      onReject={() => handleRejectClick(lec)}
                      onSoftDelete={() => handleSoftDelete(lec)}
                      onRestore={() => handleRestoreClick(lec)}
                      onPurge={() => handlePurge(lec)}
                      onEdit={() => handleEditClick(lec)}
                      onView={() => setViewingLecture(lec)}
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

              {/* Phân trang tinh gọn */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-500 bg-white dark:bg-[#111827] p-3.5 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  <div>
                    Đang hiển thị trang <strong className="text-slate-800 dark:text-slate-200">{currentPage}</strong> / {totalPages}
                    {' '}— Tổng số <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{filteredLectures.length}</strong> bài giảng
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                    >
                      Trang trước
                    </button>
                    <span className="px-2.5 font-bold font-mono text-emerald-700 dark:text-emerald-400">
                      {currentPage}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: GIÁM SÁT GIẢNG ĐƯỜNG TRỰC TIẾP ── */}
          {activeTab === 'live' && canMonitor && (
            <LiveMonitorPanel
              currentUserId={user?.user_id}
              canForceEnd={canForceEnd}
            />
          )}

          {/* ── TAB 3: LỊCH SỬ GIẢNG DẠY ── */}
          {activeTab === 'history' && <TeachingHistoryPanel />}
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

      <LectureDetailModal
        open={!!viewingLecture}
        lecture={viewingLecture}
        onClose={() => setViewingLecture(null)}
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
