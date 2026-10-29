import { useEffect, useState } from 'react'
import { Icon } from './Icons'

// 文章右侧目录：跟随滚动高亮当前小节
export default function TocCard({ items }) {
  const [active, setActive] = useState(items[0]?.id || '')

  useEffect(() => {
    if (!items.length) return undefined

    const compute = () => {
      const anchor = 110 // 视口顶部往下这么多像素以内的最后一个标题，就是「当前小节」
      let current = items[0].id
      for (const item of items) {
        const el = document.getElementById(item.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= anchor) current = item.id
        else break
      }
      setActive((prev) => (prev === current ? prev : current))
    }

    // 用定时器节流而不是 requestAnimationFrame：
    // rAF 在后台标签页、离屏 iframe 里会被完全暂停，目录高亮就再也不更新了
    let timer = 0
    const onScroll = () => {
      if (timer) return
      timer = window.setTimeout(() => {
        timer = 0
        compute()
      }, 60)
    }

    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [items])

  const jump = (e, id) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return

    // 点了就先亮起来，不等滚动事件
    setActive(id)

    // 偏移交给 CSS 的 scroll-margin-top，别在这里再硬编码一次头部高度
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const from = window.scrollY
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    if (history.replaceState) history.replaceState(null, '', `#${id}`)

    // 兜底：省电模式、无头浏览器等环境不会执行平滑动画，
    // 160ms 后还纹丝不动就直接跳，避免「点了没反应」
    if (!reduce) {
      window.setTimeout(() => {
        if (Math.abs(window.scrollY - from) < 2) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' })
        }
      }, 160)
    }
  }

  return (
    <section className="card toc-card">
      <h3 className="toc-title">
        <Icon.text />
        本页目录
      </h3>
      <nav className="toc-nav" aria-label="文章目录">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`toc-link level-${item.level}${active === item.id ? ' active' : ''}`}
            onClick={(e) => jump(e, item.id)}
            title={item.text}
          >
            {item.text}
          </a>
        ))}
      </nav>
    </section>
  )
}
