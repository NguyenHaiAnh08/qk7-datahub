import { getAuthHeaders } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';

export const fileService = {
  getViewUrl: (fileId: string, download: '0' | '1' | boolean = '0'): string => {
    // ✅ Chỉ trả URL gốc — auth qua header khi fetch
    return API_ENDPOINTS.FILES.VIEW(fileId, download);
  },

  fetchFileBlob: async (
    fileId: string,
    download: '0' | '1' | boolean = '0',
    fingerprintToken?: string
  ): Promise<Blob> => {
    const url = fileService.getViewUrl(fileId, download);
    const headers: Record<string, string> = { ...getAuthHeaders() };
    if (fingerprintToken) {
      headers['X-Fingerprint-Token'] = fingerprintToken;
    }
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

  downloadFile: async (
    fileId: string,
    filename?: string,
    fingerprintToken?: string
  ): Promise<void> => {
    const blob = await fileService.fetchFileBlob(fileId, '1', fingerprintToken);
    const blobUrl = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = blobUrl;
    a.download = filename || `${fileId}.pdf`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  },
};

export default fileService;