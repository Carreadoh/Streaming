import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  optimizeDeps: {
    exclude: ['@vidstack/react']
  },

  build: {
    rollupOptions: {
      // Marcamos los plugins de Capacitor como externos para que Vercel no falle al compilar
      external: [
        '@capacitor/status-bar',
        '@capacitor/screen-orientation'
      ]
    }
  }
})