import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 本地开发约定：
// - 前端固定 5173 端口（与 Lark 开放平台重定向 URL 白名单字符串完全一致）
//   生产：https://admin.oddfi.io/auth/lark/callback
//   开发：http://localhost:5173/auth/lark/callback
// - strictPort：端口被占直接报错，避免 Vite 静默 fallback 导致 OAuth redirect_uri 不匹配
// - dev 代理：/auth 和 /admin 走后端。默认本地 :8081；
//   联调时可临时指向线上：VITE_PROXY_TARGET=https://admin.oddfi.io pnpm dev
//   （prod URL 不写死进文件，避免误把开发默认指向生产）
//
// 详细背景见 README.md「与后端的关系」一节。
// https://vite.dev/config/
const PROXY_TARGET = process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8081'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // changeOrigin/secure 让指向线上 https 时 Host 与证书都对得上；指本地时无副作用
      '/auth': { target: PROXY_TARGET, changeOrigin: true, secure: true },
      '/admin': { target: PROXY_TARGET, changeOrigin: true, secure: true },
    },
  },
})
