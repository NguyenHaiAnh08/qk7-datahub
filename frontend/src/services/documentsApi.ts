import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { DocumentItem, DocumentFilterParams } from '../types/document';

export const documentsApi = {
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
    return API_ENDPOINTS.DOCUMENTS.VIEW(fileId, download);
  },
};
