// Production route QA with generated encryption and intercepted GitHub only.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {
  pbkdf2Sync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto'
const out = process.env.QA_OUTPUT_DIR || '.qa/growth-production',
  base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173'
await fs.mkdir(out, { recursive: true })
const pw = 'qa-generated-password-not-a-user-secret',
  salt = randomBytes(16).toString('base64'),
  iter = 1000,
  key = pbkdf2Sync(pw, Buffer.from(salt, 'base64'), iter, 32, 'sha256')
const aad = (k) => `growth:${k}:v1`
function encrypt(data, kind) {
  const iv = randomBytes(12),
    c = createCipheriv('aes-256-gcm', key, iv)
  c.setAAD(Buffer.from(aad(kind)))
  const ct = Buffer.concat([
    c.update(JSON.stringify(data), 'utf8'),
    c.final(),
    c.getAuthTag(),
  ])
  return {
    v: 1,
    alg: 'AES-GCM-256',
    aad: aad(kind),
    kdf: { salt, iter, name: 'PBKDF2', hash: 'SHA-256' },
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
  }
}
function decrypt(env, kind) {
  const b = Buffer.from(env.ct, 'base64'),
    d = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'))
  d.setAAD(Buffer.from(aad(kind)))
  d.setAuthTag(b.subarray(-16))
  return JSON.parse(
    Buffer.concat([d.update(b.subarray(0, -16)), d.final()]).toString(),
  )
}
const store = {
  daily: encrypt(
    {
      v: 1,
      unknown: 'keep-root',
      days: {
        '2026-10-30': {
          date: '2026-10-30',
          tasks: [{ id: 'legacy-task', text: '原来的每日任务', done: false }],
          summary: '旧版单段学习总结',
          mood: '平静',
          custom: 'keep-day',
        },
        '2026-10-19': {
          tasks: [{ id: 'past', text: '上周一听力练习', done: true }],
          learned: '上周一的学习内容',
          stuck: '连读没听清',
          next: '再练一遍',
        },
      },
    },
    'daily',
  ),
  weekly: encrypt(
    {
      v: 1,
      weeks: {
        '2026-W43': {
          done: '旧版完成内容',
          stuck: '旧版卡点',
          next: '旧版下周计划',
          score: 4,
          custom: 'keep-week',
        },
      },
    },
    'weekly',
  ),
}
let mode = 'online',
  putCount = 0,
  conflictOnce = false,
  delayNext = false
const versions = { daily: 1, weekly: 1 },
  errors = [],
  unexpected = []
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: ['--no-sandbox'],
})
async function context(token = true) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    colorScheme: 'light',
    acceptDownloads: true,
  })
  await ctx.addInitScript(
    ({ token }) => {
      if (token) sessionStorage.setItem('moments_pat', 'qa-token-not-real')
      localStorage.setItem('blog_theme', 'light')
      localStorage.setItem('blog_palette', 'plain')
      localStorage.setItem(
        'growth-workbench-demo-v1',
        JSON.stringify({ tasks: [{ text: 'DO-NOT-IMPORT-DEMO' }] }),
      )
    },
    { token },
  )
  await ctx.route('https://api.github.com/**', async (route) => {
    const r = route.request(),
      kind = r.url().includes('daily.enc.json')
        ? 'daily'
        : r.url().includes('weekly.enc.json')
          ? 'weekly'
          : null
    if (!kind) {
      unexpected.push(r.url())
      return route.abort()
    }
    if (r.method() === 'GET')
      return route.fulfill({
        json: {
          sha: `sha-${versions[kind]}`,
          encoding: 'base64',
          content: Buffer.from(JSON.stringify(store[kind])).toString('base64'),
        },
      })
    if (r.method() !== 'PUT') {
      unexpected.push(r.method() + r.url())
      return route.abort()
    }
    putCount++
    if (
      mode === 'permission' ||
      (mode === 'weekly-permission' && kind === 'weekly')
    )
      return route.fulfill({ status: 403, json: { message: 'QA forbidden' } })
    if (conflictOnce) {
      conflictOnce = false
      const d = decrypt(store[kind], kind)
      if (kind === 'daily')
        d.days['2026-10-28'] = { learned: '并发设备新增，不可丢失' }
      store[kind] = encrypt(d, kind)
      versions[kind]++
      return route.fulfill({ status: 409, json: { message: 'QA conflict' } })
    }
    const body = r.postDataJSON()
    assert.equal(body.sha, `sha-${versions[kind]}`)
    assert.equal(body.branch, 'main')
    if (delayNext) {
      delayNext = false
      await new Promise((r) => setTimeout(r, 700))
    }
    const env = JSON.parse(Buffer.from(body.content, 'base64').toString())
    assert(!JSON.stringify(env).includes('QA_PRIVATE'))
    store[kind] = env
    versions[kind]++
    return route.fulfill({
      json: {
        content: { sha: `sha-${versions[kind]}` },
        commit: { html_url: 'https://example.test/qa-commit' },
      },
    })
  })
  await ctx.route(base + '/growth/*.enc.json?*', (route) => {
    const kind = route.request().url().includes('daily') ? 'daily' : 'weekly'
    return route.fulfill({ json: store[kind] })
  })
  return ctx
}
async function pageFor(ctx) {
  const p = await ctx.newPage()
  await p.clock.setFixedTime(new Date('2026-10-30T12:00:00Z'))
  p.on('pageerror', (e) => errors.push(e.message))
  p.on('dialog', (d) => (d.type() === 'beforeunload' ? d.accept() : d.accept()))
  return p
}
async function unlock(p) {
  await p.goto(base + '/growth')
  await p.getByPlaceholder('密码', { exact: true }).fill(pw)
  await p.getByRole('button', { name: '解锁', exact: true }).click()
  await p.getByRole('heading', { name: '今日行动', exact: true }).waitFor()
}
const nav = (p, name) =>
  p
    .getByRole('navigation', { name: '成长工作台' })
    .getByRole('button', { name, exact: false })
