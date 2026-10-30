import React, { ReactNode, useState, useEffect } from 'react';
import { Drawer } from 'antd';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useDeviceMode } from '../../contexts/DeviceModeContext';

export interface LayoutProps {
  children: ReactNode;
  activeNav?: 'desk' | 'portal' | 'admin' | 'myunit' | 'login' | 'lectures' | 'materials' | 'library' | 'data';
  showSidebar?: boolean;
  activeSidebarItem?: string;
  onSidebarSelect?: (id: string) => void;
  title?: string;
  subtitle?: string;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeNav,
  showSidebar = false,
  activeSidebarItem,
  onSidebarSelect,
  title,
  subtitle,
}) => {
  const { deviceMode, orientation, screenWidth } = useDeviceMode();

  // Drawer cho iPad xoay dọc hoặc màn hình di động/tablet nhỏ
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Trạng thái thu gọn Mini Icon Rail khi ở iPad xoay ngang
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return deviceMode === 'ipad' && orientation === 'landscape';
  });

  // Tự động đồng bộ trạng thái thu gọn khi đổi thiết bị / xoay màn hình
  useEffect(() => {
    if (deviceMode === 'ipad' && orientation === 'landscape') {
      setSidebarCollapsed(true);
    } else if (deviceMode === 'pc') {
      setSidebarCollapsed(false);
    }
  }, [deviceMode, orientation]);

  const isIPadLandscape = deviceMode === 'ipad' && orientation === 'landscape';
  const isIPadPortrait = deviceMode === 'ipad' && orientation === 'portrait';
  const isPortraitMode = isIPadPortrait || (deviceMode === 'pc' && screenWidth < 1024);

  const sidebarWidthClass = isIPadLandscape
    ? (sidebarCollapsed ? 'w-[68px]' : 'w-[190px]')
    : (sidebarCollapsed ? 'w-[76px]' : 'w-[260px]');

  const handleSidebarSelect = (id: string) => {
    if (onSidebarSelect) onSidebarSelect(id);
    setDrawerOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090e17] text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-amber-500 selection:text-slate-900 transition-colors duration-200">
      <Header
        activeNav={activeNav}
        title={title}
        subtitle={subtitle}
        onToggleMobileMenu={showSidebar ? () => setDrawerOpen(true) : undefined}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* 1 & 2: Fixed Desktop Sidebar hoặc iPad Landscape Dock Sidebar */}
        {showSidebar && !isPortraitMode && (
          <aside
            className={`flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md overflow-x-hidden transition-all duration-300 ${sidebarWidthClass}`}
          >
            <Sidebar
              activeTab={activeSidebarItem}
              onTabChange={handleSidebarSelect}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </aside>
        )}

        {/* 3: Drawer trượt mượt mà khi ở iPad Portrait hoặc màn hình < 1024px */}
        {showSidebar && isPortraitMode && (
          <Drawer
            placement="left"
            width={270}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            styles={{ body: { padding: 0 } }}
            className="qk7-sidebar-drawer"
          >
            <Sidebar
              activeTab={activeSidebarItem}
              onTabChange={handleSidebarSelect}
              onClose={() => setDrawerOpen(false)}
              collapsed={false}
            />
          </Drawer>
        )}

        {/* Main Content Area — Chiếm 100% không gian còn lại, không tràn khung hình */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 bg-slate-50/70 dark:bg-[#090e17]/70 p-3 sm:p-5 lg:p-6 xl:p-8">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
