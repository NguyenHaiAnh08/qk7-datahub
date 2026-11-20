import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronDown, Gauge, Library, MonitorPlay, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROUTE_PATHS } from '../../routes/routePaths';

export type MainNavKey = 'portal' | 'lectures' | 'classrooms' | 'library' | 'admin';

interface NavChild {
  key: string;
  label: string;
  description?: string;
  to: string;
  visible: boolean;
  isActive: (path: string, search: string) => boolean;
}

interface NavItem {
  key: MainNavKey;
  label: string;
  icon: LucideIcon;
  to: string;
  visible: boolean;
  children?: NavChild[];
}

export interface MainNavBarProps {
  /** Mục đang chọn do trang truyền vào (tương thích prop activeNav cũ của Header) */
  activeNav?: 'desk' | 'portal' | 'myunit' | 'admin' | 'login' | 'lectures' | 'classrooms' | 'materials' | 'library' | 'data';
  canAccessAdmin: boolean;
}

interface PanelPos { left: number; top: number }

const HOVER_CLOSE_DELAY = 150;

const itemBase =
  'group relative flex items-center gap-2 px-3.5 sm:px-4 h-11 rounded-t-lg text-[14px] sm:text-[15px] font-semibold whitespace-nowrap select-none cursor-pointer transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-amber-300';
const itemIdle =
  'text-slate-600 hover:text-emerald-800 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60';
const itemActive =
  'text-emerald-800 bg-emerald-50/90 shadow-[inset_0_-3px_0_0_#166534] dark:text-amber-300 dark:bg-slate-800/80 dark:shadow-[inset_0_-3px_0_0_#fbbf24] font-bold';

