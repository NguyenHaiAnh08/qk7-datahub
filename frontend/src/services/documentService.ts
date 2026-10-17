import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { DocumentItem, DocumentFilterParams } from '../types/document';
import { fileService } from './fileService';


export interface ParsedDocumentMetadata {
    document_code: string | null;
    document_number: string | null;
    doc_type_code: string | null;
    doc_type_name: string | null;
    title: string | null;
    issued_date: string | null;
    signer: string | null;
    signer_position: string | null;
    issuer_unit_name: string | null;
    issuer_parent_unit_name: string | null;  
    issuer_parent_unit_id: string | null;       
    issuer_unit_id: string | null;            
    issuer_display: string | null;              
    parent_matched: boolean;           
    unit_matched: boolean;
}

export interface ParseDocumentResult {
    success: boolean;
    source: 'digital' | 'scan';
    usedOcr: boolean;
    missingFields: string[];
    parsed: ParsedDocumentMetadata;
    sources: Record<string, string>;
    original_name?: string;
    file_size?: number;
    sha256?: string;
    error?: string;
}

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

  /**
   * Parse PDF → metadata (không lưu file, không ghi DB)
   */
  parseDocument: async (file: File): Promise<ParseDocumentResult> => {
    const formData = new FormData();
    formData.append('file', file);
    return http<ParseDocumentResult>(API_ENDPOINTS.DOCUMENTS.PARSE, {
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

