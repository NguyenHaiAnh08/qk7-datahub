import React, { useEffect } from 'react';
import { toast } from './Toast';

export const ApprovalListener: React.FC = () => {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<any>).detail;
      if (!detail?.request_id) return;
      toast.info(
        detail.message ||
          'Thao tác đã được ghi nhận. Vui lòng đợi Quản trị viên tối cao phê duyệt trước khi có hiệu lực.',
        {
          title: 'ĐÃ GỬI YÊU CẦU — CHỜ PHÊ DUYỆT',
          badge: detail.request_id,
          duration: 8000,
        }
      );
    };
    window.addEventListener('qk7:approval-required', handler);
    return () => window.removeEventListener('qk7:approval-required', handler);
  }, []);
  return null;
};