export const MainNavBar: React.FC<MainNavBarProps> = ({ activeNav: explicitActiveNav, canAccessAdmin }) => {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const search = location.search;

  const [openKey, setOpenKey] = useState<MainNavKey | null>(null);
  const [pos, setPos] = useState<PanelPos>({ left: 0, top: 0 });
  const buttonRefs = useRef<Partial<Record<MainNavKey, HTMLButtonElement | null>>>({});
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const focusFirst = useRef(false);

  // ── Mục đang chọn ──
  const activeKey: MainNavKey | undefined = useMemo(() => {
    if (explicitActiveNav) {
      if (['desk', 'myunit', 'portal', 'data'].includes(explicitActiveNav)) return 'portal';
      if (['lectures', 'classrooms', 'library', 'admin'].includes(explicitActiveNav)) {
        return explicitActiveNav as MainNavKey;
      }
    }
    if (path.startsWith(ROUTE_PATHS.DESK) || path.startsWith(ROUTE_PATHS.MY_UNIT) || path.startsWith(ROUTE_PATHS.PORTAL)) {
      return 'portal';
    }
    if (path.startsWith(ROUTE_PATHS.LECTURES)) return 'lectures';
    if (path.startsWith(ROUTE_PATHS.CLASSROOMS)) return 'classrooms';
    if (path.startsWith(ROUTE_PATHS.LIBRARY)) return 'library';
    if (path.startsWith(ROUTE_PATHS.ADMIN)) return 'admin';
    return undefined;
  }, [explicitActiveNav, path]);

  // ── Danh mục điều hướng: chỉ hiện mục/tác vụ mà vai trò có quyền ──
  const items: NavItem[] = useMemo(() => {
    const isGuest = !user || user.user_id === 'GUEST';
    const hasUnit = !isGuest && Boolean(user?.unit_id || user?.unit_name);
    const canDesk = hasPermission('DOC_UPLOAD') || hasPermission('DOC_EDIT') || hasPermission('DOC_PARSE');
    const canLectures = Boolean(hasPermission('LECTURE_VIEW') || isGuest);
    // Trang Giám sát dành riêng cho chỉ huy/quản lý (quyền COMMAND_VIEW), không mở theo LECTURE_VIEW
    const canMonitor = Boolean(hasPermission('COMMAND_VIEW'));
    const canCompose = Boolean(hasAnyPermission(['LECTURE_CREATE', 'LECTURE_APPROVE', 'LECTURE_DELETE']));

    return [
      {
        key: 'portal',
        label: 'Văn bản số',
        icon: BookOpen,
        to: ROUTE_PATHS.PORTAL,
        visible: true,
        children: [
          {
            key: 'portal-all',
            label: 'Kho dữ liệu chung',
            description: 'Tra cứu toàn bộ tài liệu số của Nhà trường',
            to: ROUTE_PATHS.PORTAL,
            visible: true,
            isActive: (p) => p.startsWith(ROUTE_PATHS.PORTAL),
          },
          {
            key: 'portal-unit',
            label: `Đơn vị: ${user?.unit_name?.trim() || 'Đơn vị của tôi'}`,
            description: 'Tài liệu và chỉ số của đơn vị trực thuộc',
            to: ROUTE_PATHS.MY_UNIT,
            visible: hasUnit,
            isActive: (p) => p.startsWith(ROUTE_PATHS.MY_UNIT),
          },
          {
            key: 'portal-desk',
            label: 'Đăng tải và tiếp nhận',
            description: 'Số hóa, biên mục và đăng văn bản mới',
            to: ROUTE_PATHS.DESK,
            visible: Boolean(canDesk),
            isActive: (p) => p.startsWith(ROUTE_PATHS.DESK),
          },
        ],
      },
      {
        key: 'lectures',
        label: 'Bài giảng số',
        icon: MonitorPlay,
        to: ROUTE_PATHS.LECTURES,
        visible: canLectures,
        children: isGuest
          ? undefined
          : [
              {
                key: 'lectures-list',
                label: 'Danh sách bài giảng',
                description: 'Tra cứu bài đã xuất bản và mở ca giảng',
                to: ROUTE_PATHS.LECTURES,
                visible: canLectures,
                isActive: (p) => p === ROUTE_PATHS.LECTURES,
              },
              {
                key: 'lectures-compose',
                label: 'Soạn và duyệt bài giảng',
                description: 'Soạn mới, gửi duyệt, phê duyệt, thùng rác',
                to: ROUTE_PATHS.LECTURES_COMPOSE,
                visible: canCompose,
                isActive: (p) => p.startsWith(ROUTE_PATHS.LECTURES_COMPOSE),
              },
              {
                key: 'lectures-history',
                label: 'Lịch sử giảng dạy',
                description: 'Các ca đã giảng và thời lượng',
                to: ROUTE_PATHS.LECTURES_HISTORY,
                visible: canLectures && !isGuest,
                isActive: (p) => p.startsWith(ROUTE_PATHS.LECTURES_HISTORY),
              },
            ],
      },
      {
        key: 'classrooms',
        label: 'Giám sát',
        icon: Gauge,
        to: ROUTE_PATHS.CLASSROOMS,
        visible: canMonitor,
      },
      {
        key: 'library',
        label: 'Thư viện số',
        icon: Library,
        to: ROUTE_PATHS.LIBRARY,
        visible: true,
      },
      {
        key: 'admin',
        label: 'Quản trị',
        icon: Shield,
        to: ROUTE_PATHS.ADMIN,
        visible: canAccessAdmin,
      },
    ];
  }, [user, hasPermission, hasAnyPermission, canAccessAdmin]);

  const visibleItems = items.filter((i) => i.visible);

  // ── Mở / đóng menu ──
  const clearCloseTimer = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setOpenKey(null);
  }, []);
  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpenKey(null), HOVER_CLOSE_DELAY);
  };
  const openMenu = (key: MainNavKey) => {
    clearCloseTimer();
    const btn = buttonRefs.current[key];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const panelWidth = Math.min(320, window.innerWidth - 16);
      const targetLeft = rect.left + rect.width / 2 - panelWidth / 2;
      setPos({
        left: Math.max(8, Math.min(targetLeft, window.innerWidth - panelWidth - 8)),
        top: rect.bottom + 2,
      });
    }
    setOpenKey(key);
  };

  // Đóng khi đổi trang, bấm ra ngoài, cuộn, đổi cỡ cửa sổ, nhấn Esc
  useEffect(() => { closeMenu(); }, [path, search, closeMenu]);
  useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const btn = buttonRefs.current[openKey];
      if (panelRef.current?.contains(target) || btn?.contains(target)) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        buttonRefs.current[openKey]?.focus();
        closeMenu();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [openKey, closeMenu]);
  useEffect(() => () => clearCloseTimer(), []);

  // Bàn phím: ArrowDown từ nút mở menu và đưa focus vào mục đầu
  useEffect(() => {
    if (openKey && focusFirst.current) {
      focusFirst.current = false;
      panelRef.current?.querySelector<HTMLAnchorElement>('a[role="menuitem"]')?.focus();
    }
  }, [openKey]);

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = Array.from(panelRef.current?.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]') || []);
    if (links.length === 0) return;
    e.preventDefault();
    const idx = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = e.key === 'ArrowDown' ? (idx + 1) % links.length : (idx - 1 + links.length) % links.length;
    links[next].focus();
  };

  const openItem = openKey ? visibleItems.find((i) => i.key === openKey) : undefined;
  const openChildren = openItem?.children?.filter((c) => c.visible) || [];

  return (
    <>
      <nav
        aria-label="Điều hướng hệ thống"
        className="sticky top-[calc(3.75rem+env(safe-area-inset-top,0px))] sm:top-[calc(4rem+env(safe-area-inset-top,0px))] z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs select-none transition-colors duration-200"
      >
        <div className="max-w-[1780px] mx-auto px-2 sm:px-4 lg:px-6 flex items-stretch justify-start sm:justify-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            const kids = item.children?.filter((c) => c.visible) || [];
            const cls = `${itemBase} ${isActive ? itemActive : itemIdle}`;

            // Chỉ có 0-1 tác vụ → liên kết thẳng, không cần xổ xuống
            if (kids.length <= 1) {
              return (
                <Link
                  key={item.key}
                  id={`tour-nav-${item.key}`}
                  to={kids[0]?.to || item.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={cls}
                  onClick={closeMenu}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-emerald-700 dark:text-amber-400'
                        : 'text-slate-500 group-hover:text-emerald-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            }

            const isOpen = openKey === item.key;
            return (
              <button
                key={item.key}
                id={`tour-nav-${item.key}`}
                type="button"
                ref={(el) => { buttonRefs.current[item.key] = el; }}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-current={isActive ? 'page' : undefined}
                className={cls}
                onClick={() => (isOpen ? closeMenu() : openMenu(item.key))}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') openMenu(item.key); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') scheduleClose(); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusFirst.current = true;
                    openMenu(item.key);
                  }
                }}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? 'text-emerald-700 dark:text-amber-400'
                      : 'text-slate-500 group-hover:text-emerald-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                  }`}
                />
                <span>{item.label}</span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  } ${
                    isActive
                      ? 'text-emerald-700 dark:text-amber-400'
                      : 'text-slate-400 group-hover:text-emerald-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {openItem && openChildren.length > 0 && (
              <motion.div
                key={openItem.key}
                ref={panelRef}
                role="menu"
                aria-label={openItem.label}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                style={{ left: pos.left, top: pos.top }}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') clearCloseTimer(); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') scheduleClose(); }}
                onKeyDown={onPanelKeyDown}
                className="fixed z-[60] w-[min(20rem,calc(100vw-1rem))] rounded-xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl"
              >
                {openChildren.map((child) => {
                  const active = child.isActive(path, search);
                  return (
                    <Link
                      key={child.key}
                      to={child.to}
                      role="menuitem"
                      aria-current={active ? 'page' : undefined}
                      onClick={closeMenu}
                      className={`block px-4 py-3 min-h-[44px] border-b border-slate-100 dark:border-slate-800/80 last:border-b-0 border-l-[3px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-amber-400 ${
                        active
                          ? 'bg-emerald-50/90 dark:bg-slate-800/90 text-[#166534] dark:text-amber-300 border-l-emerald-600 dark:border-l-amber-400 font-medium'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-l-transparent'
                      }`}
                    >
                      <span className="block text-[15px] font-semibold leading-tight">{child.label}</span>
                      {child.description && (
                        <span className="block mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-snug">
                          {child.description}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};

export default MainNavBar;