async function eventually(fn, label) {
  for (let n = 0; n < 100; n++) {
    if (await fn()) return
    await new Promise((r) => setTimeout(r, 150))
  }
  throw Error('Timed out: ' + label)
}
async function shot(p, name) {
  await p.waitForTimeout(350)
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'overflow ' + name,
  )
}
try {
  const ctx = await context(),
    p = await pageFor(ctx)
  await p.goto(base + '/growth')
  await p.getByPlaceholder('密码', { exact: true }).waitFor()
  await shot(p, 'desktop-gate')
  await p.getByPlaceholder('密码', { exact: true }).fill(pw)
  await p.getByRole('button', { name: '解锁', exact: true }).click()
  await p.getByRole('heading', { name: '今日行动', exact: true }).waitFor()
  assert.equal(
    await p.getByLabel('今天学了什么', { exact: true }).inputValue(),
    '旧版单段学习总结',
  )
  assert.equal(
    await p.getByText('DO-NOT-IMPORT-DEMO', { exact: true }).count(),
    0,
  )
  assert.equal(await p.getByRole('checkbox').count(), 1)
  await shot(p, 'desktop-live-daily')
  await nav(p, '长期项目').click()
  assert.equal(await p.locator('.gw-project-card').count(), 0)
  await p.getByRole('button', { name: '＋ 新建长期项目' }).click()
  await p.getByLabel('项目名称（必填）').fill('英语四级')
  await p.getByLabel('内容规划').fill('背单词、练听力')
  await p.getByRole('button', { name: '保存项目', exact: true }).click()
  await eventually(
    () => decrypt(store.daily, 'daily').projects?.length === 1,
    'encrypted project save',
  )
  const projectId = decrypt(store.daily, 'daily').projects[0].id
  await shot(p, 'desktop-live-projects')
  await nav(p, '今日行动').click()
  await p.getByLabel('调整分类：原来的每日任务').selectOption(projectId)
  await p.getByLabel('所属项目').selectOption(projectId)
  await p.getByLabel('新增行动').fill('QA_PRIVATE 背30个单词')
  await p.getByRole('button', { name: '添加', exact: true }).click()
  await p
    .getByLabel('今天学了什么', { exact: true })
    .fill('QA_PRIVATE 学习收获，仍然需要加密')
  conflictOnce = true
  await p.getByRole('button', { name: '立即保存', exact: true }).click()
  await eventually(
    () =>
      decrypt(store.daily, 'daily').days['2026-10-30'].learned?.includes(
        'QA_PRIVATE',
      ),
    'daily encrypted save',
  )
  assert.equal(
    decrypt(store.daily, 'daily').days['2026-10-28'].learned,
    '并发设备新增，不可丢失',
  )
  assert.equal(
    decrypt(store.daily, 'daily').days['2026-10-30'].custom,
    'keep-day',
  )
  assert.equal(decrypt(store.daily, 'daily').unknown, 'keep-root')
  await eventually(
    () =>
      p
        .locator('.gw-status')
        .textContent()
        .then((s) => s.includes('已加密保存到 GitHub')),
    'saved status',
  )
  const stable = putCount
  await p.waitForTimeout(2600)
  assert.equal(putCount, stable, 'no autosave loop')
  await nav(p, '每周复盘').click()
  await p.getByRole('button', { name: '查看导出内容', exact: true }).click()
  const digest = await p.getByLabel('交给 AI 的完整学习记录').inputValue()
  assert(!digest.includes('独立预览'))
  assert(digest.includes('上周一的学习内容'))
  assert.equal((digest.match(/^## \d{4}-\d{2}-\d{2}/gm) || []).length, 7)
  await p
    .getByLabel('粘贴 AI 生成的周复盘')
    .fill('# QA_PRIVATE 周复盘\n\n完成了单词复习。')
  await eventually(
    () =>
      p.evaluate(
        () => !!localStorage.getItem('growth_workbench_draft_encrypted_v1'),
      ),
    'encrypted local draft',
  )
  const disk = await p.evaluate(() =>
    JSON.stringify(Object.entries(localStorage)),
  )
  assert(!disk.includes('QA_PRIVATE'))
  assert(
    !decrypt(store.weekly, 'weekly').weeks['2026-W44'],
    'weekly draft not yet published',
  )
  await p.getByRole('button', { name: '保存本周复盘', exact: true }).click()
  await eventually(
    () => !!decrypt(store.weekly, 'weekly').weeks['2026-W44'],
    'weekly publish',
  )
  assert.equal(
    decrypt(store.weekly, 'weekly').weeks['2026-W44'].sourceWeek,
    '2026-W43',
  )
  await p.getByRole('button', { name: '阅读预览', exact: true }).click()
  await p
    .getByRole('heading', { name: 'QA_PRIVATE 周复盘', exact: true })
    .waitFor()
  await shot(p, 'desktop-live-weekly')
  await p
    .locator('.gw-week-history button')
    .filter({ hasText: '2026-W43' })
    .click()
  assert(
    (await p.getByLabel('粘贴 AI 生成的周复盘').inputValue()).includes(
      '旧版完成内容',
    ),
  )
  await p.getByLabel('粘贴 AI 生成的周复盘').fill('QA_PRIVATE 编辑旧复盘')
  await p.getByRole('button', { name: '保存本周复盘', exact: true }).click()
  await eventually(
    () =>
      decrypt(store.weekly, 'weekly').weeks['2026-W43'].text ===
      'QA_PRIVATE 编辑旧复盘',
    'legacy weekly edit',
  )
  assert.equal(decrypt(store.weekly, 'weekly').weeks['2026-W43'].score, 4)
  assert.equal(
    decrypt(store.weekly, 'weekly').weeks['2026-W43'].custom,
    'keep-week',
  )
  assert.equal(
    decrypt(store.weekly, 'weekly').weeks['2026-W43'].sourceWeek,
    '2026-W43',
  )
  await nav(p, '今日行动').click()
  mode = 'permission'
  await p
    .getByLabel('今天学了什么', { exact: true })
    .fill('QA_PRIVATE 断网草稿必须恢复')
  await p.getByRole('button', { name: '立即保存', exact: true }).click()
  await p.getByRole('alert').filter({ hasText: '没有权限' }).waitFor()
  assert(
    !decrypt(store.daily, 'daily').days['2026-10-30'].learned.includes(
      '断网草稿',
    ),
  )
  const failedCount = putCount
  await p.waitForTimeout(2300)
  assert.equal(putCount, failedCount, '403 is not blindly retried')
  assert(
    !(
      await p.evaluate(() =>
        localStorage.getItem('growth_workbench_draft_encrypted_v1'),
      )
    ).includes('QA_PRIVATE'),
  )
  await p.reload()
  await p.getByRole('heading', { name: '今日行动', exact: true }).waitFor()
  assert.equal(
    await p.getByLabel('今天学了什么', { exact: true }).inputValue(),
    'QA_PRIVATE 断网草稿必须恢复',
  )
  mode = 'online'
  await p.getByRole('button', { name: '立即保存', exact: true }).click()
  await eventually(
    () =>
      decrypt(store.daily, 'daily').days['2026-10-30'].learned ===
      'QA_PRIVATE 断网草稿必须恢复',
    'recovered encrypted draft',
  )
  // Edit during an in-flight save; the newer keystrokes must survive its response.
  delayNext = true
  await p
    .getByLabel('今天学了什么', { exact: true })
    .fill('QA_PRIVATE 保存开始')
  const startCount = putCount
  await p.getByRole('button', { name: '立即保存', exact: true }).click()
  await eventually(() => putCount > startCount, 'save started')
  await p
    .getByLabel('今天学了什么', { exact: true })
    .fill('QA_PRIVATE 保存期间的新输入')
  await eventually(
    () =>
      decrypt(store.daily, 'daily').days['2026-10-30'].learned ===
      'QA_PRIVATE 保存期间的新输入',
    'mid-save typing',
  )
  await p.setViewportSize({ width: 390, height: 844 })
  await shot(p, 'mobile-live-daily')
  await nav(p, '长期项目').click()
  await shot(p, 'mobile-live-projects')
  await nav(p, '每周复盘').click()
  await shot(p, 'mobile-live-weekly')
  await p.evaluate(async () => {
    const t = await import('/src/lib/theme.js')
    t.setTheme('dark')
  })
  await shot(p, 'mobile-live-dark')
  await p.evaluate(async () => {
    const t = await import('/src/lib/theme.js')
    t.setTheme('light')
  })
  await p.getByRole('button', { name: '锁定', exact: true }).click()
  await p.getByPlaceholder('密码', { exact: true }).waitFor()
  assert.equal(
    await p.getByText('QA_PRIVATE 保存期间的新输入', { exact: true }).count(),
    0,
  )
  await shot(p, 'mobile-gate')
  await ctx.close()
  const ro = await context(false),
    r = await pageFor(ro)
  await unlock(r)
  assert(await r.getByRole('checkbox').first().isDisabled())
  assert(
    (await r
      .getByLabel('今天学了什么', { exact: true })
      .getAttribute('readonly')) !== null,
  )
  await nav(r, '长期项目').click()
  assert(await r.getByRole('button', { name: '＋ 新建长期项目' }).isDisabled())
  await nav(r, '每周复盘').click()
  assert(await r.getByRole('button', { name: '保存本周复盘' }).isDisabled())
  assert(
    !(await r
      .getByRole('button', { name: '一键导出七天记录 .md' })
      .isDisabled()),
  )
  await shot(r, 'desktop-readonly')
  await ro.close()
  // Global replacement and plain->sage migration: keep the other palettes and dark mode.
  const theme = await context(false),
    t = await pageFor(theme)
  await t.goto(base + '/')
  await t.waitForTimeout(300)
  assert.equal(await t.locator('html').getAttribute('data-palette'), 'sage')
  assert.equal(
    await t.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--accent')
        .trim(),
    ),
    '#315f4b',
  )
  await shot(t, 'desktop-blog-sage')
  const themeButton = t.getByRole('button', { name: '外观设置', exact: true })
  await themeButton.click()
  await t.getByRole('dialog', { name: '外观设置' }).waitFor()
  assert.equal(
    await t.getByRole('button', { name: '纯白', exact: true }).count(),
    0,
  )
  await t.getByRole('button', { name: '灰绿', exact: true }).click()
  assert.equal(
    await t
      .getByRole('button', { name: '灰绿', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  )
  await shot(t, 'desktop-theme-panel')
  await t.getByRole('button', { name: '深色', exact: true }).click()
  await shot(t, 'desktop-blog-dark')
  await t.keyboard.press('Escape')
  await t.setViewportSize({ width: 390, height: 844 })
  await t.evaluate(async () => {
    const th = await import('/src/lib/theme.js')
    th.setTheme('light')
  })
  await shot(t, 'mobile-blog-sage')
  await theme.close()
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
  console.log(
    'PASS production vault: unlock/read-only, legacy summaries+weekly scores, projects/categories, genuine AES ciphertext writes, 409 re-read, 403 no retry, encrypted local recovery, mid-save edits, no preview import, no autosave loop, locking, mobile/dark, plain→sage theme',
  )
} catch (e) {
  console.error('PAGE_ERRORS', errors)
  for(const ctx of browser.contexts())for(const page of ctx.pages()){try{console.error('PAGE_TEXT',(await page.locator('body').innerText()).slice(0,3500));await page.screenshot({path:out+'/failure.png',fullPage:true})}catch{}}
  console.error(e)
  throw e
} finally {
  await browser.close()
}
