import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Radio, RefreshCw, AlertTriangle, Clock, Users, Building2, User,
  Square, Monitor, CheckCircle2,
  X, Wrench, Calendar, ShieldCheck,
  LayoutGrid, List, School, ArrowRight
} from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { toast } from '../common/Toast';
import {
  TeachingSchedule,
  RadarKpis,
  RadarBuilding,
  RadarClassroom,
  RadarSessionSummary,
} from '../../types/lecture';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { TacticalEmptyState } from '../common/TacticalEmptyState';
import { PaginationBar } from '../common/PaginationBar';
import { usePageTransition } from '../common/PageTransitionStage';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  currentUserId?: string;
  canForceEnd?: boolean;
  isAdmin?: boolean;
}

export const LiveMonitorPanel: React.FC<Props> = ({
  currentUserId,
  isAdmin: propIsAdmin,
}) => {
  const { user: authUser, isAdmin: authIsAdmin } = useAuth();
  const isAdministrator = Boolean(propIsAdmin ?? (authIsAdmin || (authUser?.roles || []).includes('ROL-01')));
  // Đồng bộ quyền bảo trì với Backend (Admin / Chỉ huy ROL-02 / Trưởng khoa / Trưởng BM / Trưởng phòng)
  const canManageMaintenance = useMemo(() => {
    if (isAdministrator) return true;
    const roles = authUser?.roles || [];
    if (roles.includes('ROL-02')) return true;
    const pos = (authUser?.position || '').toLowerCase();
    return pos.includes('trưởng khoa') || pos.includes('trưởng bộ môn') || pos.includes('trưởng phòng');
  }, [isAdministrator, authUser]);

  // Responsive state
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isDesktop = windowWidth >= 1200;

  // View mode: 'radar' (Sơ đồ mặt bằng) | 'list' (Danh sách ca dạy)
  const [viewMode, setViewMode] = useState<'radar' | 'list'>('radar');

  // Time shift filter: 'live' | 'morning' | 'afternoon' | 'evening'
  const [timeShift, setTimeShift] = useState<'live' | 'morning' | 'afternoon' | 'evening'>('live');

  // Radar state
  const [kpis, setKpis] = useState<RadarKpis>({
    total_rooms: 0,
    in_session: 0,
    available: 0,
    upcoming: 0,
    maintenance: 0,
    alert: 0,
  });
  const [buildings, setBuildings] = useState<RadarBuilding[]>([]);
  // null = chưa chọn khu nào: chỉ hiện danh sách khu kèm số phòng trống/bận; bấm vào khu mới hiện sơ đồ phòng
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [floorRooms, setFloorRooms] = useState<RadarClassroom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Inspector detail state
  const [roomDetail, setRoomDetail] = useState<{
    room: RadarClassroom;
    current_session: RadarSessionSummary | null;
    today_schedules: RadarSessionSummary[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Legacy list sessions
  const [sessions, setSessions] = useState<TeachingSchedule[]>([]);

  // Phân trang cho các phòng học trên Sơ đồ giảng đường (tối đa 30 phòng / trang)
  const [roomPage, setRoomPage] = useState<number>(1);
  const ROOMS_PAGE_SIZE = 30;

  // Phân trang cho Lịch sử dạy học hôm nay của phòng (tối đa 30 ca / trang)
  const [todayPage, setTodayPage] = useState<number>(1);
  const TODAY_PAGE_SIZE = 30;

  // Common UI states
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);

  // Maintenance dialog state
  const [maintDialogTarget, setMaintDialogTarget] = useState<RadarClassroom | null>(null);
  const [maintReason, setMaintReason] = useState<string>('');
  const [savingMaint, setSavingMaint] = useState<boolean>(false);

  // Confirm dialog state for ending session
  const [confirmTarget, setConfirmTarget] = useState<{
    scheduleId: string;
    lectureTitle: string;
    presenterName: string;
    venueName: string;
    isForce: boolean;
  } | null>(null);

  // ─── DATA FETCHING ──────────────────────────────────────────

  // Load Overview (KPIs + Buildings)
  const loadOverview = useCallback(async () => {
    try {
      const res = await lectureService.getRadarOverview();
      if (res?.kpis) setKpis(res.kpis);
      if (res?.buildings) {
        setBuildings(res.buildings);
        // Tự động ưu tiên chọn khu đang có ca dạy để người dùng thấy ngay
        setSelectedBuilding((prev) => {
          if (prev && res.buildings.some((b) => b.building_code === prev)) return prev;
          const activeBuilding = res.buildings.find((b) => (b.in_session_count ?? 0) > 0);
          return activeBuilding ? activeBuilding.building_code : res.buildings[0]?.building_code || null;
        });
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Load radar overview failed:', err);
    }
  }, []);

  // Load Floor Plan
  // Chuỗi các tầng của khu đang chọn (ổn định theo giá trị để không làm đổi identity của loadFloorPlan mỗi lần làm mới)
  const floorsKey = useMemo(
    () => (selectedBuilding ? (buildings.find((b) => b.building_code === selectedBuilding)?.floors || []).join(',') : ''),
    [buildings, selectedBuilding]
  );

  const loadFloorPlan = useCallback(async () => {
    if (!selectedBuilding) {
      setFloorRooms([]);
      return;
    }
    const floors = floorsKey ? floorsKey.split(',').map(Number) : [1];
    try {
      const results = await Promise.all(
        floors.map((fl) =>
          lectureService.getRadarFloorPlan({
            building_code: selectedBuilding,
            floor_number: fl,
            time_shift: timeShift,
          })
        )
      );
      setFloorRooms(results.flatMap((r) => r?.rooms || []));
    } catch (err) {
      console.error('Load floor plan failed:', err);
    }
  }, [selectedBuilding, floorsKey, timeShift]);

  // Load Legacy Live Schedules
  const loadLegacySessions = useCallback(async () => {
    try {
      const res = await lectureService.getLiveSchedules();
      setSessions(res.items || []);
    } catch (err) {
      console.error('Load live sessions failed:', err);
    }
  }, []);

  // Full Refresh
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadOverview(), loadFloorPlan(), loadLegacySessions()]);
    setLoading(false);
  }, [loadOverview, loadFloorPlan, loadLegacySessions]);

  const selectedRoomIdRef = useRef<string | null>(null);
  selectedRoomIdRef.current = selectedRoomId;

  // Initial and Periodic Refresh (2s pulse đồng bộ tiến độ thời gian thực siêu tốc)
  useEffect(() => {
    refreshAll();
    const timer = setInterval(() => {
      loadOverview();
      loadFloorPlan();
      loadLegacySessions();
      if (selectedRoomIdRef.current) {
        lectureService.getRadarRoomDetail(selectedRoomIdRef.current).then((res) => {
          setRoomDetail(res);
        }).catch(() => {});
      }
    }, 2000); // 2s pulse
    return () => clearInterval(timer);
  }, [refreshAll, loadOverview, loadFloorPlan, loadLegacySessions]);

  // Reload floor plan when building or shift changes
  useEffect(() => {
    loadFloorPlan();
  }, [loadFloorPlan]);

  // Load Room Detail when a room is selected
  const handleSelectRoom = async (roomId: string) => {
    setSelectedRoomId(roomId);
    if (!isDesktop) {
      setDrawerOpen(true);
    }
    setLoadingDetail(true);
    try {
      const res = await lectureService.getRadarRoomDetail(roomId);
      setRoomDetail(res);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải chi tiết phòng học');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Close Inspector (Both Drawer & Docked Column)
  const handleCloseInspector = () => {
    setDrawerOpen(false);
    setSelectedRoomId(null);
    setRoomDetail(null);
  };

  // Handle End Schedule
  const handleConfirmEnd = async () => {
    if (!confirmTarget) return;
    const { scheduleId, isForce } = confirmTarget;
    setEndingId(scheduleId);
    try {
      if (isForce) {
        await lectureService.forceEndSchedule(scheduleId);
      } else {
        await lectureService.endSchedule(scheduleId);
      }
      toast.success('Đã kết thúc ca giảng dạy thành công!');
      refreshAll();
      if (selectedRoomId) {
        handleSelectRoom(selectedRoomId);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể kết thúc ca dạy');
    } finally {
      setEndingId(null);
      setConfirmTarget(null);
    }
  };

  // Handle Toggle Maintenance
  const handleSaveMaintenance = async () => {
    if (!maintDialogTarget) return;
    setSavingMaint(true);
    try {
      const newStatus = !maintDialogTarget.is_maintenance;
      await lectureService.toggleRoomMaintenance(maintDialogTarget.room_id, {
        is_maintenance: newStatus,
        maintenance_reason: newStatus ? maintReason : undefined,
      });
      toast.success(newStatus ? 'Đã bật bảo trì cho phòng học!' : 'Đã gỡ bảo trì, phòng học sẵn sàng hoạt động!');
      setMaintDialogTarget(null);
      setMaintReason('');
      refreshAll();
      if (selectedRoomId === maintDialogTarget.room_id) {
        handleSelectRoom(maintDialogTarget.room_id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể cập nhật bảo trì');
    } finally {
      setSavingMaint(false);
    }
  };

  // Current active building object
  const currentBuilding = useMemo(() => {
    return selectedBuilding ? buildings.find((b) => b.building_code === selectedBuilding) : undefined;
  }, [buildings, selectedBuilding]);

  // Selected room object from current floor
  const activeRoom = useMemo(() => {
    return floorRooms.find((r) => r.room_id === selectedRoomId) || roomDetail?.room;
  }, [floorRooms, selectedRoomId, roomDetail]);

  // ─── LIVE SYNCHRONIZED SESSION ───
  // Đồng bộ thời gian thực giữa Danh sách ca dạy (sessions) và Chi tiết giảng đường (roomDetail)
  const activeSession = useMemo(() => {
    if (!activeRoom) return undefined;
    const fromLive = sessions.find((s) =>
      (roomDetail?.current_session?.schedule_id && s.schedule_id === roomDetail.current_session.schedule_id) ||
      (s.room_id && s.room_id === activeRoom.room_id) ||
      (s.venue_name && activeRoom.room_name && s.venue_name.trim().toLowerCase() === activeRoom.room_name.trim().toLowerCase())
    );
    if (fromLive) {
      return {
        ...(roomDetail?.current_session || {}),
        ...fromLive,
        slide_index: fromLive.slide_index ?? roomDetail?.current_session?.slide_index,
        slide_total: fromLive.slide_total ?? roomDetail?.current_session?.slide_total,
        scorm_progress: fromLive.scorm_progress ?? roomDetail?.current_session?.scorm_progress,
        current_page: fromLive.current_page ?? roomDetail?.current_session?.current_page,
        content_type: fromLive.content_type ?? roomDetail?.current_session?.content_type,
      };
    }
    return roomDetail?.current_session;
  }, [activeRoom, sessions, roomDetail]);

  // Reset trang khi đổi khu giảng đường
  useEffect(() => {
    setRoomPage(1);
  }, [selectedBuilding]);

  // Reset trang lịch sử hôm nay khi chọn phòng khác
  useEffect(() => {
    setTodayPage(1);
  }, [selectedRoomId]);

  // Tính toán phân trang phòng học Sơ đồ giảng đường (tối đa 30 phòng / trang)
  const totalRoomPages = Math.max(1, Math.ceil(floorRooms.length / ROOMS_PAGE_SIZE));
  const currentRoomPage = Math.min(roomPage, totalRoomPages);
  const roomsGridRef = usePageTransition<HTMLDivElement>(currentRoomPage, { cols: 3, mode: 'grid' });
  const pagedRooms = useMemo(() => {
    const start = (currentRoomPage - 1) * ROOMS_PAGE_SIZE;
    return floorRooms.slice(start, start + ROOMS_PAGE_SIZE);
  }, [floorRooms, currentRoomPage]);

  // Tính toán phân trang lịch sử dạy học hôm nay của phòng (tối đa 30 ca / trang)
  const todaySchedulesList = useMemo(() => roomDetail?.today_schedules || [], [roomDetail]);
  const totalTodayPages = Math.max(1, Math.ceil(todaySchedulesList.length / TODAY_PAGE_SIZE));
  const currentTodayPage = Math.min(todayPage, totalTodayPages);
  const pagedTodaySchedules = useMemo(() => {
    const start = (currentTodayPage - 1) * TODAY_PAGE_SIZE;
    return todaySchedulesList.slice(start, start + TODAY_PAGE_SIZE);
  }, [todaySchedulesList, currentTodayPage]);

  // ─── HELPER: TIẾN ĐỘ BÀI GIẢNG ĐẲNG CẤP (DÙNG CHUNG TOÀN HỆ THỐNG) ───
  const renderLectureProgressBox = (session: {
    slide_index?: number;
    slide_total?: number;
    scorm_progress?: number;
    current_page?: number;
    start_time?: string;
    duration_minutes?: number;
    is_hanging?: boolean;
    content_type?: string;
  }) => {
    const slidePercent = session.slide_total && session.slide_total > 0
      ? Math.round(((session.slide_index || 0) / session.slide_total) * 100)
      : 0;
    const rawPercent = session.scorm_progress !== undefined && session.scorm_progress !== null
      ? Math.round(session.scorm_progress * 100)
      : slidePercent;
    const percent = Math.min(100, Math.max(0, rawPercent));
    const isDone = percent >= 100;
    const isRunning = percent > 0 && percent < 100;
    const elapsedMinutes = session.start_time
      ? Math.max(0, Math.floor((Date.now() - new Date(session.start_time).getTime()) / 60000))
      : (session.duration_minutes || 0);

    return (
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-2xs">
        {/* Tiêu đề tiến độ + Vị trí / Đoạn bài giảng đang dạy */}
        <div className="flex items-center justify-between text-xs font-semibold gap-2">
          <span className="text-slate-950 dark:text-white flex items-center gap-1.5 font-black">
            <Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Tiến độ bài giảng
          </span>

          {/* Đoạn bài giảng / Slide đang dạy */}
          <div className="flex items-center gap-1.5 shrink-0">
            {session.slide_total ? (
              <span className="font-mono text-emerald-800 dark:text-emerald-300 text-[11px] font-black tabular-nums bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700/60 shadow-2xs">
                Đang dạy: {session.content_type === 'PDF' ? 'Trang' : 'Slide'} {session.slide_index || Math.max(1, Math.ceil((percent / 100) * session.slide_total))}/{session.slide_total}
              </span>
            ) : isDone ? (
              <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                Trọn bài
              </span>
            ) : (
              <span className="text-[10px] text-slate-700 dark:text-slate-300 font-mono font-bold">
                {session.current_page ? `Trang ${session.current_page}` : 'Khởi động ca'}
              </span>
            )}
          </div>
        </div>

        {/* Thanh Track Tiến độ sống động */}
        <progress
          max={100}
          value={Math.max(percent, isRunning ? 2 : 0)}
          aria-label="Tiến độ bài giảng"
          className={`w-full h-3 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700 shadow-inner [&::-webkit-progress-bar]:bg-slate-200 dark:[&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:transition-all [&::-webkit-progress-value]:duration-700 ${
            isDone
              ? '[&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500 accent-emerald-500'
              : isRunning
              ? '[&::-webkit-progress-value]:bg-emerald-600 dark:[&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-600 accent-emerald-600'
              : '[&::-webkit-progress-value]:bg-slate-400 dark:[&::-webkit-progress-value]:bg-slate-600 [&::-moz-progress-bar]:bg-slate-400 accent-slate-500'
          }`}
        />

        {/* Dòng trạng thái: Đã dạy X phút ĐƯỢC ĐƯA LÊN TRÊN DÒNG 100% Hoàn thành để tránh đè chữ */}
        <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
          {/* 1. DÒNG TRÊN: Thời gian ca dạy / Cảnh báo quá giờ */}
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Thời gian diễn ra:</span>
            {session.is_hanging ? (
              <span className="text-rose-600 dark:text-rose-400 animate-pulse font-black flex items-center gap-1 text-[10px] whitespace-nowrap">
                ⚠️ CẢNH BÁO QUÁ GIỜ ({elapsedMinutes} phút)
              </span>
            ) : (
              <span className="text-slate-700 dark:text-slate-300 font-bold whitespace-nowrap">
                Đã dạy {elapsedMinutes} phút
              </span>
            )}
          </div>

          {/* 2. DÒNG DƯỚI: Tiến độ ca dạy: 100% Hoàn thành */}
          <div className="flex items-center justify-between gap-2">
            {isDone ? (
              <div className="flex items-center gap-1.5 font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5] shrink-0" />
                <span className="whitespace-nowrap">Tiến độ ca dạy: <strong className="font-black font-mono text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm whitespace-nowrap">100% Hoàn thành</strong></span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 font-bold whitespace-nowrap min-w-0">
                <span className="text-slate-900 dark:text-slate-200 font-bold whitespace-nowrap">Tiến độ ca dạy:</span>
                <strong className="font-black font-mono text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm whitespace-nowrap">
                  {percent}%
                </strong>
                {isRunning && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block shrink-0" />
                )}
              </div>
            )}
          </div>

          {/* Khi 100% hoàn thành: Huy hiệu "✓ Sẵn sàng kết thúc ca" xuống dòng riêng biệt, vừa vặn khung thẻ */}
          {isDone && (
            <div className="pt-0.5 flex items-center justify-start">
              <span className="text-emerald-800 dark:text-emerald-300 font-black text-xs bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap">
                <span>✓ Sẵn sàng kết thúc ca</span>
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 1. TOP OPERATIONAL KPI BAR (4 KPI METRICS CHUẨN)            */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Tổng phòng học */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
            <School className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
              Tổng phòng học
            </div>
            <div className="text-xl font-black text-slate-950 dark:text-white font-mono mt-0.5">
              {kpis.total_rooms}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">phòng</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Đang giảng dạy */}
        <div className={`rounded-2xl border-2 p-3.5 shadow-xs flex items-center gap-3 relative overflow-hidden ${
          kpis.in_session > 0
            ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-500 dark:border-rose-500 shadow-rose-500/10'
            : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-white/[0.08]'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative ${
            kpis.in_session > 0
              ? 'bg-rose-500/15 border border-rose-500/50 text-rose-600 dark:text-rose-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }`}>
            <Radio className="w-5 h-5 animate-pulse" />
            {kpis.in_session > 0 && (
              <>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-600" />
              </>
            )}
          </div>
          <div className="min-w-0">
            <div className={`text-[11px] font-black uppercase tracking-wider truncate ${
              kpis.in_session > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'
            }`}>
              Đang giảng dạy
            </div>
            <div className={`text-xl font-black font-mono mt-0.5 ${
              kpis.in_session > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-950 dark:text-white'
            }`}>
              {kpis.in_session}
              <span className={`text-xs font-bold ml-1 ${kpis.in_session > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-300'}`}>ca học</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Phòng trống */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
              Phòng trống
            </div>
            <div className="text-xl font-black text-slate-950 dark:text-white font-mono mt-0.5">
              {kpis.available}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">sẵn sàng</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Bảo trì / Cảnh báo */}
        <div className={`rounded-2xl border p-3.5 shadow-xs flex items-center gap-3 ${
          kpis.alert > 0
            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-400 dark:border-rose-800/60'
            : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-white/[0.08]'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            kpis.alert > 0
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 animate-pulse'
              : 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400'
          }`}>
            {kpis.alert > 0 ? <AlertTriangle className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
              Bảo trì / Cảnh báo
            </div>
            <div className="text-xl font-black text-slate-950 dark:text-white font-mono mt-0.5">
              {kpis.maintenance}
              {kpis.alert > 0 && (
                <span className="text-xs font-black text-rose-600 dark:text-rose-400 ml-1">
                  ({kpis.alert} cảnh báo)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 2. OPERATIONS CONTROL BAR (LIVE STATUS + VIEW SWITCH)         */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Real-time Live Status Badge */}
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white uppercase tracking-wider">
            Giám Sát Giảng Đường Trực Tiếp (Live)
          </span>
          {lastUpdate && (
            <span className="hidden sm:inline-block text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              • Cập nhật {lastUpdate.toLocaleTimeString('vi-VN')}
            </span>
          )}
        </div>

        {/* Right: Time Shift Filter, View Mode Toggle & Refresh Button */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {/* Bộ lọc Ca giảng dạy (Trực tiếp / Sáng / Chiều / Tối) trên Radar */}
          {viewMode === 'radar' && (
            <div
              className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs"
              role="group"
              aria-label="Lọc theo ca giảng dạy"
            >
              {([
                { key: 'live', label: 'Trực tiếp' },
                { key: 'morning', label: 'Ca sáng' },
                { key: 'afternoon', label: 'Ca chiều' },
                { key: 'evening', label: 'Ca tối' },
              ] as const).map((shift) => (
                <button
                  key={shift.key}
                  type="button"
                  onClick={() => setTimeShift(shift.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    timeShift === shift.key
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {shift.label}
                </button>
              ))}
            </div>
          )}

          {/* View mode toggle */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('radar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'radar'
                  ? 'bg-white dark:bg-[#111827] text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200/60 dark:border-transparent'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Sơ đồ giảng đường</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-[#111827] text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200/60 dark:border-transparent'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Danh sách ({sessions.length})</span>
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
            title={lastUpdate ? `Cập nhật lần cuối: ${lastUpdate.toLocaleTimeString('vi-VN')}` : 'Làm mới'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 3. RADAR MAP VIEW (MASTER - DETAIL - INSPECTOR PATTERN)     */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {viewMode === 'radar' && (
        <div>
          {/* Main 3-Column or 2-Column Responsive Container */}
          <div className="flex items-start gap-4">
            {/* ── COLUMN 2: DETAIL (SƠ ĐỒ PHÒNG HỌC KIỂU RẠP CHIẾU PHIM) ── */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs">
                {/* Header Sơ Đồ */}
                <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-200 dark:border-white/[0.08] gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-slate-950 dark:text-white flex items-center gap-2">
                        <span>Sơ Đồ Giảng Đường{currentBuilding ? `: ${currentBuilding.building_name}` : ''}</span>
                      </h3>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 font-bold">
                        Chọn khu giảng đường để xem các phòng — bấm vào phòng để kiểm tra sĩ số và tiến độ
                      </p>
                    </div>
                  </div>

                  {/* Status Legends */}
                  <div className="flex items-center gap-3 flex-wrap text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span className="flex items-center gap-1.5 font-black text-rose-600 dark:text-rose-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" /> Đang dạy
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-600" /> Trống
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-600" /> Bảo trì
                    </span>
                  </div>
                </div>

                {/* CHỌN KHU GIẢNG ĐƯỜNG — mỗi khu hiện tổng phòng / trống / đang dạy */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" role="group" aria-label="Chọn khu giảng đường">
                  {buildings.map((b) => {
                    const busy = b.in_session_count;
                    const free = Math.max(0, b.total_rooms - busy - b.maintenance_count);
                    const active = selectedBuilding === b.building_code;
                    const hasActiveSession = busy > 0;
                    return (
                      <button
                        key={b.building_code}
                        type="button"
                        onClick={() => setSelectedBuilding(active ? null : b.building_code)}
                        aria-pressed={active}
                        className={`min-h-[52px] text-left rounded-xl border-2 p-3 transition cursor-pointer flex flex-col justify-between relative ${
                          active && hasActiveSession
                            ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/30 ring-2 ring-rose-500/40 shadow-sm'
                            : active
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 ring-2 ring-emerald-600/40 shadow-sm'
                            : hasActiveSession
                            ? 'border-rose-400/80 hover:border-rose-500 bg-rose-50/35 hover:bg-rose-50/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 shadow-xs'
                            : 'border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-white dark:bg-slate-900/50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white truncate">
                            <Building2 className={`w-4 h-4 shrink-0 ${hasActiveSession ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`} />
                            <span className="truncate">{b.building_name}</span>
                          </span>
                          {hasActiveSession && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs flex items-center gap-1.5 animate-pulse shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              {busy} CA DẠY
                            </span>
                          )}
                        </div>
                        <span className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums border-t border-slate-200 dark:border-white/[0.08] pt-1.5 w-full">
                          <span className="text-slate-900 dark:text-slate-200 font-bold">{b.total_rooms} phòng</span>
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                            <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" /> {free} trống
                          </span>
                          <span className={`flex items-center gap-1 font-black ${hasActiveSession ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            <span className={`w-2 h-2 rounded-full ${hasActiveSession ? 'bg-rose-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
                            {busy} đang dạy
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* GRID CÁC PHÒNG HỌC (SƠ ĐỒ MẶT BẰNG GIẢNG ĐƯỜNG) */}
                {!currentBuilding ? (
                  <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    Chọn một khu giảng đường ở trên để xem sơ đồ các phòng.
                  </div>
                ) : floorRooms.length === 0 ? (
                  <div className="py-12">
                    <TacticalEmptyState
                      title="Không có phòng học nào trong khu này"
                      description="Chưa cấu hình phòng học nào thuộc khu vực hiện tại."
                      icon={<School className="w-10 h-10 text-slate-400" />}
                      onRefresh={loadFloorPlan}
                    />
                  </div>
                ) : (
                  <div
                    ref={roomsGridRef}
                    className="u043 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-4.5 mt-4"
                  >
                    {pagedRooms.map((room) => {
                      const isSelected = selectedRoomId === room.room_id;
                      const session = sessions.find((s) =>
                        (room.current_session?.schedule_id && s.schedule_id === room.current_session.schedule_id) ||
                        (s.room_id && s.room_id === room.room_id) ||
                        (s.venue_name && room.room_name && s.venue_name.trim().toLowerCase() === room.room_name.trim().toLowerCase())
                      ) || room.current_session;
                      const status = session ? 'IN_SESSION' : room.computed_status;
                      const upcoming = room.upcoming_session;

                      return (
                        <div
                          key={room.room_id}
                          onClick={() => handleSelectRoom(room.room_id)}
                          className={`rounded-2xl border-2 p-4 sm:p-4.5 transition-all duration-200 flex flex-col justify-between cursor-pointer relative group ${
                            isSelected && status === 'IN_SESSION'
                              ? 'ring-3 ring-rose-500 ring-offset-2 dark:ring-offset-[#111827] shadow-xl scale-[1.01] border-rose-600'
                              : isSelected
                              ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-[#111827] shadow-lg scale-[1.01] border-emerald-500'
                              : 'hover:shadow-md hover:-translate-y-0.5'
                          } ${
                            status === 'IN_SESSION'
                              ? 'bg-rose-50/75 dark:bg-rose-950/30 border-rose-500 dark:border-rose-500 shadow-md shadow-rose-500/10'
                              : status === 'ALERT'
                              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-500/60 shadow-rose-500/5'
                              : status === 'UPCOMING'
                              ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-400/60'
                              : status === 'MAINTENANCE'
                              ? 'bg-slate-100/80 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700 opacity-80'
                              : 'bg-white hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-800 border-slate-200 dark:border-white/[0.08] shadow-2xs hover:shadow-xs'
                          }`}
                        >
                          <div>
                            {/* Dòng 1: Mã Phòng & Tầng (bên trái) + Huy hiệu Trạng thái (bên phải) */}
                            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-white/[0.08]">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs shrink-0 shadow-2xs ${
                                  status === 'IN_SESSION'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : status === 'ALERT'
                                    ? 'bg-rose-600 text-white animate-pulse'
                                    : status === 'MAINTENANCE'
                                    ? 'bg-slate-400 dark:bg-slate-700 text-slate-950 dark:text-slate-100'
                                    : status === 'UPCOMING'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-950 dark:text-white border border-slate-300 dark:border-slate-700'
                                }`}>
                                  {room.room_id.replace(/^RM-|^H\d+-/i, '') || room.room_id}
                                </span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                  Tầng {room.floor_number || 1}
                                </span>
                              </div>

                              {/* Status Badge */}
                              <div className="shrink-0">
                                {status === 'IN_SESSION' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600 text-white border border-rose-700 flex items-center gap-1.5 whitespace-nowrap shadow-sm animate-pulse tracking-wide">
                                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                                    ĐANG DẠY
                                  </span>
                                ) : status === 'ALERT' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600 text-white border border-rose-700 flex items-center gap-1 whitespace-nowrap animate-pulse">
                                    <AlertTriangle className="w-3 h-3 text-white" />
                                    TREO CA
                                  </span>
                                ) : status === 'UPCOMING' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white border border-amber-600 whitespace-nowrap">
                                    SẮP HỌC
                                  </span>
                                ) : status === 'MAINTENANCE' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-300 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-400 dark:border-slate-700 flex items-center gap-1 whitespace-nowrap">
                                    <Wrench className="w-3 h-3" />
                                    BẢO TRÌ
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 whitespace-nowrap">
                                    TRỐNG
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Dòng 2: Tên Giảng Đường (Toàn bộ bề ngang thẻ — không bao giờ bị cắt xén) */}
                            <div className="mt-2.5">
                              <h4 className="font-black text-base text-slate-950 dark:text-white leading-snug line-clamp-2" title={room.room_name}>
                                {room.room_name}
                              </h4>
                              <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mt-1 font-bold">
                                <Users className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0" />
                                <span>Sức chứa: <strong className="font-mono text-slate-950 dark:text-white font-black">{room.capacity ? `${room.capacity} học viên` : 'Chưa thiết lập'}</strong></span>
                              </div>
                            </div>

                            {/* Session Information Snippet */}
                            {session && (
                              <div className="mt-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-rose-500/80 dark:border-rose-500/80 space-y-2.5 text-xs shadow-sm shadow-rose-500/5">
                                <div className="font-black text-slate-950 dark:text-white line-clamp-1 flex items-center gap-1.5">
                                  {session.is_restricted ? (
                                    <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                                  ) : (
                                    <Monitor className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
                                  )}
                                  <span className="truncate">{session.lecture_title}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300 gap-2">
                                  <span className="truncate">
                                    GV: <strong className="text-slate-950 dark:text-white font-black">{session.presenter_rank ? `${session.presenter_rank} ` : ''}{session.presenter_name}</strong>
                                  </span>
                                  <span className="font-mono text-rose-700 dark:text-rose-300 font-black shrink-0 bg-rose-100/90 dark:bg-rose-950/80 px-2 py-0.5 rounded-md border border-rose-300 dark:border-rose-700/60 shadow-2xs">
                                    {session.student_count || 0} HV
                                  </span>
                                </div>

                                {/* Slide / Progress Bar */}
                                {renderLectureProgressBox(session)}
                              </div>
                            )}

                            {/* Upcoming Info */}
                            {!session && upcoming && (
                              <div className="mt-3 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 text-xs space-y-1">
                                <div className="font-black text-amber-950 dark:text-amber-200 truncate">
                                  Ca tiếp theo: {upcoming.lecture_title}
                                </div>
                                <div className="text-[11px] text-amber-900 dark:text-amber-300 font-bold truncate">
                                  GV: {upcoming.presenter_name} • {upcoming.class_name}
                                </div>
                              </div>
                            )}

                            {/* Maintenance Reason */}
                            {status === 'MAINTENANCE' && (
                              <div className="mt-3 p-2.5 rounded-xl bg-slate-200/80 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-slate-200 font-bold">
                                <span>{room.maintenance_reason || 'Bảo trì kỹ thuật định kỳ'}</span>
                              </div>
                            )}

                            {/* Available Empty Cue */}
                            {status === 'AVAILABLE' && (
                              <div className="mt-3 py-3 px-3 text-center text-xs text-slate-700 dark:text-slate-300 font-bold bg-white/70 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Phòng sẵn sàng tiếp nhận ca giảng dạy</span>
                              </div>
                            )}
                          </div>

                          {/* Footer Action Hint */}
                          <div className="mt-3.5 pt-2.5 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-[11px]">
                            <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">
                              Hàng {room.grid_row} • Cột {room.grid_col}
                            </span>
                            <span className={`font-black flex items-center gap-1 group-hover:translate-x-0.5 transition-transform whitespace-nowrap shrink-0 ${
                              status === 'IN_SESSION' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                            }`}>
                              <span>Chi tiết</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Phân trang chuẩn Sơ đồ giảng đường (tối đa 30 phòng / trang, sang phòng 31 là trang 2) */}
                {totalRoomPages > 1 && (
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 bg-white dark:bg-[#111827] p-3.5 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
                    <div>
                      Đang hiển thị phòng <strong className="text-slate-800 dark:text-slate-200 font-bold">{(currentRoomPage - 1) * ROOMS_PAGE_SIZE + 1} - {Math.min(currentRoomPage * ROOMS_PAGE_SIZE, floorRooms.length)}</strong> / {floorRooms.length}
                      {' '}— Khu <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{currentBuilding?.building_name || selectedBuilding}</strong> (Trang {currentRoomPage}/{totalRoomPages})
                    </div>
                    <PaginationBar
                      currentPage={currentRoomPage}
                      totalPages={totalRoomPages}
                      onPageChange={(p) => setRoomPage(p)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── COLUMN 3: INSPECTOR (DOCK PANEL ON >= 1200PX) ── */}
            {isDesktop && activeRoom && (
              <div className="w-84 lg:w-92 xl:w-96 shrink-0 sticky top-4 space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-4 sm:p-5 shadow-xs space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-white/[0.04]">
                    <div className="min-w-0 pr-2">
                      <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                        03. Chi Tiết Giảng Đường
                      </div>
                      <h4 className="font-black text-base text-slate-900 dark:text-white mt-0.5 truncate">
                        {activeRoom.room_name}
                      </h4>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{activeRoom.building_name}</span>
                        <span>•</span>
                        <span>Tầng {activeRoom.floor_number}</span>
                        <span>•</span>
                        <span className="font-mono font-medium">Sức chứa {activeRoom.capacity} HV</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Maintenance Toggle Button */}
                      {canManageMaintenance && (
                        <button
                          type="button"
                          onClick={() => {
                            setMaintDialogTarget(activeRoom);
                            setMaintReason(activeRoom.maintenance_reason || '');
                          }}
                          className={`p-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            activeRoom.is_maintenance
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                          title={activeRoom.is_maintenance ? 'Gỡ bảo trì' : 'Thiết lập bảo trì'}
                        >
                          <Wrench className="w-4 h-4" />
                        </button>
                      )}

                      {/* Close button */}
                      <button
                        type="button"
                        onClick={handleCloseInspector}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Đóng bảng chi tiết"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                    {/* Active Session in Inspector (Đồng bộ thời gian thực siêu tốc) */}
                    {activeSession ? (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border-2 border-rose-400/80 dark:border-rose-700/60 space-y-2.5 shadow-sm">
                          <div className="flex items-center justify-between text-xs font-black text-rose-900 dark:text-rose-300">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                              ĐANG GIẢNG BÀI
                            </span>
                            <span className="font-mono text-rose-700 dark:text-rose-400 font-bold">
                              Đã dạy {activeSession.duration_minutes || 0} phút
                            </span>
                          </div>

                          <div
                            className="font-black text-base text-slate-950 dark:text-white line-clamp-2 [overflow-wrap:anywhere] [word-break:break-word]"
                            title={activeSession.lecture_title}
                          >
                            {activeSession.lecture_title}
                          </div>

                          {/* Presenter & Class */}
                          <div className="pt-2 border-t border-rose-200/80 dark:border-rose-800/60 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-700 dark:text-slate-300 font-bold">Giảng viên:</span>
                              <strong className="text-slate-950 dark:text-white font-black">
                                {activeSession.presenter_rank ? `${activeSession.presenter_rank} ` : ''}
                                {activeSession.presenter_name}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-700 dark:text-slate-300 font-bold">Lớp học:</span>
                              <strong className="text-slate-950 dark:text-white font-black">
                                {activeSession.class_name}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-700 dark:text-slate-300 font-bold">Sĩ số tham gia:</span>
                              <strong className="font-mono text-rose-700 dark:text-rose-400 font-black">
                                {activeSession.student_count || 0} học viên
                              </strong>
                            </div>
                          </div>

                          {/* 🆕 TIẾN ĐỘ BÀI GIẢNG ĐẲNG CẤP TRÊN INSPECTOR */}
                          {renderLectureProgressBox(activeSession)}
                        </div>

                        {/* Inspector Actions */}
                        <div className="flex items-center gap-2 pt-2">
                          {isAdministrator && (
                            <button
                              type="button"
                              onClick={() => {
                                const s = activeSession;
                                setConfirmTarget({
                                  scheduleId: s.schedule_id,
                                  lectureTitle: s.lecture_title || '',
                                  presenterName: s.presenter_name || '',
                                  venueName: activeRoom.room_name,
                                  isForce: true,
                                });
                              }}
                              disabled={endingId === activeSession.schedule_id}
                              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                              <Square className="w-3.5 h-3.5 fill-current" />
                              <span>Kết thúc ca dạy</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/[0.06] text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          Phòng hiện đang trống
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Sẵn sàng tiếp nhận ca giảng dạy mới của các khoa và bộ môn.
                        </p>
                      </div>
                    )}

                    {/* Today Schedules in Room */}
                    {roomDetail?.today_schedules && roomDetail.today_schedules.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 dark:border-white/[0.04]">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Lịch sử dạy học hôm nay ({roomDetail.today_schedules.length})</span>
                        </div>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {pagedTodaySchedules.map((ts) => (
                            <div
                              key={ts.schedule_id}
                              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/[0.04] text-xs flex items-center justify-between"
                            >
                              <div className="truncate mr-2">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {ts.lecture_title}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {ts.presenter_name} • {ts.class_name}
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 border ${
                                ts.status === 'ONGOING'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-700/60 font-black animate-pulse'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/60 font-black'
                              }`}>
                                {ts.status === 'ONGOING' ? 'Đang dạy' : 'Đã xong'}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Phân trang chuẩn Lịch sử dạy học hôm nay (tối đa 30 ca / trang, sang ca 31 là trang 2) */}
                        {totalTodayPages > 1 && (
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 mt-2 border-t border-slate-100 dark:border-white/[0.04]">
                            <span>Trang <strong className="text-slate-800 dark:text-slate-200 font-bold">{currentTodayPage}</strong>/{totalTodayPages} ({todaySchedulesList.length} ca)</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setTodayPage(Math.max(1, currentTodayPage - 1))}
                                disabled={currentTodayPage <= 1}
                                className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                              >
                                Trước
                              </button>
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 px-1">
                                {currentTodayPage}
                              </span>
                              <button
                                type="button"
                                onClick={() => setTodayPage(Math.min(totalTodayPages, currentTodayPage + 1))}
                                disabled={currentTodayPage >= totalTodayPages}
                                className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                              >
                                Sau
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>

          {/* ── INSPECTOR DRAWER FOR COMPACT (< 1200PX) ── */}
          {!isDesktop && drawerOpen && activeRoom && (
            <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={handleCloseInspector}
              />

              {/* Drawer Container */}
              <div
                className="relative w-full max-w-md bg-white dark:bg-[#111827] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-slate-800 ml-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drawer Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                        {activeRoom.room_name}
                      </h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {activeRoom.building_name} • Tầng {activeRoom.floor_number} • {activeRoom.capacity} HV
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseInspector}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                    title="Đóng bảng chi tiết"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="p-5 flex-1 overflow-y-auto space-y-4">
                  {loadingDetail ? (
                    <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                      <span className="text-xs">Đang tải dữ liệu giảng đường...</span>
                    </div>
                  ) : activeSession ? (
                    <div className="space-y-4">
                      {/* Active Session Card */}
                      <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border-2 border-rose-400/80 dark:border-rose-700/60 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between text-xs font-black text-rose-900 dark:text-rose-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            ĐANG GIẢNG BÀI
                          </span>
                          <span className="font-mono text-rose-700 dark:text-rose-400 font-bold">
                            Đã dạy {activeSession.duration_minutes || 0} phút
                          </span>
                        </div>

                        <div
                          className="font-black text-base text-slate-950 dark:text-white line-clamp-2 [overflow-wrap:anywhere] [word-break:break-word]"
                          title={activeSession.lecture_title}
                        >
                          {activeSession.lecture_title}
                        </div>

                        {/* Details */}
                        <div className="space-y-2 pt-2 border-t border-rose-200/80 dark:border-rose-800/60 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700 dark:text-slate-300 font-bold">Giảng viên:</span>
                            <strong className="text-slate-950 dark:text-white font-black">
                              {activeSession.presenter_rank ? `${activeSession.presenter_rank} ` : ''}
                              {activeSession.presenter_name}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700 dark:text-slate-300 font-bold">Lớp học:</span>
                            <strong className="text-slate-950 dark:text-white font-black">
                              {activeSession.class_name}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700 dark:text-slate-300 font-bold">Sĩ số học viên:</span>
                            <strong className="font-mono text-rose-700 dark:text-rose-400 font-black">
                              {activeSession.student_count || 0} học viên
                            </strong>
                          </div>
                        </div>

                        {/* 🆕 TIẾN ĐỘ BÀI GIẢNG ĐẲNG CẤP TRÊN DRAWER */}
                        {renderLectureProgressBox(activeSession)}
                      </div>

                      {/* End button for admin */}
                      {isAdministrator && (
                        <button
                          type="button"
                          onClick={() => {
                            const s = activeSession;
                            setConfirmTarget({
                              scheduleId: s.schedule_id,
                              lectureTitle: s.lecture_title || '',
                              presenterName: s.presenter_name || '',
                              venueName: activeRoom.room_name,
                              isForce: true,
                            });
                          }}
                          disabled={endingId === activeSession.schedule_id}
                          className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          <Square className="w-4 h-4 fill-current" />
                          <span>Kết thúc ca giảng dạy (Quyền Admin)</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/[0.06] text-center space-y-3">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                      <div className="font-bold text-base text-slate-800 dark:text-slate-200">
                        Phòng học đang trống
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                        Giảng đường sẵn sàng tiếp nhận ca giảng dạy mới theo kế hoạch đào tạo của Quân khu.
                      </p>
                    </div>
                  )}

                  {/* Maintenance Setting */}
                  {canManageMaintenance && (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-slate-900/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Wrench className="w-4 h-4 text-slate-500" />
                          Trạng thái bảo trì
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setMaintDialogTarget(activeRoom);
                            setMaintReason(activeRoom.maintenance_reason || '');
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                        >
                          {activeRoom.is_maintenance ? 'Gỡ bảo trì' : 'Bật bảo trì'}
                        </button>
                      </div>
                      {activeRoom.is_maintenance && activeRoom.maintenance_reason && (
                        <p className="text-xs text-slate-500 mt-1">
                          Lý do: {activeRoom.maintenance_reason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Today Timeline */}
                  {roomDetail?.today_schedules && roomDetail.today_schedules.length > 0 && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                      <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>Lịch sử dạy học hôm nay ({roomDetail.today_schedules.length})</span>
                      </h5>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {pagedTodaySchedules.map((ts) => (
                          <div
                            key={ts.schedule_id}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/[0.04] text-xs flex items-center justify-between"
                          >
                            <div className="truncate mr-2">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {ts.lecture_title}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {ts.presenter_name} • {ts.class_name}
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 border ${
                              ts.status === 'ONGOING'
                                ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-700/60 font-black animate-pulse'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/60 font-black'
                            }`}>
                              {ts.status === 'ONGOING' ? 'Đang dạy' : 'Đã xong'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Phân trang chuẩn Lịch sử dạy học hôm nay trong Drawer */}
                      {totalTodayPages > 1 && (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 mt-2 border-t border-slate-100 dark:border-white/[0.04]">
                          <span>Trang <strong className="text-slate-800 dark:text-slate-200 font-bold">{currentTodayPage}</strong>/{totalTodayPages} ({todaySchedulesList.length} ca)</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setTodayPage(Math.max(1, currentTodayPage - 1))}
                              disabled={currentTodayPage <= 1}
                              className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                            >
                              Trước
                            </button>
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 px-1">
                              {currentTodayPage}
                            </span>
                            <button
                              type="button"
                              onClick={() => setTodayPage(Math.min(totalTodayPages, currentTodayPage + 1))}
                              disabled={currentTodayPage >= totalTodayPages}
                              className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                            >
                              Sau
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 4. LEGACY LIST VIEW (DANH SÁCH CARD CA DẠY TRUYỀN THỐNG)    */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {viewMode === 'list' && (
        <div>
          {sessions.length === 0 ? (
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
              <TacticalEmptyState
                title="Tất cả các giảng đường hiện đang trống"
                description="Hiện không có ca giảng dạy nào đang diễn ra trong phân hệ. Ca học sẽ tự động xuất hiện trên Sơ đồ giảng đường khi giảng viên bấm 'Mở ca dạy' từ danh sách bài giảng đã xuất bản."
                icon={<Monitor className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />}
                onRefresh={refreshAll}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((s) => {
                const isOwner = s.presenter_id === currentUserId;

                return (
                  <div
                    key={s.schedule_id}
                    className={`bg-white dark:bg-[#111827] rounded-2xl border-2 p-5 flex flex-col gap-3.5 transition-all shadow-xs relative ${
                      s.is_hanging
                        ? 'border-amber-500/80 bg-amber-50/30 dark:bg-amber-950/20 shadow-amber-500/10'
                        : 'border-rose-500/80 bg-rose-50/30 dark:bg-rose-950/20 shadow-sm'
                    }`}
                  >
                    {/* Giảng đường & Trạng thái */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-white/[0.08] pb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400 font-bold">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-sm text-slate-950 dark:text-white truncate">
                            {s.venue_name.toLowerCase().startsWith('giảng đường') ? s.venue_name : `Giảng đường: ${s.venue_name}`}
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-300 truncate font-bold">
                            Lớp: <strong className="text-slate-950 dark:text-white font-black">{s.class_name || 'Học viên'}</strong>
                          </div>
                        </div>
                      </div>

                      {s.is_hanging ? (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40 shrink-0 flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          CẢNH BÁO TREO CA
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-rose-600 text-white border border-rose-700 shrink-0 flex items-center gap-1.5 shadow-sm animate-pulse tracking-wide">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          ĐANG GIẢNG BÀI
                        </span>
                      )}
                    </div>

                    {/* Tiêu đề bài giảng */}
                    <div className="min-w-0 overflow-hidden">
                      <h4 className="font-black text-sm text-slate-950 dark:text-white line-clamp-2 [overflow-wrap:anywhere] [word-break:break-word]" title={s.lecture_title}>
                        {s.lecture_title}
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 truncate mt-0.5 font-bold">
                        Môn: <strong className="text-slate-900 dark:text-white">{s.subject_name || 'Quân sự'}</strong>
                      </p>
                    </div>

                    {/* Thông tin chi tiết */}
                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-300/40">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[10px] text-slate-600 dark:text-slate-400 font-bold leading-none uppercase tracking-wider">
                            Cán bộ giảng dạy
                          </span>
                          <span className={`font-black text-slate-950 dark:text-white truncate block mt-0.5 text-xs ${isOwner ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                            {s.presenter_rank ? `${s.presenter_rank} ` : ''}{s.presenter_name}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-300/40">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[10px] text-slate-600 dark:text-slate-400 font-bold leading-none uppercase tracking-wider">
                              Sĩ số
                            </span>
                            <span className="font-black text-slate-950 dark:text-white font-mono truncate block mt-0.5 text-xs">
                              {s.student_count}
                              {s.class_student_total != null && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  {' / '}{s.class_student_total}
                                </span>
                              )}
                              <span className="font-bold text-slate-700 dark:text-slate-300"> HV</span>
                            </span>
                          </div>
                        </div>

                        {(() => {
                          const elapsedMinutes = s.start_time
                            ? Math.max(0, Math.floor((Date.now() - new Date(s.start_time).getTime()) / 60000))
                            : (s.duration_minutes || 0);

                          return (
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-300/40">
                                <Clock className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <span className="block text-[10px] text-slate-600 dark:text-slate-400 font-bold leading-none uppercase tracking-wider">
                                  Thời lượng
                                </span>
                                <span className="font-black text-slate-950 dark:text-white font-mono truncate block mt-0.5 text-xs">
                                  {elapsedMinutes} phút
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* 🆕 TIẾN ĐỘ CA DẠY — UX/UI ĐẲNG CẤP, RÕ RÀNG % VÀ ĐOẠN ĐANG DẠY */}
                    {renderLectureProgressBox(s)}

                    {/* Nút kết thúc ca */}
                    {isAdministrator && (
                      <div className="mt-auto pt-2 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({
                            scheduleId: s.schedule_id,
                            lectureTitle: s.lecture_title || '',
                            presenterName: s.presenter_name || '',
                            venueName: s.venue_name,
                            isForce: true,
                          })}
                          disabled={endingId === s.schedule_id}
                          className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                          title="Quyền Quản trị viên: Kết thúc ca giảng dạy này"
                        >
                          {endingId === s.schedule_id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Square className="w-3.5 h-3.5 fill-current" />
                          )}
                          <span>Kết thúc ca dạy</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 5. MAINTENANCE MODAL DIALOG                                  */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {maintDialogTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMaintDialogTarget(null)}
          />
          <div className="relative bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {maintDialogTarget.is_maintenance ? 'Gỡ Trạng Thái Bảo Trì' : 'Thiết Lập Bảo Trì Giảng Đường'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {maintDialogTarget.room_name} ({maintDialogTarget.building_name})
                </p>
              </div>
            </div>

            {!maintDialogTarget.is_maintenance ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Khi chuyển sang trạng thái bảo trì, giảng đường sẽ hiển thị khóa trên sơ đồ giảng đường và tạm thời không thể tiếp nhận ca dạy mới.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lý do bảo trì:
                  </label>
                  <input
                    type="text"
                    value={maintReason}
                    onChange={(e) => setMaintReason(e.target.value)}
                    placeholder="VD: Bảo trì máy chiếu, hệ thống âm thanh, sửa chữa đường truyền..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Đồng chí xác nhận đã hoàn tất công tác bảo dưỡng kỹ thuật và muốn mở lại phòng <strong>{maintDialogTarget.room_name}</strong> để sẵn sàng nhận ca giảng dạy?
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setMaintDialogTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveMaintenance}
                disabled={savingMaint}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingMaint && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{maintDialogTarget.is_maintenance ? 'Xác nhận gỡ bảo trì' : 'Lưu bảo trì'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 6. CONFIRM DIALOG FOR ENDING SCHEDULE                        */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <ConfirmDialog
        open={!!confirmTarget}
        title="Xác nhận Kết Thúc Ca Giảng Dạy"
        description={
          confirmTarget
            ? `Đồng chí Quản trị viên (Admin) đang thực hiện kết thúc ca giảng dạy "${confirmTarget.lectureTitle}" của giảng viên ${confirmTarget.presenterName}. Hành động này sẽ hoàn tất phiên học và giải phóng giảng đường "${confirmTarget.venueName}".`
            : ''
        }
        confirmText="Xác nhận kết thúc"
        cancelText="Quay lại"
        isDestructive={true}
        onConfirm={handleConfirmEnd}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};
