import React from 'react';
import ReactDOM from 'react-dom/client';
import { PortalPage } from './pages/PortalPage';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <PortalPage />
    </ThemeProvider>
  </React.StrictMode>
);
