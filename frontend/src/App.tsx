import React from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { DeviceModeProvider } from './contexts/DeviceModeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RouterProvider } from './routes/RouterProvider';
import { HttpErrorListener } from './components/common/HttpErrorListener';
import { ApprovalListener } from './components/common/ApprovalListener';
import { ToastProvider } from './components/common/Toast';
import { NetworkStatusProvider } from './contexts/NetworkStatusContext';
<<<<<<< HEAD
import AIChatWidget from './components/ai-chat/AIChatWidget';
import { ApprovalProvider } from './contexts/ApprovalContext';
=======
import { AIChatProvider } from './contexts/AIChatContext';
import AIChatDrawer from './components/ai-chat/AIChatDrawer';
>>>>>>> cf233fdbc97b0a7292ffcaa92451fc02aabe6508
import './index.css';


/**
 * Wrapper đồng bộ Theme (Dark/Light) và Cấu hình Token Ant Design toàn diện
 * - Màu action chính: Xanh Lục Quân (#166534 / #10b981) & Vàng Kim Quân Hiệu (#b45309 / #fbbf24)
 * - Nền tối chuẩn Quân sự SOC: #090e17 (Base), #111827 (Surface/Card/Table)
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
          colorPrimary: isDark ? '#10b981' : '#166534', // Xanh Lục Quân chuẩn Quân đội Nhân dân VN
          colorPrimaryHover: isDark ? '#059669' : '#14532d',
          colorPrimaryActive: isDark ? '#047857' : '#15803d',
          colorLink: isDark ? '#34d399' : '#166534',
          colorLinkHover: isDark ? '#6ee7b7' : '#15803d',
          borderRadius: 8,
          fontFamily: `'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
          // Phân lớp bề mặt Dark/Light Mode chuẩn Quân đội & SOC
          ...(isDark
            ? {
                colorBgBase: '#090e17',
                colorBgContainer: '#111827',
                colorBgElevated: '#1e293b',
                colorBgLayout: '#090e17',
                colorTextBase: '#f1f5f9',
                colorTextSecondary: '#94a3b8',
                colorBorder: 'rgba(16, 185, 129, 0.2)',
                colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
              }
            : {
                colorBgBase: '#f8fafc',
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
            primaryShadow: isDark ? '0 4px 12px rgba(16, 185, 129, 0.25)' : '0 4px 12px rgba(22, 101, 52, 0.25)',
          },
          Input: {
            controlHeight: 38,
            borderRadius: 8,
            colorBgContainer: isDark ? '#111827' : '#ffffff',
            colorBorder: isDark ? 'rgba(16, 185, 129, 0.3)' : '#cbd5e1',
          },
          Select: {
            controlHeight: 38,
            borderRadius: 8,
            colorBgContainer: isDark ? '#111827' : '#ffffff',
            colorBorder: isDark ? 'rgba(16, 185, 129, 0.3)' : '#cbd5e1',
          },
          TreeSelect: {
            controlHeight: 38,
            borderRadius: 12,
            colorBgContainer: isDark ? '#111827' : '#ffffff',
          },
          Card: {
            borderRadiusLG: 12,
            colorBgContainer: isDark ? '#111827' : '#ffffff',
            colorBorderSecondary: isDark ? 'rgba(16, 185, 129, 0.2)' : '#e2e8f0',
          },
          Table: {
            borderRadiusLG: 8,
            colorBgContainer: isDark ? '#111827' : '#ffffff',
            headerBg: isDark ? '#0f172a' : '#f8fafc',
            headerColor: isDark ? '#e2e8f0' : '#475569',
            rowHoverBg: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(22, 101, 52, 0.06)',
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
        <ApprovalListener />
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

  return <AIChatDrawer />;
};

/**
 * Root Application Component
 * Sets up global context providers (Theme, DeviceMode, Ant Design, Auth, AIChat) and BrowserRouter.
 * Route definitions are fully delegated to RouterProvider (auto-discovered routes).
 */
export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <DeviceModeProvider>
          <AntdAppWrapper>
            <ToastProvider>
              <NetworkStatusProvider>
                <AuthProvider>
<<<<<<< HEAD
                  <ApprovalProvider pollMs={30000}>
                    <RouterProvider />
                    <AIChatWrapper />
                  </ApprovalProvider>
=======
                  <AIChatProvider>
                    <RouterProvider />
                    <AIChatWrapper />
                  </AIChatProvider>
>>>>>>> cf233fdbc97b0a7292ffcaa92451fc02aabe6508
                </AuthProvider>
              </NetworkStatusProvider>
            </ToastProvider>
          </AntdAppWrapper>
        </DeviceModeProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;

