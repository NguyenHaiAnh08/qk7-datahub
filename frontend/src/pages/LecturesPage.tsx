import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MonitorPlay, Plus, Search, RefreshCw, LayoutGrid, List,
  BookOpen, Radio, Clock, CheckCircle2, FileText,
} from 'lucide-react';
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
import { Lecture, LectureStatus, Subject, TeachingSchedule } from '../types/lecture';

type TabKey = 'list' | 'live' | 'history';

// KPI card component
const StatCard: React.FC<{
  label: string;
  value: number;
  icon: any;
  color: 'cyan' | 'emerald' | 'amber' | 'slate';
}> = ({ label, value, icon: Icon, color }) => {
  const cls = {
    cyan:    'border-l-cyan-500 text-cyan-600 dark:text-cyan-400',
    emerald: 'border-l-emerald-500 text-emerald-600 dark:text-emerald-400',
    amber:   'border-l-amber-500 text-amber-600 dark:text-amber-400',
    slate:   'border-l-slate-400 text-slate-600 dark:text-slate-400',
  }[color];
  const ic = cls.split(' ')[1];
  return (
    <div className={`bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-2 ${cls}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{label}</span>
        <Icon className={`w-4 h-4 shrink-0 ${ic}`} />
      </div>
      <div className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${ic}`}>{value}</div>
    </div>
  );
};

