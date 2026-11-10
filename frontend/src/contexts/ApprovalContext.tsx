// frontend/src/contexts/ApprovalContext.tsx
/**
 * ApprovalContext — Quản lý tập trung số lượng yêu cầu chờ duyệt
 *
 * Lý do tạo context thay vì mỗi component tự poll:
 *   1. Chỉ 1 timer duy nhất → tránh 2 (Header) + 1 (Sidebar) + 1 (AdminDashboard) = 4 timer song song
 *   2. Đảm bảo mọi nơi hiển thị cùng 1 con số
 *   3. Tự động bật/tắt poll theo trạng thái auth + permission
 *   4. Cung cấp `refresh()` để các trang chủ động làm mới sau khi approve/reject
 *
 * Quy tắc bật poll:
 *   - isAuthenticated === true (không phải GUEST)
 *   - có permission 'AUDIT_VIEW' (chỉ Admin/Quản trị tối cao mới thấy)
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { approvalService } from '../services/approvalService';
import { useAuth } from '../hooks/useAuth';

export interface ApprovalContextValue {
  /** Số lượng yêu cầu đang chờ duyệt (status = PENDING) */
  count: number;
  /** Đang trong chu kỳ fetch (dùng cho spinner) */
  isPolling: boolean;
  /** Buộc làm mới ngay lập tức (sau khi approve/reject) */
  refresh: () => Promise<void>;
}

const ApprovalContext = createContext<ApprovalContextValue>({
  count: 0,
  isPolling: false,
  refresh: async () => {},
});

export const useApprovalContext = (): ApprovalContextValue =>
  useContext(ApprovalContext);

export interface ApprovalProviderProps {
  children: ReactNode;
  /** Chu kỳ poll (ms). Mặc định 30s */
  pollMs?: number;
}

export const ApprovalProvider: React.FC<ApprovalProviderProps> = ({
  children,
  pollMs = 30000,
}) => {
  const { user, hasPermission } = useAuth();

  // ─── Điều kiện bật poll ───
  const isAuthenticated = !!user && user.user_id !== 'GUEST';
  const canApprove = hasPermission('APPROVAL_VALIDATE');
  const enabled = isAuthenticated && canApprove;

  const [count, setCount] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      setIsPolling(true);
      const res = await approvalService.listPending();
      setCount(res.items?.length || 0);
    } catch {
      // silent — không dispatch toast để tránh spam
      // Nếu lỗi 401 → HttpErrorListener đã xử lý
    } finally {
      setIsPolling(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    // Fetch ngay lần đầu
    refresh();

    // Poll định kỳ
    const timer = pollMs > 0 ? setInterval(refresh, pollMs) : null;
    return () => { if (timer) clearInterval(timer); };
  }, [enabled, pollMs, refresh]);

  return (
    <ApprovalContext.Provider value={{ count, isPolling, refresh }}>
      {children}
    </ApprovalContext.Provider>
  );
};

export default ApprovalContext;