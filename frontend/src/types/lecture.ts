export type LectureStatus =
  | 'DRAFT'
  | 'PENDING_FACULTY'
  | 'PENDING_TRAINING'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED';

export type ContentType = 'PDF' | 'HTML5' | 'SCORM';
export type SessionType = 'TEACHER_LED' | 'SELF_STUDY';
export type ScheduleStatus = 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export interface Lecture {
  lecture_id: string;
  lecture_code: string;
  title: string;
  subject_id: string;
  subject_name?: string;
  author_id: string;
  author_name?: string;
  author_rank?: string;
  faculty_unit_id: string;
  faculty_name?: string;
  security_level_id: number;
  security_name?: string;
  content_type: ContentType;
  scorm_entry_point?: string;
  document_id?: string;
  quiz_count?: number;
  status: LectureStatus;
  reject_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  subject_id: string;
  subject_code?: string;
  name: string;
  faculty_unit_id: string;
  faculty_name?: string;
  security_level_id?: number;
  active: boolean;
}

export interface TrainingClass {
  class_id: string;
  class_name: string;
  unit_id: string;
  unit_name?: string;
  course_year?: number;
  student_total?: number;
  active: boolean;
}

export interface TeachingSchedule {
  schedule_id: string;
  lecture_id: string;
  lecture_title?: string;
  subject_name?: string;
  presenter_id: string;
  presenter_name?: string;
  presenter_rank?: string;
  presenter_position?: string;
  class_id: string;
  class_name?: string;
  venue_name: string;
  student_count: number;
  session_type: SessionType;
  current_page?: number;
  slide_index?: number;
  slide_total?: number;
  scorm_progress?: number;
  note?: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  status: ScheduleStatus;
  is_hanging?: boolean;
  quiz_activated_count?: number;
  quiz_total_count?: number;
}

export interface LectureListFilters {
  status?: LectureStatus;
  subject_id?: string;
  faculty_unit_id?: string;
  q?: string;
}

export interface CreateLecturePayload {
  title: string;
  subject_id: string;
  lecture_code?: string;
  security_level_id?: number;
  content_type?: ContentType;
  scorm_entry_point?: string;
  document_id?: string;
}

export interface StartSchedulePayload {
  lecture_id: string;
  class_id: string;
  venue_name: string;
  student_count: number;
  session_type?: SessionType;
  note?: string;
}

export interface HistoryKpi {
  total_sessions: number;
  total_minutes: number;
  total_hours: number;
  total_students: number;
  self_study_sessions: number;
  teacher_led_sessions: number;
}

// ─── QUIZ TƯƠNG TÁC ───
export interface LectureQuizQuestion {
  question_id: string;
  lecture_id: string;
  question_order: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c?: string | null;
  option_d?: string | null;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation?: string | null;
  slide_index?: number | null;
  points?: number;
  active?: boolean;
}

export interface CreateQuizPayload {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c?: string;
  option_d?: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  slide_index?: number;
  points?: number;
  question_order?: number;
}

// ─── SCORM TRACKING & RTE ───
export interface ScormTrackingData {
  tracking_id?: string;
  session_id: string;
  lecture_id: string;
  lesson_status: 'not attempted' | 'passed' | 'completed' | 'failed' | 'incomplete';
  score_raw?: number | null;
  suspend_data?: string | null;
  last_accessed?: string;
}

export interface ScormCommitPayload {
  lesson_status?: string;
  score_raw?: number | null;
  suspend_data?: string | null;
}

