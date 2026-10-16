import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { DocumentItem, DocumentFilterParams } from '../types/document';
import { fileService } from './fileService';

/**
 * Document Service — Quản lý tìm kiếm, tra cứu, tải lên và số hóa văn bản
 */
export const documentService = {
  getDocuments: async (
    params: DocumentFilterParams = {}
  ): Promise<{ total: number; items: DocumentItem[] }> => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.append('q', params.q);
    if (params.code) searchParams.append('code', params.code);
    if (params.title) searchParams.append('title', params.title);
    const type = params.type || params.doc_type_id;
    if (type) searchParams.append('type', type);
    const unit = params.unit || params.issuing_unit_id;
    if (unit) searchParams.append('unit', unit);
    if (params.from) searchParams.append('from', params.from);
    if (params.to) searchParams.append('to', params.to);
    const lv = params.lv ?? params.security_level_id;
    if (lv !== undefined && lv !== null && lv !== '') searchParams.append('lv', String(lv));

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

  getViewUrl: fileService.getViewUrl,
  fetchDocumentBlob: fileService.fetchFileBlob,
  downloadDocument: fileService.downloadFile,
};

