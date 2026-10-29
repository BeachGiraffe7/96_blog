import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Icon } from './Icons'
import ThemePanel from './ThemePanel'
import { site } from '../data/posts'
import { applyTheme, setTheme, watchSystem } from '../lib/theme'

const nav = [
  { to: '/', label: '主页', end: true },
  { to: '/archive', label: '归档' },
  { to: '/categories', label: '分类' },
  { to: '/tags', label: '标签' },
  { to: '/moments', label: '碎碎念' },
  { to: '/growth', label: '成长' },
  { to: '/about', label: '关于' },
]

export default function Header({ query, onQueryChange }) {
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState(false)
  const [mode, setMode] = useState('light')
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    setMode(applyTheme())
    return watchSystem(setMode)
  }, [])

  const submit = (e) => {
    e.preventDefault()
    navigate(query ? `/?q=${encodeURIComponent(query)}` : '/')
  }

  const toggleTheme = () => {
    setPanel(false)
    setMode(setTheme(mode === 'dark' ? 'light' : 'dark'))
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
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
          <a className="nav-link" href="https://github.com" target="_blank" rel="noreferrer">
            GitHub
            <span className="nav-ext">↗</span>
          </a>
        </nav>

        <div className="header-actions">
          <form className={open ? 'search-box open' : 'search-box'} onSubmit={submit}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onBlur={() => !query && setOpen(false)}
              placeholder="搜索文章…"
              aria-label="搜索文章"
            />
            <button type="button" className="icon-btn" onClick={() => setOpen((v) => !v)} aria-label="搜索">
              <Icon.search />
            </button>
          </form>

          <button
            type="button"
            className="icon-btn theme-toggle"
            onClick={toggleTheme}
            aria-label={mode === 'dark' ? '切换到浅色' : '切换到深色'}
            title={mode === 'dark' ? '切换到浅色' : '切换到深色'}
          >
            {mode === 'dark' ? <Icon.sun /> : <Icon.moon />}
          </button>

          <button
            type="button"
            className={panel ? 'icon-btn theme-toggle active' : 'icon-btn theme-toggle'}
            onClick={() => setPanel((v) => !v)}
            aria-label="外观设置"
            aria-expanded={panel}
            title="外观设置"
          >
            <Icon.settings />
          </button>

          {panel && (
            <ThemePanel onClose={() => setPanel(false)} onModeChange={setMode} />
          )}
        </div>
      </div>
    </header>
  )
}
