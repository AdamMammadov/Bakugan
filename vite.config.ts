import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the build works both on a custom domain and under /<repo>/ on GitHub Pages.
  base: './',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1300 }, // three.js lives in the lazy Viewer chunk
})
