import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    pure: ['console.log', 'console.info', 'console.debug', 'console.warn'],
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,         
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,     
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
        secure: false,          
      },
    },
  },
  build: {
    outDir: resolve(__dirname, '../backend/public'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-excel': ['exceljs'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react'],
          'vendor-pdflib': ['pdf-lib'],
        },
      },
    },
  },
});
