import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App as AntApp } from 'antd';
import {
  WarningOutlined,
  StopOutlined,
  ApiOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { HttpErrorDetail } from '../../services/http';
import { authService } from '../../services/authService';
import { ROUTE_PATHS } from '../../routes/routePaths';

/**
 * Global HTTP Error Listener
 * - 401 (không phải login) → Xóa session + dispatch 'qk7:session-expired' để AuthContext reset
 * - Các mã khác → Ant Design Notification (dùng `message`, KHÔNG dùng `title` vì AntD v5)
 */
export const HttpErrorListener: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notification } = AntApp.useApp();

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

      // === 401: session hết hạn — clear + redirect ===
      if (status === 401 && !isLoginRequest) {
        try {
          authService.clearSession();
        } catch {
          /* ignore */
        }
        // Báo cho AuthProvider biết để reset state + navigate
        window.dispatchEvent(new CustomEvent('qk7:session-expired'));

        notification.warning({
          message: 'Phiên Làm Việc Hết Hạn',
          description:
            message || 'Vui lòng đăng nhập lại để tiếp tục thao tác trên cổng dữ liệu.',
          icon: <WarningOutlined className="text-amber-500" />,
          duration: 4.5,
        });
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
        case 403:
          notification.error({
            message: 'Truy Cập Bị Từ Chối',
            description:
              message ||
              'Cấp độ bảo mật hoặc quyền hạn của bạn không đủ để thực hiện thao tác này.',
            icon: <StopOutlined className="text-red-500" />,
            duration: 4.5,
          });
          break;

        case 404:
          notification.info({
            message: 'Không Tìm Thấy Tài Nguyên',
            description: message || `Không tìm thấy endpoint hoặc tài liệu yêu cầu: ${url}`,
            duration: 4.5,
          });
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          notification.error({
            message: 'Sự Cố Máy Chủ',
            description:
              message ||
              'Máy chủ cổng dữ liệu hoặc SQL Server gặp sự cố khi xử lý truy vấn.',
            icon: <ApiOutlined className="text-red-500" />,
            duration: 5,
          });
          break;

        default:
          notification.warning({
            message: 'Lỗi Phản Hồi Hệ Thống',
            description: message,
            icon: <ExclamationCircleOutlined className="text-amber-500" />,
            duration: 4.5,
          });
          break;
      }
    };

    window.addEventListener('qk7:http-error', handleHttpError);
    return () => {
      window.removeEventListener('qk7:http-error', handleHttpError);
    };
  }, [navigate, location.pathname, notification]);

  return null;
};