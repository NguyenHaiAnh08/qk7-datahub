import { http } from './http';
import { Lecture, Subject, TrainingClass, TeachingSession } from '../types/lecture';

// Hàm phụ trợ chuyển đổi object params thành chuỗi query string (?key=value)
const buildQueryString = (params?: Record<string, any>) => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      searchParams.append(key, String(params[key]));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
};

export const lectureService = {
  // ─── Lấy danh mục ───
  getSubjects: async () => http<{ items: Subject[] }>('/api/lectures/catalogs/subjects'),
  getClasses: async () => http<{ items: TrainingClass[] }>('/api/lectures/catalogs/classes'),
  getVenues: async () => http<{ items: { venue_name: string }[] }>('/api/lectures/catalogs/venues'),

  // ─── CRUD Bài giảng ───
  getLectures: async (params?: any) => {
    const query = buildQueryString(params);
    return http<{ items: Lecture[] }>(`/api/lectures${query}`);
  },
  getLectureById: async (id: string) => http<Lecture>(`/api/lectures/${id}`),
  
  createLecture: async (data: Partial<Lecture>) => 
    http<{ lecture_id: string }>('/api/lectures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
    
  updateLecture: async (id: string, data: Partial<Lecture>) => 
    http(`/api/lectures/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
  
  // ─── Upload gói học liệu ───
  uploadPackage: async (lectureId: string, file: File, type: 'HTML5' | 'SCORM') => {
    const formData = new FormData();
    formData.append('file', file);
    const endpoint = type === 'SCORM' 
      ? `/api/lectures/${lectureId}/scorm/upload` 
      : `/api/lectures/${lectureId}/html5/upload`;
      
    // Tuyệt đối không set Content-Type khi dùng FormData
    return http(endpoint, {
      method: 'POST',
      body: formData
    });
  },

  // ─── Luồng phê duyệt ───
  submitLecture: async (id: string) => 
    http(`/api/lectures/${id}/submit`, { method: 'POST' }),
    
  approveLecture: async (id: string) => 
    http(`/api/lectures/${id}/approve`, { method: 'POST' }),
    
  rejectLecture: async (id: string, reason: string) => 
    http(`/api/lectures/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    }),
    
  archiveLecture: async (id: string) => 
    http(`/api/lectures/${id}`, { method: 'DELETE' }),

  // ─── Ca giảng dạy ───
  startSession: async (data: any) => 
    http<{ schedule_id: string }>('/api/lectures/schedules/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
    
  endSession: async (id: string) => 
    http(`/api/lectures/schedules/${id}/end`, { method: 'POST' }),
    
  forceEndSession: async (id: string) => 
    http(`/api/lectures/schedules/${id}/force-end`, { method: 'POST' }),
    
  updateSlide: async (id: string, data: any) => 
    http(`/api/lectures/schedules/${id}/slide`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),

  // ─── Giám sát & Lịch sử ───
  getLiveSessions: async () => 
    http<{ items: TeachingSession[] }>('/api/lectures/schedules/live'),
  
  getSessionHistory: async (params?: any) => {
    const query = buildQueryString(params);
    return http<{ items: TeachingSession[], kpi: any }>(`/api/lectures/schedules/history${query}`);
  },
  
  getMonitorSessions: async () => 
    http<{ items: TeachingSession[] }>('/api/lectures/schedules/monitor'),
};