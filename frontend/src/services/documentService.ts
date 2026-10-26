import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { DocumentItem, DocumentFilterParams } from '../types/document';
import fileService from './fileService';


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
    duplicate_check?: CheckDuplicateResult;
}

/**
 * Check duplicate document based on SHA256 and document code
 */
export interface DuplicateMatchDoc {
  file_id: string;
  document_code?: string | null;
  title: string;
  security_level_id: number;
  security_name?: string;
  created_at?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
}

export interface CheckDuplicateResult {
  sha256: string;
  is_duplicate: boolean;
  sha_duplicate: boolean;
  code_duplicate: boolean;
  matches: {
    by_sha256: DuplicateMatchDoc[];
    by_code: DuplicateMatchDoc[];
  };
}


export interface MyUnitDocumentResponse {
  total: number;
  items: DocumentItem[];
  unit: { unit_id: string; name: string; parent_id?: string | null };
  subtree_unit_ids: string[];
  can_select_unit: boolean;
  selected_unit_id: string;
}

export interface MyUnitDocumentParams {
  unit_id?: string;
  q?: string;
  code?: string;
  title?: string;
  type?: string;
  from?: string;
  to?: string;
  lv?: number;
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
    if (params.include_children) searchParams.append('include_children', 'true');
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

    getMyUnitDocuments: async (
    params: MyUnitDocumentParams = {}
  ): Promise<MyUnitDocumentResponse> => {
    const sp = new URLSearchParams();
    if (params.unit_id) sp.append('unit_id', params.unit_id);
    if (params.q) sp.append('q', params.q);
    if (params.code) sp.append('code', params.code);
    if (params.title) sp.append('title', params.title);
    if (params.type) sp.append('type', params.type);
    if (params.from) sp.append('from', params.from);
    if (params.to) sp.append('to', params.to);
    if (params.lv !== undefined && params.lv !== null) sp.append('lv', String(params.lv));

    const qs = sp.toString();
    return http<MyUnitDocumentResponse>(
      `${API_ENDPOINTS.DOCUMENTS.MY_UNIT}${qs ? `?${qs}` : ''}`, 
      { skipErrorNotification: true }
    );
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
 * @deprecated Từ v2026.10, dùng `parseDocument()` — API parse đã trả về
 * `duplicate_check` (SHA-256 + document_code) trong cùng 1 request,
 * tránh 2 round-trip. Hàm này chỉ giữ để tương thích ngược với code cũ.
 *
 * Check for duplicate documents based on SHA256 and document code
 */
  checkDuplicate: async (
    file: File,
    documentCode?: string
  ): Promise<CheckDuplicateResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (documentCode) formData.append('document_code', documentCode);

    return http<CheckDuplicateResult>('/api/documents/check-duplicate', {
      method: 'POST',
      body: formData,
      skipErrorNotification: true,
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
  saveBlobToFile: fileService.saveBlobToFile,
  prepareDownload: fileService.prepareDownload,

  // ═══════════════════════════════════════════════════════════
  // SOFT DELETE / TRASH / RESTORE / PURGE
  // ═══════════════════════════════════════════════════════════

  getTrash: async (): Promise<{ total: number; items: DocumentItem[] }> => {
    return http<{ total: number; items: DocumentItem[] }>(API_ENDPOINTS.DOCUMENTS.TRASH);
  },

  restoreDocument: async (
    fileId: string
  ): Promise<{ success: boolean; file_id: string; restored: boolean }> => {
    return http(API_ENDPOINTS.DOCUMENTS.RESTORE(fileId), { method: 'POST' });
  },

  purgeDocument: async (
    fileId: string
  ): Promise<{ success: boolean; file_id: string; purged: boolean }> => {
    return http(API_ENDPOINTS.DOCUMENTS.PURGE(fileId), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: fileId }),
    });
  },


};

