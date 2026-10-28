import { Link } from 'react-router-dom'
import { Icon } from './Icons'
import { categories, categoryCount, series, seriesCount, site } from '../data/posts'

export function ProfileCard() {
  return (
    <section className="card profile-card">
      <div className="avatar-frame">
        <div className="avatar with-photo">
          <img src={site.avatar} alt={site.author} />
        </div>
      </div>
      <h1 className="profile-name">{site.author}</h1>
      <p className="profile-tagline">{site.tagline}</p>
      <div className="profile-links">
        {site.links.map((l) => {
          const Ico = Icon[l.icon]
          return (
            <a
              key={l.label}
              href={l.href}
              className="profile-link"
              aria-label={l.label}
              target={l.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
            >
              <Ico />
            </a>
          )
        })}
      </div>
    </section>
  )
}

export function CategoryCard() {
  return (
    <section className="card side-card">
      <div className="side-card-head">
        <span className="side-card-bar" />
        <h2>分类</h2>
      </div>
      <ul className="side-list">
        {categories.map((c) => (
          <li key={c.name}>
            <Link to={`/category/${encodeURIComponent(c.name)}`} className="side-row">
              <span className="side-row-label">{c.name}</span>
              <span className="count-badge">{categoryCount(c.name)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/categories" className="side-more">
        查看全部分类 ›
      </Link>
    </section>
  )
}

export function SeriesCard() {
  return (
    <section className="card side-card">
      <div className="side-card-head">
        <span className="side-card-bar" />
        <h2>系列</h2>
      </div>
      <ul className="side-list series-list">
        {series.map((s) => {
          const Ico = Icon[s.icon] || Icon.layers
          return (
            <li key={s.name}>
              <Link to="/categories" className="side-row series-row">
                <span className="series-icon">
                  <Ico />
                </span>
                <span className="series-text">
                  <span className="side-row-label">{s.name}</span>
                  <span className="series-desc">{s.desc}</span>
                </span>
                <span className="count-badge">{seriesCount(s.name)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