export const LecturesPage: React.FC = () => {
  const { user, hasPermission, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LectureStatus | ''>('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [startSessionLecture, setStartSessionLecture] = useState<Lecture | null>(null);

  // State cho Xem chi tiết và Chỉnh sửa
  const [viewingLecture, setViewingLecture] = useState<Lecture | null>(null);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);

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
        // Phòng thủ: service trả Subject[] nhưng vẫn guard nếu backend đổi shape
        const subjectList: Subject[] = Array.isArray(res) ? res : (res?.items || []);
        setSubjects(subjectList);
      })
      .catch((err: any) => {
        console.error('[subjects]', err);
        toast.error('Không thể tải danh sách môn học');
        setSubjects([]);   // đảm bảo không kẹt state cũ
      });
  }, []);

  // ── Load lectures ──
  const loadLectures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lectureService.list({
        status: statusFilter || undefined,
        subject_id: subjectFilter || undefined,
        q: searchQuery.trim() || undefined,
      });
      setLectures(res.items || []);
      setPage(1);
    } catch (err: any) {
      toast.error('Không thể tải danh sách bài giảng: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, subjectFilter, searchQuery]);

  useEffect(() => {
    const t = setTimeout(loadLectures, 300);
    return () => clearTimeout(t);
  }, [loadLectures]);

  // ── Stats ──
  const stats = useMemo(() => ({
    total:     lectures.length,
    published: lectures.filter(l => l.status === 'PUBLISHED').length,
    pending:   lectures.filter(l => l.status === 'PENDING_FACULTY' || l.status === 'PENDING_TRAINING').length,
    draft:     lectures.filter(l => l.status === 'DRAFT' || l.status === 'REJECTED').length,
  }), [lectures]);

  // ── Pagination ──
  const totalPages    = Math.max(1, Math.ceil(lectures.length / PAGE_SIZE));
  const currentPage   = Math.min(page, totalPages);
  const pagedLectures = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return lectures.slice(start, start + PAGE_SIZE);
  }, [lectures, currentPage]);

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
      toast.success(`Đã ${res.new_status === 'PUBLISHED' ? 'xuất bản' : 'duyệt cấp Khoa'} "${lec.title}"`);
      loadLectures();
    } catch (err: any) {
      toast.error(err?.message || 'Duyệt thất bại');
    }
  };

  const handleReject = async (lec: Lecture) => {
    const reason = window.prompt('Nhập lý do từ chối:');
    if (!reason || !reason.trim()) return;
    try {
      await lectureService.reject(lec.lecture_id, reason.trim());
      toast.info(`Đã từ chối "${lec.title}"`);
      loadLectures();
    } catch (err: any) {
      toast.error(err?.message || 'Từ chối thất bại');
    }
  };

  const handleArchive = async (lec: Lecture) => {
    if (!window.confirm(`Lưu trữ bài giảng "${lec.title}"?`)) return;
    try {
      await lectureService.archive(lec.lecture_id);
      toast.info(`Đã lưu trữ "${lec.title}"`);
      loadLectures();
    } catch (err: any) {
      toast.error(err?.message || 'Lưu trữ thất bại');
    }
  };

  const handleRestore = async (lec: Lecture) => {
    if (!window.confirm(`Khôi phục bài giảng "${lec.title}" về trạng thái Nháp?`)) return;
    try {
      await lectureService.restore(lec.lecture_id);
      toast.success(`Đã khôi phục "${lec.title}"`);
      loadLectures();
    } catch (err: any) {
      toast.error(err?.message || 'Khôi phục thất bại');
    }
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
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      await lectureService.endSchedule(activeSession.schedule_id);
      toast.success('Đã kết thúc ca giảng dạy thành công!');
      setActiveSession(null);
      setCurrentLecture(null);
      loadLectures();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi kết thúc ca giảng dạy');
    }
  };

  const tabs: { key: TabKey; label: string; icon: any; visible: boolean }[] = [
    { key: 'list',    label: 'Danh sách bài giảng',  icon: BookOpen, visible: true },
    { key: 'live',    label: 'Giám sát giảng đường', icon: Radio,    visible: canMonitor },
    { key: 'history', label: 'Lịch sử giảng dạy',    icon: Clock,    visible: true },
  ];
  const visibleTabs = tabs.filter(t => t.visible);

  useEffect(() => {
    if (!visibleTabs.find(t => t.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key || 'list');
    }
  }, [visibleTabs, activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white transition-colors duration-200">

      {/* Màn hình trình chiếu: đè lên toàn bộ khi có ca dạy đang diễn ra */}
      {activeSession && currentLecture && (
        <LiveSessionRoom
          open={!!activeSession}
          session={activeSession}
          lecture={currentLecture}
          onEnd={handleEndSession}
        />
      )}

      {/* Wrapper: ẩn danh sách khi đang dạy */}
      <div className={activeSession ? 'hidden' : 'contents'}>
        <Header activeNav="lectures" title="Trường Quân Sự Quân Khu 7" subtitle="Hệ sinh thái số" />

        <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-6 xl:p-8 max-w-7xl w-full mx-auto space-y-6">

          {/* Hero header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <MonitorPlay className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <span>Phân Hệ Bài Giảng Số</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Quản lý bài giảng, ca giảng dạy và giám sát giảng đường — Trường Quân Sự Quân Khu 7
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadLectures}
                disabled={loading}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-[#0e7490] via-[#0891b2] to-[#06b6d4] hover:from-[#0891b2] hover:to-[#22d3ee] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-cyan-950/20 border border-cyan-400/30 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Soạn bài giảng mới</span>
                </button>
              )}
            </div>
          </div>

          {/* KPI Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Tổng bài giảng"  value={stats.total}     icon={BookOpen}     color="cyan" />
            <StatCard label="Đã xuất bản"     value={stats.published} icon={CheckCircle2} color="emerald" />
            <StatCard label="Chờ duyệt"       value={stats.pending}   icon={Clock}        color="amber" />
            <StatCard label="Nháp / Từ chối"  value={stats.draft}     icon={FileText}     color="slate" />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-0 overflow-x-auto">
            {visibleTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center gap-2 rounded-t-lg transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-500'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-b-2 border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tiêu đề hoặc mã bài giảng..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as LectureStatus | '')}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-200 cursor-pointer"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="DRAFT">Nháp</option>
                  <option value="PENDING_FACULTY">Chờ Khoa duyệt</option>
                  <option value="PENDING_TRAINING">Chờ BGH duyệt</option>
                  <option value="PUBLISHED">Đã xuất bản</option>
                  <option value="REJECTED">Bị từ chối</option>
                  <option value="ARCHIVED">Lưu trữ</option>
                </select>
                <select
                  value={subjectFilter}
                  onChange={e => setSubjectFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-200 cursor-pointer max-w-[220px] truncate"
                >
                  <option value="">Tất cả môn học</option>
                  {subjects.map(s => (
                    <option key={s.subject_id} value={s.subject_id}>{s.name}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    title="Dạng lưới"
                    className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    title="Dạng bảng"
                    className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin" />
                  <p className="text-sm text-slate-500">Đang tải danh sách bài giảng...</p>
                </div>
              ) : lectures.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-center bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-white/[0.08]">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Chưa có bài giảng nào</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    {canCreate
                      ? 'Bắt đầu soạn bài giảng đầu tiên bằng nút "Soạn bài giảng mới".'
                      : 'Chưa có bài giảng nào được xuất bản trong phân hệ này.'}
                  </p>
                </div>
              ) : (
                <div className={viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                  : 'space-y-2'}>
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
                      onReject={() => handleReject(lec)}
                      onArchive={() => handleArchive(lec)}
                      onRestore={() => handleRestore(lec)}
                      onEdit={() => handleEditClick(lec)}
                      onView={() => setViewingLecture(lec)}
                      onStartSession={() => setStartSessionLecture(lec)}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-500 bg-white dark:bg-[#111827] p-3 rounded-xl border border-slate-200 dark:border-white/[0.08]">
                  <div>
                    Trang <strong className="text-slate-800 dark:text-slate-200">{currentPage}</strong> / {totalPages}
                    {' '}— <strong className="text-slate-800 dark:text-slate-200">{lectures.length}</strong> bài giảng
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Trước
                    </button>
                    <span className="px-2">{currentPage}</span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'live' && canMonitor && (
            <LiveMonitorPanel
              currentUserId={user?.user_id}
              canForceEnd={canForceEnd}
            />
          )}
          {activeTab === 'history' && <TeachingHistoryPanel />}
        </main>
      </div>

      {/* Modals — luôn mount, đóng/mở qua prop `open` */}
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

      <LectureDetailModal
        open={!!viewingLecture}
        lecture={viewingLecture}
        onClose={() => setViewingLecture(null)}
      />
    </div>
  );
};

export default LecturesPage;