import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE 用于部署到子路径：
//   GitHub Pages（仓库名 96_blog）→ BASE=/96_blog/ npm run build
//   自有域名 / Vercel / Netlify 根路径 → 不用设置
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE || '/',
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: (process.env.DEV_ALLOWED_HOSTS || '').split(',').filter(Boolean),
    open: false,
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
    allowedHosts: (process.env.DEV_ALLOWED_HOSTS || '').split(',').filter(Boolean),
  },
  build: {
    rollupOptions: {
      output: {
        // 框架单独成块：升级文章内容时不会让 react 的缓存失效
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
