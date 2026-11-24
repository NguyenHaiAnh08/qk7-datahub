export type LectureStatus =
  | 'DRAFT'
  | 'PENDING_FACULTY'
  | 'PENDING_TRAINING'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED'   // legacy
  | 'DELETED';   // 🆕

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
  /** Bài của đơn vị ngang cấp (cùng đơn vị cha) — được xem và mở ca */
  peer_unit?: boolean;
  /** Được mở ca dạy: bài đã xuất bản (mọi khoa) hoặc bài thuộc đơn vị của mình */
  can_teach?: boolean;
  /** Bài thuộc khoa/phòng của người dùng (hoặc do chính họ đăng) — xếp lên đầu, được CRUD ở trang Soạn */
  in_my_faculty?: boolean;
  /** Người được cấp quyền duyệt đã thẩm định — bài vẫn chờ Chỉ huy cấp trên xác nhận */
  validated_by?: string;
  validated_by_name?: string;
  validate_decision?: 'APPROVE' | 'REJECT';
  validate_note?: string;
  security_level_id: number;
  security_name?: string;
  content_type: ContentType;
  scorm_entry_point?: string;
  /** @deprecated PDF bài giảng không còn nằm trong bảng DOCUMENT — dùng has_pdf */
  document_id?: string;
  /** Bài giảng đã có tệp PDF giáo án (xem qua GET /api/lectures/:id/pdf) */
  has_pdf?: boolean;
  pdf_name?: string;
  pdf_size?: number;
  quiz_count?: number;
  status: LectureStatus;
  reject_reason?: string;
  class_name?: string;
  venue_name?: string;
  created_at: string;
  updated_at: string;
}

/** Khu giảng đường (bảng CLASSROOM_BUILDING) — quản lý trong Quản trị */
export interface ClassroomBuilding {
  building_code: string;
  building_name: string;
  display_order: number;
  active: boolean;
  room_count: number;
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
  course_year?: number | string;
  student_total?: number;
  description?: string;
  active: boolean;
}

export interface TeachingSchedule {
  schedule_id: string;
  lecture_id: string;
  room_id?: string;
  is_restricted?: boolean;
  lecture_title?: string;
  subject_name?: string;
  presenter_id: string;
  presenter_name?: string;
  presenter_rank?: string;
  presenter_position?: string;
  class_id: string;
  class_name?: string;
  class_student_total?: number;
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
  content_type?: string;
}

export interface LectureListFilters {
  status?: LectureStatus;
  subject_id?: string;
  faculty_unit_id?: string;
  q?: string;
  /** 'compose' = trang Soạn & duyệt: chỉ bài của khoa/phòng mình (khoa nào khoa đấy lo) */
  scope?: 'compose';
}

export interface CreateLecturePayload {
  title: string;
  subject_id: string;
  lecture_code?: string;
  security_level_id?: number;
  content_type?: ContentType;
  scorm_entry_point?: string;
}

export interface StartSchedulePayload {
  lecture_id: string;
  class_id: string;
  /** Mã giảng đường, chọn từ danh sách (không nhập tay) */
  room_id: string;
  student_count: number;
  session_type?: SessionType;
  note?: string;
}

/** Giảng đường chọn được khi mở ca (GET /api/lectures/catalogs/rooms) */
export interface LectureRoomOption {
  room_id: string;
  room_name: string;
  room_type?: string;
  capacity?: number | null;
  building_code: string;
  building_name: string;
  is_maintenance: boolean;
  maintenance_reason?: string | null;
  /** Đang có ca giảng dạy diễn ra trong phòng */
  is_busy: boolean;
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

// ─── QK7 LECTURE HALL RADAR ───
export type RadarRoomStatus =
  | 'AVAILABLE'    // Trống / Sẵn sàng
  | 'IN_SESSION'   // Đang giảng dạy
  | 'UPCOMING'     // Sắp có ca
  | 'MAINTENANCE'  // Bảo trì / Tạm khóa
  | 'ALERT'        // Cảnh báo / Quá giờ
  | 'UNKNOWN';     // Không xác định

export interface RadarKpis {
  total_rooms: number;
  in_session: number;
  available: number;
  upcoming: number;
  maintenance: number;
  alert: number;
}

export interface RadarBuilding {
  building_code: string;
  building_name: string;
  total_rooms: number;
  in_session_count: number;
  maintenance_count: number;
  floors: number[];
}

export interface RadarOverviewResponse {
  kpis: RadarKpis;
  buildings: RadarBuilding[];
  server_time: string;
}

export interface RadarSessionSummary {
  schedule_id: string;
  lecture_id: string;
  lecture_title: string;
  security_level_id?: number;
  is_restricted?: boolean;
  presenter_id: string;
  presenter_name: string;
  presenter_rank?: string;
  presenter_position?: string;
  class_id?: string;
  class_name: string;
  student_count?: number;
  duration_minutes?: number;
  start_time: string;
  end_time?: string;
  status?: ScheduleStatus;
  slide_index?: number;
  slide_total?: number;
  scorm_progress?: number;
  current_page?: number;
  is_hanging?: boolean;
  content_type?: ContentType;
  subject_name?: string;
  unit_name?: string;
  note?: string;
}

export interface RadarClassroom {
  room_id: string;
  room_name: string;
  room_type: string;
  capacity: number;
  building_name?: string;
  building_code: string;
  floor_number: number;
  grid_col: number;
  grid_row: number;
  is_maintenance: boolean;
  maintenance_reason?: string | null;
  display_order: number;
  computed_status: RadarRoomStatus;
  current_session?: RadarSessionSummary | null;
  upcoming_session?: RadarSessionSummary | null;
}

export interface RadarFloorPlanResponse {
  building_code: string;
  building_name: string;
  floor_number: number;
  time_shift: 'live' | 'morning' | 'afternoon' | 'evening';
  rooms: RadarClassroom[];
  server_time: string;
}

export interface RadarRoomDetailResponse {
  room: RadarClassroom;
  current_session: RadarSessionSummary | null;
  today_schedules: RadarSessionSummary[];
}


