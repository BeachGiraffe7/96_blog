import { Link } from 'react-router-dom'
import { PageHead } from '../components/Layout'
import { posts, categories, seriesInCategory, seriesCount } from '../data/posts'
import { Icon } from '../components/Icons'

export default function Categories() {
  return (
    <div className="feed">
      <PageHead
        title="分类"
        desc="五个方向。每个方向下的系列，是一段段按时间积累的学习记录。"
        count={categories.length}
      />

      <div className="cat-grid">
        {categories.map((c) => {
          const items = posts.filter((p) => p.category === c.name)
          const subs = seriesInCategory(c.name)
          return (
            <section key={c.name} className="card cat-card">
              <div className="cat-card-head">
                <span className="cat-badge lg" style={{ background: c.color }}>
                  {c.letter}
                </span>
                <div>
                  <h3>{c.name}</h3>
                  <p>{c.desc}</p>
                </div>
              </div>

              {subs.length > 0 ? (
                <div className="cat-series">
                  {subs.map((s) => (
                    <Link
                      key={s.name}
                      to={`/series/${encodeURIComponent(s.name)}`}
                      className="series-chip"
                    >
                      <Icon.layers />
                      {s.name}
                      <span className="series-chip-count">{seriesCount(s.name)}</span>
                    </Link>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="cat-empty-line">这个方向还没开始写</p>
              ) : (
                <p className="cat-empty-line">这些文章暂时没有归入系列</p>
              )}

              <div className="cat-card-foot">
                <span className="cat-card-count">{items.length} 篇文章</span>
                <Link to={`/category/${encodeURIComponent(c.name)}`} className="cat-card-more">
                  查看全部 ›
                </Link>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
