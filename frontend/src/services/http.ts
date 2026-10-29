/**
 * HTTP Client Wrapper dùng chung cho toàn bộ frontend.
 *
 * Cơ chế xác thực:
 *   - FE gửi duy nhất: `Authorization: Bearer <JWT>` (qua getAuthHeaders())
 *   - Backend Express (:8000) verify JWT và tự inject X-User-Id / X-Clearance
 *     khi proxy sang AI microservice (:8001) — FE KHÔNG được tự set các header này
 *     để tránh giả mạo quyền hạn.
 *
 * Response lỗi (401, 403, 5xx) sẽ phát sự kiện `qk7:http-error` để
 * HttpErrorListener (mounted toàn cục) hiển thị notification + điều hướng.
 */

export interface HttpOptions extends RequestInit {
  skipErrorNotification?: boolean;
  autoRedirectOnError?: boolean;
  silent?: boolean;
}

export interface HttpErrorDetail {
  status: number;
  message: string;
  url: string;
  data?: any;
  autoRedirect?: boolean;
}

export class HttpError extends Error {
  status: number;
  data: any;
  url: string;

  constructor(status: number, message: string, data?: any, url: string = '') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
    this.url = url;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('qk7_token');
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
}

export async function http<T>(url: string, options: HttpOptions = {}): Promise<T> {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => ({}));
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      let errorMsg = `Lỗi HTTP ${response.status}`;
      if (typeof data === 'object' && data?.error) {
        errorMsg = data.error;
      } else if (typeof data === 'string' && data.trim()) {
        const preMatch = data.match(/<pre>(.*?)<\/pre>/is);
        if (preMatch) {
          errorMsg = preMatch[1].trim();
        } else if (data.includes('<!DOCTYPE') || data.includes('<html')) {
          errorMsg = `Lỗi máy chủ (${response.status})`;
        } else {
          errorMsg = data.trim();
        }
      } else if (response.status === 500 || response.status === 502 || response.status === 504) {
        errorMsg = 'Không thể kết nối đến máy chủ backend (Port 8000). Vui lòng đảm bảo backend đang chạy!';
      }

      const httpError = new HttpError(response.status, errorMsg, data, url);
      if (!options.silent && import.meta.env.DEV) {
        console.error(`[HTTP ${response.status}] ${options.method || 'GET'} ${url.split('?')[0]}`);
      }

      // Kích hoạt custom event toàn cục để Router/App lắng nghe và điều hướng
      if (typeof window !== 'undefined' && !options.skipErrorNotification) {
        window.dispatchEvent(
          new CustomEvent<HttpErrorDetail>('qk7:http-error', {
            detail: {
              status: response.status,
              message: errorMsg,
              url,
              data,
              autoRedirect: options.autoRedirectOnError ?? false,
            },
          })
        );
      }

      throw httpError;
    }

    return data as T;
  } catch (err: any) {
    // Nếu là lỗi mạng không phản hồi (fetch failed/offline/Safari Load failed)
    if (!(err instanceof HttpError)) {
      const isLoadFailed =
        err?.name === 'TypeError' ||
        err?.message === 'Load failed' ||
        (err?.message && (err.message.includes('fetch') || err.message.includes('Load failed')));

      const friendlyMsg = isLoadFailed
        ? 'Không thể kết nối đến máy chủ backend (Port 8000). Vui lòng đảm bảo backend đang chạy!'
        : (err.message || 'Mất kết nối tới máy chủ');

      const netError = new HttpError(503, friendlyMsg, null, url);
      if (typeof window !== 'undefined' && !options.skipErrorNotification) {
        window.dispatchEvent(
          new CustomEvent<HttpErrorDetail>('qk7:http-error', {
            detail: {
              status: 503,
              message: friendlyMsg,
              url,
              autoRedirect: options.autoRedirectOnError ?? false,
            },
          })
        );
      }
      throw netError;
    }
    throw err;
  }
}

/**
 * Gọi API backend để test phản hồi mã trạng thái HTTP thực tế
 */
export async function testBackendHttpError(code: number, message?: string): Promise<any> {
  const query = message ? `?msg=${encodeURIComponent(message)}` : '';
  return http(`/api/test-http-error/${code}${query}`, { skipErrorNotification: false });
}

