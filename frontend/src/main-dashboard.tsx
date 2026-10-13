import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AdminDashboardPage />
  </React.StrictMode>
);
