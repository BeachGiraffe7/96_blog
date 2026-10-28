import { Link } from 'react-router-dom'
import { PageHead } from '../components/Layout'
import { posts, categories, series, seriesCount } from '../data/posts'
import { Icon } from '../components/Icons'

export default function Categories() {
  return (
    <div className="feed">
      <PageHead title="分类" desc="按主题归类，方便回头翻。" count={categories.length} />

      <div className="cat-grid">
        {categories.map((c) => {
          const items = posts.filter((p) => p.category === c.name)
          return (
            <section key={c.name} className="card cat-card">
              <div className="cat-card-head">
                <span className="cat-badge lg" style={{ background: c.color }}>
                  {c.letter}
                </span>
                <div>
                  <h3>{c.name}</h3>
                  <p>{items.length} 篇文章</p>
                </div>
              </div>
              <ul className="cat-card-list">
                {items.slice(0, 3).map((p) => (
                  <li key={p.slug}>
                    <Link to={`/post/${p.slug}`}>{p.title}</Link>
                  </li>
                ))}
                {items.length === 0 && <li className="empty-line">还没有文章</li>}
              </ul>
              <Link to={`/category/${encodeURIComponent(c.name)}`} className="cat-card-more">
                查看全部 ›
              </Link>
            </section>
          )
        })}
      </div>

      <div className="list-head mt">
        <span className="side-card-bar" />
        <h2>系列</h2>
        <span className="list-head-count">共 {series.length} 个</span>
      </div>

      <div className="series-grid">
        {series.map((s) => {
          const Ico = Icon[s.icon] || Icon.layers
          return (
            <div key={s.name} className="card series-card-lg">
              <span className="series-icon lg">
                <Ico />
              </span>
              <div>
                <h3>{s.name}</h3>
                <p>{s.desc}</p>
              </div>
              <span className="count-badge">{seriesCount(s.name)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
