import React, { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export interface LayoutProps {
  children: ReactNode;
  activeNav?: 'desk' | 'portal' | 'admin' | 'login';
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
  subtitle
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      <Header activeNav={activeNav} title={title} subtitle={subtitle} />

      <div className="flex-1 flex overflow-hidden">
        {showSidebar && (
          <aside className="w-64 flex-shrink-0 hidden md:block border-r border-slate-800 bg-slate-950/40">
            <Sidebar
              activeTab={activeSidebarItem}
              onTabChange={onSidebarSelect || (() => {})}
            />
          </aside>
        )}

        <main className="flex-1 overflow-y-auto min-w-0 bg-slate-900/60 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
