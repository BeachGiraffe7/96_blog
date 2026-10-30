// 构建后生成：分享封面图、每页静态 meta、sitemap、robots、RSS
// 目的：微信/抖音等不执行 JS 的抓取器也能拿到标题、摘要、封面；
//      搜索引擎和订阅器有入口（sitemap / feed）。
import { createServer } from 'vite'
import sharp from 'sharp'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DIST = path.join(ROOT, 'dist')

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// 中文按 1 个字宽、西文按 0.52 估算，用于标题折行
const textWidth = (s) => [...s].reduce((w, ch) => w + (/[\x00-\xff]/.test(ch) ? 0.52 : 1), 0)

function wrapTitle(title, maxUnits = 17, maxLines = 3) {
  const chars = [...title]
  const lines = []
  let cur = ''
  let w = 0
  let i = 0

  while (i < chars.length && lines.length < maxLines) {
    const ch = chars[i]
    const cw = /[\x00-\xff]/.test(ch) ? 0.52 : 1
    if (w + cw > maxUnits && cur) {
      lines.push(cur)
      cur = ''
      w = 0
      continue
    }
    cur += ch
    w += cw
    i++
  }
  if (cur) lines.push(cur)

  if (i < chars.length) {
    let last = lines[lines.length - 1]
    while (textWidth(last) > maxUnits - 1 && last.length > 1) last = last.slice(0, -1)
    lines[lines.length - 1] = last + '…'
  }
  return lines
}

