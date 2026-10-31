import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import Header from './Header'
import { CategoryCard, ProfileCard, SeriesCard } from './Sidebar'
import { AboutMiniCard, MomentsCard, StatsCard } from './RightRail'
import TocCard from './TocCard'
import { TocContext } from './tocContext'
import { Icon } from './Icons'
import { site } from '../data/posts'

export default function Layout({ query, onQueryChange }) {
  const { pathname } = useLocation()
  const isAbout = pathname.replace(/\/$/, '') === '/about'
  const [toc, setToc] = useState(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    // 换页先清空，避免上一篇文章的目录残留
    setToc(null)
  }, [pathname])

  return (
    <TocContext.Provider value={setToc}>
      <div className="app">
        <Header query={query} onQueryChange={onQueryChange} />

        <main className={isAbout ? 'shell shell-about' : 'shell'}>
          <aside className="col-left">
            <ProfileCard />
            <CategoryCard />
            <SeriesCard />
          </aside>

          <div className="col-main">
            {/* 页面级懒加载的兜底：只替换正文区，侧栏不闪 */}
            <Suspense
              fallback={
                <div className="empty">
                  <p>加载中…</p>
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>

          <aside className="col-right">
            {toc && toc.length > 0 ? (
              <TocCard items={toc} />
            ) : (
              <>
                <StatsCard />
                <MomentsCard />
                <AboutMiniCard />
              </>
            )}
          </aside>
        </main>

        <footer className="site-footer">
          <div className="footer-inner">
            <span>
              © {new Date().getFullYear()} {site.author} · {site.name}
            </span>
            <span className="footer-sep">·</span>
            <span>记录学习，也记录慢慢变好的过程</span>
            <a
              className="footer-rss"
              href={`${import.meta.env.BASE_URL}feed.xml`}
              target="_blank"
              rel="noreferrer"
              title="RSS 订阅"
              aria-label="RSS 订阅"
            >
              <Icon.rss />
            </a>
          </div>
        </footer>

        <button
          type="button"
          className="to-top"
          aria-label="回到顶部"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <Icon.arrowUp />
        </button>
      </div>
    </TocContext.Provider>
  )
}

export function PageHead({ title, desc, count, action }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">
          {title}
          {count !== undefined && <span className="page-count">{count}</span>}
        </h1>
        {desc && <p className="page-desc">{desc}</p>}
      </div>
      <div className="page-head-actions">
        {action}
        <Link to="/" className="back-home">
          <Icon.arrowLeft />
          返回主页
        </Link>
      </div>
    </div>
  )
}
