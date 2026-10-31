import { Icon } from './Icons'
import {
  formatNumber,
  stats,
  allTags,
  daysAgo,
  moments,
  site,
} from '../data/posts'
import { Link } from 'react-router-dom'

export function StatsCard() {
  const s = stats()
  const rows = [
    { icon: 'text', label: '文章', value: s.posts },
    { icon: 'folder', label: '分类', value: s.categories },
    { icon: 'layers', label: '系列', value: s.series },
    { icon: 'chart', label: '总字数', value: formatNumber(s.words) },
    { icon: 'eye', label: '总阅读', value: formatNumber(s.views) },
    { icon: 'calendar', label: '运行天数', value: s.days },
    { icon: 'clock', label: '最近更新', value: daysAgo(s.latest) },
  ]
  return (
    <section className="card side-card stats-card">
      <div className="side-card-head">
        <span className="side-card-bar" />
        <h2>统计</h2>
      </div>
      <ul className="stats-list">
        {rows.map((r) => {
          const Ico = Icon[r.icon] || Icon.chart
          return (
            <li key={r.label} className="stats-row">
              <span className="stats-label">
                <Ico />
                {r.label}
              </span>
              <span className="stats-value">{r.value}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function TagsCard({ limit = 14 }) {
  const tags = allTags().slice(0, limit)
  return (
    <section className="card side-card">
      <div className="side-card-head">
        <span className="side-card-bar" />
        <h2>标签</h2>
      </div>
      <div className="tag-cloud">
        {tags.map((t) => (
          <Link
            key={t.name}
            to={`/tag/${encodeURIComponent(t.name)}`}
            className="tag-pill"
          >
            {t.name}
            <span className="tag-pill-count">{t.count}</span>
          </Link>
        ))}
      </div>
      <Link to="/tags" className="side-more">
        查看全部标签 ›
      </Link>
    </section>
  )
}

export function MomentsCard({ limit = 3 }) {
  const list = [...moments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
  return (
    <section className="card side-card">
      <div className="side-card-head">
        <span className="side-card-bar" />
        <h2>碎碎念</h2>
      </div>
      <ul className="mini-moments">
        {list.map((m, i) => (
          <li key={`${m.date}-${i}`} className="mini-moment">
            <span className="mini-moment-date">{m.date.slice(5)}</span>
            <p className="mini-moment-text">{m.text}</p>
          </li>
        ))}
      </ul>
      <Link to="/moments" className="side-more">
        查看全部想法 ›
      </Link>
    </section>
  )
}

export function AboutMiniCard() {
  return (
    <section className="card side-card">
      <div className="side-card-head">
        <span className="side-card-bar" />
        <h2>关于本站</h2>
      </div>
      <p className="about-mini-text">{site.bio}</p>
      <Link to="/about" className="side-more">
        了解更多 ›
      </Link>
    </section>
  )
}
