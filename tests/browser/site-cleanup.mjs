const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const out = process.env.QA_OUTPUT_DIR || '/data/site-cleanup-qa'
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173'
await fs.mkdir(out, {recursive:true})
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox']})
const errors=[]
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'})
 await context.addInitScript(()=>{localStorage.setItem('blog_palette','sage');localStorage.setItem('blog_theme','light')})
 const page=await context.newPage()
 page.on('pageerror',e=>errors.push(e.message))
 async function shot(name,fullPage=true) {
  await page.waitForTimeout(400)
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow: '+name)
  await page.screenshot({path:`${out}/${name}.png`,fullPage})
 }
 await page.goto(base+'/about')
 await page.locator('.about-intro h1').waitFor()
 await page.evaluate(()=>document.fonts.ready)
 assert.equal(await page.locator('.about-start time').getAttribute('datetime'),'2026-10-28')
 assert.equal(await page.locator('.about-entry').count(),3)
 assert.equal(await page.locator('.shell-about > .col-left').isVisible(),false)
 assert.equal(await page.locator('.shell-about > .col-right').isVisible(),false)
 const text=await page.locator('.about-journal').innerText()
 for(const untrue of ['2025-06','串级 PID 调通','正在调循迹环','现在在做','学习轨迹','hi@example.com'])assert(!text.includes(untrue))
 assert.equal(await page.locator('.about-entry[href="/growth"]').getByText('私密',{exact:true}).count(),1)
 await shot('about-desktop-light')
 await page.setViewportSize({width:390,height:844})
 await shot('about-mobile-light')
 await page.evaluate(async()=>{const theme=await import('/src/lib/theme.js');theme.setTheme('dark')})
 await shot('about-mobile-dark')
 await page.setViewportSize({width:1440,height:1000})
 await shot('about-desktop-dark')
 await page.evaluate(async()=>{const theme=await import('/src/lib/theme.js');theme.setTheme('light')})
 await page.goto(base+'/')
 await page.locator('.post-list').waitFor()
 assert.equal(await page.locator('.main-nav a[href="/tags"]').count(),0)
 assert.equal(await page.locator('.post-tags').count(),0)
 assert.equal(await page.locator('.col-right a[href="/tags"]').count(),0)
 assert.equal(await page.locator('.post-card').count(),10)
 await shot('home-desktop-light')
 await page.setViewportSize({width:390,height:844})
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}))
 await shot('home-mobile-light')
 await page.goto(base+'/post/why-blog')
 await page.getByText('文章不见了',{exact:false}).waitFor({timeout:5000}).catch(()=>{})
 assert.equal(await page.locator('.article-content, .post-title').count(),0)
 for(const slug of ['clean-code-reread','rss-note','3am-bug','vite-speed','ai-coding','october-note']){
  await page.goto(base+'/post/'+slug)
  assert.equal(await page.locator('.post-title').count(),0)
 }
 assert.deepEqual(errors,[])
 console.log('PASS site cleanup: truthful launch date, about desktop/mobile light/dark, no homepage tag UI, 10 retained posts, seven retired examples unavailable, no JS errors/overflow')
 await context.close()
} finally { await browser.close() }
