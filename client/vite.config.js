import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Esto es para que Vite ignore las etiquetas de Vidstack en el escaneo inicial
  optimizeDeps: {
    exclude: ['@vidstack/react']
  }
})