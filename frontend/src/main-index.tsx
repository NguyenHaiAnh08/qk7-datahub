import React from 'react';
import ReactDOM from 'react-dom/client';
import { DocumentDeskPage } from './pages/DocumentDeskPage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DocumentDeskPage />
  </React.StrictMode>
);
