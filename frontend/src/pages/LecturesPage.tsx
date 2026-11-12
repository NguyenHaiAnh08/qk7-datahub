import React, { useState, useEffect } from 'react';
import { Layout } from '../components/common/Layout';
import { LectureCard } from '../components/lectures/LectureCard';
import { CreateLectureModal } from '../components/lectures/CreateLectureModal';
import { StartSessionModal } from '../components/lectures/StartSessionModal';
import { LiveMonitorPanel } from '../components/lectures/LiveMonitorPanel';
import { TeachingHistoryPanel } from '../components/lectures/TeachingHistoryPanel';
import { lectureService } from '../services/lectureService';
import { Lecture, TeachingSession } from '../types/lecture';
import { toast } from '../components/common/Toast';
import { Plus, MonitorPlay, BookOpen, Clock } from 'lucide-react';

export const LecturesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'library' | 'live' | 'history'>('library');
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);

  const loadLectures = async () => {
    try {
      setLoading(true);
      const res = await lectureService.getLectures();
      setLectures(res.items);
    } catch (err: any) {
      toast.error('Lỗi tải danh sách bài giảng: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLectures();
  }, []);

  return (
    <Layout activeNav="lectures" title="Quân Khu 7" subtitle="Phân hệ Bài giảng số">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MonitorPlay className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            Bài Giảng Số
          </h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý, giảng dạy và giám sát học liệu số</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" /> Soạn bài giảng mới
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-fit mb-6">
        <button
          onClick={() => setActiveTab('library')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${activeTab === 'library' ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-700 dark:text-cyan-400' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <BookOpen className="w-4 h-4" /> Thư viện bài giảng
        </button>
        <button
          onClick={() => setActiveTab('live')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${activeTab === 'live' ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-700 dark:text-cyan-400' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <MonitorPlay className="w-4 h-4" /> Giám sát trực tuyến
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-700 dark:text-cyan-400' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Clock className="w-4 h-4" /> Lịch sử ca dạy
        </button>
      </div>

      {/* Content */}
      {activeTab === 'library' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-500">Đang tải dữ liệu...</div>
          ) : lectures.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500">Chưa có bài giảng nào.</div>
          ) : (
            lectures.map(lec => (
              <LectureCard 
                key={lec.lecture_id} 
                lecture={lec} 
                onRefresh={loadLectures}
                onStartSession={() => setSelectedLecture(lec)}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'live' && <LiveMonitorPanel />}
      {activeTab === 'history' && <TeachingHistoryPanel />}

      {/* Modals */}
      <CreateLectureModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadLectures}
      />
      
      {selectedLecture && (
        <StartSessionModal
          open={!!selectedLecture}
          lecture={selectedLecture}
          onClose={() => setSelectedLecture(null)}
          onSuccess={() => {
            setSelectedLecture(null);
            setActiveTab('live');
          }}
        />
      )}
    </Layout>
  );
};

export default LecturesPage;