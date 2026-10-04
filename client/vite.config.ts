import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend target for the dev proxy (override with VITE_PROXY_TARGET)
const target = process.env.VITE_PROXY_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on LAN so a phone can open http://<PC-IP>:3000
    port: 3000,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/uploads': { target, changeOrigin: true },
      '/socket.io': { target, ws: true, changeOrigin: true }
    }
  },
  preview: { host: true, port: 3000 }
});
