import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    open: false,
    // En modo dev, Vite redirige /api y Socket.io al servidor Express
    // embebido en Electron (puerto 3005) para que el frontend funcione
    // sin cambiar ninguna URL entre dev y producción.
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        ws: true
      }
    }
  }
})