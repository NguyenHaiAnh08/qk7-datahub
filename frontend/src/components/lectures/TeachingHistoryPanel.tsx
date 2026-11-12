import React, { useState, useEffect } from 'react';
import { lectureService } from '../../services/lectureService';
import { TeachingSession } from '../../types/lecture';
import { toast } from '../common/Toast';

export const TeachingHistoryPanel: React.FC = () => {
  const [sessions, setSessions] = useState<TeachingSession[]>([]);
  const [kpi, setKpi] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    lectureService.getSessionHistory()
      .then(res => {
        setSessions(res.items);
        setKpi(res.kpi);
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8">Đang tải lịch sử...</div>;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500">Tổng số ca dạy</div>
            <div className="text-2xl font-bold text-cyan-600">{kpi.total_sessions}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500">Tổng thời gian</div>
            <div className="text-2xl font-bold text-cyan-600">{kpi.total_hours} giờ</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500">Học viên tham gia</div>
            <div className="text-2xl font-bold text-cyan-600">{kpi.total_students}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500">Tự học / GV dạy</div>
            <div className="text-2xl font-bold text-cyan-600">{kpi.self_study_sessions} / {kpi.teacher_led_sessions}</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Bài giảng</th>
              <th className="px-4 py-3">Giảng viên</th>
              <th className="px-4 py-3">Lớp</th>
              <th className="px-4 py-3">Thời lượng</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sessions.map(s => (
              <tr key={s.schedule_id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">
                  {new Date(s.start_time).toLocaleString('vi-VN')}
                </td>
                <td className="px-4 py-3 font-medium">{s.lecture_title}</td>
                <td className="px-4 py-3">{s.presenter_name}</td>
                <td className="px-4 py-3">{s.class_name}</td>
                <td className="px-4 py-3">{s.duration_minutes} phút</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                    {s.status === 'COMPLETED' ? 'Hoàn thành' : 'Đã hủy'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};