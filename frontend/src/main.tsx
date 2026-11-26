import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installPerfRecorder } from './utils/perfRecorder';

// Bắt đầu đo trước khi dựng giao diện để ghi được cả quá trình tải trang
installPerfRecorder();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
