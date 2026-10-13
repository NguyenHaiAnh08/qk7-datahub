import React from 'react';
import ReactDOM from 'react-dom/client';
import { PortalPage } from './pages/PortalPage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PortalPage />
  </React.StrictMode>
);
