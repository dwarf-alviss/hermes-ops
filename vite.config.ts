import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: https://dwarf-alviss.github.io/hermes-ops/
export default defineConfig({
  base: '/hermes-ops/',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
})
