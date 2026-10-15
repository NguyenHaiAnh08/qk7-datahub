import { http, getAuthHeaders } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { DocumentItem, DocumentFilterParams } from '../types/document';

/**
 * Document Service — Quản lý tìm kiếm, tra cứu, tải lên và số hóa văn bản
 */
export const documentService = {
  getDocuments: async (
    params: DocumentFilterParams = {}
  ): Promise<{ total: number; items: DocumentItem[] }> => {
    const searchParams = new URLSearchParams();
    if (params.code) searchParams.append('code', params.code);
    if (params.title) searchParams.append('title', params.title);
    if (params.type) searchParams.append('type', params.type);
    if (params.unit) searchParams.append('unit', params.unit);
    if (params.from) searchParams.append('from', params.from);
    if (params.to) searchParams.append('to', params.to);
    if (params.lv) searchParams.append('lv', String(params.lv));

    const qs = searchParams.toString();
    return http<{ total: number; items: DocumentItem[] }>(
      `${API_ENDPOINTS.DOCUMENTS.LIST}${qs ? `?${qs}` : ''}`
    );
  },

  getDocumentById: async (fileId: string): Promise<DocumentItem> => {
    return http<DocumentItem>(API_ENDPOINTS.DOCUMENTS.DETAIL(fileId));
  },

  uploadDocument: async (
    formData: FormData
  ): Promise<{ success: boolean; file_id: string; stored_path: string; sha256: string }> => {
    return http(API_ENDPOINTS.DOCUMENTS.UPLOAD, {
      method: 'POST',
      body: formData,
    });
  },

  updateDocument: async (
    fileId: string,
    formData: FormData
  ): Promise<{ success: boolean; file_id: string; replaced_file: boolean; stored_path: string }> => {
    return http(API_ENDPOINTS.DOCUMENTS.UPDATE(fileId), {
      method: 'PUT',
      body: formData,
    });
  },

  deleteDocument: async (fileId: string): Promise<{ success: boolean; file_id: string }> => {
    return http(API_ENDPOINTS.DOCUMENTS.DELETE(fileId), {
      method: 'DELETE',
    });
  },

  getViewUrl: (fileId: string, download = false): string => {
    const userId = sessionStorage.getItem('qk7_username') || 'GUEST';
    const clearance = sessionStorage.getItem('qk7_level') || '1';
    const base = API_ENDPOINTS.DOCUMENTS.VIEW(fileId, download);
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}uid=${encodeURIComponent(userId)}&clr=${encodeURIComponent(clearance)}`;
  },

  /**
   * Tải blob tài liệu với đầy đủ custom headers xác thực (X-User-Id, X-Clearance)
   */
  fetchDocumentBlob: async (fileId: string, download = false): Promise<Blob> => {
    const url = documentService.getViewUrl(fileId, download);
    const headers = getAuthHeaders();
    const response = await fetch(url, { headers });

    if (!response.ok) {
      let errorMsg = `Lỗi HTTP ${response.status}`;
      try {
        const json = await response.json();
        if (json.error) errorMsg = json.error;
      } catch (_) {
        const text = await response.text();
        if (text) errorMsg = text;
      }
      throw new Error(errorMsg);
    }

    return await response.blob();
  },

  /**
   * Tải file PDF về máy với custom headers an toàn và tên file chuẩn
   */
  downloadDocument: async (fileId: string, filename?: string): Promise<void> => {
    const blob = await documentService.fetchDocumentBlob(fileId, true);
    const blobUrl = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = blobUrl;
    a.download = filename || `${fileId}.pdf`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1500);
  },
};

