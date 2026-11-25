import React, { useEffect } from 'react';
import { toast } from './Toast';

// Thao tác hàng loạt (xóa/khôi phục nhiều tài liệu...) phát nhiều sự kiện liên tiếp:
// gom các sự kiện đến trong cùng một khoảng ngắn thành MỘT thông báo.
const BATCH_MS = 700;

export const ApprovalListener: React.FC = () => {
  useEffect(() => {
    let ids: string[] = [];
    let firstMessage: string | undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      const batch = Array.from(new Set(ids)); // yêu cầu trùng trả về cùng mã → chỉ đếm 1
      const message = firstMessage;
      ids = [];
      firstMessage = undefined;
      if (batch.length === 0) return;

      if (batch.length === 1) {
        toast.info(
          message ||
            'Thao tác đã được ghi nhận. Vui lòng đợi Quản trị viên tối cao phê duyệt trước khi có hiệu lực.',
          { title: 'ĐÃ GỬI YÊU CẦU — CHỜ PHÊ DUYỆT', badge: batch[0], duration: 8000 }
        );
      } else {
        toast.info(
          `Đã gửi ${batch.length} yêu cầu, đang chờ phê duyệt trước khi có hiệu lực. Theo dõi tại mục "Yêu cầu của tôi".`,
          { title: 'ĐÃ GỬI YÊU CẦU — CHỜ PHÊ DUYỆT', badge: `${batch.length} YÊU CẦU`, duration: 8000 }
        );
      }
    };

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<any>).detail;
      if (!detail?.request_id) return;
      ids.push(String(detail.request_id));
      if (firstMessage === undefined) firstMessage = detail.message;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, BATCH_MS);
    };

    window.addEventListener('qk7:approval-required', handler);
    return () => {
      window.removeEventListener('qk7:approval-required', handler);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return null;
};
