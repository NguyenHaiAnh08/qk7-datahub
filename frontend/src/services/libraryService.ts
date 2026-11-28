import { http } from './http';
import type { ParseDocumentResult } from './documentService';
import type {
  LibraryCategory,
  LibraryFilterParams,
  LibraryItem,
  LibraryListResponse,
  LibraryReadingItem,
  LibraryReadingProgress,
  LibrarySaveResponse,
  LibraryStats,
} from '../types/library';

const BASE = '/api/library';
const itemUrl = (fileId: string) => `${BASE}/${encodeURIComponent(fileId)}`;
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Chuỗi xác nhận dọn thùng rác, khớp backend/src/library-routes.js */
const EMPTY_TRASH_CONFIRM = 'DON-SACH-THUNG-RAC';

export const libraryService = {
  coverUrl: (fileId: string, version?: string | null) =>
    (version ? `${itemUrl(fileId)}/cover?v=${encodeURIComponent(version)}` : null),

  proposalCoverUrl: (proposalId: string, version?: string | null) =>
    (version ? `${BASE}/proposals/${encodeURIComponent(proposalId)}/cover?v=${encodeURIComponent(version)}` : null),

  list: (params: LibraryFilterParams = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') sp.append(key, String(value));
    });
    const qs = sp.toString();
    return http<LibraryListResponse>(`${BASE}${qs ? `?${qs}` : ''}`, { skipErrorNotification: true });
  },

  get: (fileId: string) => http<LibraryItem>(itemUrl(fileId)),

  create: (formData: FormData) =>
    http<LibrarySaveResponse>(BASE, { method: 'POST', body: formData, skipErrorNotification: true }),

  update: (fileId: string, formData: FormData) =>
    http<LibrarySaveResponse>(itemUrl(fileId), { method: 'PUT', body: formData, skipErrorNotification: true }),

  remove: (fileId: string, reason?: string) =>
    http<LibrarySaveResponse>(itemUrl(fileId), json('DELETE', { reason })),

  trash: () => http<{ total: number; items: LibraryItem[] }>(`${BASE}/trash`, { skipErrorNotification: true }),

  restore: (fileId: string) => http<LibrarySaveResponse>(`${itemUrl(fileId)}/restore`, { method: 'POST' }),

  purge: (fileId: string) =>
    http<LibrarySaveResponse>(`${itemUrl(fileId)}/purge`, json('DELETE', { confirm: fileId })),

  emptyTrash: () =>
    http<{ success?: boolean; purged?: number; code?: string }>(`${BASE}/trash`, json('DELETE', { confirm: EMPTY_TRASH_CONFIRM })),

  parse: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return http<ParseDocumentResult>(`${BASE}/parse`, { method: 'POST', body: formData, skipErrorNotification: true });
  },

  stats: () => http<LibraryStats>(`${BASE}/stats`, { skipErrorNotification: true }),

  readingList: () =>
    http<{ total: number; items: LibraryReadingItem[] }>(`${BASE}/reading`, { skipErrorNotification: true }),

  getReading: (fileId: string) =>
    http<{ progress: LibraryReadingProgress | null }>(`${itemUrl(fileId)}/reading`, { skipErrorNotification: true }),

  /** keepalive: yêu cầu vẫn được gửi đi khi người dùng đóng tab */
  saveReading: (fileId: string, data: { page: number; total_pages: number; completed: boolean }, keepalive = false) =>
    http<{ success: boolean }>(`${itemUrl(fileId)}/reading`, { ...json('PUT', data), keepalive, skipErrorNotification: true }),

  removeReading: (fileId: string) =>
    http<{ success: boolean }>(`${itemUrl(fileId)}/reading`, { method: 'DELETE', skipErrorNotification: true }),

  categories: () =>
    http<{ total: number; items: LibraryCategory[] }>(`${BASE}/categories`, { skipErrorNotification: true }),

  createCategory: (data: Partial<LibraryCategory>) =>
    http<{ success?: boolean; code?: string }>(`${BASE}/categories`, { ...json('POST', data), skipErrorNotification: true }),

  updateCategory: (id: string, data: Partial<LibraryCategory>) =>
    http<{ success?: boolean; code?: string }>(`${BASE}/categories/${encodeURIComponent(id)}`, { ...json('PUT', data), skipErrorNotification: true }),

  deleteCategory: (id: string) =>
    http<{ success?: boolean; code?: string }>(`${BASE}/categories/${encodeURIComponent(id)}`, { method: 'DELETE', skipErrorNotification: true }),
};

export default libraryService;
