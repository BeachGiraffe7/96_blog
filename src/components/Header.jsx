import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Icon } from './Icons'
import ThemePanel from './ThemePanel'
import { site } from '../data/posts'
import { applyTheme, watchSystem } from '../lib/theme'

const nav = [
  { to: '/', label: '主页', end: true },
  { to: '/archive', label: '归档' },
  { to: '/categories', label: '分类' },
  { to: '/moments', label: '碎碎念' },
  { to: '/growth', label: '成长' },
  { to: '/about', label: '关于' },
]

export default function Header({ query, onQueryChange }) {
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState(false)
  const [hint, setHint] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    applyTheme()
    // 系统深浅变化时 applyTheme 已在内部处理，这里只需保持订阅
    return watchSystem(() => {})
  }, [])

  const submit = (e) => {
    e.preventDefault()
    navigate(query ? `/?q=${encodeURIComponent(query)}` : '/')
  }

  const showHint = () => {
    setHint(true)
    window.setTimeout(() => setHint(false), 2600)
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark" />
          <span className="brand-name">{site.name}</span>
        </Link>

        <nav className="main-nav">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
          <a
            className="nav-link"
            href={`https://github.com/${site.repo}`}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
            <span className="nav-ext">↗</span>
          </a>
        </nav>

        <div className="header-actions">
          <Link
            to="/write?type=post"
            className="icon-btn accent compose-btn"
            aria-label="写文章"
            title="写文章"
          >
            <Icon.plus />
          </Link>

          <form
            className={open ? 'search-box open' : 'search-box'}
            onSubmit={submit}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onBlur={() => !query && setOpen(false)}
              placeholder="搜索文章…"
              aria-label="搜索文章"
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => setOpen((v) => !v)}
              aria-label="搜索"
            >
              <Icon.search />
            </button>
          </form>

          <button
            type="button"
            className={
              panel ? 'icon-btn theme-toggle active' : 'icon-btn theme-toggle'
            }
            onClick={() => setPanel((v) => !v)}
            aria-label="外观设置"
            aria-expanded={panel}
            title="外观与字体"
          >
            <Icon.palette />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={showHint}
            aria-label="设置"
            title="设置"
          >
            <Icon.settings />
          </button>

          {hint && <span className="header-hint">更多设置稍后上线</span>}

          {panel && <ThemePanel onClose={() => setPanel(false)} />}
        </div>
      </div>
    </header>
  )
}
