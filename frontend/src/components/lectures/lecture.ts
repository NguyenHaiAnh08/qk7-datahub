export type LectureStatus = 'DRAFT' | 'PENDING_FACULTY' | 'PENDING_TRAINING' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
export type ContentType = 'PDF' | 'HTML5' | 'SCORM';
export type SessionType = 'TEACHER_LED' | 'SELF_STUDY';

export interface Subject {
  subject_id: string;
  subject_code?: string;
  name: string;
  faculty_unit_id: string;
  faculty_name?: string;
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
  status: LectureStatus;
  reject_reason?: string;
  quiz_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TeachingSession {
  schedule_id: string;
  lecture_id: string;
  lecture_title: string;
  subject_name: string;
  presenter_id: string;
  presenter_name: string;
  presenter_rank?: string;
  class_id: string;
  class_name: string;
  venue_name: string;
  student_count: number;
  session_type: SessionType;
  start_time: string;
  end_time?: string;
  status: 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  is_hanging?: boolean;
  duration_minutes?: number;
  slide_index?: number;
  slide_total?: number;
  scorm_progress?: number;
  quiz_activated_count?: number;
  quiz_total_count?: number;
}