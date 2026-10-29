import React from 'react';
import { Header } from '../components/common/Header';
import { ModuleUnderDevelopment } from '../components/common/ModuleUnderDevelopment';

export const LecturesPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white transition-colors duration-200">
      <Header
        activeNav="lectures"
        title="Trường Quân Sự Quân Khu 7"
        subtitle="Hệ sinh thái số"
      />
      <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-6 xl:p-8 max-w-7xl w-full mx-auto flex items-center justify-center">
        <ModuleUnderDevelopment module="lectures" />
      </main>
    </div>
  );
};

export default LecturesPage;

