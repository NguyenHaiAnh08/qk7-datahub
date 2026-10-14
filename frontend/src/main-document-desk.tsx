import React from 'react';
import ReactDOM from 'react-dom/client';
import { DocumentDeskPage } from './pages/DocumentDeskPage';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <DocumentDeskPage />
    </ThemeProvider>
  </React.StrictMode>
);
