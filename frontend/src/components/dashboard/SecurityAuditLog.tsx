import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  FileText,
  RotateCw,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  User,
  HardDrive,
  Shield,
  Building,
  Terminal,
  Globe,
  Eye,
  Check,
  Copy,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { AccessLog } from '../../types/user';
import { dashboardApi } from '../../services/dashboardApi';
import { exportAuditReportExcel } from '../../utils/exportAuditReportExcel';

export type SeverityGroup = 'ALL' | 'ALERT' | 'SYSTEM' | 'ACCESS';

export function getActionCategory(action: string = '', note: string = ''): 'ALERT' | 'SYSTEM' | 'ACCESS' | 'INFO' {
  const act = (action || '').toUpperCase();
  const lowerNote = (note || '').toLowerCase();

  if (
    act.includes('FAIL') ||
    act.includes('DENIED') ||
    act.includes('BLOCK') ||   
    act.includes('ERROR') ||
    lowerNote.includes('sai mật khẩu') ||
    lowerNote.includes('thất bại') ||
    lowerNote.includes('từ chối') ||
    lowerNote.includes('bị khóa') ||
    lowerNote.includes('locked') ||
    lowerNote.includes('timeout') ||
    lowerNote.includes('không khớp')
  ) {
    return 'ALERT';
  }

  if (
    act.includes('ROLE') ||
    act.includes('USER') ||
    act.includes('FINGERPRINT') ||
    act.includes('CREDENTIAL') ||
    act.includes('PERMISSION') ||
    act.includes('UNIT') ||
    act.includes('UPDATE') ||
    act.includes('DELETE') ||
    act.includes('CREATE')
  ) {
    return 'SYSTEM';
  }

  if (
    act === 'VIEW' ||
    act === 'DOWNLOAD' ||
    act === 'UPLOAD' ||
    act.includes('AI_') ||
    act.includes('DOC')
  ) {
    return 'ACCESS';
  }

  return 'INFO';
}

export interface ExtractedTarget {
  type: 'doc' | 'user' | 'role' | 'device' | 'unit';
  id: string;
  name?: string;
  shortId?: string;
}

export function extractTargets(log: AccessLog): ExtractedTarget[] {
  const targets: ExtractedTarget[] = [];

  // 1. Nếu có tiêu đề hoặc file_id văn bản
  if (log.doc_title) {
    targets.push({ type: 'doc', id: log.file_id || 'DOC', name: log.doc_title });
  } else if (log.file_id) {
    targets.push({ type: 'doc', id: log.file_id, name: log.file_id });
  }

  // 2. Trích xuất thông minh từ ghi chú
  const note = log.note || '';
  if (note) {
    // USR-xxx (người nhận/đối tượng được thao tác)
    const userMatches = note.match(/USR-\d+/gi);
    if (userMatches) {
      userMatches.forEach((uid) => {
        const u = uid.toUpperCase();
        if (!targets.some((t) => t.id === u)) {
          targets.push({ type: 'user', id: u });
        }
      });
    }

    // ROL-xxx
    const roleMatches = note.match(/ROL-[\w-]+/gi);
    if (roleMatches) {
      roleMatches.forEach((rid) => {
        const r = rid.toUpperCase();
        if (!targets.some((t) => t.id === r)) {
          targets.push({ type: 'role', id: r });
        }
      });
    }

    // DEV-xxx
    const devMatches = note.match(/DEV-[a-f0-9-]+/gi);
    if (devMatches) {
      devMatches.forEach((did) => {
        if (!targets.some((t) => t.id === did)) {
          const shortId = did.length > 16 ? `${did.slice(0, 12)}...` : did;
          targets.push({ type: 'device', id: did, shortId });
        }
      });
    }

    // DV-xxx / UNIT-xxx
    const unitMatches = note.match(/(?:DV-\d+|UNIT-[\w-]+)/gi);
    if (unitMatches) {
      unitMatches.forEach((uid) => {
        const un = uid.toUpperCase();
        if (!targets.some((t) => t.id === un)) {
          targets.push({ type: 'unit', id: un });
        }
      });
    }
  }

  return targets;
}

