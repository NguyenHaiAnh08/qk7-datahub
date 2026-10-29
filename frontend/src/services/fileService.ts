import { getAuthHeaders, HttpError } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';

export const fileService = {
  getViewUrl: (fileId: string, download: '0' | '1' = '0'): string => {
  return API_ENDPOINTS.FILES.VIEW(fileId, download);
  },

  fetchFileBlob: async (
    fileId: string,
    download: '0' | '1' = '0',
    fingerprintToken?: string,
  ): Promise<Blob> => {
    const url = fileService.getViewUrl(fileId, download);

    const headers: Record<string, string> = { ...getAuthHeaders() };
    const effectiveToken =
      fingerprintToken ||
      (typeof window !== 'undefined'
        ? sessionStorage.getItem(`qk7_fp_token_`) || sessionStorage.getItem('qk7_fp_token')
        : undefined);
    if (effectiveToken) {
      headers['X-Fingerprint-Token'] = effectiveToken;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      let errorData: unknown = null;

      if (contentType.includes('application/json')) {
        errorData = await response.json().catch(() => null);
      } else {
        errorData = await response.text().catch(() => '');
      }

      const errorMsg =
        (errorData &&
          typeof errorData === 'object' &&
          'error' in errorData &&
          typeof (errorData as { error?: unknown }).error === 'string' &&
          (errorData as { error: string }).error) ||
        (typeof errorData === 'string' && errorData.trim()) ||
        `Lỗi HTTP ${response.status}`;

      throw new HttpError(response.status, errorMsg as string, errorData, url);
    }

    return await response.blob();
  },

  downloadFile: async (
    fileId: string,
    filename?: string,
    fingerprintToken?: string,
  ): Promise<void> => {
    const blob = await fileService.fetchFileBlob(fileId, '1', fingerprintToken);
    const blobUrl = URL.createObjectURL(blob);
    const a = window.document.createElement('a');

    a.href = blobUrl;
    a.download = filename || `${fileId}.pdf`;

    window.document.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    }
  },
};

export default fileService;