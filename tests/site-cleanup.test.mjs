import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
after(()=>server.close())
const data=await server.ssrLoadModule('/src/data/posts.js')
const retired=['clean-code-reread','rss-note','3am-bug','vite-speed','ai-coding','october-note','why-blog']
test('只删除用户确认的七篇已下线示例，其余原始笔记和网页文章保留',()=>{
 assert.deepEqual(data.hiddenSlugs,[])
 for(const slug of retired)assert(!data.allPosts.some(p=>p.slug===slug))
 for(const slug of ['lecture-00','lecture-01-clock-gpio','lecture-02-uart-dma','lecture-03-timer-adc-dac','lecture-04-gray','lecture-05-pwm-motor','lecture-06-pid','git-github-desktop','post-20261030-05b9p','stm32-clock-notes'])assert(data.posts.some(p=>p.slug===slug),slug)
 // Another live article may have arrived while this branch was being prepared.
 assert(data.posts.length>=10)
})
test('上线时间按真实日期，去除虚构轨迹和占位联系方式',()=>{
 assert.equal(data.site.since,'2026-10-28')
 assert(!('timeline' in data))
 assert(data.site.links.every(l=>!l.href.includes('example.com') && l.href!=='https://www.douyin.com'))
})
test('成长日历取消独立吸顶，防止滚动遮挡其他卡片',async()=>{
 const css=await readFile(new URL('../src/styles/growth-preview.css',import.meta.url),'utf8')
 assert.match(css,/\.gw-live \.cal-card\s*\{[^}]*position:\s*static/s)
})
