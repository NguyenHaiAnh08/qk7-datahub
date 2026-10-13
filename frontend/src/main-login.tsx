import React from 'react';
import ReactDOM from 'react-dom/client';
import { LoginPage } from './pages/LoginPage';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <LoginPage />
    </ThemeProvider>
  </React.StrictMode>
);
