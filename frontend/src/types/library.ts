export interface LibraryItem {
  file_id: string;
  document_code?: string | null;
  title: string;
  summary?: string | null;
  author?: string | null;
  category_id: string;
  category_name: string;
  publisher?: string | null;
  publish_year?: number | null;
  issuing_unit_id?: string | null;
  unit_name?: string | null;
  original_name?: string;
  file_size?: number | string;
  /** null: chưa đếm; 0: không đếm được */
  page_count?: number | null;
  /** Đổi mỗi khi đổi ảnh bìa; null = chưa có bìa */
  cover_version?: string | null;
  /** true: bìa do người đăng chọn, thay tệp PDF không làm đổi bìa */
  cover_custom?: boolean;
  uploaded_by?: string | null;
  uploaded_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
  // Chỉ có ở thùng rác
  deleted_at?: string | null;
  deleted_reason?: string | null;
  deleted_by_name?: string | null;
}

export interface LibraryCategory {
  category_id: string;
  name: string;
  description?: string | null;
  sort_order: number;
  active: boolean;
  item_count: number;
}

export interface LibraryFilterParams {
  q?: string;
  category?: string;
  unit?: string;
  include_children?: 1;
  year?: number;
  page?: number;
  page_size?: number;
}

export interface LibraryListResponse {
  total: number;
  page: number;
  page_size: number;
  items: LibraryItem[];
}

export interface LibraryStats {
  total: number;
  total_bytes: number;
  new_30_days: number;
  standardized: number;
  latest_at?: string | null;
  by_category: { category_id: string; name: string; count: number }[];
  by_unit: { unit_id: string | null; count: number }[];
  by_year: { year: number | null; count: number }[];
  /** null với Đại biểu hoặc khi chưa có bảng lưu tiến độ */
  my_reading: { reading: number; completed: number } | null;
}

export interface LibraryReadingProgress {
  last_page: number;
  max_page: number;
  total_pages: number;
  completed: boolean;
  last_read_at: string;
}

export type LibraryReadingItem = LibraryItem & LibraryReadingProgress;

export interface LibrarySaveResponse {
  success?: boolean;
  file_id?: string;
  pending_approval?: boolean;
  proposal_id?: string;
  message?: string;
  /** 'APPROVAL_REQUIRED' khi quyền đang bị khóa bảo vệ */
  code?: string;
  request_id?: string;
}
