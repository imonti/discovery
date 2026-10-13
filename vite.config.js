import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        bones: path.resolve(__dirname, 'bones/index.html'),
        valley: path.resolve(__dirname, 'valley/index.html'),
        noise: path.resolve(__dirname, 'noise/index.html'),
        tsl: path.resolve(__dirname, 'tsl/index.html'),
        shadows: path.resolve(__dirname, 'shadows/index.html'),
      },
    },
  },
})
