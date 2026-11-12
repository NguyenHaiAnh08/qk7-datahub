import React from 'react';
import { X, BookOpen, User, Building2, Shield } from 'lucide-react';
import { Lecture } from '../../types/lecture';

interface Props {
  open: boolean;
  lecture: Lecture | null;
  onClose: () => void;
}


export const LectureDetailModal: React.FC<Props> = ({ open, lecture, onClose }) => {
  if (!open || !lecture) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Chi tiết bài giảng</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{lecture.title}</h2>
            <p className="font-mono text-cyan-600 dark:text-cyan-400">{lecture.lecture_code}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs text-slate-500 block mb-0.5">Môn học</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-400" />{lecture.subject_name}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-0.5">Khoa/Bộ môn</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />{lecture.faculty_name}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-0.5">Người soạn</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" />{lecture.author_name}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-0.5">Cấp bảo mật</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />Cấp {lecture.security_level_id}
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-500 block mb-1">Loại nội dung</span>
            <span className="px-2 py-1 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 rounded-md font-semibold text-xs border border-cyan-200 dark:border-cyan-800">
              {lecture.content_type}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};