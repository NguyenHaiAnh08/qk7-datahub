import React from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RouterProvider } from './routes/RouterProvider';
import { HttpErrorListener } from './components/common/HttpErrorListener';
import { AIChatWidget } from './components/ai-chat/AIChatWidget';
import './index.css';

/**
 * Wrapper đồng bộ Theme (Dark/Light) và Cấu hình Token Ant Design toàn diện
 * - Màu action chính: TÍM (#722ED1)
 * - Locale: Tiếng Việt (vi_VN)
 * - AntApp cung cấp static context cho message, notification, modal
 */
const AntdAppWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDark } = useTheme();

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#722ED1', // Màu action chính: TÍM chuẩn quân khu
          colorPrimaryHover: '#854eca',
          colorPrimaryActive: '#531dab',
          colorLink: '#722ED1',
          colorLinkHover: '#9254de',
          borderRadius: 8,
          fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
        },
        components: {
          Button: {
            controlHeight: 38,
            borderRadius: 8,
            primaryShadow: '0 4px 12px rgba(114, 46, 209, 0.25)',
          },
          Input: {
            controlHeight: 38,
            borderRadius: 8,
          },
          Select: {
            controlHeight: 38,
            borderRadius: 8,
          },
          TreeSelect: {
            controlHeight: 38,
            borderRadius: 12,
          },
          Card: {
            borderRadiusLG: 12,
          },
          Table: {
            borderRadiusLG: 8,
          },
          Modal: {
            borderRadiusLG: 12,
          },
          Tag: {
            borderRadiusSM: 6,
          },
        },
      }}
    >
      <AntApp>
        <HttpErrorListener />
        {children}
      </AntApp>
    </ConfigProvider>
  );
};

/**
 * Global AI Assistant Chat Wrapper
 * Đảm bảo hiển thị xuyên suốt trên mọi trang sau khi quân nhân đăng nhập
 * (Bao gồm cả Cổng Portal, Bàn làm việc Văn thư và Toàn bộ các trang Quản trị)
 */
const AIChatWrapper: React.FC = () => {
  const location = useLocation();

  // Không hiển thị trên trang đăng nhập
  if (location.pathname === '/login') {
    return null;
  }

  return <AIChatWidget />;
};

/**
 * Root Application Component
 * Sets up global context providers (Theme, Ant Design, Auth) and BrowserRouter.
 * Route definitions are fully delegated to RouterProvider (auto-discovered routes).
 */
export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AntdAppWrapper>
          <AuthProvider>
            <RouterProvider />
            <AIChatWrapper />
          </AuthProvider>
        </AntdAppWrapper>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;

