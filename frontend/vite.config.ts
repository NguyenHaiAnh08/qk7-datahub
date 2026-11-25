import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Tự động phát hiện backend đang chạy HTTPS hay HTTP từ backend/.env hoặc process.env
function detectBackendTargets(): { httpTarget: string; wsTarget: string } {
  let isHttps = process.env.USE_HTTPS === 'true';
  try {
    const envPath = resolve(__dirname, '../backend/.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/^USE_HTTPS\s*=\s*(true|false)/mi);
      if (match) {
        isHttps = match[1].toLowerCase() === 'true';
      }
    }
  } catch (_) {}

  const port = process.env.PORT || '8000';
  return {
    httpTarget: isHttps ? `https://localhost:${port}` : `http://localhost:${port}`,
    wsTarget: isHttps ? `wss://localhost:${port}` : `ws://localhost:${port}`,
  };
}

const { httpTarget, wsTarget } = detectBackendTargets();

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
        target: httpTarget,
        changeOrigin: true,
        secure: false,         
      },
      '/uploads': {
        target: httpTarget,
        changeOrigin: true,
        secure: false,     
      },
      '/ws': {
        target: wsTarget,
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
          'vendor-pdfjs': ['pdfjs-dist'],
        },
      },
    },
  },
});
