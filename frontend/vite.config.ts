import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: resolve(__dirname, '../public'),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        admin: resolve(__dirname, 'admin-dashboard.html'),
        desk: resolve(__dirname, 'document-desk.html'),
        portal: resolve(__dirname, 'portal.html'),
        // Backward compatibility entries
        legacyLogin: resolve(__dirname, 'qk7_datahub_login_page.html'),
        legacyAdmin: resolve(__dirname, 'qk7_datahub_admin_dashboard.html'),
        legacyPortal: resolve(__dirname, 'qk7_datahub_portal.html'),
      }
    }
  }
});
