import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 静态托管可能是域名根路径，也可能挂在子路径下 —— 用相对路径两头都能跑
  base: './',
  server: {
    host: true, // 监听 0.0.0.0，允许局域网通过本机 IP 访问
    port: 5274,
    strictPort: true,
  },
  build: { target: 'es2020', chunkSizeWarningLimit: 1600 },
})
