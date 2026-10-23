import React from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { DeviceModeProvider } from './contexts/DeviceModeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RouterProvider } from './routes/RouterProvider';
import { HttpErrorListener } from './components/common/HttpErrorListener';
import AIChatWidget from './components/ai-chat/AIChatWidget';
import './index.css';

/**
 * Wrapper đồng bộ Theme (Dark/Light) và Cấu hình Token Ant Design toàn diện
 * - Màu action chính: TÍM (#722ED1)
 * - Nền tối chuẩn Quân sự SOC: #0b0f19 (Base), #111827 (Surface/Card/Table)
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
          fontFamily: `'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
          // Phân lớp bề mặt Dark Mode chuẩn SOC
          ...(isDark
            ? {
                colorBgBase: '#0b0f19',
                colorBgContainer: '#111827',
                colorBgElevated: '#1e293b',
                colorBgLayout: '#0b0f19',
                colorTextBase: '#f8fafc',
                colorTextSecondary: '#cbd5e1',
                colorBorder: 'rgba(139, 92, 246, 0.25)',
                colorBorderSecondary: '#1e293b',
              }
            : {
                colorBgBase: '#ffffff',
                colorBgContainer: '#ffffff',
                colorBgElevated: '#ffffff',
                colorBgLayout: '#f8fafc',
                colorTextBase: '#0f172a',
                colorTextSecondary: '#64748b',
                colorBorder: '#e2e8f0',
                colorBorderSecondary: '#f1f5f9',
              }),
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
            colorBgContainer: isDark ? '#111827' : '#ffffff',
            colorBorder: isDark ? 'rgba(139, 92, 246, 0.3)' : '#cbd5e1',
          },
          Select: {
            controlHeight: 38,
            borderRadius: 8,
            colorBgContainer: isDark ? '#111827' : '#ffffff',
            colorBorder: isDark ? 'rgba(139, 92, 246, 0.3)' : '#cbd5e1',
          },
          TreeSelect: {
            controlHeight: 38,
            borderRadius: 12,
            colorBgContainer: isDark ? '#111827' : '#ffffff',
          },
          Card: {
            borderRadiusLG: 12,
            colorBgContainer: isDark ? '#111827' : '#ffffff',
            colorBorderSecondary: isDark ? 'rgba(139, 92, 246, 0.25)' : '#e2e8f0',
          },
          Table: {
            borderRadiusLG: 8,
            colorBgContainer: isDark ? '#111827' : '#ffffff',
            headerBg: isDark ? '#0f172a' : '#f8fafc',
            headerColor: isDark ? '#e2e8f0' : '#475569',
            rowHoverBg: isDark ? 'rgba(114, 46, 209, 0.22)' : '#f1f5f9',
            borderColor: isDark ? '#1e293b' : '#f1f5f9',
          },
          Modal: {
            borderRadiusLG: 12,
            contentBg: isDark ? '#111827' : '#ffffff',
            headerBg: isDark ? '#111827' : '#ffffff',
          },
          Drawer: {
            colorBgElevated: isDark ? '#111827' : '#ffffff',
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
 * Sets up global context providers (Theme, DeviceMode, Ant Design, Auth) and BrowserRouter.
 * Route definitions are fully delegated to RouterProvider (auto-discovered routes).
 */
export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <DeviceModeProvider>
          <AntdAppWrapper>
            <AuthProvider>
              <RouterProvider />
              <AIChatWrapper />
            </AuthProvider>
          </AntdAppWrapper>
        </DeviceModeProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;

