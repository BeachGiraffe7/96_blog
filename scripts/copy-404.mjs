// 构建后把 index.html 复制一份为 404.html
// GitHub Pages / 部分静态托管在找不到路径时会回退到 404.html，
// 有了它，直接访问 /post/xxx 这种前端路由才不会 404。
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve(process.cwd(), 'dist')
const from = resolve(dist, 'index.html')
const to = resolve(dist, '404.html')

if (existsSync(from)) {
  copyFileSync(from, to)
  console.log('[postbuild] dist/404.html 已生成（SPA 路由回退）')
} else {
  console.warn('[postbuild] 未找到 dist/index.html，跳过')
}