function getInitials(name?: string, fallback = 'QN'): string {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface SecurityAuditLogProps {
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SecurityAuditLog: React.FC<SecurityAuditLogProps> = ({ showToast }) => {
  // Dữ liệu nhật ký
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Bộ lọc & Tìm kiếm
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityGroup>('ALL');
  const [actionFilter, setActionFilter] = useState('');

  // Tự động làm mới (Auto-Refresh)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // 10s, 30s, 0 (tắt)
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number>(30);

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isExporting, setIsExporting] = useState(false);

  // Xem chi tiết (Modal / Drawer)
  const [selectedLog, setSelectedLog] = useState<AccessLog | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Load logs từ API
  const fetchLogs = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const res = await dashboardApi.getAccessLogs();
      const items = res.items || [];
      setLogs(items);
      setCountdown(autoRefreshInterval);
    } catch (err: any) {
      if (showToast) {
        showToast('Lỗi tải nhật ký an ninh: ' + err.message, 'error');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Khởi tạo load logs
  useEffect(() => {
    fetchLogs();
  }, []);

  // Tự động làm mới theo chu kỳ
  useEffect(() => {
    if (isPaused || autoRefreshInterval <= 0) return;

    setCountdown(autoRefreshInterval);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchLogs(true);
          return autoRefreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, isPaused]);

  // Reset trang 1 khi lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, severityFilter, actionFilter, pageSize]);

  // Tính toán KPI Thống kê
  const kpiStats = useMemo(() => {
    let total = logs.length;
    let alerts = 0;
    let systemChanges = 0;
    let documentAccess = 0;

    for (const l of logs) {
      const cat = getActionCategory(l.action, l.note);
      if (cat === 'ALERT') alerts++;
      else if (cat === 'SYSTEM') systemChanges++;
      else if (cat === 'ACCESS') documentAccess++;
    }

    return { total, alerts, systemChanges, documentAccess };
  }, [logs]);

  // Lọc dữ liệu theo Search, Severity và Action
  const filteredLogs = useMemo(() => {
    let result = logs;

    // 1. Lọc theo Severity Group
    if (severityFilter !== 'ALL') {
      result = result.filter((l) => getActionCategory(l.action, l.note) === severityFilter);
    }

    // 2. Lọc theo Action cụ thể (nếu chọn từ dropdown)
    if (actionFilter) {
      result = result.filter((l) => (l.action || '').toUpperCase() === actionFilter.toUpperCase());
    }

    // 3. Lọc theo chuỗi tìm kiếm (IP, User, Tiêu đề, Ghi chú)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((l) => {
        const uId = (l.user_id || '').toLowerCase();
        const fName = (l.full_name || '').toLowerCase();
        const act = (l.action || '').toLowerCase();
        const doc = (l.doc_title || l.file_id || '').toLowerCase();
        const ip = (l.ip || '').toLowerCase();
        const note = (l.note || '').toLowerCase();
        return (
          uId.includes(q) ||
          fName.includes(q) ||
          act.includes(q) ||
          doc.includes(q) ||
          ip.includes(q) ||
          note.includes(q)
        );
      });
    }

    return result;
  }, [logs, severityFilter, actionFilter, searchQuery]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Xuất file Báo cáo Excel chuẩn định dạng Quân đội (Xuất báo cáo mẫu.xlsx)
  const handleExportExcel = async () => {
    if (filteredLogs.length === 0) {
      if (showToast) showToast('Không có dữ liệu nhật ký để xuất!', 'info');
      return;
    }

    try {
      setIsExporting(true);
      await exportAuditReportExcel(filteredLogs);
      if (showToast) {
        showToast(`Đã xuất thành công ${filteredLogs.length} sự kiện an ninh sang file Excel (.xlsx)!`, 'success');
      }
    } catch (err: any) {
      if (showToast) {
        showToast('Lỗi khi xuất file Excel: ' + err.message, 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Copy JSON trong Modal
  const handleCopyJson = (log: AccessLog) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Render tag hành động theo chuẩn Soft Glow Muted Neon (hỗ trợ cả Light & Dark mode)
  const renderActionBadge = (action: string, note = '') => {
    const act = (action || '').toUpperCase();
    const cat = getActionCategory(act, note);

    if (cat === 'ALERT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider font-mono uppercase bg-rose-50 text-rose-700 border border-rose-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-500/30 dark:shadow-[0_0_10px_rgba(239,68,68,0.15)]">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-red-400 animate-pulse" />
          {act}
        </span>
      );
    }

    if (cat === 'SYSTEM') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider font-mono uppercase bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500/30 dark:shadow-[0_0_8px_rgba(245,158,11,0.12)]">
          {act}
        </span>
      );
    }

    if (act === 'LOGIN') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500/30 dark:shadow-[0_0_8px_rgba(16,185,129,0.12)]">
          {act}
        </span>
      );
    }

    if (act === 'VIEW' || act === 'DOWNLOAD') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider font-mono uppercase bg-sky-50 text-sky-700 border border-sky-300 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-500/30 dark:shadow-[0_0_8px_rgba(14,165,233,0.12)]">
          {act}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider font-mono uppercase bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700/50">
        {act}
      </span>
    );
  };

  // Render đối tượng / văn bản thông minh tránh trống trải
  const renderTargetEntities = (log: AccessLog) => {
    const targets = extractTargets(log);

    if (targets.length === 0) {
      return <span className="text-slate-400 dark:text-slate-500">—</span>;
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5 max-w-sm">
        {targets.map((tgt, idx) => {
          if (tgt.type === 'doc') {
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20 max-w-[260px] truncate"
                title={tgt.name || tgt.id}
              >
                <FileText className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{tgt.name || tgt.id}</span>
              </span>
            );
          }

          if (tgt.type === 'user') {
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20 whitespace-nowrap"
              >
                <User className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                {tgt.id}
              </span>
            );
          }

          if (tgt.type === 'role') {
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20 whitespace-nowrap"
              >
                <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                {tgt.id}
              </span>
            );
          }

          if (tgt.type === 'device') {
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20 whitespace-nowrap"
                title={`Thiết bị ID: ${tgt.id}`}
              >
                <HardDrive className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                {tgt.shortId || tgt.id}
              </span>
            );
          }

          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/60 whitespace-nowrap"
            >
              <Building className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
              {tgt.id}
            </span>
          );
        })}
      </div>
    );
  };

  // Highlight nội dung ghi chú
  const renderHighlightedNote = (note?: string, isAlert = false) => {
    if (!note) return <span className="text-slate-400 dark:text-slate-500">—</span>;

    // Phân tách các token ID và từ khóa cảnh báo
    const parts = note.split(/(USR-\d+|DEV-[a-f0-9-]+|ROL-[\w-]+|sai mật khẩu|thất bại|bị khóa|timeout|không khớp|lỗi:?)/gi);

    return (
      <span className={`text-xs ${isAlert ? 'text-rose-900 dark:text-rose-200 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>
        {parts.map((p, i) => {
          if (/^USR-\d+$/i.test(p)) {
            return (
              <span key={i} className="font-mono text-sky-700 dark:text-sky-300 font-semibold px-1 py-0.5 rounded bg-sky-100/80 dark:bg-sky-500/10 mx-0.5 border border-sky-200/80 dark:border-sky-500/20">
                {p.toUpperCase()}
              </span>
            );
          }
          if (/^ROL-[\w-]+$/i.test(p)) {
            return (
              <span key={i} className="font-mono text-amber-700 dark:text-amber-300 font-semibold px-1 py-0.5 rounded bg-amber-100/80 dark:bg-amber-500/10 mx-0.5 border border-amber-200/80 dark:border-amber-500/20">
                {p.toUpperCase()}
              </span>
            );
          }
          if (/^DEV-[a-f0-9-]+$/i.test(p)) {
            return (
              <span key={i} className="font-mono text-amber-700 dark:text-amber-300 font-semibold px-1 py-0.5 rounded bg-amber-100/80 dark:bg-amber-500/10 mx-0.5 border border-amber-200/80 dark:border-amber-500/20" title={p}>
                {p.length > 18 ? `${p.slice(0, 14)}...` : p}
              </span>
            );
          }
          if (/^(sai mật khẩu|thất bại|bị khóa|timeout|không khớp|lỗi:?)$/i.test(p)) {
            return (
              <span key={i} className="text-rose-600 dark:text-red-400 font-bold mx-0.5 uppercase tracking-wide">
                {p}
              </span>
            );
          }
          return p;
        })}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* HEADER SECTION: TIÊU ĐỀ & AUTO-REFRESH STATUS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Nhật Ký Hoạt Động & Kiểm Toán An Ninh
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Giám sát truy cập văn bản & thay đổi phân quyền hệ thống 24/7 (Chuẩn SOC)
              </p>
            </div>
          </div>
        </div>

        {/* Live Indicator, Auto-refresh & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Indicator Badge */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs ${
              !isPaused
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-900/30'
                : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200 dark:bg-slate-900/80 dark:border-slate-700/60 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
            title={!isPaused ? 'Click để tạm dừng tự động làm mới' : 'Click để tiếp tục tự động làm mới'}
          >
            <span className="relative flex h-2 w-2">
              {!isPaused && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  !isPaused ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
                }`}
              />
            </span>
            <span>{!isPaused ? 'Hệ thống Trực tuyến' : 'Đã tạm dừng'}</span>
            {!isPaused && autoRefreshInterval > 0 && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-300/80 font-mono font-bold">({countdown}s)</span>
            )}
          </button>

          {/* Chọn chu kỳ Auto-refresh */}
          <div className="flex items-center bg-slate-100 border border-slate-200 dark:bg-slate-900/80 dark:border-slate-800 rounded-xl p-0.5 text-xs shadow-xs">
            <button
              onClick={() => {
                setAutoRefreshInterval(10);
                setIsPaused(false);
              }}
              className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                autoRefreshInterval === 10 && !isPaused
                  ? 'bg-[#166534] dark:bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              10s
            </button>
            <button
              onClick={() => {
                setAutoRefreshInterval(30);
                setIsPaused(false);
              }}
              className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                autoRefreshInterval === 30 && !isPaused
                  ? 'bg-[#166534] dark:bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              30s
            </button>
            <button
              onClick={() => setIsPaused(true)}
              className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                isPaused
                  ? 'bg-slate-200 text-slate-800 font-semibold dark:bg-slate-800 dark:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Tắt
            </button>
          </div>

          {/* Nút Làm Mới thủ công */}
          <button
            onClick={async () => {
              await fetchLogs(false);
              if (showToast) showToast('Đã làm mới dữ liệu nhật ký an ninh!', 'success');
            }}
            disabled={loading || isRefreshing}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 dark:bg-slate-900/80 dark:hover:bg-slate-800 dark:border-slate-800 dark:text-slate-300 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
            title="Làm mới ngay"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing || loading ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`} />
          </button>

          {/* Nút Xuất Excel */}
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-emerald-950/20 cursor-pointer border border-amber-500/25"
            title="Xuất file báo cáo Excel (.xlsx) chuẩn Quân đội"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
          </button>
        </div>
      </div>

      {/* 2. SECURITY KPI SUMMARY CARDS (GRID 4 CỘT) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Tổng hoạt động */}
        <div
          onClick={() => setSeverityFilter('ALL')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            severityFilter === 'ALL'
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/30 shadow-md dark:bg-slate-800/90 dark:border-emerald-500/70 dark:ring-emerald-500/50 dark:shadow-[0_0_15px_rgba(16,185,129,0.15)]'
              : 'bg-white hover:bg-slate-50/80 border-slate-200/80 shadow-xs dark:bg-[#111827]/80 dark:hover:bg-slate-900 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tổng hoạt động</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">{kpiStats.total}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">sự kiện</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <span>Bản ghi giám sát 24/7</span>
          </div>
        </div>

        {/* Card 2: Cảnh báo An ninh */}
        <div
          onClick={() => setSeverityFilter(severityFilter === 'ALERT' ? 'ALL' : 'ALERT')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            severityFilter === 'ALERT'
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/30 shadow-md dark:bg-red-950/30 dark:border-red-500/70 dark:ring-red-500/50 dark:shadow-[0_0_15px_rgba(239,68,68,0.2)]'
              : 'bg-white hover:bg-slate-50/80 border-slate-200/80 shadow-xs dark:bg-[#111827]/80 dark:hover:bg-slate-900 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cảnh báo An ninh</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 relative">
              <ShieldAlert className="w-4 h-4" />
              {kpiStats.alerts > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 dark:bg-red-500 animate-ping" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-600 dark:text-red-400">{kpiStats.alerts}</span>
            <span className="text-[11px] text-rose-500 dark:text-red-300/80 font-medium">nguy cơ</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <span>Đăng nhập lỗi / Thất bại</span>
          </div>
        </div>

        {/* Card 3: Biến động Phân quyền / Tài khoản */}
        <div
          onClick={() => setSeverityFilter(severityFilter === 'SYSTEM' ? 'ALL' : 'SYSTEM')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            severityFilter === 'SYSTEM'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/30 shadow-md dark:bg-amber-950/30 dark:border-amber-500/70 dark:ring-amber-500/50 dark:shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              : 'bg-white hover:bg-slate-50/80 border-slate-200/80 shadow-xs dark:bg-[#111827]/80 dark:hover:bg-slate-900 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Biến động Phân quyền</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{kpiStats.systemChanges}</span>
            <span className="text-[11px] text-amber-600 dark:text-amber-300/80 font-medium">thay đổi</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <span>Quản trị User & Quyền</span>
          </div>
        </div>

        {/* Card 4: Khai thác Văn bản */}
        <div
          onClick={() => setSeverityFilter(severityFilter === 'ACCESS' ? 'ALL' : 'ACCESS')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            severityFilter === 'ACCESS'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/30 shadow-md dark:bg-emerald-950/30 dark:border-emerald-500/70 dark:ring-emerald-500/50 dark:shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-white hover:bg-slate-50/80 border-slate-200/80 shadow-xs dark:bg-[#111827]/80 dark:hover:bg-slate-900 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Khai thác Văn bản</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{kpiStats.documentAccess}</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-300/80 font-medium">lượt đọc/tải</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <span>Truy cập VIEW & DOWNLOAD</span>
          </div>
        </div>
      </div>

      {/* 3. TOOLBAR: SEVERITY PILLS & SEARCH & ACTIONS */}
      <div className="p-3 bg-white border border-slate-200/80 text-slate-700 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs dark:bg-[#111827]/80 dark:backdrop-blur-md dark:border-slate-800 dark:text-slate-200">
        {/* Severity Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Mức độ:
          </span>
          <button
            onClick={() => setSeverityFilter('ALL')}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer border ${
              severityFilter === 'ALL'
                ? 'bg-[#166534] dark:bg-emerald-600 text-white border-emerald-500 shadow-xs'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70 hover:text-slate-900 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Tất cả ({kpiStats.total})
          </button>
          <button
            onClick={() => setSeverityFilter('ALERT')}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer border flex items-center gap-1.5 ${
              severityFilter === 'ALERT'
                ? 'bg-rose-50 text-rose-700 border-rose-300 font-bold shadow-xs dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/50 dark:shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-red-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-red-400" />
            Cảnh báo ({kpiStats.alerts})
          </button>
          <button
            onClick={() => setSeverityFilter('SYSTEM')}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer border flex items-center gap-1.5 ${
              severityFilter === 'SYSTEM'
                ? 'bg-amber-50 text-amber-700 border-amber-300 font-bold shadow-xs dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/50 dark:shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-amber-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
            Thay đổi hệ thống ({kpiStats.systemChanges})
          </button>
          <button
            onClick={() => setSeverityFilter('ACCESS')}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer border flex items-center gap-1.5 ${
              severityFilter === 'ACCESS'
                ? 'bg-sky-50 text-sky-700 border-sky-300 font-bold shadow-xs dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/50 dark:shadow-[0_0_8px_rgba(14,165,233,0.2)]'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-sky-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400" />
            Truy cập ({kpiStats.documentAccess})
          </button>
        </div>

        {/* Action Dropdown & Search Input */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Dropdown hành động chi tiết */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-600 dark:focus:border-emerald-500 shadow-xs dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
          >
            <option value="">Tất cả hành động</option>
            <option value="LOGIN">LOGIN (Đăng nhập)</option>
            <option value="LOGIN_FAIL">LOGIN_FAIL (Đăng nhập thất bại)</option>
            <option value="VIEW">VIEW (Xem tài liệu)</option>
            <option value="DOWNLOAD">DOWNLOAD (Tải tệp)</option>
            <option value="UPLOAD">UPLOAD (Tải lên)</option>
            <option value="CREATE_USER">CREATE_USER (Tạo quân nhân)</option>
            <option value="UPDATE_USER">UPDATE_USER (Sửa quân nhân)</option>
            <option value="DELETE_USER">DELETE_USER (Xóa quân nhân)</option>
            <option value="ASSIGN_ROLE">ASSIGN_ROLE (Gán vai trò)</option>
            <option value="REVOKE_ROLE">REVOKE_ROLE (Thu hồi vai trò)</option>
            <option value="FINGERPRINT_ENROLL">FINGERPRINT_ENROLL (Đăng ký vân tay)</option>
            <option value="FINGERPRINT_FAIL">FINGERPRINT_FAIL (Lỗi vân tay)</option>
          </select>

          {/* Ô tìm kiếm tổng hợp */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm IP, User, Tiêu đề, Ghi chú..."
              className="w-full sm:w-64 pl-9 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 dark:focus:border-emerald-500 shadow-xs dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. TABLE SECTION (CHUẨN CẢ LIGHT & DARK NIGHT MODE) */}
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm dark:bg-[#111827]/80 dark:backdrop-blur-md dark:border-slate-800 dark:shadow-xl">
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-left text-xs min-w-[980px]">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] border-b border-slate-200 font-semibold tracking-wider dark:bg-slate-900/90 dark:text-slate-400 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Thời Gian</th>
                <th className="py-3 px-4 whitespace-nowrap">Quân Nhân</th>
                <th className="py-3 px-4 whitespace-nowrap">Hành Động</th>
                <th className="py-3 px-4 whitespace-nowrap">Văn Bản / Đối Tượng</th>
                <th className="py-3 px-4 whitespace-nowrap">Địa Chỉ IP</th>
                <th className="py-3 px-4">Ghi Chú</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCw className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span>Đang tải nhật ký kiểm toán an ninh...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldAlert className="w-7 h-7 text-slate-400 dark:text-slate-600" />
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-300">Không tìm thấy sự kiện nào</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        Thử điều chỉnh từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc phân loại.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((l, idx) => {
                  const category = getActionCategory(l.action, l.note);
                  const isAlert = category === 'ALERT';

                  // Định dạng thời gian: Dòng 1 giờ, Dòng 2 ngày
                  const rawTime = l.created_at || l.timestamp;
                  const dateObj = rawTime ? new Date(rawTime) : null;
                  const timeFormatted = dateObj
                    ? dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                    : '—';
                  const dateFormatted = dateObj
                    ? dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '';

                  // IP format: Kiểm tra localhost
                  const isLocalhost =
                    l.ip === '::1' || l.ip === '127.0.0.1' || l.ip === '::ffff:127.0.0.1';

                  return (
                    <tr
                      key={l.log_id || idx}
                      onClick={() => setSelectedLog(l)}
                      className={`transition-colors cursor-pointer group ${
                        isAlert
                          ? 'border-l-4 border-l-rose-500 bg-rose-50/70 hover:bg-rose-100/60 dark:border-l-2 dark:border-l-red-500 dark:bg-red-950/20 dark:hover:bg-red-950/30'
                          : 'bg-white hover:bg-slate-50/90 dark:bg-slate-900/40 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {/* Cột THỜI GIAN */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono">
                        <div className={`font-bold text-xs ${isAlert ? 'text-rose-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-200'}`}>
                          {timeFormatted}
                        </div>
                        <div className={`text-[11px] mt-0.5 ${isAlert ? 'text-rose-500/80 dark:text-red-400/70' : 'text-slate-400 dark:text-slate-500'}`}>
                          {dateFormatted}
                        </div>
                      </td>

                      {/* Cột QUÂN NHÂN (Avatar + Name + Badge USR không rớt dòng) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {/* Avatar Circle */}
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isAlert
                                ? 'bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500/40'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-gradient-to-tr dark:from-emerald-950 dark:to-emerald-900 dark:border-emerald-500/30 dark:text-emerald-200'
                            }`}
                          >
                            {getInitials(l.full_name)}
                          </div>
                          {/* Name */}
                          <span className={`font-semibold text-xs ${isAlert ? 'text-rose-950 dark:text-rose-200' : 'text-slate-900 dark:text-slate-200'}`}>
                            {l.full_name || l.user_id || 'Hệ thống'}
                          </span>
                          {/* User ID Badge */}
                          {l.user_id && (
                            <span
                              className={`font-mono text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap shadow-2xs font-semibold ${
                                isAlert
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-red-900/40 dark:text-rose-300 dark:border-red-500/30'
                                  : 'text-amber-800 bg-amber-500/10 border border-amber-600/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25'
                              }`}
                            >
                              {l.user_id}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột HÀNH ĐỘNG */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderActionBadge(l.action, l.note)}
                      </td>

                      {/* Cột VĂN BẢN / ĐỐI TƯỢNG */}
                      <td className="py-3 px-4">
                        {renderTargetEntities(l)}
                      </td>

                      {/* Cột ĐỊA CHỈ IP */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                        {isLocalhost ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                              isAlert
                                ? 'bg-rose-100/80 text-rose-800 border border-rose-300/80 dark:bg-red-900/40 dark:text-rose-300 dark:border-red-500/30'
                                : 'bg-slate-100 text-slate-700 border border-slate-300/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700/60'
                            }`}
                          >
                            <Terminal className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                            <span>{l.ip} (Localhost)</span>
                          </span>
                        ) : l.ip ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px] dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/40">
                            <Globe className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                            <span>{l.ip}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>

                      {/* Cột GHI CHÚ */}
                      <td className="py-3 px-4 text-xs max-w-md">
                        {renderHighlightedNote(l.note, isAlert)}
                      </td>

                      {/* Nút Xem Chi Tiết */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(l);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/10 transition cursor-pointer"
                          title="Xem chi tiết sự kiện"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. FOOTER: PHÂN TRANG CHUYÊN NGHIỆP */}
        <div className="p-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/90 dark:border-slate-800 dark:text-slate-400 dark:bg-slate-900/90">
          {/* Bên trái: Thông tin hiển thị */}
          <div className="flex items-center gap-2">
            <span>
              Hiển thị{' '}
              <span className="font-bold text-slate-900 dark:text-slate-200">
                {filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, filteredLogs.length)}
              </span>{' '}
              trong tổng số <span className="font-bold text-slate-900 dark:text-slate-200">{filteredLogs.length}</span> sự kiện
            </span>
          </div>

          {/* Ở giữa: Chọn số dòng trên mỗi trang */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">Số dòng:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
            >
              <option value={10}>10 dòng</option>
              <option value={20}>20 dòng</option>
              <option value={50}>50 dòng</option>
              <option value={100}>100 dòng</option>
            </select>
          </div>

          {/* Bên phải: Nút điều hướng phân trang */}
          <div className="flex items-center space-x-1">
            {/* Trang đầu */}
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition dark:bg-slate-800/80 dark:border-transparent dark:hover:bg-slate-700 dark:text-slate-300"
              title="Về trang đầu"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Trang trước */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition dark:bg-slate-800/80 dark:border-transparent dark:hover:bg-slate-700 dark:text-slate-300"
              title="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Các nút số trang */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <React.Fragment key={p}>
                    {showEllipsis && <span className="px-1 text-slate-400 dark:text-slate-600 font-mono">...</span>}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={`min-w-[28px] h-7 px-2 rounded-lg transition text-xs font-mono font-medium ${
                        currentPage === p
                          ? 'bg-[#166534] dark:bg-emerald-600 text-white font-bold shadow-xs'
                          : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:border-transparent dark:hover:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            {/* Trang sau */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition dark:bg-slate-800/80 dark:border-transparent dark:hover:bg-slate-700 dark:text-slate-300"
              title="Trang sau"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Trang cuối */}
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition dark:bg-slate-800/80 dark:border-transparent dark:hover:bg-slate-700 dark:text-slate-300"
              title="Đến trang cuối"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 6. LOG DETAIL MODAL / DRAWER (XEM CHI TIẾT SỰ KIỆN SOC) */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl mx-auto w-[calc(100vw-32px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      Chi Tiết Nhật Ký Kiểm Toán An Ninh
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20">
                        Mã: {selectedLog.log_id || 'N/A'}
                      </span>
                      <span className="text-xs text-slate-500">Chuẩn SOC Record</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:text-white dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* 1. Thông tin tổng quan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-950/50 dark:border-slate-800/80">
                    <span className="text-slate-500 text-[11px] block">Thời gian ghi nhận</span>
                    <span className="text-slate-900 dark:text-slate-200 font-mono text-xs font-semibold mt-1 block">
                      {selectedLog.created_at || selectedLog.timestamp
                        ? new Date(selectedLog.created_at || selectedLog.timestamp || '').toLocaleString('vi-VN')
                        : '—'}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px] mt-0.5 block">
                      ISO: {selectedLog.created_at || selectedLog.timestamp || 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-950/50 dark:border-slate-800/80">
                    <span className="text-slate-500 text-[11px] block">Hành động & Phân loại</span>
                    <div className="mt-1 flex items-center gap-2">
                      {renderActionBadge(selectedLog.action, selectedLog.note)}
                      <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                        Nhóm: <strong className="text-slate-900 dark:text-slate-200">{getActionCategory(selectedLog.action, selectedLog.note)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-950/50 dark:border-slate-800/80">
                    <span className="text-slate-500 text-[11px] block">Quân nhân thực hiện</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/80 dark:border-emerald-500/30 dark:text-emerald-200 flex items-center justify-center text-[10px] font-bold">
                        {getInitials(selectedLog.full_name)}
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-slate-200">{selectedLog.full_name || 'Hệ thống'}</span>
                      {selectedLog.user_id && (
                        <span className="font-mono text-[11px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 dark:text-sky-400 dark:bg-sky-500/10 dark:border-sky-500/20">
                          {selectedLog.user_id}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-950/50 dark:border-slate-800/80">
                    <span className="text-slate-500 text-[11px] block">Địa chỉ IP & Vùng mạng</span>
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300">
                      <Terminal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>{selectedLog.ip || '—'}</span>
                      {selectedLog.ip === '::1' || selectedLog.ip === '127.0.0.1' ? (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                          Localhost
                        </span>
                      ) : (
                        <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 dark:text-sky-400 dark:bg-sky-500/10 dark:border-sky-500/20">
                          Intranet QK7
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Đối tượng tác động */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-950/50 dark:border-slate-800/80">
                  <span className="text-slate-500 text-[11px] block mb-1.5 font-semibold uppercase tracking-wider">
                    Văn bản / Đối tượng tác động
                  </span>
                  <div>{renderTargetEntities(selectedLog)}</div>
                </div>

                {/* 3. Chi tiết Ghi chú */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-950/50 dark:border-slate-800/80">
                  <span className="text-slate-500 text-[11px] block mb-1 font-semibold uppercase tracking-wider">
                    Nội dung Ghi chú & Thông điệp kiểm toán
                  </span>
                  <div className="bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-2.5 rounded-lg text-slate-800 dark:text-slate-200 font-sans text-xs leading-relaxed">
                    {renderHighlightedNote(selectedLog.note, getActionCategory(selectedLog.action, selectedLog.note) === 'ALERT')}
                  </div>
                </div>

                {/* 4. Dữ liệu thô JSON (Raw SOC Payload) */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-950/50 dark:border-slate-800/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                      Dữ liệu thô sự kiện (Raw Payload JSON)
                    </span>
                    <button
                      onClick={() => handleCopyJson(selectedLog)}
                      className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold cursor-pointer"
                    >
                      {copiedJson ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-600 dark:text-emerald-400">Đã chép!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Sao chép JSON</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-lg border border-slate-800 overflow-x-auto max-h-40">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 flex items-center justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
