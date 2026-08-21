import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-ui':     ['react-hot-toast', '@heroicons/react'],
          'vendor-jspdf':  ['jspdf'],
          'vendor-canvas': ['html2canvas'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
