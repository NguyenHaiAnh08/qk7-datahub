import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Radio, RefreshCw, AlertTriangle, Clock, Users, Building2, User,
  Square, ShieldAlert, Monitor, CheckCircle2,
  X, Wrench, Calendar, ExternalLink, ShieldCheck, MapPin,
  LayoutGrid, List, School, ArrowRight,
  Flame, Lock, HelpCircle
} from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { toast } from '../common/Toast';
import {
  TeachingSchedule,
  RadarKpis,
  RadarBuilding,
  RadarClassroom,
  RadarSessionSummary,
  RadarRoomStatus,
} from '../../types/lecture';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { TacticalEmptyState } from '../common/TacticalEmptyState';
import { useAuth } from '../../hooks/useAuth';
import { useDeviceMode } from '../../hooks/useDeviceMode';

interface Props {
  currentUserId?: string;
  canForceEnd?: boolean;
  isAdmin?: boolean;
}

export const LiveMonitorPanel: React.FC<Props> = ({
  currentUserId,
  canForceEnd = false,
  isAdmin: propIsAdmin,
}) => {
  const { user: authUser, isAdmin: authIsAdmin } = useAuth();
  const { isTouch } = useDeviceMode();
  const isAdministrator = Boolean(propIsAdmin ?? (authIsAdmin || (authUser?.roles || []).includes('ROL-01')));

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
        // Khu đang chọn không còn trong danh sách → bỏ chọn
        setSelectedBuilding((prev) =>
          prev && res.buildings.some((b) => b.building_code === prev) ? prev : null
        );
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

  // Initial and Periodic Refresh
  useEffect(() => {
    refreshAll();
    const timer = setInterval(() => {
      loadOverview();
      loadFloorPlan();
      loadLegacySessions();
    }, 6000); // 6s pulse
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

  // ─── HELPER: TIẾN ĐỘ BÀI GIẢNG ĐẲNG CẤP (DÙNG CHUNG TOÀN HỆ THỐNG) ───
  const renderLectureProgressBox = (session: {
    slide_index?: number;
    slide_total?: number;
    scorm_progress?: number;
    current_page?: number;
    start_time?: string;
    duration_minutes?: number;
    is_hanging?: boolean;
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
      <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 space-y-2.5 shadow-2xs">
        {/* Tiêu đề tiến độ + Vị trí / Đoạn bài giảng đang dạy */}
        <div className="flex items-center justify-between text-xs font-semibold gap-2">
          <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 font-bold">
            <Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Tiến độ bài giảng
          </span>

          {/* Đoạn bài giảng / Slide đang dạy */}
          <div className="flex items-center gap-1.5 shrink-0">
            {session.slide_total ? (
              <span className="font-mono text-emerald-800 dark:text-emerald-300 text-[11px] font-bold tabular-nums bg-emerald-100/80 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-300/60 dark:border-emerald-600/40 shadow-2xs">
                Đang dạy: Slide {session.slide_index || Math.max(1, Math.ceil((percent / 100) * session.slide_total))}/{session.slide_total}
              </span>
            ) : isDone ? (
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                Trọn bài
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {session.current_page ? `Trang ${session.current_page}` : 'Khởi động ca'}
              </span>
            )}
          </div>
        </div>

        {/* Thanh Track Tiến độ gradient sống động có glow */}
        <div className="w-full h-3 bg-slate-200/90 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 relative border border-slate-300/60 dark:border-slate-700/60 shadow-inner">
          <div
            style={{ width: `${Math.max(percent, isRunning ? 2 : 0)}%` }}
            className={`h-full rounded-full transition-all duration-700 ease-out relative ${
              isDone
                ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-400 shadow-xs'
                : isRunning
                ? 'bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 shadow-xs'
                : 'bg-slate-300 dark:bg-slate-700'
            }`}
          />
        </div>

        {/* Dòng trạng thái: Tiến độ ca dạy: 54% | 100% Hoàn thành */}
        <div className="flex items-center justify-between text-xs">
          {isDone ? (
            <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
              <span>Tiến độ ca dạy: <strong className="font-extrabold font-mono text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">100% Hoàn thành</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Tiến độ ca dạy:</span>
              <strong className="font-extrabold font-mono text-sky-600 dark:text-sky-400 text-xs sm:text-sm">
                {percent}%
              </strong>
              {isRunning && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse ml-0.5" />
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            {session.is_hanging ? (
              <span className="text-rose-600 dark:text-rose-400 animate-pulse font-extrabold flex items-center gap-1 text-[10px]">
                ⚠️ CẢNH BÁO QUÁ GIỜ
              </span>
            ) : isDone ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[11px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700/50">
                ✓ Sẵn sàng kết thúc ca
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Đã dạy {elapsedMinutes} phút
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 1. TOP OPERATIONAL KPI BAR (5 QUÂN KHU KPI METRICS)         */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* KPI 1: Tổng phòng học */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
            <School className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Tổng phòng học
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {kpis.total_rooms}
              <span className="text-xs font-normal text-slate-400 ml-1">phòng</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Đang giảng dạy */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-emerald-500/50 dark:border-emerald-500/30 p-3.5 shadow-xs flex items-center gap-3 relative overflow-hidden bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400 relative">
            <Radio className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider truncate">
              Đang giảng dạy
            </div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
              {kpis.in_session}
              <span className="text-xs font-normal text-emerald-600/70 ml-1">ca học</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Phòng trống */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Phòng trống
            </div>
            <div className="text-xl font-black text-slate-800 dark:text-slate-200 font-mono mt-0.5">
              {kpis.available}
              <span className="text-xs font-normal text-slate-400 ml-1">sẵn sàng</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Sắp có ca */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Sắp có ca
            </div>
            <div className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono mt-0.5">
              {kpis.upcoming}
              <span className="text-xs font-normal text-slate-400 ml-1">chuẩn bị</span>
            </div>
          </div>
        </div>

        {/* KPI 5: Bảo trì & Cảnh báo */}
        <div className={`col-span-2 sm:col-span-1 rounded-2xl border p-3.5 shadow-xs flex items-center gap-3 ${
          kpis.alert > 0
            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-400 dark:border-rose-800/60'
            : 'bg-white dark:bg-[#111827] border-slate-200/90 dark:border-white/[0.08]'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            kpis.alert > 0
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 animate-pulse'
              : 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400'
          }`}>
            {kpis.alert > 0 ? <AlertTriangle className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              Bảo trì / Cảnh báo
            </div>
            <div className="text-xl font-black text-slate-800 dark:text-slate-200 font-mono mt-0.5">
              {kpis.maintenance}
              {kpis.alert > 0 && (
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 ml-1">
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

        {/* Right: View Mode Toggle & Refresh Button */}
        <div className="flex items-center gap-2 ml-auto">
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
                <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.04] gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Sơ Đồ Giảng Đường{currentBuilding ? `: ${currentBuilding.building_name}` : ''}</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Chọn khu giảng đường để xem các phòng — bấm vào phòng để kiểm tra sĩ số và tiến độ
                      </p>
                    </div>
                  </div>

                  {/* Status Legends */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Bận (đang dạy)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" /> Trống
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Sắp có ca
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-500" /> Bảo trì
                    </span>
                  </div>
                </div>

                {/* CHỌN KHU GIẢNG ĐƯỜNG — mỗi khu hiện tổng phòng / trống / bận */}
                <div className="mt-4 flex flex-wrap gap-2.5" role="tablist" aria-label="Chọn khu giảng đường">
                  {buildings.map((b) => {
                    const busy = b.in_session_count;
                    const free = Math.max(0, b.total_rooms - busy - b.maintenance_count);
                    const active = selectedBuilding === b.building_code;
                    return (
                      <button
                        key={b.building_code}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSelectedBuilding(active ? null : b.building_code)}
                        className={`min-h-[44px] text-left rounded-xl border px-3.5 py-2.5 transition cursor-pointer ${
                          active
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-600/40'
                            : 'border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-white dark:bg-slate-900/50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                          <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                          {b.building_name}
                        </span>
                        <span className="mt-1 flex items-center gap-3 text-xs font-mono tabular-nums">
                          <span className="text-slate-700 dark:text-slate-300">{b.total_rooms} phòng</span>
                          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-slate-400" /> {free} trống
                          </span>
                          <span className="flex items-center gap-1 font-bold text-red-700 dark:text-red-400">
                            <span className="w-2 h-2 rounded-full bg-red-500" /> {busy} bận
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
                    className="grid gap-3.5 mt-4"
                    style={{
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    }}
                  >
                    {floorRooms.map((room) => {
                      const isSelected = selectedRoomId === room.room_id;
                      const status = room.computed_status;
                      const session = room.current_session;
                      const upcoming = room.upcoming_session;

                      return (
                        <div
                          key={room.room_id}
                          onClick={() => handleSelectRoom(room.room_id)}
                          className={`rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between cursor-pointer relative group ${
                            isSelected
                              ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-[#111827] shadow-lg scale-[1.01] border-emerald-500'
                              : 'hover:shadow-md hover:-translate-y-0.5'
                          } ${
                            status === 'IN_SESSION'
                              ? 'bg-red-50/80 dark:bg-red-950/30 border-red-500/60'
                              : status === 'ALERT'
                              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-500/60 shadow-rose-500/5'
                              : status === 'UPCOMING'
                              ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-400/60'
                              : status === 'MAINTENANCE'
                              ? 'bg-slate-100/80 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700 opacity-80'
                              : 'bg-slate-100 hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-800 border-slate-300 dark:border-white/[0.08] shadow-2xs hover:shadow-xs'
                          }`}
                        >
                          {/* Room Header: Code, Name, Capacity */}
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 font-mono shadow-2xs ${
                                  status === 'IN_SESSION'
                                    ? 'bg-red-600 text-white shadow-xs'
                                    : status === 'ALERT'
                                    ? 'bg-rose-600 text-white animate-pulse'
                                    : status === 'MAINTENANCE'
                                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                    : status === 'UPCOMING'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                                }`}>
                                  {room.room_id.replace(/^RM-|^H\d+-/i, '') || room.room_id.slice(-3)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate" title={room.room_name}>
                                    {room.room_name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                                    <Users className="w-3 h-3 shrink-0" />
                                    <span>Sức chứa: <strong className="font-mono text-slate-700 dark:text-slate-300">{room.capacity}</strong> HV</span>
                                  </div>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <div className="shrink-0">
                                {status === 'IN_SESSION' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300 border border-red-300 dark:border-red-500/40 flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    BẬN
                                  </span>
                                ) : status === 'ALERT' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 flex items-center gap-1 whitespace-nowrap animate-pulse">
                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                    TREO CA
                                  </span>
                                ) : status === 'UPCOMING' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 whitespace-nowrap">
                                    SẮP HỌC
                                  </span>
                                ) : status === 'MAINTENANCE' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1 whitespace-nowrap">
                                    <Wrench className="w-3 h-3" />
                                    BẢO TRÌ
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300 border border-slate-300 dark:border-slate-600 whitespace-nowrap">
                                    TRỐNG
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Session Information Snippet */}
                            {session && (
                              <div className="mt-3 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-red-200/80 dark:border-white/[0.06] space-y-1.5 text-xs">
                                <div className="font-bold text-slate-900 dark:text-white line-clamp-1 flex items-center gap-1.5">
                                  {session.is_restricted ? (
                                    <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  ) : (
                                    <Monitor className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                  )}
                                  <span className="truncate">{session.lecture_title}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                                  <span className="truncate">
                                    GV: <strong className="text-slate-800 dark:text-slate-200">{session.presenter_rank ? `${session.presenter_rank} ` : ''}{session.presenter_name}</strong>
                                  </span>
                                  <span className="font-mono text-red-700 dark:text-red-400 font-bold shrink-0">
                                    {session.student_count || 0} HV
                                  </span>
                                </div>

                                {/* Slide / Progress Bar */}
                                {(() => {
                                  const pct = session.scorm_progress != null
                                    ? Math.round(session.scorm_progress * 100)
                                    : session.slide_total && session.slide_total > 0
                                    ? Math.round(((session.slide_index || 1) / session.slide_total) * 100)
                                    : 10;
                                  return (
                                    <div className="pt-1">
                                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-red-500 rounded-full transition-all"
                                          style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                                        />
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                                        <span>Đã dạy {session.duration_minutes || 0}p</span>
                                        <span>Tiến độ {pct}%</span>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Upcoming Info */}
                            {!session && upcoming && (
                              <div className="mt-3 p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 text-xs space-y-1">
                                <div className="font-bold text-amber-900 dark:text-amber-300 truncate">
                                  Ca tiếp theo: {upcoming.lecture_title}
                                </div>
                                <div className="text-[11px] text-amber-800 dark:text-amber-400 truncate">
                                  GV: {upcoming.presenter_name} • {upcoming.class_name}
                                </div>
                              </div>
                            )}

                            {/* Maintenance Reason */}
                            {status === 'MAINTENANCE' && (
                              <div className="mt-3 p-2 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-400">
                                <span className="font-medium">{room.maintenance_reason || 'Bảo trì kỹ thuật định kỳ'}</span>
                              </div>
                            )}

                            {/* Available Empty Cue */}
                            {status === 'AVAILABLE' && (
                              <div className="mt-3 py-2 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900/40 border border-dashed border-slate-200/90 dark:border-slate-800 rounded-xl">
                                <span>Phòng sẵn sàng tiếp nhận ca dạy</span>
                              </div>
                            )}
                          </div>

                          {/* Footer Action Hint */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
                            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                              Hàng {room.grid_row} • Cột {room.grid_col}
                            </span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform whitespace-nowrap shrink-0">
                              <span>Chi tiết</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── COLUMN 3: INSPECTOR (DOCK PANEL ON >= 1200PX) ── */}
            {isDesktop && activeRoom && (
              <div className="w-80 lg:w-84 shrink-0 sticky top-4 space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
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
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {activeRoom.building_name} • Tầng {activeRoom.floor_number} • Sức chứa {activeRoom.capacity} HV
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Maintenance Toggle Button */}
                      {isAdministrator && (
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

                    {/* Active Session in Inspector */}
                    {roomDetail?.current_session ? (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800/40 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-300">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              ĐANG DIỄN RA
                            </span>
                            <span className="font-mono">
                              Đã dạy {roomDetail.current_session.duration_minutes || 0} phút
                            </span>
                          </div>

                          <div className="font-black text-sm text-slate-900 dark:text-white">
                            {roomDetail.current_session.lecture_title}
                          </div>

                          {/* Presenter & Class */}
                          <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Giảng viên:</span>
                              <strong className="text-slate-900 dark:text-white">
                                {roomDetail.current_session.presenter_rank ? `${roomDetail.current_session.presenter_rank} ` : ''}
                                {roomDetail.current_session.presenter_name}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Lớp học:</span>
                              <strong className="text-slate-900 dark:text-white">
                                {roomDetail.current_session.class_name}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Sĩ số tham gia:</span>
                              <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                                {roomDetail.current_session.student_count || 0} học viên
                              </strong>
                            </div>
                          </div>

                          {/* 🆕 TIẾN ĐỘ BÀI GIẢNG ĐẲNG CẤP TRÊN INSPECTOR */}
                          {renderLectureProgressBox(roomDetail.current_session)}
                        </div>

                        {/* Inspector Actions */}
                        <div className="flex items-center gap-2 pt-2">
                          {isAdministrator && (
                            <button
                              type="button"
                              onClick={() => {
                                const s = roomDetail.current_session!;
                                setConfirmTarget({
                                  scheduleId: s.schedule_id,
                                  lectureTitle: s.lecture_title,
                                  presenterName: s.presenter_name,
                                  venueName: activeRoom.room_name,
                                  isForce: true,
                                });
                              }}
                              disabled={endingId === roomDetail.current_session.schedule_id}
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
                          <span>Lịch sử / Kế hoạch hôm nay ({roomDetail.today_schedules.length})</span>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {roomDetail.today_schedules.map((ts) => (
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
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                ts.status === 'ONGOING'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                  : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}>
                                {ts.status === 'ONGOING' ? 'Đang dạy' : 'Đã xong'}
                              </span>
                            </div>
                          ))}
                        </div>
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
                  ) : roomDetail?.current_session ? (
                    <div className="space-y-4">
                      {/* Active Session Card */}
                      <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800/40 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            ĐANG GIẢNG BÀI
                          </span>
                          <span className="font-mono">
                            Đã dạy {roomDetail.current_session.duration_minutes || 0} phút
                          </span>
                        </div>

                        <div className="font-black text-base text-slate-900 dark:text-white">
                          {roomDetail.current_session.lecture_title}
                        </div>

                        {/* Details */}
                        <div className="space-y-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Giảng viên:</span>
                            <strong className="text-slate-900 dark:text-white">
                              {roomDetail.current_session.presenter_rank ? `${roomDetail.current_session.presenter_rank} ` : ''}
                              {roomDetail.current_session.presenter_name}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Lớp học:</span>
                            <strong className="text-slate-900 dark:text-white">
                              {roomDetail.current_session.class_name}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Sĩ số học viên:</span>
                            <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                              {roomDetail.current_session.student_count || 0} học viên
                            </strong>
                          </div>
                        </div>

                        {/* 🆕 TIẾN ĐỘ BÀI GIẢNG ĐẲNG CẤP TRÊN DRAWER */}
                        {renderLectureProgressBox(roomDetail.current_session)}
                      </div>

                      {/* End button for admin */}
                      {isAdministrator && (
                        <button
                          type="button"
                          onClick={() => {
                            const s = roomDetail.current_session!;
                            setConfirmTarget({
                              scheduleId: s.schedule_id,
                              lectureTitle: s.lecture_title,
                              presenterName: s.presenter_name,
                              venueName: activeRoom.room_name,
                              isForce: true,
                            });
                          }}
                          disabled={endingId === roomDetail.current_session.schedule_id}
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
                  {isAdministrator && (
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
                        <span>Kế hoạch đào tạo hôm nay</span>
                      </h5>
                      <div className="space-y-2">
                        {roomDetail.today_schedules.map((ts) => (
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              ts.status === 'ONGOING'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {ts.status === 'ONGOING' ? 'Đang dạy' : 'Đã xong'}
                            </span>
                          </div>
                        ))}
                      </div>
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
                const canForce = !isOwner && canForceEnd;

                return (
                  <div
                    key={s.schedule_id}
                    className={`bg-white dark:bg-[#111827] rounded-2xl border p-5 flex flex-col gap-3.5 transition-all shadow-xs relative ${
                      s.is_hanging
                        ? 'border-amber-500/60 bg-amber-50/20 dark:bg-amber-950/10 shadow-amber-500/10'
                        : 'border-slate-200 dark:border-white/[0.08] hover:border-emerald-500/40'
                    }`}
                  >
                    {/* Giảng đường & Trạng thái */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-white/[0.04] pb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-700 dark:text-emerald-400 font-bold">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {s.venue_name.toLowerCase().startsWith('giảng đường') ? s.venue_name : `Giảng đường: ${s.venue_name}`}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            Lớp: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{s.class_name || 'Học viên'}</strong>
                          </div>
                        </div>
                      </div>

                      {s.is_hanging ? (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40 shrink-0 flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          CẢNH BÁO TREO CA
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shrink-0 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          ĐANG GIẢNG BÀI
                        </span>
                      )}
                    </div>

                    {/* Tiêu đề bài giảng */}
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1" title={s.lecture_title}>
                        {s.lecture_title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Môn: {s.subject_name || 'Quân sự'}
                      </p>
                    </div>

                    {/* Thông tin chi tiết */}
                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-300/40">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none uppercase tracking-wider">
                            Cán bộ giảng dạy
                          </span>
                          <span className={`font-bold text-slate-900 dark:text-white truncate block mt-0.5 text-xs ${isOwner ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
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
                            <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none uppercase tracking-wider">
                              Sĩ số
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono truncate block mt-0.5 text-xs">
                              {s.student_count}
                              {s.class_student_total != null && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  {' / '}{s.class_student_total}
                                </span>
                              )}
                              <span className="font-normal text-slate-500 dark:text-slate-400"> HV</span>
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
                                <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none uppercase tracking-wider">
                                  Thời lượng
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono truncate block mt-0.5 text-xs">
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
                            lectureTitle: s.lecture_title,
                            presenterName: s.presenter_name,
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
