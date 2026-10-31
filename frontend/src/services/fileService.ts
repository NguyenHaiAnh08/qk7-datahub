import { getAuthHeaders, HttpError } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';

export interface FileBlobResult {
  blob: Blob;
  serverTime: Date;
  traceId?: string;
  clockSkewMs: number;
  isClockTampered?: boolean;
}

export const fileService = {
  getViewUrl: (fileId: string, download: '0' | '1' = '0'): string => {
    return API_ENDPOINTS.FILES.VIEW(fileId, download);
  },

  /**
   * Tải blob tài liệu kèm siêu dữ liệu bảo mật từ Server:
   * - serverTime: Giờ chuẩn từ máy chủ NTP (chống chỉnh lùi/tiến giờ Windows)
   * - traceId: Mã vết truy xuất duy nhất (REF-...) gắn vào ACCESS_LOG
   * - clockSkewMs: Độ lệch giữa giờ máy trạm và giờ máy chủ (dùng cho Clock-Skew Guard)
   */
  fetchFileBlobWithMeta: async (
    fileId: string,
    download: '0' | '1' = '0',
    fingerprintToken?: string,
    signal?: AbortSignal,
  ): Promise<FileBlobResult> => {
    const url = fileService.getViewUrl(fileId, download);

    const headers: Record<string, string> = { ...getAuthHeaders() };

    // ✅ FIX: CHỈ lấy token của chính file này (key có ${fileId}).
    // - Ưu tiên token được truyền trực tiếp từ modal xác thực vân tay hiện hành.
    // - Fallback chỉ đọc sessionStorage theo từng file; KHÔNG còn fallback toàn cục.
    let effectiveToken = fingerprintToken;
    if (!effectiveToken && typeof window !== 'undefined') {
      try {
        effectiveToken =
          window.sessionStorage.getItem(`qk7_fp_token_${fileId}`) ?? undefined;
      } catch {
        // sessionStorage có thể bị chặn (private mode / iframe sandbox)
        effectiveToken = undefined;
      }
    }

    if (effectiveToken) {
      headers['X-Fingerprint-Token'] = effectiveToken;
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

    const blob = await response.blob();

    // 1. Trích xuất thời gian máy chủ từ Header (chống giả mạo giờ hệ thống trên máy trạm)
    const timestampStr = response.headers.get('x-clock-timestamp');
    const serverTimeStr = response.headers.get('x-server-time') || response.headers.get('date');
    const traceId = response.headers.get('x-trace-id') || undefined;
    const isClockTampered = response.headers.get('x-clock-tamper') === '1';

    let serverTime: Date;
    if (timestampStr && !isNaN(Number(timestampStr))) {
      serverTime = new Date(Number(timestampStr));
    } else if (serverTimeStr) {
      serverTime = new Date(serverTimeStr);
    } else {
      serverTime = new Date();
    }

    // 2. Tính độ lệch giữa máy trạm và máy chủ
    const clockSkewMs = Math.abs(Date.now() - serverTime.getTime());

    return {
      blob,
      serverTime,
      traceId,
      clockSkewMs,
      isClockTampered,
    };
  },

  fetchFileBlob: async (
    fileId: string,
    download: '0' | '1' = '0',
    fingerprintToken?: string,
    signal?: AbortSignal,
  ): Promise<Blob> => {
    const res = await fileService.fetchFileBlobWithMeta(
      fileId,
      download,
      fingerprintToken,
      signal,
    );
    return res.blob;
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
    const finalFilename = filename || `${fileId}.pdf`;
    let fileHandle: any = null;

    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: finalFilename,
          types: [
            {
              description: 'Tài liệu PDF (*.pdf)',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ],
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('[downloadFile] showSaveFilePicker fallback:', err);
      }
    }

    const blob = await fileService.fetchFileBlob(fileId, '1', fingerprintToken);

    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err) {
        console.warn('[downloadFile] Ghi vào fileHandle thất bại, fallback:', err);
      }
    }

    fileService.saveBlobToFile(blob, finalFilename);
  },

  prepareDownload: async (
    fileId: string,
    filename?: string,
    fingerprintToken?: string,
    signal?: AbortSignal,
  ): Promise<() => Promise<void>> => {
    const finalFilename = filename || `${fileId}.pdf`;
    let fileHandle: any = null;

    // File System Access API: Kích hoạt ngay trong stack tương tác người dùng (User Gesture)
    // Cho phép mở hộp thoại Save As trên Windows/PWA để người dùng chọn ổ đĩa/thư mục lưu
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: finalFilename,
          types: [
            {
              description: 'Tài liệu PDF (*.pdf)',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ],
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          const abortErr = new Error('Người dùng đã hủy chọn nơi lưu tệp');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        console.warn('[prepareDownload] showSaveFilePicker fallback:', err);
      }
    }

    const blob = await fileService.fetchFileBlob(fileId, '1', fingerprintToken, signal);

    return async () => {
      if (fileHandle) {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err) {
          console.warn('[prepareDownload] Ghi vào fileHandle thất bại, fallback:', err);
        }
      }
      fileService.saveBlobToFile(blob, finalFilename);
    };
  },
};

export default fileService;