import { useEffect } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import Header from './Header'
import { CategoryCard, ProfileCard, SeriesCard } from './Sidebar'
import { AboutMiniCard, MomentsCard, StatsCard, TagsCard } from './RightRail'
import { Icon } from './Icons'
import { site } from '../data/posts'

export default function Layout({ query, onQueryChange }) {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="app">
      <Header query={query} onQueryChange={onQueryChange} />

      <main className="shell">
        <aside className="col-left">
          <ProfileCard />
          <CategoryCard />
          <SeriesCard />
        </aside>

        <div className="col-main">
          <Outlet />
        </div>

        <aside className="col-right">
          <StatsCard />
          <MomentsCard />
          <TagsCard />
          <AboutMiniCard />
        </aside>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <span>
            © {new Date().getFullYear()} {site.author} · {site.name}
          </span>
          <span className="footer-sep">·</span>
          <span>用手写代码，记录慢慢变好的过程</span>
          <a className="footer-rss" href="#" aria-label="RSS">
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
  )
}

export function PageHead({ title, desc, count }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">
          {title}
          {count !== undefined && <span className="page-count">{count}</span>}
        </h1>
        {desc && <p className="page-desc">{desc}</p>}
      </div>
      <Link to="/" className="back-home">
        <Icon.arrowLeft />
        返回主页
      </Link>
    </div>
  )
}
