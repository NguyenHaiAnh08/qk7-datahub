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
    signal?: AbortSignal,
  ): Promise<Blob> => {
    const url = fileService.getViewUrl(fileId, download);

    const headers: Record<string, string> = { ...getAuthHeaders() };
    if (fingerprintToken) {
      headers['X-Fingerprint-Token'] = fingerprintToken;
    }

    const response = await fetch(url, { headers, signal });

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

  saveBlobToFile: (blob: Blob, filename?: string): void => {
    const blobUrl = URL.createObjectURL(blob);
    const a = window.document.createElement('a');

    a.href = blobUrl;
    a.download = filename || 'document.pdf';

    window.document.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    }
  },

  downloadFile: async (
    fileId: string,
    filename?: string,
    fingerprintToken?: string,
  ): Promise<void> => {
    const blob = await fileService.fetchFileBlob(fileId, '1', fingerprintToken);
    fileService.saveBlobToFile(blob, filename || `${fileId}.pdf`);
  },

  prepareDownload: async (
    fileId: string,
    filename?: string,
    fingerprintToken?: string,
    signal?: AbortSignal,
  ): Promise<() => void> => {
    const blob = await fileService.fetchFileBlob(fileId, '1', fingerprintToken, signal);
    return () => {
      fileService.saveBlobToFile(blob, filename || `${fileId}.pdf`);
    };
  },
};

export default fileService;