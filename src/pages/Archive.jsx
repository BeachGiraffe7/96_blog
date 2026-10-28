import { Link } from 'react-router-dom'
import { PageHead } from '../components/Layout'
import { posts, categories, formatNumber } from '../data/posts'

export default function Archive() {
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date))
  const groups = sorted.reduce((acc, p) => {
    const [y, m] = p.date.split('-')
    const key = `${y}`
    acc[key] = acc[key] || {}
    acc[key][m] = acc[key][m] || []
    acc[key][m].push(p)
    return acc
  }, {})

  const catOf = (n) => categories.find((c) => c.name === n)

  return (
    <div className="feed">
      <PageHead title="归档" desc="按时间顺序看看都写了些什么。" count={posts.length} />

      {Object.entries(groups).map(([year, months]) => (
        <section key={year} className="archive-year">
          <div className="archive-year-label">
            <span>{year}</span>
            <i />
          </div>
          {Object.entries(months).map(([month, items]) => (
            <div key={month} className="archive-month">
              <div className="archive-month-label">{Number(month)} 月</div>
              <ul className="archive-list">
                {items.map((p) => (
                  <li key={p.slug}>
                    <Link to={`/post/${p.slug}`} className="archive-item">
                      <span className="archive-date">{p.date.slice(5)}</span>
                      <span className="archive-dot" style={{ background: catOf(p.category)?.color }} />
                      <span className="archive-title">{p.title}</span>
                      <span className="archive-cat">{p.category}</span>
                      <span className="archive-words">{formatNumber(p.words)} 字</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
