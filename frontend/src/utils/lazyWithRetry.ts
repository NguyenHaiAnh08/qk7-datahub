import React from 'react';

/**
 * Wrapper cho React.lazy tích hợp cơ chế tự động phục hồi (Auto-Retry & Transparent Reload).
 *
 * Xử lý dứt điểm lỗi kinh điển của SPA / Vite:
 * "TypeError: Failed to fetch dynamically imported module: ... "
 * Lỗi này xảy ra khi máy chủ deploy/build bản mới hoặc client bị rớt mạng chập chờn
 * khiến trình duyệt không tải được chunk JS cũ trong cache.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | any>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const pageHasBeenRefreshed = sessionStorage.getItem('qk7_chunk_refreshed') === 'true';

    try {
      const module = await componentImport();
      sessionStorage.setItem('qk7_chunk_refreshed', 'false');
      return module && module.default ? module : { default: module };
    } catch (error: any) {
      console.warn('[lazyWithRetry] Phát hiện lỗi nạp chunk động:', error?.message);

      // Nếu gặp lỗi fetch module và chưa thử reload lần nào trong phiên
      if (!pageHasBeenRefreshed) {
        sessionStorage.setItem('qk7_chunk_refreshed', 'true');
        // Tự động tải lại trang sạch sẽ để nạp index và manifest mới nhất từ server
        window.location.reload();
        // Trả về component rỗng tạm thời trong lúc trang reload
        return { default: (() => null) as unknown as T };
      }

      // Đã reload rồi mà vẫn lỗi thì ném ra cho Suspense / Error Boundary
      throw error;
    }
  });
}

export default lazyWithRetry;

