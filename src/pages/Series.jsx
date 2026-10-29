import { Link, useParams } from 'react-router-dom'
import PostCard from '../components/PostCard'
import { PageHead } from '../components/Layout'
import { categories, postsInSeries, seriesMeta, seriesCount } from '../data/posts'

export default function Series() {
  const { name } = useParams()
  const meta = seriesMeta(name)
  const list = postsInSeries(name)
  const cat = categories.find((c) => c.name === meta?.category)

  if (!meta) {
    return (
      <div className="empty big">
        <p>没有这个系列</p>
        <Link to="/categories" className="empty-link">
          看看全部系列
        </Link>
      </div>
    )
  }

  return (
    <div className="feed">
      <PageHead
        title={meta.name}
        desc={meta.desc}
        count={seriesCount(meta.name)}
        action={
          cat && (
            <Link to={`/category/${encodeURIComponent(cat.name)}`} className="series-cat-link">
              <span className="cat-badge" style={{ background: cat.color }}>
                {cat.letter}
              </span>
              {cat.name}
            </Link>
          )
        }
      />

      {list.length === 0 ? (
        <div className="empty">
          <p>这个系列还没开始写。</p>
          <Link to="/categories" className="empty-link">
            看看别的系列
          </Link>
        </div>
      ) : (
        <>
          <p className="series-order-hint">按时间正序排列，从第一篇往下读。</p>
          <div className="post-list">
            {list.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
