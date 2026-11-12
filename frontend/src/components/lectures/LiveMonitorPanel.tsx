import React, { useState, useEffect } from 'react';
import { lectureService } from '../../services/lectureService';
import { TeachingSession } from '../../types/lecture';
import { Monitor, StopCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from '../common/Toast';

export const LiveMonitorPanel: React.FC = () => {
  const [sessions, setSessions] = useState<TeachingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    try {
      const res = await lectureService.getMonitorSessions();
      setSessions(res.items);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 15000); // Auto refresh 15s
    return () => clearInterval(interval);
  }, []);

  const handleForceEnd = async (id: string) => {
    if (!window.confirm('Buộc kết thúc ca giảng dạy này?')) return;
    try {
      await lectureService.forceEndSession(id);
      toast.success('Đã buộc kết thúc ca dạy');
      loadSessions();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
        <h2 className="font-bold flex items-center gap-2"><Monitor className="w-5 h-5 text-cyan-500" /> Giám sát giảng đường ({sessions.length})</h2>
        <button onClick={loadSessions} className="p-1.5 text-slate-500 hover:text-cyan-600 rounded"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {sessions.length === 0 && !loading ? (
        <div className="p-8 text-center text-slate-500">Hiện không có ca giảng dạy nào đang diễn ra.</div>
      ) : (
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Giảng viên</th>
              <th className="px-4 py-3">Bài giảng</th>
              <th className="px-4 py-3">Lớp / Giảng đường</th>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {sessions.map(s => (
              <tr key={s.schedule_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3">
                  <div className="font-semibold">{s.presenter_name}</div>
                  <div className="text-xs text-slate-500">{s.presenter_rank}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-cyan-700 dark:text-cyan-400">{s.lecture_title}</div>
                  <div className="text-xs text-slate-500">{s.subject_name}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{s.class_name}</div>
                  <div className="text-xs text-slate-500">{s.venue_name}</div>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  <div>Bắt đầu: {new Date(s.start_time).toLocaleTimeString('vi-VN')}</div>
                  <div className="text-xs">{s.duration_minutes} phút trước</div>
                </td>
                <td className="px-4 py-3">
                  {s.is_hanging ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded w-fit">
                      <AlertTriangle className="w-3 h-3" /> Treo (Quá 4h)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded w-fit">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleForceEnd(s.schedule_id)} className="px-3 py-1.5 bg-rose-100 text-rose-600 text-xs font-bold rounded hover:bg-rose-200 flex items-center gap-1 ml-auto">
                    <StopCircle className="w-3 h-3" /> Kết thúc
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};