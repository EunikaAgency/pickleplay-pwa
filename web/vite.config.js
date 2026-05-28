import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['pickleballer.eunika.xyz', '.eunika.xyz'],
  },
  preview: {
    allowedHosts: ['pickleballer.eunika.xyz', '.eunika.xyz'],
  },
})
