// 构建后把 index.html 复制一份为 404.html
//
// 各平台的差异（这点很容易踩坑）：
//  - GitHub Pages / 纯静态文件服务器：没有服务端重写，只能靠 404.html 兜底
//  - Cloudflare Pages：项目里【不能】有 404.html，否则它会用 404.html 响应未知路径，
//    状态码变成 404；没有 404.html 时它会自动把未知路径回退到 index.html（200）
//  - Netlify / Vercel：走 _redirects / 配置文件里的 rewrite，也不需要 404.html
//
// 所以这里在 Cloudflare 的构建环境（CF_PAGES=1）下跳过，其余环境照常生成。
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve(process.cwd(), 'dist')
const from = resolve(dist, 'index.html')
const to = resolve(dist, '404.html')

if (process.env.CF_PAGES === '1') {
  console.log('[postbuild] 检测到 Cloudflare Pages 构建，跳过 404.html（交给平台自动回退）')
} else if (existsSync(from)) {
  copyFileSync(from, to)
  console.log('[postbuild] dist/404.html 已生成（SPA 路由回退）')
} else {
  console.warn('[postbuild] 未找到 dist/index.html，跳过')
}
