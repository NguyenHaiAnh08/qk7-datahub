import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App as AntApp, Button, Space } from 'antd';
import {
  WarningOutlined,
  StopOutlined,
  ApiOutlined,
  ExclamationCircleOutlined,
  RightOutlined,
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
            message: 'Phiên Làm Việc Hết Hạn (401)',
            description: message || 'Bạn cần đăng nhập lại để tiếp tục thao tác trên cổng dữ liệu.',
            icon: <WarningOutlined className="text-amber-500" />,
            duration: 6,
            btn: (
              <Space>
                <Button
                  size="small"
                  onClick={() => navigate(ROUTE_PATHS.ERROR_401, { state: { message, code: 401, url } })}
                >
                  Chi Tiết
                </Button>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => navigate(ROUTE_PATHS.LOGIN)}
                  className="bg-purple-600 hover:bg-purple-500"
                >
                  Đăng Nhập
                </Button>
              </Space>
            ),
          });
          break;

        case 403:
          notification.error({
            message: 'Truy Cập Bị Từ Chối (403)',
            description:
              message || 'Cấp độ bảo mật hoặc quyền hạn của bạn không đủ để thực hiện thao tác này.',
            icon: <StopOutlined className="text-red-500" />,
            duration: 8,
            btn: (
              <Button
                type="primary"
                danger
                size="small"
                icon={<RightOutlined />}
                onClick={() => navigate(ROUTE_PATHS.ERROR_403, { state: { message, code: 403, url } })}
              >
                Xem Trang Lỗi 403
              </Button>
            ),
          });
          break;

        case 404:
          notification.info({
            message: 'Không Tìm Thấy Tài Nguyên (404)',
            description: message || `Không tìm thấy endpoint hoặc tài liệu yêu cầu: ${url}`,
            duration: 5,
            btn: (
              <Button
                size="small"
                onClick={() => navigate(ROUTE_PATHS.ERROR_404, { state: { message, code: 404, url } })}
              >
                Trang Lỗi 404
              </Button>
            ),
          });
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          notification.error({
            message: `Sự Cố Máy Chủ Backend (${status})`,
            description:
              message || 'Máy chủ cổng dữ liệu hoặc SQL Server gặp sự cố khi xử lý truy vấn.',
            icon: <ApiOutlined className="text-red-500" />,
            duration: 8,
            btn: (
              <Button
                type="primary"
                size="small"
                className="bg-purple-600 hover:bg-purple-500"
                onClick={() => navigate(ROUTE_PATHS.ERROR_500, { state: { message, code: status, url } })}
              >
                Chuyển Đến Trang 500
              </Button>
            ),
          });
          break;

        default:
          notification.warning({
            message: `Lỗi Phản Hồi HTTP ${status}`,
            description: message,
            icon: <ExclamationCircleOutlined className="text-amber-500" />,
            duration: 6,
            btn: (
              <Button
                size="small"
                onClick={() => navigate(`/error/${status}`, { state: { message, code: status, url } })}
              >
                Xem Chi Tiết
              </Button>
            ),
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
