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
    const errorMsg =
      typeof data === 'object' && data?.error ? data.error : `Lỗi HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}
