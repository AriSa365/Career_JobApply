import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative assets make the same build work on a GitHub Pages project site.
  base: './',
})
