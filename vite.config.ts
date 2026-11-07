import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the build works both on a custom domain and under /<repo>/ on GitHub Pages.
  base: './',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1300 }, // three.js lives in the lazy Viewer chunk
  // the build's version, shown in the settings, so a player can tell whether they have the latest one
  define: {
    'import.meta.env.VITE_BUILD': JSON.stringify(
      `${(process.env.GITHUB_SHA ?? 'local').slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    ),
  },
})