function cardSvg({ brand, title, slogan, chip, meta, host }) {
  const lines = title ? wrapTitle(title) : []
  const titleBlock = title
    ? lines
        .map(
          (l, i) =>
            `<text x="88" y="${268 + i * 84}" font-size="58" font-weight="700" fill="#263445">${esc(l)}</text>`,
        )
        .join('')
    : `<text x="88" y="286" font-size="88" font-weight="700" fill="#263445">${esc(slogan || '')}</text>`

  const chipWidth = chip ? 26 + textWidth(chip) * 24 : 0
  const chipEl = chip
    ? `<rect x="88" y="486" width="${chipWidth}" height="46" rx="23" fill="#ffffff" fill-opacity="0.72"/>
       <text x="${88 + chipWidth / 2}" y="518" text-anchor="middle" font-size="24" fill="#2a5578">${esc(chip)}</text>`
    : ''
  const metaX = chip ? 88 + chipWidth + 22 : 88

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="38%" stop-color="#eef3f8"/>
      <stop offset="72%" stop-color="#dbe6f0"/>
      <stop offset="100%" stop-color="#cfdae8"/>
    </linearGradient>
    <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.7" fill="#9db8d0" fill-opacity="0.35"/>
    </pattern>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <circle cx="1030" cy="520" r="330" fill="url(#glow)"/>

  <rect x="88" y="78" width="5" height="26" rx="2.5" fill="#356a9a"/>
  <text x="106" y="100" font-size="26" fill="#4a5c6e" letter-spacing="1">${esc(brand)}</text>

  ${titleBlock}
  ${chipEl}
  <text x="${metaX}" y="518" font-size="24" fill="#76879a">${esc(meta || '')}</text>
  <text x="1112" y="588" text-anchor="end" font-size="20" fill="#9aabb9" fill-opacity="0.9">${esc(host)}</text>
</svg>`
}

const FONT = "Microsoft YaHei, PingFang SC, Noto Sans CJK SC, Source Han Sans SC, sans-serif"

async function main() {
  // 用 Vite 的 SSR 加载器读真实数据（能处理 .md?raw），避免复制一份配置
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })
  const mod = await server.ssrLoadModule('/src/data/posts.js')
  await server.close()

  const { posts, categories, site, moments, allTags, series = [], seriesCount = () => 0 } = mod
  // 站点按时间倒序展示，feed / sitemap 也保持一致
  const newest = [...posts].sort((a, b) => b.date.localeCompare(a.date))
  const base = (process.env.SITE_URL || site.siteUrl || 'https://96-blog.pages.dev').replace(/\/$/, '')
  const host = base.replace(/^https?:\/\//, '')
  const template = await readFile(path.join(DIST, 'index.html'), 'utf8')
  const ogDir = path.join(DIST, 'og')
  await mkdir(ogDir, { recursive: true })

  // ---------- 1. 分享封面 ----------
  const renderCard = async (file, opts) => {
    const svg = cardSvg({ brand: site.name, host, ...opts }).replace(
      /font-size=/g,
      `font-family="${FONT}" font-size=`,
    )
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(ogDir, file))
  }

  await renderCard('default.png', {
    title: '',
    slogan: site.tagline,
    chip: '',
    meta: site.bio.length > 24 ? site.bio.slice(0, 24) + '…' : site.bio,
  })

  for (const p of posts) {
    await renderCard(`${p.slug}.png`, {
      title: p.title,
      chip: p.category,
      meta: p.date,
    })
  }

  // ---------- 2. 每页静态 HTML ----------
  const seo = ({ title, description, url, image, type = 'website', extra = '' }) =>
    [
      `<meta name="description" content="${esc(description)}" />`,
      `<link rel="canonical" href="${url}" />`,
      `<meta property="og:type" content="${type}" />`,
      `<meta property="og:site_name" content="${esc(site.name)}" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(description)}" />`,
      `<meta property="og:url" content="${url}" />`,
      `<meta property="og:image" content="${image}" />`,
      `<meta property="og:locale" content="zh_CN" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      `<meta name="twitter:description" content="${esc(description)}" />`,
      `<meta name="twitter:image" content="${image}" />`,
      extra,
    ]
      .filter(Boolean)
      .join('\n    ')

  const jsonLd = (obj) =>
    `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`

  const writePage = async (route, html) => {
    const dir = route ? path.join(DIST, route) : DIST
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), html, 'utf8')
  }

  const build = (route, meta) =>
    template
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
      .replace('<!--seo-->', seo(meta))

  // 首页
  await writePage('', build('', {
    title: `${site.name} · ${site.tagline}`,
    description: site.bio,
    url: `${base}/`,
    image: `${base}/og/default.png`,
    extra: jsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.name,
      url: `${base}/`,
      description: site.bio,
      author: { '@type': 'Person', name: site.author },
    }),
  }))

  // 文章页
  for (const p of posts) {
    const url = `${base}/post/${p.slug}`
    await writePage(`post/${p.slug}`, build(`post/${p.slug}`, {
      title: `${p.title} · ${site.name}`,
      description: p.excerpt,
      url,
      image: `${base}/og/${p.slug}.png`,
      type: 'article',
      extra: [
        `<meta property="article:published_time" content="${p.date}" />`,
        p.tags.map((t) => `<meta property="article:tag" content="${esc(t)}" />`).join('\n    '),
        jsonLd({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: p.title,
          description: p.excerpt,
          datePublished: p.date,
          url,
          image: `${base}/og/${p.slug}.png`,
          articleSection: p.category,
          keywords: p.tags.join(','),
          author: { '@type': 'Person', name: site.author },
          publisher: { '@type': 'Person', name: site.author },
          mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        }),
      ].join('\n    '),
    }))
  }

  // 其余页面
  const pages = [
    { route: 'archive', title: '归档', desc: '按时间顺序浏览全部文章。' },
    { route: 'categories', title: '分类', desc: '按主题归类的文章与系列。' },
    { route: 'tags', title: '标签', desc: '用标签把这些零散的记录串起来。' },
    { route: 'moments', title: '碎碎念', desc: `不够长、但值得记下来的想法，目前 ${moments.length} 条。` },
    { route: 'about', title: '关于', desc: site.bio },
  ]

  for (const pg of pages) {
    await writePage(pg.route, build(pg.route, {
      title: `${pg.title} · ${site.name}`,
      description: pg.desc,
      url: `${base}/${pg.route}`,
      image: `${base}/og/default.png`,
    }))
  }

  // 分类页（目录用解码后的名字，否则服务器按编码后的路径找不到文件）
  for (const c of categories) {
    const count = posts.filter((p) => p.category === c.name).length
    const urlPath = `category/${encodeURIComponent(c.name)}`
    await writePage(`category/${c.name}`, build(urlPath, {
      title: `${c.name} · ${site.name}`,
      description: `「${c.name}」分类下共 ${count} 篇文章。`,
      url: `${base}/${urlPath}`,
      image: `${base}/og/default.png`,
      extra: jsonLd({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${c.name} · ${site.name}`,
        url: `${base}/${urlPath}`,
      }),
    }))
  }

  // 系列页：只给有文章的系列生成，空系列不占收录位
  const liveSeries = series.filter((x) => seriesCount(x.name) > 0)
  for (const x of liveSeries) {
    const count = seriesCount(x.name)
    const urlPath = `series/${encodeURIComponent(x.name)}`
    await writePage(`series/${x.name}`, build(urlPath, {
      title: `${x.name} · ${site.name}`,
      description: `${x.desc}（${count} 篇）`,
      url: `${base}/${urlPath}`,
      image: `${base}/og/default.png`,
      extra: jsonLd({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${x.name} · ${site.name}`,
        url: `${base}/${urlPath}`,
      }),
    }))
  }

  // 标签页
  const tags = allTags()
  for (const t of tags) {
    const count = posts.filter((p) => p.tags.includes(t.name)).length
    const urlPath = `tag/${encodeURIComponent(t.name)}`
    await writePage(`tag/${t.name}`, build(urlPath, {
      title: `#${t.name} · ${site.name}`,
      description: `标签「${t.name}」下共 ${count} 篇文章。`,
      url: `${base}/${urlPath}`,
      image: `${base}/og/default.png`,
      extra: jsonLd({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `#${t.name} · ${site.name}`,
        url: `${base}/${urlPath}`,
      }),
    }))
  }

  // 写作页：不让搜索引擎收录
  await writePage('write', build('write', {
    title: `写一条 · ${site.name}`,
    description: '发布碎碎念的编辑页。',
    url: `${base}/write`,
    image: `${base}/og/default.png`,
    extra: '<meta name="robots" content="noindex, nofollow" />',
  }))

  // 成长专栏：私密页，不收录、不进 sitemap / feed、不生成分享封面
  await writePage('growth', build('growth', {
    title: `成长 · ${site.name}`,
    description: '私密记录。',
    url: `${base}/growth`,
    image: `${base}/og/default.png`,
    extra: '<meta name="robots" content="noindex, nofollow" />',
  }))

  // 独立交互预览：只有示例数据，不纳入站点索引。
  await writePage('growth-preview', build('growth-preview', {
    title: `成长工作台预览 · ${site.name}`,
    description: '独立设计预览，全部为示例数据。',
    url: `${base}/growth-preview`,
    image: `${base}/og/default.png`,
    extra: '<meta name="robots" content="noindex, nofollow" />',
  }))

  // ---------- 3. sitemap / robots / RSS ----------
  const urls = [
    { loc: `${base}/`, lastmod: newest[0]?.date },
    ...newest.map((p) => ({ loc: `${base}/post/${p.slug}`, lastmod: p.date })),
    { loc: `${base}/moments`, lastmod: moments.map((m) => m.date).sort().pop() },
    { loc: `${base}/archive`, lastmod: newest[0]?.date },
    { loc: `${base}/categories` },
    { loc: `${base}/tags` },
    { loc: `${base}/about` },
    ...categories.map((c) => ({ loc: `${base}/category/${encodeURIComponent(c.name)}` })),
    ...liveSeries.map((x) => ({ loc: `${base}/series/${encodeURIComponent(x.name)}` })),
    ...tags.map((t) => ({ loc: `${base}/tag/${encodeURIComponent(t.name)}` })),
  ]

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${esc(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n  </url>`,
  )
  .join('\n')}
</urlset>
`
  await writeFile(path.join(DIST, 'sitemap.xml'), sitemap, 'utf8')

  await writeFile(
    path.join(DIST, 'robots.txt'),
    `User-agent: *\nDisallow: /write\nDisallow: /growth\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`,
    'utf8',
  )

  const rfc822 = (d) => new Date(`${d}T09:00:00+08:00`).toUTCString()
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(site.name)}</title>
    <link>${base}/</link>
    <description>${esc(site.bio)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />
${newest
  .slice(0, 20)
  .map(
    (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${base}/post/${p.slug}</link>
      <guid isPermaLink="true">${base}/post/${p.slug}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <category>${esc(p.category)}</category>
      <description>${esc(p.excerpt)}</description>
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>
`
  await writeFile(path.join(DIST, 'feed.xml'), feed, 'utf8')

  console.log(
    `[seo] 生成 ${posts.length + 1} 张封面、${urls.length} 条 sitemap、feed.xml、robots.txt、${
      posts.length + pages.length + categories.length + tags.length + liveSeries.length + 3
    } 个页面 meta`,
  )
}

main().catch((err) => {
  console.error('[seo] 失败：', err)
  process.exit(1)
})
