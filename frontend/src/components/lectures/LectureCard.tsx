import React, { useState } from 'react';
import { Lecture } from '../../types/lecture';
import { lectureService } from '../../services/lectureService';
import { toast } from '../common/Toast';
import { Play, CheckCircle, XCircle, FileText, Lock, Clock, HelpCircle } from 'lucide-react';

interface Props {
  lecture: Lecture;
  onRefresh: () => void;
  onStartSession: () => void;
}

export const LectureCard: React.FC<Props> = ({ lecture, onRefresh, onStartSession }) => {
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await lectureService.approveLecture(lecture.lecture_id);
      toast.success('Đã duyệt bài giảng!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const handleReject = async () => {
    const reason = prompt('Nhập lý do từ chối:');
    if (!reason) return;
    setLoading(true);
    try {
      await lectureService.rejectLecture(lecture.lecture_id, reason);
      toast.success('Đã từ chối bài giảng!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const renderStatus = () => {
    switch (lecture.status) {
      case 'PUBLISHED': return <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Đã xuất bản</span>;
      case 'PENDING_FACULTY': return <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">Chờ Khoa duyệt</span>;
      case 'PENDING_TRAINING': return <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">Chờ Trường duyệt</span>;
      case 'REJECTED': return <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded">Bị từ chối</span>;
      default: return <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">Bản nháp</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col hover:border-cyan-500 transition-colors">
      <div className="p-4 flex-1">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-mono font-bold bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded border border-cyan-200">
            {lecture.lecture_code}
          </span>
          {renderStatus()}
        </div>
        
        <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 mb-2" title={lecture.title}>
          {lecture.title}
        </h3>
        
        <div className="text-xs text-slate-500 space-y-1 mb-4">
          <p>Môn: {lecture.subject_name}</p>
          <p>Khoa: {lecture.faculty_name}</p>
          <p>Giảng viên: {lecture.author_rank} {lecture.author_name}</p>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 flex justify-between items-center border-t border-slate-200 dark:border-slate-800">
        <div className="flex gap-2 text-slate-500">
          <span title={`Mức bảo mật ${lecture.security_level_id}`}><Lock className="w-4 h-4" /></span>
          <span title={`${lecture.quiz_count || 0} câu hỏi Quiz`} className="flex items-center gap-1 text-xs">
            <HelpCircle className="w-4 h-4" /> {lecture.quiz_count || 0}
          </span>
        </div>
        
        <div className="flex gap-2">
          {lecture.status === 'PENDING_FACULTY' || lecture.status === 'PENDING_TRAINING' ? (
            <>
              <button onClick={handleReject} disabled={loading} className="p-1.5 bg-rose-100 text-rose-600 rounded hover:bg-rose-200"><XCircle className="w-4 h-4" /></button>
              <button onClick={handleApprove} disabled={loading} className="p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"><CheckCircle className="w-4 h-4" /></button>
            </>
          ) : lecture.status === 'PUBLISHED' ? (
            <button onClick={onStartSession} className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-cyan-500 shadow-sm">
              <Play className="w-3 h-3 fill-current" /> Mở ca dạy
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};