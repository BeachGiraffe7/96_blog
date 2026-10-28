import { Link, useParams, useSearchParams } from 'react-router-dom'
import PostCard from '../components/PostCard'
import { posts, categories } from '../data/posts'
import { Icon } from '../components/Icons'

export default function Home() {
  const { name: catName } = useParams()
  const [sp] = useSearchParams()
  const q = (sp.get('q') || '').trim().toLowerCase()

  let list = posts
  if (catName) list = list.filter((p) => p.category === catName)
  if (q)
    list = list.filter((p) =>
      [p.title, p.excerpt, p.category, ...p.tags].join(' ').toLowerCase().includes(q),
    )

  const filtered = Boolean(catName || q)
  const cat = catName ? categories.find((c) => c.name === catName) : null

  return (
    <div className="feed">
      {filtered ? (
        <div className="filter-banner">
          <div className="filter-banner-main">
            {cat && (
              <span className="cat-badge" style={{ background: cat.color }}>
                {cat.letter}
              </span>
            )}
            <span className="filter-banner-text">
              {cat ? `分类：${cat.name}` : `搜索：“${sp.get('q')}”`}
            </span>
            <span className="filter-banner-count">{list.length} 篇</span>
          </div>
          <Link to="/" className="filter-clear">
            清除筛选
          </Link>
        </div>
      ) : (
        <div className="list-head">
          <span className="side-card-bar" />
          <h2>最新文章</h2>
          <span className="list-head-count">共 {posts.length} 篇</span>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <Icon.search />
          <p>没有找到相关的文章</p>
          <Link to="/" className="empty-link">
            回到全部文章
          </Link>
        </div>
      ) : (
        <div className="post-list">
          {list.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      )}
    </div>
  )
}
