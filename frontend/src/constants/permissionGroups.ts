import type { ElementType } from 'react';
import {
  Activity, BookOpen, Bot, FileText, Fingerprint, Gauge, KeyRound, Library,
  Monitor, MonitorPlay, Settings, Shield, ShieldAlert, Users,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// NHÓM QUYỀN (PERMISSION.group_code) — NGUỒN DUY NHẤT
// Dùng chung cho: bảng Quyền hạn, phân quyền cho vai trò, cấp quyền riêng cho người dùng.
// Thêm phân hệ mới: chỉ cần thêm một dòng ở đây (và GROUP_META của trang Khóa bảo vệ).
// Nhóm chưa khai báo VẪN HIỆN (xếp cuối, mang tên mã nhóm), không bao giờ bị ẩn.
// ═══════════════════════════════════════════════════════════
export interface PermissionGroup {
  label: string;
  emoji: string;
  icon: ElementType;
  color: string;
  bg: string;
  border: string;
  description: string;
}

const tone = (name: 'emerald' | 'cyan' | 'sky' | 'amber' | 'rose' | 'purple' | 'indigo' | 'teal' | 'lime') => ({
  emerald: { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30' },
  cyan: { color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-cyan-200 dark:border-cyan-500/30' },
  sky: { color: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-500/10', border: 'border-sky-200 dark:border-sky-500/30' },
  amber: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/30' },
  rose: { color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-200 dark:border-rose-500/30' },
  purple: { color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/30' },
  indigo: { color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10', border: 'border-indigo-200 dark:border-indigo-500/30' },
  teal: { color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10', border: 'border-teal-200 dark:border-teal-500/30' },
  lime: { color: 'text-lime-700 dark:text-lime-400', bg: 'bg-lime-50 dark:bg-lime-500/10', border: 'border-lime-200 dark:border-lime-500/30' },
}[name]);

const NEUTRAL = {
  color: 'text-slate-700 dark:text-slate-400',
  bg: 'bg-slate-100 dark:bg-slate-700/40',
  border: 'border-slate-300 dark:border-slate-600/40',
};

// Thứ tự khai báo = thứ tự hiển thị ở mọi màn hình
export const PERMISSION_GROUP_CONFIG: Record<string, PermissionGroup> = {
  DOCUMENT: { label: 'Văn bản', emoji: '📄', icon: FileText, ...tone('emerald'), description: 'Tra cứu, đăng tải, tải về tài liệu' },
  LECTURE: { label: 'Bài giảng', emoji: '🎓', icon: MonitorPlay, ...tone('cyan'), description: 'Xem, soạn, duyệt, xóa bài giảng số' },
  LIBRARY: { label: 'Thư viện số', emoji: '📚', icon: Library, ...tone('teal'), description: 'Số hóa, chỉnh sửa, thùng rác, thể loại thư viện' },
  USER: { label: 'Người dùng', emoji: '👤', icon: Users, ...tone('sky'), description: 'Quản lý tài khoản quân nhân' },
  ROLE: { label: 'Vai trò', emoji: '🔑', icon: KeyRound, ...tone('amber'), description: 'CRUD vai trò hệ thống' },
  PERMISSION: { label: 'Quyền', emoji: '🛡️', icon: ShieldAlert, ...tone('rose'), description: 'Quản lý danh mục quyền' },
  CATALOG: { label: 'Danh mục', emoji: '🗂️', icon: BookOpen, ...tone('purple'), description: 'Đơn vị, loại VB, cấp bậc, chức vụ' },
  FINGERPRINT: { label: 'Sinh trắc', emoji: '🔒', icon: Fingerprint, ...tone('cyan'), description: 'Vân tay ZKTeco ZK9500' },
  AUDIT: { label: 'Kiểm toán', emoji: '📊', icon: Activity, ...tone('indigo'), description: 'Nhật ký SOC và xuất Excel' },
  AI: { label: 'Trợ lý AI', emoji: '🤖', icon: Bot, ...tone('teal'), description: 'Hỏi đáp RAG, study-book' },
  SYSTEM: { label: 'Hệ thống', emoji: '⚙️', icon: Settings, ...NEUTRAL, description: 'Dashboard, health check' },
  COMMAND: { label: 'Chỉ huy', emoji: '🎖️', icon: Gauge, ...tone('emerald'), description: 'Xem tổng quan giám sát toàn hệ thống (chỉ đọc)' },
  SESSION: { label: 'Phiên', emoji: '🖥️', icon: Monitor, ...tone('lime'), description: 'Quản lý phiên đăng nhập' },
};

export const PERMISSION_GROUP_CODES = Object.keys(PERMISSION_GROUP_CONFIG);

export function getPermissionGroup(code?: string | null): PermissionGroup {
  const key = (code || 'SYSTEM').toUpperCase();
  return PERMISSION_GROUP_CONFIG[key]
    || { label: key, emoji: '•', icon: Shield, ...NEUTRAL, description: 'Nhóm quyền chưa đặt tên' };
}

/** Sắp xếp các mã nhóm theo thứ tự chuẩn; nhóm lạ xếp cuối theo bảng chữ cái */
export function orderPermissionGroups(codes: Iterable<string>): string[] {
  const rank = (code: string) => {
    const index = PERMISSION_GROUP_CODES.indexOf(code.toUpperCase());
    return index < 0 ? PERMISSION_GROUP_CODES.length : index;
  };
  return [...codes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Quyền nguy hiểm: được làm nổi bật khi gán */
export const DANGEROUS_PERMISSION_CODES = new Set([
  'DOC_PURGE', 'LIB_PURGE', 'PERMISSION_DELETE', 'ROLE_DELETE', 'USER_DELETE', 'SESSION_KILL',
]);

/** Tên tiếng Việt của quyền Thư viện số, dùng ở các trang yêu cầu phê duyệt */
export const LIBRARY_PERMISSION_NAMES: Record<string, string> = {
  LIB_UPLOAD: 'Đăng tải thư viện',
  LIB_EDIT: 'Sửa tài liệu thư viện',
  LIB_PARSE: 'Đọc tệp thư viện',
  LIB_DELETE: 'Xóa tạm tài liệu thư viện',
  LIB_TRASH_VIEW: 'Xem thùng rác thư viện',
  LIB_RESTORE: 'Khôi phục tài liệu thư viện',
  LIB_PURGE: 'Xóa vĩnh viễn tài liệu thư viện',
  LIB_CATEGORY_MANAGE: 'Quản lý thể loại thư viện',
  LIB_VIEW: 'Xem thư viện (không còn dùng)',
  LIB_DOWNLOAD: 'Tải thư viện (không còn dùng)',
};
