import React, { useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Result, Button, Typography, Tag, Card } from 'antd';
import { HomeOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { ROUTE_PATHS } from '../routes/routePaths';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { getDestinationByRole } from '../contexts/AuthContext';

const { Paragraph } = Typography;

export interface HttpErrorPageProps {
  code?: number | string;
  title?: string;
  subTitle?: string;
  message?: string;
}

interface ErrorConfig {
  status: '403' | '404' | '500' | 'warning' | 'error';
  badge: string;
  badgeColor: string;
  title: string;
  subTitle: string;
}

const ERROR_CONFIG_MAP: Record<string, ErrorConfig> = {
  '400': {
    status: 'warning',
    badge: 'BAD REQUEST',
    badgeColor: 'orange',
    title: '400 — Yêu Cầu Không Hợp Lệ',
    subTitle: 'Dữ liệu hoặc tham số truy vấn gửi lên máy chủ cổng dữ liệu không hợp lệ.',
  },
  '401': {
    status: 'warning',
    badge: 'UNAUTHORIZED',
    badgeColor: 'volcano',
    title: '401 — Chưa Xác Thực Danh Tính',
    subTitle: 'Phiên làm việc bảo mật quân sự của bạn chưa được xác thực hoặc đã hết hạn.',
  },
  '403': {
    status: '403',
    badge: 'ACCESS DENIED',
    badgeColor: 'red',
    title: '403 — Truy Cập Bị Từ Chối',
    subTitle: 'Bạn không có đủ cấp độ bảo mật hoặc quyền hạn để truy xuất khu vực/văn bản này.',
  },
  '404': {
    status: '404',
    badge: 'NOT FOUND',
    badgeColor: 'purple',
    title: '404 — Không Tìm Thấy Trang Hoặc Tài Liệu',
    subTitle: 'Đường dẫn bạn yêu cầu không tồn tại trên hệ thống hoặc văn bản đã được thu hồi / hủy bỏ.',
  },
  '500': {
    status: '500',
    badge: 'SERVER ERROR',
    badgeColor: 'magenta',
    title: '500 — Lỗi Máy Chủ Cổng Dữ Liệu',
    subTitle: 'Máy chủ QK7 DataHub gặp sự cố khi xử lý dữ liệu từ SQL Server hoặc ổ lưu trữ.',
  },
  '502': {
    status: '500',
    badge: 'BAD GATEWAY',
    badgeColor: 'red',
    title: '502 — Cổng Kết Nối Máy Chủ Gặp Sự Cố',
    subTitle: 'Không thể nhận phản hồi từ dịch vụ nội bộ hoặc cơ sở dữ liệu máy chủ cụm LAN.',
  },
  '503': {
    status: '500',
    badge: 'SERVICE UNAVAILABLE',
    badgeColor: 'red',
    title: '503 — Dịch Vụ Đang Tạm Dừng',
    subTitle: 'Hệ thống đang bảo trì định kỳ hoặc đang xử lý quá tải tác vụ quân sự.',
  },
};

export const HttpErrorPage: React.FC<HttpErrorPageProps> = ({
  code: propCode,
  title: propTitle,
  subTitle: propSubTitle,
  message: propMessage,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { code: paramCode } = useParams<{ code?: string }>();

  // Xác định mã lỗi từ props -> params -> route path -> query string -> location state -> fallback 404
  const statusCode = useMemo(() => {
    if (propCode) return String(propCode);
    if (paramCode) return String(paramCode);

    // Lấy từ pathname (/400, /401, /403, /404, /500, /502, /503)
    const pathMatch = location.pathname.match(/\/(400|401|403|404|500|502|503)/);
    if (pathMatch) return pathMatch[1];

    // Lấy từ query string (?code=403)
    const searchParams = new URLSearchParams(location.search);
    const queryCode = searchParams.get('code');
    if (queryCode && ERROR_CONFIG_MAP[queryCode]) return queryCode;

    // Lấy từ location state
    const stateCode = (location.state as any)?.code;
    if (stateCode && ERROR_CONFIG_MAP[String(stateCode)]) return String(stateCode);

    return '404';
  }, [propCode, paramCode, location.pathname, location.search, location.state]);

  // Nếu người dùng đã đăng nhập mà rơi vào trang 403: Tự động điều hướng về khu vực làm việc theo vai trò
  React.useEffect(() => {
    if (statusCode === '403' && user && user.user_id !== 'GUEST') {
      const dest = getDestinationByRole(user);
      const timer = setTimeout(() => {
        navigate(dest, { replace: true });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [statusCode, user, navigate]);

  const config = useMemo(() => {
    return (
      ERROR_CONFIG_MAP[statusCode] || {
        status: 'error' as const,
        badge: `HTTP ${statusCode}`,
        badgeColor: 'purple',
        title: `Lỗi Mã Trạng Thái ${statusCode}`,
        subTitle: 'Đã xảy ra lỗi không xác định trong quá trình điều hướng hệ thống.',
      }
    );
  }, [statusCode]);

  const stateMessage = (location.state as any)?.message;

  const displayTitle = propTitle || config.title;
  const displaySubTitle = propSubTitle || propMessage || stateMessage || config.subTitle;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {/* Header Bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div
          className="flex items-center space-x-3 cursor-pointer select-none"
          onClick={() => navigate(ROUTE_PATHS.PORTAL)}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <SafetyCertificateOutlined className="text-lg text-amber-400" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-wider bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-500 dark:from-purple-300 dark:to-indigo-300 bg-clip-text text-transparent">
              QK7 DATAHUB
            </span>
            <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              CỔNG QUẢN LÝ DỮ LIỆU BẢO MẬT
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Tag color={config.badgeColor} className="font-mono font-semibold px-2.5 py-0.5 text-xs m-0">
            {config.badge}
          </Tag>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <Card
          className="w-full max-w-2xl border-slate-200 dark:border-slate-800 shadow-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl overflow-hidden"
          styles={{ body: { padding: '40px 32px' } }}
        >
          <Result
            status={config.status}
            title={
              <span className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                {displayTitle}
              </span>
            }
            subTitle={
              <Paragraph className="text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed mt-2 mb-0 max-w-lg mx-auto">
                {displaySubTitle}
              </Paragraph>
            }
            extra={
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <Button
                  type="primary"
                  icon={<HomeOutlined />}
                  size="large"
                  onClick={() => navigate(getDestinationByRole(user))}
                  className="font-semibold shadow-md shadow-purple-600/25 bg-purple-600 hover:bg-purple-500 px-6 h-11 rounded-xl"
                >
                  Về Khu Vực Làm Việc
                </Button>

                {statusCode.startsWith('5') && (
                  <Button
                    icon={<ReloadOutlined />}
                    size="large"
                    onClick={() => window.location.reload()}
                    className="font-medium px-5 h-11 rounded-xl border-amber-500 text-amber-600 hover:text-amber-500 dark:bg-slate-800 dark:border-amber-600/60 dark:text-amber-400"
                  >
                    Tải Lại Trang
                  </Button>
                )}
              </div>
            }
          />
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
        Hệ Thống Dữ Liệu Số Hóa Văn Bản — Quân Khu 7 © {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default HttpErrorPage;
