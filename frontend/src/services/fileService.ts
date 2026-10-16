import { getAuthHeaders } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';

/**
 * File Service — Quản lý hiển thị (inline) và tải về (attachment) tài liệu PDF
 * Khớp chuẩn Swagger: GET /api/files/{fileId}/view
 *
 * Parameters:
 *   - fileId (path, required): string — Mã tài liệu (VD: 'DOC-002')
 *   - download (query): '0' | '1' — 1 = tải về (attachment), 0 = xem (inline)
 * Headers:
 *   - X-User-Id: Mã người dùng
 *   - X-Clearance: Mức bảo mật của người dùng (1-5)
 * Responses:
 *   - 200: Stream PDF (application/pdf)
 *   - 403: Không đủ quyền (mức bảo mật thấp hơn hoặc tài liệu mật cấp 3+ bị từ chối tải về)
 *   - 404: Không tìm thấy tài liệu
 *   - 500: Lỗi server
 */
export const fileService = {
  /**
   * Tạo URL xem hoặc tải tệp PDF (hỗ trợ kèm query fallback cho iframe/tab mới)
   */
  getViewUrl: (fileId: string, download: '0' | '1' | boolean = '0'): string => {
    const userId = sessionStorage.getItem('qk7_username') || 'GUEST';
    const clearance = sessionStorage.getItem('qk7_level') || '1';
    const base = API_ENDPOINTS.FILES.VIEW(fileId, download);
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}uid=${encodeURIComponent(userId)}&clr=${encodeURIComponent(clearance)}`;
  },

  /**
   * Tải blob tài liệu với đầy đủ custom headers xác thực (X-User-Id, X-Clearance)
   */
  fetchFileBlob: async (fileId: string, download: '0' | '1' | boolean = '0'): Promise<Blob> => {
    const url = fileService.getViewUrl(fileId, download);
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
   * Tải file PDF về máy an toàn với đúng tên file
   */
  downloadFile: async (fileId: string, filename?: string): Promise<void> => {
    const blob = await fileService.fetchFileBlob(fileId, '1');
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

export default fileService;
