import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HttpErrorDetail } from '../../services/http';
import { authService } from '../../services/authService';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { toast } from './Toast';

/**
 * Global HTTP Error Listener
 * - 401 (không phải login) → Xóa session + dispatch 'qk7:session-expired' để AuthContext reset
 * - Các mã khác → JolyUI Animated Toast với âm hưởng chỉ huy tác chiến quân sự
 */
export const HttpErrorListener: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ FIX: Dùng Ref để chặn spam Toast 403 (giới hạn 1 lần / 2 giây)
  const last403TimeRef = useRef<number>(0);

  useEffect(() => {
    const handleHttpError = (event: Event) => {
      const customEvent = event as CustomEvent<HttpErrorDetail>;
      const detail = customEvent.detail;
      if (!detail) return;

      // Endpoint fingerprint tự xử lý lỗi riêng (agent offline, timeout...)
      if (detail.url?.includes('/fingerprint/')) return;

      const { status, message, url, autoRedirect } = detail;

      // 401 trên chính request login = sai mật khẩu — KHÔNG redirect để user nhập lại
      const isLoginRequest = url?.includes('/auth/login');

      // Nếu đang là khách (Guest), không cần redirect khi 401 (do API yêu cầu auth)
      const currentUser = authService.getCurrentSession();
      const isGuest = currentUser?.user_id === 'GUEST';

      // === 401: session hết hạn — clear + redirect ===
      if (status === 401 && !isLoginRequest && !isGuest) {
        try {
          authService.clearSession();
        } catch {
          /* ignore */
        }
        // Báo cho AuthProvider biết để reset state + navigate
        window.dispatchEvent(new CustomEvent('qk7:session-expired'));

        toast.warning(
          message || 'Vui lòng đăng nhập lại để tiếp tục thao tác trên cổng dữ liệu.',
          { title: 'Phiên Làm Việc Hết Hạn', badge: 'AUTH-401' }
        );
        return;
      }

      // Không hiển thị popup nếu đang ở trang lỗi tương ứng
      const isAlreadyOnErrorPage =
        location.pathname === `/error/${status}` ||
        location.pathname === `/${status}` ||
        (location.pathname === ROUTE_PATHS.LOGIN && status === 401);

      if (autoRedirect) {
        navigate(`/error/${status}`, { state: { message, code: status, url } });
        return;
      }

      if (isAlreadyOnErrorPage) return;

      switch (status) {
        case 403: {
          // ✅ FIX: Chặn spam 403 (chỉ hiện 1 lần trong 2 giây)
          const now = Date.now();
          if (now - last403TimeRef.current < 2000) {
            return;
          }
          last403TimeRef.current = now;

          toast.securityAlert(
            message || 'Cấp độ bảo mật hoặc quyền hạn của bạn không đủ để thực hiện thao tác này.',
            { title: 'Truy Cập Bị Từ Chối', badge: 'CLEARANCE-403' }
          );
          break;
        }

        case 404:
          toast.info(
            message || `Không tìm thấy endpoint hoặc tài liệu yêu cầu: ${url}`,
            { title: 'Không Tìm Thấy Tài Nguyên', badge: '404' }
          );
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          toast.error(
            message || 'Máy chủ cổng dữ liệu hoặc SQL Server gặp sự cố khi xử lý truy vấn.',
            { title: 'Sự Cố Máy Chủ', badge: `ERR-${status}` }
          );
          break;

        default:
          toast.warning(message || 'Đã xảy ra sự cố không xác định', {
            title: 'Lỗi Phản Hồi Hệ Thống',
            badge: `HTTP-${status}`,
          });
          break;
      }
    };

    window.addEventListener('qk7:http-error', handleHttpError);
    return () => {
      window.removeEventListener('qk7:http-error', handleHttpError);
    };
  }, [navigate, location.pathname]);

  return null;
};