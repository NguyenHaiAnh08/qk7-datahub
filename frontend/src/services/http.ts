/**
 * HTTP Client Wrapper dùng chung cho toàn bộ frontend
 * Đảm bảo 100% header xác thực theo chuẩn server.js:
 *   - X-User-Id
 *   - X-Clearance
 */

export function getAuthHeaders(): Record<string, string> {
  const userId = sessionStorage.getItem('qk7_username') || 'GUEST';
  const clearance = sessionStorage.getItem('qk7_level') || '1';
  return {
    'X-User-Id': userId,
    'X-Clearance': String(clearance),
  };
}

export async function http<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

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
      errorMsg = data.trim();
    } else if (response.status === 500 || response.status === 502 || response.status === 504) {
      errorMsg = 'Không thể kết nối đến máy chủ backend (Port 8000). Vui lòng đảm bảo backend (npm start) đang chạy!';
    }
    throw new Error(errorMsg);
  }

  return data as T;
}
