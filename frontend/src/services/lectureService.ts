import { http } from './http';
import {
  Lecture,
  LectureListFilters,
  CreateLecturePayload,
  Subject,
  TrainingClass,
  TeachingSchedule,
  StartSchedulePayload,
  HistoryKpi,
  LectureQuizQuestion,
  CreateQuizPayload,
  ScormTrackingData,
  ScormCommitPayload,
} from '../types/lecture';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const lectureService = {
  // ── Catalogs ──
  async getSubjects(): Promise<Subject[]> {
    const res: any = await http('/api/lectures/catalogs/subjects');
    return res?.items || [];
  },

  async getClasses(): Promise<TrainingClass[]> {
    const res: any = await http('/api/lectures/catalogs/classes');
    return res?.items || [];
  },

  async getVenues(): Promise<{ venue_name: string; usage_count: number }[]> {
    const res: any = await http('/api/lectures/catalogs/venues');
    return res?.items || [];
  },

  // ── Lecture CRUD ──
  async list(filters: LectureListFilters = {}): Promise<{ items: Lecture[]; total: number }> {
    const p = new URLSearchParams();
    if (filters.status) p.set('status', filters.status);
    if (filters.subject_id) p.set('subject_id', filters.subject_id);
    if (filters.faculty_unit_id) p.set('faculty_unit_id', filters.faculty_unit_id);
    if (filters.q) p.set('q', filters.q);
    const qs = p.toString();
    return http(`/api/lectures${qs ? `?${qs}` : ''}`);
  },

  async getById(id: string): Promise<Lecture> {
    return http(`/api/lectures/${encodeURIComponent(id)}`);
  },

  async create(payload: CreateLecturePayload): Promise<{ lecture_id: string }> {
    return http('/api/lectures', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  },

  async update(id: string, payload: Partial<CreateLecturePayload>): Promise<void> {
    return http(`/api/lectures/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  },

  async archive(id: string): Promise<void> {
    return http(`/api/lectures/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async restore(id: string): Promise<void> {
    return http(`/api/lectures/${encodeURIComponent(id)}/restore`, { method: 'POST' });
  },

  // ── Duyệt 2 tầng ──
  async submit(id: string): Promise<void> {
    return http(`/api/lectures/${encodeURIComponent(id)}/submit`, { method: 'POST' });
  },

  async approve(id: string): Promise<{ new_status: string }> {
    return http(`/api/lectures/${encodeURIComponent(id)}/approve`, { method: 'POST' });
  },

  async reject(id: string, reason: string): Promise<void> {
    return http(`/api/lectures/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ reason }),
    });
  },

  // ── Upload gói SCORM/HTML5 hoặc tệp giáo án PDF ──
  async uploadPackage(
    lectureId: string,
    file: File,
    type: 'HTML5' | 'SCORM' | 'PDF'
  ): Promise<{ success: boolean; status: string; pending_scorm_path?: string; file_id?: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const endpoint = type === 'SCORM'
      ? `/api/lectures/${encodeURIComponent(lectureId)}/scorm/upload`
      : type === 'HTML5'
      ? `/api/lectures/${encodeURIComponent(lectureId)}/html5/upload`
      : `/api/lectures/${encodeURIComponent(lectureId)}/pdf/upload`;

    // Không set Content-Type — browser sẽ tự thêm multipart boundary
    return http(endpoint, {
      method: 'POST',
      body: formData,
    });
  },

  getScormLaunchUrl(lectureId: string): string {
    return `/api/lectures/${encodeURIComponent(lectureId)}/scorm/launch`;
  },

  getHtml5LaunchUrl(lectureId: string): string {
    return `/api/lectures/${encodeURIComponent(lectureId)}/html5/launch`;
  },

  // ── Ca giảng dạy ──
  async startSchedule(payload: StartSchedulePayload): Promise<{ schedule_id: string }> {
    return http('/api/lectures/schedules/start', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  },

  async endSchedule(id: string): Promise<void> {
    return http(`/api/lectures/schedules/${encodeURIComponent(id)}/end`, { method: 'POST' });
  },

  async getLiveSchedules(): Promise<{ items: TeachingSchedule[]; total: number }> {
    return http('/api/lectures/schedules/live');
  },

  async forceEndSchedule(id: string): Promise<void> {
    return http(`/api/lectures/schedules/${encodeURIComponent(id)}/force-end`, { method: 'POST' });
  },

  async updateSlide(scheduleId: string, slideIndex: number, slideTotal?: number): Promise<void> {
    return http(`/api/lectures/schedules/${encodeURIComponent(scheduleId)}/slide`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ slide_index: slideIndex, slide_total: slideTotal }),
    });
  },

  async updateProgress(scheduleId: string, currentPage: number): Promise<void> {
    return http(`/api/lectures/schedules/${encodeURIComponent(scheduleId)}/progress`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ current_page: currentPage }),
    });
  },

  async getHistory(filters: { from?: string; to?: string } = {}): Promise<{
    items: TeachingSchedule[];
    total: number;
    kpi: HistoryKpi;
  }> {
    const p = new URLSearchParams();
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
    const qs = p.toString();
    return http(`/api/lectures/schedules/history${qs ? `?${qs}` : ''}`);
  },

  async getAdvancedMonitor(): Promise<{
    ongoing_count: number;
    hanging_count: number;
    items: TeachingSchedule[];
  }> {
    return http('/api/lectures/schedules/monitor');
  },

  // ── Quiz tương tác ──
  async getQuizzes(lectureId: string): Promise<{ total: number; items: LectureQuizQuestion[] }> {
    return http(`/api/lectures/${encodeURIComponent(lectureId)}/quiz`);
  },

  async createQuiz(lectureId: string, payload: CreateQuizPayload): Promise<{ success: boolean; question_id: string }> {
    return http(`/api/lectures/${encodeURIComponent(lectureId)}/quiz`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  },

  async updateQuiz(lectureId: string, questionId: string, payload: Partial<CreateQuizPayload>): Promise<void> {
    return http(`/api/lectures/${encodeURIComponent(lectureId)}/quiz/${encodeURIComponent(questionId)}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  },

  async deleteQuiz(lectureId: string, questionId: string): Promise<void> {
    return http(`/api/lectures/${encodeURIComponent(lectureId)}/quiz/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    });
  },

  async activateQuiz(scheduleId: string, questionId: string): Promise<{ success: boolean; activated: boolean }> {
    return http(`/api/lectures/schedules/${encodeURIComponent(scheduleId)}/quiz/${encodeURIComponent(questionId)}/activate`, {
      method: 'POST',
    });
  },

  // ── SCORM RTE Tracking ──
  async commitScorm(scheduleId: string, payload: ScormCommitPayload): Promise<void> {
    return http(`/api/lectures/schedules/${encodeURIComponent(scheduleId)}/scorm/commit`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  },

  async getScormTracking(scheduleId: string): Promise<ScormTrackingData | null> {
    return http(`/api/lectures/schedules/${encodeURIComponent(scheduleId)}/scorm/tracking`);
  },

  // ── Phân khoa ──
  async getFacultyLectures(facultyUnitId: string): Promise<{ total: number; items: Lecture[] }> {
    return http(`/api/lectures/faculty/${encodeURIComponent(facultyUnitId)}`);
  },
};

export default lectureService;
