import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { posts, categories, site } from '../data/posts'

const setMeta = (name, content) => {
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

const setCanonical = (href) => {
  let el = document.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

// 私密页需要 noindex；离开时把标签移除，避免污染其它页面
const setRobots = (content) => {
  const existing = document.querySelector('meta[name="robots"]')
  if (!content) {
    if (existing) existing.remove()
    return
  }
  const el = existing || document.createElement('meta')
  el.setAttribute('name', 'robots')
  el.setAttribute('content', content)
  if (!existing) document.head.appendChild(el)
}

// 构建时已经把 meta 写进每个页面的 HTML（给爬虫看），
// 这里负责浏览器内跳转时同步标题，不然标签页永远停在首页标题。
export default function RouteMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const base = site.siteUrl.replace(/\/$/, '')
    let title = `${site.name} · ${site.tagline}`
    let desc = site.bio

    if (pathname.startsWith('/post/')) {
      const slug = decodeURIComponent(pathname.replace('/post/', ''))
      const post = posts.find((p) => p.slug === slug)
      if (post) {
        title = `${post.title} · ${site.name}`
        desc = post.excerpt
      }
    } else if (pathname.startsWith('/category/')) {
      const name = decodeURIComponent(pathname.replace('/category/', ''))
      const cat = categories.find((c) => c.name === name)
      title = `${cat ? cat.name : '分类'} · ${site.name}`
      desc = `「${name}」分类下的文章。`
    } else if (pathname.startsWith('/tag/')) {
      const name = decodeURIComponent(pathname.replace('/tag/', ''))
      title = `#${name} · ${site.name}`
      desc = `标签「${name}」下的文章。`
    } else if (pathname === '/moments') {
      title = `碎碎念 · ${site.name}`
      desc = '不够长、但值得记下来的想法。'
    } else if (pathname === '/archive') {
      title = `归档 · ${site.name}`
      desc = '按时间顺序浏览全部文章。'
    } else if (pathname === '/categories') {
      title = `分类 · ${site.name}`
      desc = '按主题归类的文章与系列。'
    } else if (pathname === '/tags') {
      title = `标签 · ${site.name}`
      desc = '用标签把这些零散的记录串起来。'
    } else if (pathname === '/about') {
      title = `关于 · ${site.name}`
      desc = site.bio
    } else if (pathname === '/write') {
      title = `写一条 · ${site.name}`
      desc = '发布碎碎念的编辑页。'
    } else if (pathname === '/growth') {
      title = `成长 · ${site.name}`
      desc = ''
    }

    document.title = title
    setMeta('description', desc)
    setRobots(pathname === '/write' || pathname === '/growth' ? 'noindex, nofollow' : '')
    setCanonical(`${base}${pathname === '/' ? '/' : pathname}`)
  }, [pathname])

  return null
}
