import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['openscad-wasm']
  },
  assetsInclude: ['**/*.wasm'],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Three.js and related libraries into separate chunk
          'three-vendor': ['three', 'three-stdlib', '@react-three/fiber', '@react-three/drei']
          // Note: React 19 handles its own chunking; manual splitting produces empty chunks
        }
      }
    }
  }
})
