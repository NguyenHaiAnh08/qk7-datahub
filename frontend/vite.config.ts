import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://localhost:8000',
        changeOrigin: true,
        secure: false,         
      },
      '/uploads': {
        target: 'https://localhost:8000',
        changeOrigin: true,
        secure: false,     
      },
      '/ws': {
        target: 'wss://localhost:8000',
        ws: true,
        changeOrigin: true,
        secure: false,          
      },
    },
  },
  build: {
    outDir: resolve(__dirname, '../backend/public'),
    emptyOutDir: true,
  },
});