import { Link } from 'react-router-dom'
import { Icon } from './Icons'
import ContactLinks from './ContactLinks'
import {
  categories,
  categoryCount,
  activeSeries,
  seriesCount,
  site,
} from '../data/posts'

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
      <ContactLinks />
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
        {categories.map((c) => {
          const n = categoryCount(c.name)
          return (
            <li key={c.name}>
              <Link
                to={`/category/${encodeURIComponent(c.name)}`}
                className="side-row"
              >
                <span className="side-row-label">{c.name}</span>
                {n > 0 && <span className="count-badge">{n}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
      <Link to="/categories" className="side-more">
        查看全部分类 ›
      </Link>
    </section>
  )
}

export function SeriesCard() {
  const list = activeSeries()
  if (!list.length) return null

  // 按分类分组显示：一眼能看出这门课属于哪一块
  const groups = categories
    .map((c) => ({ cat: c, items: list.filter((s) => s.category === c.name) }))
    .filter((g) => g.items.length > 0)

  return (
    <section className="card side-card series-card">
      <div className="side-card-head">
        <span className="side-card-bar" />
        <h2>系列</h2>
      </div>
      {groups.map((g) => (
        <div key={g.cat.name} className="series-group">
          <span className="series-group-name">{g.cat.name}</span>
          <ul className="side-list series-list">
            {g.items.map((s) => {
              const Ico = Icon[s.icon] || Icon.layers
              return (
                <li key={s.name}>
                  <Link
                    to={`/series/${encodeURIComponent(s.name)}`}
                    className="side-row series-row"
                  >
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
        </div>
      ))}
    </section>
  )
}
