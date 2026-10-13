import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AdminDashboardPage />
    </ThemeProvider>
  </React.StrictMode>
);
