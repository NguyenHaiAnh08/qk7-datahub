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
import { ROUTE_PATHS } from '../../routes/routePaths';

/**
 * Global HTTP Error Listener
 * Bắt các mã trạng thái HTTP từ các cuộc gọi API Backend (http.ts)
 * và tự động thông báo qua Ant Design Notification / điều hướng trang mã trạng thái.
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

      const { status, message, url, autoRedirect } = detail;

      // Không hiển thị popup nếu đang ở sẵn trang lỗi tương ứng
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
        case 401:
          notification.warning({
            title: 'Phiên Làm Việc Hết Hạn',
            description: message || 'Bạn cần đăng nhập lại để tiếp tục thao tác trên cổng dữ liệu.',
            icon: <WarningOutlined className="text-amber-500" />,
            duration: 4.5,
            closeIcon: null,
          });
          break;

        case 403:
          notification.error({
            title: 'Truy Cập Bị Từ Chối',
            description:
              message || 'Cấp độ bảo mật hoặc quyền hạn của bạn không đủ để thực hiện thao tác này.',
            icon: <StopOutlined className="text-red-500" />,
            duration: 4.5,
            closeIcon: null,
          });
          break;

        case 404:
          notification.info({
            title: 'Không Tìm Thấy Tài Nguyên',
            description: message || `Không tìm thấy endpoint hoặc tài liệu yêu cầu: ${url}`,
            duration: 4.5,
            closeIcon: null,
          });
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          notification.error({
            title: 'Sự Cố Máy Chủ',
            description:
              message || 'Máy chủ cổng dữ liệu hoặc SQL Server gặp sự cố khi xử lý truy vấn.',
            icon: <ApiOutlined className="text-red-500" />,
            duration: 5,
            closeIcon: null,
          });
          break;

        default:
          notification.warning({
            title: 'Lỗi Phản Hồi Hệ Thống',
            description: message,
            icon: <ExclamationCircleOutlined className="text-amber-500" />,
            duration: 4.5,
            closeIcon: null,
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
