import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { DocumentType } from '../types/document';

/**
 * DocumentType Service — Quản lý danh mục loại văn bản
 */
export const documentTypeService = {
  getDocumentTypes: async (): Promise<{ total: number; items: DocumentType[] }> => {
    return http<{ total: number; items: DocumentType[] }>(API_ENDPOINTS.ADMIN.DOCUMENT_TYPES);
  },

  createDocumentType: async (data: { type_id: string; name: string; description?: string }): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.DOCUMENT_TYPES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateDocumentType: async (typeId: string, data: { name: string; description?: string }): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.DOCUMENT_TYPE_DETAIL(typeId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteDocumentType: async (typeId: string): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.DOCUMENT_TYPE_DETAIL(typeId), {
      method: 'DELETE',
    });
  },
};
